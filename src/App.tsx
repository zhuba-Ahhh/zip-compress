import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, message, Divider } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { generateRandomText } from './utils';
import InputPanel from './components/InputPanel';
import ControlPanel from './components/ControlPanel';
import ResultBoard, { TestPayload } from './components/ResultBoard';
import { STORAGE_KEYS, DEFAULT_VALUES, CompressionAlgorithm } from '@/common';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('text');
  const [textInput, setTextInput] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 用于触发测试并传递给 ResultBoard
  const [testPayload, setTestPayload] = useState<TestPayload | null>(null);
  
  // Initialize state from local storage if available
  const [algorithms, setAlgorithms] = useState<CompressionAlgorithm[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ALGORITHMS);
      return saved ? JSON.parse(saved) : DEFAULT_VALUES.ALGORITHMS;
    } catch {
      return DEFAULT_VALUES.ALGORITHMS;
    }
  });
  
  const [executionCount, setExecutionCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXECUTION_COUNT);
      return saved ? parseInt(saved, 10) : DEFAULT_VALUES.EXECUTION_COUNT;
    } catch {
      return DEFAULT_VALUES.EXECUTION_COUNT;
    }
  });

  const [randomLength, setRandomLength] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RANDOM_LENGTH);
      return saved ? parseInt(saved, 10) : DEFAULT_VALUES.RANDOM_LENGTH;
    } catch {
      return DEFAULT_VALUES.RANDOM_LENGTH;
    }
  });

  const [randomness, setRandomness] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);
      return saved ? parseFloat(saved) : DEFAULT_VALUES.RANDOMNESS;
    } catch {
      return DEFAULT_VALUES.RANDOMNESS;
    }
  });

  const [originalFileName, setOriginalFileName] = useState<string>('data');

  // Update local storage when state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ALGORITHMS, JSON.stringify(algorithms));
  }, [algorithms]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXECUTION_COUNT, executionCount.toString());
  }, [executionCount]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RANDOM_LENGTH, randomLength.toString());
  }, [randomLength]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RANDOMNESS, randomness.toString());
  }, [randomness]);

  const handleGenerateRandomText = () => {
    const text = generateRandomText({ length: randomLength, randomness });
    setTextInput(text);
    message.success(`已生成 ${text.length} 字符的随机文本 (随机度: ${randomness})`);
  };

  const processData = async (data: Uint8Array) => {
    if (algorithms.length === 0) {
      message.warning('请至少选择一种压缩算法');
      return;
    }
    
    if (executionCount < 1) {
      message.warning('执行次数必须大于等于1');
      return;
    }
    
    // 给 loading 稍微一点反应时间，防止被单线程同步逻辑卡住
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    // 将数据下发给 ResultBoard，ResultBoard 内的每个卡片会独立响应 triggerId 的变化并执行计算
    setTestPayload({
      data,
      executionCount,
      triggerId: Date.now()
    });

    // 稍微延迟关闭 loading，或者直接关闭，因为卡片内部有自己的 loading
    setTimeout(() => {
      setLoading(false);
      message.success(`已下发执行任务 (循环 ${executionCount} 次)`);
    }, 100);
  };

  const handleRunTest = async () => {
    if (activeTab === 'text') {
      if (!textInput) {
        message.warning('请输入或生成文本');
        return;
      }
      setOriginalFileName('text_data.txt');
      const encoder = new TextEncoder();
      const data = encoder.encode(textInput);
      await processData(data);
    } else {
      if (fileList.length === 0 || !fileList[0].originFileObj) {
        message.warning('请先上传文件');
        return;
      }
      const file = fileList[0].originFileObj;
      setOriginalFileName(file.name);
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const buffer = e.target.result as ArrayBuffer;
          const data = new Uint8Array(buffer);
          await processData(data);
        }
      };
      reader.onerror = () => {
        message.error('读取文件失败');
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px #f0f1f2' }}>
        <Title level={3} style={{ margin: 0 }}>压缩与解压性能测试工具</Title>
      </Header>
      <Content style={{ padding: '24px 50px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Card variant="borderless" style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <InputPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            textInput={textInput}
            setTextInput={setTextInput}
            fileList={fileList}
            setFileList={setFileList}
            onClearResults={() => setTestPayload(null)}
            onGenerateRandomText={handleGenerateRandomText}
            randomLength={randomLength}
            setRandomLength={setRandomLength}
            randomness={randomness}
            setRandomness={setRandomness}
          />

          <Divider />

          <ControlPanel
            algorithms={algorithms}
            setAlgorithms={setAlgorithms}
            executionCount={executionCount}
            setExecutionCount={setExecutionCount}
            loading={loading}
            onRunTest={handleRunTest}
          />

          <ResultBoard
            algorithms={algorithms}
            payload={testPayload}
            originalFileName={originalFileName}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default App;
