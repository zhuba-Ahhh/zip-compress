import pako from 'pako';
import LZString from 'lz-string';
import { myZipCompress, myZipDecompress } from './myzip';
import { myLZ77Compress, myLZ77Decompress } from './test';

export type CompressionAlgorithm = 'pako' | 'lz-string' | 'myzip' | 'lz77';

export interface CompressionResult {
  compressedData: Uint8Array;
  decompressedData: Uint8Array;
}

export const compressData = async (data: Uint8Array, algorithm: CompressionAlgorithm): Promise<Uint8Array> => {
  if (algorithm === 'pako') {
    return pako.deflate(data);
  } else if (algorithm === 'lz-string') {
    // lz-string 主要是对字符串进行压缩，对 Uint8Array 的处理需要转换
    const str = new TextDecoder().decode(data);
    const compressedStr = LZString.compressToUint8Array(str);
    return compressedStr;
  } else if (algorithm === 'myzip') {
    return myZipCompress(data);
  } else if (algorithm === 'lz77') {
    return myLZ77Compress(data);
  } 
  throw new Error('Unsupported algorithm');
};

export const decompressData = async (compressedData: Uint8Array, algorithm: CompressionAlgorithm): Promise<Uint8Array> => {
  if (algorithm === 'pako') {
    return pako.inflate(compressedData);
  } else if (algorithm === 'lz-string') {
    const decompressedStr = LZString.decompressFromUint8Array(compressedData);
    return new TextEncoder().encode(decompressedStr);
  } else if (algorithm === 'myzip') {
    return myZipDecompress(compressedData);
  } else if (algorithm === 'lz77') {
    return myLZ77Decompress(compressedData);
  } 
  throw new Error('Unsupported algorithm');
};
