import api from './axios';

const toolAPI = {
  // 获取所有工具
  getAll: async () => {
    try {
      const response = await api.get('/tools');
      if (response.data) {
        // 如果响应数据是数组，直接返回
        if (Array.isArray(response.data)) {
          return { data: response.data };
        }
        // 如果响应有data属性且是数组，返回整个响应
        if (response.data.data && Array.isArray(response.data.data)) {
          return response.data;
        }
        // 默认返回空数组
        return { data: [] };
      }
      return { data: [] };
    } catch (error) {
      console.error('获取工具列表失败:', error);
      throw error;
    }
  },

  // 获取工具详情
  getById: (id) => api.get(`/tools/${id}`),

  // 创建工具
  create: (data) => api.post('/tools', data),

  // 更新工具
  update: (id, data) => api.put(`/tools/${id}`, data),

  // 删除工具
  delete: (id) => api.delete(`/tools/${id}`),

  // 获取角色可用的工具
  getRoleTools: (roleId) => api.get(`/roles/${roleId}/tools`),

  // 为角色分配工具
  assignToRole: (roleId, toolId) => api.post(`/roles/${roleId}/tools/${toolId}`),

  // 为角色移除工具
  removeFromRole: (roleId, toolId) => api.delete(`/roles/${roleId}/tools/${toolId}`),

  // 执行工具
  execute: (id, params) => api.post(`/tools/${id}/execute`, params),
};

export default toolAPI; 