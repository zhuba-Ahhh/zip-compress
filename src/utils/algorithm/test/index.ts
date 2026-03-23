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
  const data = runWithPhases("位流封装", () => encodeBitpack(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
  
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
  const data = runWithPhases("位流解码输出", () => decodeBitpack(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
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
  const data = runWithPhases("位流封装", () => encodeBitpack(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
  
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
  const data = runWithPhases("位流解码输出", () => decodeBitpack(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
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
  const data = runWithPhases("位流封装", () => encodeBitpack(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
  
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
  const data = runWithPhases("位流解码输出", () => decodeBitpack(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
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
  const data = runWithPhases("构建树与编码", () => encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
  
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
  const data = runWithPhases("位流解码输出", () => decodeHuffmanDeflate(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
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
  const data = runWithPhases("构建树与编码", () => encodeHuffmanDynamic(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
  
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
  const data = runWithPhases("位流解码输出", () => decodeHuffmanDynamic(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
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
  const data = runWithPhases("构建树与编码", () => encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
  
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
  const data = runWithPhases("位流解码输出", () => decodeHuffmanDeflate(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
  return collectLogs ? { data, logs, phases } : data;
}
