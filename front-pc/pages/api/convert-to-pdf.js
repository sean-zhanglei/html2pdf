import { BrowserManager } from '../../services/browser/BrowserManager.js';
import { HumanBehaviorSimulator } from '../../services/browser/HumanBehaviorSimulator.js';
import { PdfGenerator } from '../../services/pdf/PdfGenerator.js';
import { SessionManager } from '../../services/session/SessionManager.js';
import { LoginHandler } from '../../services/login/LoginHandler.js';
import { getMatchedFingerprints } from '../../services/browser/DeviceFingerprints.js';
// 页面元素选择器常量配置
const SELECTORS_LOGIN = {
  HOME_LOGIN_BUTTON:
    '.login > .logout___A45sf > .btns___FUP9u > button:nth-child(1)',
};

// 初始化服务实例
const browserManager = new BrowserManager();
const humanBehaviorSimulator = new HumanBehaviorSimulator();
const pdfGenerator = new PdfGenerator();
const sessionManager = new SessionManager();
const loginHandler = new LoginHandler(browserManager, humanBehaviorSimulator);

// 启动会话清理定时器
sessionManager.startCleanupTimer();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    username,
    password,
    websiteUrl,
    selector,
    sessionId,
    verificationCode,
  } = req.body;

  console.log('Received request:', req.body);

  // 如果是继续流程且有会话ID
  if (sessionId && sessionManager.isValidSession(sessionId)) {
    const session = sessionManager.getSession(sessionId);

    // 处理验证码提交
    if (verificationCode) {
      try {
        console.log(
          `继续流程，会话ID: ${sessionId}, 验证码: ${verificationCode}`
        );

        // 处理手机验证码提交
        const verificationSuccess =
          await loginHandler.handleVerificationCodeSubmit(
            session.page,
            verificationCode
          );

        if (verificationSuccess) {
          console.log('验证码验证成功，继续PDF生成流程');

          // 执行登录后操作（ICBC特定）
          if (session.websiteUrl.indexOf('job.icbc.com.cn') !== -1) {
            await loginHandler.performPostLoginActions(session.page);
          }

          // 生成PDF并返回结果
          const pdfResult = await pdfGenerator.generatePdfWithUrl(
            session.page,
            session.selector
          );

          // 删除会话（流程完成）
          sessionManager.deleteSession(sessionId);

          res.status(200).json({
            success: true,
            ...pdfResult,
            message: 'PDF生成成功，请通过链接下载',
          });
        } else {
          throw new Error('验证码验证失败');
        }
      } catch (error) {
        console.error('继续流程失败:', error);
        // 清理会话
        sessionManager.deleteSession(sessionId);
        res.status(500).json({
          success: false,
          message: '验证码验证失败，请重新开始',
        });
      }
      return;
    } else {
      return res.status(400).json({
        success: false,
        message: '缺少验证码，请提供验证码以继续',
      });
    }
  }

  // 新流程开始
  if (!websiteUrl || !selector) {
    return res
      .status(400)
      .json({ error: 'Missing required parameters: websiteUrl and selector' });
  }

  let browser;
  let page;

  try {
    // 获取随机设备指纹
    const { deviceFingerprint, environmentFingerprint } =
      getMatchedFingerprints();

    // 启动浏览器
    browser = await browserManager.launch({
      headless: true,
      launchArgs: [],
      slowMo: Math.floor(Math.random() * 50) + 50,
    });
    page = await browserManager.newPage();

    // 设置设备指纹
    await browserManager.setDeviceFingerprint(
      deviceFingerprint,
      environmentFingerprint
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // 处理ICBC网站
    if (websiteUrl.indexOf('job.icbc.com.cn') !== -1) {
      // 打开首页
      await page.goto(websiteUrl, {
        waitUntil: 'networkidle0',
      });

      await page.waitForSelector('body', { timeout: 10000 });
      console.log('页面加载完成');

      // 点击登录按钮
      await humanBehaviorSimulator.clickButton(
        page,
        SELECTORS_LOGIN.HOME_LOGIN_BUTTON,
        10000
      );

      // 处理登录
      const loginSuccess = await loginHandler.handleIcbcLogin(
        page,
        username,
        password,
        timestamp
      );

      if (!loginSuccess) {
        throw new Error('登录失败');
      }

      // 执行登录后操作
      await loginHandler.performPostLoginActions(page);
    } else {
      // 处理其他网站
      const navigationPromiseHome = page.waitForNavigation();
      await page.goto(websiteUrl);
      await navigationPromiseHome;
    }

    // 生成PDF并返回结果
    const pdfResult = await pdfGenerator.generatePdfWithUrl(page, selector);

    res.status(200).json({
      success: true,
      ...pdfResult,
      message: 'PDF生成成功，请通过链接下载',
    });
  } catch (error) {
    console.error('PDF generation error:', error);

    // 检查是否需要验证码
    if (error.message === 'NEEDS_VERIFICATION_CODE') {
      // 创建会话并保存浏览器状态
      const newSessionId = sessionManager.createSession(browser, page, {
        loginState: 'needs_verification',
        username,
        password,
        websiteUrl,
        selector,
      });

      // 不关闭浏览器，保持会话状态
      browser = null;

      res.status(200).json({
        success: false,
        needsVerification: true,
        sessionId: newSessionId,
        message: '需要输入手机验证码',
      });
    } else if (error.message.includes('Timeout')) {
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
      await browserManager.close();
    }
  }
}

// 导出服务实例供其他模块使用
export {
  browserManager,
  humanBehaviorSimulator,
  pdfGenerator,
  sessionManager,
  loginHandler,
};
