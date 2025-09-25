/**
 * 阿里云 DashScope API 配置
 * 用于 Qwen3-VL 多模态模型验证码识别
 */

const qwen3vlConfig = {
  // API 配置
  api: {
    // API 密钥
    key: process.env.DASHSCOPE_API_KEY || 'sk-92d9b2d4c56947679bbe87a8dee9e6b7',
    
    // API 基础地址
    baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
    
    // 上传凭证接口路径
    uploadsPath: '/api/v1/uploads',
    
    // 聊天补全接口路径
    chatCompletionsPath: '/compatible-mode/v1/chat/completions',
  },
  
  // 模型配置
  model: {
    // 模型名称
    name: 'qwen3-vl-plus',
    
    // 上传参数
    uploadParams: {
      action: 'getPolicy',
    },
  },
  
  // 请求配置
  request: {
    // 超时时间（毫秒）
    timeout: 30000,
    
    // 重试次数
    retryCount: 3,
    
    // 重试延迟（毫秒）
    retryDelay: 1000,
  },
  
  // 验证码识别提示词
  captchaPrompt: 
    '请识别图中的验证码，只输出4位字符，不要任何解释、标点或空格。注意：字符可能是数字或字母，如 0/O, 1/l, y/v 等容易混淆，请根据上下文判断。',
  
  // 文件上传配置
  upload: {
    // 上传文件名称
    fileName: 'code.png',
    // OSS 配置
    oss: {
      objectAcl: 'private',
      forbidOverwrite: 'true',
      successActionStatus: '200',
    },
  },
};

/**
 * 获取完整的 API URL
 * @param {string} path - API 路径
 * @returns {string} 完整的 URL
 */
qwen3vlConfig.getApiUrl = function(path) {
  return `${this.api.baseUrl}${path}`;
};

/**
 * 获取认证头信息
 * @returns {Object} 认证头信息
 */
qwen3vlConfig.getAuthHeaders = function() {
  return {
    Authorization: `Bearer ${this.api.key}`,
    'X-DashScope-OssResourceResolve': 'enable',
  };
};

/**
 * 获取上传参数
 * @returns {Object} 上传参数
 */
qwen3vlConfig.getUploadParams = function() {
  return {
    ...this.model.uploadParams,
    model: this.model.name,
  };
};

export default qwen3vlConfig;
