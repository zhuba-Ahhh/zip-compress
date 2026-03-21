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

// --- 2. 核心算法：LZ77 ---
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

// --- 4. 导出接口：压缩与解压 ---
export function myLZ772Compress(buffer: Uint8Array): Uint8Array {
  const tokens = lz77Compress(buffer);
  const writer = new BitWriter();

  for (const token of tokens) {
    if (token.type === 'literal') {
      writer.writeBit(0);
      writer.writeBits(token.value, 8);
    } else {
      writer.writeBit(1);
      writer.writeBits(token.distance, 12);
      writer.writeBits(token.length, 8);
    }
  }

  // 写入显式的 EOF (End of File) 标志：使用 match flag(1) 和 distance=0
  writer.writeBit(1);
  writer.writeBits(0, 12);
  writer.writeBits(0, 8);

  return writer.flush();
}

export function myLZ772Decompress(buffer: Uint8Array): Uint8Array {
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
