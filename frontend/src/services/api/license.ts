import api from './axios';

/**
 * 许可证API服务
 */
export const licenseAPI = {
  /**
   * 获取当前许可证信息
   * @returns {Promise<Object>} 许可证信息
   */
  getCurrentLicense: async () => {
    try {
      // 确保使用正确的路径，不要在末尾添加斜杠
      console.log('正在请求许可证信息，URL: /license');
      const response = await api.get('/license');
      console.log('许可证信息请求成功:', response.config.url);
      return response.data.data;
    } catch (error) {
      console.error('获取许可证信息失败:', error);
      console.error('请求URL:', error.config?.url);
      throw error;
    }
  },

  /**
   * 获取过期的许可证信息
   * @returns {Promise<Object>} 过期的许可证信息
   */
  getExpiredLicense: async () => {
    try {
      const response = await api.get('/license/expired');
      return response.data.data;
    } catch (error) {
      console.error('获取过期许可证信息失败:', error);
      // 对于404错误，抛出特定的license错误
      if (error.response?.status === 404) {
        const licenseError: any = new Error('未找到任何许可证信息');
        licenseError.isLicenseError = true;
        licenseError.code = 'LICENSE_NOT_FOUND';
        throw licenseError;
      }
      throw error;
    }
  },

  /**
   * 通过密钥激活许可证
   * @param {string} licenseKey 许可证密钥
   * @returns {Promise<Object>} 激活结果
   */
  activateLicense: async (licenseKey) => {
    try {
      const response = await api.post('/license/activate', { license_key: licenseKey });
      return response.data;
    } catch (error) {
      console.error('激活许可证失败:', error);
      throw error;
    }
  },

  /**
   * 通过文件激活许可证
   * @param {File} file 许可证文件
   * @returns {Promise<Object>} 激活结果
   */
  activateLicenseFile: async (file) => {
    try {
      const formData = new FormData();
      formData.append('license_file', file);

      const response = await api.post('/license/activate-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      console.error('通过文件激活许可证失败:', error);
      throw error;
    }
  },

  /**
   * 检查功能是否可用
   * @param {string} featureName 功能名称
   * @returns {Promise<boolean>} 功能是否可用
   */
  checkFeatureAvailability: async (featureName) => {
    try {
      const response = await api.get(`/license/check-feature?feature=${featureName}`);
      return response.data.data.available;
    } catch (error) {
      console.error(`检查功能 ${featureName} 可用性失败:`, error);
      return false;
    }
  },

  /**
   * 检查资源限制
   * @param {string} resourceType 资源类型 (agents, action_spaces, roles)
   * @param {number} currentCount 当前资源数量
   * @returns {Promise<boolean>} 是否允许创建更多资源
   */
  checkResourceLimit: async (resourceType, currentCount) => {
    try {
      const response = await api.get(`/license/check-limit?resource=${resourceType}&count=${currentCount}`);
      return response.data.data.allowed;
    } catch (error) {
      console.error(`检查资源 ${resourceType} 限制失败:`, error);
      return false;
    }
  },

  /**
   * 获取系统许可证密钥
   * @returns {Promise<string>} 系统许可证密钥
   */
  getSystemKey: async () => {
    try {
      const response = await api.get('/license/system-key');
      return response.data.data.key;
    } catch (error) {
      console.error('获取系统许可证密钥失败:', error);
      throw error; // 不提供默认密钥，直接抛出错误
    }
  }
};

export default licenseAPI;
