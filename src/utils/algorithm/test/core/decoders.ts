import { MIN_MATCH_LENGTH } from './types';
import { BitReader } from './io';
import {
  getLengthBase, getDistanceBase,
  deserializeTreeDeflate, HuffmanNodeDeflate,
  readHuffmanTreeDynamic, HuffmanNodeDynamic
} from './huffman-utils';

/**
 * 解码器 1：简单的 Bitpacking 解码 (对应原 LZ77.ts, LZ77-1.ts, LZ77-2.ts)
 * 
 * 机制：
 * 按固定位长度读取：先读 1 bit 的 flag。
 * 若为 0，再读 8 bits 作为字面量；
 * 若为 1，再读 12 bits 距离和 8 bits 长度，去之前解压出的结果中拷贝对应片段。
 * 若读到距离为 0，视作 EOF。
 * 
 * @param buffer 压缩后的二进制数据流
 * @returns 解压还原的原始数据
 */
export function decodeBitpack(buffer: Uint8Array): Uint8Array {
  const reader = new BitReader(buffer);
  const output: number[] = [];

  while (true) {
    const flag = reader.readBit();
    if (flag === null) break;

    if (flag === 0) {
      const value = reader.readBits(8);
      if (value === null) break;
      output.push(value);
    } else {
      const distance = reader.readBits(12);
      if (distance === null) break;
      const length = reader.readBits(8);
      if (length === null) break;

      if (distance === 0) break;

      const startIdx = output.length - distance;
      for (let i = 0; i < length; i++) {
        output.push(output[startIdx + i]);
      }
    }
  }
  return new Uint8Array(output);
}

/**
 * 解码器 2：动态 Huffman 解码 (对应原 Huffman-1.ts)
 * 
 * 机制：
 * 1. 先从数据流前端反序列化读取出单一的一棵哈夫曼树。
 * 2. 依据树逐 bit 解码。
 *    - 解出的符号 < 256 为字面量。
 *    - 符号 === 256 为 EOF。
 *    - 符号 > 256 为匹配长度，此时需要再固定读取 12 bits 作为距离。
 * 
 * @param buffer 压缩后的二进制数据流
 * @returns 解压还原的原始数据
 */
export function decodeHuffmanDynamic(buffer: Uint8Array): Uint8Array {
  if (buffer.length === 0) return new Uint8Array(0);

  const reader = new BitReader(buffer);
  
  // 1. 读取 Huffman 树
  const root = readHuffmanTreeDynamic(reader);
  if (!root) return new Uint8Array(0);

  const output: number[] = [];

  // 2. 解码数据
  while (true) {
    let curr: HuffmanNodeDynamic | null = root;
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

/**
 * 解码器 3：Deflate 风格的双 Huffman 树解码 (对应原 Huffman.ts, Huffman-2.ts)
 * 
 * 机制：
 * 1. 从数据流前端先后反序列化读取 Literal/Length 树 和 Distance 树。
 * 2. 依据 LL 树解出符号：
 *    - 若为字面量 (< 256)，直接输出。
 *    - 若为 EOF (256)，结束。
 *    - 若为匹配长度 Code (> 256)，根据规范读取对应数量的 Extra Bits 补全真实长度。
 * 3. 接着再依据 Distance 树解出距离 Code，同样读取 Extra Bits 补全真实距离。
 * 4. 根据解出的真实长度和距离，去输出流历史中拷贝数据。
 * 
 * @param buffer 压缩后的二进制数据流
 * @returns 解压还原的原始数据
 */
export function decodeHuffmanDeflate(buffer: Uint8Array): Uint8Array {
  const reader = new BitReader(buffer);
  const output: number[] = [];

  const llRoot = deserializeTreeDeflate(reader, 9);
  const distRoot = deserializeTreeDeflate(reader, 5);

  if (!llRoot || !distRoot) return new Uint8Array(0);

  function readSymbol(root: HuffmanNodeDeflate): number | null {
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
