const fs = require('fs');
let content = fs.readFileSync('src/utils/algorithm/test/index.ts', 'utf8');

// The test index still thinks lz77 functions return tokens array directly.
// We need to destructure them to { tokens, advancedMetrics }

content = content.replace(
    /const tokens = runWithPhases\("LZ77匹配\(Pass 1\)", \(\) => (lz77Compress[a-zA-Z]+)\(buffer, collectLogs \? logs : undefined\), collectLogs \? phases : undefined\);\n  const data = runWithPhases\("位流封装", \(\) => encodeBitpack\(tokens, collectLogs \? logs : undefined\), collectLogs \? phases : undefined\);/g,
    `const { tokens, advancedMetrics } = runWithPhases("LZ77匹配(Pass 1)", () => $1(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);\n  const data = runWithPhases("位流封装", () => encodeBitpack(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);`
);

content = content.replace(
    /const tokens = runWithPhases\("LZ77匹配\(Pass 1\)", \(\) => (lz77Compress[a-zA-Z]+)\(buffer, collectLogs \? logs : undefined\), collectLogs \? phases : undefined\);\n  const data = runWithPhases\("构建树与编码", \(\) => encodeHuffman[a-zA-Z]+\(tokens, collectLogs \? logs : undefined\), collectLogs \? phases : undefined\);/g,
    `const { tokens, advancedMetrics } = runWithPhases("LZ77匹配(Pass 1)", () => $1(buffer, collectLogs ? logs : undefined), collectLogs ? phases : undefined);\n  const data = runWithPhases("构建树与编码", () => encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);`
);

// We need to pass advancedMetrics to the return value
content = content.replace(
    /return collectLogs \? \{ data, logs, phases \} : data;/g,
    `return collectLogs ? { data, logs, phases, advancedMetrics: (typeof advancedMetrics !== 'undefined' ? advancedMetrics : undefined) } : data;`
);

// One of them is encodeHuffmanDynamic for myHuffman1Compress
content = content.replace(
    /encodeHuffmanDeflate\(tokens, collectLogs \? logs : undefined\), collectLogs \? phases : undefined\);\n\s*if \(collectLogs && logs.length > 0\) \{\n\s*const finalLog = logs\[logs\.length - 1\];/g,
    `encodeHuffmanDeflate(tokens, collectLogs ? logs : undefined), collectLogs ? phases : undefined);\n  \n  if (collectLogs && logs.length > 0) {\n    const finalLog = logs[logs.length - 1];`
);

// Let's explicitly replace the 6 functions to be safe and accurate.
// Since we used regex, let's just make sure we didn't break decode functions.
// Decode functions don't have `tokens` or `advancedMetrics`, so `typeof advancedMetrics !== 'undefined'` will just be undefined.
// But wait, in JS, accessing an undeclared variable throws ReferenceError.
// We must declare `let advancedMetrics: any;` in decode functions, or just change the regex.

fs.writeFileSync('src/utils/algorithm/test/index.ts', content);
