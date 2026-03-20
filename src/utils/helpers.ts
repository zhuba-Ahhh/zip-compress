/* eslint-disable @typescript-eslint/ban-ts-comment */
export const generateRandomText = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
  const words = [
    '中文测试数据随机生成', '中文测试数据', '随机生成', 'Hello World!', 'function()', 'console.log',
    'return true;', 'import React', '<div></div>', '1234567890',
    'This is a test.', 'Repeating data...'
  ];

  let result = '';
  const targetLength = 100000 + Math.floor(Math.random() * 500000); // 100k to 600k chars

  while (result.length < targetLength) {
    const r = Math.random();
    
    if (r < 0.1) {
      // 10% 概率：插入一段高重复度的词句（至少重复 2 次，词长至少为 4）
      const word = words[Math.floor(Math.random() * words.length)];
      const repeatCount = 2 + Math.floor(Math.random() * 15); // 重复 2 到 16 次
      result += word.repeat(repeatCount);
    } else if (r < 0.4) {
      // 30% 概率：插入随机生成的至少 4 个字符的连续相同字符
      const singleChar = chars.charAt(Math.floor(Math.random() * chars.length));
      const repeatCount = 4 + Math.floor(Math.random() * 20); // 至少 4 个字符
      result += singleChar.repeat(repeatCount);
    } else {
      // 60% 概率：插入一段纯随机的短字符串（长度 4 到 20）
      const randomLen = 4 + Math.floor(Math.random() * 16);
      let randomChunk = '';
      for (let i = 0; i < randomLen; i++) {
        randomChunk += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      result += randomChunk;
    }
  }

  // 截断到目标长度
  return result.slice(0, targetLength);
};

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const downloadFile = (data: Uint8Array, filename: string): void => {
  // @ts-expect-error
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
