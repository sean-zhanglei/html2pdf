/**
 * 设备指纹配置
 * 包含多种设备和环境指纹配置
 */

// 设备指纹配置
export const deviceFingerprints = [
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    platform: 'Win32',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en-US', 'en'],
    timezone: 'Asia/Shanghai',
    hardwareConcurrency: 8,
    deviceMemory: 8,
    colorDepth: 24,
    pixelDepth: 24,
    screenResolution: { width: 1920, height: 1080 },
    availableScreenResolution: { width: 1920, height: 1040 },
  },
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    platform: 'Win32',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en'],
    timezone: 'Asia/Shanghai',
    hardwareConcurrency: 4,
    deviceMemory: 4,
    colorDepth: 24,
    pixelDepth: 24,
    screenResolution: { width: 1366, height: 768 },
    availableScreenResolution: { width: 1366, height: 728 },
  },
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    platform: 'MacIntel',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en-US', 'en'],
    timezone: 'Asia/Shanghai',
    hardwareConcurrency: 6,
    deviceMemory: 8,
    colorDepth: 30,
    pixelDepth: 30,
    screenResolution: { width: 1440, height: 900 },
    availableScreenResolution: { width: 1440, height: 860 },
  },
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    viewport: { width: 1536, height: 864 },
    platform: 'Win32',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en-US', 'en'],
    timezone: 'Asia/Shanghai',
    hardwareConcurrency: 8,
    deviceMemory: 16,
    colorDepth: 24,
    pixelDepth: 24,
    screenResolution: { width: 1536, height: 864 },
    availableScreenResolution: { width: 1536, height: 824 },
  },
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    viewport: { width: 1280, height: 720 },
    platform: 'MacIntel',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en'],
    timezone: 'Asia/Shanghai',
    hardwareConcurrency: 4,
    deviceMemory: 8,
    colorDepth: 30,
    pixelDepth: 30,
    screenResolution: { width: 1280, height: 720 },
    availableScreenResolution: { width: 1280, height: 680 },
  },
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    platform: 'Win32',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en-US', 'en'],
    timezone: 'Asia/Shanghai',
    hardwareConcurrency: 12,
    deviceMemory: 16,
    colorDepth: 24,
    pixelDepth: 24,
    screenResolution: { width: 1920, height: 1080 },
    availableScreenResolution: { width: 1920, height: 1040 },
  },
];

// 环境指纹配置
export const environmentFingerprints = [
  {
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer:
      'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x000059A2) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    canvasFingerprint: 'normal',
    audioFingerprint: 'normal',
    fonts: [
      'Arial',
      'Arial Black',
      'Arial Narrow',
      'Calibri',
      'Cambria',
      'Cambria Math',
      'Comic Sans MS',
      'Courier New',
      'Georgia',
      'Impact',
      'Lucida Console',
      'Lucida Sans Unicode',
      'Microsoft Sans Serif',
      'Palatino Linotype',
      'Segoe UI',
      'Tahoma',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
    ],
  },
  {
    webglVendor: 'Apple Inc. (Apple)',
    webglRenderer: 'Apple GPU',
    canvasFingerprint: 'apple',
    audioFingerprint: 'apple',
    fonts: [
      'Arial',
      'Arial Black',
      'Arial Narrow',
      'Arial Rounded MT Bold',
      'Avenir',
      'Avenir Next',
      'Avenir Next Condensed',
      'Baskerville',
      'Big Caslon',
      'Bodoni 72',
      'Bodoni 72 Oldstyle',
      'Bodoni 72 Smallcaps',
      'Bradley Hand',
      'Brush Script MT',
      'Chalkboard',
      'Chalkboard SE',
      'Chalkduster',
      'Cochin',
      'Comic Sans MS',
      'Copperplate',
      'Courier',
      'Courier New',
      'Didot',
      'Futura',
      'Geneva',
      'Georgia',
      'Gill Sans',
      'Helvetica',
      'Helvetica Neue',
      'Herculanum',
      'Hoefler Text',
      'Impact',
      'Lucida Grande',
      'Luminari',
      'Marker Felt',
      'Menlo',
      'Microsoft Sans Serif',
      'Monaco',
      'Noteworthy',
      'Optima',
      'Palatino',
      'Papyrus',
      'Phosphate',
      'Rockwell',
      'Savoye LET',
      'SignPainter',
      'Skia',
      'Snell Roundhand',
      'Tahoma',
      'Times',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
      'Zapfino',
    ],
  },
  {
    webglVendor: 'Mozilla (Mozilla)',
    webglRenderer: 'Mozilla',
    canvasFingerprint: 'firefox',
    audioFingerprint: 'firefox',
    fonts: [
      'Arial',
      'Arial Black',
      'Arial Narrow',
      'Arial Rounded MT Bold',
      'Baskerville',
      'Big Caslon',
      'Bodoni MT',
      'Book Antiqua',
      'Bookman Old Style',
      'Calibri',
      'Cambria',
      'Cambria Math',
      'Century',
      'Century Gothic',
      'Century Schoolbook',
      'Comic Sans MS',
      'Consolas',
      'Constantia',
      'Corbel',
      'Courier New',
      'DejaVu Sans',
      'DejaVu Sans Mono',
      'DejaVu Serif',
      'Ebrima',
      'Franklin Gothic Medium',
      'Gabriola',
      'Garamond',
      'Georgia',
      'Impact',
      'Javanese Text',
      'Leelawadee UI',
      'Lucida Console',
      'Lucida Sans Unicode',
      'Malgun Gothic',
      'Marlett',
      'Microsoft Himalaya',
      'Microsoft JhengHei',
      'Microsoft New Tai Lue',
      'Microsoft PhagsPa',
      'Microsoft Sans Serif',
      'Microsoft Tai Le',
      'Microsoft YaHei',
      'Microsoft Yi Baiti',
      'MingLiU-ExtB',
      'Mongolian Baiti',
      'MS Gothic',
      'MS PGothic',
      'MS UI Gothic',
      'MV Boli',
      'Myanmar Text',
      'Nirmala UI',
      'Palatino Linotype',
      'Segoe Print',
      'Segoe Script',
      'Segoe UI',
      'Segoe UI Historic',
      'Segoe UI Emoji',
      'Segoe UI Symbol',
      'SimSun',
      'Sitka',
      'Sylfaen',
      'Symbol',
      'Tahoma',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
      'Webdings',
      'Wingdings',
      'Yu Gothic',
    ],
  },
];

/**
 * 获取随机设备指纹
 * @returns {Object} 设备指纹配置
 */
export function getRandomDeviceFingerprint() {
  return deviceFingerprints[
    Math.floor(Math.random() * deviceFingerprints.length)
  ];
}

/**
 * 获取随机环境指纹
 * @returns {Object} 环境指纹配置
 */
export function getRandomEnvironmentFingerprint() {
  return environmentFingerprints[
    Math.floor(Math.random() * environmentFingerprints.length)
  ];
}

/**
 * 获取匹配的设备和环境指纹
 * @param {string} deviceType - 设备类型 (windows, mac, firefox, edge)
 * @returns {Object} 匹配的指纹配置 {deviceFingerprint, environmentFingerprint}
 */
export function getMatchedFingerprints(deviceType = 'random') {
  let deviceIndex;
  let environmentIndex;

  switch (deviceType.toLowerCase()) {
    case 'windows':
      deviceIndex = Math.floor(Math.random() * 3); // 前3个是Windows
      environmentIndex = 0; // Windows环境
      break;
    case 'mac':
      deviceIndex = Math.floor(Math.random() * 2) + 2; // 第3-4个是Mac
      environmentIndex = 1; // Mac环境
      break;
    case 'firefox':
      deviceIndex = 3; // 第4个是Firefox
      environmentIndex = 2; // Firefox环境
      break;
    case 'edge':
      deviceIndex = 5; // 第6个是Edge
      environmentIndex = 0; // Windows环境
      break;
    default:
      deviceIndex = Math.floor(Math.random() * deviceFingerprints.length);
      environmentIndex = Math.floor(
        Math.random() * environmentFingerprints.length
      );
  }

  return {
    deviceFingerprint: deviceFingerprints[deviceIndex],
    environmentFingerprint: environmentFingerprints[environmentIndex],
  };
}
