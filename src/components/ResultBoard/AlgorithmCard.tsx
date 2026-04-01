/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, memo } from 'react';
import { Card, Descriptions, Typography, Tag, Space, Button, Spin, Progress, Tooltip } from 'antd';
import { DownloadOutlined, SyncOutlined, FileTextOutlined } from '@ant-design/icons';
import { Stats } from '@/types';
import { formatSize, downloadFile } from '@/utils';
import { ALGORITHM_OPTIONS, CompressionAlgorithm } from '@/common';
import LogModal from './LogModal';
import AdvancedMetricsChart from './AdvancedMetricsChart';
import { zhCN } from '@/locales/zh-CN';
import { WorkerMessage } from '@/workers/compression.worker';
import { useAppContext } from '@/contexts/AppContext';
import styles from './AlgorithmCard.module.less';

const { Text } = Typography;

// ==========================================
// 1. Loading Indicator Component
// ==========================================
const LoadingIndicator = memo(({
  loading,
  progress,
  executionCount
}: {
  loading: boolean,
  progress: number,
  executionCount: number
}) => {
  if (!loading) return null;

  return (
    <>
      <SyncOutlined spin style={{ fontSize: 24, marginBottom: 8, color: '#1890ff' }} />
      {executionCount > 1 ? (
        <Progress
          percent={Math.round((progress / executionCount) * 100)}
          format={() => (
            <div style={{ color: '#1890ff', fontSize: 12 }}>
              {`${zhCN.currentProgress}: ${progress}/${executionCount}`}
            </div>
          )}
          status="active"
          size="small"
          strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
        />
      ) : (
        <div style={{ color: '#1890ff', fontSize: 12 }}>{zhCN.processing}</div>
      )}
    </>
  );
});

// ==========================================
// 2. Action Buttons Component
// ==========================================
const ActionButtons = memo(({
  stats,
  originalFileName,
  onShowLogs
}: {
  stats: Stats,
  originalFileName: string,
  onShowLogs: () => void
}) => {
  if (stats.loading || !stats.compressedData || stats.error) return null;

  return (
    <Space size="small">
      {stats.logs && (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<FileTextOutlined />}
          onClick={onShowLogs}
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
  );
});

// ==========================================
// 3. Stats Descriptions Component
// ==========================================
const StatsDescriptions = memo(({ stats, algorithmDescription }: { stats: Stats, algorithmDescription: string }) => {
  if (stats.error) {
    return (
      <div style={{ color: 'red', padding: '40px 0', textAlign: 'center' }}>
        {zhCN.executionFailed}: {stats.error}
      </div>
    );
  }

  return (
    <Descriptions column={2} size="small" style={{ minHeight: 140 }}>
        <Descriptions.Item label={zhCN.algorithm} span={2}>
          <Text strong ellipsis={{ tooltip: algorithmDescription }}>{algorithmDescription}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={zhCN.originalSize}>
          <Text strong>{formatSize(stats.originalSize)}</Text> <Text type="secondary" style={{ fontSize: 11 }}>({stats.originalSize} B)</Text>
        </Descriptions.Item>
        <Descriptions.Item label={zhCN.compressedSize}>
          <Text strong type="success">{formatSize(stats.compressedSize)}</Text> <Text type="secondary" style={{ fontSize: 11 }}>({stats.compressedSize} B)</Text>
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
        {stats.score && (
          <>
            <Descriptions.Item label="总分" span={2}>
              <Tag color={stats.score.total > 8 ? "success" : stats.score.total < 5 ? "error" : "blue"} style={{ fontSize: 14, padding: '0 8px' }}>
                {stats.score.total.toFixed(2)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="压缩率得分">
              <Text>{stats.score.ratioScore.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="压缩速度得分">
              <Text>{stats.score.compressScore.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="解压速度得分">
              <Text>{stats.score.decompressScore.toFixed(2)}</Text>
            </Descriptions.Item>
          </>
        )}
        {stats.executionCount > 1 && (
          <>
            <Descriptions.Item label={`${zhCN.total}${zhCN.compressionTime}`}>
              <Text type="secondary">{stats.compressTime.toFixed(2)} ms</Text>
            </Descriptions.Item>
            <Descriptions.Item label={`${zhCN.total}${zhCN.decompressionTime}`}>
              <Text type="secondary">{stats.decompressTime.toFixed(2)} ms</Text>
            </Descriptions.Item>
          </>
        )}
      </Descriptions>
  );
});

export interface AlgorithmCardProps {
  algorithm: CompressionAlgorithm;
  onComplete: (stats: Stats) => void;
}

const AlgorithmCard: React.FC<AlgorithmCardProps> = ({ algorithm, onComplete }) => {
  const { testPayload: payload, originalFileName, showAdvancedMetrics } = useAppContext();

  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState(0);
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!payload) return;
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
            ratio: (((payload.data.length - result.finalCompressedData.length) / payload.data.length) * 100).toFixed(2) + '%',
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

      worker.postMessage({
        id: payload.triggerId,
        action: 'runTest',
        data: payload.data,
        algorithm,
        collectLogs: payload.collectLogs,
        executionCount: payload.executionCount
      } as WorkerMessage);
    };

    runTest();

    return () => {
      isCancelled = true;
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [algorithm, payload]);

  if (!stats) return null;

  const algorithmInfo = ALGORITHM_OPTIONS.find(item => item.value === stats.algorithm);
  const algorithmDescription = algorithmInfo?.description || stats.algorithm;

  return (
    <>
      <Card
        type="inner"
        title={
          <Tooltip title={algorithmDescription}>
            <Tag color="processing">{stats.algorithm}</Tag>
          </Tooltip>
        }
        style={{ background: '#fafafa', height: '100%' }}
        extra={
          <ActionButtons
            stats={stats}
            originalFileName={originalFileName}
            onShowLogs={() => setIsLogModalVisible(true)}
          />
        }
      >
        <Spin 
          spinning={!!stats.loading}
          className={styles.spin}
          indicator={<LoadingIndicator loading={!!stats.loading} progress={progress} executionCount={payload?.executionCount || 1} />}
        >
          <StatsDescriptions stats={stats} algorithmDescription={algorithmDescription} />

          {!stats.loading && stats.advancedMetrics && showAdvancedMetrics && (
            <AdvancedMetricsChart
              metrics={stats.advancedMetrics}
              algorithmName={algorithmDescription}
            />
          )}
        </Spin>
      </Card>

      <LogModal
        visible={isLogModalVisible}
        onCancel={() => setIsLogModalVisible(false)}
        title={`${algorithmDescription} ${zhCN.executionLogs}`}
        logs={stats.logs}
      />
    </>
  );
};

export default AlgorithmCard;

