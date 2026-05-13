import api from './axios';

/**
 * 系统设置API服务
 * 提供与系统设置相关的API函数
 */
const settingsAPI = {
  /**
   * 获取系统设置
   * @returns {Promise<Object>} 系统设置对象
   */
  getSettings: async () => {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error) {
      console.error('获取系统设置失败:', error);
      throw error;
    }
  },

  /**
   * 更新系统设置
   * @param {Object} settingsData 设置数据对象
   * @returns {Promise<Object>} 更新结果
   */
  updateSettings: async (settingsData) => {
    try {
      const response = await api.post('/settings', settingsData);
      return response.data;
    } catch (error) {
      console.error('更新系统设置失败:', error);
      throw error;
    }
  },

  /**
   * 获取提示词模板
   * @returns {Promise<Object>} 提示词模板对象
   */
  getPromptTemplates: async () => {
    try {
      const response = await api.get('/settings/prompt-templates');
      return response.data;
    } catch (error) {
      console.error('获取提示词模板失败:', error);
      throw error;
    }
  },

  /**
   * 更新提示词模板
   * @param {Object} templatesData 模板数据对象
   * @returns {Promise<Object>} 更新结果
   */
  updatePromptTemplates: async (templatesData) => {
    try {
      const response = await api.post('/settings/prompt-templates', templatesData);
      return response.data;
    } catch (error) {
      console.error('更新提示词模板失败:', error);
      throw error;
    }
  },

  /**
   * 重置提示词模板为默认值
   * @returns {Promise<Object>} 重置结果
   */
  resetPromptTemplates: async () => {
    try {
      const response = await api.post('/settings/prompt-templates/reset');
      return response.data;
    } catch (error) {
      console.error('重置提示词模板失败:', error);
      throw error;
    }
  }
};

export { settingsAPI };
export default settingsAPI;