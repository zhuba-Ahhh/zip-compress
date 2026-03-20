import React, { memo, useCallback } from 'react';
import { Tabs, Input, Button, Upload, Space, InputNumber, Slider, Typography, Row, Col } from 'antd';
import { FileTextOutlined, UploadOutlined, CodeOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { MAX_FILE_SIZE_HINT } from '@/common';

const { TextArea } = Input;
const { Text } = Typography;

// ==========================================
// 1. 文本处理面板 (Memoized)
// ==========================================
interface TextInputTabProps {
  textInput: string;
  setTextInput: (val: string) => void;
  onClearResults: () => void;
  onGenerateRandomText: () => void;
  randomLength: number;
  setRandomLength: (val: number) => void;
  randomness: number;
  setRandomness: (val: number) => void;
}

const TextInputTab = memo<TextInputTabProps>(({
  textInput,
  setTextInput,
  onClearResults,
  onGenerateRandomText,
  randomLength,
  setRandomLength,
  randomness,
  setRandomness
}) => {
  const handleClear = useCallback(() => {
    setTextInput('');
    onClearResults();
  }, [setTextInput, onClearResults]);

  const handleLengthChange = useCallback((val: number | null) => {
    setRandomLength(val || 300000);
  }, [setRandomLength]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
  }, [setTextInput]);

  return (
    <div style={{ marginTop: 16 }}>
      <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button type="dashed" icon={<CodeOutlined />} onClick={onGenerateRandomText}>
            生成随机长文本
          </Button>
        </Col>
        <Col>
          <Button danger onClick={handleClear}>
            清空
          </Button>
        </Col>
        <Col flex="auto">
          <Space style={{ float: 'right' }}>
            <Space>
              <Text type="secondary">文本长度:</Text>
              <InputNumber
                min={10}
                max={10000000}
                step={10000}
                value={randomLength}
                onChange={handleLengthChange}
                style={{ width: 120 }}
              />
            </Space>
            <Space style={{ marginLeft: 16 }}>
              <Text type="secondary">随机度 (0-1):</Text>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={randomness}
                onChange={setRandomness}
                style={{ width: 100, display: 'inline-block', verticalAlign: 'middle', margin: '0 8px' }}
              />
              <Text>{randomness}</Text>
            </Space>
          </Space>
        </Col>
      </Row>
      <TextArea
        rows={10}
        placeholder="请输入长文本，或点击上方按钮生成随机文本"
        value={textInput}
        onChange={handleTextChange}
        style={{ fontFamily: 'monospace' }}
      />
    </div>
  );
});

// ==========================================
// 2. 文件处理面板 (Memoized)
// ==========================================
interface FileInputTabProps {
  fileList: UploadFile[];
  setFileList: (list: UploadFile[]) => void;
  onClearResults: () => void;
}

const FileInputTab = memo<FileInputTabProps>(({
  fileList,
  setFileList,
  onClearResults
}) => {
  const handleChange = useCallback(({ fileList: newFileList }: { fileList: UploadFile[] }) => {
    setFileList(newFileList);
  }, [setFileList]);

  const handleRemove = useCallback(() => {
    onClearResults();
  }, [onClearResults]);

  return (
    <div style={{ marginTop: 16 }}>
      <Upload.Dragger
        maxCount={1}
        beforeUpload={() => false}
        fileList={fileList}
        onChange={handleChange}
        onRemove={handleRemove}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持任意类型的文件进行压缩测试，由于是在浏览器内存中处理，建议文件不要超过 {MAX_FILE_SIZE_HINT}</p>
      </Upload.Dragger>
    </div>
  );
});

// ==========================================
// 3. 主面板组件
// ==========================================
interface InputPanelProps {
  activeTab: string;
  setActiveTab: (key: string) => void;
  textInput: string;
  setTextInput: (val: string) => void;
  fileList: UploadFile[];
  setFileList: (list: UploadFile[]) => void;
  onClearResults: () => void;
  onGenerateRandomText: () => void;
  randomLength: number;
  setRandomLength: (val: number) => void;
  randomness: number;
  setRandomness: (val: number) => void;
}

const InputPanel: React.FC<InputPanelProps> = ({
  activeTab,
  setActiveTab,
  textInput,
  setTextInput,
  fileList,
  setFileList,
  onClearResults,
  onGenerateRandomText,
  randomLength,
  setRandomLength,
  randomness,
  setRandomness
}) => {
  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={[
        {
          key: 'text',
          label: <span><FileTextOutlined /> 文本处理</span>,
          children: (
            <TextInputTab
              textInput={textInput}
              setTextInput={setTextInput}
              onClearResults={onClearResults}
              onGenerateRandomText={onGenerateRandomText}
              randomLength={randomLength}
              setRandomLength={setRandomLength}
              randomness={randomness}
              setRandomness={setRandomness}
            />
          )
        },
        {
          key: 'file',
          label: <span><UploadOutlined /> 文件处理</span>,
          children: (
            <FileInputTab
              fileList={fileList}
              setFileList={setFileList}
              onClearResults={onClearResults}
            />
          )
        }
      ]}
    />
  );
};

export default InputPanel;
