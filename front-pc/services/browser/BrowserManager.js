import puppeteer from 'puppeteer';

/**
 * 浏览器管理器类
 * 负责浏览器的生命周期管理、设备指纹配置和应用
 */
export class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * 启动浏览器
   * @param {Object} options - 启动选项
   * @param {boolean} options.headless - 是否无头模式
   * @param {Array} options.launchArgs - 启动参数
   * @param {number} options.slowMo - 延迟毫秒数
   * @returns {Promise<Object>} 浏览器实例
   */
  async launch(options = {}) {
    const {
      headless = true,
      launchArgs = [],
      slowMo = Math.floor(Math.random() * 50) + 50,
    } = options;

    const defaultArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
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
      '--disable-extensions',
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

    const args = [...defaultArgs, ...launchArgs];

    this.browser = await puppeteer.launch({
      headless,
      args,
      slowMo,
    });

    return this.browser;
  }

  /**
   * 创建新页面
   * @returns {Promise<Object>} 页面实例
   */
  async newPage() {
    if (!this.browser) {
      throw new Error('浏览器未启动，请先调用 launch() 方法');
    }

    this.page = await this.browser.newPage();
    return this.page;
  }

  /**
   * 设置设备指纹
   * @param {Object} deviceFingerprint - 设备指纹配置
   * @param {Object} environmentFingerprint - 环境指纹配置
   */
  async setDeviceFingerprint(deviceFingerprint, environmentFingerprint) {
    if (!this.page) {
      throw new Error('页面未创建，请先调用 newPage() 方法');
    }

    // 设置用户代理和视窗
    await this.page.setUserAgent(deviceFingerprint.userAgent);
    await this.page.setViewport({
      width: deviceFingerprint.viewport.width,
      height: deviceFingerprint.viewport.height,
      deviceScaleFactor: 1,
    });

    // 设置完整的设备环境指纹
    await this.page.evaluateOnNewDocument(
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
  }

  /**
   * 导航到指定URL
   * @param {string} url - 目标URL
   * @param {Object} options - 导航选项
   * @returns {Promise<void>}
   */
  async goto(url, options = {}) {
    if (!this.page) {
      throw new Error('页面未创建，请先调用 newPage() 方法');
    }

    const defaultOptions = {
      waitUntil: 'networkidle0',
      timeout: 30000,
    };

    await this.page.goto(url, { ...defaultOptions, ...options });
  }

  /**
   * 等待选择器出现
   * @param {string} selector - CSS选择器
   * @param {Object} options - 等待选项
   * @returns {Promise<Object>} 元素句柄
   */
  async waitForSelector(selector, options = {}) {
    if (!this.page) {
      throw new Error('页面未创建，请先调用 newPage() 方法');
    }

    const defaultOptions = {
      timeout: 10000,
    };

    return await this.page.waitForSelector(selector, {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * 获取当前页面
   * @returns {Object} 页面实例
   */
  getPage() {
    return this.page;
  }

  /**
   * 关闭浏览器
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * 检查浏览器是否已启动
   * @returns {boolean}
   */
  isLaunched() {
    return this.browser !== null;
  }
}
