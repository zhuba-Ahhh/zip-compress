const fs = require('fs');

let matchers = fs.readFileSync('src/utils/algorithm/test/core/lz77-matchers.ts', 'utf8');

// The file was reverted to its clean state, so let's carefully add metrics back without renaming return types for now.
// We can attach the `advancedMetrics` to the LAST LOG in the `logs` array as a details property, or just add a side-channel.
// Actually, modifying return type to an object {tokens, advancedMetrics} caused a lot of type errors in index.ts
// Let's modify lz77Compress functions to accept an `advancedMetrics` object as an optional parameter and mutate it!
// This avoids touching return types entirely!

// In lz77-matchers.ts
matchers = matchers.replace(
    /export function lz77CompressSimple\(buffer: Uint8Array, logs\?: CompressionLog\[\]\): Token\[\] \{/g,
    `export function lz77CompressSimple(buffer: Uint8Array, logs?: CompressionLog[], advancedMetrics?: import('../../../../types').AdvancedMetrics): Token[] {`
);
matchers = matchers.replace(
    /export function lz77CompressHashChain\(buffer: Uint8Array, logs\?: CompressionLog\[\]\): Token\[\] \{/g,
    `export function lz77CompressHashChain(buffer: Uint8Array, logs?: CompressionLog[], advancedMetrics?: import('../../../../types').AdvancedMetrics): Token[] {`
);
matchers = matchers.replace(
    /export function lz77CompressHashChainOptimized\(buffer: Uint8Array, logs\?: CompressionLog\[\]\): Token\[\] \{/g,
    `export function lz77CompressHashChainOptimized(buffer: Uint8Array, logs?: CompressionLog[], advancedMetrics?: import('../../../../types').AdvancedMetrics): Token[] {`
);

// We'll write a single setup block to inject into each function
const setupBlock = `
  let lastSampleTime = performance.now();
  let lastSampleBytes = 0;
  let currentChunkStart = 0;
  let currentChunkCompressedBits = 0;
  const startTime = performance.now();
  const CHUNK_SIZE = 16384;
  const SAMPLE_INTERVAL_MS = 5;
`;

const sampleLogic = `
    const now = performance.now();
    if (advancedMetrics && now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
      const processed = cursor;
      const deltaBytes = processed - lastSampleBytes;
      const deltaMs = now - lastSampleTime;
      advancedMetrics.timeSeries.push({
        timeMs: now - startTime,
        processedBytes: processed,
        instantSpeed: deltaMs > 0 ? (deltaBytes / 1024 / 1024) / (deltaMs / 1000) : 0
      });
      lastSampleTime = now;
      lastSampleBytes = processed;
    }
`;

const blockTrackingLogicMatch = `
      if (advancedMetrics) currentChunkCompressedBits += 24;
`;

const blockTrackingLogicLiteral = `
      if (advancedMetrics) currentChunkCompressedBits += 9;
`;

const chunkFlushLogic = `
    if (advancedMetrics && cursor - currentChunkStart >= CHUNK_SIZE) {
      advancedMetrics.chunks.push({
        offset: currentChunkStart,
        originalSize: cursor - currentChunkStart,
        compressedSize: currentChunkCompressedBits / 8,
        ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)
      });
      currentChunkStart = cursor;
      currentChunkCompressedBits = 0;
    }
`;

const finalChunkFlushLogic = `
  if (advancedMetrics && cursor > currentChunkStart) {
    advancedMetrics.chunks.push({
      offset: currentChunkStart,
      originalSize: cursor - currentChunkStart,
      compressedSize: currentChunkCompressedBits / 8,
      ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)
    });
  }
`;

// Inject into lz77CompressSimple
matchers = matchers.replace(
    /const hashCollisions = 0; \/\/ 仅为统一日志格式，暴力匹配无碰撞/,
    `const hashCollisions = 0; // 仅为统一日志格式，暴力匹配无碰撞\n${setupBlock}`
);
matchers = matchers.replace(
    /while \(cursor < buffer\.length\) \{/,
    `while (cursor < buffer.length) {\n${sampleLogic}`
);
matchers = matchers.replace(
    /if \(bestMatchLen > maxMatchLen\) maxMatchLen = bestMatchLen;/,
    `if (bestMatchLen > maxMatchLen) maxMatchLen = bestMatchLen;\n${blockTrackingLogicMatch}`
);
matchers = matchers.replace(
    /tokens\.push\(\{ type: 'literal', value: buffer\[cursor\] \}\);\n      cursor\+\+;\n      literalCount\+\+;/,
    `tokens.push({ type: 'literal', value: buffer[cursor] });\n      cursor++;\n      literalCount++;\n${blockTrackingLogicLiteral}`
);
matchers = matchers.replace(
    /      literalCount\+\+;\n\s*\}/g,
    `      literalCount++;\n${blockTrackingLogicLiteral}\n    }\n${chunkFlushLogic}`
);

// We need to be very careful, let's use string split/join for precision

fs.writeFileSync('src/utils/algorithm/test/core/lz77-matchers.ts', matchers);

