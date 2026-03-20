// 压缩
// 1. LZ77 编码： 替换重复 byte => Length/Distance 对
// 2. Huffman 编码： 压缩 Length/Distance 对
// 3. 存储： 直接存储未压缩数据

type MatchDLPair = {
  distance: number;
  length: number;
};

enum TokenType {
  Match = 'match',
  Literal = 'literal',
}

type Token = {
  type: TokenType.Match;
  value: MatchDLPair;
} | {
  type: TokenType.Literal;
  value: number; // 未压缩数据的 byte 值
}

// 12 bits 最大表示 4095，且 0 被保留用作 EOF，所以实际最大有效距离是 4095
const WINDOW_SIZE = (2 ** 12) - 1;
const MAX_MATCH_LENGTH = (2 ** 8) - 1; // 8 bits 最大长度
const MIN_MATCH_LENGTH = 3; // 最小匹配长度

export function lz77Compress(data: Uint8Array): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  const dataLength = data.length;

  while (cursor < dataLength) {
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    const windowStart = Math.max(0, cursor - WINDOW_SIZE); // 窗口起始位置
    const lookAhead = Math.min(dataLength - cursor, MAX_MATCH_LENGTH); // 前向查看长度

    // 滑动窗口 查找最佳匹配 时间复杂度 O(n) 空间复杂度 O(1) 每次查找 windowStart -> cursor 之间的匹配
    for (let i = windowStart; i < cursor; i++) {
      let len = 0;
      while (len < lookAhead && data[i + len] === data[cursor + len]) {
        len++;
      }
      if (len > bestMatchLen) {
        bestMatchLen = len;
        bestMatchDist = cursor - i - len;
      }
    }

    // 如果最佳匹配长度大于等于最小匹配长度，就将最佳匹配写入 tokens 中
    // 否则，将当前 byte 写入 tokens 中
    if (bestMatchLen >= MIN_MATCH_LENGTH) {
      tokens.push({ type: TokenType.Match, value: { distance: bestMatchDist, length: bestMatchLen } });
      cursor += bestMatchLen;
    } else {
      tokens.push({ type: TokenType.Literal, value: data[cursor] });
      cursor++;
    }
  }

  return tokens;
}

export function huffmanCompress(_tokens: Token[]): Uint8Array {
  // 实现 Huffman 编码
  return new Uint8Array();
}

/**
 * 位写入器
 * 用于将压缩后的数据写入到 Uint8Array 中
 * 每个 byte 用于存储 8 位数据
 */
export class BitWriter {
  private bytes: number[] = [];
  private currentByte: number = 0;
  private bitPosition: number = 0;

  // 写入一个 bit
  // 如果当前 byte 已满，就将当前 byte 写入 bytes 中
  writeBit(bit: number): void {
    this.currentByte |= (bit << this.bitPosition); // 将 bit 写入当前 byte 的指定位置
    this.bitPosition++;

    if (this.bitPosition === 8) {
      this.bytes.push(this.currentByte);
      this.currentByte = 0;
      this.bitPosition = 0;
    }
  }

  // 从 value 中提取 numBits 位
  // 并将它们写入当前 byte 中
  writeBytes(value: number, numBits: number): void {
    for (let i = 0; i < numBits; i++) {
      // 从 value 中提取第 i 位
      this.writeBit((value >> i) & 1);
    }
  }

  // 写入当前 byte 到 bytes 中 
  // 并返回 Uint8Array
  flush(): Uint8Array {
    if (this.bitPosition > 0) {
      this.currentByte <<= (8 - this.bitPosition); // 填充高 bit 为 0
      this.bytes.push(this.currentByte); // 写入当前 byte 到 bytes 中
      this.bitPosition = 0;
    }

    return new Uint8Array(this.bytes);
  }
}

export class BitReader {
  private bytes: Uint8Array;
  private bytePosition: number = 0;
  private bitPosition: number = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  readBit(): number | null {
    // 读取一个 bit
    // 如果当前 byte 已读取，就将当前 byte 读取到下一个 byte 中
    // 并将 bitPosition 重置为 0
    if (this.bytePosition >= this.bytes.length) {
      return null;
    }
    // 从当前 byte 中提取第 bitPosition 位
    // 并将 bitPosition 增加 1
    // 如果 bitPosition 已增加到 8，就将 bitPosition 重置为 0
    // 并将 bytePosition 增加 1
    const bit = (this.bytes[this.bytePosition] >> (7 - this.bitPosition)) & 1;
    this.bitPosition++;
    if (this.bitPosition === 8) {
      this.bitPosition = 0;
      this.bytePosition++;
    }
    return bit;
  }

  readBits(numBits: number): number | null {
    // 读取 numBits 位
    // 如果当前 byte 已读取，就将当前 byte 读取到下一个 byte 中
    // 并将它们组合成一个 number
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      const bit = this.readBit();
      if (bit === null) {
        return null;
      }
      value |= (bit << i);
    }
    return value;
  }
}
