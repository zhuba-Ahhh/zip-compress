import { Token, WINDOW_SIZE, MAX_MATCH_LENGTH, MIN_MATCH_LENGTH } from './types';

// ==========================================
// 哈希表参数，用于快速字符串匹配
// ==========================================
// HASH_SHIFT 决定了哈希值的分布范围，通常取值在 4~6 之间
const HASH_SHIFT = 5;
// HASH_MASK 用于将哈希值限制在 16 bits 范围内 (0 ~ 65535)
const HASH_MASK = (2 ** 16) - 1; 

// ==========================================
// 优化版2中的参数，使用更小的哈希空间以适应环形数组
// ==========================================
// 15 bits 的哈希空间大小，即 32768
const HASH_BITS_2 = 15;
const HASH_SIZE_2 = 1 << HASH_BITS_2;
const HASH_MASK_2 = HASH_SIZE_2 - 1;

/**
 * 基础版：暴力匹配 LZ77
 * 
 * 原理：
 * 每次处理一个字符时，都在滑动窗口（windowStart 到 cursor）中暴力搜索最长匹配的字符串。
 * 
 * 性能：
 * - 时间复杂度：O(N * WINDOW_SIZE)，在遇到长重复字符串时性能极差。
 * - 空间复杂度：O(1)，不需要额外的数据结构。
 * 
 * @param buffer 需要压缩的原始数据 (Uint8Array)
 * @returns Token 数组，包含 literal（字面量）和 match（匹配的距离和长度）
 */
export function lz77CompressSimple(buffer: Uint8Array): Token[] {
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

/**
 * 优化版1：哈希链表匹配 LZ77
 * 
 * 原理：
 * 引入哈希表（head 数组）和哈希链表（prev 数组）来加速匹配过程。
 * 每次读取 3 个字节计算哈希值，通过哈希值快速定位到最近一次出现相同字符串的位置，
 * 然后沿着 prev 链表向前查找，直到找到最长匹配。
 * 
 * 性能：
 * - 时间复杂度：平均 O(N)，最坏情况由于加入了 `chainLength` 限制，退化为 O(N * 256)。
 * - 空间复杂度：O(N + HASH_SIZE)，需要存储全量数据的 prev 数组。
 * 
 * @param buffer 需要压缩的原始数据
 * @returns Token 数组
 */
export function lz77CompressHashChain(buffer: Uint8Array): Token[] {
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

/**
 * 优化版2：环形数组哈希链表匹配 LZ77
 * 
 * 原理：
 * 进一步优化空间复杂度。由于匹配距离最大只有 WINDOW_SIZE（4095），
 * 因此我们不需要保存整个 buffer 的 prev 链表，只需要一个大小为 WINDOW_SIZE + 1 的环形数组。
 * 
 * 性能：
 * - 时间复杂度：平均 O(N)。加入了 `limit` 限制查找深度，同时加入了快速剪枝（比较最佳长度处的字符）。
 * - 空间复杂度：O(WINDOW_SIZE + HASH_SIZE)，内存占用极小且固定。
 * 
 * @param buffer 需要压缩的原始数据
 * @returns Token 数组
 */
export function lz77CompressHashChainOptimized(buffer: Uint8Array): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  // head 记录特定 hash 值最后一次出现的位置
  const head = new Int32Array(HASH_SIZE_2).fill(-1);
  // prev 记录滑动窗口内，同一个 hash 值上一次出现的位置 (环形数组)
  const prev = new Int32Array(WINDOW_SIZE + 1).fill(-1);

  // 计算 3 字节的哈希值
  const getHash = (idx: number) => {
    return ((buffer[idx] << (HASH_SHIFT * 2)) ^ (buffer[idx + 1] << HASH_SHIFT) ^ buffer[idx + 2]) & HASH_MASK_2;
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
