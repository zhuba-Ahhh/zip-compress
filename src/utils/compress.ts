import pako from 'pako';
import LZString from 'lz-string';
import { myZipCompress, myZipDecompress } from '@/utils/algorithm/myzip';
import { 
  myLZ77Compress, myLZ77Decompress, 
  myLZ771Compress, myLZ771Decompress, 
  myHuffmanCompress, myHuffmanDecompress, 
  myHuffman1Compress, myHuffman1Decompress, 
  myLZ772Compress, myLZ772Decompress, 
  myHuffman2Compress, myHuffman2Decompress,
  myHuffmanStreamCompress, myHuffmanStreamDecompress,
  myHuffmanStreamOptimizedCompress, myHuffmanStreamOptimizedDecompress,
  myHuffmanStreamFastDecodeCompress, myHuffmanStreamFastDecodeDecompress
} from '@/utils/algorithm/test';
import { CompressionAlgorithm } from '@/common';
import { CompressionLog, PhaseTiming } from '@/types';

export interface CompressionResult {
  compressedData: Uint8Array;
  decompressedData: Uint8Array;
}

export interface DetailedCompressionResult {
  data: Uint8Array;
  logs?: CompressionLog[];
  phases?: PhaseTiming[];
  advancedMetrics?: import('@/types').AdvancedMetrics;
}

const compressors: Record<string, (data: Uint8Array, collectLogs?: boolean) => Uint8Array | Promise<Uint8Array> | DetailedCompressionResult> = {
  [CompressionAlgorithm.Pako]: (data) => pako.deflate(data),
  [CompressionAlgorithm.LZString]: (data) => {
    const str = new TextDecoder().decode(data);
    return LZString.compressToUint8Array(str);
  },
  [CompressionAlgorithm.MyZip]: (data, collectLogs = false) => myZipCompress(data, collectLogs) as DetailedCompressionResult,
  [CompressionAlgorithm.LZ77]: (data, collectLogs = false) => myLZ77Compress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.LZ771]: (data, collectLogs = false) => myLZ771Compress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.LZ772]: (data, collectLogs = false) => myLZ772Compress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.Huffman]: (data, collectLogs = false) => myHuffmanCompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.Huffman1]: (data, collectLogs = false) => myHuffman1Compress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.Huffman2]: (data, collectLogs = false) => myHuffman2Compress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.HuffmanStream]: (data, collectLogs = false) => myHuffmanStreamCompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.HuffmanStreamOptimized]: (data, collectLogs = false) => myHuffmanStreamOptimizedCompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.HuffmanStreamFastDecode]: (data, collectLogs = false) => myHuffmanStreamFastDecodeCompress(data, collectLogs) as unknown as DetailedCompressionResult,
};

const deCompressors: Record<string, (data: Uint8Array, collectLogs?: boolean) => Uint8Array | Promise<Uint8Array> | DetailedCompressionResult> = {
  [CompressionAlgorithm.Pako]: (data) => pako.inflate(data),
  [CompressionAlgorithm.LZString]: (data) => {
    const decompressedStr = LZString.decompressFromUint8Array(data);
    return new TextEncoder().encode(decompressedStr);
  },
  [CompressionAlgorithm.MyZip]: (data, collectLogs = false) => myZipDecompress(data, collectLogs) as DetailedCompressionResult,
  [CompressionAlgorithm.LZ77]: (data, collectLogs = false) => myLZ77Decompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.LZ771]: (data, collectLogs = false) => myLZ771Decompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.LZ772]: (data, collectLogs = false) => myLZ772Decompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.Huffman]: (data, collectLogs = false) => myHuffmanDecompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.Huffman1]: (data, collectLogs = false) => myHuffman1Decompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.Huffman2]: (data, collectLogs = false) => myHuffman2Decompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.HuffmanStream]: (data, collectLogs = false) => myHuffmanStreamDecompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.HuffmanStreamOptimized]: (data, collectLogs = false) => myHuffmanStreamOptimizedDecompress(data, collectLogs) as unknown as DetailedCompressionResult,
  [CompressionAlgorithm.HuffmanStreamFastDecode]: (data, collectLogs = false) => myHuffmanStreamFastDecodeDecompress(data, collectLogs) as unknown as DetailedCompressionResult,
};

export const compressData = async (data: Uint8Array, algorithm: CompressionAlgorithm, collectLogs: boolean = false): Promise<DetailedCompressionResult> => {
  const compressor = compressors[algorithm];
  if (!compressor) {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  const result = await compressor(data, collectLogs);
  if (result instanceof Uint8Array) {
    return { data: result };
  }
  return result;
};

export const decompressData = async (compressedData: Uint8Array, algorithm: CompressionAlgorithm, collectLogs: boolean = false): Promise<DetailedCompressionResult> => {
  const decompressor = deCompressors[algorithm];
  if (!decompressor) {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  const result = await decompressor(compressedData, collectLogs);
  if (result instanceof Uint8Array) {
    return { data: result };
  }
  return result;
};

