import React from 'react';
import { Space, Typography, Select, InputNumber, Button } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { CompressionAlgorithm } from '../utils/compress';

const { Text } = Typography;

interface ControlPanelProps {
  algorithms: CompressionAlgorithm[];
  setAlgorithms: (algos: CompressionAlgorithm[]) => void;
  executionCount: number;
  setExecutionCount: (count: number) => void;
  loading: boolean;
  onRunTest: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  algorithms,
  setAlgorithms,
  executionCount,
  setExecutionCount,
  loading,
  onRunTest
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <Space align="center" size="large">
        <Space>
          <Text strong>压缩算法:</Text>
          <Select 
            mode="multiple"
            allowClear
            value={algorithms} 
            onChange={setAlgorithms}
            placeholder="请选择压缩算法"
            options={[
              { value: 'pako', label: 'pako (zlib)' },
              { value: 'lz-string', label: 'lz-string (LZW)' },
              { value: 'myzip', label: 'myzip (自定义压缩)' },
              { value: 'lz77', label: 'lz77 (自定义LZ77)' },
            ]}
            style={{ minWidth: 250 }}
          />
        </Space>
        
        <Space>
          <Text strong>执行次数:</Text>
          <InputNumber 
            min={1} 
            max={10000} 
            value={executionCount} 
            onChange={(val) => setExecutionCount(val || 1)} 
            style={{ width: 100 }}
          />
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
        {loading ? '正在执行测试...' : '执行压缩与解压'}
      </Button>
    </div>
  );
};

export default ControlPanel;
