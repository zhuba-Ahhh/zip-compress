import React from 'react';
import { Row, Col, Card, Descriptions, Typography, Tag, Space, Button, Spin } from 'antd';
import { DownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { Stats } from '../types';
import { formatSize, downloadFile } from '../utils';

const { Title, Text } = Typography;

interface ResultBoardProps {
  statsList: Stats[];
  originalFileName: string;
}

const ResultBoard: React.FC<ResultBoardProps> = ({ statsList, originalFileName }) => {
  if (statsList.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <Title level={4}>测试结果对比 (循环 {statsList[0]?.executionCount || 1} 次)</Title>
      <Row gutter={[16, 16]}>
        {statsList.map((stats, idx) => (
          <Col xs={24} md={statsList.length > 1 ? 12 : 24} key={idx}>
            <Card 
              type="inner" 
              title={<><Tag color="processing">{stats.algorithm}</Tag>处理详情</>} 
              style={{ background: '#fafafa', height: '100%' }}
              extra={
                !stats.loading && stats.compressedData && !stats.error && (
                  <Space>
                    <Button 
                      size="small" 
                      type="dashed" 
                      icon={<DownloadOutlined />}
                      onClick={() => downloadFile(stats.compressedData!, `${originalFileName}.${stats.algorithm}`)}
                    >
                      下载压缩后文件
                    </Button>
                    <Button 
                      size="small" 
                      type="dashed" 
                      icon={<DownloadOutlined />}
                      onClick={() => downloadFile(stats.decompressedData!, `decompressed_${originalFileName}`)}
                    >
                      下载解压后文件
                    </Button>
                  </Space>
                )
              }
            >
              {stats.loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin indicator={<SyncOutlined spin style={{ fontSize: 24 }} />} />
                  <div style={{ marginTop: 8, color: '#1890ff' }}>正在处理中...</div>
                </div>
              ) : stats.error ? (
                <div style={{ color: 'red', padding: '20px 0', textAlign: 'center' }}>
                  执行失败: {stats.error}
                </div>
              ) : (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="原始大小">
                    <Text strong>{formatSize(stats.originalSize)}</Text> ({stats.originalSize} B)
                  </Descriptions.Item>
                  <Descriptions.Item label="压缩后大小">
                    <Text strong type="success">{formatSize(stats.compressedSize)}</Text> ({stats.compressedSize} B)
                  </Descriptions.Item>
                  <Descriptions.Item label="压缩比率">
                    <Tag color="blue">{stats.ratio}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="平均压缩耗时">
                    <Text type="warning">{stats.avgCompressTime.toFixed(2)} ms</Text> 
                    {stats.executionCount > 1 && <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>(总计: {stats.compressTime.toFixed(2)} ms)</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="平均解压耗时">
                    <Text type="warning">{stats.avgDecompressTime.toFixed(2)} ms</Text>
                    {stats.executionCount > 1 && <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>(总计: {stats.decompressTime.toFixed(2)} ms)</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="数据一致性">
                    {stats.isMatch ? <Tag color="success">校验通过</Tag> : <Tag color="error">数据损坏</Tag>}
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default ResultBoard;
