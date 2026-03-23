import React, { useEffect, useState, useRef } from 'react';
import { Card, Descriptions, Typography, Tag, Space, Button, Spin, Progress, Tooltip } from 'antd';
import { DownloadOutlined, SyncOutlined, FileTextOutlined } from '@ant-design/icons';
import { Stats } from '../../types';
import { formatSize, downloadFile } from '../../utils';
import { ALGORITHM_OPTIONS, CompressionAlgorithm } from '@/common';
import LogModal from './LogModal';
import { TestPayload } from './index';
// 假设这里引入 worker 进行通讯
import { WorkerMessage } from '../../workers/compression.worker';

const { Text } = Typography;

export interface AlgorithmCardProps {
  algorithm: CompressionAlgorithm;
  payload: TestPayload;
  originalFileName: string;
  onComplete: (stats: Stats) => void;
}

const AlgorithmCard: React.FC<AlgorithmCardProps> = ({ algorithm, payload, originalFileName, onComplete }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState(0);
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const workerRef = useRef<Worker | null>(null);

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
      setProgress(0);

      // Create a new worker for each algorithm run to isolate memory and avoid blocking
      const worker = new Worker(new URL('../../workers/compression.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        if (isCancelled) return;

        const { type, progress: currentProgress, result, error } = e.data;

        if (type === 'progress') {
          setProgress(currentProgress);
        } else if (type === 'success') {
          const finalStats: Stats = {
            algorithm,
            originalSize: payload.data.length,
            compressedSize: result.finalCompressedData.length,
            compressTime: result.totalCompressTime,
            decompressTime: result.totalDecompressTime,
            avgCompressTime: result.totalCompressTime / payload.executionCount,
            avgDecompressTime: result.totalDecompressTime / payload.executionCount,
            decompressedSize: result.finalDecompressedData.length,
            ratio: ((result.finalCompressedData.length / payload.data.length) * 100).toFixed(2) + '%',
            isMatch: result.finalIsMatch,
            executionCount: payload.executionCount,
            compressedData: result.finalCompressedData,
            decompressedData: result.finalDecompressedData,
            loading: false,
            logs: result.finalLogs,
            compressPhases: result.compressPhases,
            decompressPhases: result.decompressPhases
          };
          setStats(finalStats);
          onComplete(finalStats);
          worker.terminate();
        } else if (type === 'error') {
          const errorStats: Stats = {
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
            error: error || '压缩失败',
            loading: false,
          };
          setStats(errorStats);
          onComplete(errorStats);
          worker.terminate();
        }
      };

      const message: WorkerMessage = {
        id: payload.triggerId,
        action: 'runTest',
        data: payload.data,
        algorithm,
        collectLogs: payload.collectLogs,
        executionCount: payload.executionCount
      };

      worker.postMessage(message);
    };

    runTest();

    return () => {
      isCancelled = true;
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [algorithm, payload]);

  if (!stats) return null;

  const algorithmName = ALGORITHM_OPTIONS.find(item => item.value === stats.algorithm);

  return (
    <>
      <Card
        type="inner"
        title={
          <Tooltip title={algorithmName?.description || ''}>
            <Tag color="processing">
              {stats.algorithm}
            </Tag>
          </Tooltip>
        }
        style={{ background: '#fafafa', height: '100%' }}
        extra={
          !stats.loading && stats.compressedData && !stats.error && (
            <Space>
              {stats.logs && (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<FileTextOutlined />}
                  onClick={() => setIsLogModalVisible(true)}
                >
                  查看日志
                </Button>
              )}
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
            <Spin indicator={<SyncOutlined spin style={{ fontSize: 24, marginBottom: 16 }} />} />
            {payload.executionCount > 1 ? (
              <div style={{ width: '80%', marginTop: 16 }}>
                <Progress
                  percent={Math.round((progress / payload.executionCount) * 100)}
                  format={() => `当前进度: ${progress}/${payload.executionCount}`}
                />
              </div>
            ) : (
              <div style={{ marginTop: 8, color: '#1890ff' }}>正在处理中...</div>
            )}
          </div>
        ) : stats.error ? (
          <div style={{ color: 'red', padding: '20px 0', textAlign: 'center' }}>
            执行失败: {stats.error}
          </div>
        ) : (
          <Descriptions column={2} size="small">
            <Descriptions.Item label="算法" span={2}>
              <Text strong ellipsis={{ tooltip: algorithmName?.description || '' }}>{algorithmName?.description || stats.algorithm}</Text>
            </Descriptions.Item>
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
      <LogModal
        visible={isLogModalVisible}
        onCancel={() => setIsLogModalVisible(false)}
        title={`${algorithmName?.description || stats.algorithm} 执行日志`}
        logs={stats.logs}
      />
    </>
  );
};

export default AlgorithmCard;
