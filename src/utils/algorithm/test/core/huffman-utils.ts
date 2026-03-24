import { BitWriter, BitReader } from './io';

// ==========================================
// Deflate 标准映射表 (Length & Distance)
// Deflate 协议为了用更少的 bit 表示较大的 length 和 distance，
// 采用了 "Base Code + Extra Bits" 的方式。
// ==========================================

// Length 映射：将 3~258 的长度映射为 257~285 的 Code
// 以及对应的 Extra Bits (附加位数量) 和 Extra Val (附加位的值)
export const lengthToCode = new Array<{code: number, extraBits: number, extraVal: number}>(256);
export const codeToLength = new Map<number, {base: number, extraBits: number}>();
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

export function getLengthInfo(len: number) {
    return lengthToCode[len];
}
export function getLengthBase(code: number) {
    return codeToLength.get(code)!;
}

// Distance 映射：将 1~32768 的距离映射为 0~29 的 Code
// 以及对应的 Extra Bits 和 Extra Val
const distExtraBits = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13
];
const distBases = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577
];

export function getDistanceInfo(dist: number) {
  let code = 0;
  // 简单查找 code
  if (dist <= 4) {
    code = dist - 1;
  } else {
    // 使用二分查找或直接遍历，因为只有 30 个 code
    for (let i = 29; i >= 0; i--) {
      if (dist >= distBases[i]) {
        code = i;
        break;
      }
    }
  }
  
  const extraBits = distExtraBits[code];
  const extraVal = dist - distBases[code];
  return { code, extraBits, extraVal };
}

export function getDistanceBase(code: number) {
  return { base: distBases[code], extraBits: distExtraBits[code] };
}

// ==========================================
// 树结构 1：Deflate 风格的 Huffman 树节点
// 特点：用于构建标准的 Literal/Length 树和 Distance 树，
// 叶子节点包含 symbol（即 Code），内部节点 symbol 为 null。
// ==========================================
export class HuffmanNodeDeflate {
  constructor(
    public weight: number,
    public symbol: number | null = null,
    public left: HuffmanNodeDeflate | null = null,
    public right: HuffmanNodeDeflate | null = null
  ) {}
}

export function buildHuffmanTreeDeflate(frequencies: number[], logs?: any[]) {
  const startPhase = performance.now();
  const leaves: HuffmanNodeDeflate[] = [];
  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] > 0) {
      leaves.push(new HuffmanNodeDeflate(frequencies[i], i));
    }
  }

  if (leaves.length === 0) {
      const dummy = new HuffmanNodeDeflate(0, 0);
      if (logs) logs.push({ timestamp: performance.now(), phase: 'Huffman建树(Deflate)', message: '发现空频率表，创建空树', level: 'warn' });
      return { root: dummy, codes: new Map([[0, {code: 0, bitLen: 1}]]) };
  }
  if (leaves.length === 1) {
    const dummySymbol = leaves[0].symbol === 0 ? 1 : 0;
    leaves.push(new HuffmanNodeDeflate(0, dummySymbol));
  }

  const nodes = [...leaves];
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.weight - b.weight);
    const left = nodes.shift()!;
    const right = nodes.shift()!;
    const parent = new HuffmanNodeDeflate(left.weight + right.weight, null, left, right);
    nodes.push(parent);
  }

  const root = nodes[0];
  const codes = new Map<number, {code: number, bitLen: number}>();
  let maxDepth = 0;

  function traverse(node: HuffmanNodeDeflate, code: number, depth: number) {
    if (node.symbol !== null) {
      codes.set(node.symbol, { code, bitLen: depth });
      if (depth > maxDepth) maxDepth = depth;
      return;
    }
    if (node.left) traverse(node.left, (code << 1) | 0, depth + 1);
    if (node.right) traverse(node.right, (code << 1) | 1, depth + 1);
  }

  traverse(root, 0, 0);

  if (logs) {
    logs.push({ 
      timestamp: performance.now(), 
      phase: 'Huffman建树(Deflate)', 
      message: `树构建完毕。耗时: ${(performance.now() - startPhase).toFixed(2)}ms`,
      level: 'debug',
      details: {
        leafCount: leaves.length,
        maxDepth
      }
    });
  }

  return { root, codes };
}

export function serializeTreeDeflate(root: HuffmanNodeDeflate | null, writer: BitWriter, symbolBits: number): number {
  let bitsWritten = 0;
  if (!root) return bitsWritten;
  if (root.symbol !== null) {
    writer.writeBit(0);
    writer.writeBits(root.symbol, symbolBits);
    bitsWritten += 1 + symbolBits;
  } else {
    writer.writeBit(1);
    bitsWritten += 1;
    bitsWritten += serializeTreeDeflate(root.left, writer, symbolBits);
    bitsWritten += serializeTreeDeflate(root.right, writer, symbolBits);
  }
  return bitsWritten;
}

export function deserializeTreeDeflate(reader: BitReader, symbolBits: number, stats?: { nodesCount: number, leavesCount: number }): HuffmanNodeDeflate | null {
  if (stats) stats.nodesCount++;
  
  const bit = reader.readBit();
  if (bit === null) return null;
  if (bit === 0) {
    const symbol = reader.readBits(symbolBits);
    if (symbol === null) return null;
    if (stats) stats.leavesCount++;
    return new HuffmanNodeDeflate(0, symbol);
  } else {
    const node = new HuffmanNodeDeflate(0);
    node.left = deserializeTreeDeflate(reader, symbolBits, stats);
    node.right = deserializeTreeDeflate(reader, symbolBits, stats);
    return node;
  }
}

// ==========================================
// 树结构 2：动态 Huffman (Huffman-1 风格) 的树节点
// 特点：叶子节点包含 value，内部节点包含频率，
// 结构较简单，且包含特有的 `writeHuffmanTree` 先序遍历序列化方法。
// ==========================================
export class HuffmanNodeDynamic {
  value: number | null;
  freq: number;
  left: HuffmanNodeDynamic | null;
  right: HuffmanNodeDynamic | null;

  constructor(value: number | null, freq: number) {
    this.value = value;
    this.freq = freq;
    this.left = null;
    this.right = null;
  }
}

// 写入 Huffman 树 (先序遍历：内部节点=0, 叶子节点=1+9位数据)
export function writeHuffmanTreeDynamic(node: HuffmanNodeDynamic | null, writer: BitWriter): number {
  let bitsWritten = 0;
  if (!node) return bitsWritten;
  if (node.value !== null) {
    writer.writeBit(1);
    writer.writeBits(node.value, 9);
    bitsWritten += 10;
  } else {
    writer.writeBit(0);
    bitsWritten += 1;
    bitsWritten += writeHuffmanTreeDynamic(node.left, writer);
    bitsWritten += writeHuffmanTreeDynamic(node.right, writer);
  }
  return bitsWritten;
}

// 读取 Huffman 树
export function readHuffmanTreeDynamic(reader: BitReader, stats?: { nodesCount: number, leavesCount: number }): HuffmanNodeDynamic | null {
  if (stats) stats.nodesCount++;

  const bit = reader.readBit();
  if (bit === null) return null;
  if (bit === 1) {
    const val = reader.readBits(9);
    if (val === null) return null;
    if (stats) stats.leavesCount++;
    return new HuffmanNodeDynamic(val, 0);
  } else {
    const left = readHuffmanTreeDynamic(reader, stats);
    const right = readHuffmanTreeDynamic(reader, stats);
    const node = new HuffmanNodeDynamic(null, 0);
    node.left = left;
    node.right = right;
    return node;
  }
}
