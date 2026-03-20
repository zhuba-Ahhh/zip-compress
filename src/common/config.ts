export enum CompressionAlgorithm {
  Pako = 'pako',
  LZString = 'lz-string',
  MyZip = 'myzip',
  LZ77 = 'lz77',
  LZ771 = 'lz77-1',
}

export const ALGORITHM_OPTIONS = [
  { value: CompressionAlgorithm.Pako, label: 'pako', description: '基于 zlib 标准的高性能压缩库' },
  { value: CompressionAlgorithm.LZString, label: 'lz-string', description: '基于 LZW 算法的轻量级字符串压缩' },
  { value: CompressionAlgorithm.MyZip, label: 'myzip', description: '自定义高性能压缩 (LZ77 + Hash Chain + 动态 Huffman + Elias Gamma)' },
  { value: CompressionAlgorithm.LZ77, label: 'lz77', description: '基础 LZ77 算法 (暴力搜索匹配)' },
  { value: CompressionAlgorithm.LZ771, label: 'lz77-1', description: '优化版 LZ77 (哈希链表加速 + Bitpacking)' },
];

export const MAX_FILE_SIZE_HINT = '500MB';

export const RANDOM_TEXT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 中文测试数据随机生成 ';
