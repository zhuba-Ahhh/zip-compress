export const STORAGE_KEYS = {
  ALGORITHMS: 'compress-ui-algorithms',
  EXECUTION_COUNT: 'compress-ui-execution-count',
  RANDOM_LENGTH: 'compress-ui-random-length',
  RANDOMNESS: 'compress-ui-randomness',
  SHOW_ADVANCED_METRICS: 'compress-ui-show-advanced-metrics',
};

export const DEFAULT_VALUES = {
  RANDOM_LENGTH: 300000,
  RANDOMNESS: 0.6,
  EXECUTION_COUNT: 1,
  ALGORITHMS: ["fflate","lz4js","pako","snappyjs"],
  SHOW_ADVANCED_METRICS: true,
};
