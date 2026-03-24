import { 
  lz77CompressSimple, 
  lz77CompressHashChain, 
  lz77CompressHashChainOptimized 
} from './core/lz77-matchers';
import { 
  encodeBitpack, 
  encodeHuffmanDynamic, 
  encodeHuffmanDeflate 
} from './core/encoders';
import { 
  decodeBitpack, 
  decodeHuffmanDynamic, 
  decodeHuffmanDeflate 
} from './core/decoders';
import { LZ77State, compressBlock } from './core/lz77-stream';
import { BitWriter, BitReader, DynamicUint8Array } from './core/io';
import { 
  getLengthInfo, getDistanceInfo, 
  buildHuffmanTreeDeflate, serializeTreeDeflate,
  getLengthBase, getDistanceBase, deserializeTreeDeflate,
  HuffmanNodeDeflate
} from './core/huffman-utils';
import { CompressionLog, PhaseTiming } from '../../../types';
import { DetailedCompressionResult } from '../../compress';

function runWithPhases<T>(
  name: string,
  fn: () => T,
  phases?: PhaseTiming[]
): T {
  const start = performance.now();
  const result = fn();
  if (phases) {
    phases.push({ name, duration: performance.now() - start });
  }
  return result;
}

// ==========================================
// 1. 基础版 LZ77 (暴力匹配 + Bitpacking) - 对应原 LZ77.ts
// ==========================================
export function myLZ77Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;
  const tokens = runWithPhases("LZ77匹配(Pass 1)", () => lz77CompressSimple(buffer, collectLogs ? logs : undefined, advancedMetrics), collectLogs ? phases : undefined);
  const data = encodeBitpack(tokens, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  
  if (collectLogs && logs.length > 0) {
    const finalLog = logs[logs.length - 1];
    if (finalLog.details) {
      finalLog.details.originalBytes = buffer.length;
      finalLog.details.savedBytes = buffer.length - data.length;
    }
  }

  return collectLogs ? { data, logs, phases, advancedMetrics } : data;
}
export function myLZ77Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const data = decodeBitpack(buffer, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  return collectLogs ? { data, logs, phases } : data;
}


// ==========================================
// 2. 优化版 LZ77 (哈希链表 + Bitpacking) - 对应原 LZ77-1.ts
// ==========================================
export function myLZ771Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;
  const tokens = runWithPhases("LZ77匹配(Pass 1)", () => lz77CompressHashChain(buffer, collectLogs ? logs : undefined, advancedMetrics), collectLogs ? phases : undefined);
  const data = encodeBitpack(tokens, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  
  if (collectLogs && logs.length > 0) {
    const finalLog = logs[logs.length - 1];
    if (finalLog.details) {
      finalLog.details.originalBytes = buffer.length;
      finalLog.details.savedBytes = buffer.length - data.length;
    }
  }

  return collectLogs ? { data, logs, phases, advancedMetrics } : data;
}
export function myLZ771Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const data = decodeBitpack(buffer, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  return collectLogs ? { data, logs, phases } : data;
}

// ==========================================
// 3. 优化版 LZ77 (环形数组哈希链表 + Bitpacking) - 对应原 LZ77-2.ts
// ==========================================
export function myLZ772Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;
  const tokens = runWithPhases("LZ77匹配(Pass 1)", () => lz77CompressHashChainOptimized(buffer, collectLogs ? logs : undefined, advancedMetrics), collectLogs ? phases : undefined);
  const data = encodeBitpack(tokens, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  
  if (collectLogs && logs.length > 0) {
    const finalLog = logs[logs.length - 1];
    if (finalLog.details) {
      finalLog.details.originalBytes = buffer.length;
      finalLog.details.savedBytes = buffer.length - data.length;
    }
  }

  return collectLogs ? { data, logs, phases, advancedMetrics } : data;
}
export function myLZ772Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const data = decodeBitpack(buffer, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  return collectLogs ? { data, logs, phases } : data;
}

// ==========================================
// 4. 基础版 Huffman (暴力匹配 + 双树 Huffman) - 对应原 Huffman.ts
// ==========================================
export function myHuffmanCompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;
  const tokens = runWithPhases("LZ77匹配(Pass 1)", () => lz77CompressSimple(buffer, collectLogs ? logs : undefined, advancedMetrics), collectLogs ? phases : undefined);
  const data = encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  
  if (collectLogs && logs.length > 0) {
    const finalLog = logs[logs.length - 1];
    if (finalLog.details) {
      finalLog.details.originalBytes = buffer.length;
      finalLog.details.savedBytes = buffer.length - data.length;
    }
  }

  return collectLogs ? { data, logs, phases, advancedMetrics } : data;
}
export function myHuffmanDecompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const data = decodeHuffmanDeflate(buffer, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  return collectLogs ? { data, logs, phases } : data;
}
 
// ==========================================
// 7. 流式版 Huffman (分块处理 + 动态双 Huffman 树)
// ==========================================
export function myHuffmanStreamCompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const advancedMetrics: import('../../../types').AdvancedMetrics | undefined = collectLogs ? { chunks: [], timeSeries: [] } : undefined;

  const writer = new BitWriter();
  const state = new LZ77State(buffer);
  const BLOCK_SIZE = 32768; // 32KB 块大小

  if (collectLogs) logs.push({ timestamp: performance.now(), phase: '初始化', message: `开始流式处理，总字节: ${buffer.length}` });

  const startTotal = performance.now();
  
  while (state.cursor < buffer.length) {
    const isLast = (state.cursor + BLOCK_SIZE >= buffer.length);
    const blockStartPos = state.cursor;
    
    // 1. LZ77 匹配
    const tokens = runWithPhases(`LZ77匹配 (块)`, () => compressBlock(state, BLOCK_SIZE), collectLogs ? phases : undefined);
    
    // 2. 统计频率并构建树
    const llFreq = new Array(286).fill(0);
    const distFreq = new Array(30).fill(0);
    llFreq[256] = 1; // EOF

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

    const llTree = buildHuffmanTreeDeflate(llFreq);
    const distTree = buildHuffmanTreeDeflate(distFreq);

    // 3. 写入块头 (1 bit BFINAL)
    writer.writeBit(isLast ? 1 : 0);

    // 4. 写入 Huffman 树
    serializeTreeDeflate(llTree.root, writer, 9);
    serializeTreeDeflate(distTree.root, writer, 5);

    // 5. 写入块数据
    for (const token of tokens) {
      if (token.type === 'literal') {
        const info = llTree.codes.get(token.value)!;
        writer.writeBits(info.code, info.bitLen);
      } else {
        const lenInfo = getLengthInfo(token.length);
        const llInfo = llTree.codes.get(lenInfo.code)!;
        writer.writeBits(llInfo.code, llInfo.bitLen);
        if (lenInfo.extraBits > 0) writer.writeBits(lenInfo.extraVal, lenInfo.extraBits);

        const distInfo = getDistanceInfo(token.distance);
        const distInfoCode = distTree.codes.get(distInfo.code)!;
        writer.writeBits(distInfoCode.code, distInfoCode.bitLen);
        if (distInfo.extraBits > 0) writer.writeBits(distInfo.extraVal, distInfo.extraBits);
      }
    }

    // 写入块结束符
    const eofInfo = llTree.codes.get(256)!;
    writer.writeBits(eofInfo.code, eofInfo.bitLen);

    if (advancedMetrics) {
      const originalSize = state.cursor - blockStartPos;
      advancedMetrics.chunks.push({
        offset: blockStartPos,
        originalSize,
        compressedSize: 0, // 简化处理，暂时不精确统计位流大小
        ratio: 0
      });
      advancedMetrics.timeSeries.push({
        timeMs: performance.now() - startTotal,
        processedBytes: state.cursor,
        instantSpeed: 0 // 简化
      });
    }
    
    if (isLast) break;
  }

  const data = writer.flush();
  
  if (collectLogs) {
    logs.push({ 
      timestamp: performance.now(), 
      phase: '压缩完成', 
      level: 'info',
      message: `流式处理完成。总输出: ${data.length} 字节`,
      details: {
        originalSize: buffer.length,
        compressedSize: data.length,
        ratio: `${((data.length / buffer.length) * 100).toFixed(2)}%`
      }
    });
  }

  return collectLogs ? { data, logs, phases, advancedMetrics } : data;
}

export function myHuffmanStreamDecompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const reader = new BitReader(buffer);
  const output = new DynamicUint8Array();

  if (collectLogs) logs.push({ timestamp: performance.now(), phase: '初始化', message: '开始流式 Huffman 解压' });

  while (true) {
    const isLast = reader.readBit();
    if (isLast === null) break;

    // 1. 重建 Huffman 树
    const llRoot = deserializeTreeDeflate(reader, 9);
    const distRoot = deserializeTreeDeflate(reader, 5);
    if (!llRoot || !distRoot) break;

    const readSymbol = (root: HuffmanNodeDeflate): number | null => {
      let node = root;
      while (node.symbol === null) {
        const bit = reader.readBit();
        if (bit === null) return null;
        node = bit === 0 ? node.left! : node.right!;
      }
      return node.symbol;
    };

    // 2. 解码当前块
    while (true) {
      const symbol = readSymbol(llRoot);
      if (symbol === null || symbol === 256) break;

      if (symbol < 256) {
        output.push(symbol);
      } else {
        const lenBase = getLengthBase(symbol);
        let length = lenBase.base;
        if (lenBase.extraBits > 0) {
          const extra = reader.readBits(lenBase.extraBits);
          if (extra === null) break;
          length += extra;
        }

        const distSymbol = readSymbol(distRoot);
        if (distSymbol === null) break;
        const distBase = getDistanceBase(distSymbol);
        let distance = distBase.base;
        if (distBase.extraBits > 0) {
          const extra = reader.readBits(distBase.extraBits);
          if (extra === null) break;
          distance += extra;
        }

        output.copy(output.length - distance, length);
      }
    }

    if (isLast === 1) break;
  }

  const data = output.getArray();
  return collectLogs ? { data, logs, phases } : data;
}

// ==========================================
// 5. 优化版 Huffman (哈希链表 + 动态 Huffman) - 对应原 Huffman-1.ts
// ==========================================
export function myHuffman1Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;
  const tokens = runWithPhases("LZ77匹配(Pass 1)", () => lz77CompressHashChain(buffer, collectLogs ? logs : undefined, advancedMetrics), collectLogs ? phases : undefined);
  const data = encodeHuffmanDynamic(tokens, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  
  if (collectLogs && logs.length > 0) {
    const finalLog = logs[logs.length - 1];
    if (finalLog.details) {
      finalLog.details.originalBytes = buffer.length;
      finalLog.details.savedBytes = buffer.length - data.length;
    }
  }

  return collectLogs ? { data, logs, phases, advancedMetrics } : data;
}
export function myHuffman1Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const data = decodeHuffmanDynamic(buffer, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  return collectLogs ? { data, logs, phases } : data;
}

// ==========================================
// 6. 终极版 Huffman (环形数组哈希链表 + 双树 Huffman) - 对应原 Huffman-2.ts
// ==========================================
export function myHuffman2Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;
  const tokens = runWithPhases("LZ77匹配(Pass 1)", () => lz77CompressHashChainOptimized(buffer, collectLogs ? logs : undefined, advancedMetrics), collectLogs ? phases : undefined);
  const data = encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  
  if (collectLogs && logs.length > 0) {
    const finalLog = logs[logs.length - 1];
    if (finalLog.details) {
      finalLog.details.originalBytes = buffer.length;
      finalLog.details.savedBytes = buffer.length - data.length;
    }
  }

  return collectLogs ? { data, logs, phases, advancedMetrics } : data;
}
export function myHuffman2Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const phases: PhaseTiming[] = [];
  const data = decodeHuffmanDeflate(buffer, collectLogs ? logs : undefined, collectLogs ? phases : undefined);
  return collectLogs ? { data, logs, phases } : data;
}

