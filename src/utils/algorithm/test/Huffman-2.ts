/**
 * 自定义简易版 Deflate 压缩算法 (LZ77 + Bitpacking)
 * 适配浏览器环境的 Uint8Array 和 TypeScript 类型
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

// --- 3. 核心映射表 (Length & Distance) ---
const lengthToCode = new Array<{code: number, extraBits: number, extraVal: number}>(256);
const codeToLength = new Map<number, {base: number, extraBits: number}>();
let currentBase = 3;
let currentExtraBits = 0;
for (let code = 257; code <= 284; code++) {
    if (code >= 265) {
        currentExtraBits = Math.floor((code - 261) / 4);
    }
    const count = 1 << currentExtraBits;
    codeToLength.set(code, { base: currentBase, extraBits: currentExtraBits });
    for (let i = 0; i < count; i++) {
        if (currentBase + i <= 255) {
            lengthToCode[currentBase + i] = { code, extraBits: currentExtraBits, extraVal: i };
        }
    }
    currentBase += count;
}

function getLengthInfo(len: number) {
    return lengthToCode[len];
}
function getLengthBase(code: number) {
    return codeToLength.get(code)!;
}

function getDistanceInfo(dist: number) {
  if (dist === 1) return { code: 0, extraBits: 0, extraVal: 0 };
  if (dist === 2) return { code: 1, extraBits: 0, extraVal: 0 };
  if (dist === 3) return { code: 2, extraBits: 0, extraVal: 0 };
  if (dist === 4) return { code: 3, extraBits: 0, extraVal: 0 };
  const extraBits = Math.floor(Math.log2(dist - 1)) - 1;
  const base = (1 << (extraBits + 1)) + 1;
  const half = 1 << extraBits;
  const code = extraBits * 2 + 2 + (dist - base >= half ? 1 : 0);
  const extraVal = dist - base - (dist - base >= half ? half : 0);
  return { code, extraBits, extraVal };
}

function getDistanceBase(code: number) {
  if (code === 0) return { base: 1, extraBits: 0 };
  if (code === 1) return { base: 2, extraBits: 0 };
  if (code === 2) return { base: 3, extraBits: 0 };
  if (code === 3) return { base: 4, extraBits: 0 };
  const extraBits = Math.floor((code - 2) / 2);
  const base = (1 << (extraBits + 1)) + 1 + ((code % 2) * (1 << extraBits));
  return { base, extraBits };
}

// --- 4. Huffman 树与节点 ---
class HuffmanNode {
  constructor(
    public weight: number,
    public symbol: number | null = null,
    public left: HuffmanNode | null = null,
    public right: HuffmanNode | null = null
  ) {}
}

function buildHuffmanTree(frequencies: number[]) {
  const leaves: HuffmanNode[] = [];
  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] > 0) {
      leaves.push(new HuffmanNode(frequencies[i], i));
    }
  }

  if (leaves.length === 0) {
      const dummy = new HuffmanNode(0, 0);
      return { root: dummy, codes: new Map([[0, {code: 0, bitLen: 1}]]) };
  }
  if (leaves.length === 1) {
    const dummySymbol = leaves[0].symbol === 0 ? 1 : 0;
    leaves.push(new HuffmanNode(0, dummySymbol));
  }

  const nodes = [...leaves];
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.weight - b.weight);
    const left = nodes.shift()!;
    const right = nodes.shift()!;
    const parent = new HuffmanNode(left.weight + right.weight, null, left, right);
    nodes.push(parent);
  }

  const root = nodes[0];
  const codes = new Map<number, {code: number, bitLen: number}>();

  function traverse(node: HuffmanNode, code: number, depth: number) {
    if (node.symbol !== null) {
      codes.set(node.symbol, { code, bitLen: depth });
      return;
    }
    if (node.left) traverse(node.left, (code << 1) | 0, depth + 1);
    if (node.right) traverse(node.right, (code << 1) | 1, depth + 1);
  }

  traverse(root, 0, 0);
  return { root, codes };
}

function serializeTree(root: HuffmanNode | null, writer: BitWriter, symbolBits: number) {
  if (!root) return;
  if (root.symbol !== null) {
    writer.writeBit(0);
    writer.writeBits(root.symbol, symbolBits);
  } else {
    writer.writeBit(1);
    serializeTree(root.left, writer, symbolBits);
    serializeTree(root.right, writer, symbolBits);
  }
}

function deserializeTree(reader: BitReader, symbolBits: number): HuffmanNode | null {
  const bit = reader.readBit();
  if (bit === null) return null;
  if (bit === 0) {
    const symbol = reader.readBits(symbolBits);
    if (symbol === null) return null;
    return new HuffmanNode(0, symbol);
  } else {
    const node = new HuffmanNode(0);
    node.left = deserializeTree(reader, symbolBits);
    node.right = deserializeTree(reader, symbolBits);
    return node;
  }
}

// --- 5. 核心算法：LZ77 ---
type Token =
  | { type: 'literal'; value: number }
  | { type: 'match'; distance: number; length: number };

// 12 bits 最大表示 4095，且 0 被保留用作 EOF，所以实际最大有效距离是 4095
const WINDOW_SIZE = (2 ** 12) - 1;
const MAX_MATCH_LENGTH = (2 ** 8) - 1; // 8 bits 最大长度
const MIN_MATCH_LENGTH = 3;

function lz77Compress(buffer: Uint8Array): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  // 优化：使用哈希链表加速匹配查找 (将 O(N*W) 降低到 O(N))
  const HASH_BITS = 15;
  const HASH_SIZE = 1 << HASH_BITS;
  const HASH_MASK = HASH_SIZE - 1;
  const HASH_SHIFT = 5;

  // head 记录特定 hash 值最后一次出现的位置
  const head = new Int32Array(HASH_SIZE).fill(-1);
  // prev 记录滑动窗口内，同一个 hash 值上一次出现的位置 (环形数组)
  const prev = new Int32Array(WINDOW_SIZE + 1).fill(-1);

  // 计算 3 字节的哈希值
  const getHash = (idx: number) => {
    return ((buffer[idx] << (HASH_SHIFT * 2)) ^ (buffer[idx + 1] << HASH_SHIFT) ^ buffer[idx + 2]) & HASH_MASK;
  };

  while (cursor < buffer.length) {
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    const lookahead = Math.min(buffer.length - cursor, MAX_MATCH_LENGTH);

    // 只有剩余字符 >= MIN_MATCH_LENGTH 时才去查哈希表找 Match
    if (lookahead >= MIN_MATCH_LENGTH) {
      const hash = getHash(cursor);
      let matchIdx = head[hash];

      // 将当前位置插入哈希链表头部
      prev[cursor % (WINDOW_SIZE + 1)] = matchIdx;
      head[hash] = cursor;

      // 限制最大遍历深度，防止哈希冲突或极度重复的数据导致退化
      let limit = 256; 
      const windowStart = Math.max(0, cursor - WINDOW_SIZE);

      while (matchIdx >= windowStart && limit > 0) {
        // 快速剪枝：如果当前最好长度位置的字符不匹配，直接跳过全量比较
        if (buffer[matchIdx + bestMatchLen] === buffer[cursor + bestMatchLen]) {
          let len = 0;
          while (len < lookahead && buffer[matchIdx + len] === buffer[cursor + len]) {
            len++;
          }
          if (len > bestMatchLen) {
            bestMatchLen = len;
            bestMatchDist = cursor - matchIdx;
            if (len === lookahead) break; // 已经是最长可能的匹配了，提前结束
          }
        }
        matchIdx = prev[matchIdx % (WINDOW_SIZE + 1)];
        limit--;
      }
    }

    if (bestMatchLen >= MIN_MATCH_LENGTH) {
      tokens.push({ type: 'match', distance: bestMatchDist, length: bestMatchLen });
      
      // 匹配到的中间字符也需要插入到哈希表中，保持字典完整
      for (let i = 1; i < bestMatchLen; i++) {
        cursor++;
        if (cursor + MIN_MATCH_LENGTH <= buffer.length) {
          const hash = getHash(cursor);
          prev[cursor % (WINDOW_SIZE + 1)] = head[hash];
          head[hash] = cursor;
        }
      }
      cursor++;
    } else {
      tokens.push({ type: 'literal', value: buffer[cursor] });
      cursor++;
    }
  }

  return tokens;
}

// --- 3. 数据结构：位读取器 ---
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

// --- 6. 导出接口：压缩与解压 ---
export function myHuffman2Compress(buffer: Uint8Array): Uint8Array {
  const tokens = lz77Compress(buffer);
  const writer = new BitWriter();

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

  const llTree = buildHuffmanTree(llFreq);
  const distTree = buildHuffmanTree(distFreq);

  serializeTree(llTree.root, writer, 9); // Max LL symbol 285 (9 bits)
  serializeTree(distTree.root, writer, 5); // Max Dist symbol 29 (5 bits)

  for (const token of tokens) {
    if (token.type === 'literal') {
      const codeInfo = llTree.codes.get(token.value)!;
      writer.writeBits(codeInfo.code, codeInfo.bitLen);
    } else {
      const lenInfo = getLengthInfo(token.length);
      const llCodeInfo = llTree.codes.get(lenInfo.code)!;
      writer.writeBits(llCodeInfo.code, llCodeInfo.bitLen);
      if (lenInfo.extraBits > 0) {
        writer.writeBits(lenInfo.extraVal, lenInfo.extraBits);
      }

      const distInfo = getDistanceInfo(token.distance);
      const distCodeInfo = distTree.codes.get(distInfo.code)!;
      writer.writeBits(distCodeInfo.code, distCodeInfo.bitLen);
      if (distInfo.extraBits > 0) {
        writer.writeBits(distInfo.extraVal, distInfo.extraBits);
      }
    }
  }

  const eofInfo = llTree.codes.get(256)!;
  writer.writeBits(eofInfo.code, eofInfo.bitLen);

  return writer.flush();
}

export function myHuffman2Decompress(buffer: Uint8Array): Uint8Array {
  const reader = new BitReader(buffer);
  const output: number[] = [];

  const llRoot = deserializeTree(reader, 9);
  const distRoot = deserializeTree(reader, 5);

  if (!llRoot || !distRoot) return new Uint8Array(0);

  function readSymbol(root: HuffmanNode): number | null {
    let node = root;
    while (node.symbol === null) {
      const bit = reader.readBit();
      if (bit === null) return null;
      node = bit === 0 ? node.left! : node.right!;
    }
    return node.symbol;
  }

  while (true) {
    const symbol = readSymbol(llRoot);
    if (symbol === null) break;

    if (symbol === 256) {
      break; // EOF
    }

    if (symbol < 256) {
      output.push(symbol);
    } else {
      const lenBaseInfo = getLengthBase(symbol);
      let length = lenBaseInfo.base;
      if (lenBaseInfo.extraBits > 0) {
        const extra = reader.readBits(lenBaseInfo.extraBits);
        if (extra === null) break;
        length += extra;
      }

      const distSymbol = readSymbol(distRoot);
      if (distSymbol === null) break;

      const distBaseInfo = getDistanceBase(distSymbol);
      let distance = distBaseInfo.base;
      if (distBaseInfo.extraBits > 0) {
        const extra = reader.readBits(distBaseInfo.extraBits);
        if (extra === null) break;
        distance += extra;
      }

      const startIdx = output.length - distance;
      for (let i = 0; i < length; i++) {
        output.push(output[startIdx + i]);
      }
    }
  }

  return new Uint8Array(output);
}
