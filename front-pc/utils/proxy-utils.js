import puppeteer from 'puppeteer';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');
import proxyConfig from '../config/proxy.js';

/**
 * Create a Chrome extension for proxy authentication
 * @param {string} proxyHost - Proxy host
 * @param {string|number} proxyPort - Proxy port
 * @param {string} proxyUsername - Proxy username
 * @param {string} proxyPassword - Proxy password
 * @param {string} scheme - Proxy scheme (http/https)
 * @param {string} pluginPath - Path to save the extension
 * @returns {string} Path to the created extension zip file
 */
export function createProxyAuthExtension(
  proxyHost,
  proxyPort,
  proxyUsername,
  proxyPassword,
  scheme = 'http',
  pluginPath = null
) {
  if (!pluginPath) {
    pluginPath = path.join(
      process.cwd(),
      'temp',
      'extensions',
      `${proxyUsername}_${proxyPassword}_proxyauth_plugin.zip`
    );
  }

  // 确保目录存在
  const pluginDir = path.dirname(pluginPath);
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  const manifestJson = {
    version: '1.0.0',
    manifest_version: 2,
    name: 'Chrome Proxy',
    permissions: [
      'proxy',
      'tabs',
      'unlimitedStorage',
      'storage',
      '<all_urls>',
      'webRequest',
      'webRequestBlocking',
    ],
    background: {
      scripts: ['background.js'],
    },
    minimum_chrome_version: '22.0.0',
  };

  const backgroundJs = `
    var config = {
        mode: "fixed_servers",
        rules: {
            singleProxy: {
                scheme: "${scheme}",
                host: "${proxyHost}",
                port: parseInt(${proxyPort})
            },
            bypassList: ["localhost"]
        }
    };
    chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});
    function callbackFn(details) {
        return {
            authCredentials: {
                username: "${proxyUsername}",
                password: "${proxyPassword}"
            }
        };
    }
    chrome.webRequest.onAuthRequired.addListener(
        callbackFn,
        {urls: ["<all_urls>"]},
        ['blocking']
    );
  `;

  // Create temporary directory for extension files
  const tempDir = path.join(
    process.cwd(),
    'temp',
    'extensions',
    'temp_proxy_extension'
  );
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Write manifest.json and background.js to temporary directory
  const manifestPath = path.join(tempDir, 'manifest.json');
  const backgroundPath = path.join(tempDir, 'background.js');

  fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2));
  fs.writeFileSync(backgroundPath, backgroundJs);

  // Create zip file
  const zip = new AdmZip();
  zip.addLocalFile(manifestPath);
  zip.addLocalFile(backgroundPath);
  zip.writeZip(pluginPath);

  // Clean up temporary files
  fs.unlinkSync(manifestPath);
  fs.unlinkSync(backgroundPath);
  fs.rmdirSync(tempDir);

  return pluginPath;
}

/**
 * Launch browser with proxy authentication extension
 * @param {Object} proxy - Proxy configuration object
 * @param {Object} deviceFingerprint - Device fingerprint configuration
 * @param {Array} launchArgs - Additional launch arguments
 * @returns {Promise<Object>} Puppeteer browser instance
 */
export async function launchBrowserWithProxy(
  proxy,
  deviceFingerprint,
  launchArgs = []
) {
  // 创建代理认证扩展
  const proxyAuthPluginPath = createProxyAuthExtension(
    proxy.server.split(':')[0],
    parseInt(proxy.server.split(':')[1]),
    proxyConfig.authKey,
    proxyConfig.password,
    'http'
  );

  // 构建启动参数
  const proxyLaunchArgs = [
    ...launchArgs,
    `--load-extension=${proxyAuthPluginPath}`,
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
    '--disable-features=VizDisplayCompositor',
    '--disable-back-forward-cache',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-translate',
    '--disable-sync',
    '--metrics-recording-only',
    '--safebrowsing-disable-auto-update',
    '--disable-client-side-phishing-detection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-domain-reliability',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-site-isolation-trials',
    '--disable-web-resources',
  ];

  // 启动浏览器（插件模式需要非无头模式）
  const browser = await puppeteer.launch({
    headless: false, // 扩展插件需要非无头模式
    args: proxyLaunchArgs,
    slowMo: Math.floor(Math.random() * 50) + 50, // 随机延迟50-100ms
  });

  return browser;
}

// 代理服务器配置
export const proxyConfigs = [];

// 从代理接口获取代理
export async function fetchProxyFromAPI() {
  try {
    const response = await axios.get(proxyConfig.proxy, {
      timeout: 2000,
    });
    console.log('获取代理响应:', response.data);
    if (response.data) {
      // 转为json
      let json = JSON.parse(JSON.stringify(response.data));
      console.log('获取到代理:', json.data[0].server);
      return {
        server: json.data[0].server,
      };
    }
    return null;
  } catch (error) {
    console.error('获取代理失败:', error.message);
    return null;
  }
}

// 验证代理有效性
export async function validateProxy(proxy) {
  try {
    const testUrls = ['https://test.ipw.cn'];

    for (const testUrl of testUrls) {
      try {
        console.log(`开始验证代理 ${proxy.server}..., testUrl: ${testUrl}`);
        const agent = new HttpsProxyAgent(
          `http://${proxyConfig.authKey}:${proxyConfig.password}@${
            proxy.server.split(':')[0]
          }:${parseInt(proxy.server.split(':')[1])}`
        );

        var config = {
          url: testUrl,
          httpsAgent: agent,
        };

        const testResponse = await axios.request(config);

        if (testResponse.status === 200) {
          console.log(`✅ 代理 ${proxy.server} 验证成功，代理地址: ${testUrl}`);
          return true;
        } else {
          console.log(
            `❌ 代理 ${proxy.server} 验证失败于 ${testUrl}: 状态码 ${testResponse.status}`
          );
          return false;
        }
      } catch (urlError) {
        console.log(
          `❌ 代理 ${proxy.server} 验证失败于 ${testUrl}:`,
          urlError.message
        );
        return false;
      }
    }
    return false;
  } catch (error) {
    console.log(`❌ 代理 ${proxy.server} 验证失败:`, error.message);
    return false;
  }
}

// 获取并验证代理，循环10次直到成功
export async function fetchAndValidateProxies() {
  console.log('开始获取和验证代理...');
  // 清空现有代理列表
  proxyConfigs.length = 0;
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`尝试第 ${attempt} 次获取代理...`);

    try {
      const proxy = await fetchProxyFromAPI();

      if (!proxy) {
        console.log(`❌ 第 ${attempt} 次获取代理失败`);
        continue;
      }

      console.log(`第 ${attempt} 次获取到代理: ${proxy.server}`);

      const isValid = await validateProxy(proxy);
      if (isValid) {
        proxyConfigs.push(proxy);
        console.log(`✅ 第 ${attempt} 次添加有效代理: ${proxy.server}`);
        console.log(`✅ 验证完成，找到 ${proxyConfigs.length} 个有效代理`);
        return;
      } else {
        console.log(`❌ 第 ${attempt} 次代理验证失败: ${proxy.server}`);
      }

      // 每次尝试间隔2秒
      if (attempt < maxAttempts) {
        console.log(`等待2秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ 第 ${attempt} 次添加代理出错:`, error.message);

      // 每次尝试间隔2秒
      if (attempt < maxAttempts) {
        console.log(`等待2秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  if (proxyConfigs.length === 0) {
    console.log(`❌ 经过 ${maxAttempts} 次尝试，未能获取到有效代理`);
  } else {
    console.log(`✅ 验证完成，找到 ${proxyConfigs.length} 个有效代理`);
  }
}

// 获取随机代理配置
export function getRandomProxy() {
  if (proxyConfigs.length === 0) {
    return null;
  }
  return proxyConfigs[Math.floor(Math.random() * proxyConfigs.length)];
}
