import puppeteer from 'puppeteer';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import axios from 'axios';
import FormData from 'form-data';
import qwen3vlConfig from '../../config/qwen3vl.js';

const recognize = async (captchaDir, imagePath) => {
  try {
    // 替换原有的路径拼接代码
    const captchaPath = path.join(captchaDir, imagePath);
    const outImagePath = path.join(captchaDir, `out-${imagePath}`);

    // 2. 使用sharp处理图像
    let sharpImg = await sharp(captchaPath).toBuffer();
    const { width, height } = await sharp(sharpImg).metadata();

    // 裁剪参数计算
    const top = 2,
      bottom = 2,
      left = 2,
      right = 2;
    const croppedWidth = width - left - right;
    const croppedHeight = height - top - bottom;
    if (croppedWidth <= 0 || croppedHeight <= 0) {
      throw new Error('切割后的图像尺寸无效！');
    }

    // 3. 执行sharp裁剪
    sharpImg = await sharp(sharpImg)
      .extract({ top, left, width: croppedWidth, height: croppedHeight })
      .toBuffer();

    // 1. Sharp 预处理：缩放 + 去噪（关键！小图放大让字符更清晰）
    let sharpImgMax = await sharp(sharpImg)
      .resize(300, null, { kernel: sharp.kernel.nearest, fit: 'contain' }) // 放大到 300 宽，保持比例
      .median(3) // 中值滤波去噪（处理点状干扰）
      .toBuffer();

    // 4. 使用Jimp处理图像
    const image = await Jimp.read(sharpImgMax);
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];

      // 👉 优化1：动态二值化（用灰度 + 阈值分割，替代原亮度判断）
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const isBackground = gray > 180; // 背景偏亮，直接阈值分割

      if (isBackground) {
        // 3. 清除背景
        image.bitmap.data[idx] = 255;
        image.bitmap.data[idx + 1] = 255;
        image.bitmap.data[idx + 2] = 255;
      } else {
        // 4. 增强彩色字符
        const enhanceFactor = 1.5;
        image.bitmap.data[idx] = Math.min(255, r * enhanceFactor);
        image.bitmap.data[idx + 1] = Math.min(255, g * enhanceFactor);
        image.bitmap.data[idx + 2] = Math.min(255, b * enhanceFactor);

        // 5. 边缘锐化
        if (isEdgePixel(image, x, y)) {
          const edgeBoost = 1.8;
          image.bitmap.data[idx] = Math.min(255, r * edgeBoost);
          image.bitmap.data[idx + 1] = Math.min(255, g * edgeBoost);
          image.bitmap.data[idx + 2] = Math.min(255, b * edgeBoost);
        }
      }
    });

    await image.write(outImagePath);
    let sharpImgOut = await image.getBuffer('image/png');

    // 3. Tesseract 识别：针对性配置（关键！适配验证码场景）
    const worker = await createWorker('eng');
    await worker.reinitialize('eng');
    // 👉 优化5：PSM 模式设为 "单个字符行" + 字符白名单
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist:
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      tessedit_ocr_engine_mode: 1, // LSTM 引擎优先
      lstm_choice_mode: 2, // 更激进的选择模式，提高识别准确率
    });

    const {
      data: { text },
    } = await worker.recognize(sharpImgOut);
    await worker.terminate();

    // 后处理：去空格、过滤非预期字符
    let captchaText = text.replace(/\s+/g, '').trim();
    console.log('识别的验证码:', text);
    console.log('处理后的验证码:', captchaText);
    return captchaText;
  } catch (error) {
    console.error('验证码处理错误:', error);
    throw error;
  }
};

const recognizeCaptcha = async (captchaDir, imagePath = 'captcha.png') => {
  let text = await recognizeQwen3Vl(captchaDir, imagePath);
  return text;
};

// 辅助函数：判断是否边缘像素（原逻辑可保留，或替换为形态学操作）
function isEdgePixel(image, x, y) {
  if (
    x <= 1 ||
    y <= 1 ||
    x >= image.bitmap.width - 2 ||
    y >= image.bitmap.height - 2
  )
    return false;
  const idx = (y * image.bitmap.width + x) * 4;
  const center =
    image.bitmap.data[idx] +
    image.bitmap.data[idx + 1] +
    image.bitmap.data[idx + 2];
  const left =
    image.bitmap.data[idx - 4] +
    image.bitmap.data[idx - 3] +
    image.bitmap.data[idx - 2];
  const right =
    image.bitmap.data[idx + 4] +
    image.bitmap.data[idx + 5] +
    image.bitmap.data[idx + 6];
  return Math.abs(center - left) > 50 || Math.abs(center - right) > 50;
}

// 随机延迟函数
const randomDelay = (min = 500, max = 2000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 兼容性延迟函数（替代page.waitForTimeout）
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 模拟人类点击行为
async function humanClick(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });

    // 随机延迟
    await delay(randomDelay(300, 800));

    // 获取元素位置
    const element = await page.$(selector);
    const box = await element.boundingBox();

    if (!box) {
      throw new Error('元素不可见或尺寸为0');
    }

    // 随机点击位置（在元素内部）
    const clickX = box.x + Math.random() * box.width * 0.8 + box.width * 0.1;
    const clickY = box.y + Math.random() * box.height * 0.8 + box.height * 0.1;

    // 模拟鼠标移动和点击
    await page.mouse.move(clickX, clickY, {
      steps: Math.floor(Math.random() * 5) + 3,
    });
    await delay(randomDelay(100, 300));
    await page.mouse.click(clickX, clickY);

    console.log(`✅ 模拟点击元素: ${selector}`);
  } catch (error) {
    console.error(`❌ 点击元素失败: ${selector}`, error.message);
    throw error;
  }
}

// 模拟人类输入行为
async function humanType(page, selector, text, options = {}) {
  const { clear = true } = options;

  try {
    await page.waitForSelector(selector, { timeout: 5000 });

    if (clear) {
      await page.click(selector, { clickCount: 3 }); // 全选
      await page.keyboard.press('Backspace');
    }

    // 随机输入速度
    const typeDelay = Math.floor(Math.random() * 100) + 30;

    for (let i = 0; i < text.length; i++) {
      await page.type(selector, text[i], { delay: typeDelay });

      // 随机暂停（模拟思考）
      if (Math.random() < 0.1) {
        await delay(randomDelay(200, 800));
      }
    }

    console.log(`✅ 模拟输入完成: ${selector}`);
  } catch (error) {
    console.error(`❌ 输入失败: ${selector}`, error.message);
    throw error;
  }
}

// 随机页面滚动
async function randomScroll(page) {
  const scrollAmount = Math.floor(Math.random() * 500) + 100;
  const scrollDirection = Math.random() > 0.5 ? 'down' : 'up';

  if (scrollDirection === 'down') {
    await page.evaluate((amount) => {
      window.scrollBy(0, amount);
    }, scrollAmount);
  } else {
    await page.evaluate((amount) => {
      window.scrollBy(0, -amount);
    }, scrollAmount);
  }

  await delay(randomDelay(200, 600));
}

// 保持向后兼容的clickButton函数
async function clickButton(page, selector, timeout = 2000) {
  // 80%概率使用人类点击，20%概率使用快速点击
  if (Math.random() < 0.8) {
    await humanClick(page, selector, timeout);
  } else {
    try {
      await page.waitForSelector(selector, { timeout });
      await page.click(selector);
      console.log(`✅ 快速点击元素: ${selector}`);
    } catch (error) {
      console.error(`❌ 快速点击元素失败: ${selector}`, error.message);
      throw error;
    }
  }
}

async function tryLogin(page, timestamp, username, password) {
  const clearInputs = async () => {
    await page.evaluate(() => {
      const accountInput = document.querySelector('#account');
      const passwordInput = document.querySelector('#password');
      const verifyInput = document.querySelector('#verifyCode');
      if (accountInput) accountInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (verifyInput) verifyInput.value = '';
    });
    await page.waitForFunction(
      () => {
        const account = document.querySelector('#account');
        const password = document.querySelector('#password');
        const verify = document.querySelector('#verifyCode');
        return (
          (!account || account.value === '') &&
          (!password || password.value === '') &&
          (!verify || verify.value === '')
        );
      },
      { timeout: 10000 }
    );
  };

  try {
    console.log('尝试登录');

    // 清空输入框并等待
    await clearInputs();

    // 输入用户名密码（使用人类输入行为）
    await humanType(page, '#account', username, { clear: true });
    await delay(randomDelay(500, 1000));
    await humanType(page, '#password', password, { clear: true });

    // 处理验证码
    await page.waitForSelector('#verifyCode', { timeout: 10000 });

    // 随机滚动页面
    if (Math.random() < 0.7) {
      await randomScroll(page);
    }

    // Process captcha
    const element = await page.$('.ant-btn.ant-btn-image_btn');
    if (!element) throw new Error('Captcha element not found');

    // Generate captcha PNG and save locally
    const captchaDir = path.join(process.cwd(), 'temp', 'captchas');
    if (!fs.existsSync(captchaDir)) {
      fs.mkdirSync(captchaDir, { recursive: true });
    }

    const imagePath = `${timestamp}-captcha.png`;
    const captchaPath = path.join(captchaDir, imagePath);
    await element.screenshot({ path: captchaPath });

    const captchaText = await recognizeCaptcha(captchaDir, imagePath);

    // Clean up temporary captcha file immediately after recognition
    if (fs.existsSync(captchaPath)) {
      fs.unlinkSync(captchaPath);
    }

    if (!captchaText || captchaText.trim() === '') {
      throw new Error('Captcha recognition failed - empty result');
    }

    // 输入验证码（使用人类输入行为）
    await humanType(page, '#verifyCode', captchaText, { clear: true });

    // Click login button
    await clickButton(
      page,
      '.login___3SZNV > .btns___H31yA > button:nth-child(1)',
      10000
    );

    try {
      await page.waitForSelector('.user_block___2sFge', { timeout: 10000 });
      console.log('检测到登录后元素');
    } catch (elementError) {
      console.log('未检测登录后元素');
    }

    // 检查认证状态
    const isLoggedIn = await page.evaluate(() => {
      // 检查多个可能的认证指示器
      const hasToken =
        localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');
      const hasUserBlock = document.querySelector('.user_block___2sFge');
      return !!hasToken || !!hasUserBlock;
    });
    // Check if login was successful
    const token = await page.evaluate(() => localStorage.getItem('TOKEN'));
    if (isLoggedIn) {
      console.log('登录成功，TOKEN:', token);
      return true;
    } else {
      console.log('登录失败');
      return false;
    }
  } catch (error) {
    console.error('登录失败:', error);
    throw new Error('登录失败');
  }
}

// 设备指纹配置
const deviceFingerprints = [
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
const environmentFingerprints = [
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

// 代理服务器配置
const proxyConfigs = [
  // 国内代理服务器（可选）
  // {
  //   server: 'http://proxy1.example.com:8080',
  //   username: 'user',
  //   password: 'pass'
  // },
  // 更多代理服务器...
];

// 获取随机代理配置
function getRandomProxy() {
  if (proxyConfigs.length === 0) {
    return null;
  }
  return proxyConfigs[Math.floor(Math.random() * proxyConfigs.length)];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password, websiteUrl, selector, proxy } = req.body;

  console.log('Received request:', req.body);

  if (!websiteUrl || !selector) {
    return res
      .status(400)
      .json({ error: 'Missing required parameters: websiteUrl and selector' });
  }

  let browser;
  try {
    // 随机选择设备指纹
    const deviceFingerprint =
      deviceFingerprints[Math.floor(Math.random() * deviceFingerprints.length)];
    const environmentFingerprint =
      environmentFingerprints[
        Math.floor(Math.random() * environmentFingerprints.length)
      ];

    // 构建启动参数
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      `--window-size=${deviceFingerprint.viewport.width},${deviceFingerprint.viewport.height}`,
      '--enable-webgl',
      '--enable-accelerated-2d-canvas',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      // 添加IP相关配置
      '--disable-features=VizDisplayCompositor',
      '--disable-back-forward-cache',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-translate',
      '--disable-sync',
      '--metrics-recording-only',
      '--safebrowsing-disable-auto-update',
      '--disable-client-side-phishing-detection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-prompt-on-repost',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-site-isolation-trials',
      '--disable-web-resources',
      '--disable-back-forward-cache',
      '--disable-component-extensions-with-background-pages',
    ];

    // 处理代理配置
    let proxyArgs = '';
    if (proxy) {
      // 使用请求中指定的代理
      proxyArgs = `--proxy-server=${proxy}`;
    } else {
      // 随机选择代理
      const randomProxy = getRandomProxy();
      if (randomProxy) {
        if (randomProxy.username && randomProxy.password) {
          proxyArgs = `--proxy-server=${randomProxy.server} --proxy-auth=${randomProxy.username}:${randomProxy.password}`;
        } else {
          proxyArgs = `--proxy-server=${randomProxy.server}`;
        }
      }
    }

    if (proxyArgs) {
      launchArgs.push(proxyArgs);
    }

    browser = await puppeteer.launch({
      headless: true,
      // headless: false,
      args: launchArgs,
      slowMo: Math.floor(Math.random() * 50) + 50, // 随机延迟50-100ms
    });

    const page = await browser.newPage();

    // 设置完整的设备指纹
    await page.setUserAgent(deviceFingerprint.userAgent);
    await page.setViewport({
      width: deviceFingerprint.viewport.width,
      height: deviceFingerprint.viewport.height,
      deviceScaleFactor: 1,
    });

    // 设置完整的设备环境指纹
    await page.evaluateOnNewDocument(
      (device, env) => {
        // 基础设备信息
        Object.defineProperty(navigator, 'platform', {
          get: () => device.platform,
        });
        Object.defineProperty(navigator, 'language', {
          get: () => device.language,
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => device.languages,
        });
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => device.hardwareConcurrency,
        });
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => device.deviceMemory,
        });

        // 屏幕信息
        Object.defineProperty(screen, 'colorDepth', {
          get: () => device.colorDepth,
        });
        Object.defineProperty(screen, 'pixelDepth', {
          get: () => device.pixelDepth,
        });

        // 时区
        Object.defineProperty(
          Intl.DateTimeFormat().resolvedOptions(),
          'timeZone',
          {
            get: () => device.timezone,
          }
        );

        // WebGL信息
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
          if (parameter === 37445) {
            // UNMASKED_VENDOR_WEBGL
            return env.webglVendor;
          }
          if (parameter === 37446) {
            // UNMASKED_RENDERER_WEBGL
            return env.webglRenderer;
          }
          return getParameter.call(this, parameter);
        };

        // Canvas指纹
        HTMLCanvasElement.prototype.getContext = function (
          contextType,
          contextAttributes
        ) {
          const context = Object.getPrototypeOf(this).getContext.call(
            this,
            contextType,
            contextAttributes
          );
          if (contextType === '2d') {
            const getImageData = context.getImageData;
            context.getImageData = function (...args) {
              const imageData = getImageData.apply(this, args);
              // 添加轻微的随机噪声
              for (let i = 0; i < imageData.data.length; i += 4) {
                if (Math.random() < 0.01) {
                  imageData.data[i] = Math.min(
                    255,
                    imageData.data[i] + Math.floor(Math.random() * 3) - 1
                  );
                  imageData.data[i + 1] = Math.min(
                    255,
                    imageData.data[i + 1] + Math.floor(Math.random() * 3) - 1
                  );
                  imageData.data[i + 2] = Math.min(
                    255,
                    imageData.data[i + 2] + Math.floor(Math.random() * 3) - 1
                  );
                }
              }
              return imageData;
            };
          }
          return context;
        };

        // 字体检测
        Object.defineProperty(document, 'fonts', {
          value: {
            check: () => Promise.resolve(true),
            ready: Promise.resolve(),
            add: () => {},
            delete: () => {},
            clear: () => {},
            forEach: () => {},
            has: () => true,
            size: env.fonts.length,
            [Symbol.iterator]: function* () {
              for (const font of env.fonts) {
                yield font;
              }
            },
          },
        });

        // 隐藏自动化特征
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      },
      deviceFingerprint,
      environmentFingerprint
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (websiteUrl.indexOf('job.icbc.com.cn') !== -1) {
      // icbc

      // 打开首页
      await page.goto(websiteUrl);

      // 点击登录按钮
      await clickButton(
        page,
        '.login > .logout___1GdAy > .btns___34OuS > button:nth-child(1)',
        5000
      );

      // 替换原有的登录代码
      const loginSuccess = await tryLogin(page, timestamp, username, password);
      if (!loginSuccess) {
        throw new Error('登录失败');
      }

      // 登录成功后继续后续操作

      // 点击简历箭头，跳转https://job.icbc.com.cn/pc/index.html#/main/personal/resume
      await clickButton(
        page,
        '.user_block___2sFge > .block_3___1ClCH > .icon___2siAf > i',
        10000
      );

      // 点击简历详情，跳转https://job.icbc.com.cn/pc/index.html#/main/resumePreview/0
      await clickButton(
        page,
        '.item___3m969 > .item-right___2wu38 > button:nth-child(1)',
        10000
      );

      // 等待页面加载完成 开始生成PDF
      await page.waitForSelector('.live-photo___2oydI > .avatar___3v9kT', {
        timeout: 10000,
      });
    } else {
      const navigationPromiseHome = page.waitForNavigation();

      // 打开首页
      await page.goto(websiteUrl);

      await navigationPromiseHome;
    }

    // Get the element dimensions

    // 生成PDF并保存到本地
    const pdfDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const pdfFileName = `${timestamp}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFileName);

    // 获取目标元素
    await page.waitForSelector(selector, { timeout: 3000 });
    const element = await page.$(selector);
    if (!element) {
      return res.status(404).json({
        success: false,
        message: `未找到元素: ${selector}`,
      });
    }

    // 获取元素尺寸
    const box = await element.boundingBox();
    if (!box) {
      throw new Error('元素不可见或尺寸为0');
    }
    console.log('元素尺寸:', box);

    // 生成PDF并保存到本地
    const tempDir = path.join(process.cwd(), 'temp', 'images');
    // 截图并保存到临时目录
    const tempImagePath = path.join(tempDir, `${timestamp}-temp.png`);

    try {
      // 确保临时目录存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      await element.screenshot({
        path: tempImagePath,
        type: 'png',
      });

      // 转换为PDF
      // 读取截图文件
      const imageBytes = fs.readFileSync(tempImagePath);
      const pdfDoc = await PDFDocument.create();
      // 计算带边距的页面尺寸
      const margin = 20;
      // 左右边距20px
      const pageWidth = box.width + margin * 2;
      const pageHeight = box.height;

      const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
      const embeddedImage = await pdfDoc.embedPng(imageBytes);
      pdfPage.drawImage(embeddedImage, {
        x: margin,
        y: 0,
        width: box.width,
        height: box.height,
      });
      const pdfBytes = await pdfDoc.save();
      console.log('Write file:', pdfFileName);
      fs.writeFileSync(pdfPath, pdfBytes);

      // 清理临时文件
      fs.unlinkSync(tempImagePath);
    } catch (error) {
      // 错误处理
      console.error('PDF生成错误:', error);
      // 确保清理临时文件
      if (fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }
      throw error;
    }

    // 生成PDF（仅截取目标元素区域）
    // await page.pdf({
    //   path: pdfPath,
    //   printBackground: true,
    //   clip: box
    // });

    // 返回下载链接而非文件内容
    res.status(200).json({
      success: true,
      pdfUrl: `/api/download?file=${pdfFileName}`,
      message: 'PDF生成成功，请通过链接下载',
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    if (error.message.includes('Timeout')) {
      res
        .status(408)
        .json({ success: false, message: 'Timeout waiting for element' });
    } else {
      res
        .status(500)
        .json({ success: false, message: 'Failed to generate PDF' });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 新增recognizeQwen3Vl函数
const recognizeQwen3Vl = async (captchaDir, imagePath) => {
  try {
    // 1. 获取文件上传凭证
    const uploadTokenResponse = await axios.get(
      qwen3vlConfig.getApiUrl(qwen3vlConfig.api.uploadsPath),
      {
        params: qwen3vlConfig.getUploadParams(),
        headers: qwen3vlConfig.getAuthHeaders(),
      }
    );

    if (!uploadTokenResponse.data || !uploadTokenResponse.data.data) {
      throw new Error('获取上传凭证失败: 响应数据格式不正确');
    }

    const { upload_host, oss_access_key_id, policy, signature, upload_dir } =
      uploadTokenResponse.data.data;

    try {
      // 2. 上传文件至临时存储空间
      const captchaPath = path.join(captchaDir, imagePath);
      const outImagePath = path.join(captchaDir, `out-${imagePath}`);

      // 2. 使用sharp处理图像
      let sharpImg = await sharp(captchaPath).toBuffer();
      const { width, height } = await sharp(sharpImg).metadata();

      // 裁剪参数计算
      const top = 2,
        bottom = 2,
        left = 2,
        right = 2;
      const croppedWidth = width - left - right;
      const croppedHeight = height - top - bottom;
      if (croppedWidth <= 0 || croppedHeight <= 0) {
        throw new Error('切割后的图像尺寸无效！');
      }

      // 3. 执行sharp裁剪
      sharpImg = await sharp(sharpImg)
        .extract({ top, left, width: croppedWidth, height: croppedHeight })
        .toBuffer();

      // 4. 使用Jimp处理图像
      const image = await Jimp.read(sharpImg);

      await image.write(outImagePath);

      // 检查文件是否存在
      if (!fs.existsSync(outImagePath)) {
        throw new Error(`验证码图片文件不存在: ${captchaPath}`);
      }

      console.info('oss_access_key_id:', oss_access_key_id);
      console.info('policy:', policy);
      console.info('signature:', signature);
      console.info('upload_dir:', upload_dir);
      const key = upload_dir + '/' + qwen3vlConfig.upload.fileName;
      console.info('Uploading to:', upload_host);
      console.info('Upload key:', key);

      const formData = new FormData();
      formData.append('OSSAccessKeyId', oss_access_key_id);
      formData.append('policy', policy);
      formData.append('Signature', signature);
      formData.append('key', key);
      formData.append('x-oss-object-acl', 'private');
      formData.append('x-oss-forbid-overwrite', 'true');
      formData.append('success_action_status', '200');
      // 使用文件路径方式上传，与curl请求保持一致
      formData.append('file', fs.createReadStream(captchaPath), {
        filename: path.basename(captchaPath),
        contentType: 'image/png',
      });

      const uploadResponse = await axios.post(upload_host, formData, {
        timeout: qwen3vlConfig.request.timeout,
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
          Accept: '*/*',
          Host: new URL(upload_host).hostname,
          Connection: 'keep-alive',
        },
      });
      console.info('File upload response:', uploadResponse.status);
      console.info('File upload response data:', uploadResponse.data);
    } catch (uploadError) {
      console.error('File upload error:');
    }

    // 3. 使用 qwen3-vl-plus chat/completions 接口获取验证码结果
    // 构建正确的OSS URL格式
    const ossUrl = `oss://${upload_dir}/${qwen3vlConfig.upload.fileName}`;
    console.info('OSS URL:', ossUrl);

    try {
      // 尝试使用兼容OpenAI格式的API调用
      const requestData = {
        model: qwen3vlConfig.model.name,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: ossUrl,
                },
              },
              {
                type: 'text',
                text: qwen3vlConfig.captchaPrompt,
              },
            ],
          },
        ],
        temperature: 0.0,
      };

      console.info(
        'Sending chat completion request:',
        JSON.stringify(requestData, null, 2)
      );

      // 尝试使用不同的API端点
      const chatCompletionResponse = await axios.post(
        qwen3vlConfig.getApiUrl(qwen3vlConfig.api.chatCompletionsPath),
        JSON.stringify(requestData, null, 2),
        {
          headers: {
            ...qwen3vlConfig.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          timeout: qwen3vlConfig.request.timeout,
        }
      );

      if (
        !chatCompletionResponse.data.choices ||
        !chatCompletionResponse.data.choices[0]
      ) {
        throw new Error('API响应格式不正确');
      }

      console.info(
        'Chat completion response:',
        chatCompletionResponse.data.choices[0].message.content
      );

      const captchaResult =
        chatCompletionResponse.data.choices[0].message.content;

      // 使用正则表达式提取验证码（支持多种格式）
      let cleanedResult = '';

      // 响应格式```\nw190\n```
      // 使用正则表达式提取```\n和\n```之间的内容
      const regex = /```\\n(.*?)\\n```/;
      const match = captchaResult.match(regex);
      if (match && match[1]) {
        cleanedResult = match[1];
      } else {
        cleanedResult = captchaResult;
      }

      // 去除非字母数字字符
      cleanedResult = cleanedResult.replace(/[^a-zA-Z0-9]/g, '').trim();
      // 去除空格
      cleanedResult = cleanedResult.replace(/\s+/g, '');

      console.log('原始响应:', captchaResult);
      console.log('提取的验证码:', cleanedResult);

      return cleanedResult;
    } catch (apiError) {
      console.error('Chat completion API error:');
    }
  } catch (error) {
    console.error('recognizeQwen3Vl error');
  }
};

export { recognize, recognizeQwen3Vl };
