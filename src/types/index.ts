export type LogLevel = 'info' | 'debug' | 'warn' | 'error';

export interface CompressionLog {
  timestamp: number;
  phase: string;
  level?: LogLevel;
  message: string;
  details?: any;
}


export interface ChunkMetric {
  offset: number;     // Starting offset in original file
  originalSize: number; // Block size in bytes
  compressedSize: number; // Compressed size in bytes (can be fractional if bits)
  ratio: number;      // compressed / original
}

export interface TimeMetric {
  timeMs: number;     // Elapsed time
  processedBytes: number; // Total bytes processed at this time
  instantSpeed: number; // MB/s since last tick
}

export interface AdvancedMetrics {
  chunks: ChunkMetric[];
  timeSeries: TimeMetric[];
}

export interface PhaseTiming {
  name: string; // 阶段名称，如 "构建哈希表", "寻找匹配", "构建Huffman树", "Bitpacking"
  duration: number; // 耗时(ms)
}

export interface Stats {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressTime: number; // 总时间
  decompressTime: number; // 总时间
  avgCompressTime: number; // 平均时间
  avgDecompressTime: number; // 平均时间
  compressPhases?: PhaseTiming[]; // 压缩阶段细粒度耗时
  decompressPhases?: PhaseTiming[]; // 解压阶段细粒度耗时
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
  logs?: CompressionLog[];
  advancedMetrics?: AdvancedMetrics;
}
