// ============================================================
// 压缩算法综合效率评分计算器
// ============================================================
//
// 总分(10分制) = W_ratio × S_ratio + W_compress × S_compress + W_decompress × S_decompress
//
// S_xxx = (该算法值 / 组内最大值) × 10   归一化到 [0, 10]
// 大文件衰减: WASM → 1/(1 + 0.05·log₂(size/50MB))
//            纯 JS → 1/(1 + 0.12·log₂(size/50MB))
// ============================================================

interface AlgorithmData {
  name: string;
  compressSpeed: number;   // MB/s
  decompressSpeed: number; // MB/s
  ratio: number;           // 压缩比 (压缩后/原始大小), 越小越好 (百分比)
  isWasm?: boolean;
}

interface Weights {
  ratio: number;      // 压缩率权重
  compress: number;   // 压缩速度权重
  decompress: number; // 解压速度权重 (三者之和 = 1)
}

interface ScoreResult {
  name: string;
  ratioScore: number;
  compressScore: number;
  decompressScore: number;
  total: number;
}

/** 大文件性能衰减系数 */
function decayFactor(sizeMB: number, isWasm: boolean = false): number {
  const base = Math.max(sizeMB / 50, 1);
  const k = isWasm ? 0.05 : 0.12;
  return 1 / (1 + k * Math.log2(base));
}

/** 核心评分函数 */
function computeScores(
  algos: AlgorithmData[],
  weights: Weights,
  fileSizeMB: number
): ScoreResult[] {
  // 1. 应用大文件衰减
  const effective = algos.map((a) => ({
    name: a.name,
    ratio: a.ratio,
    effCompress: a.compressSpeed * decayFactor(fileSizeMB, a.isWasm || false),
    effDecompress: a.decompressSpeed * decayFactor(fileSizeMB, a.isWasm || false),
  }));

  // 2. 组内归一化
  const minRatio = Math.min(...effective.map((a) => a.ratio));
  const maxCompress = Math.max(...effective.map((a) => a.effCompress));
  const maxDecompress = Math.max(...effective.map((a) => a.effDecompress));

  // 3. 计算总分
  return effective
    .map((a) => {
      const ratioScore = (minRatio / a.ratio) * 10;
      const compressScore = (a.effCompress / maxCompress) * 10;
      const decompressScore = (a.effDecompress / maxDecompress) * 10;
      const total =
        weights.ratio * ratioScore +
        weights.compress * compressScore +
        weights.decompress * decompressScore;

      return {
        name: a.name,
        ratioScore: Math.round(ratioScore * 100) / 100,
        compressScore: Math.round(compressScore * 100) / 100,
        decompressScore: Math.round(decompressScore * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export { computeScores, decayFactor };
export type { AlgorithmData, Weights, ScoreResult };