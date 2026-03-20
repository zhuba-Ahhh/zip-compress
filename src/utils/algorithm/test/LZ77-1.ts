/**
 * 优化版 Deflate 压缩算法 (LZ77 + Hash Chain + Bitpacking)
 * 在原简易版基础上，将暴力匹配替换为哈希链表匹配以大幅提升速度
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

// --- 2. 核心算法：LZ77 (哈希链表优化) ---
type Token =
  | { type: 'literal'; value: number }
  | { type: 'match'; distance: number; length: number };

// 12 bits 最大表示 4095，且 0 被保留用作 EOF，所以实际最大有效距离是 4095
const WINDOW_SIZE = (2 ** 12) - 1;
const MAX_MATCH_LENGTH = (2 ** 8) - 1; // 8 bits 最大长度
const MIN_MATCH_LENGTH = 3;

// 哈希表参数，用于快速字符串匹配
const HASH_SHIFT = 5;
const HASH_MASK = 65535; // 16 bits 哈希空间

function lz77Compress(buffer: Uint8Array): Token[] {
  const tokens: Token[] = [];
  const len = buffer.length;
  let cursor = 0;

  // head 数组：存储某个哈希值最近一次出现的位置
  const head = new Int32Array(HASH_MASK + 1).fill(-1);
  // prev 数组：构建哈希链表，prev[pos] 存储与 buffer[pos] 哈希值相同的前一个位置
  const prev = new Int32Array(len).fill(-1);

  let currentHash = 0;

  // 将当前位置的 3 字节字符串哈希并插入到哈希链表中
  const insertString = (pos: number) => {
    if (pos <= len - MIN_MATCH_LENGTH) {
      currentHash = ((buffer[pos] << (HASH_SHIFT * 2)) ^ (buffer[pos + 1] << HASH_SHIFT) ^ buffer[pos + 2]) & HASH_MASK;
      prev[pos] = head[currentHash];
      head[currentHash] = pos;
    }
  };

  while (cursor < len) {
    // 每次处理当前位置前，先将其插入哈希表
    insertString(cursor);

    let matchHead = prev[cursor];
    const limit = Math.max(0, cursor - WINDOW_SIZE);
    let chainLength = 256; // 限制查找深度，防止最坏情况
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    // 沿着哈希链表向前查找最佳匹配
    while (matchHead >= limit && matchHead >= 0 && matchHead < cursor && chainLength-- > 0) {
      let matchLen = 0;
      const lookahead = Math.min(len - cursor, MAX_MATCH_LENGTH);

      // 先快速比较第一个字符和已知最佳长度的字符，匹配再进行详细比较
      if (buffer[matchHead + bestMatchLen] === buffer[cursor + bestMatchLen]) {
        while (matchLen < lookahead && buffer[matchHead + matchLen] === buffer[cursor + matchLen]) {
          matchLen++;
        }

        if (matchLen > bestMatchLen) {
          bestMatchLen = matchLen;
          bestMatchDist = cursor - matchHead;
          if (bestMatchLen >= MAX_MATCH_LENGTH) break; // 达到最大长度，直接停止查找
        }
      }
      matchHead = prev[matchHead]; // 沿着链表继续找上一个相同哈希的位置
    }

    if (bestMatchLen >= MIN_MATCH_LENGTH) {
      tokens.push({ type: 'match', distance: bestMatchDist, length: bestMatchLen });
      // 匹配部分跳过，但需要将其插入哈希链表以备后续查找
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
export function myLZ771Compress(buffer: Uint8Array): Uint8Array {
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

export function myLZ771Decompress(buffer: Uint8Array): Uint8Array {
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