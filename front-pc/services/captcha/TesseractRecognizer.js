import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { CaptchaRecognizer } from './CaptchaRecognizer.js';

/**
 * Tesseract OCR 验证码识别器
 */
export class TesseractRecognizer extends CaptchaRecognizer {
  constructor(options = {}) {
    super(options);
    this.worker = null;
  }

  /**
   * 初始化 Tesseract worker
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.worker) {
      this.worker = await createWorker('eng');
      await this.worker.reinitialize('eng');

      // 设置识别参数
      await this.worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist:
          '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tessedit_ocr_engine_mode: 1, // LSTM 引擎优先
        lstm_choice_mode: 2, // 更激进的选择模式，提高识别准确率
      });
    }
  }

  /**
   * 预处理验证码图片
   * @param {string} imagePath - 原始图片路径
   * @param {Object} options - 预处理选项
   * @returns {Promise<string>} 处理后的图片路径
   */
  async preprocessImage(imagePath, options = {}) {
    try {
      const outImagePath = path.join(
        path.dirname(imagePath),
        `processed-${path.basename(imagePath)}`
      );

      // 使用sharp处理图像
      let sharpImg = await sharp(imagePath).toBuffer();
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

      // 执行sharp裁剪
      sharpImg = await sharp(sharpImg)
        .extract({ top, left, width: croppedWidth, height: croppedHeight })
        .toBuffer();

      // Sharp 预处理：缩放 + 去噪
      let sharpImgMax = await sharp(sharpImg)
        .resize(300, null, { kernel: sharp.kernel.nearest, fit: 'contain' })
        .median(3) // 中值滤波去噪
        .toBuffer();

      // 使用Jimp处理图像
      const image = await Jimp.read(sharpImgMax);

      image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
        const r = image.bitmap.data[idx];
        const g = image.bitmap.data[idx + 1];
        const b = image.bitmap.data[idx + 2];

        // 动态二值化
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const isBackground = gray > 180;

        if (isBackground) {
          // 清除背景
          image.bitmap.data[idx] = 255;
          image.bitmap.data[idx + 1] = 255;
          image.bitmap.data[idx + 2] = 255;
        } else {
          // 增强彩色字符
          const enhanceFactor = 1.5;
          image.bitmap.data[idx] = Math.min(255, r * enhanceFactor);
          image.bitmap.data[idx + 1] = Math.min(255, g * enhanceFactor);
          image.bitmap.data[idx + 2] = Math.min(255, b * enhanceFactor);

          // 边缘锐化
          if (this.isEdgePixel(image, x, y)) {
            const edgeBoost = 1.8;
            image.bitmap.data[idx] = Math.min(255, r * edgeBoost);
            image.bitmap.data[idx + 1] = Math.min(255, g * edgeBoost);
            image.bitmap.data[idx + 2] = Math.min(255, b * edgeBoost);
          }
        }
      });

      await image.write(outImagePath);
      return outImagePath;
    } catch (error) {
      console.error('验证码图片预处理失败:', error);
      throw error;
    }
  }

  /**
   * 判断是否边缘像素
   * @param {Object} image - Jimp图像对象
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {boolean} 是否为边缘像素
   */
  isEdgePixel(image, x, y) {
    if (
      x <= 1 ||
      y <= 1 ||
      x >= image.bitmap.width - 2 ||
      y >= image.bitmap.height - 2
    ) {
      return false;
    }

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

  /**
   * 识别验证码
   * @param {string} imagePath - 验证码图片路径
   * @param {Object} options - 识别选项
   * @returns {Promise<string>} 识别结果
   */
  async recognize(imagePath, options = {}) {
    try {
      // 初始化worker
      await this.initialize();

      // 预处理图片
      const processedImagePath = await this.preprocessImage(imagePath, options);

      // 读取处理后的图片
      const sharpImgOut = await sharp(processedImagePath).png().toBuffer();

      // 使用Tesseract识别
      const {
        data: { text },
      } = await this.worker.recognize(sharpImgOut);

      // 清理临时文件
      if (fs.existsSync(processedImagePath)) {
        fs.unlinkSync(processedImagePath);
      }

      // 清理和验证结果
      const cleanedText = this.cleanResult(text);

      console.log('Tesseract 识别的验证码:', text);
      console.log('处理后的验证码:', cleanedText);

      if (!this.validateResult(cleanedText)) {
        throw new Error('验证码识别结果无效');
      }

      return cleanedText;
    } catch (error) {
      console.error('Tesseract 验证码识别失败:', error);
      throw error;
    }
  }

  /**
   * 终止worker
   * @returns {Promise<void>}
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * 析构函数
   */
  async destroy() {
    await this.terminate();
  }
}
