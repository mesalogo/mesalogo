import api from '../axios';
import tidbAPI from './tidb';

/**
 * 通用向量数据库API服务
 * 支持所有向量数据库提供商的连接测试和管理
 * 路径: /api/vector-db/*
 */
const vectorDatabaseAPI = {
  /**
   * 测试向量数据库连接
   * @param {string} provider 提供商名称
   * @param {Object} config 连接配置
   * @returns {Promise<Object>} 测试结果
   */
  testConnection: async (provider, config) => {
    try {
      const response = await api.post('/vector-db/test-connection', {
        provider,
        config
      });
      return response.data;
    } catch (error) {
      console.error(`测试${provider}连接失败:`, error);
      throw error;
    }
  },

  /**
   * 验证向量数据库配置
   * @param {string} provider 提供商名称
   * @param {Object} config 配置参数
   * @returns {Promise<Object>} 验证结果
   */
  validateConfig: async (provider, config) => {
    try {
      const response = await api.post('/vector-db/validate-config', {
        provider,
        config
      });
      return response.data;
    } catch (error) {
      console.error(`验证${provider}配置失败:`, error);
      throw error;
    }
  },

  /**
   * 获取向量数据库信息
   * @param {string} provider 提供商名称
   * @param {Object} config 连接配置
   * @returns {Promise<Object>} 数据库信息
   */
  getDatabaseInfo: async (provider, config) => {
    try {
      const response = await api.post('/vector-db/info', {
        provider,
        config
      });
      return response.data;
    } catch (error) {
      console.error(`获取${provider}信息失败:`, error);
      throw error;
    }
  },

  /**
   * 获取支持的向量数据库提供商列表
   * @returns {Promise<Object>} 提供商列表
   */
  getSupportedProviders: async () => {
    try {
      const response = await api.get('/vector-db/providers');
      return response.data;
    } catch (error) {
      console.error('获取支持的提供商列表失败:', error);
      throw error;
    }
  },

  /**
   * 获取提供商的配置模板
   * @param {string} provider 提供商名称
   * @returns {Promise<Object>} 配置模板
   */
  getConfigTemplate: async (provider) => {
    try {
      const response = await api.get(`/vector-db/providers/${provider}/template`);
      return response.data;
    } catch (error) {
      console.error(`获取${provider}配置模板失败:`, error);
      throw error;
    }
  },

  /**
   * 测试向量操作
   * @param {string} provider 提供商名称
   * @param {Object} config 连接配置
   * @returns {Promise<Object>} 测试结果
   */
  testVectorOperations: async (provider, config) => {
    try {
      const response = await api.post('/vector-db/test-vector-operations', {
        provider,
        config
      });
      return response.data;
    } catch (error) {
      console.error(`测试${provider}向量操作失败:`, error);
      throw error;
    }
  },

  /**
   * 获取向量数据库健康状态
   * @param {string} provider 提供商名称
   * @param {Object} config 连接配置
   * @returns {Promise<Object>} 健康状态
   */
  getHealthStatus: async (provider, config) => {
    try {
      const response = await api.post('/vector-db/health', {
        provider,
        config
      });
      return response.data;
    } catch (error) {
      console.error(`获取${provider}健康状态失败:`, error);
      throw error;
    }
  }
};

/**
 * 向量数据库提供商配置验证规则
 */
export const PROVIDER_CONFIG_RULES = {
  aliyun: {
    required: ['apiKey', 'endpoint'],
    optional: ['region']
  },
  tidb: {
    required: ['connectionString'],
    optional: []
  },
  'aws-opensearch': {
    required: ['accessKeyId', 'secretAccessKey', 'region', 'endpoint'],
    optional: ['sessionToken']
  },
  'aws-bedrock': {
    required: ['accessKeyId', 'secretAccessKey', 'region', 'knowledgeBaseId'],
    optional: ['sessionToken']
  },
  'azure-cognitive-search': {
    required: ['endpoint', 'apiKey', 'indexName'],
    optional: ['apiVersion']
  },
  'azure-cosmos-db': {
    required: ['endpoint', 'primaryKey', 'databaseName', 'containerName'],
    optional: []
  },
  'gcp-vertex-ai': {
    required: ['projectId', 'location', 'indexEndpoint', 'serviceAccountKey'],
    optional: []
  },
  'gcp-firestore': {
    required: ['projectId', 'serviceAccountKey', 'collectionName'],
    optional: ['databaseId']
  },
  pinecone: {
    required: ['apiKey', 'environment', 'indexName'],
    optional: []
  },
  weaviate: {
    required: ['endpoint'],
    optional: ['apiKey', 'username', 'password']
  },
  qdrant: {
    required: ['endpoint'],
    optional: ['apiKey', 'collectionName']
  },
  chroma: {
    required: ['endpoint'],
    optional: ['apiKey', 'collectionName']
  },
  milvus: {
    required: ['endpoint'],
    optional: ['username', 'password']
  },
  elasticsearch: {
    required: ['endpoint'],
    optional: ['username', 'password', 'indexName']
  },
  custom: {
    required: ['endpoint'],
    optional: ['apiKey', 'username', 'password']
  }
};

/**
 * 向量数据库提供商显示名称
 */
export const PROVIDER_DISPLAY_NAMES = {
  aliyun: '阿里云 DashVector',
  tidb: 'TiDB Cloud',
  'aws-opensearch': 'AWS OpenSearch',
  'aws-bedrock': 'AWS Bedrock Knowledge Base',
  'azure-cognitive-search': 'Azure Cognitive Search',
  'azure-cosmos-db': 'Azure Cosmos DB',
  'gcp-vertex-ai': 'Google Cloud Vertex AI Vector Search',
  'gcp-firestore': 'Google Cloud Firestore',
  pinecone: 'Pinecone',
  weaviate: 'Weaviate',
  qdrant: 'Qdrant',
  chroma: 'Chroma',
  milvus: 'Milvus',
  elasticsearch: 'Elasticsearch',
  custom: '自定义'
};

/**
 * 验证提供商配置是否完整
 * @param {string} provider 提供商名称
 * @param {Object} config 配置对象
 * @returns {Object} 验证结果 {valid: boolean, missing: string[]}
 */
export const validateProviderConfig = (provider, config) => {
  const rules = PROVIDER_CONFIG_RULES[provider];
  if (!rules) {
    return { valid: false, missing: [], error: `不支持的提供商: ${provider}` };
  }

  const missing = [];
  for (const field of rules.required) {
    if (!config[field] || config[field].trim() === '') {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    error: missing.length > 0 ? `缺少必需字段: ${missing.join(', ')}` : null
  };
};

/**
 * 获取提供商的友好显示名称
 * @param {string} provider 提供商名称
 * @returns {string} 显示名称
 */
export const getProviderDisplayName = (provider) => {
  return PROVIDER_DISPLAY_NAMES[provider] || provider;
};

// 导出通用API和TiDB专用API
export { vectorDatabaseAPI, tidbAPI };
export default vectorDatabaseAPI;
