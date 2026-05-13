import api from './axios';

const externalKnowledgeAPI = {
  // ==================== 提供商管理接口 ====================

  // 获取所有提供商
  getProviders: async () => {
    const response = await api.get('/external-kb/providers');
    return response.data;
  },

  // 创建提供商
  createProvider: async (data) => {
    const response = await api.post('/external-kb/providers', data);
    return response.data;
  },

  // 更新提供商
  updateProvider: async (id, data) => {
    const response = await api.put(`/external-kb/providers/${id}`, data);
    return response.data;
  },

  // 删除提供商
  deleteProvider: async (id) => {
    const response = await api.delete(`/external-kb/providers/${id}`);
    return response.data;
  },

  // 测试提供商连接
  testProviderConnection: async (id) => {
    const response = await api.post(`/external-kb/providers/${id}/test`);
    return response.data;
  },

  // ==================== 外部知识库管理接口 ====================

  // 获取所有外部知识库
  getExternalKnowledges: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/external-kb/knowledges${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  // 创建外部知识库
  createExternalKnowledge: async (data) => {
    const response = await api.post('/external-kb/knowledges', data);
    return response.data;
  },

  // 更新外部知识库
  updateExternalKnowledge: async (id, data) => {
    const response = await api.put(`/external-kb/knowledges/${id}`, data);
    return response.data;
  },

  // 删除外部知识库
  deleteExternalKnowledge: async (id) => {
    const response = await api.delete(`/external-kb/knowledges/${id}`);
    return response.data;
  },

  // 查询外部知识库
  queryExternalKnowledge: async (id, data) => {
    const response = await api.post(`/external-kb/knowledges/${id}/query`, data);
    return response.data;
  },

  // ==================== 角色关联管理接口 ====================

  // 获取角色绑定的外部知识库
  getRoleExternalKnowledges: async (roleId) => {
    const response = await api.get(`/roles/${roleId}/external-knowledges`);
    return response.data;
  },

  // 为角色绑定外部知识库
  bindRoleExternalKnowledge: async (roleId, knowledgeId, config = {}) => {
    const response = await api.post(`/roles/${roleId}/external-knowledges/${knowledgeId}`, { config });
    return response.data;
  },

  // 解除角色外部知识库绑定
  unbindRoleExternalKnowledge: async (roleId, knowledgeId) => {
    const response = await api.delete(`/roles/${roleId}/external-knowledges/${knowledgeId}`);
    return response.data;
  },

  // 批量绑定外部知识库到角色
  batchBindRoleExternalKnowledges: async (roleId, knowledgeIds, config = {}) => {
    const response = await api.post(`/roles/${roleId}/external-knowledges/batch`, {
      knowledge_ids: knowledgeIds,
      config
    });
    return response.data;
  },

  // 批量解除角色外部知识库绑定
  batchUnbindRoleExternalKnowledges: async (roleId, knowledgeIds) => {
    const response = await api.delete(`/roles/${roleId}/external-knowledges/batch`, {
      data: { knowledge_ids: knowledgeIds }
    });
    return response.data;
  },

  // ==================== 统计和监控接口 ====================

  // 获取外部知识库使用统计
  getExternalKnowledgeStats: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/external-kb/stats${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  // 获取查询日志
  getQueryLogs: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/external-kb/query-logs${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  // ==================== 辅助接口 ====================

  // 获取所有角色（用于角色选择）
  getAllRoles: async (actionSpaceId = null) => {
    const url = actionSpaceId ? `/roles?action_space_id=${actionSpaceId}` : '/roles';
    const response = await api.get(url);
    return response.data;
  },

  // 获取提供商下的知识库列表
  getProviderKnowledges: async (providerId) => {
    const response = await api.get(`/external-kb/knowledges?provider_id=${providerId}`);
    return response.data;
  },

  // 验证外部知识库配置
  validateExternalKnowledgeConfig: async (data) => {
    const response = await api.post('/external-kb/validate-config', data);
    return response.data;
  },

  // 同步外部知识库信息
  syncExternalKnowledge: async (id) => {
    const response = await api.post(`/external-kb/knowledges/${id}/sync`);
    return response.data;
  },

  // 获取外部知识库详情
  getExternalKnowledgeDetail: async (id) => {
    const response = await api.get(`/external-kb/knowledges/${id}`);
    return response.data;
  },

  // 获取提供商详情
  getProviderDetail: async (id) => {
    const response = await api.get(`/external-kb/providers/${id}`);
    return response.data;
  },

  // 批量操作外部知识库状态
  batchUpdateExternalKnowledgeStatus: async (ids, status) => {
    const response = await api.put('/external-kb/knowledges/batch-status', {
      ids,
      status
    });
    return response.data;
  },

  // 导出外部知识库配置
  exportExternalKnowledgeConfig: async (ids) => {
    const response = await api.post('/external-kb/export-config', { ids });
    return response.data;
  },

  // 导入外部知识库配置
  importExternalKnowledgeConfig: async (configData) => {
    const response = await api.post('/external-kb/import-config', configData);
    return response.data;
  },

  // 获取外部知识库类型支持的配置选项
  getProviderTypeConfig: async (type) => {
    const response = await api.get(`/external-kb/provider-types/${type}/config`);
    return response.data;
  },

  // 预览外部知识库查询结果
  previewExternalKnowledgeQuery: async (id, query) => {
    const response = await api.post(`/external-kb/knowledges/${id}/preview`, { query });
    return response.data;
  },

  // 获取外部知识库健康状态
  getExternalKnowledgeHealth: async (id) => {
    const response = await api.get(`/external-kb/knowledges/${id}/health`);
    return response.data;
  },

  // 刷新外部知识库连接状态
  refreshExternalKnowledgeStatus: async (id) => {
    const response = await api.post(`/external-kb/knowledges/${id}/refresh-status`);
    return response.data;
  },

  // 获取角色可用的外部知识库列表（排除已绑定的）
  getAvailableExternalKnowledgesForRole: async (roleId) => {
    const response = await api.get(`/roles/${roleId}/available-external-knowledges`);
    return response.data;
  },

  // 复制外部知识库配置
  duplicateExternalKnowledge: async (id, newName) => {
    const response = await api.post(`/external-kb/knowledges/${id}/duplicate`, { name: newName });
    return response.data;
  },

  // 测试外部知识库查询
  testExternalKnowledgeQuery: async (id, testQuery = '测试查询') => {
    const response = await api.post(`/external-kb/knowledges/${id}/query`, {
      query: testQuery,
      params: {} // 使用空的params，让知识库配置的query_config生效
    });
    return response.data;
  },

  // 测试外部知识库查询（带自定义参数）
  testExternalKnowledgeQueryWithParams: async (id, testQuery, customParams = {}) => {
    const response = await api.post(`/external-kb/knowledges/${id}/query`, {
      query: testQuery,
      params: customParams
    });
    return response.data;
  },

  // ==================== 第二阶段新增接口 ====================

  // 测试外部知识库连接
  testExternalKnowledgeConnection: async (id) => {
    const response = await api.post(`/external-kb/knowledges/${id}/test`);
    return response.data;
  },

  // 获取外部知识库详细信息
  getExternalKnowledgeInfo: async (id) => {
    const response = await api.get(`/external-kb/knowledges/${id}/info`);
    return response.data;
  },

  // 获取支持的提供商类型
  getProviderTypes: async () => {
    const response = await api.get('/external-kb/provider-types');
    return response.data;
  },

  // 获取提供商类型的默认配置
  getProviderTypeDefaultConfig: async (type) => {
    const response = await api.get(`/external-kb/provider-types/${type}/config`);
    return response.data;
  },

  // 为角色查询外部知识库
  queryRoleExternalKnowledges: async (roleId, data) => {
    const response = await api.post(`/roles/${roleId}/external-knowledges/query`, data);
    return response.data;
  }
};

export default externalKnowledgeAPI;
