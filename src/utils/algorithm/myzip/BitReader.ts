/**
 * 位读取器 (BitReader)
 * 用于从字节数组中按位、按多位或按 Elias Gamma 编码读取数据。
 * 支持跨字节边界读取，并提供字节对齐功能。
 */
export class BitReader {
  private buffer: Uint8Array;
  private bytePos: number = 0;
  private bitPos: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  // 读取单个比特位
  readBit(): number | null {
    if (this.bytePos >= this.buffer.length) return null;
    // 取当前字节的最高有效位 (从左到右读)
    const bit = (this.buffer[this.bytePos] >> (7 - this.bitPos)) & 1;
    this.bitPos++;
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  // 一次性读取多个比特位
  readBits(numBits: number): number | null {
    let value = 0;
    while (numBits > 0) {
      if (this.bytePos >= this.buffer.length) return null;
      
      const bitsAvailable = 8 - this.bitPos;
      if (numBits <= bitsAvailable) {
        // 当前字节剩余的位足够提供请求的位数
        const shift = bitsAvailable - numBits;
        const mask = (1 << numBits) - 1;
        const chunk = (this.buffer[this.bytePos] >> shift) & mask;
        value = (value << numBits) | chunk;
        this.bitPos += numBits;
        if (this.bitPos === 8) {
          this.bitPos = 0;
          this.bytePos++;
        }
        numBits = 0;
      } else {
        // 当前字节剩余的位不够，先全部取完，剩下的从下一个字节取
        const mask = (1 << bitsAvailable) - 1;
        const chunk = this.buffer[this.bytePos] & mask;
        value = (value << bitsAvailable) | chunk;
        numBits -= bitsAvailable;
        this.bitPos = 0;
        this.bytePos++;
      }
    }
    return value;
  }

  // 解码 Elias Gamma 编码
  readGamma(): number | null {
    let n = 0;
    // 1. 统计前导 0 的个数，直到遇到 1
    while (true) {
      const bit = this.readBit();
      if (bit === null) return null;
      if (bit === 1) break;
      n++;
    }
    if (n === 0) return 1;
    // 2. 读取后面的 n 位，并加上隐式的最高位 (1 << n)
    const remainder = this.readBits(n);
    if (remainder === null) return null;
    return (1 << n) + remainder;
  }

  // 字节对齐：如果当前不在字节的起始位置，则跳过当前字节的剩余位
  align() {
    if (this.bitPos > 0) {
      this.bitPos = 0;
      this.bytePos++;
    }
  }

  // 直接读取指定长度的字节数组（会自动触发字节对齐）
  readBytes(length: number): Uint8Array | null {
    this.align();
    if (this.bytePos + length > this.buffer.length) return null;
    const res = this.buffer.slice(this.bytePos, this.bytePos + length);
    this.bytePos += length;
    return res;
  }
}
