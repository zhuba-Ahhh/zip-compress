import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Descriptions, Typography, Tag, Space, Button, Spin, Tooltip } from 'antd';
import { DownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { Stats } from '../types';
import { formatSize, downloadFile, compressData, decompressData } from '../utils';
import { ALGORITHM_OPTIONS, CompressionAlgorithm } from '@/common';

const { Title, Text } = Typography;

export interface TestPayload {
  data: Uint8Array;
  executionCount: number;
  triggerId: number;
}

interface AlgorithmCardProps {
  algorithm: CompressionAlgorithm;
  payload: TestPayload;
  originalFileName: string;
}

const AlgorithmCard: React.FC<AlgorithmCardProps> = ({ algorithm, payload, originalFileName }) => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const runTest = async () => {
      setStats({
        algorithm,
        originalSize: payload.data.length,
        compressedSize: 0,
        compressTime: 0,
        decompressTime: 0,
        avgCompressTime: 0,
        avgDecompressTime: 0,
        decompressedSize: 0,
        ratio: '',
        isMatch: false,
        executionCount: payload.executionCount,
        loading: true,
      });

      // 稍微延迟让 UI 有时间渲染 loading 状态
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        let totalCompressTime = 0;
        let totalDecompressTime = 0;
        let finalCompressedData: Uint8Array = new Uint8Array();
        let finalDecompressedData: Uint8Array = new Uint8Array();
        let finalIsMatch = false;

        for (let iter = 0; iter < payload.executionCount; iter++) {
          if (isCancelled) return;

          // 1. Compress
          const startCompress = performance.now();
          const compressedData = await compressData(payload.data, algorithm);
          const endCompress = performance.now();
          totalCompressTime += (endCompress - startCompress);

          // 2. Decompress
          const startDecompress = performance.now();
          const decompressedData = await decompressData(compressedData, algorithm);
          const endDecompress = performance.now();
          totalDecompressTime += (endDecompress - startDecompress);

          if (iter === payload.executionCount - 1) {
            finalCompressedData = compressedData;
            finalDecompressedData = decompressedData;

            // 3. Verify on last iteration
            finalIsMatch = payload.data.length === decompressedData.length;
            if (finalIsMatch) {
              for (let i = 0; i < payload.data.length; i++) {
                if (payload.data[i] !== decompressedData[i]) {
                  finalIsMatch = false;
                  break;
                }
              }
            }
          }

          // 给主线程喘息的机会
          if (iter % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        if (isCancelled) return;

        setStats({
          algorithm,
          originalSize: payload.data.length,
          compressedSize: finalCompressedData.length,
          compressTime: totalCompressTime,
          decompressTime: totalDecompressTime,
          avgCompressTime: totalCompressTime / payload.executionCount,
          avgDecompressTime: totalDecompressTime / payload.executionCount,
          decompressedSize: finalDecompressedData.length,
          ratio: ((finalCompressedData.length / payload.data.length) * 100).toFixed(2) + '%',
          isMatch: finalIsMatch,
          executionCount: payload.executionCount,
          compressedData: finalCompressedData,
          decompressedData: finalDecompressedData,
          loading: false,
        });

      } catch (err: unknown) {
        if (isCancelled) return;
        setStats({
          algorithm,
          originalSize: payload.data.length,
          compressedSize: 0,
          compressTime: 0,
          decompressTime: 0,
          avgCompressTime: 0,
          avgDecompressTime: 0,
          decompressedSize: 0,
          ratio: 'N/A',
          isMatch: false,
          executionCount: payload.executionCount,
          error: (err as Error)?.message || '压缩失败',
          loading: false,
        });
      }
    };

    runTest();

    return () => {
      isCancelled = true;
    };
  }, [algorithm, payload]);

  if (!stats) return null;

  return (
    <Card
      type="inner"
      title={
        <>
          <Tooltip title={ALGORITHM_OPTIONS.find(item => item.value === stats.algorithm)?.description || ''}>
            <Tag color="processing">
              {stats.algorithm}
            </Tag>
          </Tooltip>
          处理详情
        </>
      }
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
              下载压缩文件
            </Button>
            <Button
              size="small"
              type="dashed"
              icon={<DownloadOutlined />}
              onClick={() => downloadFile(stats.decompressedData!, `decompressed_${originalFileName}`)}
            >
              下载解压文件
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
  );
};

interface ResultBoardProps {
  algorithms: CompressionAlgorithm[];
  payload: TestPayload | null;
  originalFileName: string;
}

const ResultBoard: React.FC<ResultBoardProps> = ({ algorithms, payload, originalFileName }) => {
  if (!payload || algorithms.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <Title level={4}>测试结果对比 (循环 {payload.executionCount} 次)</Title>
      <Row gutter={[16, 16]}>
        {algorithms.map((algo) => (
          <Col xs={24} md={algorithms.length > 1 ? 12 : 24} key={`${algo}-${payload.triggerId}`}>
            <AlgorithmCard
              algorithm={algo}
              payload={payload}
              originalFileName={originalFileName}
            />
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default ResultBoard;
