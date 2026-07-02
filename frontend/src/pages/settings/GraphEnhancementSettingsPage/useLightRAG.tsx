/**
 * LightRAG 知识库管理 Hook
 * 
 * 提供 LightRAG 配置、状态、查询等功能的统一管理
 */
import { useState, useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import lightragAPI, { LightRAGConfig, LightRAGStatus, LightRAGQueryResult } from '../../../services/api/lightrag';
import { modelConfigAPI } from '../../../services/api/model';

// 使用 any 类型以兼容 API 返回的模型配置
export type ModelInfo = any;

export const useLightRAG = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  
  // 配置状态
  const [config, setConfig] = useState<LightRAGConfig | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 服务状态
  const [status, setStatus] = useState<LightRAGStatus | null>(null);
  
  // 模型配置
  const [textModels, setTextModels] = useState<any[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<any[]>([]);
  const [rerankModels, setRerankModels] = useState<any[]>([]);
  const [defaultTextModel, setDefaultTextModel] = useState<any>(null);
  const [defaultEmbeddingModel, setDefaultEmbeddingModel] = useState<any>(null);
  const [defaultRerankModel, setDefaultRerankModel] = useState<any>(null);
  const [defaultTextModelInfo, setDefaultTextModelInfo] = useState<any>(null);
  const [defaultEmbeddingModelInfo, setDefaultEmbeddingModelInfo] = useState<any>(null);
  const [defaultRerankModelInfo, setDefaultRerankModelInfo] = useState<any>(null);
  
  // 操作状态
  const [syncLoading, setSyncLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [testResult, setTestResult] = useState<LightRAGQueryResult | null>(null);

  // ==================== 配置管理 ====================

  /**
   * 加载 LightRAG 配置
   */
  const loadConfig = useCallback(async (): Promise<LightRAGConfig | null> => {
    try {
      setLoading(true);
      const result = await lightragAPI.getConfig();
      
      if (result.success && result.data) {
        setConfig(result.data);
        return result.data;
      } else {
        message.error(result.message || t('lightragHook.getConfigFailed'));
        return null;
      }
    } catch (error: any) {
      message.error(t('lightragHook.getConfigFailedDetail', { error: error.message }));
      return null;
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  /**
   * 保存 LightRAG 配置
   */
  const saveConfig = useCallback(async (values: Partial<LightRAGConfig>): Promise<any> => {
    try {
      setLoading(true);
      const result = await lightragAPI.saveConfig(values);

      if (result.success) {
        // 更新本地状态
        setConfig(prev => prev ? { ...prev, ...values } : values as LightRAGConfig);
        return result;
      } else {
        message.error(result.message || t('lightragHook.saveConfigFailed'));
        return null;
      }
    } catch (error: any) {
      message.error(t('lightragHook.saveConfigFailedDetail', { error: error.message }));
      return null;
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  // ==================== 服务状态 ====================

  /**
   * 加载服务状态
   */
  const loadStatus = useCallback(async (): Promise<LightRAGStatus | null> => {
    try {
      const result = await lightragAPI.getStatus();
      if (result.success && result.data) {
        setStatus(result.data);
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get status:', error);
      return null;
    }
  }, []);

  /**
   * 检查服务健康状态
   */
  const checkHealth = useCallback(async (): Promise<LightRAGStatus | null> => {
    try {
      const result = await lightragAPI.healthCheck();
      return result;
    } catch (error) {
      console.error('Health check failed:', error);
      return null;
    }
  }, []);

  // ==================== 模型配置 ====================

  /**
   * 加载模型配置
   */
  const loadModelConfigs = useCallback(async () => {
    try {
      const [configs, defaults] = await Promise.all([
        modelConfigAPI.getAll(),
        modelConfigAPI.getDefaults()
      ]);

      // 分离文本生成模型
      const textModelList = configs.filter((model: any) =>
        model.modalities && model.modalities.includes('text_output')
      );
      setTextModels(textModelList);

      // 设置默认文本生成模型
      if (defaults?.text_model) {
        setDefaultTextModel(defaults.text_model.id);
        setDefaultTextModelInfo(defaults.text_model);
      } else {
        const defaultText = configs.find((model: any) => model.is_default_text);
        setDefaultTextModel(defaultText?.id || null);
        setDefaultTextModelInfo(defaultText || null);
      }

      // 获取嵌入模型列表
      const embeddingModelList = configs.filter((model: any) =>
        model.modalities && model.modalities.includes('vector_output')
      );
      setEmbeddingModels(embeddingModelList);

      // 设置默认嵌入模型
      if (defaults?.embedding_model) {
        setDefaultEmbeddingModel(defaults.embedding_model.id);
        setDefaultEmbeddingModelInfo(defaults.embedding_model);
      } else {
        const defaultEmbedding = configs.find((model: any) => model.is_default_embedding);
        setDefaultEmbeddingModel(defaultEmbedding?.id || null);
        setDefaultEmbeddingModelInfo(defaultEmbedding || null);
      }

      // 获取重排序模型列表
      const rerankModelList = configs.filter((model: any) =>
        model.modalities && model.modalities.includes('rerank_output')
      );
      setRerankModels(rerankModelList);

      // 设置默认重排序模型
      if (defaults?.rerank_model) {
        setDefaultRerankModel(defaults.rerank_model.id);
        setDefaultRerankModelInfo(defaults.rerank_model);
      } else {
        const defaultRerank = configs.find((model: any) => model.is_default_rerank);
        setDefaultRerankModel(defaultRerank?.id || null);
        setDefaultRerankModelInfo(defaultRerank || null);
      }

      return configs;
    } catch (error) {
      console.error('Failed to load model configs:', error);
      return [];
    }
  }, []);

  // ==================== 配置同步 ====================

  /**
   * 同步配置到 LightRAG 容器
   */
  const syncConfig = useCallback(async (): Promise<boolean> => {
    try {
      setSyncLoading(true);
      const result = await lightragAPI.syncConfig();

      if (result.success) {
        message.success(t('lightragHook.syncSuccess'));
        // 重新加载状态
        await loadStatus();
        return true;
      } else {
        message.error(t('lightragHook.syncFailed', { error: result.error || result.message }));
        return false;
      }
    } catch (error: any) {
      message.error(t('lightragHook.syncFailed', { error: error.message }));
      return false;
    } finally {
      setSyncLoading(false);
    }
  }, [message, t, loadStatus]);

  // ==================== 服务控制 ====================

  /**
   * 控制 LightRAG 服务（启动/停止）
   */
  const controlService = useCallback(async (action: 'start' | 'stop'): Promise<boolean> => {
    try {
      setLoading(true);
      const result = await lightragAPI.controlService(action);

      if (result.success) {
        message.success(result.message || (action === 'start' ? t('lightragHook.startSuccess') : t('lightragHook.stopSuccess')));
        
        // 轮询检查服务状态
        const targetStatus = action === 'start' ? 'healthy' : 'unreachable';
        const maxAttempts = 10;
        const pollInterval = 1000;
        
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          const statusResult = await loadStatus();
          
          if (statusResult?.status === targetStatus) {
            break;
          }
        }
        
        return true;
      } else {
        message.error(t('lightragHook.operationFailed', { error: result.error || result.message }));
        return false;
      }
    } catch (error: any) {
      message.error(t('lightragHook.operationFailed', { error: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [message, t, loadStatus]);

  // ==================== 查询测试 ====================

  /**
   * 测试查询
   */
  const testQuery = useCallback(async (params: {
    query: string;
    workspace?: string;
    mode?: string;
    top_k?: number;
    response_type?: string;
  }): Promise<LightRAGQueryResult | null> => {
    try {
      setQueryLoading(true);
      const result = await lightragAPI.query({
        query: params.query,
        workspace: params.workspace || 'default',
        mode: (params.mode as any) || 'hybrid',
        top_k: params.top_k || 60,
        response_type: params.response_type || 'Multiple Paragraphs'
      });

      if (result.success && result.data) {
        setTestResult(result.data);
        message.success(t('lightragHook.queryTestSuccess'));
        return result.data;
      } else {
        message.error(result.message || t('lightragHook.queryTestFailed'));
        setTestResult(null);
        return null;
      }
    } catch (error: any) {
      console.error('Query test failed:', error);
      message.error(t('lightragHook.queryTestFailedDetail', { error: error.message }));
      setTestResult(null);
      return null;
    } finally {
      setQueryLoading(false);
    }
  }, [message, t]);

  // ==================== 数据管理 ====================

  /**
   * 清空工作空间数据
   */
  const clearWorkspace = useCallback(async (workspace: string = 'default'): Promise<boolean> => {
    try {
      setClearLoading(true);
      const result = await lightragAPI.clearWorkspace(workspace);

      if (result.success) {
        message.success(t('lightragHook.clearDataSuccess'));
        await loadStatus();
        return true;
      } else {
        message.error(result.message || t('lightragHook.clearDataFailed'));
        return false;
      }
    } catch (error: any) {
      message.error(t('lightragHook.clearDataFailedDetail', { error: error.message }));
      return false;
    } finally {
      setClearLoading(false);
    }
  }, [message, t, loadStatus]);

  return {
    // 状态
    config,
    loading,
    status,
    textModels,
    embeddingModels,
    rerankModels,
    defaultTextModel,
    defaultEmbeddingModel,
    defaultRerankModel,
    defaultTextModelInfo,
    defaultEmbeddingModelInfo,
    defaultRerankModelInfo,
    syncLoading,
    clearLoading,
    queryLoading,
    testResult,
    
    // 方法
    loadConfig,
    saveConfig,
    loadStatus,
    checkHealth,
    loadModelConfigs,
    syncConfig,
    controlService,
    testQuery,
    clearWorkspace,
    setTestResult
  };
};

export default useLightRAG;
