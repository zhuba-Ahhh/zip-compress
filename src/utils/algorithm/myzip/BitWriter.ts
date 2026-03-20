/**
 * 位写入器 (BitWriter)
 * 用于将不规则长度的比特位流写入到连续的字节数组中。
 * 支持按位写入、按多位写入、Elias Gamma 编码写入，以及直接写入字节数组。
 */
export class BitWriter {
  private buffer: Uint8Array;
  private bytePos: number = 0;
  private currentByte: number = 0;
  private bitPos: number = 0;

  constructor(initialCapacity: number = 1024 * 1024) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  // 动态扩容：当缓冲区不足时，成倍增加容量
  private ensureCapacity(requiredBytes: number = 1) {
    if (this.bytePos + requiredBytes <= this.buffer.length) return;
    let newCap = this.buffer.length * 2;
    while (this.bytePos + requiredBytes > newCap) {
        newCap *= 2;
    }
    const newBuffer = new Uint8Array(newCap);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
  }

  // 写入单个比特位 (0 或 1)
  writeBit(bit: number) {
    this.currentByte = (this.currentByte << 1) | bit;
    this.bitPos++;

    // 当凑满 8 位时，刷入缓冲区
    if (this.bitPos === 8) {
      this.ensureCapacity(1);
      this.buffer[this.bytePos++] = this.currentByte;
      this.currentByte = 0;
      this.bitPos = 0;
    }
  }

  // 一次性写入多个比特位 (最高支持 32 位)
  writeBits(value: number, numBits: number) {
    while (numBits > 0) {
      const spaceLeft = 8 - this.bitPos;
      if (numBits <= spaceLeft) {
        // 当前字节剩余空间足够容纳所有待写入的位
        this.currentByte = (this.currentByte << numBits) | (value & ((1 << numBits) - 1));
        this.bitPos += numBits;
        numBits = 0;
        if (this.bitPos === 8) {
          this.ensureCapacity(1);
          this.buffer[this.bytePos++] = this.currentByte;
          this.currentByte = 0;
          this.bitPos = 0;
        }
      } else {
        // 当前字节剩余空间不足，先填满当前字节，剩余的位留到下一次循环写入
        const shift = numBits - spaceLeft;
        const chunk = (value >> shift) & ((1 << spaceLeft) - 1);
        this.currentByte = (this.currentByte << spaceLeft) | chunk;
        this.ensureCapacity(1);
        this.buffer[this.bytePos++] = this.currentByte;
        this.currentByte = 0;
        this.bitPos = 0;
        numBits -= spaceLeft;
      }
    }
  }

  /**
   * Elias Gamma 编码 (用于正整数 value >= 1)
   * 编码规则：
   * 1. 设 n 为数值的最高有效位的位置 (即 log2(value))
   * 2. 写入 n 个 0 作为前缀
   * 3. 写入 1 个 1 作为分隔符
   * 4. 写入 value 去掉最高位后的 n 个比特
   * 例如：5 (二进制 101)，n=2。编码为：[0, 0] + [1] + [0, 1] = 00101
   */
  writeGamma(value: number) {
    if (value <= 0) return;
    const n = Math.floor(Math.log2(value));
    for (let i = 0; i < n; i++) {
      this.writeBit(0);
    }
    this.writeBit(1);
    this.writeBits(value - (1 << n), n);
  }

  // 字节对齐：将当前未写满的字节补 0 后刷入缓冲区，使后续写入从新的字节开始
  align() {
    if (this.bitPos > 0) {
      this.currentByte <<= (8 - this.bitPos);
      this.ensureCapacity(1);
      this.buffer[this.bytePos++] = this.currentByte;
      this.currentByte = 0;
      this.bitPos = 0;
    }
  }

  // 直接写入字节数组（会自动触发字节对齐）
  writeBytes(bytes: Uint8Array) {
    this.align();
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.bytePos);
    this.bytePos += bytes.length;
  }

  // 结束写入，返回最终的压缩数据
  flush(): Uint8Array {
    this.align();
    return this.buffer.slice(0, this.bytePos);
  }
}
