import React from 'react';
import { Tabs, Input, Button, Upload, Space } from 'antd';
import { FileTextOutlined, UploadOutlined, CodeOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { TextArea } = Input;

interface InputPanelProps {
  activeTab: string;
  setActiveTab: (key: string) => void;
  textInput: string;
  setTextInput: (val: string) => void;
  fileList: UploadFile[];
  setFileList: (list: UploadFile[]) => void;
  onClearResults: () => void;
  onGenerateRandomText: () => void;
}

const InputPanel: React.FC<InputPanelProps> = ({
  activeTab,
  setActiveTab,
  textInput,
  setTextInput,
  fileList,
  setFileList,
  onClearResults,
  onGenerateRandomText
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
            <div style={{ marginTop: 16 }}>
              <Space style={{ marginBottom: 16 }}>
                <Button type="dashed" icon={<CodeOutlined />} onClick={onGenerateRandomText}>
                  生成随机长文本
                </Button>
                <Button danger onClick={() => { setTextInput(''); onClearResults(); }}>
                  清空
                </Button>
              </Space>
              <TextArea
                rows={10}
                placeholder="请输入长文本，或点击上方按钮生成随机文本"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          )
        },
        {
          key: 'file',
          label: <span><UploadOutlined /> 文件处理</span>,
          children: (
            <div style={{ marginTop: 16 }}>
              <Upload.Dragger
                maxCount={1}
                beforeUpload={() => false}
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                onRemove={() => onClearResults()}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">支持任意类型的文件进行压缩测试，由于是在浏览器内存中处理，建议文件不要超过 500MB</p>
              </Upload.Dragger>
            </div>
          )
        }
      ]}
    />
  );
};

export default InputPanel;
