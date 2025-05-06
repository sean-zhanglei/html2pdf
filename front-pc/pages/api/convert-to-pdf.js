import puppeteer from 'puppeteer';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

const recognizeCaptcha = async (page, selector, imagePath = 'captcha.png') => {
  try {
    // 1. 截图并读取初始图像
    const element = await page.$(selector);
    if (!element) throw new Error('Captcha element not found');

    // 生成captchas png 并保存到本地
    const captchaDir = path.join(process.cwd(), 'temp', 'captchas');
    if (!fs.existsSync(captchaDir)) {
      fs.mkdirSync(captchaDir, { recursive: true });
    }

    // 替换原有的路径拼接代码
    const captchaPath = path.join(captchaDir, imagePath);
    const outImagePath = path.join(captchaDir, `out-${imagePath}`);

    await element.screenshot({ path: captchaPath });

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
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];

      // 1. 计算亮度和色度
      const brightness = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);

      // 2. 背景检测（浅灰色特征）
      const isBackground = brightness > 180 && chroma < 30;

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
    sharpImg = await image.getBuffer('image/png');

    // 5. 使用tesseract识别
    const worker = await createWorker('eng');
    const {
      data: { text },
    } = await worker.recognize(sharpImg, 'eng');
    await worker.terminate();
    console.log('识别的验证码:', text);
    const captchaText = text.replace(/\s+/g, ''); // 去除空格
    console.log('处理后的验证码:', captchaText);
    return captchaText;
  } catch (error) {
    console.error('验证码处理错误:', error);
    throw error;
  }
};

// 边缘检测辅助函数
function isEdgePixel(image, x, y) {
  if (
    x <= 1 ||
    y <= 1 ||
    x >= image.bitmap.width - 2 ||
    y >= image.bitmap.height - 2
  )
    return false;

  // 简单梯度检测
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

async function clickButton(page, selector, timeout = 2000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    console.log(`✅ Clicked on element: ${selector}`);
  } catch (error) {
    console.error(`❌ Failed to click element: ${selector}`, error.message);
    throw error;
  }
}

async function tryLogin(page, timestamp, username, password, maxAttempts = 2) {
  let attempts = 0;

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
      { timeout: 2000 }
    );
  };

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`尝试登录 (第 ${attempts} 次)`);

      // 清空输入框并等待
      await clearInputs();

      // 输入用户名密码
      await page.type('#account', username, { delay: 100, clear: true });
      await page.type('#password', password, { delay: 100, clear: true });

      // 处理验证码
      await page.waitForSelector('#verifyCode', { timeout: 2000 });

      const captchaText = await recognizeCaptcha(
        page,
        '.ant-btn.ant-btn-image_btn',
        'captcha' + timestamp + '.png'
      );

      // 输入验证码并点击登录
      await page.type('#verifyCode', captchaText, { delay: 100, clear: true });
      await clickButton(
        page,
        '.login___3SZNV > .btns___H31yA > button:nth-child(1)',
        2000
      );

      // 检查是否登录成功
      const token = await page.evaluate(() => localStorage.getItem('TOKEN'));
      if (token) {
        console.log('登录成功，TOKEN:', token);
        return true;
      } else {
        console.log('登录失败，TOKEN未找到');
        await clearInputs(); // 登录失败后清空输入框
      }
    } catch (error) {
      console.error(`登录尝试 ${attempts} 失败:`, error);
      if (attempts >= maxAttempts) throw error;
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password, websiteUrl, selector } = req.body;

  console.log('Received request:', req.body);

  if (!websiteUrl || !selector) {
    return res
      .status(400)
      .json({ error: 'Missing required parameters: websiteUrl and selector' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      // headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--window-size=2000,3600',
      ],
      slowMo: 100, // 减慢操作速度（单位：毫秒），便于观察
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 2000, // 设置视口宽度
      height: 3600, // 设置视口高度
      deviceScaleFactor: 1,
    });

    // 🚀 设置自定义请求头
    // await page.setExtraHTTPHeaders({
    //   'Authorization': 'Bearer ' + token,
    //   'LoginWay': '1',
    //   'UserId': userId,
    //   'ZoneNo': zoneNo
    // });

    // 设置响应拦截器
    // page.on('response', async (response) => {
    //   console.log('Response URL:', response.url());
    //   if (response.url().includes('job.icbc.com.cn/icbc/trmo')) {
    //     console.log('Matching response URL:', response.url());
    //     let headers = response.headers();
    //     let token = headers['token'];
    //     headers['ZoneNo'] && (N = headers['ZoneNo']), token && (headers['UserId'] && await le(headers['UserId']), await F(token)), response;
    //   }
    // });

    // async function F(e) {
    //   console.log("set token", e);
    //   // 设置 localStorage
    //   await page.emulate((e) => {
    //     localStorage.setItem("TOKEN", e);
    //   }, e);

    //   // 设置 sessionStorage
    //   await page.evaluate((e) => {
    //     sessionStorage.setItem("TOKEN", e);
    //   }, e);
    // }

    // async function X(e) {
    //   console.log("set ZoneNo", e);
    //   // 设置 localStorage
    //   await page.emulate((e) => {
    //     localStorage.setItem("ZoneFlag", e);
    //   }, e);

    //   // 设置 sessionStorage
    //   await page.evaluate((e) => {
    //     sessionStorage.setItem("ZoneFlag", e);
    //   }, e);

    //   await page.setExtraHTTPHeaders({
    //     'ZoneFlag': e
    //   });
    // }
    // async function le(e) {
    //   console.log("set Id", e);
    //   O = e, await X(O.substr(0, 2)),

    //   // 设置 localStorage
    //   await page.emulate((e) => {
    //     localStorage.setItem("ID", e);
    //   }, e);

    //   // 设置 sessionStorage
    //   await page.evaluate((e) => {
    //     sessionStorage.setItem("ID", e)
    //   }, e);
    // }

    // 清空 sessionStorage
    // await page.evaluate(() => {
    //   sessionStorage.clear();
    // });

    // 清空 localStorage
    // await page.evaluate(() => {
    //   localStorage.clear();
    // });

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
      const loginSuccess = await tryLogin(
        page,
        timestamp,
        username,
        password,
        1
      );
      if (!loginSuccess) {
        throw new Error('登录失败，已达最大重试次数');
      }

      // 登录成功后继续后续操作

      // 点击简历箭头，跳转https://job.icbc.com.cn/pc/index.html#/main/personal/resume
      await clickButton(
        page,
        '.user_block___2sFge > .block_3___1ClCH > .icon___2siAf > i',
        2000
      );

      // 点击简历详情，跳转https://job.icbc.com.cn/pc/index.html#/main/resumePreview/0
      await clickButton(
        page,
        '.item___3m969 > .item-right___2wu38 > button:nth-child(1)',
        2000
      );

      // 等待页面加载完成 开始生成PDF
      await page.waitForSelector('.live-photo___2oydI > .avatar___3v9kT', {
        timeout: 3000,
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
