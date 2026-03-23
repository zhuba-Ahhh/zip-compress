import React, { useState } from 'react';
import { Modal, Timeline, Typography, Collapse, Tag, Space, Radio, Divider } from 'antd';
import { InfoCircleOutlined, BugOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { CompressionLog, LogLevel } from '@/types';
import { formatSize } from '@/utils';
import { zhCN } from '@/locales/zh-CN';

const { Text } = Typography;
const { Panel } = Collapse;

export interface LogModalProps {
  visible: boolean;
  onCancel: () => void;
  title: string;
  logs?: CompressionLog[];
}

const LogModal: React.FC<LogModalProps> = ({ visible, onCancel, title, logs }) => {
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');

  const filteredLogs = logs?.filter(log => filterLevel === 'all' || log.level === filterLevel) || [];

  const getLevelColor = (level?: LogLevel) => {
    switch (level) {
      case 'debug': return 'default';
      case 'info': return 'processing';
      case 'warn': return 'warning';
      case 'error': return 'error';
      default: return 'processing';
    }
  };

  const getLevelIcon = (level?: LogLevel) => {
    switch (level) {
      case 'debug': return <BugOutlined />;
      case 'info': return <InfoCircleOutlined />;
      case 'warn': return <WarningOutlined />;
      case 'error': return <CloseCircleOutlined />;
      default: return <InfoCircleOutlined />;
    }
  };

  const renderDetails = (details: any) => {
    if (!details) return null;

    // Helper function to pick out standard keys so we don't render them in the generic JSON block
    const standardKeys = [
      'matchedString', 'topSymbols', 'totalTokens', 'literals', 'matches', 
      'longestMatchLen', 'avgMatchLen', 'hashCollisions', 'compressionRatioLZ77', 
      'uniqueSymbolsFound', 'maxTreeDepth', 'avgCodeLength',
      'encodedLiterals', 'encodedMatches', 'treeHeaderSize',
      'originalBytes', 'compressedBytes', 'savedBytes',
      'restoredUniqueSymbols', 'decodedLiterals', 'decodedMatches', 'bytesWritten', 'currentPos'
    ];

    const hasStandardMetrics = standardKeys.some(key => details[key] !== undefined);
    const otherKeys = Object.keys(details).filter(key => !standardKeys.includes(key));

    return (
      <Collapse ghost size="small" style={{ marginTop: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 6 }}>
        <Panel header={<Text type="secondary" style={{ fontSize: 12 }}>🔍 {zhCN.expandDebugData}</Text>} key="1">
          <div style={{ fontSize: '12px', overflowX: 'auto' }}>
            
            {/* --- LZ77 Pass 1 Metrics --- */}
            {details.totalTokens !== undefined && (
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>📈 {zhCN.lz77ScanStats}</Text>
                <Space direction="vertical" size={2} style={{ display: 'flex', background: '#fff', padding: 8, borderRadius: 4, border: '1px dashed #d9d9d9' }}>
                  <Text><Text type="secondary">{zhCN.totalTokens}:</Text> {details.totalTokens.toLocaleString()}</Text>
                  <Text><Text type="secondary">{zhCN.independentChars}:</Text> {details.literals.toLocaleString()}</Text>
                  <Text><Text type="secondary">{zhCN.dictionaryMatches}:</Text> {details.matches.toLocaleString()}</Text>
                  <Text><Text type="secondary">{zhCN.longestMatchLen}:</Text> {details.longestMatchLen} bytes</Text>
                  {details.avgMatchLen !== undefined && <Text><Text type="secondary">{zhCN.avgMatchLen}:</Text> {details.avgMatchLen} bytes</Text>}
                  {details.hashCollisions !== undefined && <Text><Text type="secondary">{zhCN.hashCollisions}:</Text> {details.hashCollisions.toLocaleString()} <Text type="secondary" style={{fontSize: 10}}>({zhCN.impactsAddressing})</Text></Text>}
                  {details.compressionRatioLZ77 && <Text><Text type="secondary">{zhCN.stageCompressionRatio}:</Text> <Text type="success" strong>{details.compressionRatioLZ77}</Text></Text>}
                </Space>
              </div>
            )}

            {/* --- Huffman Tree Metrics --- */}
            {details.uniqueSymbolsFound !== undefined && (
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>🌳 {zhCN.huffmanTreeAnalysis}</Text>
                <Space direction="vertical" size={2} style={{ display: 'flex', background: '#fff', padding: 8, borderRadius: 4, border: '1px dashed #d9d9d9' }}>
                  <Text><Text type="secondary">{zhCN.independentCharSetSize}:</Text> {details.uniqueSymbolsFound}</Text>
                  <Text><Text type="secondary">{zhCN.treeMaxDepth}:</Text> {details.maxTreeDepth}</Text>
                  {details.avgCodeLength !== undefined && <Text><Text type="secondary">{zhCN.avgCodeLength}:</Text> <Text type="success" strong>{details.avgCodeLength} bits</Text> <Text type="secondary" style={{fontSize: 10}}>({zhCN.original8Bits})</Text></Text>}
                </Space>
              </div>
            )}

            {details.topSymbols && (
              <div style={{ marginBottom: '12px' }}>
                <Text type="secondary" strong>{zhCN.top5CharsAndCodes}:</Text>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', background: '#fff', padding: '8px 8px 8px 24px', borderRadius: 4, border: '1px dashed #d9d9d9' }}>
                  {details.topSymbols.map((s: { symbol: string, freq: number, codeStr: string, bitLength: number }, i: number) => (
                    <li key={i}>
                      <Text code>{s.symbol}</Text> : {zhCN.freq} {s.freq.toLocaleString()}, {zhCN.code} <Text code style={{ color: '#1890ff' }}>{s.codeStr}</Text> ({s.bitLength} bits)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* --- Bitpacking Metrics --- */}
            {details.encodedLiterals !== undefined && (
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>📦 {zhCN.bitpackingStats}</Text>
                <Space direction="vertical" size={2} style={{ display: 'flex', background: '#fff', padding: 8, borderRadius: 4, border: '1px dashed #d9d9d9' }}>
                  <Text><Text type="secondary">{zhCN.writeLiteralCount}:</Text> {details.encodedLiterals.toLocaleString()}</Text>
                  <Text><Text type="secondary">{zhCN.writeMatchCount}:</Text> {details.encodedMatches.toLocaleString()}</Text>
                  {details.treeHeaderSize && <Text><Text type="secondary">{zhCN.serializeTreeHeaderOverhead}:</Text> {details.treeHeaderSize}</Text>}
                </Space>
              </div>
            )}

            {/* --- Final Result Metrics --- */}
            {details.originalBytes !== undefined && (
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>✅ {zhCN.finalCompressionReport}</Text>
                <Space direction="vertical" size={2} style={{ display: 'flex', background: '#f6ffed', padding: 8, borderRadius: 4, border: '1px solid #b7eb8f' }}>
                  <Text><Text type="secondary">{zhCN.originalVolume}:</Text> {formatSize(details.originalBytes)} ({details.originalBytes.toLocaleString()} B)</Text>
                  <Text><Text type="secondary">{zhCN.compressedVolume}:</Text> <Text type="success" strong>{formatSize(details.compressedBytes)} ({details.compressedBytes.toLocaleString()} B)</Text></Text>
                  <Text><Text type="secondary">{zhCN.savedSpace}:</Text> <Text type="success">{formatSize(details.savedBytes)}</Text></Text>
                </Space>
              </div>
            )}

            {/* --- Decompression Metrics --- */}
            {details.restoredUniqueSymbols !== undefined && (
              <Text><Text type="secondary">{zhCN.restoredDictSize}:</Text> {details.restoredUniqueSymbols}</Text>
            )}
            
            {details.decodedLiterals !== undefined && (
              <div style={{ marginBottom: 12, marginTop: 8 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>🔓 {zhCN.decodeResults}</Text>
                <Space direction="vertical" size={2} style={{ display: 'flex', background: '#fff', padding: 8, borderRadius: 4, border: '1px dashed #d9d9d9' }}>
                  <Text><Text type="secondary">{zhCN.decodeLiteralCount}:</Text> {details.decodedLiterals.toLocaleString()}</Text>
                  <Text><Text type="secondary">{zhCN.decodeMatchCount}:</Text> {details.decodedMatches.toLocaleString()}</Text>
                  <Text><Text type="secondary">{zhCN.totalBytesWritten}:</Text> {details.bytesWritten.toLocaleString()}</Text>
                </Space>
              </div>
            )}

            {/* General String Match Display (if any) */}
            {details.matchedString && (
              <div style={{ marginBottom: '4px' }}>
                <Text type="secondary">{zhCN.matchedText}: </Text>
                <Text code style={{ color: '#eb2f96' }}>{details.matchedString}</Text>
              </div>
            )}

            {/* Fallback for unhandled properties */}
            {otherKeys.length > 0 && (
              <>
                {hasStandardMetrics && <Divider style={{ margin: '8px 0' }} />}
                <pre style={{ margin: 0, padding: 8, background: '#f5f5f5', borderRadius: 4, fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(
                    Object.fromEntries(otherKeys.map(k => [k, details[k]])),
                    null,
                    2
                  )}
                </pre>
              </>
            )}
          </div>
        </Panel>
      </Collapse>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <span>{title}</span>
          <Radio.Group 
            size="small" 
            value={filterLevel} 
            onChange={e => setFilterLevel(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="all">All</Radio.Button>
            <Radio.Button value="info">Info</Radio.Button>
            <Radio.Button value="debug">Debug</Radio.Button>
            <Radio.Button value="error">Error</Radio.Button>
          </Radio.Group>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={900}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingTop: 24 } }}
    >
      {filteredLogs && filteredLogs.length > 0 ? (
        <Timeline
          items={filteredLogs.map((log, index) => ({
            color: log.phase.includes('[压缩]') ? 'blue' : 'green',
            dot: getLevelIcon(log.level),
            children: (
              <div style={{ paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Tag color={getLevelColor(log.level)} bordered={false}>{log.level?.toUpperCase() || 'INFO'}</Tag>
                  <Text strong>{log.phase}</Text> 
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    +{index === 0 ? '0.00' : (log.timestamp - filteredLogs[index - 1].timestamp).toFixed(2)}ms 
                    <span style={{ marginLeft: 4, color: '#bfbfbf' }}>(总计 {(log.timestamp - filteredLogs[0].timestamp).toFixed(2)}ms)</span>
                  </Text>
                </div>
                <div style={{ color: '#595959' }}>{log.message}</div>
                {renderDetails(log.details)}
              </div>
            )
          }))}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          {zhCN.noMatchingLogs}
        </div>
      )}
    </Modal>
  );
};

export default LogModal;
