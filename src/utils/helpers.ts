import { RANDOM_TEXT_CHARS } from '../common';

export const generateRandomText = ({ length = 300000, randomness = 0.6 } = {}): string => {
  const chars = RANDOM_TEXT_CHARS;
  let result = '';
  // According to randomness, we might repeat characters or pick new ones
  let lastChar = '';
  for (let i = 0; i < length; i++) {
      if (Math.random() > randomness && lastChar) {
          result += lastChar;
      } else {
          lastChar = chars.charAt(Math.floor(Math.random() * chars.length));
          result += lastChar;
      }
  }
  return result;
};

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const downloadFile = (data: Uint8Array, filename: string): void => {
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
