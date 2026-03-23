import React, { memo, useCallback } from 'react';
import { Tabs, Input, Button, Upload, Space, InputNumber, Slider, Typography, Row, Col } from 'antd';
import { FileTextOutlined, UploadOutlined, CodeOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { MAX_FILE_SIZE_HINT } from '@/common';
import { zhCN } from '@/locales/zh-CN';
import { useAppContext } from '@/contexts/AppContext';

const { TextArea } = Input;
const { Text } = Typography;

// ==========================================
// 1. Text Input Tab (Memoized)
// ==========================================
interface TextInputTabProps {
  onGenerateRandomText: () => void;
}

const TextInputTab = memo<TextInputTabProps>(({
  onGenerateRandomText
}) => {
  const {
    textInput,
    setTextInput,
    setTestPayload,
    randomLength,
    setRandomLength,
    randomness,
    setRandomness
  } = useAppContext();

  const handleClear = useCallback(() => {
    setTextInput('');
    setTestPayload(null);
  }, [setTextInput, setTestPayload]);

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
          <Button type="dashed" icon={<CodeOutlined />} onClick={onGenerateRandomText}>{zhCN.generateRandomText}</Button>
        </Col>
        <Col>
          <Button danger onClick={handleClear}>{zhCN.clear}</Button>
        </Col>
        <Col flex="auto">
          <Space style={{ float: 'right' }}>
            <Space>
              <Text type="secondary">{zhCN.textLength}</Text>
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
              <Text type="secondary">{zhCN.randomness}</Text>
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
        placeholder={zhCN.textInputPlaceholder}
        value={textInput}
        onChange={handleTextChange}
        style={{ fontFamily: 'monospace' }}
      />
    </div>
  );
});

// ==========================================
// 2. File Input Tab (Memoized)
// ==========================================

const FileInputTab = memo(() => {
  const { fileList, setFileList, setTestPayload } = useAppContext();

  const handleChange = useCallback(({ fileList: newFileList }: { fileList: UploadFile[] }) => {
    setFileList(newFileList);
  }, [setFileList]);

  const handleRemove = useCallback(() => {
    setTestPayload(null);
  }, [setTestPayload]);

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
        <p className="ant-upload-text">{zhCN.clickOrDragUpload}</p>
        <p className="ant-upload-hint">{zhCN.uploadHintPrefix}{MAX_FILE_SIZE_HINT}</p>
      </Upload.Dragger>
    </div>
  );
});

// ==========================================
// 3. Main Panel Component
// ==========================================
interface InputPanelProps {
  onGenerateRandomText: () => void;
}

const InputPanel: React.FC<InputPanelProps> = ({
  onGenerateRandomText,
}) => {
  const { activeTab, setActiveTab } = useAppContext();

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={[
        {
          key: 'text',
          label: <span><FileTextOutlined /> {zhCN.textProcessing}</span>,
          children: (
            <TextInputTab
              onGenerateRandomText={onGenerateRandomText}
            />
          )
        },
        {
          key: 'file',
          label: <span><UploadOutlined /> {zhCN.fileProcessing}</span>,
          children: (
            <FileInputTab />
          )
        }
      ]}
    />
  );
};

export default InputPanel;
