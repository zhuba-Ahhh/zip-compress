/* eslint-disable @typescript-eslint/no-explicit-any */
import { compressData, decompressData } from '../utils/compress';
import { CompressionAlgorithm } from '../common';

export interface WorkerMessage {
  id: number;
  action: 'runTest';
  data: Uint8Array;
  algorithm: CompressionAlgorithm;
  collectLogs: boolean;
  executionCount?: number;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, action, data, algorithm, collectLogs, executionCount = 1 } = e.data;

  try {
    if (action === 'runTest') {
      let totalCompressTime = 0;
      let totalDecompressTime = 0;
      let totalMemoryUsage = 0; // MB
      let finalCompressedData: Uint8Array = new Uint8Array();
      let finalDecompressedData: Uint8Array = new Uint8Array();
      let finalIsMatch = false;
      let finalLogs: any[] | undefined = undefined;

      for (let iter = 0; iter < executionCount; iter++) {
        // Compress
        // Memory before compress
        const memBefore = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        
        // Compress
        const startCompress = performance.now();
        const compressRes = await compressData(data, algorithm, collectLogs);
        const endCompress = performance.now();
        
        // Memory after compress
        const memAfter = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        if (memAfter > memBefore) {
          totalMemoryUsage += (memAfter - memBefore) / (1024 * 1024);
        }
        totalCompressTime += (endCompress - startCompress);

        // Decompress
        const startDecompress = performance.now();
        const decompressRes = await decompressData(compressRes.data, algorithm, collectLogs);
        const endDecompress = performance.now();
        totalDecompressTime += (endDecompress - startDecompress);

        if (iter === executionCount - 1) {
          finalCompressedData = compressRes.data;
          finalDecompressedData = decompressRes.data;

          if (compressRes.logs || decompressRes.logs) {
            finalLogs = [
              ...(compressRes.logs || []).map((l: any) => ({ ...l, phase: `[压缩] ${l.phase}` })),
              ...(decompressRes.logs || []).map((l: any) => ({ ...l, phase: `[解压] ${l.phase}` }))
            ];
          }

          finalIsMatch = data.length === finalDecompressedData.length;
          if (finalIsMatch) {
            for (let i = 0; i < data.length; i++) {
              if (data[i] !== finalDecompressedData[i]) {
                finalIsMatch = false;
                break;
              }
            }
          }
        }

        // Send progress
        self.postMessage({
          id,
          type: 'progress',
          progress: iter + 1,
        });
      }

      self.postMessage({
        id,
        type: 'success',
        result: {
          totalCompressTime,
          totalDecompressTime,
          totalMemoryUsage,
          finalCompressedData,
          finalDecompressedData,
          finalIsMatch,
          finalLogs
        }
      });
    }
  } catch (error: unknown) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error in worker'
    });
  }
};
