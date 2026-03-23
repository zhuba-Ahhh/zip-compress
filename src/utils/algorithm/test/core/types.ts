export type Token =
  | { type: 'literal'; value: number }
  | { type: 'match'; distance: number; length: number };

// 12 bits 最大表示 4095，且 0 被保留用作 EOF，所以实际最大有效距离是 4095
export const WINDOW_SIZE = (2 ** 12) - 1;
export const MAX_MATCH_LENGTH = (2 ** 8) - 1; // 8 bits 最大长度, 255
export const MIN_MATCH_LENGTH = 3;
