import api from '../axios';

/**
 * TiDB向量数据库API服务
 * 提供与TiDB向量数据库相关的API函数
 * 路径: /api/vector-db/tidb/*
 */
const tidbAPI = {
  /**
   * 验证TiDB配置
   * @param {string} connectionString TiDB连接字符串
   * @returns {Promise<Object>} 验证结果
   */
  validateConfig: async (connectionString) => {
    try {
      const response = await api.post('/vector-db/tidb/config/validate', {
        connection_string: connectionString
      });
      return response.data;
    } catch (error) {
      console.error('验证TiDB配置失败:', error);
      throw error;
    }
  },

  /**
   * 测试TiDB连接
   * @param {string} connectionString TiDB连接字符串
   * @returns {Promise<Object>} 连接测试结果
   */
  testConnection: async (connectionString) => {
    try {
      const response = await api.post('/vector-db/tidb/connection/test', {
        connection_string: connectionString
      });
      return response.data;
    } catch (error) {
      console.error('测试TiDB连接失败:', error);
      throw error;
    }
  },

  /**
   * 测试TiDB向量操作
   * @param {string} connectionString TiDB连接字符串
   * @returns {Promise<Object>} 向量操作测试结果
   */
  testVectorOperations: async (connectionString) => {
    try {
      const response = await api.post('/vector-db/tidb/connection/test-vector', {
        connection_string: connectionString
      });
      return response.data;
    } catch (error) {
      console.error('测试TiDB向量操作失败:', error);
      throw error;
    }
  },

  /**
   * 解析TiDB连接字符串
   * @param {string} connectionString TiDB连接字符串
   * @returns {Promise<Object>} 解析结果
   */
  parseConnectionString: async (connectionString) => {
    try {
      const response = await api.post('/vector-db/tidb/config/parse', {
        connection_string: connectionString
      });
      return response.data;
    } catch (error) {
      console.error('解析TiDB连接字符串失败:', error);
      throw error;
    }
  },

  /**
   * 获取TiDB向量数据库信息
   * @returns {Promise<Object>} 系统信息
   */
  getInfo: async () => {
    try {
      const response = await api.get('/vector-db/tidb/info');
      return response.data;
    } catch (error) {
      console.error('获取TiDB信息失败:', error);
      throw error;
    }
  },

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  healthCheck: async () => {
    try {
      const response = await api.get('/vector-db/tidb/health');
      return response.data;
    } catch (error) {
      console.error('TiDB健康检查失败:', error);
      throw error;
    }
  },

  /**
   * 获取嵌入模型列表
   * @returns {Promise<Object>} 嵌入模型列表
   */
  getEmbeddingModels: async () => {
    try {
      const response = await api.get('/vector-db/tidb/embedding/models');
      return response.data;
    } catch (error) {
      console.error('获取嵌入模型列表失败:', error);
      throw error;
    }
  },

  /**
   * 测试嵌入模型
   * @param {number} modelId 模型ID
   * @param {string} text 测试文本
   * @returns {Promise<Object>} 测试结果
   */
  testEmbeddingModel: async (modelId, text = '这是一个测试文本') => {
    try {
      const response = await api.post('/vector-db/tidb/embedding/test', {
        model_id: modelId,
        text: text
      });
      return response.data;
    } catch (error) {
      console.error('测试嵌入模型失败:', error);
      throw error;
    }
  },

  /**
   * 生成嵌入向量
   * @param {Array<string>} texts 文本列表
   * @param {number} modelId 模型ID（可选）
   * @returns {Promise<Object>} 生成结果
   */
  generateEmbeddings: async (texts, modelId = null) => {
    try {
      const requestData: any = { texts };
      if (modelId) {
        requestData.model_id = modelId;
      }
      
      const response = await api.post('/vector-db/tidb/embedding/generate', requestData);
      return response.data;
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      throw error;
    }
  },

  /**
   * 列出向量表
   * @returns {Promise<Object>} 向量表列表
   */
  listTables: async () => {
    try {
      const response = await api.get('/vector-db/tidb/tables');
      return response.data;
    } catch (error) {
      console.error('列出向量表失败:', error);
      throw error;
    }
  },

  /**
   * 创建向量表
   * @param {string} tableName 表名
   * @param {Object} config 表配置
   * @returns {Promise<Object>} 创建结果
   */
  createTable: async (tableName, config = {}) => {
    try {
      const response = await api.post(`/vector-db/tidb/tables/${tableName}`, config);
      return response.data;
    } catch (error) {
      console.error('创建向量表失败:', error);
      throw error;
    }
  },

  /**
   * 删除向量表
   * @param {string} tableName 表名
   * @returns {Promise<Object>} 删除结果
   */
  deleteTable: async (tableName) => {
    try {
      const response = await api.delete(`/vector-db/tidb/tables/${tableName}`);
      return response.data;
    } catch (error) {
      console.error('删除向量表失败:', error);
      throw error;
    }
  },

  /**
   * 获取表信息
   * @param {string} tableName 表名
   * @returns {Promise<Object>} 表信息
   */
  getTableInfo: async (tableName) => {
    try {
      const response = await api.get(`/vector-db/tidb/tables/${tableName}/info`);
      return response.data;
    } catch (error) {
      console.error('获取表信息失败:', error);
      throw error;
    }
  },

  /**
   * 语义搜索
   * @param {string} tableName 表名
   * @param {Object} searchParams 搜索参数
   * @returns {Promise<Object>} 搜索结果
   */
  semanticSearch: async (tableName, searchParams) => {
    try {
      const response = await api.post(`/vector-db/tidb/tables/${tableName}/search`, searchParams);
      return response.data;
    } catch (error) {
      console.error('语义搜索失败:', error);
      throw error;
    }
  }
};

export { tidbAPI };
export default tidbAPI;
