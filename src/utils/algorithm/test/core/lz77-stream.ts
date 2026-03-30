import { Token, WINDOW_SIZE, MAX_MATCH_LENGTH, MIN_MATCH_LENGTH } from './types';

// ==========================================
// 优化版参数：使用更高效的哈希函数和位运算
// ==========================================
const HASH_BITS = 15;
const HASH_SIZE = 1 << HASH_BITS;

/**
 * LZ77 状态对象，用于流式处理
 */
export class LZ77State {
  head: Int32Array;
  prev: Int32Array;
  buffer: Uint8Array;
  cursor: number = 0;
  
  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.head = new Int32Array(HASH_SIZE).fill(-1);
    // 注意：WINDOW_SIZE 通常是 2^12 - 1 = 4095
    // 为了用 & 代替 %，我们要确保数组大小是 2 的幂。
    // 我们将其扩展为 2^12 = 4096 = WINDOW_SIZE + 1。
    // WINDOW_MASK 就等于 WINDOW_SIZE (因为 4096 - 1 = 4095)
    this.prev = new Int32Array(WINDOW_SIZE + 1).fill(-1);
  }

  getHash(idx: number): number {
    // 使用带乘法的哈希，减少碰撞
    const val = (this.buffer[idx] << 16) | (this.buffer[idx + 1] << 8) | this.buffer[idx + 2];
    return Math.imul(val, 0x1E35A7BD) >>> (32 - HASH_BITS);
  }

  findMatch(pos: number, maxChain: number = 128): { len: number, dist: number } {
    const lookahead = Math.min(this.buffer.length - pos, MAX_MATCH_LENGTH);
    if (lookahead < MIN_MATCH_LENGTH) return { len: 0, dist: 0 };

    const hash = this.getHash(pos);
    let matchIdx = this.head[hash];
    
    // 使用位运算替代取模：pos & WINDOW_SIZE (假设 WINDOW_SIZE 是 2^n - 1)
    this.prev[pos & WINDOW_SIZE] = matchIdx;
    this.head[hash] = pos;

    let bestLen = 0;
    let bestDist = 0;
    const windowStart = Math.max(0, pos - WINDOW_SIZE);
    let chainLen = maxChain;

    while (matchIdx >= windowStart && chainLen-- > 0) {
      // 快速检查末尾字符，加速匹配
      if (this.buffer[matchIdx + bestLen] === this.buffer[pos + bestLen]) {
        let len = 0;
        while (len < lookahead && this.buffer[matchIdx + len] === this.buffer[pos + len]) {
          len++;
        }
        if (len > bestLen) {
          bestLen = len;
          bestDist = pos - matchIdx;
          if (len === lookahead) break;
        }
      }
      matchIdx = this.prev[matchIdx & WINDOW_SIZE];
    }
    return { len: bestLen, dist: bestDist };
  }

  // 仅仅插入哈希，不执行匹配（用于跳过匹配到的字符串）
  skip(pos: number) {
    if (pos + MIN_MATCH_LENGTH <= this.buffer.length) {
      const hash = this.getHash(pos);
      this.prev[pos & WINDOW_SIZE] = this.head[hash];
      this.head[hash] = pos;
    }
  }
}

/**
 * 压缩一个数据块，支持惰性匹配优化
 */
export function compressBlock(state: LZ77State, blockSize: number): Token[] {
  const tokens: Token[] = [];
  const end = Math.min(state.cursor + blockSize, state.buffer.length);
  
  while (state.cursor < end) {
    const match1 = state.findMatch(state.cursor);
    
    if (match1.len >= MIN_MATCH_LENGTH) {
      // 惰性匹配优化：如果当前位置找到匹配，往前看一步看是否有更长的匹配
      let match2 = { len: 0, dist: 0 };
      if (state.cursor + 1 < end) {
        // 先临时保存状态
        match2 = state.findMatch(state.cursor + 1);
      }

      // 如果下一步的匹配比当前长且有意义，则放弃当前匹配，输出一个字面量
      if (match2.len > match1.len && match2.len >= MIN_MATCH_LENGTH) {
        tokens.push({ type: 'literal', value: state.buffer[state.cursor] });
        state.cursor++;
        
        // 采用第二个匹配
        tokens.push({ type: 'match', distance: match2.dist, length: match2.len });
        for (let i = 1; i < match2.len; i++) {
          state.cursor++;
          state.skip(state.cursor);
        }
        state.cursor++;
      } else {
        // 采用当前匹配
        tokens.push({ type: 'match', distance: match1.dist, length: match1.len });
        for (let i = 1; i < match1.len; i++) {
          state.cursor++;
          state.skip(state.cursor);
        }
        state.cursor++;
      }
    } else {
      tokens.push({ type: 'literal', value: state.buffer[state.cursor] });
      state.cursor++;
    }
  }
  return tokens;
}

