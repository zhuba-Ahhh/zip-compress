import React from 'react';
import { Row, Col, Card, Typography } from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const { Text } = Typography;

export interface ChartData {
  name: string;
  ratio: number;
  compressTime: number;
  decompressTime: number;
}

interface PerformanceChartProps {
  data: ChartData[];
}

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'];

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <Card style={{ marginBottom: 24, background: '#fafafa' }} title="性能概览">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <Text strong>压缩比率对比 (%)</Text><br/>
            <Text type="secondary" style={{fontSize: 12}}>越小越好</Text>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <RechartsTooltip cursor={{fill: '#f0f0f0'}} />
              <Bar dataKey="ratio" name="压缩比率(%)" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Col>
        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <Text strong>平均耗时对比 (ms)</Text><br/>
            <Text type="secondary" style={{fontSize: 12}}>越小越好</Text>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <RechartsTooltip cursor={{fill: '#f0f0f0'}} />
              <Legend />
              <Bar dataKey="compressTime" name="压缩耗时" fill="#1890ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="decompressTime" name="解压耗时" fill="#52c41a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </Card>
  );
};

export default PerformanceChart;
