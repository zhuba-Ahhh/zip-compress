import { Token, MIN_MATCH_LENGTH } from './types';
import { BitWriter } from './io';
import {
  getLengthInfo, getDistanceInfo,
  buildHuffmanTreeDeflate, serializeTreeDeflate,
  HuffmanNodeDynamic, writeHuffmanTreeDynamic
} from './huffman-utils';
import { CompressionLog } from '../../../../types';

/**
 * 编码器 1：简单的 Bitpacking 编码 (对应原 LZ77.ts, LZ77-1.ts, LZ77-2.ts)
 */
export function encodeBitpack(tokens: Token[], logs?: CompressionLog[]): Uint8Array {
  const writer = new BitWriter();
  
  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: `开始编码 ${tokens.length} 个令牌` });

  for (const token of tokens) {
    if (token.type === 'literal') {
      writer.writeBit(0);
      writer.writeBits(token.value, 8);
    } else {
      writer.writeBit(1);
      writer.writeBits(token.distance, 12);
      writer.writeBits(token.length, 8);
    }
  }

  // 写入显式的 EOF (End of File) 标志：使用 match flag(1) 和 distance=0
  writer.writeBit(1);
  writer.writeBits(0, 12);
  writer.writeBits(0, 8);

  const res = writer.flush();
  if (logs) logs.push({ timestamp: performance.now(), phase: '编码完成', message: `编码大小: ${res.length} 字节` });
  return res;
}

/**
 * 编码器 2：动态 Huffman 编码 (对应原 Huffman-1.ts)
 */
export function encodeHuffmanDynamic(tokens: Token[], logs?: CompressionLog[]): Uint8Array {
  if (tokens.length === 0) return new Uint8Array(0);
  
  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: `开始编码 ${tokens.length} 个令牌` });

  // 1. 统计频率
  // 符号映射: 0-255(字面量), 256(EOF), 257-511(匹配长度: 257代表长度3)
  const freqs = new Int32Array(512).fill(0);
  freqs[256] = 1; // EOF

  for (const token of tokens) {
    if (token.type === 'literal') {
      freqs[token.value]++;
    } else {
      freqs[257 + token.length - MIN_MATCH_LENGTH]++;
    }
  }

  // 2. 构建 Huffman 树
  const nodes: HuffmanNodeDynamic[] = [];
  for (let i = 0; i < 512; i++) {
    if (freqs[i] > 0) {
      nodes.push(new HuffmanNodeDynamic(i, freqs[i]));
    }
  }

  while (nodes.length > 1) {
    nodes.sort((a, b) => b.freq - a.freq);
    const right = nodes.pop()!;
    const left = nodes.pop()!;
    const parent = new HuffmanNodeDynamic(null, left.freq + right.freq);
    parent.left = left;
    parent.right = right;
    nodes.push(parent);
  }
  const root = nodes[0];

  const codes: { [key: number]: { code: number, len: number } } = {};
  const buildCodes = (node: HuffmanNodeDynamic | null, code: number, length: number) => {
    if (!node) return;
    if (node.value !== null) {
      codes[node.value] = { code, len: length };
      return;
    }
    buildCodes(node.left, (code << 1) | 0, length + 1);
    buildCodes(node.right, (code << 1) | 1, length + 1);
  };
  buildCodes(root, 0, 0);

  if (logs) {
    const sortedSymbols = Object.entries(codes)
      .map(([sym, huff]) => ({
        symbol: parseInt(sym) < 256 ? String.fromCharCode(parseInt(sym)) : `MATCH_LEN_${parseInt(sym) - 257 + MIN_MATCH_LENGTH}`,
        freq: freqs[parseInt(sym)],
        codeStr: huff.code.toString(2).padStart(huff.len, '0'),
        bitLength: huff.len
      }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 10);
      
    logs.push({ 
      timestamp: performance.now(), 
      phase: 'Huffman建树', 
      message: '动态 Huffman 树构建成功',
      details: { topSymbols: sortedSymbols }
    });
  }

  const writer = new BitWriter();

  // 4. 将 Huffman 树写入流
  writeHuffmanTreeDynamic(root, writer);

  // 5. 写入压缩数据
  for (const token of tokens) {
    if (token.type === 'literal') {
      const huff = codes[token.value];
      writer.writeBits(huff.code, huff.len);
    } else {
      const symbol = 257 + token.length - MIN_MATCH_LENGTH;
      const huff = codes[symbol];
      writer.writeBits(huff.code, huff.len);
      // Distance 依然用 12 bits 固定长度
      writer.writeBits(token.distance, 12);
    }
  }

  // 写入 EOF
  const eofHuff = codes[256];
  writer.writeBits(eofHuff.code, eofHuff.len);

  const res = writer.flush();
  if (logs) logs.push({ timestamp: performance.now(), phase: '编码完成', message: `编码大小: ${res.length} 字节` });
  return res;
}

/**
 * 编码器 3：Deflate 风格的双 Huffman 树编码 (对应原 Huffman.ts, Huffman-2.ts)
 */
export function encodeHuffmanDeflate(tokens: Token[], logs?: CompressionLog[]): Uint8Array {
  const writer = new BitWriter();

  if (logs) logs.push({ timestamp: performance.now(), phase: '初始化', message: `开始编码 ${tokens.length} 个令牌` });

  const llFreq = new Array(286).fill(0);
  const distFreq = new Array(30).fill(0);

  llFreq[256] = 1; // EOF

  for (const token of tokens) {
    if (token.type === 'literal') {
      llFreq[token.value]++;
    } else {
      const lenInfo = getLengthInfo(token.length);
      llFreq[lenInfo.code]++;
      const distInfo = getDistanceInfo(token.distance);
      distFreq[distInfo.code]++;
    }
  }

  const llTree = buildHuffmanTreeDeflate(llFreq);
  const distTree = buildHuffmanTreeDeflate(distFreq);

  if (logs) logs.push({ timestamp: performance.now(), phase: 'Huffman重建', message: '动态 Huffman 树构建成功' });

  serializeTreeDeflate(llTree.root, writer, 9); // Max LL symbol 285 (9 bits)
  serializeTreeDeflate(distTree.root, writer, 5); // Max Dist symbol 29 (5 bits)

  for (const token of tokens) {
    if (token.type === 'literal') {
      const codeInfo = llTree.codes.get(token.value)!;
      writer.writeBits(codeInfo.code, codeInfo.bitLen);
    } else {
      const lenInfo = getLengthInfo(token.length);
      const llCodeInfo = llTree.codes.get(lenInfo.code)!;
      writer.writeBits(llCodeInfo.code, llCodeInfo.bitLen);
      if (lenInfo.extraBits > 0) {
        writer.writeBits(lenInfo.extraVal, lenInfo.extraBits);
      }

      const distInfo = getDistanceInfo(token.distance);
      const distCodeInfo = distTree.codes.get(distInfo.code)!;
      writer.writeBits(distCodeInfo.code, distCodeInfo.bitLen);
      if (distInfo.extraBits > 0) {
        writer.writeBits(distInfo.extraVal, distInfo.extraBits);
      }
    }
  }

  const eofInfo = llTree.codes.get(256)!;
  writer.writeBits(eofInfo.code, eofInfo.bitLen);

  const res = writer.flush();
  if (logs) logs.push({ timestamp: performance.now(), phase: '编码完成', message: `编码大小: ${res.length} 字节` });
  return res;
}
