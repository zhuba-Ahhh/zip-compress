const fs = require('fs');

let matchers = fs.readFileSync('src/utils/algorithm/test/core/lz77-matchers.ts', 'utf8');

// I need to add chunkFlushLogic to lz77CompressSimple
matchers = matchers.replace(
    /      if \(advancedMetrics\) currentChunkCompressedBits \+= 9;\n\n    \}\n  \}\n\n  if \(logs\) logs\.push\(\{ /g,
    `      if (advancedMetrics) currentChunkCompressedBits += 9;\n\n    }\n\n    if (advancedMetrics && cursor - currentChunkStart >= CHUNK_SIZE) {\n      advancedMetrics.chunks.push({\n        offset: currentChunkStart,\n        originalSize: cursor - currentChunkStart,\n        compressedSize: currentChunkCompressedBits / 8,\n        ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n      });\n      currentChunkStart = cursor;\n      currentChunkCompressedBits = 0;\n    }\n  }\n\n  if (advancedMetrics && cursor > currentChunkStart) {\n    advancedMetrics.chunks.push({\n      offset: currentChunkStart,\n      originalSize: cursor - currentChunkStart,\n      compressedSize: currentChunkCompressedBits / 8,\n      ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n    });\n  }\n\n  if (logs) logs.push({ `
);

// We must also add the final chunk flush to HashChain and HashChainOptimized
matchers = matchers.replace(
    /    if \(advancedMetrics && cursor - currentChunkStart >= CHUNK_SIZE\) \{\n      advancedMetrics\.chunks\.push\(\{\n        offset: currentChunkStart,\n        originalSize: cursor - currentChunkStart,\n        compressedSize: currentChunkCompressedBits \/ 8,\n        ratio: \(currentChunkCompressedBits \/ 8\) \/ \(cursor - currentChunkStart\)\n      \}\);\n      currentChunkStart = cursor;\n      currentChunkCompressedBits = 0;\n    \}\n\n  \}\n\n  if \(logs\) logs\.push\(\{ /g,
    `    if (advancedMetrics && cursor - currentChunkStart >= CHUNK_SIZE) {\n      advancedMetrics.chunks.push({\n        offset: currentChunkStart,\n        originalSize: cursor - currentChunkStart,\n        compressedSize: currentChunkCompressedBits / 8,\n        ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n      });\n      currentChunkStart = cursor;\n      currentChunkCompressedBits = 0;\n    }\n\n  }\n\n  if (advancedMetrics && cursor > currentChunkStart) {\n    advancedMetrics.chunks.push({\n      offset: currentChunkStart,\n      originalSize: cursor - currentChunkStart,\n      compressedSize: currentChunkCompressedBits / 8,\n      ratio: (currentChunkCompressedBits / 8) / (cursor - currentChunkStart)\n    });\n  }\n\n  if (logs) logs.push({ `
);

// We need to add the same setup block and sample logic to lz77CompressHashChain and lz77CompressHashChainOptimized
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

matchers = matchers.replace(
    /  const head = new Int32Array\(HASH_MASK \+ 1\)\.fill\(-1\);\n  const prev = new Int32Array\(len\)\.fill\(-1\);/g,
    `${setupBlock}\n  const head = new Int32Array(HASH_MASK + 1).fill(-1);\n  const prev = new Int32Array(len).fill(-1);`
);

matchers = matchers.replace(
    /  const head = new Int32Array\(HASH_SIZE_2\)\.fill\(-1\);\n  const prev = new Int32Array\(WINDOW_SIZE \+ 1\)\.fill\(-1\);/g,
    `${setupBlock}\n  const head = new Int32Array(HASH_SIZE_2).fill(-1);\n  const prev = new Int32Array(WINDOW_SIZE + 1).fill(-1);`
);

matchers = matchers.replace(
    /  while \(cursor < len\) \{/g,
    `  while (cursor < len) {\n${sampleLogic}`
);
matchers = matchers.replace(
    /  while \(cursor < buffer\.length\) \{\n    let bestMatchLen = 0;/g,
    `  while (cursor < buffer.length) {\n${sampleLogic}\n    let bestMatchLen = 0;`
);

// There is already a sample logic block in lz77CompressSimple. Let's make sure we don't duplicate.
// We'll clean up the file manually.

fs.writeFileSync('src/utils/algorithm/test/core/lz77-matchers.ts', matchers);

