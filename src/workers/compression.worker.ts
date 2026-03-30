import { compressData, decompressData } from '@/utils/compress';
import { CompressionAlgorithm } from '@/common';
import { PhaseTiming } from '@/types';

/**
 * MD5 计算函数
 * 用于计算 ArrayBuffer 的 MD5 哈希值，用于验证数据一致性
 * @param buffer 要计算哈希值的 ArrayBuffer 或 SharedArrayBuffer
 * @returns 计算得到的 MD5 哈希值（十六进制字符串）
 * 注意：这是一个简化版的 MD5 实现，仅用于演示目的，实际项目中应使用更完整的实现
 */
function md5ArrayBuffer(buffer: ArrayBufferLike): string {
  // 将输入的 buffer 转换为 Uint8Array 以便逐字节处理
  const data = new Uint8Array(buffer);
  const len = data.length;
  
  // MD5 初始哈希值
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  
  // 遍历处理每个字节
  for (let i = 0; i < len; i++) {
    // 简单的哈希计算逻辑（仅用于演示）
    a = (a + data[i]) % 0x100000000;
    b = (b + a) % 0x100000000;
    c = (c + b) % 0x100000000;
    d = (d + c) % 0x100000000;
  }
  
  // 将哈希值转换为字节数组
  const bytes = [
    (a >> 24) & 0xff, (a >> 16) & 0xff, (a >> 8) & 0xff, a & 0xff,
    (b >> 24) & 0xff, (b >> 16) & 0xff, (b >> 8) & 0xff, b & 0xff,
    (c >> 24) & 0xff, (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff,
    (d >> 24) & 0xff, (d >> 16) & 0xff, (d >> 8) & 0xff, d & 0xff
  ];
  
  // 将字节数组转换为十六进制字符串并返回
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
      let totalCompressTime = 0; // 总压缩时间
      let totalDecompressTime = 0; // 总解压时间
      let totalMemoryUsage = 0; // 内存使用量（MB）
      let finalCompressedData: Uint8Array = new Uint8Array();
      let finalDecompressedData: Uint8Array = new Uint8Array();
      let finalIsMatch = false;
      let finalLogs: any[] | undefined = undefined;
      let finalCompressPhases: PhaseTiming[] | undefined = undefined;
      let finalDecompressPhases: PhaseTiming[] | undefined = undefined;
      let finalAdvancedMetrics: any = undefined;

      for (let iter = 0; iter < executionCount; iter++) {
        // 压缩前内存使用
        const memBefore = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        
        // 执行压缩
        const startCompress = performance.now();
        const compressRes = await compressData(data, algorithm, collectLogs);
        const endCompress = performance.now();
        
        // 压缩后内存使用
        const memAfter = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        if (memAfter > memBefore) {
          totalMemoryUsage += (memAfter - memBefore) / (1024 * 1024);
        }
        totalCompressTime += (endCompress - startCompress);

        // 执行解压
        const startDecompress = performance.now();
        const decompressRes = await decompressData(compressRes.data, algorithm, collectLogs);
        const endDecompress = performance.now();
        totalDecompressTime += (endDecompress - startDecompress);

        if (iter === executionCount - 1) {
          finalCompressedData = compressRes.data;
          finalDecompressedData = decompressRes.data;
          finalCompressPhases = compressRes.phases;
          finalDecompressPhases = decompressRes.phases;
          finalAdvancedMetrics = (compressRes as any).advancedMetrics;

          if (compressRes.logs || decompressRes.logs) {
            finalLogs = [
              ...(compressRes.logs || []).map((l: any) => ({ ...l, phase: `[压缩] ${l.phase}` })),
              ...(decompressRes.logs || []).map((l: any) => ({ ...l, phase: `[解压] ${l.phase}` }))
            ];
          }

          // 使用 MD5 验证数据一致性
          const originalMD5 = md5ArrayBuffer(data.buffer);
          const decompressedMD5 = md5ArrayBuffer(finalDecompressedData.buffer);
          finalIsMatch = originalMD5 === decompressedMD5;
        }

        // 发送进度信息
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
          finalLogs,
          compressPhases: finalCompressPhases,
          decompressPhases: finalDecompressPhases,
          advancedMetrics: finalAdvancedMetrics
        }
      });
    }
  } catch (error: unknown) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : 'worker 中发生未知错误'
    });
  }
};
