export interface Stats {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressTime: number; // 总时间
  decompressTime: number; // 总时间
  avgCompressTime: number; // 平均时间
  avgDecompressTime: number; // 平均时间
  decompressedSize: number;
  ratio: string;
  isMatch: boolean;
  error?: string;
  executionCount: number;
  // Store raw data for downloading
  compressedData?: Uint8Array;
  decompressedData?: Uint8Array;
}
