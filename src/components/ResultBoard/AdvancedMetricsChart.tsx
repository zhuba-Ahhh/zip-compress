import React, { useMemo } from 'react';
import { Typography, Tooltip as AntTooltip, Row, Col } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import { AdvancedMetrics, ChunkMetric } from '@/types';
import { formatSize } from '@/utils';

const { Title, Text } = Typography;

interface Props {
  metrics: AdvancedMetrics;
  algorithmName: string;
}

// 1. 抽离图例配置与组件
const LEGEND_ITEMS = [
  { label: '极佳', color: '#389e0d' },
  { label: '良好', color: '#7cb305' },
  { label: '一般', color: '#faad14' },
  { label: '膨胀', color: '#cf1322' },
];

const LegendItem = ({ label, color }: { label: string; color: string }) => (
  <span style={{ display: 'flex', alignItems: 'center' }}>
    <div style={{ width: 12, height: 12, background: color, marginRight: 4 }} />
    {label}
  </span>
);

// 2. 抽离热力带色块组件，避免重复渲染创建
const HeatmapBlock = React.memo(({ chunk, index }: { chunk: ChunkMetric; index: number }) => {
  const ratio = chunk.ratio * 100;

  let color = '#cf1322'; // 默认红色
  if (ratio < 30) color = '#389e0d';
  else if (ratio < 70) color = '#7cb305';
  else if (ratio <= 100) color = '#faad14';

  return (
    <AntTooltip
      title={
        <div>
          <div>Block #{index + 1}</div>
          <div>Offset: {formatSize(chunk.offset)}</div>
          <div>Original: {formatSize(chunk.originalSize)}</div>
          <div>Compressed: {formatSize(chunk.compressedSize)}</div>
          <div>Ratio: {ratio.toFixed(2)}%</div>
        </div>
      }
    >
      <div
        style={{
          height: '100%',
          flex: 1,
          backgroundColor: color,
          borderRight: '1px solid rgba(255,255,255,0.2)',
          transition: 'opacity 0.2s',
          cursor: 'crosshair'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      />
    </AntTooltip>
  );
});

// 3. 抽离热力图区段组件
const HeatmapSection: React.FC<{ chunks: ChunkMetric[] }> = ({ chunks }) => {
  if (!chunks || chunks.length === 0) return null;

  return (
    <Col span={24}>
      <Title level={5} style={{ margin: 0, marginBottom: 8 }}>🔥 数据压缩率热力带 (按块)</Title>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>颜色越绿表示越容易压缩，越红表示存在不可压缩的高熵数据。</Text>
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          {LEGEND_ITEMS.map(item => (
            <LegendItem key={item.label} label={item.label} color={item.color} />
          ))}
        </div>
      </div>
      <div style={{ height: 40, display: 'flex', width: '100%', borderRadius: 4, overflow: 'hidden', border: '1px solid #d9d9d9' }}>
        {chunks.map((chunk, i) => (
          <HeatmapBlock key={i} chunk={chunk} index={i} />
        ))}
      </div>
    </Col>
  );
};

// 4. 抽离吞吐量图表区段组件
const ThroughputChartSection: React.FC<{ timeSeriesData: any[] }> = ({ timeSeriesData }) => {
  if (!timeSeriesData || timeSeriesData.length === 0) return null;

  return (
    <Col span={24}>
      <Title level={5} style={{ margin: 0, marginBottom: 8 }}>📈 瞬时吞吐量波动 (MB/s)</Title>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        展示文件不同区域处理速度的波动情况
      </Text>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={timeSeriesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12 }}
            label={{ value: '时间 (ms)', position: 'insideBottomRight', offset: -10, fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, 'auto']}
          />
          <RechartsTooltip
            formatter={(value: any) => [`${value} MB/s`, '吞吐量']}
            labelFormatter={(label) => `时间: ${label} ms`}
          />
          <Line
            type="monotone"
            dataKey="speed"
            stroke="#1890ff"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Col>
  );
};

const AdvancedMetricsChart: React.FC<Props> = ({ metrics }) => {
  // Normalize timeSeries
  const timeSeriesData = useMemo(() => {
    if (!metrics?.timeSeries) return [];
    return metrics.timeSeries.map(m => ({
      time: m.timeMs.toFixed(2),
      speed: Number(m.instantSpeed.toFixed(2)),
      processed: formatSize(m.processedBytes)
    }));
  }, [metrics]);

  return (
    <Row gutter={[16, 24]}>
      <HeatmapSection chunks={metrics.chunks || []} />
      <ThroughputChartSection timeSeriesData={timeSeriesData} />
    </Row>
  );
};

export default AdvancedMetricsChart;
