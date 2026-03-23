import React, { useEffect, useState, useRef } from 'react';
import { Card, Descriptions, Typography, Tag, Space, Button, Spin, Progress, Tooltip } from 'antd';
import { DownloadOutlined, SyncOutlined, FileTextOutlined } from '@ant-design/icons';
import { Stats } from '@/types';
import { formatSize, downloadFile } from '@/utils';
import { ALGORITHM_OPTIONS, CompressionAlgorithm } from '@/common';
import LogModal from './LogModal';
import AdvancedMetricsChart from './AdvancedMetricsChart';
import { TestPayload } from './index';
// 假设这里引入 worker 进行通讯
import { zhCN } from '@/locales/zh-CN';
import { WorkerMessage } from '@/workers/compression.worker';

const { Text } = Typography;

export interface AlgorithmCardProps {
  algorithm: CompressionAlgorithm;
  payload: TestPayload;
  originalFileName: string;
  showAdvancedMetrics: boolean;
  onComplete: (stats: Stats) => void;
}

const AlgorithmCard: React.FC<AlgorithmCardProps> = ({ algorithm, payload, originalFileName, showAdvancedMetrics, onComplete }) => {
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
      const worker = new Worker(new URL('@/workers/compression.worker.ts', import.meta.url), { type: 'module' });
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
            decompressPhases: result.decompressPhases,
            advancedMetrics: result.advancedMetrics
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
            error: error || zhCN.compressionFailed,
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
                >{zhCN.viewLogs}</Button>
              )}
              <Button
                size="small"
                type="dashed"
                icon={<DownloadOutlined />}
                onClick={() => downloadFile(stats.compressedData!, `${originalFileName}.${stats.algorithm}`)}
              >{zhCN.downloadCompressed}</Button>
              <Button
                size="small"
                type="dashed"
                icon={<DownloadOutlined />}
                onClick={() => downloadFile(stats.decompressedData!, `decompressed_${originalFileName}`)}
              >{zhCN.downloadDecompressed}</Button>
            </Space>
          )
        }
      >
        <Spin
          spinning={stats.loading}
          indicator={<SyncOutlined spin style={{ fontSize: 24, marginBottom: 8 }} />}
          tip={
            payload.executionCount > 1 ? (
              <div style={{ width: '80%', margin: '0 auto', marginTop: 8 }}>
                <Progress
                  percent={Math.round((progress / payload.executionCount) * 100)}
                  format={() => `${zhCN.currentProgress}: ${progress}/${payload.executionCount}`}
                />
              </div>
            ) : (
              <div style={{ marginTop: 8, color: '#1890ff' }}>{zhCN.processing}</div>
            )
          }
        >
          {stats.error ? (
            <div style={{ color: 'red', padding: '40px 0', textAlign: 'center' }}>
              {zhCN.executionFailed}: {stats.error}
            </div>
          ) : (
              <Descriptions column={2} size="small" style={{ minHeight: 140 }}>
                <Descriptions.Item label={zhCN.algorithm} span={2}>
                  <Text strong ellipsis={{ tooltip: algorithmName?.description || '' }}>{algorithmName?.description || stats.algorithm}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={zhCN.originalSize}>
                  <Text strong>{formatSize(stats.originalSize)}</Text> ({stats.originalSize} B)
                </Descriptions.Item>
                <Descriptions.Item label={zhCN.compressedSize}>
                  <Text strong type="success">{formatSize(stats.compressedSize)}</Text> ({stats.compressedSize} B)
                </Descriptions.Item>
                <Descriptions.Item label={zhCN.compressionRatio}>
                  <Tag color="blue">{stats.ratio || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={zhCN.dataConsistency}>
                  {!stats.loading && stats.ratio !== '' && (
                    stats.isMatch ? <Tag color="success">{zhCN.verificationPassed}</Tag> : <Tag color="error">{zhCN.dataCorrupted}</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={zhCN.avgCompressTime}>
                  <Text type="warning">{stats.avgCompressTime.toFixed(2)} ms</Text>
                </Descriptions.Item>
                <Descriptions.Item label={zhCN.avgDecompressTime}>
                  <Text type="warning">{stats.avgDecompressTime.toFixed(2)} ms</Text>
                </Descriptions.Item>
                {stats.executionCount > 1 && (
                  <Descriptions.Item label={`${zhCN.total}${zhCN.compressionTime}`}>
                    <Text type="secondary">{stats.compressTime.toFixed(2)} ms</Text>
                  </Descriptions.Item>
                )}
                {stats.executionCount > 1 && (
                  <Descriptions.Item label={`${zhCN.total}${zhCN.decompressionTime}`}>
                    <Text type="secondary">{stats.decompressTime.toFixed(2)} ms</Text>
                  </Descriptions.Item>
                )}
            </Descriptions>
          )}
          {!stats.loading && stats.advancedMetrics && showAdvancedMetrics && (
            <AdvancedMetricsChart
              metrics={stats.advancedMetrics}
              algorithmName={algorithmName?.description || stats.algorithm}
            />
          )}
        </Spin>
      </Card>

      <LogModal
        visible={isLogModalVisible}
        onCancel={() => setIsLogModalVisible(false)}
        title={`${algorithmName?.description || stats.algorithm} ${zhCN.executionLogs}`}
        logs={stats.logs}
      />
    </>
  );
};

export default AlgorithmCard;
