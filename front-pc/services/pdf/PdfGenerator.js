import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

/**
 * PDF生成器类
 * 负责将网页元素转换为PDF文件
 */
export class PdfGenerator {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.imagesDir = path.join(this.tempDir, 'images');
    this.pdfDir = this.tempDir;
  }

  /**
   * 确保目录存在
   * @param {string} dirPath - 目录路径
   */
  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 生成PDF文件
   * @param {Object} page - Puppeteer页面对象
   * @param {string} selector - 目标元素选择器
   * @returns {Promise<Object>} 生成结果 {pdfPath: string, pdfFileName: string}
   */
  async generatePdf(page, selector = {}) {
    try {
      // 确保目录存在
      this.ensureDirectoryExists(this.tempDir);
      this.ensureDirectoryExists(this.imagesDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const pdfFileName = `${timestamp}.pdf`;
      const pdfPath = path.join(this.pdfDir, pdfFileName);

      // 获取目标元素
      await page.waitForSelector(selector, { timeout: 10000 });
      const element = await page.$(selector);

      if (!element) {
        throw new Error(`未找到元素: ${selector}`);
      }

      const boxOld = await element.boundingBox();
      if (!boxOld) {
        throw new Error('元素不可见或尺寸为0');
      }

      console.log('元素尺寸Old:', boxOld);

      // 获取元素的位置和尺寸
      const elementInfo = await page.evaluate(
        ({ selector, boxOld }) => {
          const element = document.querySelector(selector);
          return {
            scrollHeight: element.scrollHeight + boxOld.y,
            width: element.scrollWidth,
          };
        },
        { selector, boxOld }
      );

      // 重新设置视窗高度为元素的完整高度
      await page.setViewport({
        width: Math.max(1920, elementInfo.width),
        height: elementInfo.scrollHeight,
        deviceScaleFactor: 1,
      });

      const boxNew = await element.boundingBox();
      if (!boxNew) {
        throw new Error('元素不可见或尺寸为0');
      }

      console.log('元素尺寸New:', boxNew);

      // 生成临时图片
      const tempImagePath = path.join(this.imagesDir, `${timestamp}-temp.png`);
      await element.screenshot({ path: tempImagePath, type: 'png' });

      try {
        // 创建PDF
        const imageBytes = fs.readFileSync(tempImagePath);
        const pdfDoc = await PDFDocument.create();

        // 计算带边距的页面尺寸
        const margin = 20;
        const pageWidth = boxNew.width + margin * 2;
        const pageHeight = elementInfo.scrollHeight;

        const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
        const embeddedImage = await pdfDoc.embedPng(imageBytes);

        pdfPage.drawImage(embeddedImage, {
          x: margin,
          y: 0,
          width: boxNew.width,
          height: pageHeight,
        });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(pdfPath, pdfBytes);

        // 清理临时图片文件
        if (fs.existsSync(tempImagePath)) {
          fs.unlinkSync(tempImagePath);
        }

        console.log('PDF文件生成成功:', pdfFileName);

        return {
          pdfPath,
          pdfFileName,
          success: true,
          message: 'PDF生成成功',
        };
      } catch (error) {
        // 清理临时文件
        if (fs.existsSync(tempImagePath)) {
          fs.unlinkSync(tempImagePath);
        }
        throw error;
      }
    } catch (error) {
      console.error('PDF生成失败:', error);
      throw error;
    }
  }

  /**
   * 生成PDF并返回下载URL
   * @param {Object} page - Puppeteer页面对象
   * @param {string} selector - 目标元素选择器
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 生成结果 {pdfUrl: string, pdfFileName: string, success: boolean, message: string}
   */
  async generatePdfWithUrl(page, selector, options = {}) {
    const result = await this.generatePdf(page, selector, options);

    return {
      ...result,
      pdfUrl: `/api/download?file=${result.pdfFileName}`,
    };
  }

  /**
   * 清理临时文件
   * @param {string} filePath - 文件路径
   */
  cleanupFile(filePath) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`清理临时文件: ${filePath}`);
      } catch (error) {
        console.warn(`清理文件失败: ${filePath}`, error.message);
      }
    }
  }

  /**
   * 清理所有临时文件
   * @param {number} olderThan - 清理多少毫秒前的文件
   */
  cleanupAllTempFiles(olderThan = 24 * 60 * 60 * 1000) {
    // 默认清理24小时前的文件
    const now = Date.now();

    const cleanupDirectory = (dirPath) => {
      if (!fs.existsSync(dirPath)) return;

      const files = fs.readdirSync(dirPath);

      files.forEach((file) => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > olderThan) {
          this.cleanupFile(filePath);
        }
      });
    };

    cleanupDirectory(this.imagesDir);
    cleanupDirectory(this.pdfDir);

    console.log('临时文件清理完成');
  }

  /**
   * 获取PDF文件信息
   * @param {string} pdfFileName - PDF文件名
   * @returns {Object} 文件信息 {exists: boolean, size: number, path: string}
   */
  getPdfFileInfo(pdfFileName) {
    const pdfPath = path.join(this.pdfDir, pdfFileName);

    if (!fs.existsSync(pdfPath)) {
      return { exists: false, size: 0, path: pdfPath };
    }

    const stats = fs.statSync(pdfPath);
    return {
      exists: true,
      size: stats.size,
      path: pdfPath,
      created: stats.mtime,
    };
  }
}
