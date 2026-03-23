import React from 'react';
import { Modal, Timeline, Typography, Collapse } from 'antd';
import { CompressionLog } from '../../types';

const { Text } = Typography;
const { Panel } = Collapse;

export interface LogModalProps {
  visible: boolean;
  onCancel: () => void;
  title: string;
  logs?: CompressionLog[];
}

const LogModal: React.FC<LogModalProps> = ({ visible, onCancel, title, logs }) => {
  return (
    <Modal
      title={title}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={900}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      {logs && logs.length > 0 ? (
        <Timeline
          items={logs.map((log, index) => ({
            color: log.phase.includes('[压缩]') ? 'blue' : 'green',
            children: (
              <div>
                <Text strong>{log.phase}</Text> <Text type="secondary" style={{ fontSize: '12px' }}>+{index === 0 ? 0 : (log.timestamp - logs![0].timestamp).toFixed(2)}ms</Text>
                <div style={{ marginTop: 4 }}>{log.message}</div>
                {log.details && (
                  <Collapse ghost size="small" style={{ marginTop: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                    <Panel header={<Text type="secondary" style={{ fontSize: 12 }}>查看详细信息</Text>} key="1">
                      <div style={{
                        fontSize: '12px',
                        overflowX: 'auto'
                      }}>
                        {log.details.matchedString && (
                          <div style={{ marginBottom: '4px' }}>
                            <Text type="secondary">匹配文本: </Text>
                            <Text code style={{ color: '#eb2f96' }}>{log.details.matchedString}</Text>
                          </div>
                        )}
                        {log.details.topSymbols && (
                          <div style={{ marginBottom: '8px' }}>
                            <Text type="secondary" strong>频率最高的字符及编码:</Text>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                              {log.details.topSymbols.map((s: { symbol: string, freq: number, codeStr: string, bitLength: number }, i: number) => (
                                <li key={i}>
                                  <Text code>{s.symbol}</Text> : 频率 {s.freq}, 编码 <Text code style={{ color: '#1890ff' }}>{s.codeStr}</Text> ({s.bitLength} bits)
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* 其他通用对象的渲染 */}
                        {Object.entries(log.details).filter(([key]) => !['matchedString', 'topSymbols'].includes(key)).length > 0 && (
                          <pre style={{ margin: 0, fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(
                              Object.fromEntries(Object.entries(log.details).filter(([key]) => !['matchedString', 'topSymbols'].includes(key))),
                              null,
                              2
                            )}
                          </pre>
                        )}
                      </div>
                    </Panel>
                  </Collapse>
                )}
              </div>
            )
          }))}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          当前算法暂无详细日志输出。
        </div>
      )}
    </Modal>
  );
};

export default LogModal;
