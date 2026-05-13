import api from './axios';

const knowledgeAPI = {
  // 获取所有知识库
  getAll: async () => {
    const response = await api.get('/knowledges');
    return response.data;
  },

  // 获取知识库详情
  getById: async (id) => {
    const response = await api.get(`/knowledges/${id}`);
    return response.data;
  },

  // 创建知识库
  create: async (data) => {
    const response = await api.post('/knowledges', data);
    return response.data;
  },

  // 更新知识库
  update: async (id, data) => {
    const response = await api.put(`/knowledges/${id}`, data);
    return response.data;
  },

  // 删除知识库
  delete: async (id) => {
    const response = await api.delete(`/knowledges/${id}`);
    return response.data;
  },

  // 获取角色挂载的知识库
  getRoleKnowledges: async (roleId) => {
    const response = await api.get(`/roles/${roleId}/knowledges`);
    return response.data;
  },

  // 为角色挂载知识库
  mountToRole: async (roleId, knowledgeId) => {
    const response = await api.post(`/roles/${roleId}/knowledges/${knowledgeId}`);
    return response.data;
  },

  // 为角色解除知识库
  unmountFromRole: async (roleId, knowledgeId) => {
    const response = await api.delete(`/roles/${roleId}/knowledges/${knowledgeId}`);
    return response.data;
  },

  // 文件管理
  getAllFiles: async () => {
    const response = await api.get('/knowledges/files');
    return response.data;
  },

  getFiles: async (knowledgeId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/files`);
    return response.data;
  },

  uploadFile: async (knowledgeId, formData) => {
    const response = await api.post(`/knowledges/${knowledgeId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteFile: async (knowledgeId, filename) => {
    const response = await api.delete(`/knowledges/${knowledgeId}/files/${filename}`);
    return response.data;
  },

  getFileContent: async (knowledgeId, filename) => {
    const response = await api.get(`/knowledges/${knowledgeId}/files/${filename}/content`);
    return response.data;
  },

  // 搜索
  search: async (knowledgeId: any, query: any, options: any = {}) => {
    const requestData: any = { query };
    
    // 添加可选的检索参数
    if (options.top_k !== undefined) {
      requestData.top_k = options.top_k;
    }
    if (options.score_threshold !== undefined) {
      requestData.score_threshold = options.score_threshold;
    }
    
    const response = await api.post(`/knowledges/${knowledgeId}/search`, requestData);
    return response.data;
  },

  // 向量化处理
  vectorize: async (knowledgeId) => {
    const response = await api.post(`/knowledges/${knowledgeId}/vectorize`);
    return response.data;
  },

  // LightRAG 集成 API
  lightrag: {
    // 上传文档到 LightRAG
    upload: async (knowledgeId: string, data: { file_path?: string; file_paths?: string[]; workspace?: string }) => {
      const response = await api.post(`/knowledge/${knowledgeId}/lightrag/upload`, data);
      return response.data;
    },

    // 同步所有文档到 LightRAG
    syncAll: async (knowledgeId: string) => {
      const response = await api.post(`/knowledge/${knowledgeId}/lightrag/sync-all`);
      return response.data;
    },

    // 查询 LightRAG 知识库
    query: async (knowledgeId: string, data: { 
      query: string; 
      mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
      top_k?: number;
      response_type?: string;
    }) => {
      const response = await api.post(`/knowledge/${knowledgeId}/lightrag/query`, data);
      return response.data;
    },

    // 获取 LightRAG 文档列表
    getDocuments: async (knowledgeId: string) => {
      const response = await api.get(`/knowledge/${knowledgeId}/lightrag/documents`);
      return response.data;
    },

    // 删除 LightRAG 文档
    deleteDocument: async (knowledgeId: string, documentId: string) => {
      const response = await api.delete(`/knowledge/${knowledgeId}/lightrag/documents/${documentId}`);
      return response.data;
    },

    // 获取知识图谱数据
    getGraph: async (knowledgeId: string, limit: number = 100) => {
      const response = await api.get(`/knowledge/${knowledgeId}/lightrag/graph`, {
        params: { limit }
      });
      return response.data;
    },
  },

  // 文件转换相关
  convertFile: async (knowledgeId, documentId) => {
    const response = await api.post(`/knowledges/${knowledgeId}/documents/${documentId}/convert`);
    return response.data;
  },

  getConversionStatus: async (knowledgeId, documentId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/documents/${documentId}/conversion-status`);
    return response.data;
  },

  getMarkdownContent: async (knowledgeId, documentId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/documents/${documentId}/markdown`);
    return response.data;
  },

  // 文件分段相关
  chunkFile: async (knowledgeId, documentId) => {
    const response = await api.post(`/knowledges/${knowledgeId}/documents/${documentId}/chunk`);
    return response.data;
  },

  getChunkingStatus: async (knowledgeId, documentId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/documents/${documentId}/chunking-status`);
    return response.data;
  },

  getFileChunks: async (knowledgeId, documentId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/documents/${documentId}/chunks`);
    return response.data;
  },

  // 文件嵌入相关（向量化）
  embedFile: async (knowledgeId, documentId) => {
    const response = await api.post(`/knowledges/${knowledgeId}/documents/${documentId}/embed`);
    return response.data;
  },

  getEmbeddingStatus: async (knowledgeId, documentId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/documents/${documentId}/embedding-status`);
    return response.data;
  },

  // 一键处理（完整流程）
  processFile: async (knowledgeId, documentId) => {
    const response = await api.post(`/knowledges/${knowledgeId}/documents/${documentId}/process`);
    return response.data;
  },

  // ========== 分段配置相关 ==========
  
  // 获取知识库的分段配置
  getChunkConfig: async (knowledgeId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/chunk-config`);
    return response.data;
  },

  // 更新知识库的分段配置
  updateChunkConfig: async (knowledgeId, data) => {
    const response = await api.put(`/knowledges/${knowledgeId}/chunk-config`, data);
    return response.data;
  },

  // 获取所有默认配置
  getDefaultConfigs: async () => {
    const response = await api.get('/knowledges/chunk-config/defaults');
    return response.data;
  },

  // ========== 检索配置相关 ==========
  
  // 获取知识库的检索配置（支持向量和 LightRAG 两种类型）
  getSearchConfig: async (knowledgeId) => {
    const response = await api.get(`/knowledges/${knowledgeId}/search-config`);
    return response.data;
  },

  // 更新知识库的检索配置（支持向量和 LightRAG 两种类型）
  updateSearchConfig: async (knowledgeId, data) => {
    const response = await api.put(`/knowledges/${knowledgeId}/search-config`, data);
    return response.data;
  },

  // 获取 LightRAG 检索配置的默认值和可选项
  getLightRAGConfigDefaults: async () => {
    const response = await api.get('/knowledges/lightrag-config/defaults');
    return response.data;
  },

  // 复制 Markdown 到行动任务工作空间
  copyMarkdownToWorkspace: async (knowledgeId: string, documentId: string, taskId: string, targetPath?: string) => {
    const response = await api.post(`/knowledges/${knowledgeId}/documents/${documentId}/copy-to-workspace`, {
      task_id: taskId,
      target_path: targetPath
    });
    return response.data;
  },
};

export default knowledgeAPI;