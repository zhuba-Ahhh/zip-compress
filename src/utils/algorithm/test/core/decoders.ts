import { MIN_MATCH_LENGTH } from './types';
import { BitReader, DynamicUint8Array } from './io';
import {
  getLengthBase, getDistanceBase,
  deserializeTreeDeflate, HuffmanNodeDeflate,
  readHuffmanTreeDynamic, HuffmanNodeDynamic
} from './huffman-utils';
import { CompressionLog, PhaseTiming } from '@/types';
import { trackPhase } from './utils';

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
export function decodeBitpack(buffer: Uint8Array, logs?: CompressionLog[], phases?: PhaseTiming[]): Uint8Array {
  const reader = new BitReader(buffer);
  const output = new DynamicUint8Array();

  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: '开始 Bitpacking 解码' });
  let matchCount = 0;
  let literalCount = 0;

  trackPhase('数据解码', () => {
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
        }
      }
    }
  }, phases);

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: '解压完成', 
    level: 'info',
    message: `解压结束。匹配数: ${matchCount}, 字面量数: ${literalCount}`,
    details: {
      decodedMatches: matchCount,
      decodedLiterals: literalCount,
      bytesWritten: output.length
    }
  });
  return output.getArray();
}

/**
 * 解码器 2：动态 Huffman 解码 (对应原 Huffman-1.ts)
 */
export function decodeHuffmanDynamic(buffer: Uint8Array, logs?: CompressionLog[], phases?: PhaseTiming[]): Uint8Array {
  if (buffer.length === 0) return new Uint8Array(0);

  const reader = new BitReader(buffer);
  
  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: '开始动态 Huffman 解码' });

  // 1. 读取 Huffman 树
  const stats = { nodesCount: 0, leavesCount: 0 };
  const root = trackPhase('Huffman重建', () => readHuffmanTreeDynamic(reader, stats), phases);
  if (!root) return new Uint8Array(0);

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: 'Huffman重建', 
    level: 'debug',
    message: '动态 Huffman 树读取成功',
    details: {
      restoredUniqueSymbols: stats.leavesCount,
      totalNodes: stats.nodesCount
    }
  });

  const output = new DynamicUint8Array();

  let matchCount = 0;
  let literalCount = 0;

  // 2. 解码数据
  trackPhase('数据解码', () => {
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
        }
      }
    }
  }, phases);

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: '解压完成', 
    level: 'info',
    message: `解压结束。匹配数: ${matchCount}, 字面量数: ${literalCount}`,
    details: {
      decodedMatches: matchCount,
      decodedLiterals: literalCount,
      bytesWritten: output.length
    }
  });
  return output.getArray();
}

/**
 * 解码器 3：Deflate 风格的双 Huffman 树解码 (对应原 Huffman.ts, Huffman-2.ts)
 */
export function decodeHuffmanDeflate(buffer: Uint8Array, logs?: CompressionLog[], phases?: PhaseTiming[]): Uint8Array {
  const reader = new BitReader(buffer);
  const output = new DynamicUint8Array();

  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: '开始 Deflate Huffman 解码' });

  const llStats = { nodesCount: 0, leavesCount: 0 };
  const distStats = { nodesCount: 0, leavesCount: 0 };
  
  const llRoot = trackPhase('LL树重建', () => deserializeTreeDeflate(reader, 9, llStats), phases);
  const distRoot = trackPhase('Dist树重建', () => deserializeTreeDeflate(reader, 5, distStats), phases);

  if (!llRoot || !distRoot) return new Uint8Array(0);

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: 'Huffman重建', 
    level: 'debug',
    message: 'Deflate 双哈夫曼树读取成功',
    details: {
      restoredUniqueSymbols: llStats.leavesCount + distStats.leavesCount,
      llTreeLeaves: llStats.leavesCount,
      distTreeLeaves: distStats.leavesCount
    }
  });

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

  trackPhase('数据解码', () => {
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
        }
      }
    }
  }, phases);

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: '解压完成', 
    level: 'info',
    message: `解压结束。匹配数: ${matchCount}, 字面量数: ${literalCount}`,
    details: {
      decodedMatches: matchCount,
      decodedLiterals: literalCount,
      bytesWritten: output.length
    }
  });
  return output.getArray();
}
