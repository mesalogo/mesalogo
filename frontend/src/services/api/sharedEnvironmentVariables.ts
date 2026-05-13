import { api } from './index';

const sharedEnvironmentVariablesAPI = {
  // 获取所有共享环境变量
  getAll: async () => {
    try {
      const response = await api.get('/shared-environment-variables');
      return response.data;
    } catch (error) {
      console.error('获取共享环境变量失败:', error);
      throw error;
    }
  },

  // 获取特定的共享环境变量
  getById: async (id) => {
    try {
      const response = await api.get(`/shared-environment-variables/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取共享环境变量详情失败:', error);
      throw error;
    }
  },

  // 创建共享环境变量
  create: async (data) => {
    try {
      const response = await api.post('/shared-environment-variables', data);
      return response.data;
    } catch (error) {
      console.error('创建共享环境变量失败:', error);
      throw error;
    }
  },

  // 更新共享环境变量
  update: async (id, data) => {
    try {
      const response = await api.put(`/shared-environment-variables/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新共享环境变量失败:', error);
      throw error;
    }
  },

  // 删除共享环境变量
  delete: async (id) => {
    try {
      const response = await api.delete(`/shared-environment-variables/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除共享环境变量失败:', error);
      throw error;
    }
  },

  // 获取行动空间绑定的共享环境变量
  getActionSpaceBindings: async (spaceId) => {
    try {
      const response = await api.get(`/action-spaces/${spaceId}/shared-variables`);
      return response.data;
    } catch (error) {
      console.error('获取行动空间共享变量绑定失败:', error);
      throw error;
    }
  },

  // 将共享环境变量绑定到行动空间
  bindToActionSpace: async (spaceId, variableId) => {
    try {
      const response = await api.post(`/action-spaces/${spaceId}/shared-variables/${variableId}`);
      return response.data;
    } catch (error) {
      console.error('绑定共享变量到行动空间失败:', error);
      throw error;
    }
  },

  // 解除共享环境变量与行动空间的绑定
  unbindFromActionSpace: async (spaceId, variableId) => {
    try {
      const response = await api.delete(`/action-spaces/${spaceId}/shared-variables/${variableId}`);
      return response.data;
    } catch (error) {
      console.error('解除共享变量绑定失败:', error);
      throw error;
    }
  }
};

export default sharedEnvironmentVariablesAPI;
