// ==========================================
// 1. 数据结构：位写入器 (BitWriter)
// ==========================================
/**
 * 允许按“位”(bit)为单位向流中写入数据。
 * 在压缩算法中，很多信息（如哈夫曼编码、长度标记）并不是对齐到完整的字节(byte)的。
 * 该类通过内部缓冲和位运算，将零散的位拼接成完整的字节数组。
 */
export class BitWriter {
  // 存储最终生成的字节数组
  private bytes: number[] = [];
  // 当前正在拼装的字节缓存
  private currentByte: number = 0;
  // 当前正在拼装的字节已写入了多少个 bit (0~7)
  private bitPos: number = 0;

  /**
   * 写入单个 bit
   * @param bit 0 或 1
   */
  writeBit(bit: number) {
    // 将当前字节左移 1 位，并在最低位拼接上新来的 bit
    this.currentByte = (this.currentByte << 1) | bit;
    this.bitPos++;

    // 当凑满 8 个 bit 时，代表一个完整的字节拼装完成
    if (this.bitPos === 8) {
      this.bytes.push(this.currentByte);
      this.currentByte = 0;
      this.bitPos = 0;
    }
  }

  /**
   * 写入多个 bit
   * @param value 需要写入的值（整数）
   * @param numBits 该值占用的有效位长度
   */
  writeBits(value: number, numBits: number) {
    // 从高位到低位依次取出指定的 bit 进行写入
    // 例如 value = 5 (二进制 101)，numBits = 3
    // i 会依次取 2, 1, 0，分别取出 1, 0, 1
    for (let i = numBits - 1; i >= 0; i--) {
      this.writeBit((value >> i) & 1);
    }
  }

  /**
   * 刷新并返回最终结果
   * 如果当前拼装的字节还没有满 8 个 bit，需要将其移位对齐到高位并强制压入数组。
   * @returns 最终的字节数组 (Uint8Array)
   */
  flush(): Uint8Array {
    if (this.bitPos > 0) {
      // 假设当前写入了 3 个 bit (如 101)，还差 5 个位才满一个字节
      // 则需要左移 5 位，变成 10100000 存入
      this.currentByte <<= (8 - this.bitPos);
      this.bytes.push(this.currentByte);
      this.bitPos = 0;
    }
    return new Uint8Array(this.bytes);
  }
}

// ==========================================
// 2. 数据结构：位读取器 (BitReader)
// ==========================================
/**
 * 允许按“位”(bit)为单位从字节流中读取数据。
 * 解压过程与压缩过程对称，需要从紧凑的字节数组中，按照不定长的规则（如 1 bit flag, 12 bits distance 等）依次提取出原始数值。
 */
export class BitReader {
  // 需要被读取的原始字节数组
  private buffer: Uint8Array;
  // 当前读取到了哪一个字节 (索引)
  private bytePos: number = 0;
  // 当前正在读取的字节中，已经读取了多少个 bit (0~7)
  private bitPos: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  /**
   * 读取单个 bit
   * @returns 0 或 1，如果数据已经读完则返回 null
   */
  readBit(): number | null {
    // 如果已经读完所有字节，则返回 null 表示 EOF (End Of File)
    if (this.bytePos >= this.buffer.length) return null;

    // 从当前字节中提取出特定的 bit
    // 例如 byte 为 10100000，bitPos 为 0 时，我们希望提取最左边的 1
    // 7 - 0 = 7，右移 7 位后按位与 1 得到 1
    const bit = (this.buffer[this.bytePos] >> (7 - this.bitPos)) & 1;
    this.bitPos++;

    // 如果当前字节的 8 个 bit 已经全部读完，移动到下一个字节，并重置 bitPos
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  /**
   * 连续读取多个 bit 并组装成一个整数
   * @param numBits 需要读取的位数
   * @returns 组装好的整数，如果中途数据读完则返回 null
   */
  readBits(numBits: number): number | null {
    let value = 0;
    // 循环提取指定数量的 bit，每次提取出来的 bit 作为最低位，之前提取的左移
    // 从而保证先读出的是高位，后读出的是低位
    for (let i = 0; i < numBits; i++) {
      const bit = this.readBit();
      if (bit === null) return null;
      value = (value << 1) | bit;
    }
    return value;
  }
}
