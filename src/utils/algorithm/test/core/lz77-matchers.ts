import { Token, WINDOW_SIZE, MAX_MATCH_LENGTH, MIN_MATCH_LENGTH } from './types';
import { CompressionLog } from '../../../../types';

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
 */
export function lz77CompressSimple(buffer: Uint8Array, logs?: CompressionLog[]): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  
  if (logs) logs.push({ timestamp: performance.now(), phase: 'LZ77匹配', message: '开始基础版暴力匹配' });

  let matchCount = 0;
  let literalCount = 0;
  let totalMatchLen = 0;
  let maxMatchLen = 0;

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
      
      if (logs && matchCount < 10) { // 增加日志记录的数量
        // 提取匹配的文本以便在日志中展示
        const matchTextBytes = Array.from(buffer.slice(cursor, cursor + bestMatchLen));
        const matchText = String.fromCharCode(...matchTextBytes).replace(/[^\x20-\x7E]/g, '.'); // 简单地将非可打印字符转为点
        
        logs.push({ 
          timestamp: performance.now(), 
          phase: 'LZ77匹配 (暴力)', 
          message: `找到匹配: 距离=${bestMatchDist}, 长度=${bestMatchLen}`,
          details: {
            cursor,
            matchedString: matchText,
            matchBytes: matchTextBytes,
            distance: bestMatchDist,
            length: bestMatchLen,
            note: matchCount === 9 ? '为避免日志过多，后续匹配将不再详细记录...' : undefined
          }
        });
      }
      
      cursor += bestMatchLen;
      matchCount++;
      totalMatchLen += bestMatchLen;
      if (bestMatchLen > maxMatchLen) maxMatchLen = bestMatchLen;
    } else {
      tokens.push({ type: 'literal', value: buffer[cursor] });
      cursor++;
      literalCount++;
    }
  }

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: 'LZ77完成', 
    message: `匹配完成。找到 ${matchCount} 个匹配和 ${literalCount} 个字面量。`,
    details: {
      totalMatchLen,
      maxMatchLen,
      avgMatchLen: matchCount > 0 ? (totalMatchLen / matchCount).toFixed(2) : 0,
      compressionRatio: `${((matchCount * 2 + literalCount) / buffer.length * 100).toFixed(2)}% (预估 Token 占比)`
    }
  });
  return tokens;
}

/**
 * 优化版1：哈希链表匹配 LZ77
 */
export function lz77CompressHashChain(buffer: Uint8Array, logs?: CompressionLog[]): Token[] {
  const tokens: Token[] = [];
  const len = buffer.length;
  let cursor = 0;
  
  if (logs) logs.push({ timestamp: performance.now(), phase: 'LZ77匹配', message: '开始哈希链表匹配' });

  const head = new Int32Array(HASH_MASK + 1).fill(-1);
  const prev = new Int32Array(len).fill(-1);

  let currentHash = 0;
  let matchCount = 0;
  let literalCount = 0;
  let totalMatchLen = 0;
  let maxMatchLen = 0;

  const insertString = (pos: number) => {
    if (pos <= len - MIN_MATCH_LENGTH) {
      currentHash = ((buffer[pos] << (HASH_SHIFT * 2)) ^ (buffer[pos + 1] << HASH_SHIFT) ^ buffer[pos + 2]) & HASH_MASK;
      prev[pos] = head[currentHash];
      head[currentHash] = pos;
    }
  };

  while (cursor < len) {
    insertString(cursor);

    let matchHead = prev[cursor];
    const limit = Math.max(0, cursor - WINDOW_SIZE);
    let chainLength = 256; 
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    while (matchHead >= limit && matchHead >= 0 && matchHead < cursor && chainLength-- > 0) {
      let matchLen = 0;
      const lookahead = Math.min(len - cursor, MAX_MATCH_LENGTH);

      if (buffer[matchHead + bestMatchLen] === buffer[cursor + bestMatchLen]) {
        while (matchLen < lookahead && buffer[matchHead + matchLen] === buffer[cursor + matchLen]) {
          matchLen++;
        }

        if (matchLen > bestMatchLen) {
          bestMatchLen = matchLen;
          bestMatchDist = cursor - matchHead;
          if (bestMatchLen >= MAX_MATCH_LENGTH) break; 
        }
      }
      matchHead = prev[matchHead]; 
    }

    if (bestMatchLen >= MIN_MATCH_LENGTH) {
      tokens.push({ type: 'match', distance: bestMatchDist, length: bestMatchLen });
      
      if (logs && matchCount < 10) {
        const matchTextBytes = Array.from(buffer.slice(cursor, cursor + bestMatchLen));
        const matchText = String.fromCharCode(...matchTextBytes).replace(/[^\x20-\x7E]/g, '.');
        
        logs.push({ 
          timestamp: performance.now(), 
          phase: 'LZ77匹配 (哈希链表)', 
          message: `找到匹配: 距离=${bestMatchDist}, 长度=${bestMatchLen}`,
          details: {
            cursor,
            matchedString: matchText,
            matchBytes: matchTextBytes,
            distance: bestMatchDist,
            length: bestMatchLen,
            chainLookups: 256 - chainLength,
            note: matchCount === 9 ? '为避免日志过多，后续匹配将不再详细记录...' : undefined
          }
        });
      }
      
      for (let i = 1; i < bestMatchLen; i++) {
        cursor++;
        insertString(cursor);
      }
      cursor++;
      matchCount++;
      totalMatchLen += bestMatchLen;
      if (bestMatchLen > maxMatchLen) maxMatchLen = bestMatchLen;
    } else {
      tokens.push({ type: 'literal', value: buffer[cursor] });
      cursor++;
      literalCount++;
    }
  }

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: 'LZ77完成', 
    message: `匹配完成。找到 ${matchCount} 个匹配和 ${literalCount} 个字面量。`,
    details: {
      totalMatchLen,
      maxMatchLen,
      avgMatchLen: matchCount > 0 ? (totalMatchLen / matchCount).toFixed(2) : 0,
      compressionRatio: `${((matchCount * 2 + literalCount) / buffer.length * 100).toFixed(2)}% (预估 Token 占比)`
    }
  });
  return tokens;
}

/**
 * 优化版2：环形数组哈希链表匹配 LZ77
 */
export function lz77CompressHashChainOptimized(buffer: Uint8Array, logs?: CompressionLog[]): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  if (logs) logs.push({ timestamp: performance.now(), phase: 'LZ77匹配', message: '开始环形数组哈希链表匹配' });

  const head = new Int32Array(HASH_SIZE_2).fill(-1);
  const prev = new Int32Array(WINDOW_SIZE + 1).fill(-1);

  const getHash = (idx: number) => {
    return ((buffer[idx] << (HASH_SHIFT * 2)) ^ (buffer[idx + 1] << HASH_SHIFT) ^ buffer[idx + 2]) & HASH_MASK_2;
  };
  
  let matchCount = 0;
  let literalCount = 0;
  let totalMatchLen = 0;
  let maxMatchLen = 0;

  while (cursor < buffer.length) {
    let bestMatchLen = 0;
    let bestMatchDist = 0;

    const lookahead = Math.min(buffer.length - cursor, MAX_MATCH_LENGTH);

    if (lookahead >= MIN_MATCH_LENGTH) {
      const hash = getHash(cursor);
      let matchIdx = head[hash];

      prev[cursor % (WINDOW_SIZE + 1)] = matchIdx;
      head[hash] = cursor;

      let limit = 256; 
      const windowStart = Math.max(0, cursor - WINDOW_SIZE);

      while (matchIdx >= windowStart && limit > 0) {
        if (buffer[matchIdx + bestMatchLen] === buffer[cursor + bestMatchLen]) {
          let len = 0;
          while (len < lookahead && buffer[matchIdx + len] === buffer[cursor + len]) {
            len++;
          }
          if (len > bestMatchLen) {
            bestMatchLen = len;
            bestMatchDist = cursor - matchIdx;
            if (len === lookahead) break; 
          }
        }
        matchIdx = prev[matchIdx % (WINDOW_SIZE + 1)];
        limit--;
      }
    }

    if (bestMatchLen >= MIN_MATCH_LENGTH) {
      tokens.push({ type: 'match', distance: bestMatchDist, length: bestMatchLen });
      
      if (logs && matchCount < 10) {
        const matchTextBytes = Array.from(buffer.slice(cursor, cursor + bestMatchLen));
        const matchText = String.fromCharCode(...matchTextBytes).replace(/[^\x20-\x7E]/g, '.');
        
        logs.push({ 
          timestamp: performance.now(), 
          phase: 'LZ77匹配 (环形哈希)', 
          message: `找到匹配: 距离=${bestMatchDist}, 长度=${bestMatchLen}`,
          details: {
            cursor,
            matchedString: matchText,
            matchBytes: matchTextBytes,
            distance: bestMatchDist,
            length: bestMatchLen,
            note: matchCount === 9 ? '为避免日志过多，后续匹配将不再详细记录...' : undefined
          }
        });
      }
      
      for (let i = 1; i < bestMatchLen; i++) {
        cursor++;
        if (cursor + MIN_MATCH_LENGTH <= buffer.length) {
          const hash = getHash(cursor);
          prev[cursor % (WINDOW_SIZE + 1)] = head[hash];
          head[hash] = cursor;
        }
      }
      cursor++;
      matchCount++;
      totalMatchLen += bestMatchLen;
      if (bestMatchLen > maxMatchLen) maxMatchLen = bestMatchLen;
    } else {
      tokens.push({ type: 'literal', value: buffer[cursor] });
      cursor++;
      literalCount++;
    }
  }

  if (logs) logs.push({ 
    timestamp: performance.now(), 
    phase: 'LZ77完成', 
    message: `匹配完成。找到 ${matchCount} 个匹配和 ${literalCount} 个字面量。`,
    details: {
      totalMatchLen,
      maxMatchLen,
      avgMatchLen: matchCount > 0 ? (totalMatchLen / matchCount).toFixed(2) : 0,
      compressionRatio: `${((matchCount * 2 + literalCount) / buffer.length * 100).toFixed(2)}% (预估 Token 占比)`
    }
  });
  return tokens;
}
