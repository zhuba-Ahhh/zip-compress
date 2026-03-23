/**
 * 高性能版 压缩算法 (LZ77 + 变长编码 + 惰性匹配优化)
 *
 * 核心优化点：
 * 1. 哈希链表 (Hash Chain)：加速 LZ77 的滑动窗口字符串查找，将时间复杂度从 O(N^2) 降至近乎 O(N)。
 * 2. 惰性匹配 (Lazy Matching)：如果当前位置找到匹配，但下一个位置能找到更长的匹配，则放弃当前匹配（作为普通字符输出），以获得更高的整体压缩率。
 * 3. 动态 Huffman 编码：根据数据特征动态构建最优的字面量 (Literal) 编码树。
 * 4. Elias Gamma 编码：用于高效存储无上界的正整数（如距离、长度、频率等）。
 */

import { PhaseTiming } from '../../../types';

/**
 * 位写入器 (BitWriter)
 * 用于将不规则长度的比特位流写入到连续的字节数组中。
 */
class BitWriter {
  private buffer: Uint8Array;
  private bytePos: number = 0;
  private currentByte: number = 0;
  private bitPos: number = 0;

  constructor(initialCapacity: number = 1024 * 1024) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  // 动态扩容：当缓冲区不足时，容量翻倍
  private ensureCapacity() {
    if (this.bytePos >= this.buffer.length) {
      const newBuffer = new Uint8Array(this.buffer.length * 2);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
    }
  }

  // 写入单个比特位 (0 或 1)
  writeBit(bit: number) {
    this.currentByte = (this.currentByte << 1) | bit;
    this.bitPos++;

    if (this.bitPos === 8) {
      if (this.bytePos >= this.buffer.length) this.ensureCapacity();
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
          if (this.bytePos >= this.buffer.length) this.ensureCapacity();
          this.buffer[this.bytePos++] = this.currentByte;
          this.currentByte = 0;
          this.bitPos = 0;
        }
      } else {
        // 当前字节剩余空间不足，先填满当前字节，剩余的位留到下一次循环写入
        const shift = numBits - spaceLeft;
        const chunk = (value >> shift) & ((1 << spaceLeft) - 1);
        this.currentByte = (this.currentByte << spaceLeft) | chunk;
        if (this.bytePos >= this.buffer.length) this.ensureCapacity();
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
   * 2. 写入 n 个 0
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

  // 将缓冲区中剩余不足 8 位的未对齐比特数据补 0 刷入
  flush(): Uint8Array {
    if (this.bitPos > 0) {
      this.currentByte <<= (8 - this.bitPos);
      if (this.bytePos >= this.buffer.length) this.ensureCapacity();
      this.buffer[this.bytePos++] = this.currentByte;
      this.bitPos = 0;
    }
    return this.buffer.slice(0, this.bytePos);
  }
}

// Huffman 树节点，用于构建动态 Huffman 树
class HuffmanNode {
  value: number | null; // 叶子节点为 0-255 的字节值，内部节点为 null
  freq: number;         // 出现频率
  left: HuffmanNode | null;
  right: HuffmanNode | null;

  constructor(value: number | null, freq: number) {
    this.value = value;
    this.freq = freq;
    this.left = null;
    this.right = null;
  }
}

export function myZipCompress(buffer: Uint8Array, collectLogs: boolean = false): { data: Uint8Array; phases?: PhaseTiming[] } {
  const len = buffer.length;
  if (len === 0) return { data: new Uint8Array(0) };

  const phases: PhaseTiming[] = [];
  const trackPhase = (name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    phases.push({ name, duration: performance.now() - start });
  };

  let writer: BitWriter;
  
  trackPhase("初始化", () => {
    writer = new BitWriter(Math.max(len, 1024));
    // 头部写入原始数据长度，解压时用于确定结束边界
    writer.writeBits(len, 32);
  });

  const tokens: number[] = []; 
  const WINDOW_SIZE = 32768; // 32KB 滑动窗口
  const MAX_MATCH_LENGTH = 258; // 最大匹配长度
  const MIN_MATCH_LENGTH = 3; // 最小匹配长度，小于3的匹配不划算

  const HASH_SHIFT = 5;
  const HASH_MASK = 65535; // 16 bits 哈希空间
  const head = new Int32Array(HASH_MASK + 1).fill(-1);
  const prev = new Int32Array(len).fill(-1);
  const freqs = new Int32Array(256).fill(0);
  
  trackPhase("LZ77匹配(Pass 1)", () => {
    let currentHash = 0;
    const insertString = (pos: number) => {
      if (pos <= len - MIN_MATCH_LENGTH) {
        currentHash = ((buffer[pos] << (HASH_SHIFT * 2)) ^ (buffer[pos + 1] << HASH_SHIFT) ^ buffer[pos + 2]) & HASH_MASK;
        prev[pos] = head[currentHash];
        head[currentHash] = pos;
      }
    };

    if (len >= MIN_MATCH_LENGTH) {
      currentHash = ((buffer[0] << (HASH_SHIFT * 2)) ^ (buffer[0 + 1] << HASH_SHIFT) ^ buffer[0 + 2]) & HASH_MASK;
    }

    let cursor = 0;
    const findMatch = (pos: number) => {
      let matchHead = prev[pos];
      const limit = Math.max(0, pos - WINDOW_SIZE); // 最远追溯到窗口边界
      let chainLength = 256; // 限制查找深度，防止最坏情况 (例如全是相同字符) 导致 O(N^2)
      let bestMatchLen = 0;
      let bestMatchDist = 0;

      while (matchHead >= limit && matchHead >= 0 && matchHead < pos && chainLength-- > 0) {
        let matchLen = 0;
        const lookahead = Math.min(len - pos, MAX_MATCH_LENGTH);

        // 先快速比较第一个和已知最佳匹配长度的字符，匹配再进行详细比较 (一种小优化)
        if (buffer[matchHead + bestMatchLen] === buffer[pos + bestMatchLen]) {
          while (matchLen < lookahead && buffer[matchHead + matchLen] === buffer[pos + matchLen]) {
            matchLen++;
          }

          if (matchLen > bestMatchLen) {
            bestMatchLen = matchLen;
            bestMatchDist = pos - matchHead;
            if (bestMatchLen >= MAX_MATCH_LENGTH) break; // 达到最大长度，直接停止查找
          }
        }
        matchHead = prev[matchHead]; // 沿着链表继续找上一个相同哈希的位置
      }
      return { len: bestMatchLen, dist: bestMatchDist };
    };

    // === 第一遍扫描 (Pass 1)：LZ77 获取 token 序列并统计字面量频率 ===
    while (cursor < len) {
      insertString(cursor);
      const match = findMatch(cursor);

      if (match.len >= MIN_MATCH_LENGTH) {
        let nextMatch = { len: 0, dist: 0 };
        if (cursor + 1 < len) {
          insertString(cursor + 1);
          nextMatch = findMatch(cursor + 1);
        }

        if (nextMatch.len > match.len && nextMatch.len >= MIN_MATCH_LENGTH) {
          tokens.push(buffer[cursor]);
          freqs[buffer[cursor]]++;
          cursor++;
          continue;
        }
      }

      if (match.len >= MIN_MATCH_LENGTH && match.dist > 0 && match.dist <= WINDOW_SIZE) {
        tokens.push(-((match.dist << 12) | match.len)); 
        for (let i = 1; i < match.len; i++) {
          cursor++;
          insertString(cursor);
        }
        cursor++;
      } else {
        tokens.push(buffer[cursor]);
        freqs[buffer[cursor]]++;
        cursor++;
      }
    }
  });

  const huffmanCodes: { [key: number]: { code: number, len: number } } = {};
  
  trackPhase("构建Huffman树", () => {
    // === 构建 Huffman 树用于 Literal 压缩 ===
    const nodes: HuffmanNode[] = [];
    for (let i = 0; i < 256; i++) {
      if (freqs[i] > 0) {
        nodes.push(new HuffmanNode(i, freqs[i]));
      }
    }

    if (nodes.length === 0) {
      nodes.push(new HuffmanNode(0, 1));
    }

    while (nodes.length > 1) {
      nodes.sort((a, b) => b.freq - a.freq);
      const right = nodes.pop()!;
      const left = nodes.pop()!;
      const parent = new HuffmanNode(null, left.freq + right.freq);
      parent.left = left;
      parent.right = right;
      nodes.push(parent);
    }
    const root = nodes[0];

    const buildCodes = (node: HuffmanNode | null, code: number, length: number) => {
      if (!node) return;
      if (node.value !== null) {
        huffmanCodes[node.value] = { code, len: length };
        return;
      }
      buildCodes(node.left, (code << 1) | 0, length + 1);
      buildCodes(node.right, (code << 1) | 1, length + 1);
    };
    buildCodes(root, 0, 0);
  });

  trackPhase("位流编码与输出(Pass 2)", () => {
    // === 序列化 Huffman 树结构到输出流 ===
    for (let i = 0; i < 256; i++) {
      writer!.writeGamma(freqs[i] + 1);
    }

    // === 第二遍扫描 (Pass 2)：将 token 实际写入 bit stream ===
    for (const token of tokens) {
      if (token >= 0) {
        writer!.writeBit(0);
        const huff = huffmanCodes[token];
        writer!.writeBits(huff.code, huff.len);
      } else {
        const val = -token;
        const dist = val >> 12;
        const matchLen = val & 0xFFF;
        writer!.writeBit(1);
        writer!.writeGamma(dist);
        writer!.writeGamma(matchLen - MIN_MATCH_LENGTH + 1);
      }
    }
  });

  return { data: writer!.flush(), phases };
}

/**
 * 位读取器 (BitReader)
 * 用于从字节数组中按位读取数据，支持跨字节边界读取。
 */
class BitReader {
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
}

export function myZipDecompress(buffer: Uint8Array, collectLogs: boolean = false): { data: Uint8Array; phases?: PhaseTiming[] } {
  const reader = new BitReader(buffer);
  
  const phases: PhaseTiming[] = [];
  const trackPhase = (name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    phases.push({ name, duration: performance.now() - start });
  };

  let expectedLength = 0;
  trackPhase("初始化", () => {
    // 1. 读取原始数据的长度
    const len = reader.readBits(32);
    if (len !== null) expectedLength = len;
  });

  if (expectedLength === 0) return { data: new Uint8Array(0) };

  let root: HuffmanNode | null = null;

  trackPhase("重建Huffman树", () => {
    // === 2. 反序列化并重建 Huffman 树 ===
    const freqs = new Int32Array(256);
    const nodes: HuffmanNode[] = [];

    for (let i = 0; i < 256; i++) {
      const freq = reader.readGamma();
      if (freq === null) return;
      freqs[i] = freq - 1; // 减去序列化时加的 1
      if (freqs[i] > 0) {
        nodes.push(new HuffmanNode(i, freqs[i]));
      }
    }

    if (nodes.length === 0) {
      nodes.push(new HuffmanNode(0, 1));
    }

    // 必须和压缩时使用完全相同的建树逻辑
    while (nodes.length > 1) {
      nodes.sort((a, b) => b.freq - a.freq);
      const right = nodes.pop()!;
      const left = nodes.pop()!;
      const parent = new HuffmanNode(null, left.freq + right.freq);
      parent.left = left;
      parent.right = right;
      nodes.push(parent);
    }
    root = nodes[0];
  });

  const output = new Uint8Array(expectedLength);

  trackPhase("位流解码输出", () => {
    let outPos = 0;
    const MIN_MATCH_LENGTH = 3;

    // === 3. 逐步解码数据流 ===
    while (outPos < expectedLength) {
      const flag = reader.readBit();
      if (flag === null) break;

      if (flag === 0) {
        // Decode literal using Huffman tree
        // 根据读取的位 0 或 1 遍历树，直到到达叶子节点
        let curr: HuffmanNode | null = root;
        while (curr && curr.value === null) {
          const bit = reader.readBit();
          if (bit === null) break;
          if (bit === 0) curr = curr.left;
          else curr = curr.right;
        }

        if (!curr || curr.value === null) break;
        output[outPos++] = curr.value;
      } else {
        // Match (匹配)：解码 distance 和 length
        const distance = reader.readGamma();
        if (distance === null) break;

        const lengthOffset = reader.readGamma();
        if (lengthOffset === null) break;

        // 恢复真实的 length
        const length = lengthOffset + MIN_MATCH_LENGTH - 1;

        if (distance === 0) {
          break;
        }

        const startIdx = outPos - distance;

        if (startIdx < 0) {
          break; // 防御性检查：避免越界
        }

        // 拷贝数据。注意这里不能用 slice/set，因为 LZ77 允许源和目标区域重叠（比如重复模式）
        // 所以必须逐字节拷贝
        const copyLen = Math.min(length, expectedLength - outPos);
        for (let i = 0; i < copyLen; i++) {
          output[outPos++] = output[startIdx + i];
        }
      }
    }
  });

  return { data: output, phases };
}
