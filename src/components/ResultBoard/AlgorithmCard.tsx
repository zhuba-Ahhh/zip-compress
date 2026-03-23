import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Typography, Tag, Space, Button, Spin, Progress, Tooltip } from 'antd';
import { DownloadOutlined, SyncOutlined, FileTextOutlined } from '@ant-design/icons';
import { Stats, CompressionLog } from '../../types';
import { formatSize, downloadFile, compressData, decompressData } from '../../utils';
import { ALGORITHM_OPTIONS, CompressionAlgorithm } from '@/common';
import LogModal from './LogModal';
import { TestPayload } from './index';

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

      // 稍微延迟让 UI 有时间渲染 loading 状态
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        let totalCompressTime = 0;
        let totalDecompressTime = 0;
        let finalCompressedData: Uint8Array = new Uint8Array();
        let finalDecompressedData: Uint8Array = new Uint8Array();
        let finalIsMatch = false;
        let finalLogs: CompressionLog[] | undefined = undefined;

        for (let iter = 0; iter < payload.executionCount; iter++) {
          if (isCancelled) return;

          // 1. Compress
          const startCompress = performance.now();
          const compressRes = await compressData(payload.data, algorithm, payload.collectLogs);
          const endCompress = performance.now();
          totalCompressTime += (endCompress - startCompress);

          // 2. Decompress
          const startDecompress = performance.now();
          const decompressRes = await decompressData(compressRes.data, algorithm, payload.collectLogs);
          const endDecompress = performance.now();
          totalDecompressTime += (endDecompress - startDecompress);

          if (iter === payload.executionCount - 1) {
            finalCompressedData = compressRes.data;
            finalDecompressedData = decompressRes.data;

            // 合并日志
            if (compressRes.logs || decompressRes.logs) {
              finalLogs = [
                ...(compressRes.logs || []).map(l => ({ ...l, phase: `[压缩] ${l.phase}` })),
                ...(decompressRes.logs || []).map(l => ({ ...l, phase: `[解压] ${l.phase}` }))
              ];
            }

            // 3. Verify on last iteration
            finalIsMatch = payload.data.length === finalDecompressedData.length;
            if (finalIsMatch) {
              for (let i = 0; i < payload.data.length; i++) {
                if (payload.data[i] !== finalDecompressedData[i]) {
                  finalIsMatch = false;
                  break;
                }
              }
            }
          }

          // 给主线程喘息的机会，并更新进度
          if (iter % 5 === 0 || iter === payload.executionCount - 1) {
            setProgress(iter + 1);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        if (isCancelled) return;

        const finalStats: Stats = {
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
          logs: finalLogs,
        };
        setStats(finalStats);
        onComplete(finalStats);

      } catch (err: unknown) {
        if (isCancelled) return;
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
          error: (err as Error)?.message || '压缩失败',
          loading: false,
        };
        setStats(errorStats);
        onComplete(errorStats);
      }
    };

    runTest();

    return () => {
      isCancelled = true;
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
