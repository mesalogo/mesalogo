import api from './axios';

const graphEnhancementAPI = {
  // 获取配置
  getConfig: async () => {
    const response = await api.get('/graph-enhancement/config');
    return response.data;
  },

  // 保存配置
  saveConfig: async (data) => {
    const response = await api.post('/graph-enhancement/config', data);
    return response.data;
  },

  // 更新配置（别名）
  updateConfig: async (data) => {
    const response = await api.post('/graph-enhancement/config', data);
    return response.data;
  },

  // 获取状态
  getStatus: async () => {
    const response = await api.get('/graph-enhancement/status');
    return response.data;
  },



  // 测试查询
  testQuery: async (data) => {
    // 根据是否为高级模式选择不同的端点
    if (data.advanced_mode) {
      const response = await api.post('/graph-enhancement/test-advanced-query', data);
      return response.data;
    } else {
      const response = await api.post('/graph-enhancement/test-query', data);
      return response.data;
    }
  },

  // 高级测试查询
  testAdvancedQuery: async (data) => {
    const response = await api.post('/graph-enhancement/test-advanced-query', data);
    return response.data;
  },

  // 重建索引
  rebuildIndex: async () => {
    const response = await api.post('/graph-enhancement/rebuild-index');
    return response.data;
  },

  // 清空图谱数据
  clearGraph: async () => {
    const response = await api.post('/graph-enhancement/clear-graph');
    return response.data;
  },

  // 服务控制
  controlService: async (data) => {
    const response = await api.post('/graph-enhancement/service-control', data);
    return response.data;
  },

  // 获取图谱可视化数据
  getVisualizationData: async (params = {}) => {
    const response = await api.get('/graph-enhancement/visualization/data', { params });
    return response.data;
  },

  // 获取图谱数据库信息
  getVisualizationInfo: async () => {
    const response = await api.get('/graph-enhancement/visualization/info');
    return response.data;
  },

  // 获取图谱可视化配置
  getVisualizationConfig: async () => {
    const response = await api.get('/graph-enhancement/visualization/config');
    return response.data;
  },

  // 手动构建社区
  buildCommunities: async () => {
    const response = await api.post('/graph-enhancement/build-communities');
    return response.data;
  },
};

export default graphEnhancementAPI;