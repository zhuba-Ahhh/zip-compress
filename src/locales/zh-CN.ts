export const zhCN = {
  algorithm: '算法',
  originalSize: '原始大小',
  compressedSize: '压缩后大小',
  compressionRatio: '压缩比率',
  avgCompressTime: '平均压缩耗时',
  avgDecompressTime: '平均解压耗时',
  dataConsistency: '数据一致性',
  verificationPassed: '校验通过',
  dataCorrupted: '数据损坏',
  viewLogs: '查看日志',
  downloadCompressed: '下载压缩文件',
  downloadDecompressed: '下载解压文件',
  processing: '正在处理中...',
  executionFailed: '执行失败',
  currentProgress: '当前进度',
  total: '总计',
  executionLogs: '执行日志',
  compressionFailed: '压缩失败',

  // LogModal keys
  expandDebugData: '展开调试数据',
  lz77ScanStats: 'LZ77 扫描统计',
  totalTokens: '总 Token 数',
  independentChars: '独立字符 (Literal)',
  dictionaryMatches: '字典匹配 (Match)',
  longestMatchLen: '最长匹配长度',
  avgMatchLen: '平均匹配长度',
  hashCollisions: '哈希链表碰撞次数',
  impactsAddressing: '影响寻址性能',
  stageCompressionRatio: '本阶段压缩率估算',
  
  huffmanTreeAnalysis: '动态 Huffman 树分析',
  independentCharSetSize: '独立字符集大小',
  treeMaxDepth: '树最大深度',
  avgCodeLength: '平均编码长度',
  original8Bits: '原为 8 bits',
  top5CharsAndCodes: '频率最高的前5个字符及对应编码',
  freq: '频次',
  code: '编码',
  
  bitpackingStats: '位流封装统计 (Bitpacking)',
  writeLiteralCount: '写入 Literal 数量',
  writeMatchCount: '写入 Match 数量',
  serializeTreeHeaderOverhead: '序列化树头部开销',
  
  finalCompressionReport: '最终压缩报告',
  originalVolume: '原始体积',
  compressedVolume: '压缩体积',
  savedSpace: '节约空间',
  
  restoredDictSize: '成功还原字典集大小',
  decodeResults: '解码结果',
  decodeLiteralCount: '解码 Literal 次数',
  decodeMatchCount: '解码 Match 次数',
  totalBytesWritten: '写入字节总数',
  matchedText: '匹配文本',
  
  noMatchingLogs: '没有匹配的日志记录。',


  // ResultBoard keys
  testResultsComparison: '测试结果对比',
  loopTimes: '循环',
  times: '次',


  // PerformanceChart keys
  compressionRatioLowerIsBetter: '压缩率(越小越好)',
  compressionSpeedHigherIsBetter: '压缩速度(越快越好)',
  decompressionSpeedHigherIsBetter: '解压速度(越快越好)',
  
  phaseInit: '初始化',
  phaseLZ77Pass1: 'LZ77匹配(Pass 1)',
  phaseBuildHuffman: '构建Huffman树',
  phaseBuildTreeAndEncode: '构建树与编码',
  phaseBitstreamPass2: '位流编码与输出(Pass 2)',
  phaseBitstreamPack: '位流封装',
  
  phaseHuffmanRebuild: 'Huffman重建',
  phaseBitstreamDecode: '位流解码输出',
  phaseDecode: '解码',
  phaseDecompressComplete: '解压完成',
  
  performanceEvaluation: '📊 多维性能评估与对比',
  showRadarChart: '显示综合雷达图:',
  compressionPhase: '压缩阶段:',
  decompressionPhase: '解压阶段:',
  
  radarChartTitle: '综合性能雷达图',
  radarChartDesc: '归一化分数 (0-100)，面积越大/越靠外代表综合表现越好',
  
  compressLifecycleTitle: '🧬 压缩生命周期耗时拆解 (ms)',
  compressLifecycleDesc: '展示压缩算法内部各个步骤的具体耗时分布',
  
  decompressLifecycleTitle: '🔓 解压生命周期耗时拆解 (ms)',
  decompressLifecycleDesc: '展示解压算法内部各个步骤的具体耗时分布',
  
  compressionRatioComparison: '📉 压缩比率对比 (%)',
  shorterIsBetter: '柱子越短越好',
  compressionRatioPercent: '压缩比率(%)',
  
  throughputComparison: '⚡️ 吞吐量对比 (MB/s)',
  longerIsBetter: '柱子越长越好',
  compressionSpeed: '压缩速度',
  decompressionSpeed: '解压速度',
  
  avgTimeComparison: '⏱ 平均耗时对比 (ms)',
  smallerIsBetter: '越小越好',
  compressionTime: '压缩耗时',
  decompressionTime: '解压耗时',


  // InputPanel keys
  generateRandomText: '生成随机长文本',
  clear: '清空',
  textLength: '文本长度:',
  randomness: '随机度 (0-1):',
  textInputPlaceholder: '请输入长文本，或点击上方按钮生成随机文本',
  clickOrDragUpload: '点击或拖拽文件到此区域上传',
  uploadHintPrefix: '支持任意类型的文件进行压缩测试，由于是在浏览器内存中处理，建议文件不要超过 ',
  textProcessing: '文本处理',
  fileProcessing: '文件处理',


  // ControlPanel keys
  compressionAlgorithms: '压缩算法:',
  selectAlgorithm: '请选择压缩算法',
  executionCount: '执行次数:',
  collectLogsLabel: '收集日志:',
  on: '开',
  off: '关',
  runningTest: '正在执行测试...',
  runCompressionDecompression: '执行压缩与解压',


  // App keys
  generatedRandomText: '已生成',
  charsRandomText: '字符的随机文本 (随机度:',
  selectAtLeastOneAlgorithm: '请至少选择一种压缩算法',
  executionCountMin1: '执行次数必须大于等于1',
  taskDispatched: '已下发执行任务 (循环',
  taskDispatchedTimes: '次)',
  pleaseInputOrGenerateText: '请输入或生成文本',
  pleaseUploadFileFirst: '请先上传文件',
  failedToReadFile: '读取文件失败',
  appTitle: '压缩与解压性能测试工具',


  // Algorithm core log keys
  algoInitStartEncode: '开始编码',
  algoEncodeComplete: '编码大小',
  algoEofMarker: '写入 EOF 标记',
  
  algoInitStartDecode: '开始解码',
  algoDecodeMatchAppled: '应用匹配',
  algoDecodeComplete: '解压结束。匹配数:',
  algoDecodeLiterals: '字面量数',

  algoHuffmanTreeBuild: 'Huffman建树',
  algoHuffmanTreeSuccess: '动态 Huffman 树构建成功',
  algoHuffmanTreeRebuild: 'Huffman重建',
  algoHuffmanTreeReadSuccess: '动态 Huffman 树读取成功',
  
  algoLz77StartMatch: '开始哈希链表匹配',
  algoLz77FoundMatch: '找到匹配',
  algoLz77MatchDist: '距离',
  algoLz77MatchLen: '长度',
  algoLz77MatchPos: '位置',
  algoLz77SkipDetails: '为避免日志过多，后续匹配将不再详细记录...',

};

export default zhCN;
