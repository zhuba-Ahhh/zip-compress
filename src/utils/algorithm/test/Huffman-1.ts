/**
 * 优化版 Deflate 压缩算法 (LZ77 + Hash Chain + Huffman 编码)
 * 在 LZ77 基础上，增加动态 Huffman 编码优化生成的树
 */

// --- 1. 数据结构：位写入器 ---
class BitWriter {
  private bytes: number[] = [];
  private currentByte: number = 0;
  private bitPos: number = 0;

  writeBit(bit: number) {
    this.currentByte = (this.currentByte << 1) | bit;
    this.bitPos++;

    if (this.bitPos === 8) {
      this.bytes.push(this.currentByte);
      this.currentByte = 0;
      this.bitPos = 0;
    }
  }

  writeBits(value: number, numBits: number) {
    for (let i = numBits - 1; i >= 0; i--) {
      this.writeBit((value >> i) & 1);
    }
  }

  flush(): Uint8Array {
    if (this.bitPos > 0) {
      this.currentByte <<= (8 - this.bitPos);
      this.bytes.push(this.currentByte);
      this.bitPos = 0;
    }
    return new Uint8Array(this.bytes);
  }
}

// --- 2. 数据结构：位读取器 ---
class BitReader {
  private buffer: Uint8Array;
  private bytePos: number = 0;
  private bitPos: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  readBit(): number | null {
    if (this.bytePos >= this.buffer.length) return null;
    const bit = (this.buffer[this.bytePos] >> (7 - this.bitPos)) & 1;
    this.bitPos++;
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  readBits(numBits: number): number | null {
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      const bit = this.readBit();
      if (bit === null) return null;
      value = (value << 1) | bit;
    }
    return value;
  }
}

// --- 3. 核心算法：LZ77 (哈希链表优化) ---
type Token =
  | { type: 'literal'; value: number }
  | { type: 'match'; distance: number; length: number };

// 12 bits 最大表示 4095
const WINDOW_SIZE = (2 ** 12) - 1;
const MAX_MATCH_LENGTH = (2 ** 8) - 1; // 8 bits 最大长度, 255
const MIN_MATCH_LENGTH = 3;

const HASH_SHIFT = 5;
const HASH_MASK = (2 ** 16) - 1; // 16 bits 哈希空间

function lz77Compress(buffer: Uint8Array): Token[] {
  const tokens: Token[] = [];
  const len = buffer.length;
  let cursor = 0;

  const head = new Int32Array(HASH_MASK + 1).fill(-1);
  const prev = new Int32Array(len).fill(-1);

  let currentHash = 0;

  const insertString = (pos: number) => {
    if (pos <= len - MIN_MATCH_LENGTH) {
      currentHash = ((buffer[pos] << (HASH_SHIFT * 2)) ^ (buffer[pos + 1] << HASH_SHIFT) ^ buffer[pos + 2]) & HASH_MASK;
      prev[pos] = head[currentHash];
      head[currentHash] = pos;
    }
  };

  while (cursor < len) {
    insertString(cursor);

    let matchHead = prev[cursor];
    const limit = Math.max(0, cursor - WINDOW_SIZE);
    let chainLength = 256; 
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    while (matchHead >= limit && matchHead >= 0 && matchHead < cursor && chainLength-- > 0) {
      let matchLen = 0;
      const lookahead = Math.min(len - cursor, MAX_MATCH_LENGTH);

      if (buffer[matchHead + bestMatchLen] === buffer[cursor + bestMatchLen]) {
        while (matchLen < lookahead && buffer[matchHead + matchLen] === buffer[cursor + matchLen]) {
          matchLen++;
        }

        if (matchLen > bestMatchLen) {
          bestMatchLen = matchLen;
          bestMatchDist = cursor - matchHead;
          if (bestMatchLen >= MAX_MATCH_LENGTH) break; 
        }
      }
      matchHead = prev[matchHead]; 
    }

    if (bestMatchLen >= MIN_MATCH_LENGTH) {
      tokens.push({ type: 'match', distance: bestMatchDist, length: bestMatchLen });
      for (let i = 1; i < bestMatchLen; i++) {
        cursor++;
        insertString(cursor);
      }
      cursor++;
    } else {
      tokens.push({ type: 'literal', value: buffer[cursor] });
      cursor++;
    }
  }

  return tokens;
}

// --- 4. 动态 Huffman 编码 ---
class HuffmanNode {
  value: number | null;
  freq: number;
  left: HuffmanNode | null;
  right: HuffmanNode | null;

  constructor(value: number | null, freq: number) {
    this.value = value;
    this.freq = freq;
    this.left = null;
    this.right = null;
  }
}

// 写入 Huffman 树 (先序遍历：内部节点=0, 叶子节点=1+9位数据)
function writeHuffmanTree(node: HuffmanNode | null, writer: BitWriter) {
  if (!node) return;
  if (node.value !== null) {
    writer.writeBit(1);
    writer.writeBits(node.value, 9);
  } else {
    writer.writeBit(0);
    writeHuffmanTree(node.left, writer);
    writeHuffmanTree(node.right, writer);
  }
}

// 读取 Huffman 树
function readHuffmanTree(reader: BitReader): HuffmanNode | null {
  const bit = reader.readBit();
  if (bit === null) return null;
  if (bit === 1) {
    const val = reader.readBits(9);
    if (val === null) return null;
    return new HuffmanNode(val, 0);
  } else {
    const left = readHuffmanTree(reader);
    const right = readHuffmanTree(reader);
    const node = new HuffmanNode(null, 0);
    node.left = left;
    node.right = right;
    return node;
  }
}

// --- 5. 导出接口：压缩与解压 ---

export function myHuffman1Compress(buffer: Uint8Array): Uint8Array {
  if (buffer.length === 0) return new Uint8Array(0);

  const tokens = lz77Compress(buffer);
  
  // 1. 统计频率
  // 符号映射: 0-255(字面量), 256(EOF), 257-511(匹配长度: 257代表长度3)
  const freqs = new Int32Array(512).fill(0);
  freqs[256] = 1; // EOF

  for (const token of tokens) {
    if (token.type === 'literal') {
      freqs[token.value]++;
    } else {
      freqs[257 + token.length - MIN_MATCH_LENGTH]++;
    }
  }

  // 2. 构建 Huffman 树
  const nodes: HuffmanNode[] = [];
  for (let i = 0; i < 512; i++) {
    if (freqs[i] > 0) {
      nodes.push(new HuffmanNode(i, freqs[i]));
    }
  }

  while (nodes.length > 1) {
    nodes.sort((a, b) => b.freq - a.freq);
    const right = nodes.pop()!;
    const left = nodes.pop()!;
    const parent = new HuffmanNode(null, left.freq + right.freq);
    parent.left = left;
    parent.right = right;
    nodes.push(parent);
  }
  const root = nodes[0];

  // 3. 生成编码表
  const codes: { [key: number]: { code: number, len: number } } = {};
  const buildCodes = (node: HuffmanNode | null, code: number, length: number) => {
    if (!node) return;
    if (node.value !== null) {
      codes[node.value] = { code, len: length };
      return;
    }
    buildCodes(node.left, (code << 1) | 0, length + 1);
    buildCodes(node.right, (code << 1) | 1, length + 1);
  };
  buildCodes(root, 0, 0);

  const writer = new BitWriter();

  // 4. 将 Huffman 树写入流
  writeHuffmanTree(root, writer);

  // 5. 写入压缩数据
  for (const token of tokens) {
    if (token.type === 'literal') {
      const huff = codes[token.value];
      writer.writeBits(huff.code, huff.len);
    } else {
      const symbol = 257 + token.length - MIN_MATCH_LENGTH;
      const huff = codes[symbol];
      writer.writeBits(huff.code, huff.len);
      // Distance 依然用 12 bits 固定长度
      writer.writeBits(token.distance, 12);
    }
  }

  // 写入 EOF
  const eofHuff = codes[256];
  writer.writeBits(eofHuff.code, eofHuff.len);

  return writer.flush();
}

export function myHuffman1Decompress(buffer: Uint8Array): Uint8Array {
  if (buffer.length === 0) return new Uint8Array(0);

  const reader = new BitReader(buffer);
  
  // 1. 读取 Huffman 树
  const root = readHuffmanTree(reader);
  if (!root) return new Uint8Array(0);

  const output: number[] = [];

  // 2. 解码数据
  while (true) {
    let curr: HuffmanNode | null = root;
    // 遍历到叶子节点
    while (curr && curr.value === null) {
      const bit = reader.readBit();
      if (bit === null) break;
      if (bit === 0) curr = curr.left;
      else curr = curr.right;
    }

    if (!curr || curr.value === null) break;
    const symbol = curr.value;

    if (symbol === 256) {
      break; // EOF
    }

    if (symbol < 256) {
      // Literal
      output.push(symbol);
    } else {
      // Match length
      const length = symbol - 257 + MIN_MATCH_LENGTH;
      const distance = reader.readBits(12);
      if (distance === null) break;

      const startIdx = output.length - distance;
      for (let i = 0; i < length; i++) {
        output.push(output[startIdx + i]);
      }
    }
  }

  return new Uint8Array(output);
}
