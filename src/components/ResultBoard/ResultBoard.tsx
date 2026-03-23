import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Typography } from 'antd';
import { Stats } from '@/types';
import { CompressionAlgorithm } from '@/common';
import AlgorithmCard from './AlgorithmCard';
import PerformanceChart, { ChartData } from './PerformanceChart';
import { zhCN } from '@/locales/zh-CN';

const { Title } = Typography;

export interface TestPayload {
  data: Uint8Array;
  executionCount: number;
  triggerId: number;
  collectLogs: boolean;
}

export interface ResultBoardProps {
  algorithms: CompressionAlgorithm[];
  payload: TestPayload | null;
  originalFileName: string;
  showAdvancedMetrics: boolean;
  onAllComplete?: () => void;
}

const ResultBoard: React.FC<ResultBoardProps> = ({ algorithms, payload, originalFileName, showAdvancedMetrics, onAllComplete }) => {
  const [allStats, setAllStats] = useState<Record<string, Stats>>({});
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (payload) {
      setAllStats({});
      setCompletedCount(0);
    }
  }, [payload]);

  const handleComplete = (stats: Stats) => {
    setAllStats(prev => ({ ...prev, [stats.algorithm]: stats }));
    setCompletedCount(prev => prev + 1);
  };

  useEffect(() => {
    if (payload && completedCount > 0 && completedCount === algorithms.length) {
      onAllComplete?.();
    }
  }, [completedCount, algorithms.length, payload, onAllComplete]);

  const chartData: ChartData[] = useMemo(() => {
    if (completedCount === 0) return [];
    return algorithms
      .filter(algo => allStats[algo] && !allStats[algo].error)
      .map(algo => {
        const stat = allStats[algo];
        
        // Calculate throughput MB/s
        const sizeMB = stat.originalSize / (1024 * 1024);
        const compressSpeed = stat.avgCompressTime > 0 ? sizeMB / (stat.avgCompressTime / 1000) : 0;
        const decompressSpeed = stat.avgDecompressTime > 0 ? sizeMB / (stat.avgDecompressTime / 1000) : 0;

        return {
          name: algo,
          ratio: parseFloat(stat.ratio),
          compressTime: Number(stat.avgCompressTime.toFixed(2)),
          decompressTime: Number(stat.avgDecompressTime.toFixed(2)),
          compressSpeed: Number(compressSpeed.toFixed(2)),
          decompressSpeed: Number(decompressSpeed.toFixed(2)),
          compressPhases: stat.compressPhases,
          decompressPhases: stat.decompressPhases
        };
      });
  }, [allStats, algorithms, completedCount]);

  if (!payload || algorithms.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <Title level={4}>{zhCN.testResultsComparison} ({zhCN.loopTimes} {payload.executionCount} {zhCN.times})</Title>

      <Row gutter={[16, 16]}>
        {algorithms.sort((a, b) => a.localeCompare(b)).map((algo) => (
          <Col xs={24} md={algorithms.length > 1 ? 12 : 24} key={`${algo}-${payload.triggerId}`}>
            <AlgorithmCard
              algorithm={algo}
              payload={payload}
              originalFileName={originalFileName}
              showAdvancedMetrics={showAdvancedMetrics}
              onComplete={handleComplete}
            />
          </Col>
        ))}
      </Row>

      {/* Summary Chart */}
      {completedCount === algorithms.length && chartData.length > 0 && (
        <PerformanceChart data={chartData} />
      )}
    </div>
  );
};

export default ResultBoard;
