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

// ==========================================
// 1. 基础版 LZ77 (暴力匹配 + Bitpacking) - 对应原 LZ77.ts
// ==========================================
export function myLZ77Compress(buffer: Uint8Array): Uint8Array {
  return encodeBitpack(lz77CompressSimple(buffer));
}
export function myLZ77Decompress(buffer: Uint8Array): Uint8Array {
  return decodeBitpack(buffer);
}

// ==========================================
// 2. 优化版 LZ77 (哈希链表 + Bitpacking) - 对应原 LZ77-1.ts
// ==========================================
export function myLZ771Compress(buffer: Uint8Array): Uint8Array {
  return encodeBitpack(lz77CompressHashChain(buffer));
}
export function myLZ771Decompress(buffer: Uint8Array): Uint8Array {
  return decodeBitpack(buffer);
}

// ==========================================
// 3. 优化版 LZ77 (环形数组哈希链表 + Bitpacking) - 对应原 LZ77-2.ts
// ==========================================
export function myLZ772Compress(buffer: Uint8Array): Uint8Array {
  return encodeBitpack(lz77CompressHashChainOptimized(buffer));
}
export function myLZ772Decompress(buffer: Uint8Array): Uint8Array {
  return decodeBitpack(buffer);
}

// ==========================================
// 4. 基础版 Huffman (暴力匹配 + 双树 Huffman) - 对应原 Huffman.ts
// ==========================================
export function myHuffmanCompress(buffer: Uint8Array): Uint8Array {
  return encodeHuffmanDeflate(lz77CompressSimple(buffer));
}
export function myHuffmanDecompress(buffer: Uint8Array): Uint8Array {
  return decodeHuffmanDeflate(buffer);
}

// ==========================================
// 5. 优化版 Huffman (哈希链表 + 动态 Huffman) - 对应原 Huffman-1.ts
// ==========================================
export function myHuffman1Compress(buffer: Uint8Array): Uint8Array {
  return encodeHuffmanDynamic(lz77CompressHashChain(buffer));
}
export function myHuffman1Decompress(buffer: Uint8Array): Uint8Array {
  return decodeHuffmanDynamic(buffer);
}

// ==========================================
// 6. 终极版 Huffman (环形数组哈希链表 + 双树 Huffman) - 对应原 Huffman-2.ts
// ==========================================
export function myHuffman2Compress(buffer: Uint8Array): Uint8Array {
  return encodeHuffmanDeflate(lz77CompressHashChainOptimized(buffer));
}
export function myHuffman2Decompress(buffer: Uint8Array): Uint8Array {
  return decodeHuffmanDeflate(buffer);
}
