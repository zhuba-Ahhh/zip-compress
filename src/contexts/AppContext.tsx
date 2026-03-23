/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { STORAGE_KEYS, DEFAULT_VALUES, CompressionAlgorithm } from '@/common';

interface TestPayload {
  data: Uint8Array;
  executionCount: number;
  triggerId: number;
  collectLogs: boolean;
}

interface AppContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  textInput: string;
  setTextInput: (text: string) => void;
  fileList: UploadFile[];
  setFileList: (files: UploadFile[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  testPayload: TestPayload | null;
  setTestPayload: (payload: TestPayload | null) => void;
  algorithms: CompressionAlgorithm[];
  setAlgorithms: (algos: CompressionAlgorithm[]) => void;
  executionCount: number;
  setExecutionCount: (count: number) => void;
  randomLength: number;
  setRandomLength: (length: number) => void;
  randomness: number;
  setRandomness: (randomness: number) => void;
  collectLogs: boolean;
  setCollectLogs: (collect: boolean) => void;
  showAdvancedMetrics: boolean;
  setShowAdvancedMetrics: (show: boolean) => void;
  originalFileName: string;
  setOriginalFileName: (name: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<string>('text');
  const [textInput, setTextInput] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [testPayload, setTestPayload] = useState<TestPayload | null>(null);

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

  return (
    <AppContext.Provider
      value={{
        activeTab, setActiveTab,
        textInput, setTextInput,
        fileList, setFileList,
        loading, setLoading,
        testPayload, setTestPayload,
        algorithms, setAlgorithms,
        executionCount, setExecutionCount,
        randomLength, setRandomLength,
        randomness, setRandomness,
        collectLogs, setCollectLogs,
        showAdvancedMetrics, setShowAdvancedMetrics,
        originalFileName, setOriginalFileName
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
