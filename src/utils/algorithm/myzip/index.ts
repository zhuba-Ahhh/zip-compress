import { BitWriter } from './BitWriter';
import { BitReader } from './BitReader';
import { HuffmanNode } from './Huffman';

/**
 * myZipCompress - 高性能版压缩算法 (LZ77 + 变长编码 + 惰性匹配优化)
 *
 * 核心优化点：
 * 1. 哈希链表 (Hash Chain)：加速 LZ77 的滑动窗口字符串查找。
 * 2. 惰性匹配 (Lazy Matching)：如果当前位置找到匹配，但下一个位置能找到更长的匹配，则放弃当前匹配（作为普通字符输出），以获得更高的整体压缩率。
 * 3. 动态 Huffman 编码：根据数据特征动态构建最优的字面量 (Literal) 编码树。
 * 4. Elias Gamma 编码：用于高效存储无上界的正整数（如距离、长度、频率等）。
 * 5. 不可压缩回退：如果压缩后的数据反而变大，则直接存储原始数据。
 */
export function myZipCompress(buffer: Uint8Array): Uint8Array {
  const len = buffer.length;
  if (len === 0) return new Uint8Array(0);

  const writer = new BitWriter(Math.max(len + 16, 1024));
  // 头部写入原始数据长度，解压时用于确定结束边界
  writer.writeBits(len, 32);

  // tokens 数组存储第一遍扫描的中间结果。
  // value format: 如果 >= 0, 表示字面量 (literal byte). 如果 < 0, 表示匹配 (match)
  // 匹配的编码格式：-(dist << 12 | length)，利用负数区分字面量
  const tokens: number[] = [];

  const WINDOW_SIZE = 32768; // 32KB 滑动窗口
  const MAX_MATCH_LENGTH = 258; // 最大匹配长度
  const MIN_MATCH_LENGTH = 3; // 最小匹配长度，小于3的匹配不划算

  // 哈希表参数，用于快速字符串匹配
  const HASH_SHIFT = 5;
  const HASH_MASK = 65535; // 16 bits 哈希空间

  // head 数组：存储某个哈希值最近一次出现的位置
  const head = new Int32Array(HASH_MASK + 1).fill(-1);
  // prev 数组：构建哈希链表，prev[pos] 存储与 buffer[pos] 哈希值相同的前一个位置
  const prev = new Int32Array(len).fill(-1);

  let currentHash = 0;

  // 将当前位置的 3 字节字符串哈希并插入到哈希链表中
  const insertString = (pos: number) => {
    if (pos <= len - MIN_MATCH_LENGTH) {
      // 计算哈希值：结合连续三个字节
      currentHash = ((buffer[pos] << (HASH_SHIFT * 2)) ^ (buffer[pos + 1] << HASH_SHIFT) ^ buffer[pos + 2]) & HASH_MASK;
      prev[pos] = head[currentHash];
      head[currentHash] = pos;
    }
  };

  if (len >= MIN_MATCH_LENGTH) {
    currentHash = ((buffer[0] << (HASH_SHIFT * 2)) ^ (buffer[0 + 1] << HASH_SHIFT) ^ buffer[0 + 2]) & HASH_MASK;
  }

  let cursor = 0;

  // 沿着哈希链表向前查找最佳匹配
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

  const freqs = new Int32Array(256).fill(0);

  // === 第一遍扫描 (Pass 1)：LZ77 获取 token 序列并统计字面量频率 ===
  while (cursor < len) {
    insertString(cursor);
    const match = findMatch(cursor);

    // Lazy Matching (惰性匹配) 策略：
    // 当找到一个匹配时，不立刻采用。而是看看下一个位置是否能找到更长的匹配。
    // 如果下一个位置的匹配更长，我们就放弃当前匹配，把当前字符作为 Literal 输出。
    if (match.len >= MIN_MATCH_LENGTH) {
      let nextMatch = { len: 0, dist: 0 };
      if (cursor + 1 < len) {
        insertString(cursor + 1);
        nextMatch = findMatch(cursor + 1);
      }

      if (nextMatch.len > match.len && nextMatch.len >= MIN_MATCH_LENGTH) {
        // 放弃当前匹配，输出当前字面量
        tokens.push(buffer[cursor]);
        freqs[buffer[cursor]]++;
        cursor++;
        continue;
      }
    }

    if (match.len >= MIN_MATCH_LENGTH && match.dist > 0 && match.dist <= WINDOW_SIZE) {
      // 记录匹配 (使用负数区分，12 bits 存 length，因为最大258)
      tokens.push(-((match.dist << 12) | match.len));
      // 匹配部分跳过，但需要将其插入哈希链表以备后续查找
      for (let i = 1; i < match.len; i++) {
        cursor++;
        insertString(cursor);
      }
      cursor++;
    } else {
      // 记录字面量
      tokens.push(buffer[cursor]);
      freqs[buffer[cursor]]++;
      cursor++;
    }
  }

  // === 构建 Huffman 树用于 Literal 压缩 ===
  const nodes: HuffmanNode[] = [];
  for (let i = 0; i < 256; i++) {
    if (freqs[i] > 0) {
      nodes.push(new HuffmanNode(i, freqs[i]));
    }
  }

  if (nodes.length === 0) {
    // 边界情况：全是匹配，没有字面量。补充一个节点避免空树逻辑错误
    nodes.push(new HuffmanNode(0, 1));
  }

  // 优先队列 (此处用 sort 模拟) 合并节点构建树
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

  const huffmanCodes: { [key: number]: { code: number, len: number } } = {};

  // 遍历 Huffman 树生成编码表
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

  // === 估算压缩后的位长度 ===
  const gammaLength = (value: number) => {
    if (value <= 0) return 0;
    return 2 * Math.floor(Math.log2(value)) + 1;
  };

  let expectedBits = 0;
  for (let i = 0; i < 256; i++) {
    expectedBits += gammaLength(freqs[i] + 1);
  }

  for (const token of tokens) {
    expectedBits += 1; // 标志位
    if (token >= 0) {
      expectedBits += huffmanCodes[token].len;
    } else {
      const val = -token;
      const dist = val >> 12;
      const matchLen = val & 0xFFF;
      expectedBits += gammaLength(dist);
      expectedBits += gammaLength(matchLen - MIN_MATCH_LENGTH + 1);
    }
  }

  // 检查压缩是否真的节省了空间
  if (expectedBits >= len * 8) {
    // 压缩率不佳，直接存储未压缩的原始数据 (不可压缩回退)
    writer.writeBit(0); // isCompressed = false
    writer.writeBytes(buffer);
    return writer.flush();
  }

  writer.writeBit(1); // isCompressed = true

  // === 序列化 Huffman 树结构到输出流 ===
  // 将 0-255 每个字节的频率使用 Elias Gamma 编码写入。
  // 解压端读取这些频率就可以重建完全一样的 Huffman 树。
  for (let i = 0; i < 256; i++) {
    writer.writeGamma(freqs[i] + 1); // +1 因为 Elias gamma 不能编码 0
  }

  // === 第二遍扫描 (Pass 2)：将 token 实际写入 bit stream ===
  for (const token of tokens) {
    if (token >= 0) {
      // Literal：标志位 0 + 动态 Huffman 编码
      writer.writeBit(0);
      const huff = huffmanCodes[token];
      writer.writeBits(huff.code, huff.len);
    } else {
      // Match：标志位 1 + Elias Gamma 编码的 Distance 和 Length
      const val = -token;
      const dist = val >> 12;
      const matchLen = val & 0xFFF;
      writer.writeBit(1);
      writer.writeGamma(dist);
      // 减去 MIN_MATCH_LENGTH 以减小数值，进一步压缩
      writer.writeGamma(matchLen - MIN_MATCH_LENGTH + 1);
    }
  }

  return writer.flush();
}

/**
 * myZipDecompress - 解压算法
 */
export function myZipDecompress(buffer: Uint8Array): Uint8Array {
  const reader = new BitReader(buffer);

  // 1. 读取原始数据的长度
  const expectedLength = reader.readBits(32);
  if (expectedLength === null) return new Uint8Array(0);
  if (expectedLength === 0) return new Uint8Array(0);

  // 2. 检查是否进行了压缩
  const isCompressed = reader.readBit();
  if (isCompressed === null) return new Uint8Array(0);

  if (isCompressed === 0) {
    // 直接读取原始数据
    const raw = reader.readBytes(expectedLength);
    return raw || new Uint8Array(0);
  }

  // === 3. 反序列化并重建 Huffman 树 ===
  const freqs = new Int32Array(256);
  const nodes: HuffmanNode[] = [];

  for (let i = 0; i < 256; i++) {
    const freq = reader.readGamma();
    if (freq === null) return new Uint8Array(0);
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
  const root = nodes[0];

  const output = new Uint8Array(expectedLength);
  let outPos = 0;

  const MIN_MATCH_LENGTH = 3;

  // === 4. 逐步解码数据流 ===
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
  return output;
}
