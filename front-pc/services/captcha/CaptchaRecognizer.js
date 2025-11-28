/**
 * 验证码识别器抽象基类
 * 定义验证码识别的通用接口
 */
export class CaptchaRecognizer {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * 识别验证码（抽象方法，子类必须实现）
   * @param {string} imagePath - 验证码图片路径
   * @param {Object} options - 识别选项
   * @returns {Promise<string>} 识别结果
   */
  async recognize(imagePath, options = {}) {
    throw new Error('recognize 方法必须在子类中实现');
  }

  /**
   * 预处理验证码图片
   * @param {string} imagePath - 原始图片路径
   * @param {Object} options - 预处理选项
   * @returns {Promise<string>} 处理后的图片路径
   */
  async preprocessImage(imagePath, options = {}) {
    throw new Error('preprocessImage 方法必须在子类中实现');
  }

  /**
   * 验证识别结果
   * @param {string} result - 识别结果
   * @returns {boolean} 是否有效
   */
  validateResult(result) {
    if (!result || result.trim() === '') {
      return false;
    }

    // 去除空格和特殊字符
    const cleaned = result.replace(/[^a-zA-Z0-9]/g, '').trim();

    // 检查长度是否合理（通常验证码为4-8个字符）
    return cleaned.length >= 4 && cleaned.length <= 8;
  }

  /**
   * 清理识别结果
   * @param {string} result - 原始识别结果
   * @returns {string} 清理后的结果
   */
  cleanResult(result) {
    if (!result) return '';

    // 去除所有非字母数字字符
    let cleaned = result.replace(/[^a-zA-Z0-9]/g, '').trim();

    // 去除空格
    cleaned = cleaned.replace(/\s+/g, '');

    return cleaned;
  }

  /**
   * 获取识别器名称
   * @returns {string} 识别器名称
   */
  getName() {
    return this.constructor.name;
  }
}
