import { BitWriter } from './BitWriter';
import { BitReader } from './BitReader';
import { HuffmanNode } from './Huffman';
import { PhaseTiming, CompressionLog, AdvancedMetrics } from '../../../types';

export interface MyZipCompressResult {
  data: Uint8Array;
  logs?: CompressionLog[];
  phases?: PhaseTiming[];
  advancedMetrics?: AdvancedMetrics;
}

/**
 * myZipCompress - 高性能版压缩算法 (LZ77 + 变长编码 + 惰性匹配优化)
 *
 * 核心优化点：
 * 1. 哈希链表 (Hash Chain)：加速 LZ77 的滑动窗口字符串查找。
 * 2. 惰性匹配 (Lazy Matching)：如果当前位置找到匹配，但下一个位置能找到更长的匹配，则放弃当前匹配（作为普通字符输出），以获得更高的整体压缩率。
 * 3. 动态 Huffman 编码：根据数据特征动态构建最优的字面量 (Literal) 编码树。
 * 4. Elias Gamma 编码：用于高效存储无上界的正整数（如距离、长度、频率等）。
 * 5. 不可压缩回退：如果压缩后的数据反而变大，则直接存储原始数据。
 */
export function myZipCompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | MyZipCompressResult {
  const len = buffer.length;
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];

  const advancedMetrics: AdvancedMetrics = {
    chunks: [],
    timeSeries: []
  };
  const CHUNK_SIZE = 16384; // 16KB blocks for heatmap
  let currentChunkStart = 0;
  let currentChunkCompressedBits = 0;
  
  const SAMPLE_INTERVAL_MS = 5; // 5ms for time series
  let lastSampleTime = performance.now();
  let lastSampleBytes = 0;


  const trackPhase = (name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    if (collectLogs) {
      phases.push({ name, duration: performance.now() - start });
    }
  };
  
  const addLog = (phase: string, message: string, details?: unknown) => {
    if (collectLogs) {
      logs.push({ timestamp: performance.now(), phase, message, details });
    }
  };

  if (len === 0) {
    const emptyResult = new Uint8Array(0);
    return collectLogs ? { data: emptyResult, logs, phases, advancedMetrics } : emptyResult;
  }

  let writer!: BitWriter;
  trackPhase('初始化', () => {
    addLog('初始化', `开始压缩，共 ${len} 字节`);
    writer = new BitWriter(Math.max(len + 16, 1024));
    writer.writeBits(len, 32);
  });

  const tokens: number[] = [];
  const WINDOW_SIZE = 32768; 
  const MAX_MATCH_LENGTH = 258; 
  const MIN_MATCH_LENGTH = 3; 
  const HASH_SHIFT = 5;
  const HASH_MASK = 65535; 

  const head = new Int32Array(HASH_MASK + 1).fill(-1);
  const prev = new Int32Array(len).fill(-1);

  let currentHash = 0;

  const insertString = (pos: number) => {
    if (pos <= len - MIN_MATCH_LENGTH) {
      currentHash = ((buffer[pos] << (HASH_SHIFT * 2)) ^ (buffer[pos + 1] << HASH_SHIFT) ^ buffer[pos + 2]) & HASH_MASK;
      prev[pos] = head[currentHash];
      head[currentHash] = pos;
    }
  };

  if (len >= MIN_MATCH_LENGTH) {
    currentHash = ((buffer[0] << (HASH_SHIFT * 2)) ^ (buffer[0 + 1] << HASH_SHIFT) ^ buffer[0 + 2]) & HASH_MASK;
  }

  let cursor = 0;
  let matchCount = 0;
  let literalCount = 0;

  const findMatch = (pos: number) => {
    let matchHead = prev[pos];
    const limit = Math.max(0, pos - WINDOW_SIZE); 
    let chainLength = 256; 
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    while (matchHead >= limit && matchHead >= 0 && matchHead < pos && chainLength-- > 0) {
      let matchLen = 0;
      const lookahead = Math.min(len - pos, MAX_MATCH_LENGTH);

      if (buffer[matchHead + bestMatchLen] === buffer[pos + bestMatchLen]) {
        while (matchLen < lookahead && buffer[matchHead + matchLen] === buffer[pos + matchLen]) {
          matchLen++;
        }

        if (matchLen > bestMatchLen) {
          bestMatchLen = matchLen;
          bestMatchDist = pos - matchHead;
          if (bestMatchLen >= MAX_MATCH_LENGTH) break; 
        }
      }
      matchHead = prev[matchHead]; 
    }
    return { len: bestMatchLen, dist: bestMatchDist };
  };

  const freqs = new Int32Array(256).fill(0);

  trackPhase('LZ77匹配(Pass 1)', () => {
    addLog('LZ77匹配', '开始执行 LZ77 匹配过程');

    const startTime = performance.now();
  while (cursor < len) {
    const now = performance.now();
    if (collectLogs && now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
      const processed = cursor;
      const deltaBytes = processed - lastSampleBytes;
      const deltaMs = now - lastSampleTime;
      advancedMetrics.timeSeries.push({
        timeMs: now - startTime,
        processedBytes: processed,
        instantSpeed: deltaMs > 0 ? (deltaBytes / 1024 / 1024) / (deltaMs / 1000) : 0
      });
      lastSampleTime = now;
      lastSampleBytes = processed;
    }
    insertString(cursor);
    const match = findMatch(cursor);

    if (match.len >= MIN_MATCH_LENGTH) {
      let nextMatch = { len: 0, dist: 0 };
      if (cursor + 1 < len) {
        insertString(cursor + 1);
        nextMatch = findMatch(cursor + 1);
      }

      if (nextMatch.len > match.len && nextMatch.len >= MIN_MATCH_LENGTH) {
        tokens.push(buffer[cursor]);
        freqs[buffer[cursor]]++;
        
        if (collectLogs && literalCount < 5) {
          addLog('LZ77惰性匹配', `触发惰性匹配: 在位置 ${cursor} 放弃长度 ${match.len} 的匹配，因下一位置有长度 ${nextMatch.len} 的更优匹配`, {
            cursor,
            currentMatch: match,
            nextMatch: nextMatch,
            outputLiteral: buffer[cursor]
          });
        }
        
        cursor++;
        literalCount++;
        continue;
      }
    }

    if (match.len >= MIN_MATCH_LENGTH && match.dist > 0 && match.dist <= WINDOW_SIZE) {
      tokens.push(-((match.dist << 12) | match.len));
      for (let i = 1; i < match.len; i++) {
        cursor++;
        insertString(cursor);
      }
      cursor++;
      matchCount++;
      if (collectLogs && matchCount <= 5) {
        addLog('LZ77匹配', `找到匹配: 距离=${match.dist}, 长度=${match.len}, 位置=${cursor - match.len}`);
      }
    } else {
      tokens.push(buffer[cursor]);
      freqs[buffer[cursor]]++;
      cursor++;
      literalCount++;
    }

    // Heatmap tracking
    if (collectLogs) {
      // Rough estimation of bits
      if (match.len >= MIN_MATCH_LENGTH && match.dist > 0 && match.dist <= WINDOW_SIZE) {
         currentChunkCompressedBits += 24; // approx 1 bit flag + 12 dist + 11 len = 24 bits
      } else {
         currentChunkCompressedBits += 9; // approx 1 bit flag + 8 bit lit = 9 bits
      }

      if (cursor - currentChunkStart >= CHUNK_SIZE) {
        advancedMetrics.chunks.push({
          offset: currentChunkStart,
          originalSize: cursor - currentChunkStart,
          compressedSize: currentChunkCompressedBits / 8,
          ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)
        });
        currentChunkStart = cursor;
        currentChunkCompressedBits = 0;
      }
    }

  }

  if (collectLogs && cursor > currentChunkStart) {
    advancedMetrics.chunks.push({
      offset: currentChunkStart,
      originalSize: cursor - currentChunkStart,
      compressedSize: currentChunkCompressedBits / 8,
      ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)
    });
  }
  addLog('LZ77完成', `LZ77 匹配完成。找到 ${matchCount} 个匹配和 ${literalCount} 个字面量。`);
  });

  let root!: HuffmanNode;
  trackPhase('构建Huffman树', () => {
    const nodes: HuffmanNode[] = [];
    for (let i = 0; i < 256; i++) {
      if (freqs[i] > 0) {
        nodes.push(new HuffmanNode(i, freqs[i]));
      }
    }

    if (nodes.length === 0) {
      nodes.push(new HuffmanNode(0, 1));
    }

    while (nodes.length > 1) {
      nodes.sort((a, b) => b.freq - a.freq);
      const right = nodes.pop()!;
      const left = nodes.pop()!;
      const parent = new HuffmanNode(null, left.freq + right.freq);
      parent.left = left;
      parent.right = right;
      nodes.push(parent);
    }
    root = nodes[0];
  });

  const huffmanCodes: { [key: number]: { code: number, len: number } } = {};
  
  let expectedBits = 0;
  trackPhase('构建树与编码', () => {
    const buildCodes = (node: HuffmanNode | null, code: number, length: number) => {
      if (!node) return;
      if (node.value !== null) {
        huffmanCodes[node.value] = { code, len: length };
        return;
      }
      buildCodes(node.left, (code << 1) | 0, length + 1);
      buildCodes(node.right, (code << 1) | 1, length + 1);
    };
    buildCodes(root, 0, 0);

    if (collectLogs) {
      const sortedSymbols = Object.entries(huffmanCodes)
        .map(([sym, huff]) => ({
          symbol: parseInt(sym) < 256 ? String.fromCharCode(parseInt(sym)) : `SPECIAL_${parseInt(sym)}`,
          freq: freqs[parseInt(sym)],
          codeStr: huff.code.toString(2).padStart(huff.len, '0'),
          bitLength: huff.len
        }))
        .sort((a, b) => b.freq - a.freq)
        .slice(0, 10);
        
      addLog('Huffman建树', '动态 Huffman 树构建成功', {
        independentCharSetSize: Object.keys(huffmanCodes).length,
        rootNodesWeight: root.freq,
        topSymbols: sortedSymbols
      });
    }

    const gammaLength = (value: number) => {
      if (value <= 0) return 0;
      return 2 * Math.floor(Math.log2(value)) + 1;
    };

    for (let i = 0; i < 256; i++) {
      expectedBits += gammaLength(freqs[i] + 1);
    }

    for (const token of tokens) {
      expectedBits += 1;
      if (token >= 0) {
        expectedBits += huffmanCodes[token].len;
      } else {
        const val = -token;
        const dist = val >> 12;
        const matchLen = val & 0xFFF;
        expectedBits += gammaLength(dist);
        expectedBits += gammaLength(matchLen - MIN_MATCH_LENGTH + 1);
      }
    }

    addLog('容量预估', `预期压缩后位数: ${expectedBits}, 原始位数: ${len * 8}`);
  });

  if (expectedBits >= len * 8) {
    addLog('回退机制', '压缩效果不佳，回退为存储原始数据。');
    writer.writeBit(0);
    writer.writeBytes(buffer);
    const resultData = writer.flush();
    return collectLogs ? { data: resultData, logs, phases, advancedMetrics } : resultData;
  }

  trackPhase('位流封装', () => {
    writer.writeBit(1);

    for (let i = 0; i < 256; i++) {
      writer.writeGamma(freqs[i] + 1);
    }

    addLog('编码写入', '正在将 Token 写入位流...');

    for (const token of tokens) {
      if (token >= 0) {
        writer.writeBit(0);
        const huff = huffmanCodes[token];
        writer.writeBits(huff.code, huff.len);
      } else {
        const val = -token;
        const dist = val >> 12;
        const matchLen = val & 0xFFF;
        writer.writeBit(1);
        writer.writeGamma(dist);
        writer.writeGamma(matchLen - MIN_MATCH_LENGTH + 1);
      }
    }

    const resultData = writer.flush();
    addLog('压缩完成', `压缩结束。最终大小: ${resultData.length} 字节`);
  });
  
  const resultDataFinal = writer.flush();
  return collectLogs ? { data: resultDataFinal, logs, phases, advancedMetrics } : resultDataFinal;
}

export function myZipDecompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | MyZipCompressResult {
  const reader = new BitReader(buffer);
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];

  const trackPhase = (name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    if (collectLogs) {
      phases.push({ name, duration: performance.now() - start });
    }
  };

  const addLog = (phase: string, message: string, details?: unknown) => {
    if (collectLogs) {
      logs.push({ timestamp: performance.now(), phase, message, details });
    }
  };

  let expectedLength = 0;
  let isCompressed: number | null = null;
  
  trackPhase('初始化', () => {
    addLog('初始化', `开始解压，输入大小 ${buffer.length} 字节`);

    const len = reader.readBits(32);
    if (len !== null) expectedLength = len;
  });

  if (expectedLength === 0) {
    const res = new Uint8Array(0);
    return collectLogs ? { data: res, logs, phases } : res;
  }

  trackPhase('解析头部', () => {
    addLog('解析头部', `预期解压后大小: ${expectedLength} 字节`);
    isCompressed = reader.readBit();
  });

  if (isCompressed === null) {
    const res = new Uint8Array(0);
    return collectLogs ? { data: res, logs, phases } : res;
  }

  if (isCompressed === 0) {
    addLog('解码', '数据以原始字节存储，直接提取。');
    const raw = reader.readBytes(expectedLength);
    const res = raw || new Uint8Array(0);
    return collectLogs ? { data: res, logs, phases } : res;
  }

  let root: HuffmanNode | null = null;

  trackPhase('Huffman重建', () => {
    const freqs = new Int32Array(256);
    const nodes: HuffmanNode[] = [];

    for (let i = 0; i < 256; i++) {
      const freq = reader.readGamma();
      if (freq === null) {
        return; // will handle gracefully
      }
      freqs[i] = freq - 1; 
      if (freqs[i] > 0) {
        nodes.push(new HuffmanNode(i, freqs[i]));
      }
    }

    if (nodes.length === 0) {
      nodes.push(new HuffmanNode(0, 1));
    }

    while (nodes.length > 1) {
      nodes.sort((a, b) => b.freq - a.freq);
      const right = nodes.pop()!;
      const left = nodes.pop()!;
      const parent = new HuffmanNode(null, left.freq + right.freq);
      parent.left = left;
      parent.right = right;
      nodes.push(parent);
    }
    root = nodes[0];

    addLog('Huffman重建', 'Huffman 树重建成功', {
      restoredLeavesCount: freqs.filter(f => f > 0).length,
      rootWeight: root.freq
    });
  });

  const output = new Uint8Array(expectedLength);
  
  trackPhase('解码', () => {
    let outPos = 0;
    const MIN_MATCH_LENGTH = 3;
    let matchCount = 0;
    let literalCount = 0;

    addLog('解码', '正在解码位流...');

    while (outPos < expectedLength) {
      const flag = reader.readBit();
      if (flag === null) break;

      if (flag === 0) {
        let curr: HuffmanNode | null = root;
        while (curr && curr.value === null) {
          const bit = reader.readBit();
          if (bit === null) break;
          if (bit === 0) curr = curr.left;
          else curr = curr.right;
        }

        if (!curr || curr.value === null) break;
        output[outPos++] = curr.value;
        literalCount++;
      } else {
        const distance = reader.readGamma();
        if (distance === null) break;

        const lengthOffset = reader.readGamma();
        if (lengthOffset === null) break;

        const length = lengthOffset + MIN_MATCH_LENGTH - 1;

        if (distance === 0) {
          break;
        }

        const startIdx = outPos - distance;

        if (startIdx < 0) {
          break; 
        }

        const copyLen = Math.min(length, expectedLength - outPos);
        for (let i = 0; i < copyLen; i++) {
          output[outPos++] = output[startIdx + i];
        }
        matchCount++;
        if (collectLogs && matchCount <= 5) {
          addLog('LZ77解码', `应用匹配: 距离=${distance}, 长度=${length}`);
        }
      }
    }

    addLog('解压完成', `解压结束。共处理 ${matchCount} 个匹配和 ${literalCount} 个字面量。`);
  });
  
  return collectLogs ? { data: output, logs, phases } : output;
}
