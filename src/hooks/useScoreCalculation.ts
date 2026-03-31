import { useMemo } from 'react';
import { Stats } from '@/types';
import { CompressionAlgorithm } from '@/common';
import { computeScores } from '@/utils/computeScores';

interface UseScoreCalculationProps {
  algorithms: CompressionAlgorithm[];
  allStats: Record<string, Stats>;
  completedCount: number;
  payloadData?: Uint8Array;
}

export const useScoreCalculation = ({
  algorithms,
  allStats,
  completedCount,
  payloadData
}: UseScoreCalculationProps) => {
  const scoredStats = useMemo(() => {
    if (completedCount === 0) return {};

    // 准备算法数据
    const algorithmData = algorithms
      .filter(algo => allStats[algo] && !allStats[algo].error)
      .map(algo => {
        const stat = allStats[algo];
        const sizeMB = stat.originalSize / (1024 * 1024);
        const compressSpeed = stat.avgCompressTime > 0 ? sizeMB / (stat.avgCompressTime / 1000) : 0;
        const decompressSpeed = stat.avgDecompressTime > 0 ? sizeMB / (stat.avgDecompressTime / 1000) : 0;

        return {
          name: algo,
          compressSpeed,
          decompressSpeed,
          ratio: parseFloat(stat.ratio)
        };
      });

    // 计算得分
    const weights = { ratio: 0.8, compress: 0.05, decompress: 0.15 };
    const fileSizeMB = payloadData ? payloadData.length / (1024 * 1024) : 1;
    const scores = computeScores(algorithmData, weights, fileSizeMB);

    // 将得分添加到 stats 对象中
    const scored = { ...allStats };
    scores.forEach(score => {
      if (scored[score.name]) {
        scored[score.name] = { ...scored[score.name], score };
      }
    });

    return scored;
  }, [allStats, algorithms, completedCount, payloadData]);

  return scoredStats;
};
