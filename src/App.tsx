/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, message, Divider } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { generateRandomText } from './utils';
import InputPanel from './components/InputPanel';
import ControlPanel from './components/ControlPanel';
import ResultBoard, { TestPayload } from './components/ResultBoard';
import { STORAGE_KEYS, DEFAULT_VALUES, CompressionAlgorithm } from '@/common';
import { zhCN } from '@/locales/zh-CN';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('text');
  const [textInput, setTextInput] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Trigger test and pass to ResultBoard
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

  const [collectLogs, setCollectLogs] = useState<boolean>(true);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHOW_ADVANCED_METRICS);
      return saved ? JSON.parse(saved) : DEFAULT_VALUES.SHOW_ADVANCED_METRICS;
    } catch {
      return DEFAULT_VALUES.SHOW_ADVANCED_METRICS;
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_ADVANCED_METRICS, JSON.stringify(showAdvancedMetrics));
  }, [showAdvancedMetrics]);

  const handleGenerateRandomText = (showMsg = true) => {
    const text = generateRandomText({ length: randomLength, randomness });
    setTextInput(text);
    if (showMsg) {
      message.success(`${zhCN.generatedRandomText} ${text.length} ${zhCN.charsRandomText} ${randomness})`);
    }
  };

  // 使用 useEffect 和 setTimeout 实现简单的防抖（Debounce）
  // 当 randomLength 或 randomness 改变时，自动生成文本
  useEffect(() => {
    // 首次加载由组件挂载时的 useEffect 处理，此处避免与初始加载冲突
    // 但因为依赖了状态，这里可以直接处理。为了避免初始两次，我们去掉下面那个空的 useEffect
    const handler = setTimeout(() => {
      handleGenerateRandomText(false); // 自动生成时不弹窗，避免消息刷屏
    }, 300); // 300ms 延迟
    return () => clearTimeout(handler);
  }, [randomLength, randomness]);

  // 注意：移除了原先的空依赖 useEffect，统一由上面的防抖 useEffect 负责初始化生成

  const processData = async (data: Uint8Array) => {
    if (algorithms.length === 0) {
      message.warning(zhCN.selectAtLeastOneAlgorithm);
      return;
    }
    
    if (executionCount < 1) {
      message.warning(zhCN.executionCountMin1);
      return;
    }
    
    // Give loading a little time to react to prevent being stuck by single-threaded synchronous logic
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Pass data to ResultBoard, each card in ResultBoard will independently respond to the change of triggerId and execute calculation
    setTestPayload({
      data,
      executionCount,
      triggerId: Date.now(),
      collectLogs
    });
    
    message.success(`${zhCN.taskDispatched} ${executionCount} ${zhCN.taskDispatchedTimes}`);
  };

  const handleRunTest = async () => {
    if (activeTab === 'text') {
      if (!textInput) {
        message.warning(zhCN.pleaseInputOrGenerateText);
        return;
      }
      setOriginalFileName('text_data.txt');
      const encoder = new TextEncoder();
      const data = encoder.encode(textInput);
      await processData(data);
    } else {
      if (fileList.length === 0 || !fileList[0].originFileObj) {
        message.warning(zhCN.pleaseUploadFileFirst);
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
        message.error(zhCN.failedToReadFile);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px #f0f1f2' }}>
        <Title level={3} style={{ margin: 0 }}>{zhCN.appTitle}</Title>
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
            collectLogs={collectLogs}
            setCollectLogs={setCollectLogs}
            showAdvancedMetrics={showAdvancedMetrics}
            setShowAdvancedMetrics={setShowAdvancedMetrics}
            loading={loading}
            onRunTest={handleRunTest}
          />

          <ResultBoard
            algorithms={algorithms}
            payload={testPayload}
            originalFileName={originalFileName}
            showAdvancedMetrics={showAdvancedMetrics}
            onAllComplete={() => setLoading(false)}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default App;
