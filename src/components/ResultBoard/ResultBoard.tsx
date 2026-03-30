import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Typography, Button, Space } from 'antd';
import { BorderOutlined, TableOutlined } from '@ant-design/icons';
import { Stats } from '@/types';
import AlgorithmCard from './AlgorithmCard';
import AlgorithmTable from './AlgorithmTable';
import PerformanceChart, { ChartData } from './PerformanceChart';
import { zhCN } from '@/locales/zh-CN';
import { useAppContext } from '@/contexts/AppContext';
import { computeScores } from '@/utils/computeScores';

const { Title } = Typography;

const ResultBoard: React.FC = () => {
  const {
    algorithms,
    testPayload: payload,
    setLoading
  } = useAppContext();

  const [allStats, setAllStats] = useState<Record<string, Stats>>({});
  const [completedCount, setCompletedCount] = useState(0);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

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

  // 计算得分
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
    const fileSizeMB = payload?.data ? payload.data.length / (1024 * 1024) : 1;
    const scores = computeScores(algorithmData, weights, fileSizeMB);

    // 将得分添加到 stats 对象中
    const scored = { ...allStats };
    scores.forEach(score => {
      if (scored[score.name]) {
        scored[score.name] = { ...scored[score.name], score };
      }
    });

    return scored;
  }, [allStats, algorithms, completedCount, payload]);

  // 表格数据
  const tableData = algorithms
    .sort((a, b) => a.localeCompare(b))
    .map((algo) => scoredStats[algo])
    .filter((stats): stats is Stats => stats !== undefined);

  if (!payload || algorithms.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{zhCN.testResultsComparison} ({zhCN.loopTimes} {payload.executionCount} {zhCN.times})</Title>
        <Space>
          <Button
            type={viewMode === 'card' ? 'primary' : 'default'}
            icon={<BorderOutlined />}
            onClick={() => setViewMode('card')}
          >
            {zhCN.cardView}
          </Button>
          <Button
            type={viewMode === 'table' ? 'primary' : 'default'}
            icon={<TableOutlined />}
            onClick={() => setViewMode('table')}
          >
            {zhCN.tableView}
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24, display: viewMode === 'card' ? 'flex' : 'none' }}>
        {algorithms.sort((a, b) => a.localeCompare(b)).map((algo) => (
          <Col xs={24} md={algorithms.length > 1 ? 12 : 24} key={`${algo}-${payload.triggerId}`}>
            <AlgorithmCard
              algorithm={algo}
              onComplete={handleComplete}
            />
          </Col>
        ))}
      </Row>

      <div style={{ marginBottom: 24, display: viewMode === 'table' ? 'block' : 'none' }}>
        <AlgorithmTable data={tableData} />
      </div>

      {/* Summary Chart */}
      {completedCount === algorithms.length && chartData.length > 0 && (
        <PerformanceChart data={chartData} />
      )}
    </div>
  );
};

export default ResultBoard;
