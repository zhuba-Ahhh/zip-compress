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
import { CompressionLog } from '../../../types';
import { DetailedCompressionResult } from '../../compress';

// ==========================================
// 1. 基础版 LZ77 (暴力匹配 + Bitpacking) - 对应原 LZ77.ts
// ==========================================
export function myLZ77Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const tokens = lz77CompressSimple(buffer, collectLogs ? logs : undefined);
  const data = encodeBitpack(tokens, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}
export function myLZ77Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const data = decodeBitpack(buffer, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}

// ==========================================
// 2. 优化版 LZ77 (哈希链表 + Bitpacking) - 对应原 LZ77-1.ts
// ==========================================
export function myLZ771Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const tokens = lz77CompressHashChain(buffer, collectLogs ? logs : undefined);
  const data = encodeBitpack(tokens, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}
export function myLZ771Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const data = decodeBitpack(buffer, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}

// ==========================================
// 3. 优化版 LZ77 (环形数组哈希链表 + Bitpacking) - 对应原 LZ77-2.ts
// ==========================================
export function myLZ772Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const tokens = lz77CompressHashChainOptimized(buffer, collectLogs ? logs : undefined);
  const data = encodeBitpack(tokens, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}
export function myLZ772Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const data = decodeBitpack(buffer, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}

// ==========================================
// 4. 基础版 Huffman (暴力匹配 + 双树 Huffman) - 对应原 Huffman.ts
// ==========================================
export function myHuffmanCompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const tokens = lz77CompressSimple(buffer, collectLogs ? logs : undefined);
  const data = encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}
export function myHuffmanDecompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const data = decodeHuffmanDeflate(buffer, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}

// ==========================================
// 5. 优化版 Huffman (哈希链表 + 动态 Huffman) - 对应原 Huffman-1.ts
// ==========================================
export function myHuffman1Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const tokens = lz77CompressHashChain(buffer, collectLogs ? logs : undefined);
  const data = encodeHuffmanDynamic(tokens, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}
export function myHuffman1Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const data = decodeHuffmanDynamic(buffer, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}

// ==========================================
// 6. 终极版 Huffman (环形数组哈希链表 + 双树 Huffman) - 对应原 Huffman-2.ts
// ==========================================
export function myHuffman2Compress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const tokens = lz77CompressHashChainOptimized(buffer, collectLogs ? logs : undefined);
  const data = encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}
export function myHuffman2Decompress(buffer: Uint8Array, collectLogs: boolean = false): Uint8Array | DetailedCompressionResult {
  const logs: CompressionLog[] = [];
  const data = decodeHuffmanDeflate(buffer, collectLogs ? logs : undefined);
  return collectLogs ? { data, logs } : data;
}
