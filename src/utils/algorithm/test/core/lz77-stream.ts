import { Token, WINDOW_SIZE, MAX_MATCH_LENGTH, MIN_MATCH_LENGTH } from './types';

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
    this.head = new Int32Array(32768).fill(-1);
    this.prev = new Int32Array(WINDOW_SIZE + 1).fill(-1);
  }

  getHash(idx: number): number {
    return ((this.buffer[idx] << 10) ^ (this.buffer[idx + 1] << 5) ^ this.buffer[idx + 2]) & 32767;
  }

  findMatch(pos: number, maxChain: number = 128): { len: number, dist: number } {
    const lookahead = Math.min(this.buffer.length - pos, MAX_MATCH_LENGTH);
    if (lookahead < MIN_MATCH_LENGTH) return { len: 0, dist: 0 };

    const hash = this.getHash(pos);
    let matchIdx = this.head[hash];
    this.prev[pos % (WINDOW_SIZE + 1)] = matchIdx;
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
      matchIdx = this.prev[matchIdx % (WINDOW_SIZE + 1)];
    }
    return { len: bestLen, dist: bestDist };
  }

  // 仅仅插入哈希，不执行匹配（用于跳过匹配到的字符串）
  skip(pos: number) {
    if (pos + MIN_MATCH_LENGTH <= this.buffer.length) {
      const hash = this.getHash(pos);
      this.prev[pos % (WINDOW_SIZE + 1)] = this.head[hash];
      this.head[hash] = pos;
    }
  }
}

/**
 * 压缩一个数据块
 */
export function compressBlock(state: LZ77State, blockSize: number): Token[] {
  const tokens: Token[] = [];
  const end = Math.min(state.cursor + blockSize, state.buffer.length);
  
  while (state.cursor < end) {
    const { len, dist } = state.findMatch(state.cursor);
    
    if (len >= MIN_MATCH_LENGTH) {
      tokens.push({ type: 'match', distance: dist, length: len });
      for (let i = 1; i < len; i++) {
        state.cursor++;
        state.skip(state.cursor);
      }
      state.cursor++;
    } else {
      tokens.push({ type: 'literal', value: state.buffer[state.cursor] });
      state.cursor++;
    }
  }
  return tokens;
}
