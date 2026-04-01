import React, { useMemo } from 'react';
import { Row, Col, Card, Typography, Switch } from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { PhaseTiming } from '@/types';
import { zhCN } from '@/locales/zh-CN';

const { Text, Title } = Typography;

export interface ChartData {
  name: string;
  ratio: number;
  compressTime: number;
  decompressTime: number;
  compressSpeed: number; // MB/s
  decompressSpeed: number; // MB/s
  compressPhases?: PhaseTiming[];
  decompressPhases?: PhaseTiming[];
}

interface PerformanceChartProps {
  data: ChartData[];
}

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'];
// Phase colors
const PHASE_COLORS = ['#bae0ff', '#91caff', '#69b1ff', '#4096ff', '#1677ff', '#0958d9', '#003eb3', '#002c8c'];

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  const [showRadar, setShowRadar] = React.useState(true);
  const [showPhases, setShowPhases] = React.useState(true);
  const [showDecompressPhases, setShowDecompressPhases] = React.useState(true);

  // Normalize data for Radar Chart to make them comparable (0-100 score)
  const radarData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const maxRatio = Math.max(...data.map(d => d.ratio));
    const maxCSpeed = Math.max(...data.map(d => d.compressSpeed));
    const maxDSpeed = Math.max(...data.map(d => d.decompressSpeed));

    // Construct radar chart dimensions
    const dimensions = [
      { name: zhCN.compressionRatioHigherIsBetter, key: 'ratioScore' },
      { name: zhCN.compressionSpeedHigherIsBetter, key: 'cSpeedScore' },
      { name: zhCN.decompressionSpeedHigherIsBetter, key: 'dSpeedScore' },
    ];

    return dimensions.map(dim => {
      const row: any = { subject: dim.name };
      data.forEach(d => {
        if (dim.key === 'ratioScore') {
          // Larger compression ratio is better
          row[d.name] = maxRatio === 0 ? 0 : (d.ratio / maxRatio) * 100;
        } else if (dim.key === 'cSpeedScore') {
          row[d.name] = maxCSpeed === 0 ? 0 : (d.compressSpeed / maxCSpeed) * 100;
        } else if (dim.key === 'dSpeedScore') {
          row[d.name] = maxDSpeed === 0 ? 0 : (d.decompressSpeed / maxDSpeed) * 100;
        }
      });
      return row;
    });
  }, [data]);

  // Prepare phase timing data
  const phasesData = useMemo(() => {
    const hasPhases = data.some(d => d.compressPhases && d.compressPhases.length > 0);
    if (!hasPhases) return null;

    // Collect all phase names to ensure complete stacked chart keys and fixed order
    const predefinedOrder = [
      zhCN.phaseInit,
      zhCN.phaseLZ77Pass1,
      zhCN.phaseBuildHuffman,
      zhCN.phaseBuildTreeAndEncode,
      zhCN.phaseBitstreamPass2,
      zhCN.phaseBitstreamPack
    ];
    const dynamicPhases = new Set<string>();

    const chartData = data.map(d => {
      const row: any = { name: d.name };
      if (d.compressPhases) {
        d.compressPhases.forEach(p => {
          row[p.name] = Number(p.duration.toFixed(2));
          if (!predefinedOrder.includes(p.name)) {
            dynamicPhases.add(p.name);
          }
        });
      }
      return row;
    });

    const allPhaseNames = [...predefinedOrder, ...Array.from(dynamicPhases)].filter(name =>
      chartData.some(row => row[name] !== undefined)
    );

    return {
      data: chartData,
      keys: allPhaseNames
    };
  }, [data]);

  // Prepare decompression phase timing data
  const decompressPhasesData = useMemo(() => {
    const hasPhases = data.some(d => d.decompressPhases && d.decompressPhases.length > 0);
    if (!hasPhases) return null;

    const predefinedOrder = [
      zhCN.phaseInit,
      zhCN.phaseHuffmanRebuild,
      zhCN.phaseBitstreamDecode,
      zhCN.phaseDecode,
      zhCN.phaseDecompressComplete
    ];
    const dynamicPhases = new Set<string>();

    const chartData = data.map(d => {
      const row: any = { name: d.name };
      if (d.decompressPhases) {
        d.decompressPhases.forEach(p => {
          row[p.name] = Number(p.duration.toFixed(2));
          if (!predefinedOrder.includes(p.name)) {
            dynamicPhases.add(p.name);
          }
        });
      }
      return row;
    });

    const allPhaseNames = [...predefinedOrder, ...Array.from(dynamicPhases)].filter(name =>
      chartData.some(row => row[name] !== undefined)
    );

    return {
      data: chartData,
      keys: allPhaseNames
    };
  }, [data]);

  if (!data || data.length === 0) return null;

  return (
    <Card
      style={{ marginBottom: 24, background: '#fafafa', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>{zhCN.performanceEvaluation}</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <Text style={{ fontSize: 14, fontWeight: 'normal', marginRight: 8 }}>{zhCN.showRadarChart}</Text>
              <Switch checked={showRadar} onChange={setShowRadar} size="small" />
            </div>
            {phasesData && (
              <div>
                <Text style={{ fontSize: 14, fontWeight: 'normal', marginRight: 8 }}>{zhCN.compressionPhase}</Text>
                <Switch checked={showPhases} onChange={setShowPhases} size="small" />
              </div>
            )}
            {decompressPhasesData && (
              <div>
                <Text style={{ fontSize: 14, fontWeight: 'normal', marginRight: 8 }}>{zhCN.decompressionPhase}</Text>
                <Switch checked={showDecompressPhases} onChange={setShowDecompressPhases} size="small" />
              </div>
            )}
          </div>
        </div>
      }
    >
      {showRadar && (
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={24}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>{zhCN.radarChartTitle}</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>{zhCN.radarChartDesc}</Text>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ paddingTop: 20 }} />
                {data.map((d, i) => (
                  <Radar
                    key={d.name}
                    name={d.name}
                    dataKey={d.name}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.3}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      )}

      {showPhases && phasesData && (
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={24}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>{zhCN.compressLifecycleTitle}</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>{zhCN.compressLifecycleDesc}</Text>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={phasesData.data} margin={{ top: 20, right: 30, left: 20, bottom: 25 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <RechartsTooltip cursor={{ fill: '#f0f0f0' }} />
                <Legend />
                {phasesData.keys.map((key, index) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={PHASE_COLORS[index % PHASE_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      )}

      {showDecompressPhases && decompressPhasesData && (
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={24}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>{zhCN.decompressLifecycleTitle}</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>{zhCN.decompressLifecycleDesc}</Text>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={decompressPhasesData.data} margin={{ top: 20, right: 30, left: 20, bottom: 25 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <RechartsTooltip cursor={{ fill: '#f0f0f0' }} />
                <Legend />
                {decompressPhasesData.keys.map((key, index) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={PHASE_COLORS[(index + 4) % PHASE_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <Title level={5} style={{ margin: 0 }}>{zhCN.compressionRatioComparison}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{zhCN.shorterIsBetter}</Text>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} />
              <YAxis />
              <RechartsTooltip cursor={{fill: '#f0f0f0'}} />
              <Bar dataKey="ratio" name={zhCN.compressionRatioPercent} radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Col>
        <Col xs={24} md={8}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <Title level={5} style={{ margin: 0 }}>{zhCN.throughputComparison}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{zhCN.longerIsBetter}</Text>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} />
              <YAxis />
              <RechartsTooltip cursor={{ fill: '#f0f0f0' }} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="compressSpeed" name={zhCN.compressionSpeed} fill="#1890ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="decompressSpeed" name={zhCN.decompressionSpeed} fill="#52c41a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Col>
        <Col xs={24} md={8}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <Title level={5} style={{ margin: 0 }}>{zhCN.avgTimeComparison}</Title>
            <Text type="secondary" style={{fontSize: 12}}>{zhCN.smallerIsBetter}</Text>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} />
              <YAxis />
              <RechartsTooltip cursor={{fill: '#f0f0f0'}} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="compressTime" name={zhCN.compressionTime} fill="#faad14" radius={[4, 4, 0, 0]} />
              <Bar dataKey="decompressTime" name={zhCN.decompressionTime} fill="#722ed1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </Card>
  );
};

export default PerformanceChart;
