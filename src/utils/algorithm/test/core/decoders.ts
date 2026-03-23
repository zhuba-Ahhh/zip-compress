import { MIN_MATCH_LENGTH } from './types';
import { BitReader, DynamicUint8Array } from './io';
import {
  getLengthBase, getDistanceBase,
  deserializeTreeDeflate, HuffmanNodeDeflate,
  readHuffmanTreeDynamic, HuffmanNodeDynamic
} from './huffman-utils';
import { CompressionLog } from '../../../../types';

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
export function decodeBitpack(buffer: Uint8Array, logs?: CompressionLog[]): Uint8Array {
  const reader = new BitReader(buffer);
  const output = new DynamicUint8Array();

  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: '开始 Bitpacking 解码' });
  let matchCount = 0;
  let literalCount = 0;

  while (true) {
    const flag = reader.readBit();
    if (flag === null) break;

    if (flag === 0) {
      const value = reader.readBits(8);
      if (value === null) break;
      output.push(value);
      literalCount++;
    } else {
      const distance = reader.readBits(12);
      if (distance === null) break;
      const length = reader.readBits(8);
      if (length === null) break;

      if (distance === 0) break;

      const startIdx = output.length - distance;
      if (startIdx >= 0) {
        output.copy(startIdx, length);
        matchCount++;
        if (logs && matchCount <= 5) {
          logs.push({ timestamp: performance.now(), phase: 'LZ77解码', message: `应用匹配: 距离=${distance}, 长度=${length}` });
        }
      }
    }
  }

  if (logs) logs.push({ timestamp: performance.now(), phase: '解压完成', message: `解压结束。匹配数: ${matchCount}, 字面量数: ${literalCount}` });
  return output.getArray();
}

/**
 * 解码器 2：动态 Huffman 解码 (对应原 Huffman-1.ts)
 */
export function decodeHuffmanDynamic(buffer: Uint8Array, logs?: CompressionLog[]): Uint8Array {
  if (buffer.length === 0) return new Uint8Array(0);

  const reader = new BitReader(buffer);
  
  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: '开始动态 Huffman 解码' });

  // 1. 读取 Huffman 树
  const root = readHuffmanTreeDynamic(reader);
  if (!root) return new Uint8Array(0);

  if (logs) logs.push({ timestamp: performance.now(), phase: 'Huffman重建', message: '动态 Huffman 树读取成功' });

  const output = new DynamicUint8Array();

  let matchCount = 0;
  let literalCount = 0;

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
      literalCount++;
    } else {
      // Match length
      const length = symbol - 257 + MIN_MATCH_LENGTH;
      const distance = reader.readBits(12);
      if (distance === null) break;

      const startIdx = output.length - distance;
      if (startIdx >= 0) {
        output.copy(startIdx, length);
        matchCount++;
        if (logs && matchCount <= 5) {
          logs.push({ timestamp: performance.now(), phase: 'LZ77解码', message: `应用匹配: 距离=${distance}, 长度=${length}` });
        }
      }
    }
  }

  if (logs) logs.push({ timestamp: performance.now(), phase: '解压完成', message: `解压结束。匹配数: ${matchCount}, 字面量数: ${literalCount}` });
  return output.getArray();
}

/**
 * 解码器 3：Deflate 风格的双 Huffman 树解码 (对应原 Huffman.ts, Huffman-2.ts)
 */
export function decodeHuffmanDeflate(buffer: Uint8Array, logs?: CompressionLog[]): Uint8Array {
  const reader = new BitReader(buffer);
  const output = new DynamicUint8Array();

  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: '开始 Deflate Huffman 解码' });

  const llRoot = deserializeTreeDeflate(reader, 9);
  const distRoot = deserializeTreeDeflate(reader, 5);

  if (!llRoot || !distRoot) return new Uint8Array(0);

  if (logs) logs.push({ timestamp: performance.now(), phase: 'Huffman重建', message: 'Deflate 双哈夫曼树读取成功' });

  function readSymbol(root: HuffmanNodeDeflate): number | null {
    let node = root;
    while (node.symbol === null) {
      const bit = reader.readBit();
      if (bit === null) return null;
      node = bit === 0 ? node.left! : node.right!;
    }
    return node.symbol;
  }

  let matchCount = 0;
  let literalCount = 0;

  while (true) {
    const symbol = readSymbol(llRoot);
    if (symbol === null) break;

    if (symbol === 256) {
      break; // EOF
    }

    if (symbol < 256) {
      output.push(symbol);
      literalCount++;
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
      if (startIdx >= 0) {
        output.copy(startIdx, length);
        matchCount++;
        if (logs && matchCount <= 5) {
          logs.push({ timestamp: performance.now(), phase: 'LZ77解码', message: `应用匹配: 距离=${distance}, 长度=${length}` });
        }
      }
    }
  }

  if (logs) logs.push({ timestamp: performance.now(), phase: '解压完成', message: `解压结束。匹配数: ${matchCount}, 字面量数: ${literalCount}` });
  return output.getArray();
}
