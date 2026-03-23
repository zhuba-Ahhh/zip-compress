export interface CompressionLog {
  timestamp: number;
  phase: string;
  message: string;
  details?: any;
}

export interface Stats {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressTime: number; // 总时间
  decompressTime: number; // 总时间
  avgCompressTime: number; // 平均时间
  avgDecompressTime: number; // 平均时间
  compressThroughput?: number; // 压缩吞吐量 MB/s
  decompressThroughput?: number; // 解压吞吐量 MB/s
  memoryUsage?: number; // 内存消耗 (MB)
  decompressedSize: number;
  ratio: string;
  isMatch: boolean;
  error?: string;
  executionCount: number;
  // Store raw data for downloading
  compressedData?: Uint8Array;
  decompressedData?: Uint8Array;
  loading?: boolean;
  logs?: CompressionLog[]; // 新增日志数组
}
