export enum CompressionAlgorithm {
  Pako = 'pako',
  LZString = 'lz-string',
  MyZip = 'myzip',
  LZ77 = 'lz77',
  LZ771 = 'lz77-1',
  LZ772 = 'lz77-2',
  Huffman = 'huffman',
  Huffman1 = 'huffman-1',
  Huffman2 = 'huffman-2',
  HuffmanStream = 'huffman-stream',
}

export const ALGORITHM_OPTIONS = [
  { value: CompressionAlgorithm.Pako, label: 'pako', description: '工业级标准 (Zlib/Deflate)' },
  { value: CompressionAlgorithm.LZString, label: 'lz-string', description: '基于 LZW 的轻量级字符串压缩' },
  { value: CompressionAlgorithm.MyZip, label: 'myzip', description: '自定义完整版 (LZ77 + Hash Chain + 动态 Huffman + Elias Gamma)' },
  { value: CompressionAlgorithm.LZ77, label: 'lz77', description: '基础 LZ77 (O(N*W) 暴力匹配 + 固定位宽写入)' },
  { value: CompressionAlgorithm.LZ771, label: 'lz77-1', description: 'LZ77 优化版 (O(N*W) 暴力匹配 + 简单游程/标记)' },
  { value: CompressionAlgorithm.LZ772, label: 'lz77-2', description: 'LZ77 极速版 (O(N) 哈希链表匹配 + 固定位宽写入)' },
  { value: CompressionAlgorithm.Huffman, label: 'huffman', description: '基础 Deflate (O(N*W) 暴力匹配 + 静态双 Huffman 树)' },
  { value: CompressionAlgorithm.Huffman1, label: 'huffman-1', description: '单树 Deflate (O(N) 哈希链表 + 动态单 Huffman 树，距离不编码，速度快)' },
  { value: CompressionAlgorithm.Huffman2, label: 'huffman-2', description: '标准 Deflate (O(N) 哈希链表 + 动态双 Huffman 树，长度/距离映射，压缩率高)' },
  { value: CompressionAlgorithm.HuffmanStream, label: 'huffman-stream', description: '流式 Deflate (分块处理 + 动态双 Huffman 树 + 内存复用，适合大文件)' },
];

export const MAX_FILE_SIZE_HINT = '500MB';

export const RANDOM_TEXT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 中文测试数据随机生成 ';
