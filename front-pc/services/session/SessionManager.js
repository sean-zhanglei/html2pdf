/**
 * 会话类
 */
class PdfSession {
  constructor(sessionId, browser, page, loginState = 'started') {
    this.sessionId = sessionId;
    this.browser = browser;
    this.page = page;
    this.loginState = loginState;
    this.timestamp = Date.now();
    this.verificationCode = null;
    this.username = null;
    this.password = null;
    this.websiteUrl = null;
    this.selector = null;
  }

  /**
   * 更新会话时间戳
   */
  updateTimestamp() {
    this.timestamp = Date.now();
  }

  /**
   * 检查会话是否过期
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {boolean} 是否过期
   */
  isExpired(timeout = 10 * 60 * 1000) {
    return Date.now() - this.timestamp > timeout;
  }

  /**
   * 设置会话数据
   * @param {Object} data - 会话数据
   */
  setData(data) {
    Object.assign(this, data);
  }

  /**
   * 获取会话数据
   * @returns {Object} 会话数据
   */
  getData() {
    return {
      sessionId: this.sessionId,
      loginState: this.loginState,
      timestamp: this.timestamp,
      verificationCode: this.verificationCode,
      username: this.username,
      password: this.password,
      websiteUrl: this.websiteUrl,
      selector: this.selector,
    };
  }
}

/**
 * 会话管理器类
 * 负责管理PDF生成会话的生命周期
 */
export class SessionManager {
  constructor() {
    this.sessionStore = new Map();
    this.cleanupInterval = null;
    this.sessionTimeout = 10 * 60 * 1000; // 10分钟会话超时
    this.cleanupIntervalTime = 5 * 60 * 1000; // 5分钟清理间隔
  }

  /**
   * 启动会话清理定时器
   */
  startCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupIntervalTime);

    console.log('会话清理定时器已启动');
  }

  /**
   * 停止会话清理定时器
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('会话清理定时器已停止');
    }
  }

  /**
   * 创建新会话
   * @param {Object} browser - 浏览器实例
   * @param {Object} page - 页面实例
   * @param {Object} data - 会话数据
   * @returns {string} 会话ID
   */
  createSession(browser, page, data = {}) {
    const sessionId = `pdf_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const session = new PdfSession(
      sessionId,
      browser,
      page,
      data.loginState || 'started'
    );

    session.setData(data);
    this.sessionStore.set(sessionId, session);

    console.log(`创建新会话: ${sessionId}`);
    return sessionId;
  }

  /**
   * 获取会话
   * @param {string} sessionId - 会话ID
   * @returns {Object|null} 会话对象
   */
  getSession(sessionId) {
    const session = this.sessionStore.get(sessionId);

    if (session) {
      // 更新会话时间戳
      session.updateTimestamp();
    }

    return session;
  }

  /**
   * 检查会话是否存在且有效
   * @param {string} sessionId - 会话ID
   * @returns {boolean} 是否有效
   */
  isValidSession(sessionId) {
    const session = this.getSession(sessionId);
    return session && !session.isExpired(this.sessionTimeout);
  }

  /**
   * 更新会话数据
   * @param {string} sessionId - 会话ID
   * @param {Object} data - 要更新的数据
   * @returns {boolean} 是否更新成功
   */
  updateSession(sessionId, data) {
    const session = this.getSession(sessionId);

    if (session) {
      session.setData(data);
      session.updateTimestamp();
      return true;
    }

    return false;
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话ID
   * @returns {boolean} 是否删除成功
   */
  deleteSession(sessionId) {
    const session = this.sessionStore.get(sessionId);

    if (session) {
      // 关闭浏览器实例
      if (session.browser) {
        session.browser.close().catch(console.error);
      }

      this.sessionStore.delete(sessionId);
      console.log(`删除会话: ${sessionId}`);
      return true;
    }

    return false;
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions() {
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (session.isExpired(this.sessionTimeout)) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach((sessionId) => {
      console.log(`清理过期会话: ${sessionId}`);
      this.deleteSession(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(`清理了 ${expiredSessions.length} 个过期会话`);
    }
  }

  /**
   * 获取所有会话信息
   * @returns {Array} 会话信息列表
   */
  getAllSessions() {
    const sessions = [];

    for (const [sessionId, session] of this.sessionStore.entries()) {
      sessions.push({
        sessionId,
        ...session.getData(),
        isExpired: session.isExpired(this.sessionTimeout),
      });
    }

    return sessions;
  }

  /**
   * 获取活跃会话数量
   * @returns {number} 活跃会话数量
   */
  getActiveSessionCount() {
    let count = 0;

    for (const session of this.sessionStore.values()) {
      if (!session.isExpired(this.sessionTimeout)) {
        count++;
      }
    }

    return count;
  }

  /**
   * 获取会话统计信息
   * @returns {Object} 统计信息
   */
  getSessionStats() {
    const total = this.sessionStore.size;
    const active = this.getActiveSessionCount();
    const expired = total - active;

    return {
      total,
      active,
      expired,
      cleanupInterval: this.cleanupIntervalTime,
      sessionTimeout: this.sessionTimeout,
    };
  }

  /**
   * 强制清理所有会话
   */
  cleanupAllSessions() {
    const sessionIds = Array.from(this.sessionStore.keys());

    sessionIds.forEach((sessionId) => {
      this.deleteSession(sessionId);
    });

    console.log(`强制清理了 ${sessionIds.length} 个会话`);
  }

  /**
   * 销毁会话管理器
   */
  destroy() {
    this.stopCleanupTimer();
    this.cleanupAllSessions();
    console.log('会话管理器已销毁');
  }
}
