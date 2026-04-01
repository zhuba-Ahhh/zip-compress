import React from 'react';
import { Table, Card, Collapse } from 'antd';
import { Stats } from '@/types';
import { zhCN } from '@/locales/zh-CN';
import { formatSize } from '@/utils';

const { Panel } = Collapse;

interface AlgorithmTableProps {
  data: Stats[];
}

const AlgorithmTable: React.FC<AlgorithmTableProps> = ({ data }) => {
  // 表格列定义
  const columns = [
    {
      title: zhCN.algorithm,
      dataIndex: 'algorithm',
      key: 'algorithm',
      sorter: (a: Stats, b: Stats) => a.algorithm.localeCompare(b.algorithm),
      width: 120,
    },
    {
      title: zhCN.originalSize,
      dataIndex: 'originalSize',
      key: 'originalSize',
      render: (size: number) => formatSize(size),
      sorter: (a: Stats, b: Stats) => a.originalSize - b.originalSize,
      width: 120,
    },
    {
      title: zhCN.compressedSize,
      dataIndex: 'compressedSize',
      key: 'compressedSize',
      render: (size: number, record: Stats) => {
        let isBest = false;
        let color = '#1890ff';
        if (data.length > 0) {
          const allCompressedSizes = data.map(item => item.compressedSize);
          const minCompressedSize = Math.min(...allCompressedSizes);
          isBest = record.compressedSize === minCompressedSize;
          if (size < minCompressedSize * 1.1) color = '#52c41a';
        }
        return (
          <div>
            <span style={{ color }}>{formatSize(size)}</span>
            {isBest && <span style={{ marginLeft: 8, color: '#52c41a' }}>⭐</span>}
          </div>
        );
      },
      sorter: (a: Stats, b: Stats) => a.compressedSize - b.compressedSize,
      width: 120,
    },
    {
      title: zhCN.compressionRatio,
      dataIndex: 'ratio',
      key: 'ratio',
      render: (ratio: string) => {
        const ratioValue = parseFloat(ratio);
        let isBest = false;
        let color = '#1890ff';
        if (data.length > 0) {
          const allRatios = data.map(item => parseFloat(item.ratio));
          const minRatio = Math.min(...allRatios);
          isBest = ratioValue === minRatio;
        }
        if (ratioValue < 50) color = '#52c41a';
        else if (ratioValue > 80) color = '#ff4d4f';
        return (
          <div>
            <span style={{ color }}>{ratio}</span>
            {isBest && <span style={{ marginLeft: 8, color: '#52c41a' }}>⭐</span>}
          </div>
        );
      },
      sorter: (a: Stats, b: Stats) => parseFloat(b.ratio) - parseFloat(a.ratio),
      width: 120,
    },
    {
      title: zhCN.avgCompressTime,
      dataIndex: 'avgCompressTime',
      key: 'avgCompressTime',
      render: (time: number, record: Stats) => {
        let isBest = false;
        let color = '#1890ff';
        if (data.length > 0) {
          const allCompressTimes = data.map(item => item.avgCompressTime);
          const minCompressTime = Math.min(...allCompressTimes);
          isBest = record.avgCompressTime === minCompressTime;
        }
        if (time < 100) color = '#52c41a';
        else if (time > 500) color = '#ff4d4f';
        return (
          <div>
            <span style={{ color }}>{time.toFixed(2)} ms</span>
            {isBest && <span style={{ marginLeft: 8, color: '#52c41a' }}>⭐</span>}
          </div>
        );
      },
      sorter: (a: Stats, b: Stats) => a.avgCompressTime - b.avgCompressTime,
      width: 140,
    },
    {
      title: zhCN.avgDecompressTime,
      dataIndex: 'avgDecompressTime',
      key: 'avgDecompressTime',
      render: (time: number, record: Stats) => {
        let isBest = false;
        let color = '#1890ff';
        if (data.length > 0) {
          const allDecompressTimes = data.map(item => item.avgDecompressTime);
          const minDecompressTime = Math.min(...allDecompressTimes);
          isBest = record.avgDecompressTime === minDecompressTime;
        }
        if (time < 50) color = '#52c41a';
        else if (time > 200) color = '#ff4d4f';
        return (
          <div>
            <span style={{ color }}>{time.toFixed(2)} ms</span>
            {isBest && <span style={{ marginLeft: 8, color: '#52c41a' }}>⭐</span>}
          </div>
        );
      },
      sorter: (a: Stats, b: Stats) => a.avgDecompressTime - b.avgDecompressTime,
      width: 140,
    },
    {
      title: zhCN.dataConsistency,
      dataIndex: 'isMatch',
      key: 'isMatch',
      render: (isMatch: boolean) => (
        <span style={{ color: isMatch ? '#52c41a' : '#ff4d4f' }}>
          {isMatch ? zhCN.verificationPassed : zhCN.dataCorrupted}
        </span>
      ),
      sorter: (a: Stats, b: Stats) => (a.isMatch ? 1 : 0) - (b.isMatch ? 1 : 0),
      width: 120,
    },
    {
      title: '总分',
      dataIndex: 'score',
      key: 'score',
      render: (score: any) => {
        if (!score) return '-';
        let isBest = false;
        let color = '#1890ff';
        if (data.length > 0) {
          const allScores = data.map(item => item.score?.total || 0);
          const maxScore = Math.max(...allScores);
          isBest = score.total === maxScore;
        }
        if (score.total > 8) color = '#52c41a';
        else if (score.total < 5) color = '#ff4d4f';

        return (
          <Collapse>
            <Panel
              header={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ color, fontWeight: 'bold' }}>{score.total.toFixed(2)}</span>
                  {isBest && <span style={{ color: '#52c41a' }}>⭐</span>}
                </div>
              }
              key="1"
            >
              <Card size="small">
                <div style={{ fontSize: 12 }}>
                  <div style={{ marginBottom: 4 }}>压缩率: <strong>{score.ratioScore.toFixed(2)}</strong></div>
                  <div style={{ marginBottom: 4 }}>压缩速度: <strong>{score.compressScore.toFixed(2)}</strong></div>
                  <div>解压速度: <strong>{score.decompressScore.toFixed(2)}</strong></div>
                </div>
              </Card>
            </Panel>
          </Collapse>
        );
      },
      sorter: (a: Stats, b: Stats) => (a.score?.total || 0) - (b.score?.total || 0),
      width: 200,
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <Table
        bordered
        columns={columns}
        dataSource={data}
        rowKey="algorithm"
        pagination={false}
        scroll={{ x: 1000 }} // 增加横向滚动
      />
    </div>
  );
};

export default AlgorithmTable;