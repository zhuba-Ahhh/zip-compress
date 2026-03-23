const fs = require('fs');

let indexTs = fs.readFileSync('src/utils/algorithm/test/index.ts', 'utf8');

// The `test/index.ts` functions currently look like this:
// const tokens = runWithPhases("LZ77匹配(Pass 1)", () => lz77CompressSimple(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);
// We need to pass `advancedMetrics` to them.

// First, inject `const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;`
const metricsInit = `  const advancedMetrics = collectLogs ? { chunks: [], timeSeries: [] } : undefined;`;

indexTs = indexTs.replace(
    /const phases: PhaseTiming\[\] = \[\];/g,
    `const phases: PhaseTiming[] = [];\n${metricsInit}`
);

// We should only pass `advancedMetrics` to compression functions.
// Let's modify the lz77 calls:
indexTs = indexTs.replace(
    /lz77CompressSimple\(buffer, collectLogs \? logs : undefined\)/,
    `lz77CompressSimple(buffer, collectLogs ? logs : undefined, advancedMetrics)`
);
indexTs = indexTs.replace(
    /lz77CompressHashChain\(buffer, collectLogs \? logs : undefined\)/,
    `lz77CompressHashChain(buffer, collectLogs ? logs : undefined, advancedMetrics)`
);
indexTs = indexTs.replace(
    /lz77CompressHashChainOptimized\(buffer, collectLogs \? logs : undefined\)/,
    `lz77CompressHashChainOptimized(buffer, collectLogs ? logs : undefined, advancedMetrics)`
);
// Replace other instances as well
indexTs = indexTs.replace(
    /lz77CompressSimple\(buffer, collectLogs \? logs : undefined\)/g,
    `lz77CompressSimple(buffer, collectLogs ? logs : undefined, advancedMetrics)`
);
indexTs = indexTs.replace(
    /lz77CompressHashChain\(buffer, collectLogs \? logs : undefined\)/g,
    `lz77CompressHashChain(buffer, collectLogs ? logs : undefined, advancedMetrics)`
);
indexTs = indexTs.replace(
    /lz77CompressHashChainOptimized\(buffer, collectLogs \? logs : undefined\)/g,
    `lz77CompressHashChainOptimized(buffer, collectLogs ? logs : undefined, advancedMetrics)`
);


// Now modify the return objects for compression.
// `return collectLogs ? { data, logs, phases } : data;`
// We need to change the compression ones to include `advancedMetrics`.
// How to distinguish compression from decompression? Compression has `buffer.length - data.length`.

indexTs = indexTs.replace(
    /finalLog\.details\.savedBytes = buffer\.length - data\.length;\n\s*\}\n\s*\}\n\n\s*return collectLogs \? \{ data, logs, phases \} : data;/g,
    `finalLog.details.savedBytes = buffer.length - data.length;\n    }\n  }\n\n  return collectLogs ? { data, logs, phases, advancedMetrics } : data;`
);

fs.writeFileSync('src/utils/algorithm/test/index.ts', indexTs);
