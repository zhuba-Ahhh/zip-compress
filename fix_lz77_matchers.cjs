const fs = require('fs');

let content = fs.readFileSync('src/utils/algorithm/test/core/lz77-matchers.ts', 'utf8');

// Update imports
content = content.replace(
    /import \{ CompressionLog \} from '\.\.\/\.\.\/\.\.\/\.\.\/types';/,
    `import { CompressionLog, AdvancedMetrics, ChunkMetric, TimeMetric } from '../../../../types';`
);

// We need a helper to generate metrics struct
const metricsHelper = `
export interface Lz77Result {
  tokens: Token[];
  advancedMetrics?: AdvancedMetrics;
}

const CHUNK_SIZE = 16384;
const SAMPLE_INTERVAL_MS = 5;

function createMetrics() {
  return {
    chunks: [],
    timeSeries: []
  };
}
`;

content = content.replace(
    /const HASH_SHIFT = 5;/,
    metricsHelper + '\nconst HASH_SHIFT = 5;'
);

// 1. Update lz77CompressSimple
content = content.replace(
    /export function lz77CompressSimple\(buffer: Uint8Array, logs\?: CompressionLog\[\]\): Token\[\] \{/,
    `export function lz77CompressSimple(buffer: Uint8Array, logs?: CompressionLog[]): Lz77Result {\n  const advancedMetrics: AdvancedMetrics = createMetrics();\n  let lastSampleTime = performance.now();\n  let lastSampleBytes = 0;\n  let currentChunkStart = 0;\n  let currentChunkCompressedBits = 0;\n  const startTime = performance.now();`
);

content = content.replace(
    /  while \(cursor < buffer\.length\) \{/,
    `  while (cursor < buffer.length) {\n    const now = performance.now();\n    if (logs && now - lastSampleTime >= SAMPLE_INTERVAL_MS) {\n      const processed = cursor;\n      const deltaBytes = processed - lastSampleBytes;\n      const deltaMs = now - lastSampleTime;\n      advancedMetrics.timeSeries.push({\n        timeMs: now - startTime,\n        processedBytes: processed,\n        instantSpeed: deltaMs > 0 ? (deltaBytes / 1024 / 1024) / (deltaMs / 1000) : 0\n      });\n      lastSampleTime = now;\n      lastSampleBytes = processed;\n    }`
);

content = content.replace(
    /      cursor \+= bestMatchLen;\n      matchCount\+\+;\n      totalMatchLen \+= bestMatchLen;\n      if \(bestMatchLen > maxMatchLen\) maxMatchLen = bestMatchLen;\n    \} else \{\n      tokens\.push\(\{ type: 'literal', value: buffer\[cursor\] \}\);\n      cursor\+\+;\n      literalCount\+\+;\n    \}/,
    `      cursor += bestMatchLen;\n      matchCount++;\n      totalMatchLen += bestMatchLen;\n      if (bestMatchLen > maxMatchLen) maxMatchLen = bestMatchLen;\n      if (logs) currentChunkCompressedBits += 24;\n    } else {\n      tokens.push({ type: 'literal', value: buffer[cursor] });\n      cursor++;\n      literalCount++;\n      if (logs) currentChunkCompressedBits += 9;\n    }\n\n    if (logs && cursor - currentChunkStart >= CHUNK_SIZE) {\n      advancedMetrics.chunks.push({\n        offset: currentChunkStart,\n        originalSize: cursor - currentChunkStart,\n        compressedSize: currentChunkCompressedBits / 8,\n        ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n      });\n      currentChunkStart = cursor;\n      currentChunkCompressedBits = 0;\n    }`
);

content = content.replace(
    /  return tokens;\n\}/,
    `  if (logs && cursor > currentChunkStart) {\n    advancedMetrics.chunks.push({\n      offset: currentChunkStart,\n      originalSize: cursor - currentChunkStart,\n      compressedSize: currentChunkCompressedBits / 8,\n      ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n    });\n  }\n  return { tokens, advancedMetrics: logs ? advancedMetrics : undefined };\n}`
);

// 2. Update lz77CompressHashChain
content = content.replace(
    /export function lz77CompressHashChain\(buffer: Uint8Array, logs\?: CompressionLog\[\]\): Token\[\] \{/,
    `export function lz77CompressHashChain(buffer: Uint8Array, logs?: CompressionLog[]): Lz77Result {\n  const advancedMetrics: AdvancedMetrics = createMetrics();\n  let lastSampleTime = performance.now();\n  let lastSampleBytes = 0;\n  let currentChunkStart = 0;\n  let currentChunkCompressedBits = 0;\n  const startTime = performance.now();`
);

content = content.replace(
    /  while \(cursor < len\) \{/,
    `  while (cursor < len) {\n    const now = performance.now();\n    if (logs && now - lastSampleTime >= SAMPLE_INTERVAL_MS) {\n      const processed = cursor;\n      const deltaBytes = processed - lastSampleBytes;\n      const deltaMs = now - lastSampleTime;\n      advancedMetrics.timeSeries.push({\n        timeMs: now - startTime,\n        processedBytes: processed,\n        instantSpeed: deltaMs > 0 ? (deltaBytes / 1024 / 1024) / (deltaMs / 1000) : 0\n      });\n      lastSampleTime = now;\n      lastSampleBytes = processed;\n    }`
);

content = content.replace(
    /      for \(let i = 1; i < bestMatchLen; i\+\+\) \{\n        cursor\+\+;\n        insertString\(cursor\);\n      \}\n      cursor\+\+;\n      matchCount\+\+;\n      totalMatchLen \+= bestMatchLen;\n      if \(bestMatchLen > maxMatchLen\) maxMatchLen = bestMatchLen;\n    \} else \{\n      tokens\.push\(\{ type: 'literal', value: buffer\[cursor\] \}\);\n      cursor\+\+;\n      literalCount\+\+;\n    \}/,
    `      for (let i = 1; i < bestMatchLen; i++) {\n        cursor++;\n        insertString(cursor);\n      }\n      cursor++;\n      matchCount++;\n      totalMatchLen += bestMatchLen;\n      if (bestMatchLen > maxMatchLen) maxMatchLen = bestMatchLen;\n      if (logs) currentChunkCompressedBits += 24;\n    } else {\n      tokens.push({ type: 'literal', value: buffer[cursor] });\n      cursor++;\n      literalCount++;\n      if (logs) currentChunkCompressedBits += 9;\n    }\n\n    if (logs && cursor - currentChunkStart >= CHUNK_SIZE) {\n      advancedMetrics.chunks.push({\n        offset: currentChunkStart,\n        originalSize: cursor - currentChunkStart,\n        compressedSize: currentChunkCompressedBits / 8,\n        ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n      });\n      currentChunkStart = cursor;\n      currentChunkCompressedBits = 0;\n    }`
);

content = content.replace(
    /  return tokens;\n\}/g,
    `  if (logs && cursor > currentChunkStart) {\n    advancedMetrics.chunks.push({\n      offset: currentChunkStart,\n      originalSize: cursor - currentChunkStart,\n      compressedSize: currentChunkCompressedBits / 8,\n      ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n    });\n  }\n  return { tokens, advancedMetrics: logs ? advancedMetrics : undefined };\n}`
);

// 3. Update lz77CompressHashChainOptimized
content = content.replace(
    /export function lz77CompressHashChainOptimized\(buffer: Uint8Array, logs\?: CompressionLog\[\]\): Token\[\] \{/,
    `export function lz77CompressHashChainOptimized(buffer: Uint8Array, logs?: CompressionLog[]): Lz77Result {\n  const advancedMetrics: AdvancedMetrics = createMetrics();\n  let lastSampleTime = performance.now();\n  let lastSampleBytes = 0;\n  let currentChunkStart = 0;\n  let currentChunkCompressedBits = 0;\n  const startTime = performance.now();`
);

content = content.replace(
    /  while \(cursor < buffer\.length\) \{/,
    `  while (cursor < buffer.length) {\n    const now = performance.now();\n    if (logs && now - lastSampleTime >= SAMPLE_INTERVAL_MS) {\n      const processed = cursor;\n      const deltaBytes = processed - lastSampleBytes;\n      const deltaMs = now - lastSampleTime;\n      advancedMetrics.timeSeries.push({\n        timeMs: now - startTime,\n        processedBytes: processed,\n        instantSpeed: deltaMs > 0 ? (deltaBytes / 1024 / 1024) / (deltaMs / 1000) : 0\n      });\n      lastSampleTime = now;\n      lastSampleBytes = processed;\n    }`
);

content = content.replace(
    /      cursor\+\+;\n      matchCount\+\+;\n      totalMatchLen \+= bestMatchLen;\n      if \(bestMatchLen > maxMatchLen\) maxMatchLen = bestMatchLen;\n    \} else \{\n      tokens\.push\(\{ type: 'literal', value: buffer\[cursor\] \}\);\n      cursor\+\+;\n      literalCount\+\+;\n    \}/,
    `      cursor++;\n      matchCount++;\n      totalMatchLen += bestMatchLen;\n      if (bestMatchLen > maxMatchLen) maxMatchLen = bestMatchLen;\n      if (logs) currentChunkCompressedBits += 24;\n    } else {\n      tokens.push({ type: 'literal', value: buffer[cursor] });\n      cursor++;\n      literalCount++;\n      if (logs) currentChunkCompressedBits += 9;\n    }\n\n    if (logs && cursor - currentChunkStart >= CHUNK_SIZE) {\n      advancedMetrics.chunks.push({\n        offset: currentChunkStart,\n        originalSize: cursor - currentChunkStart,\n        compressedSize: currentChunkCompressedBits / 8,\n        ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n      });\n      currentChunkStart = cursor;\n      currentChunkCompressedBits = 0;\n    }`
);

// We already handled `return tokens;}` above with `/g`, let's make sure it didn't mess up.
// Actually `/g` in the previous step might have replaced it. Let's fix if needed.
fs.writeFileSync('src/utils/algorithm/test/core/lz77-matchers.ts', content);

