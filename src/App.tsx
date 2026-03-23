/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';
import { Layout, Typography, Card, message, Divider } from 'antd';
import { generateRandomText } from './utils';
import InputPanel from './components/InputPanel';
import ControlPanel from './components/ControlPanel';
import ResultBoard from './components/ResultBoard';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { zhCN } from '@/locales/zh-CN';

const { Header, Content } = Layout;
const { Title } = Typography;

const AppContent: React.FC = () => {
  const {
    activeTab,
    textInput, setTextInput,
    fileList,
    setLoading,
    setTestPayload,
    algorithms,
    executionCount,
    randomLength,
    randomness,
    collectLogs,
    setOriginalFileName
  } = useAppContext();

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
    const handler = setTimeout(() => {
      handleGenerateRandomText(false); // 自动生成时不弹窗，避免消息刷屏
    }, 300); // 300ms 延迟
    return () => clearTimeout(handler);
  }, [randomLength, randomness]);

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
          <InputPanel onGenerateRandomText={handleGenerateRandomText} />
          <Divider />
          <ControlPanel onRunTest={handleRunTest} />
          <ResultBoard />
        </Card>
      </Content>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
