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

  while (cursor < buffer.length) {
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    const windowStart = Math.max(0, cursor - WINDOW_SIZE);
    const lookahead = Math.min(buffer.length - cursor, MAX_MATCH_LENGTH);

    for (let i = windowStart; i < cursor; i++) {
      let len = 0;
      while (len < lookahead && buffer[i + len] === buffer[cursor + len]) {
        len++;
      }
      if (len > bestMatchLen) {
        bestMatchLen = len;
        bestMatchDist = cursor - i;
      }
    }

    if (bestMatchLen >= MIN_MATCH_LENGTH) {
      tokens.push({ type: 'match', distance: bestMatchDist, length: bestMatchLen });
      cursor += bestMatchLen;
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
export function myLZ77Compress(buffer: Uint8Array): Uint8Array {
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

export function myLZ77Decompress(buffer: Uint8Array): Uint8Array {
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
