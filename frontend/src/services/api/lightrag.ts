/**
 * LightRAG 知识库 API 服务
 * 
 * 提供与后端 LightRAG 容器化服务的交互
 */
import api from './axios';

export interface LightRAGConfig {
  id?: number;
  enabled: boolean;
  framework: string;
  name?: string;
  description?: string;
  framework_config?: {
    service_url?: string;
    partition_strategy?: string;
    chunk_size?: number;
    chunk_overlap?: number;
    summary_language?: string;
    top_k?: number;
    text_model_id?: string | number;
    embedding_model_id?: string | number;
    embedding_dimension?: number;
    rerank_model_id?: string | number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface LightRAGStatus {
  enabled: boolean;
  status: 'healthy' | 'unhealthy' | 'unreachable' | 'disabled' | 'not_configured' | 'error';
  message?: string;
  error?: string;
  framework?: string;
  statistics?: {
    workspace_count?: number;
    document_count?: number;
  };
  details?: any;
}

export interface LightRAGQueryParams {
  query: string;
  workspace?: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  top_k?: number;
  response_type?: string;
}

export interface LightRAGQueryResult {
  query: string;
  result: any;
  response_time: number;
  query_params: {
    mode: string;
    top_k: number;
    workspace: string;
  };
  framework: string;
}

const lightragAPI = {
  // ==================== 配置管理 ====================
  
  /**
   * 获取 LightRAG 配置
   */
  getConfig: async (): Promise<{ success: boolean; data?: LightRAGConfig; message?: string }> => {
    const response = await api.get('/lightrag/config');
    return response.data;
  },

  /**
   * 保存 LightRAG 配置
   */
  saveConfig: async (config: Partial<LightRAGConfig>): Promise<{ success: boolean; message?: string; data?: any }> => {
    const response = await api.post('/lightrag/config', config);
    return response.data;
  },

  // ==================== 服务状态 ====================

  /**
   * 获取 LightRAG 服务状态
   */
  getStatus: async (): Promise<{ success: boolean; data?: LightRAGStatus; message?: string }> => {
    const response = await api.get('/lightrag/status');
    return response.data;
  },

  /**
   * 检查 LightRAG 服务健康状态
   */
  healthCheck: async (): Promise<LightRAGStatus> => {
    const response = await api.get('/lightrag/health');
    return response.data;
  },

  // ==================== 配置同步 ====================

  /**
   * 同步配置到 LightRAG 容器
   */
  syncConfig: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post('/lightrag/sync');
    return response.data;
  },

  // ==================== 服务控制 ====================

  /**
   * 控制 LightRAG 服务（启动/停止）
   */
  controlService: async (action: 'start' | 'stop'): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post('/lightrag/service-control', { action });
    return response.data;
  },

  // ==================== 查询接口 ====================

  /**
   * 执行 LightRAG 查询
   */
  query: async (params: LightRAGQueryParams): Promise<{ success: boolean; data?: LightRAGQueryResult; message?: string }> => {
    const response = await api.post('/lightrag/query', params);
    return response.data;
  },

  // ==================== 知识库管理 ====================

  /**
   * 获取所有工作空间列表
   */
  getWorkspaces: async (): Promise<{ success: boolean; data?: string[]; message?: string }> => {
    const response = await api.get('/lightrag/workspaces');
    return response.data;
  },

  /**
   * 获取指定工作空间的文档列表
   */
  getDocuments: async (workspace: string = 'default'): Promise<{ success: boolean; data?: any[]; message?: string }> => {
    const response = await api.get('/lightrag/documents', { params: { workspace } });
    return response.data;
  },

  /**
   * 上传文档到 LightRAG
   */
  uploadDocument: async (content: string, workspace: string = 'default', filename?: string): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post('/lightrag/documents', { content, workspace, filename });
    return response.data;
  },

  /**
   * 删除文档
   */
  deleteDocument: async (documentId: string, workspace: string = 'default'): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete(`/lightrag/documents/${documentId}`, { params: { workspace } });
    return response.data;
  },

  /**
   * 清空工作空间数据
   */
  clearWorkspace: async (workspace: string = 'default'): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post('/lightrag/clear', { workspace });
    return response.data;
  },

  // ==================== 图谱可视化 ====================

  /**
   * 获取知识图谱数据
   */
  getGraphData: async (workspace: string = 'default', limit: number = 100): Promise<{ success: boolean; data?: any; message?: string }> => {
    const response = await api.get('/lightrag/graph', { params: { workspace, limit } });
    return response.data;
  },
};

export default lightragAPI;
