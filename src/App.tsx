import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, message, Divider } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { compressData, decompressData, CompressionAlgorithm, generateRandomText } from './utils';
import { Stats } from './types';
import InputPanel from './components/InputPanel';
import ControlPanel from './components/ControlPanel';
import ResultBoard from './components/ResultBoard';
import { STORAGE_KEYS, DEFAULT_VALUES } from './common';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('text');
  const [textInput, setTextInput] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statsList, setStatsList] = useState<Stats[]>([]);
  
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
    
    setLoading(true);
    setStatsList([]);
    const results: Stats[] = [];

    // Allow UI to update loading state before heavy processing
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      for (const algo of algorithms) {
        try {
          let totalCompressTime = 0;
          let totalDecompressTime = 0;
          let finalCompressedData: Uint8Array = new Uint8Array();
          let finalDecompressedData: Uint8Array = new Uint8Array();
          let finalIsMatch = false;

          for (let iter = 0; iter < executionCount; iter++) {
            // 1. Compress
            const startCompress = performance.now();
            const compressedData = await compressData(data, algo);
            const endCompress = performance.now();
            totalCompressTime += (endCompress - startCompress);

            // 2. Decompress
            const startDecompress = performance.now();
            const decompressedData = await decompressData(compressedData, algo);
            const endDecompress = performance.now();
            totalDecompressTime += (endDecompress - startDecompress);

            if (iter === executionCount - 1) {
              finalCompressedData = compressedData;
              finalDecompressedData = decompressedData;
              
              // 3. Verify on last iteration
              finalIsMatch = data.length === decompressedData.length;
              if (finalIsMatch) {
                for (let i = 0; i < data.length; i++) {
                  if (data[i] !== decompressedData[i]) {
                    finalIsMatch = false;
                    break;
                  }
                }
              }
            }
          }

          results.push({
            algorithm: algo,
            originalSize: data.length,
            compressedSize: finalCompressedData.length,
            compressTime: totalCompressTime,
            decompressTime: totalDecompressTime,
            avgCompressTime: totalCompressTime / executionCount,
            avgDecompressTime: totalDecompressTime / executionCount,
            decompressedSize: finalDecompressedData.length,
            ratio: ((finalCompressedData.length / data.length) * 100).toFixed(2) + '%',
            isMatch: finalIsMatch,
            executionCount,
            compressedData: finalCompressedData,
            decompressedData: finalDecompressedData
          });
        } catch (err: unknown) {
          results.push({
            algorithm: algo,
            originalSize: data.length,
            compressedSize: 0,
            compressTime: 0,
            decompressTime: 0,
            avgCompressTime: 0,
            avgDecompressTime: 0,
            decompressedSize: 0,
            ratio: 'N/A',
            isMatch: false,
            executionCount,
            error: (err as Error)?.message || '压缩失败'
          });
        }
      }
      setStatsList(results);
      message.success(`压缩与解压测试完成！(循环 ${executionCount} 次)`);
    } catch (error) {
      console.error(error);
      message.error('处理过程中发生未知错误');
    } finally {
      setLoading(false);
    }
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
        <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <InputPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            textInput={textInput}
            setTextInput={setTextInput}
            fileList={fileList}
            setFileList={setFileList}
            onClearResults={() => setStatsList([])}
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
            statsList={statsList}
            originalFileName={originalFileName}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default App;
