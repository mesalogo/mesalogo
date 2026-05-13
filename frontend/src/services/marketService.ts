/**
 * 实体应用市场API服务
 */
import api from './api/axios';

// VNC 代理服务
export const vncProxyService = {
  /**
   * 启动 VNC 代理会话
   * @param {string} target - VNC 目标地址，格式 host:port
   * @returns {Promise<{token: string, ws_port: number, expires_in: number}>}
   */
  async start(target: string): Promise<{ token: string; ws_port: number; expires_in: number }> {
    const response = await api.post('/market/apps/next-rpa/vnc/start', { target });
    return response.data;
  },

  /**
   * 停止 VNC 代理会话
   * @param {string} token - 会话 Token
   */
  async stop(token: string): Promise<void> {
    await api.post(`/market/apps/next-rpa/vnc/stop?token=${token}`);
  },

  /**
   * 获取 VNC 代理状态
   * @returns {Promise<{active_sessions: number}>}
   */
  async getStatus(): Promise<{ active_sessions: number }> {
    const response = await api.get('/market/apps/next-rpa/vnc/status');
    return response.data;
  },

  /**
   * 获取 WebSocket 代理 URL (单端口 + token 路由)
   * @param {number} wsPort - websockify 监听端口
   * @param {string} token - 会话 token，用于路由到正确的 VNC 目标
   * @returns {string} WebSocket URL
   */
  getProxyUrl(wsPort: number, token: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    return `${protocol}//${host}:${wsPort}/?token=${token}`;
  }
};

export const marketService = {
  /**
   * 获取应用列表
   * @param {Object} params - 查询参数
   * @param {string} params.category - 应用分类
   * @param {string} params.search - 搜索关键词
   * @param {boolean} params.featured - 是否只显示推荐应用
   * @param {boolean} params.enabled_only - 是否只显示启用的应用
   * @returns {Promise} 应用列表
   */
  async getApps(params = {}) {
    try {
      const response = await api.get('/market/apps', { params });
      return response.data;
    } catch (error) {
      throw new Error(`获取应用列表失败: ${error.message}`);
    }
  },

  /**
   * 获取应用详情
   * @param {string} appId - 应用ID
   * @returns {Promise} 应用详情
   */
  async getAppDetail(appId) {
    try {
      const response = await api.get(`/market/apps/${appId}`);
      return response.data;
    } catch (error) {
      throw new Error(`获取应用详情失败: ${error.message}`);
    }
  },

  /**
   * 切换应用启用状态
   * @param {string} appId - 应用ID
   * @param {boolean} enabled - 是否启用
   * @returns {Promise} 操作结果
   */
  async toggleAppEnabled(appId, enabled) {
    try {
      const response = await api.post(`/market/apps/${appId}/toggle`, {
        enabled
      });
      return response.data;
    } catch (error) {
      throw new Error(`切换应用状态失败: ${error.message}`);
    }
  },

  /**
   * 启动应用
   * @param {string} appId - 应用ID
   * @returns {Promise} 启动结果
   */
  async launchApp(appId) {
    try {
      const response = await api.post(`/market/apps/${appId}/launch`);
      return response.data;
    } catch (error) {
      throw new Error(`启动应用失败: ${error.message}`);
    }
  },

  /**
   * 获取应用分类列表
   * @returns {Promise} 分类列表
   */
  async getCategories() {
    try {
      const response = await api.get('/market/categories');
      return response.data;
    } catch (error) {
      throw new Error(`获取分类列表失败: ${error.message}`);
    }
  },

  /**
   * 创建新应用（管理员功能）
   * @param {Object} appData - 应用数据
   * @returns {Promise} 创建结果
   */
  async createApp(appData) {
    try {
      const response = await api.post('/market/apps', appData);
      return response.data;
    } catch (error) {
      throw new Error(`创建应用失败: ${error.message}`);
    }
  },

  /**
   * 更新应用（管理员功能）
   * @param {string} appId - 应用ID
   * @param {Object} appData - 应用数据
   * @returns {Promise} 更新结果
   */
  async updateApp(appId, appData) {
    try {
      const response = await api.put(`/market/apps/${appId}`, appData);
      return response.data;
    } catch (error) {
      throw new Error(`更新应用失败: ${error.message}`);
    }
  },

  /**
   * 删除应用（管理员功能）
   * @param {string} appId - 应用ID
   * @returns {Promise} 删除结果
   */
  async deleteApp(appId) {
    try {
      const response = await api.delete(`/market/apps/${appId}`);
      return response.data;
    } catch (error) {
      throw new Error(`删除应用失败: ${error.message}`);
    }
  },

  /**
   * 绑定应用到行动空间
   * @param {string} appId - 应用ID
   * @param {Array} spaceIds - 行动空间ID数组
   * @returns {Promise} 绑定结果
   */
  async bindAppToSpaces(appId, spaceIds) {
    try {
      const response = await api.post(`/market/apps/${appId}/bind-spaces`, {
        space_ids: spaceIds
      });
      return response.data;
    } catch (error) {
      throw new Error(`绑定应用到行动空间失败: ${error.message}`);
    }
  },

  /**
   * 获取应用绑定的行动空间列表
   * @param {string} appId - 应用ID
   * @returns {Promise} 绑定的行动空间列表
   */
  async getAppBoundSpaces(appId) {
    try {
      const response = await api.get(`/market/apps/${appId}/bound-spaces`);
      return response.data;
    } catch (error) {
      throw new Error(`获取应用绑定空间失败: ${error.message}`);
    }
  },

  /**
   * 获取所有行动空间列表
   * @returns {Promise} 行动空间列表
   */
  async getActionSpaces() {
    try {
      const response = await api.get('/market/action-spaces');
      return response.data;
    } catch (error) {
      throw new Error(`获取行动空间列表失败: ${error.message}`);
    }
  },

  /**
   * 获取特定行动空间绑定的应用列表
   * @param {number} spaceId - 行动空间ID
   * @returns {Promise} 绑定的应用列表
   */
  async getActionSpaceApps(spaceId) {
    try {
      const response = await api.get(`/market/action-spaces/${spaceId}/apps`);
      return response.data;
    } catch (error) {
      throw new Error(`获取行动空间应用失败: ${error.message}`);
    }
  },

  /**
   * 更新应用配置
   * @param {string} appId - 应用ID
   * @param {Object} config - 新的配置对象
   * @returns {Promise} 更新结果
   */
  async updateAppConfig(appId, config) {
    try {
      const response = await api.put(`/market/apps/${appId}/config`, {
        config
      });
      return response.data;
    } catch (error) {
      throw new Error(`更新应用配置失败: ${error.message}`);
    }
  }
};

export default marketService;
