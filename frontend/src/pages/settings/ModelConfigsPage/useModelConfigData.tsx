import { useState, useCallback } from 'react';
import { App } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { modelConfigAPI } from '../../../services/api/model';

/**
 * 统一的模型配置数据管理Hook
 * 集中管理所有状态、数据获取、CRUD操作、Provider模型列表、测试功能
 */
export const useModelConfigData = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  
  // ==================== 核心数据状态 ====================
  const [modelConfigs, setModelConfigs] = useState([]);
  const [modelConfigsWithKeys, setModelConfigsWithKeys] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentDefaults, setCurrentDefaults] = useState({});
  
  // ==================== Provider模型列表状态 ====================
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  
  const [gpustackModels, setGpustackModels] = useState([]);
  const [gpustackModelsLoading, setGpustackModelsLoading] = useState(false);
  
  const [anthropicModels, setAnthropicModels] = useState([]);
  const [anthropicModelsLoading, setAnthropicModelsLoading] = useState(false);
  
  const [googleModels, setGoogleModels] = useState([]);
  const [googleModelsLoading, setGoogleModelsLoading] = useState(false);
  
  const [xaiModels, setXaiModels] = useState([]);
  const [xaiModelsLoading, setXaiModelsLoading] = useState(false);
  
  const [testConnectionLoading, setTestConnectionLoading] = useState(false);
  
  // ==================== 数据获取方法 ====================
  
  // 获取模型配置列表
  const fetchModelConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await modelConfigAPI.getAll();
      setModelConfigs(data);
      
      const dataWithKeys = await modelConfigAPI.getAll(true);
      const configsWithKeysMap = {};
      dataWithKeys.forEach(config => {
        configsWithKeysMap[config.id] = config;
      });
      setModelConfigsWithKeys(configsWithKeysMap);
      console.log('Loaded all model configurations (including API keys)');
    } catch (error) {
      console.error('Failed to fetch model configurations:', error);
      message.error(t('modelConfig.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);
  
  // 获取默认模型配置
  const fetchDefaultModels = useCallback(async () => {
    try {
      const defaults = await modelConfigAPI.getDefaults();
      setCurrentDefaults(defaults);
    } catch (error) {
      console.error('Failed to fetch default model configuration:', error);
    }
  }, []);
  
  // ==================== CRUD操作 ====================
  
  // 创建模型
  const createModel = useCallback(async (modelData) => {
    const needsApiKey = modelData.provider !== 'ollama';
    
    if (needsApiKey && modelData.provider !== 'custom' && (!modelData.api_key || modelData.api_key.trim() === '')) {
      message.warning(t('modelConfig.apiKeyMissingWarning'));
    }
    
    setLoading(true);
    try {
      console.log('Creating new model configuration, API data:', {
        ...modelData, 
        api_key: modelData.api_key ? '***hidden***' : undefined
      });
      
      const newModel = await modelConfigAPI.create(modelData);
      message.success(t('modelConfig.createSuccess'));
      
      if (newModel && newModel.id) {
        setModelConfigsWithKeys(prev => ({
          ...prev,
          [newModel.id]: {
            ...newModel,
            api_key: modelData.provider === 'ollama' ? '' : (modelData.api_key || '')
          }
        }));
      }
      
      await fetchModelConfigs();
      return { success: true, data: newModel };
    } catch (error) {
      console.error('Failed to create model:', error);
      message.error(t('modelConfig.createFailedWithReason', { reason: error.response?.data?.error || error.message }));
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [message, fetchModelConfigs, t]);
  
  // 更新模型
  const updateModel = useCallback(async (modelId, modelData) => {
    setLoading(true);
    try {
      console.log('Updating model configuration, API data:', {
        ...modelData,
        api_key: modelData.api_key ? '***hidden***' : undefined
      });
      
      const updatedModel = await modelConfigAPI.update(modelId, modelData);
      message.success(t('modelConfig.updateSuccess'));
      
      if (updatedModel) {
        setModelConfigsWithKeys(prev => {
          const newCache = { ...prev };
          
          if (modelData.provider === 'ollama') {
            newCache[modelId] = {
              ...updatedModel,
              api_key: ''
            };
          } else {
            if (modelData.api_key) {
              newCache[modelId] = {
                ...updatedModel,
                api_key: modelData.api_key
              };
            } else {
              newCache[modelId] = {
                ...updatedModel,
                api_key: prev[modelId]?.api_key || ''
              };
            }
          }
          return newCache;
        });
      }
      
      await fetchModelConfigs();
      return { success: true, data: updatedModel };
    } catch (error) {
      console.error('Failed to update model:', error);
      message.error(t('modelConfig.updateFailedWithReason', { reason: error.response?.data?.error || error.message }));
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [message, fetchModelConfigs, t]);
  
  // 删除模型
  const deleteModel = useCallback((model) => {
    return new Promise((resolve) => {
      modal.confirm({
        title: t('modelConfig.confirmDelete'),
        icon: <ExclamationCircleOutlined />,
        content: t('modelConfig.deleteConfirm', { name: model.name }),
        onOk: async () => {
          try {
            await modelConfigAPI.delete(model.id);
            message.success(t('modelConfig.deleteSuccess'));
            
            setModelConfigsWithKeys(prev => {
              const newCache = { ...prev };
              delete newCache[model.id];
              return newCache;
            });
            
            await fetchModelConfigs();
            resolve({ success: true });
          } catch (error) {
            console.error('Failed to delete model:', error);
            message.error(t('modelConfig.deleteFailed'));
            resolve({ success: false, error });
          }
        },
        onCancel: () => resolve({ success: false, cancelled: true })
      });
    });
  }, [message, modal, fetchModelConfigs, t]);
  
  // 设置默认模型
  const setDefaultModels = useCallback(async (textModelId, embeddingModelId, rerankModelId) => {
    try {
      await modelConfigAPI.setDefaults(textModelId, embeddingModelId, rerankModelId);
      message.success(t('modelConfig.setDefaultsSuccess'));
      await fetchDefaultModels();
      await fetchModelConfigs();
      return { success: true };
    } catch (error) {
      console.error('Failed to set default models:', error);
      message.error(t('modelConfig.setDefaultsFailedWithReason', { reason: error.response?.data?.error || error.message }));
      return { success: false, error };
    }
  }, [message, fetchDefaultModels, fetchModelConfigs, t]);
  
  // ==================== Provider模型列表获取 ====================
  
  // 获取Ollama模型列表
  const fetchOllamaModels = useCallback(async (baseUrl) => {
    if (!baseUrl) return;
    
    setOllamaModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchOllamaModels(baseUrl);
      if (response.success) {
        setOllamaModels(response.models || []);
        console.log('Fetched Ollama model list:', response.models);
      } else {
        throw new Error(response.message || t('modelConfig.fetchOllamaModelsFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch Ollama model list:', error);
      message.error(t('modelConfig.fetchOllamaModelsFailedWithReason', { reason: error.message }));
      setOllamaModels([]);
    } finally {
      setOllamaModelsLoading(false);
    }
  }, [message, t]);
  
  // 获取GPUStack模型列表
  const fetchGpustackModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setGpustackModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchGpustackModels(baseUrl, apiKey);
      if (response.success) {
        setGpustackModels(response.models || []);
        console.log('Fetched GPUStack model list:', response.models);
      } else {
        throw new Error(response.message || t('modelConfig.fetchGpustackModelsFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch GPUStack model list:', error);
      message.error(t('modelConfig.fetchGpustackModelsFailedWithReason', { reason: error.message }));
      setGpustackModels([]);
    } finally {
      setGpustackModelsLoading(false);
    }
  }, [message, t]);
  
  // 获取Anthropic模型列表
  const fetchAnthropicModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setAnthropicModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchAnthropicModels(baseUrl, apiKey);
      if (response.success) {
        setAnthropicModels(response.models || []);
        console.log('Fetched Anthropic model list:', response.models);
      } else {
        throw new Error(response.message || t('modelConfig.fetchAnthropicModelsFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch Anthropic model list:', error);
      message.error(t('modelConfig.fetchAnthropicModelsFailedWithReason', { reason: error.message }));
      setAnthropicModels([]);
    } finally {
      setAnthropicModelsLoading(false);
    }
  }, [message, t]);
  
  // 获取Google模型列表
  const fetchGoogleModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setGoogleModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchGoogleModels(baseUrl, apiKey);
      if (response.success) {
        setGoogleModels(response.models || []);
        console.log('Fetched Google model list:', response.models);
      } else {
        throw new Error(response.message || t('modelConfig.fetchGoogleModelsFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch Google model list:', error);
      message.error(t('modelConfig.fetchGoogleModelsFailedWithReason', { reason: error.message }));
      setGoogleModels([]);
    } finally {
      setGoogleModelsLoading(false);
    }
  }, [message, t]);
  
  // 获取X.ai模型列表
  const fetchXaiModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setXaiModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchXaiModels(baseUrl, apiKey);
      if (response.success) {
        setXaiModels(response.models || []);
        console.log('Fetched X.ai model list:', response.models);
      } else {
        throw new Error(response.message || t('modelConfig.fetchXaiModelsFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch X.ai model list:', error);
      message.error(t('modelConfig.fetchXaiModelsFailedWithReason', { reason: error.message }));
      setXaiModels([]);
    } finally {
      setXaiModelsLoading(false);
    }
  }, [message, t]);
  
  // 清空所有模型列表
  const clearAllProviderModels = useCallback(() => {
    setOllamaModels([]);
    setGpustackModels([]);
    setAnthropicModels([]);
    setGoogleModels([]);
    setXaiModels([]);
  }, []);
  
  // ==================== 测试相关方法 ====================
  
  // 测试连接
  const testConnection = useCallback(async (baseUrl, provider, apiKey) => {
    if (!baseUrl) {
      message.warning(t('modelConfig.baseUrlRequiredWarning'));
      return { success: false };
    }
    
    setTestConnectionLoading(true);
    try {
      const response = await modelConfigAPI.testConnection(baseUrl, provider, apiKey);
      if (response.success) {
        message.success(t('modelConfig.connectionTestSuccess'));
        return { success: true };
      } else {
        throw new Error(response.message || t('modelConfig.connectionTestFailed'));
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      message.error(t('modelConfig.connectionTestFailedWithReason', { reason: error.message }));
      return { success: false, error };
    } finally {
      setTestConnectionLoading(false);
    }
  }, [message, t]);
  
  // 测试模型（流式响应）
  const testModelStream = useCallback(async (modelId, prompt, onChunk, systemPrompt) => {
    console.log("[Model test] Sending params:", { modelId, prompt, systemPrompt });
    
    try {
      await modelConfigAPI.testModelStream(modelId, prompt, onChunk, systemPrompt);
    } catch (error) {
      console.error('Failed to test LLM:', error);
      throw error;
    }
  }, []);
  
  // ==================== 工具方法 ====================
  
  // 过滤和统计
  const getProviderStats = useCallback((models) => {
    const stats = {};
    models.forEach(model => {
      stats[model.provider] = (stats[model.provider] || 0) + 1;
    });
    return stats;
  }, []);
  
  const getCapabilityStats = useCallback((models) => {
    const stats = {};
    models.forEach(model => {
      (model.capabilities || []).forEach(cap => {
        stats[cap] = (stats[cap] || 0) + 1;
      });
    });
    return stats;
  }, []);
  
  return {
    // 核心数据状态
    modelConfigs,
    modelConfigsWithKeys,
    loading,
    currentDefaults,
    
    // Provider模型列表状态
    ollamaModels,
    ollamaModelsLoading,
    gpustackModels,
    gpustackModelsLoading,
    anthropicModels,
    anthropicModelsLoading,
    googleModels,
    googleModelsLoading,
    xaiModels,
    xaiModelsLoading,
    testConnectionLoading,
    
    // 数据获取方法
    fetchModelConfigs,
    fetchDefaultModels,
    
    // CRUD操作
    createModel,
    updateModel,
    deleteModel,
    setDefaultModels,
    
    // Provider模型列表获取
    fetchOllamaModels,
    fetchGpustackModels,
    fetchAnthropicModels,
    fetchGoogleModels,
    fetchXaiModels,
    clearAllProviderModels,
    
    // 测试方法
    testConnection,
    testModelStream,
    
    // 工具方法
    getProviderStats,
    getCapabilityStats
  };
};
