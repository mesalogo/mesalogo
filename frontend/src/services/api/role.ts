import api from './axios';

// 模拟角色数据
const mockRoles = [
  { id: 'role-001', name: '战略分析专家', description: '擅长市场趋势分析和战略规划', model_id: 'gpt-4', prompt_template: '你是一位战略分析专家...' },
  { id: 'role-002', name: '财务专家', description: '专注于财务分析和资源分配优化', model_id: 'gpt-4', prompt_template: '你是一位财务专家...' },
  { id: 'role-003', name: '市场营销专家', description: '擅长市场营销策略和竞争分析', model_id: 'gpt-4', prompt_template: '你是一位市场营销专家...' },
  { id: 'role-004', name: '运营专家', description: '专注于企业运营优化和效率提升', model_id: 'gpt-4', prompt_template: '你是一位运营专家...' },
  { id: 'role-005', name: '法律顾问', description: '专注于法律分析和风险评估', model_id: 'gpt-4', prompt_template: '你是一位法律顾问...' },
  { id: 'role-006', name: '教育专家', description: '擅长教育方案设计和学习路径规划', model_id: 'gpt-4', prompt_template: '你是一位教育专家...' },
  { id: 'role-007', name: '农业专家', description: '专注于农业生产优化和资源管理', model_id: 'gpt-4', prompt_template: '你是一位农业专家...' },
  { id: 'role-008', name: '医疗顾问', description: '擅长医疗诊断和治疗方案制定', model_id: 'gpt-4', prompt_template: '你是一位医疗顾问...' }
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
      console.warn('获取角色失败，使用模拟数据', error);
      return mockRoles;
    }
  },

  // 获取所有角色及其详细信息（包括能力和知识库）
  getAllWithDetails: async () => {
    try {
      const response = await api.get('/roles/with-details');
      return response.data;
    } catch (error) {
      console.error('获取角色详细信息失败:', error);
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
      console.error('获取角色知识库绑定关系失败:', error);
      throw error;
    }
  },

  // 获取可用角色
  getAvailableRoles: async () => {
    try {
      // 复用getAll方法
      return await roleAPI.getAll();
    } catch (error) {
      console.error('获取可用角色失败:', error);
      throw error;
    }
  },

  // 获取单个角色
  getById: async (id) => {
    try {
      const response = await api.get(`/roles/${id}`);
      return response.data;
    } catch (error) {
      console.warn(`获取角色${id}失败，使用模拟数据`, error);
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
        console.warn('警告: temperature字段缺失，使用默认值0.7');
        apiData.temperature = 0.7;
      }
    }

    // 检查并记录所有字段
    console.log('更新角色请求数据 - ID:', id);
    console.log('更新角色请求数据 - 完整数据:', JSON.stringify(apiData, null, 2));

    if (apiData.source === 'external') {
      console.log('更新外部角色请求数据 - 字段检查:', {
        name: apiData.name ? '✓' : '✗',
        description: apiData.description ? '✓' : '✗',
        source: apiData.source ? '✓' : '✗',
        external_type: apiData.external_type ? '✓' : '✗',
        external_config: apiData.external_config ? '✓' : '✗'
      });
    } else {
      console.log('更新内部角色请求数据 - 字段检查:', {
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
      console.log('尝试从完整的模型配置API获取数据...');
      const completeResponse = await api.get('/model-configs');
      console.log('成功获取完整模型配置:', completeResponse.data.model_configs);
      return completeResponse.data.model_configs;
    } catch (modelConfigError) {
      console.warn('无法从模型配置API获取数据，尝试使用角色API获取模型配置:', modelConfigError);

      try {
        // 回退到使用角色API
        const response = await api.get('/roles/model-configs');
        console.log('从角色API获取到的模型配置:', response.data.model_configs);
        return response.data.model_configs;
      } catch (error) {
        console.warn('获取模型配置失败，使用模拟数据', error);
        return [
          { id: 'gpt-4', name: 'GPT-4', description: '强大的大语言模型' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '平衡性能与成本的模型' }
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

    console.log(`测试角色 ${roleId} 请求数据:`, data);
    const response = await api.post(`/roles/${roleId}/test`, data);
    return response.data;
  },

  // 获取预定义角色列表
  getRoles: async () => {
    try {
      const response = await api.get('/roles/predefined');
      return response.data.predefined_roles || [];
    } catch (error) {
      console.warn('获取预定义角色失败，使用模拟数据', error);
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
      console.warn('获取常用角色失败，使用模拟数据', error);
      return mockRoles.slice(0, limit);
    }
  },

  // 获取最近创建的角色
  getRecent: async (limit = 5) => {
    try {
      const response = await api.get(`/roles/recent?limit=${limit}`);
      return response.data.roles || [];
    } catch (error) {
      console.warn('获取最近角色失败，使用模拟数据', error);
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
      console.warn(`获取角色${roleId}的变量失败:`, error);

      // 如果API不存在，返回空数组
      return [];
    }
  },

  // 创建角色变量
  createEnvironmentVariable: async (roleId, variableData, actionSpaceId) => {
    try {
      // 确保数据格式与后端一致
      const apiData = { ...variableData };

      console.log(`发送到API的角色变量数据:`, apiData);
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables`, apiData);
      return response.data;
    } catch (error) {
      console.error(`为角色${roleId}创建变量失败:`, error);

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
      console.error(`更新角色${roleId}的变量${variableId}失败:`, error);

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
      console.error(`删除角色${roleId}的变量${variableId}失败:`, error);

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