/**
 * 人类行为模拟器类
 * 负责模拟人类在网页上的各种行为，避免被检测为机器人
 */
export class HumanBehaviorSimulator {
  constructor() {
    // 初始化随机延迟范围
    this.delayRanges = {
      short: { min: 100, max: 500 },
      medium: { min: 500, max: 2000 },
      long: { min: 2000, max: 5000 },
    };
  }

  /**
   * 随机延迟函数
   * @param {number} min - 最小延迟毫秒数
   * @param {number} max - 最大延迟毫秒数
   * @returns {number} 随机延迟时间
   */
  randomDelay(min = 500, max = 2000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 兼容性延迟函数（替代page.waitForTimeout）
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 模拟人类点击行为
   * @param {Object} page - Puppeteer页面对象
   * @param {string} selector - CSS选择器
   * @param {number} timeout - 超时时间
   * @returns {Promise<void>}
   */
  async humanClick(page, selector, timeout = 10000) {
    try {
      await page.waitForSelector(selector, { timeout });

      // 随机延迟
      await this.delay(this.randomDelay(300, 800));

      // 获取元素位置
      const element = await page.$(selector);
      const box = await element.boundingBox();

      if (!box) {
        throw new Error('元素不可见或尺寸为0');
      }

      // 随机点击位置（在元素内部）
      const clickX = box.x + Math.random() * box.width * 0.8 + box.width * 0.1;
      const clickY =
        box.y + Math.random() * box.height * 0.8 + box.height * 0.1;

      // 模拟鼠标移动和点击
      await page.mouse.move(clickX, clickY, {
        steps: Math.floor(Math.random() * 5) + 3,
      });
      await this.delay(this.randomDelay(100, 300));
      await page.mouse.click(clickX, clickY);

      console.log(`✅ 模拟点击元素: ${selector}`);
    } catch (error) {
      console.error(`❌ 点击元素失败: ${selector}`, error.message);
      throw error;
    }
  }

  /**
   * 模拟人类输入行为
   * @param {Object} page - Puppeteer页面对象
   * @param {string} selector - CSS选择器
   * @param {string} text - 要输入的文本
   * @param {Object} options - 输入选项
   * @param {boolean} options.clear - 是否清空输入框
   * @returns {Promise<void>}
   */
  async humanType(page, selector, text, options = {}) {
    const { clear = true } = options;

    try {
      await page.waitForSelector(selector, { timeout: 10000 });

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
          await this.delay(this.randomDelay(200, 800));
        }
      }

      console.log(`✅ 模拟输入完成: ${selector}`);
    } catch (error) {
      console.error(`❌ 输入失败: ${selector}`, error.message);
      throw error;
    }
  }

  /**
   * 随机页面滚动
   * @param {Object} page - Puppeteer页面对象
   * @returns {Promise<void>}
   */
  async randomScroll(page) {
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

    await this.delay(this.randomDelay(200, 600));
  }

  /**
   * 保持向后兼容的点击按钮函数
   * @param {Object} page - Puppeteer页面对象
   * @param {string} selector - CSS选择器
   * @param {number} timeout - 超时时间
   * @returns {Promise<void>}
   */
  async clickButton(page, selector, timeout = 2000) {
    // 80%概率使用人类点击，20%概率使用快速点击
    if (Math.random() < 0.8) {
      await this.humanClick(page, selector, timeout);
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

  /**
   * 模拟鼠标悬停
   * @param {Object} page - Puppeteer页面对象
   * @param {string} selector - CSS选择器
   * @returns {Promise<void>}
   */
  async hover(page, selector) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });

      // 随机延迟
      await this.delay(this.randomDelay(200, 600));

      await page.hover(selector);

      // 悬停后随机延迟
      await this.delay(this.randomDelay(300, 800));

      console.log(`✅ 模拟悬停元素: ${selector}`);
    } catch (error) {
      console.error(`❌ 悬停元素失败: ${selector}`, error.message);
      throw error;
    }
  }

  /**
   * 模拟键盘操作
   * @param {Object} page - Puppeteer页面对象
   * @param {string} key - 按键名称
   * @param {Object} options - 选项
   * @param {number} options.delay - 按键延迟
   * @returns {Promise<void>}
   */
  async pressKey(page, key, options = {}) {
    const { delay: keyDelay = this.randomDelay(50, 200) } = options;

    await this.delay(keyDelay);
    await page.keyboard.press(key);

    console.log(`✅ 模拟按键: ${key}`);
  }

  /**
   * 模拟页面浏览行为
   * @param {Object} page - Puppeteer页面对象
   * @param {Object} options - 浏览选项
   * @param {number} options.scrollCount - 滚动次数
   * @param {number} options.hoverCount - 悬停次数
   * @returns {Promise<void>}
   */
  async simulateBrowsing(page, options = {}) {
    const { scrollCount = 3, hoverCount = 2 } = options;

    console.log('🔄 开始模拟页面浏览行为...');

    // 随机滚动
    for (let i = 0; i < scrollCount; i++) {
      await this.randomScroll(page);
    }

    // 随机悬停页面上的链接
    const links = await page.$$('a');
    if (links.length > 0) {
      const hoverLinks = links.slice(0, Math.min(hoverCount, links.length));
      for (const link of hoverLinks) {
        try {
          await link.hover();
          await this.delay(this.randomDelay(300, 800));
        } catch (error) {
          // 忽略悬停失败的情况
        }
      }
    }

    console.log('✅ 页面浏览行为模拟完成');
  }
}
