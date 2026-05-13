import api from './axios';

const capabilityAPI = {
  // 获取所有能力
  getAll: async () => {
    try {
      const response = await api.get('/capabilities');
      console.log('原始能力API响应:', response);

      // 标准响应处理
      if (response && response.data) {
        // 1. 如果响应有status和data字段，且符合后端标准格式
        if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          console.log('检测到标准API响应格式，包含status和data');
          return response.data;
        }

        // 2. 如果response.data直接是数组
        if (Array.isArray(response.data)) {
          console.log('检测到直接数组格式的响应数据');
          return { status: 'success', data: response.data };
        }

        // 3. 其他情况，尽可能提取有效数据
        console.log('非标准响应格式，尝试提取数据');
        if (typeof response.data === 'object') {
          const possibleData = Object.values(response.data).find(Array.isArray);
          if (possibleData) {
            console.log('从非标准响应中提取到数组数据');
            return { status: 'success', data: possibleData };
          }
        }
      }

      // 默认返回空数组
      console.log('未能识别响应格式，返回空数组');
      return { status: 'success', data: [] };
    } catch (error) {
      console.error('获取能力列表失败:', error);
      throw error;
    }
  },

  // 获取单个能力
  getById: async (id) => {
    try {
      const response = await api.get(`/capabilities/${id}`);
      return response.data;
    } catch (error) {
      console.error(`获取能力详情失败 (ID: ${id}):`, error);
      throw error;
    }
  },

  // 创建新能力
  create: async (capabilityData) => {
    try {
      const response = await api.post('/capabilities', capabilityData);
      return response.data;
    } catch (error) {
      console.error('创建能力失败:', error);
      throw error;
    }
  },

  // 更新能力
  update: async (id, capabilityData) => {
    try {
      const response = await api.put(`/capabilities/${id}`, capabilityData);
      return response.data;
    } catch (error) {
      console.error(`更新能力失败 (ID: ${id}):`, error);
      throw error;
    }
  },

  // 删除能力
  delete: async (id) => {
    try {
      const response = await api.delete(`/capabilities/${id}`);
      return response.data;
    } catch (error) {
      console.error(`删除能力失败 (ID: ${id}):`, error);
      throw error;
    }
  },

  // 分配能力给角色
  assignToRole: async (roleId, capabilityId, enabled = true) => {
    try {
      const response = await api.post(`/roles/${roleId}/capabilities/${capabilityId}`, {
        enabled
      });
      return response.data;
    } catch (error) {
      console.error(`分配能力给角色失败 (角色ID: ${roleId}, 能力ID: ${capabilityId}):`, error);
      throw error;
    }
  },

  // 获取角色的所有能力
  getByRoleId: async (roleId) => {
    try {
      const response = await api.get(`/roles/${roleId}/capabilities`);
      return response.data;
    } catch (error) {
      console.error(`获取角色能力失败 (角色ID: ${roleId}):`, error);
      throw error;
    }
  },

  // 从角色中移除能力
  unassignFromRole: async (roleId, capabilityId) => {
    try {
      const response = await api.delete(`/roles/${roleId}/capabilities/${capabilityId}`);
      return response.data;
    } catch (error) {
      console.error(`从角色移除能力失败 (角色ID: ${roleId}, 能力ID: ${capabilityId}):`, error);
      throw error;
    }
  },

  // 获取所有能力的工具关联关系
  getTools: async () => {
    try {
      const response = await api.get('/capabilities/tools');
      return response.data;
    } catch (error) {
      console.error('获取能力工具关联关系失败:', error);
      throw error;
    }
  },

  // 获取所有能力及其关联角色信息（一次性请求）
  getAllWithRoles: async () => {
    try {
      const response = await api.get('/capabilities/with_roles');
      return response.data;
    } catch (error) {
      console.error('获取能力-角色映射关系失败:', error);
      throw error;
    }
  },

  // 更新能力的工具关联关系
  updateTools: async (capabilityId, toolsData) => {
    try {
      const response = await api.put(`/capabilities/${capabilityId}/tools`, toolsData);
      return response.data;
    } catch (error) {
      console.error(`更新能力工具关联关系失败 (能力ID: ${capabilityId}):`, error);
      throw error;
    }
  }
};

export default capabilityAPI;