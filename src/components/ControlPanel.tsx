import React from 'react';
import { Space, Typography, Select, InputNumber, Button, Switch } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { ALGORITHM_OPTIONS } from '@/common';
import { zhCN } from '@/locales/zh-CN';
import { useAppContext } from '@/contexts/AppContext';

const { Text } = Typography;

interface ControlPanelProps {
  onRunTest: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onRunTest
}) => {
  const {
    algorithms,
    setAlgorithms,
    executionCount,
    setExecutionCount,
    collectLogs,
    setCollectLogs,
    showAdvancedMetrics,
    setShowAdvancedMetrics,
    loading
  } = useAppContext();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <Space orientation="vertical" align="center" size="middle">
        <Space>
          <Text strong>{zhCN.compressionAlgorithms}</Text>
          <Select 
            mode="multiple"
            allowClear
            value={algorithms} 
            onChange={setAlgorithms}
            placeholder={zhCN.selectAlgorithm}
            options={ALGORITHM_OPTIONS}
            style={{ minWidth: 350, maxWidth: 600 }}
            optionRender={(option) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>{option.data.label}</span>
                <span style={{ fontSize: '12px', color: '#888' }}>{option.data.description}</span>
              </div>
            )}
          />
        </Space>

        <Space size="large">
          <Space>
            <Text strong>{zhCN.executionCount}</Text>
            <InputNumber
              min={1}
              max={10000}
              value={executionCount}
              onChange={(val) => setExecutionCount(val || 1)}
              style={{ width: 100 }}
            />
          </Space>

          <Space>
            <Text strong>{zhCN.collectLogsLabel}</Text>
            <Switch
              checked={collectLogs}
              onChange={setCollectLogs}
              checkedChildren={zhCN.on}
              unCheckedChildren={zhCN.off}
            />
          </Space>

          <Space>
            <Text strong>高级分析</Text>
            <Switch
              checked={showAdvancedMetrics}
              onChange={setShowAdvancedMetrics}
              checkedChildren={zhCN.on}
              unCheckedChildren={zhCN.off}
            />
          </Space>
        </Space>
      </Space>

      <Button
        type="primary"
        size="large"
        icon={<SyncOutlined spin={loading} />}
        loading={loading}
        disabled={loading || algorithms.length === 0}
        onClick={onRunTest}
        style={{ minWidth: 200 }}
      >
        {loading ? zhCN.runningTest : zhCN.runCompressionDecompression}
      </Button>
    </div>
  );
};

export default ControlPanel;
