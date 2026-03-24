import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Typography } from 'antd';
import { Stats } from '@/types';
import AlgorithmCard from './AlgorithmCard';
import PerformanceChart, { ChartData } from './PerformanceChart';
import { zhCN } from '@/locales/zh-CN';
import { useAppContext } from '@/contexts/AppContext';

const { Title } = Typography;

const ResultBoard: React.FC = () => {
  const {
    algorithms,
    testPayload: payload,
    setLoading
  } = useAppContext();

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
      setLoading(false);
    }
  }, [completedCount, algorithms.length, payload, setLoading]);

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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {algorithms.sort((a, b) => a.localeCompare(b)).map((algo) => (
          <Col xs={24} md={algorithms.length > 1 ? 12 : 24} key={`${algo}-${payload.triggerId}`}>
            <AlgorithmCard
              algorithm={algo}
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
