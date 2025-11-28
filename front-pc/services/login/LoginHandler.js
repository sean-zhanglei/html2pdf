import fs from 'fs';
import path from 'path';
import { TesseractRecognizer } from '../captcha/TesseractRecognizer.js';
import sharp from 'sharp';
import { Jimp } from 'jimp';
import axios from 'axios';
import FormData from 'form-data';
import qwen3vlConfig from '../../config/qwen3vl.js';

// 页面元素选择器常量配置
const SELECTORS = {
  ACCOUNT: '#account',
  PASSWORD: '#password',
  VERIFY_CODE: '#verifyCode',
  LOGIN_BUTTON: '.btns___5B4bH > button.ant-btn-primary',
  PHONE_VERIFY_CODE: '#phoneVerifyCode',
  CAPTCHA_BUTTON: '.ant-btn.ant-btn-image_btn',
  PHONE_VERIFY_CONFIRM_BUTTON: '.btns___4nzMP > button:nth-child(1)',
  USER_BLOCK: '.user_block___y8ffS',
  USER_BLOCK_ARROW:
    '.user_block___y8ffS > .block_3___KRGL8 > .icon___C9ADN > i',
  RESUME_DETAIL_BUTTON:
    '.item___TD7Ak > .item-right___-4pij > button:nth-child(1)',
  LIVE_PHOTO_AVATAR: '.live-photo___Ezp37 > .avatar___T67v7',
  ITEM_EDIT_ACTION: '.title__edit___QAL2m',
};

/**
 * 登录处理器类
 * 负责处理网站登录流程，包括验证码识别和手机验证码处理
 */
export class LoginHandler {
  constructor(browserManager, humanBehaviorSimulator) {
    this.browserManager = browserManager;
    this.humanBehaviorSimulator = humanBehaviorSimulator;
    this.captchaRecognizer = new TesseractRecognizer();
    this.captchaDir = path.join(process.cwd(), 'temp', 'captchas');
  }

  /**
   * 确保验证码目录存在
   */
  ensureCaptchaDir() {
    if (!fs.existsSync(this.captchaDir)) {
      fs.mkdirSync(this.captchaDir, { recursive: true });
    }
  }

  /**
   * 处理ICBC登录流程
   * @param {Object} page - Puppeteer页面对象
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {string} timestamp - 时间戳
   * @returns {Promise<boolean>} 是否登录成功
   */
  async handleIcbcLogin(page, username, password, timestamp) {
    try {
      console.log('开始ICBC登录流程');

      // 等待登录页面加载完成
      await this.waitForLoginPage(page);

      // 清空输入框
      await this.clearInputs(page);

      // 等待显示登录框
      await this.humanBehaviorSimulator.delay(
        this.humanBehaviorSimulator.randomDelay(5000, 10000)
      );

      // 精确匹配账户输入框
      console.log(`精确匹配账户输入框: ${SELECTORS.ACCOUNT}`);
      await page.waitForSelector(SELECTORS.ACCOUNT, { timeout: 10000 });
      await this.humanBehaviorSimulator.humanType(
        page,
        SELECTORS.ACCOUNT,
        username,
        {
          clear: true,
        }
      );
      console.log('✅ 精确匹配账户输入框成功');

      // 精确匹配密码输入框
      console.log(`精确匹配密码输入框: ${SELECTORS.PASSWORD}`);
      await page.waitForSelector(SELECTORS.PASSWORD, { timeout: 10000 });
      await this.humanBehaviorSimulator.humanType(
        page,
        SELECTORS.PASSWORD,
        password,
        {
          clear: true,
        }
      );
      console.log('✅ 精确匹配密码输入框成功');

      // 等待验证码输入框
      await page.waitForSelector(SELECTORS.VERIFY_CODE, { timeout: 10000 });

      // 随机滚动页面
      if (Math.random() < 0.7) {
        await this.humanBehaviorSimulator.randomScroll(page);
      }

      // 处理验证码
      const captchaText = await this.processCaptcha(page, timestamp);

      if (!captchaText) {
        throw new Error('验证码识别失败');
      }

      // 输入验证码
      await this.humanBehaviorSimulator.humanType(
        page,
        SELECTORS.VERIFY_CODE,
        captchaText,
        { clear: true }
      );

      // 精确匹配登录按钮
      console.log(`精确匹配登录按钮: ${SELECTORS.LOGIN_BUTTON}`);
      await page.waitForSelector(SELECTORS.LOGIN_BUTTON, {
        timeout: 10000,
      });
      await this.humanBehaviorSimulator.clickButton(
        page,
        SELECTORS.LOGIN_BUTTON,
        5000
      );
      console.log('✅ 精确匹配登录按钮成功');

      // 处理手机验证码
      const verificationResult = await this.handlePhoneVerification(page);

      if (verificationResult.needsVerification) {
        // 如果需要验证码，抛出特定错误让前端处理
        throw new Error('NEEDS_VERIFICATION_CODE');
      }

      // 检查登录状态
      const isLoggedIn = await this.checkLoginStatus(page);

      if (isLoggedIn) {
        console.log('ICBC登录成功');
        return true;
      } else {
        console.log('ICBC登录失败');
        return false;
      }
    } catch (error) {
      console.error('ICBC登录失败:', error);
      throw error;
    }
  }

  /**
   * 等待登录页面加载完成
   * @param {Object} page - Puppeteer页面对象
   */
  async waitForLoginPage(page) {
    try {
      // 等待页面基本元素加载
      await page.waitForSelector('body', { timeout: 10000 });

      // 精确匹配登录页面关键元素
      console.log('等待登录页面关键元素加载...');
      await page.waitForSelector(SELECTORS.ACCOUNT, { timeout: 10000 });
      console.log('✅ 账户输入框加载完成');

      await page.waitForSelector(SELECTORS.PASSWORD, { timeout: 10000 });
      console.log('✅ 密码输入框加载完成');

      console.log('登录页面加载完成');
    } catch (error) {
      console.error('等待登录页面加载失败:', error);
      throw error;
    }
  }

  /**
   * 清空输入框
   * @param {Object} page - Puppeteer页面对象
   */
  async clearInputs(page) {
    await page.evaluate((SELECTORS) => {
      const accountInput = document.querySelector(SELECTORS.ACCOUNT);
      const passwordInput = document.querySelector(SELECTORS.PASSWORD);
      const verifyInput = document.querySelector(SELECTORS.VERIFY_CODE);
      if (accountInput) accountInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (verifyInput) verifyInput.value = '';
    }, SELECTORS);

    await page.waitForFunction(
      (SELECTORS) => {
        const account = document.querySelector(SELECTORS.ACCOUNT);
        const password = document.querySelector(SELECTORS.PASSWORD);
        const verify = document.querySelector(SELECTORS.VERIFY_CODE);
        return (
          (!account || account.value === '') &&
          (!password || password.value === '') &&
          (!verify || verify.value === '')
        );
      },
      { timeout: 10000 },
      SELECTORS
    );
  }

  /**
   * 处理验证码
   * @param {Object} page - Puppeteer页面对象
   * @param {string} timestamp - 时间戳
   * @returns {Promise<string>} 验证码文本
   */
  async processCaptcha(page, timestamp) {
    try {
      // 确保验证码目录存在
      this.ensureCaptchaDir();

      // 获取验证码元素
      const element = await page.$(SELECTORS.CAPTCHA_BUTTON);
      if (!element) throw new Error('验证码元素未找到');

      // 生成验证码图片路径
      const imagePath = `${timestamp}-captcha.png`;
      const captchaPath = path.join(this.captchaDir, imagePath);

      // 截图验证码
      await element.screenshot({ path: captchaPath });

      // 尝试使用高级验证码识别（通义千问）
      let captchaText = await this.recognizeQwen3Vl(captchaPath);

      // 如果高级识别失败，回退到Tesseract
      if (!captchaText || captchaText.trim() === '') {
        console.log('高级验证码识别失败，回退到Tesseract');
        captchaText = await this.captchaRecognizer.recognize(captchaPath);
      }

      // 清理临时验证码文件
      if (fs.existsSync(captchaPath)) {
        fs.unlinkSync(captchaPath);
      }

      if (!captchaText || captchaText.trim() === '') {
        throw new Error('验证码识别失败 - 空结果');
      }

      console.log('验证码识别成功:', captchaText);
      return captchaText;
    } catch (error) {
      console.error('验证码处理失败:', error);
      throw error;
    }
  }

  /**
   * 使用通义千问视觉模型识别验证码
   * @param {string} captchaPath - 验证码图片路径
   * @returns {Promise<string>} 验证码文本
   */
  async recognizeQwen3Vl(captchaPath) {
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

      // 2. 上传文件至临时存储空间
      const key = upload_dir + '/' + qwen3vlConfig.upload.fileName;

      const formData = new FormData();
      formData.append('OSSAccessKeyId', oss_access_key_id);
      formData.append('policy', policy);
      formData.append('Signature', signature);
      formData.append('key', key);
      formData.append('x-oss-object-acl', 'private');
      formData.append('x-oss-forbid-overwrite', 'true');
      formData.append('success_action_status', '200');
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

      console.log('文件上传成功:', uploadResponse.status);

      // 3. 使用 qwen3-vl-plus chat/completions 接口获取验证码结果
      const ossUrl = `oss://${upload_dir}/${qwen3vlConfig.upload.fileName}`;

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

      const chatCompletionResponse = await axios.post(
        qwen3vlConfig.getApiUrl(qwen3vlConfig.api.chatCompletionsPath),
        requestData,
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

      const captchaResult =
        chatCompletionResponse.data.choices[0].message.content;

      // 使用正则表达式提取验证码
      let cleanedResult = '';
      const regex = /```\\n(.*?)\\n```/;
      const match = captchaResult.match(regex);
      if (match && match[1]) {
        cleanedResult = match[1];
      } else {
        cleanedResult = captchaResult;
      }

      // 去除非字母数字字符
      cleanedResult = cleanedResult.replace(/[^a-zA-Z0-9]/g, '').trim();
      cleanedResult = cleanedResult.replace(/\s+/g, '');

      console.log('原始响应:', captchaResult);
      console.log('提取的验证码:', cleanedResult);

      return cleanedResult;
    } catch (error) {
      console.error('通义千问验证码识别失败:', error.message);
      return '';
    }
  }

  /**
   * 处理手机验证码验证
   * @param {Object} page - Puppeteer页面对象
   * @returns {Promise<Object>} 验证结果 {needsVerification: boolean, success: boolean, verificationCode: string}
   */
  async handlePhoneVerification(page) {
    try {
      // 等待手机验证码输入框出现
      await page.waitForSelector(SELECTORS.PHONE_VERIFY_CODE, {
        timeout: 10000,
      });
      console.log('✅ 检测到手机验证码输入框');

      // 返回需要验证码的状态
      return {
        needsVerification: true,
      };
    } catch (error) {
      console.log('未检测到手机验证码输入框，继续正常流程');
      return {
        needsVerification: false,
      };
    }
  }

  /**
   * 处理手机验证码提交
   * @param {Object} page - Puppeteer页面对象
   * @param {string} verificationCode - 验证码
   * @returns {Promise<boolean>} 是否验证成功
   */
  async handleVerificationCodeSubmit(page, verificationCode) {
    try {
      console.log(`处理手机验证码提交: ${verificationCode}`);

      // 输入验证码
      await this.humanBehaviorSimulator.humanType(
        page,
        SELECTORS.PHONE_VERIFY_CODE,
        verificationCode,
        {
          clear: true,
        }
      );
      await this.humanBehaviorSimulator.delay(
        this.humanBehaviorSimulator.randomDelay(500, 1000)
      );

      // 点击确认按钮
      await this.humanBehaviorSimulator.clickButton(
        page,
        SELECTORS.PHONE_VERIFY_CONFIRM_BUTTON,
        2000
      );
      await this.humanBehaviorSimulator.delay(
        this.humanBehaviorSimulator.randomDelay(1000, 2000)
      );

      // 检查登录状态
      const isLoggedIn = await this.checkLoginStatus(page);

      if (isLoggedIn) {
        console.log('手机验证码验证成功');
        return true;
      } else {
        throw new Error('手机验证码验证失败');
      }
    } catch (error) {
      console.error('手机验证码提交失败:', error);
      throw error;
    }
  }

  /**
   * 检查登录状态
   * @param {Object} page - Puppeteer页面对象
   * @returns {Promise<boolean>} 是否已登录
   */
  async checkLoginStatus(page) {
    try {
      // 等待可能的登录后元素
      try {
        await page.waitForSelector(SELECTORS.USER_BLOCK, { timeout: 10000 });
        console.log('检测到登录后元素');
      } catch (elementError) {
        console.log('未检测到登录后元素');
      }

      // 检查认证状态
      const isLoggedIn = await page.evaluate((SELECTORS) => {
        // 检查多个可能的认证指示器
        const hasToken =
          localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');
        const hasUserBlock = document.querySelector(SELECTORS.USER_BLOCK);
        return !!hasToken || !!hasUserBlock;
      }, SELECTORS);

      // 检查token
      const token = await page.evaluate(() => localStorage.getItem('TOKEN'));

      if (isLoggedIn) {
        console.log('登录成功，TOKEN:', token);
        return true;
      } else {
        console.log('登录失败');
        return false;
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      return false;
    }
  }

  /**
   * 执行登录后操作（ICBC特定）
   * @param {Object} page - Puppeteer页面对象
   */
  async performPostLoginActions(page) {
    try {
      console.log('执行登录后操作...');

      // 点击简历箭头
      await this.humanBehaviorSimulator.clickButton(
        page,
        SELECTORS.USER_BLOCK_ARROW,
        10000
      );

      // 点击简历详情
      await this.humanBehaviorSimulator.clickButton(
        page,
        SELECTORS.RESUME_DETAIL_BUTTON,
        10000
      );

      // 等待页面加载完成
      await page.waitForSelector(SELECTORS.LIVE_PHOTO_AVATAR, {
        timeout: 10000,
      });

      // 删除class=title__edit___QAL2m的元素
      await page.evaluate((SELECTORS) => {
        const editTitleElement = document.querySelector(
          SELECTORS.ITEM_EDIT_ACTION
        );
        if (editTitleElement) {
          editTitleElement.remove();
        }
      }, SELECTORS);

      console.log('登录后操作完成');
    } catch (error) {
      console.error('登录后操作失败:', error);
      throw error;
    }
  }

  /**
   * 销毁资源
   */
  async destroy() {
    if (this.captchaRecognizer) {
      await this.captchaRecognizer.destroy();
    }
  }
}
