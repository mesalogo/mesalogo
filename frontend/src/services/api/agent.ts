import api from './axios';

/**
 * 智能体相关API服务
 */
export const agentAPI = {
  // 获取所有活跃智能体
  getAllActive: async () => {
    try {
      const response = await api.get('/agents?status=active');
      return response.data;
    } catch (error) {
      console.error('获取活跃智能体失败:', error);
      throw error;
    }
  },

  // 获取智能体详情
  getById: (id) => api.get(`/agents/${id}`),

  // 兼容旧代码的方法名称
  get: (id) => api.get(`/agents/${id}`),

  // 获取智能体状态
  getStatus: (id) => api.get(`/agents/${id}/status`),

  // 获取智能体记忆
  getMemories: (id) => api.get(`/agents/${id}/memories`),

  // 获取智能体消息记录
  getMessages: async (id: string, params: { page?: number; per_page?: number } = {}) => {
    const response = await api.get(`/agents/${id}/messages`, { params });
    return response.data;
  },

  // 停止智能体
  stop: (id) => api.post(`/agents/${id}/stop`),

  // 删除智能体
  delete: (id) => api.delete(`/agents/${id}`),

  // 更新智能体状态
  updateStatus: (id, status) => api.put(`/agents/${id}/status`, { status }),

  // 获取角色创建的智能体
  getRoleAgents: (roleId) => api.get(`/roles/${roleId}/agents`),

  // 创建智能体
  create: (roleId, data) => api.post(`/roles/${roleId}/agents`, data),

  // 获取智能体可用的模型配置
  getModelConfigs: async () => {
    const response = await api.get('/agents/model-configs');
    return response.data.model_configs;
  },

  // 测试智能体响应
  testAgent: async (agentId, prompt) => {
    const response = await api.post(`/agents/${agentId}/test`, { prompt });
    return response.data;
  },

  // 获取预定义角色列表
  getRoles: async () => {
    const response = await api.get('/agents/roles');
    return response.data.roles || [];
  },

  // 增加智能体使用次数
  incrementUsageCount: async (id) => {
    const response = await api.post(`/agents/${id}/increment-usage`);
    return response.data;
  },

  // 获取最常用的智能体
  getMostUsed: async (limit = 5) => {
    const response = await api.get(`/agents/most-used?limit=${limit}`);
    return response.data.agents || [];
  },

  // 获取最近创建的智能体
  getRecent: async (limit = 5) => {
    const response = await api.get(`/agents/recent?limit=${limit}`);
    return response.data.agents || [];
  },

  // 从预定义角色创建智能体
  createFromRole: async (roleId, customData = {}) => {
    try {
      console.log(`创建来自角色${roleId}的智能体，请求数据:`, customData);
      const response = await api.post(`/agents/from-role/${roleId}`, customData);
      console.log(`创建智能体成功，响应数据:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`创建智能体失败:`, error);
      throw error;
    }
  }
};