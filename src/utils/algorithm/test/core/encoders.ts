import { Token, MIN_MATCH_LENGTH } from './types';
import { BitWriter } from './io';
import {
  getLengthInfo, getDistanceInfo,
  buildHuffmanTreeDeflate,
  HuffmanNodeDynamic, writeHuffmanTreeDynamic,
  serializeTreeDeflate
} from './huffman-utils';
import { CompressionLog, PhaseTiming } from '@/types';
import { trackPhase } from './utils';

/**
 * 编码器 1：简单的 Bitpacking 编码 (对应原 LZ77.ts, LZ77-1.ts, LZ77-2.ts)
 */
export function encodeBitpack(tokens: Token[], logs?: CompressionLog[], phases?: PhaseTiming[]): Uint8Array {
  const writer = new BitWriter();
  
  let matchCount = 0;
  let literalCount = 0;

  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: `开始编码 ${tokens.length} 个令牌` });

  trackPhase('位流封装', () => {
    for (const token of tokens) {
      if (token.type === 'literal') {
        writer.writeBit(0);
        writer.writeBits(token.value, 8);
        literalCount++;
      } else {
        writer.writeBit(1);
        writer.writeBits(token.distance, 12);
        writer.writeBits(token.length, 8);
        matchCount++;
      }
    }

    // 写入显式的 EOF (End of File) 标志：使用 match flag(1) 和 distance=0
    writer.writeBit(1);
    writer.writeBits(0, 12);
    writer.writeBits(0, 8);
  }, phases);

  const res = writer.flush();
  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: '编码完成', 
    level: 'info',
    message: `编码大小: ${res.length} 字节`,
    details: {
      encodedLiterals: literalCount,
      encodedMatches: matchCount,
      compressedBytes: res.length,
      estimatedBits: literalCount * 9 + matchCount * 21 + 21
    }
  });
  return res;
}

/**
 * 编码器 2：动态 Huffman 编码 (对应原 Huffman-1.ts)
 */
export function encodeHuffmanDynamic(tokens: Token[], logs?: CompressionLog[], phases?: PhaseTiming[]): Uint8Array {
  if (tokens.length === 0) return new Uint8Array(0);
  
  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: `开始编码 ${tokens.length} 个令牌` });

  // 1. 统计频率
  // 符号映射: 0-255(字面量), 256(EOF), 257-511(匹配长度: 257代表长度3)
  const freqs = new Int32Array(512).fill(0);
  freqs[256] = 1; // EOF

  trackPhase('频率统计', () => {
    for (const token of tokens) {
      if (token.type === 'literal') {
        freqs[token.value]++;
      } else {
        freqs[257 + token.length - MIN_MATCH_LENGTH]++;
      }
    }
  }, phases);

  // 2. 构建 Huffman 树
  const codes: { [key: number]: { code: number, len: number } } = {};
  let root: HuffmanNodeDynamic;

  trackPhase('构建Huffman树', () => {
    const nodes: HuffmanNodeDynamic[] = [];
    for (let i = 0; i < 512; i++) {
      if (freqs[i] > 0) {
        nodes.push(new HuffmanNodeDynamic(i, freqs[i]));
      }
    }

    while (nodes.length > 1) {
      nodes.sort((a, b) => b.freq - a.freq);
      const right = nodes.pop()!;
      const left = nodes.pop()!;
      const parent = new HuffmanNodeDynamic(null, left.freq + right.freq);
      parent.left = left;
      parent.right = right;
      nodes.push(parent);
    }
    root = nodes[0];

    const buildCodes = (node: HuffmanNodeDynamic | null, code: number, length: number) => {
      if (!node) return;
      if (node.value !== null) {
        codes[node.value] = { code, len: length };
        return;
      }
      buildCodes(node.left, (code << 1) | 0, length + 1);
      buildCodes(node.right, (code << 1) | 1, length + 1);
    };
    buildCodes(root, 0, 0);
  }, phases);

  let maxTreeDepth = 0;
  let totalBits = 0;
  let totalFreq = 0;
  let uniqueSymbolsFound = 0;
  for (const key in codes) {
    uniqueSymbolsFound++;
    const len = codes[key].len;
    if (len > maxTreeDepth) maxTreeDepth = len;
    totalBits += len * freqs[parseInt(key)];
    totalFreq += freqs[parseInt(key)];
  }
  const avgCodeLength = totalFreq > 0 ? (totalBits / totalFreq).toFixed(2) : 0;

  if (logs) {
    const sortedSymbols = Object.entries(codes)
      .map(([sym, huff]) => ({
        symbol: parseInt(sym) < 256 ? String.fromCharCode(parseInt(sym)) : `MATCH_LEN_${parseInt(sym) - 257 + MIN_MATCH_LENGTH}`,
        freq: freqs[parseInt(sym)],
        codeStr: huff.code.toString(2).padStart(huff.len, '0'),
        bitLength: huff.len
      }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 10);
      
    logs.push({ 
      timestamp: performance.now(), 
      phase: 'Huffman建树', 
      level: 'info',
      message: '动态 Huffman 树构建成功',
      details: { 
        uniqueSymbolsFound,
        maxTreeDepth,
        avgCodeLength,
        topSymbols: sortedSymbols 
      }
    });
  }

  const writer = new BitWriter();

  // 4. 将 Huffman 树写入流
  trackPhase('写入树结构', () => writeHuffmanTreeDynamic(root, writer), phases);

  // 5. 写入压缩数据
  let encodedLiterals = 0;
  let encodedMatches = 0;

  trackPhase('数据编码', () => {
    for (const token of tokens) {
      if (token.type === 'literal') {
        const huff = codes[token.value];
        writer.writeBits(huff.code, huff.len);
        encodedLiterals++;
      } else {
        const symbol = 257 + token.length - MIN_MATCH_LENGTH;
        const huff = codes[symbol];
        writer.writeBits(huff.code, huff.len);
        // Distance 依然用 12 bits 固定长度
        writer.writeBits(token.distance, 12);
        encodedMatches++;
      }
    }

    // 写入 EOF
    const eofHuff = codes[256];
    writer.writeBits(eofHuff.code, eofHuff.len);
  }, phases);

  const res = writer.flush();
  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: '编码完成', 
    level: 'info',
    message: `编码大小: ${res.length} 字节`,
    details: {
      encodedLiterals,
      encodedMatches,
      treeHeaderSize: `动态计算`,
      compressedBytes: res.length
    }
  });
  return res;
}

/**
 * 编码器 3：Deflate 风格的双 Huffman 树编码 (对应原 Huffman.ts, Huffman-2.ts)
 */
export function encodeHuffmanDeflate(tokens: Token[], logs?: CompressionLog[], phases?: PhaseTiming[]): Uint8Array {
  const writer = new BitWriter();

  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: `开始编码 ${tokens.length} 个令牌` });

  const llFreq = new Array(286).fill(0);
  const distFreq = new Array(30).fill(0);

  llFreq[256] = 1; // EOF

  trackPhase('频率统计', () => {
    for (const token of tokens) {
      if (token.type === 'literal') {
        llFreq[token.value]++;
      } else {
        const lenInfo = getLengthInfo(token.length);
        llFreq[lenInfo.code]++;
        const distInfo = getDistanceInfo(token.distance);
        distFreq[distInfo.code]++;
      }
    }
  }, phases);

  const llTree = trackPhase('构建LL树', () => buildHuffmanTreeDeflate(llFreq, logs), phases);
  const distTree = trackPhase('构建Dist树', () => buildHuffmanTreeDeflate(distFreq, logs), phases);

  // Calculate stats for logs
  let llMaxDepth = 0;
  let distMaxDepth = 0;
  let llTotalBits = 0;
  let llTotalFreq = 0;
  let uniqueSymbolsFound = 0;
  
  for (const [sym, info] of llTree.codes.entries()) {
    uniqueSymbolsFound++;
    if (info.bitLen > llMaxDepth) llMaxDepth = info.bitLen;
    llTotalBits += info.bitLen * llFreq[sym];
    llTotalFreq += llFreq[sym];
  }
  for (const [, info] of distTree.codes.entries()) {
    if (info.bitLen > distMaxDepth) distMaxDepth = info.bitLen;
  }
  const avgCodeLength = llTotalFreq > 0 ? (llTotalBits / llTotalFreq).toFixed(2) : 0;

  if (logs) {
    const sortedSymbols = Array.from(llTree.codes.entries())
      .map(([sym, info]) => ({
        symbol: sym < 256 ? String.fromCharCode(sym) : (sym === 256 ? 'EOF' : `LEN_${sym}`),
        freq: llFreq[sym],
        codeStr: info.code.toString(2).padStart(info.bitLen, '0'),
        bitLength: info.bitLen
      }))
      .filter(x => x.freq > 0)
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 10);

    logs.push({ 
      timestamp: performance.now(), 
      phase: 'Huffman建树', 
      level: 'info',
      message: 'Deflate 双树构建成功',
      details: {
        uniqueSymbolsFound,
        maxTreeDepth: Math.max(llMaxDepth, distMaxDepth),
        avgCodeLength,
        llTreeLeaves: llFreq.filter(f => f > 0).length,
        distTreeLeaves: distFreq.filter(f => f > 0).length,
        topSymbols: sortedSymbols
      }
    });
  }

  const treeHeaderSize = trackPhase('写入树结构', () => {
    const llTreeHeaderSize = serializeTreeDeflate(llTree.root, writer, 9); // 286个符号，用9位
    const distTreeHeaderSize = serializeTreeDeflate(distTree.root, writer, 5); // 30个符号，用5位
    return llTreeHeaderSize + distTreeHeaderSize;
  }, phases);

  let encodedLiterals = 0;
  let encodedMatches = 0;

  trackPhase('数据编码', () => {
    for (const token of tokens) {
      if (token.type === 'literal') {
        const codeInfo = llTree.codes.get(token.value)!;
        writer.writeBits(codeInfo.code, codeInfo.bitLen);
        encodedLiterals++;
      } else {
        const lenInfo = getLengthInfo(token.length);
        const llCodeInfo = llTree.codes.get(lenInfo.code)!;
        writer.writeBits(llCodeInfo.code, llCodeInfo.bitLen);
        if (lenInfo.extraBits > 0) {
          writer.writeBits(lenInfo.extraVal, lenInfo.extraBits);
        }

        const distInfo = getDistanceInfo(token.distance);
        const distCodeInfo = distTree.codes.get(distInfo.code)!;
        writer.writeBits(distCodeInfo.code, distCodeInfo.bitLen);
        if (distInfo.extraBits > 0) {
          writer.writeBits(distInfo.extraVal, distInfo.extraBits);
        }
        encodedMatches++;
      }
    }

    const eofInfo = llTree.codes.get(256)!;
    writer.writeBits(eofInfo.code, eofInfo.bitLen);
  }, phases);

  const res = writer.flush();
  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: '编码完成', 
    level: 'info',
    message: `编码大小: ${res.length} 字节`,
    details: {
      encodedLiterals,
      encodedMatches,
      treeHeaderSize: `${treeHeaderSize} bits`,
      compressedBytes: res.length
    }
  });
  return res;
}
