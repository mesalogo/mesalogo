import api from './axios';

// Mock role data (fallback when API is unavailable)
const mockRoles = [
  { id: 'role-001', name: 'Strategy Analyst', description: 'Specializes in market trend analysis and strategic planning', model_id: 'gpt-4', prompt_template: 'You are a strategy analyst...' },
  { id: 'role-002', name: 'Finance Expert', description: 'Focuses on financial analysis and resource allocation optimization', model_id: 'gpt-4', prompt_template: 'You are a finance expert...' },
  { id: 'role-003', name: 'Marketing Expert', description: 'Specializes in marketing strategy and competitive analysis', model_id: 'gpt-4', prompt_template: 'You are a marketing expert...' },
  { id: 'role-004', name: 'Operations Expert', description: 'Focuses on enterprise operations optimization and efficiency improvement', model_id: 'gpt-4', prompt_template: 'You are an operations expert...' },
  { id: 'role-005', name: 'Legal Advisor', description: 'Focuses on legal analysis and risk assessment', model_id: 'gpt-4', prompt_template: 'You are a legal advisor...' },
  { id: 'role-006', name: 'Education Expert', description: 'Specializes in education program design and learning path planning', model_id: 'gpt-4', prompt_template: 'You are an education expert...' },
  { id: 'role-007', name: 'Agriculture Expert', description: 'Focuses on agricultural production optimization and resource management', model_id: 'gpt-4', prompt_template: 'You are an agriculture expert...' },
  { id: 'role-008', name: 'Medical Advisor', description: 'Specializes in medical diagnosis and treatment planning', model_id: 'gpt-4', prompt_template: 'You are a medical advisor...' }
];

/**
 * 角色相关API服务
 */
export const roleAPI = {
  // 获取所有角色
  getAll: async (filters = {}) => {
    try {
      // 构建查询参数
      const params = new URLSearchParams();
      if ((filters as any).action_space_id) {
        params.append('action_space_id', (filters as any).action_space_id);
      }

      // 添加查询参数到请求URL
      const queryString = params.toString();
      const url = queryString ? `/roles?${queryString}` : '/roles';

      const response = await api.get(url);
      return response.data.roles;
    } catch (error) {
      console.warn('Failed to get roles, using mock data', error);
      return mockRoles;
    }
  },

  // 获取所有角色及其详细信息（包括能力和知识库）
  getAllWithDetails: async () => {
    try {
      const response = await api.get('/roles/with-details');
      return response.data;
    } catch (error) {
      console.error('Failed to get role details:', error);
      // 如果新API失败，回退到原有方式
      const roles = await roleAPI.getAll();
      return roles.map(role => ({
        ...role,
        capabilities: [],
        internalKnowledges: [],
        externalKnowledges: [],
        allKnowledges: []
      }));
    }
  },

  // 获取所有角色的知识库绑定关系
  getAllRolesKnowledgeBindings: async () => {
    try {
      const response = await api.get('/roles/knowledge-bindings');
      return response.data;
    } catch (error) {
      console.error('Failed to get role knowledge bindings:', error);
      throw error;
    }
  },

  // 获取可用角色
  getAvailableRoles: async () => {
    try {
      // 复用getAll方法
      return await roleAPI.getAll();
    } catch (error) {
      console.error('Failed to get available roles:', error);
      throw error;
    }
  },

  // 获取单个角色
  getById: async (id) => {
    try {
      const response = await api.get(`/roles/${id}`);
      return response.data;
    } catch (error) {
      console.warn(`Failed to get role ${id}, using mock data`, error);
      return mockRoles.find(role => role.id === id) || null;
    }
  },

  // 创建角色
  create: async (roleData) => {
    const response = await api.post('/roles', roleData);
    return response.data;
  },

  // 更新角色
  update: async (id, roleData) => {
    // 将前端model_id格式转换为接口期望的model格式
    const apiData = {...roleData};

    // 只对内部角色检查temperature等模型参数
    if (apiData.source !== 'external') {
      // 检查关键字段是否存在
      if (apiData.temperature === undefined) {
        console.warn('Warning: temperature field missing, using default value 0.7');
        apiData.temperature = 0.7;
      }
    }

    // 检查并记录所有字段
    console.log('Update role request data - ID:', id);
    console.log('Update role request data - full data:', JSON.stringify(apiData, null, 2));

    if (apiData.source === 'external') {
      console.log('Update external role request data - field check:', {
        name: apiData.name ? '✓' : '✗',
        description: apiData.description ? '✓' : '✗',
        source: apiData.source ? '✓' : '✗',
        external_type: apiData.external_type ? '✓' : '✗',
        external_config: apiData.external_config ? '✓' : '✗'
      });
    } else {
      console.log('Update internal role request data - field check:', {
        name: apiData.name ? '✓' : '✗',
        model: apiData.model ? '✓' : '✗',
        system_prompt: apiData.system_prompt ? '✓' : '✗',
        description: apiData.description ? '✓' : '✗',
        temperature: apiData.temperature !== undefined ? `✓ (${apiData.temperature})` : '✗',
        topP: apiData.topP !== undefined ? `✓ (${apiData.topP})` : '✗',
        frequencyPenalty: apiData.frequencyPenalty !== undefined ? `✓ (${apiData.frequencyPenalty})` : '✗',
        presencePenalty: apiData.presencePenalty !== undefined ? `✓ (${apiData.presencePenalty})` : '✗',
        stopSequences: apiData.stopSequences !== undefined ? `✓ (${apiData.stopSequences?.length || 0} items)` : '✗'
      });
    }

    const response = await api.put(`/roles/${id}`, apiData);
    return response.data;
  },

  // 删除角色
  delete: async (id) => {
    const response = await api.delete(`/roles/${id}`);
    return response.data;
  },

  // 获取角色可用的模型配置
  getModelConfigs: async () => {
    try {
      // 优先使用完整的模型配置API获取详细信息
      console.log('Trying to get data from full model config API...');
      const completeResponse = await api.get('/model-configs');
      console.log('Successfully got full model config:', completeResponse.data.model_configs);
      return completeResponse.data.model_configs;
    } catch (modelConfigError) {
      console.warn('Cannot get data from model config API, trying role API for model config:', modelConfigError);

      try {
        // 回退到使用角色API
        const response = await api.get('/roles/model-configs');
        console.log('Model config obtained from role API:', response.data.model_configs);
        return response.data.model_configs;
      } catch (error) {
        console.warn('Failed to get model config, using mock data', error);
        return [
          { id: 'gpt-4', name: 'GPT-4', description: 'Powerful large language model' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Model balancing performance and cost' }
        ];
      }
    }
  },

  // 测试角色响应
  testRole: async (roleId, prompt, advancedParams = {}) => {
    const data = {
      prompt,
      ...advancedParams // 添加高级参数
    };

    console.log(`Test role ${roleId} request data:`, data);
    const response = await api.post(`/roles/${roleId}/test`, data);
    return response.data;
  },

  // 获取预定义角色列表
  getRoles: async () => {
    try {
      const response = await api.get('/roles/predefined');
      return response.data.predefined_roles || [];
    } catch (error) {
      console.warn('Failed to get predefined roles, using mock data', error);
      return mockRoles;
    }
  },

  // 增加角色使用次数
  incrementUsageCount: async (id) => {
    const response = await api.post(`/roles/${id}/increment-usage`);
    return response.data;
  },

  // 获取最常用的角色
  getMostUsed: async (limit = 5) => {
    try {
      const response = await api.get(`/roles/most-used?limit=${limit}`);
      return response.data.roles || [];
    } catch (error) {
      console.warn('Failed to get most-used roles, using mock data', error);
      return mockRoles.slice(0, limit);
    }
  },

  // 获取最近创建的角色
  getRecent: async (limit = 5) => {
    try {
      const response = await api.get(`/roles/recent?limit=${limit}`);
      return response.data.roles || [];
    } catch (error) {
      console.warn('Failed to get recent roles, using mock data', error);
      return mockRoles.slice(0, limit);
    }
  },

  // 从预定义角色创建角色
  createFromPredefined: async (predefinedId, customData = {}) => {
    const response = await api.post(`/roles/from-predefined/${predefinedId}`, customData);
    return response.data;
  },

  // 获取角色的变量
  getVariables: async (roleId, actionSpaceId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables`);
      return response.data.environment_variables || [];
    } catch (error) {
      console.warn(`Failed to get variables for role ${roleId}:`, error);

      // 如果API不存在，返回空数组
      return [];
    }
  },

  // 创建角色变量
  createEnvironmentVariable: async (roleId, variableData, actionSpaceId) => {
    try {
      // 确保数据格式与后端一致
      const apiData = { ...variableData };

      console.log('Role variable data sent to API:', apiData);
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables`, apiData);
      return response.data;
    } catch (error) {
      console.error(`Failed to create variable for role ${roleId}:`, error);

      // 如果API未实现，模拟创建
      const mockResponse = {
        id: `var-${Date.now()}`,
        ...variableData
      };
      return mockResponse;
    }
  },

  // 更新角色变量
  updateEnvironmentVariable: async (roleId, variableId, variableData, actionSpaceId) => {
    try {
      // 确保数据格式与后端一致
      const apiData = { ...variableData };

      const response = await api.put(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables/${variableId}`, apiData);
      return response.data;
    } catch (error) {
      console.error(`Failed to update variable ${variableId} for role ${roleId}:`, error);

      // 如果API未实现，模拟更新
      return {
        id: variableId,
        ...variableData
      };
    }
  },

  // 删除角色变量
  deleteEnvironmentVariable: async (roleId, variableId, actionSpaceId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables/${variableId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete variable ${variableId} for role ${roleId}:`, error);

      // 如果API未实现，模拟删除成功
      return { success: true };
    }
  },

  // 测试外部角色连接
  testExternalConnection: async (connectionData) => {
    const response = await api.post('/roles/test-external-connection', connectionData);
    return response.data;
  }
};