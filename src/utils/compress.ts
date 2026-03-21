import pako from 'pako';
import LZString from 'lz-string';
import { myZipCompress, myZipDecompress } from './algorithm/myzip';
import { myLZ77Compress, myLZ77Decompress, myLZ771Compress, myLZ771Decompress, myHuffmanCompress, myHuffmanDecompress, myHuffman1Compress, myHuffman1Decompress, myLZ772Compress, myLZ772Decompress, myHuffman2Compress, myHuffman2Decompress } from './algorithm/test';
import { CompressionAlgorithm } from '../common';

export interface CompressionResult {
  compressedData: Uint8Array;
  decompressedData: Uint8Array;
}

const compressors: Record<string, (data: Uint8Array) => Uint8Array | Promise<Uint8Array>> = {
  [CompressionAlgorithm.Pako]: (data) => pako.deflate(data),
  [CompressionAlgorithm.LZString]: (data) => {
    const str = new TextDecoder().decode(data);
    return LZString.compressToUint8Array(str);
  },
  [CompressionAlgorithm.MyZip]: myZipCompress,
  [CompressionAlgorithm.LZ77]: myLZ77Compress,
  [CompressionAlgorithm.LZ771]: myLZ771Compress,
  [CompressionAlgorithm.LZ772]: myLZ772Compress,
  [CompressionAlgorithm.Huffman]: myHuffmanCompress,
  [CompressionAlgorithm.Huffman1]: myHuffman1Compress,
  [CompressionAlgorithm.Huffman2]: myHuffman2Compress,
};

const deCompressors: Record<string, (data: Uint8Array) => Uint8Array | Promise<Uint8Array>> = {
  [CompressionAlgorithm.Pako]: (data) => pako.inflate(data),
  [CompressionAlgorithm.LZString]: (data) => {
    const decompressedStr = LZString.decompressFromUint8Array(data);
    return new TextEncoder().encode(decompressedStr);
  },
  [CompressionAlgorithm.MyZip]: myZipDecompress,
  [CompressionAlgorithm.LZ77]: myLZ77Decompress,
  [CompressionAlgorithm.LZ771]: myLZ771Decompress,
  [CompressionAlgorithm.LZ772]: myLZ772Decompress,
  [CompressionAlgorithm.Huffman]: myHuffmanDecompress,
  [CompressionAlgorithm.Huffman1]: myHuffman1Decompress,
  [CompressionAlgorithm.Huffman2]: myHuffman2Decompress,
};

export const compressData = async (data: Uint8Array, algorithm: CompressionAlgorithm): Promise<Uint8Array> => {
  const compressor = compressors[algorithm];
  if (!compressor) {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  return compressor(data);
};

export const decompressData = async (compressedData: Uint8Array, algorithm: CompressionAlgorithm): Promise<Uint8Array> => {
  const decompressor = deCompressors[algorithm];
  if (!decompressor) {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  return decompressor(compressedData);
};
