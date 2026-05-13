import api from './axios';

/**
 * 日志API服务
 * 提供与系统日志相关的API函数
 */
const logsAPI = {
  /**
   * 获取系统日志内容
   * @param {Object} params 查询参数
   * @param {number} params.max_lines 最大行数
   * @param {number} params.start_line 起始行
   * @returns {Promise<Object>} 日志内容
   */
  getLogs: async (params = {}) => {
    try {
      const response = await api.get('/logs', { params });
      return response.data;
    } catch (error) {
      console.error('获取系统日志失败:', error);
      throw error;
    }
  },

  /**
   * 获取日志文件的最后几行
   * @param {Object} params 查询参数
   * @param {number} params.lines 行数
   * @returns {Promise<Object>} 日志内容
   */
  tailLogs: async (params = {}) => {
    try {
      const response = await api.get('/logs/tail', { params });
      return response.data;
    } catch (error) {
      console.error('获取系统日志尾部内容失败:', error);
      throw error;
    }
  }
};

export { logsAPI };
export default logsAPI;
