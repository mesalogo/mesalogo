import { useState, useCallback } from 'react';
import { App } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { modelConfigAPI } from '../../../services/api/model';

/**
 * 统一的模型配置数据管理Hook
 * 集中管理所有状态、数据获取、CRUD操作、Provider模型列表、测试功能
 */
export const useModelConfigData = () => {
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
      console.log('已加载所有模型配置（包含API密钥）');
    } catch (error) {
      console.error('获取模型配置失败:', error);
      message.error('加载模型配置失败');
    } finally {
      setLoading(false);
    }
  }, [message]);
  
  // 获取默认模型配置
  const fetchDefaultModels = useCallback(async () => {
    try {
      const defaults = await modelConfigAPI.getDefaults();
      setCurrentDefaults(defaults);
    } catch (error) {
      console.error('获取默认模型配置失败:', error);
    }
  }, []);
  
  // ==================== CRUD操作 ====================
  
  // 创建模型
  const createModel = useCallback(async (modelData) => {
    const needsApiKey = modelData.provider !== 'ollama';
    
    if (needsApiKey && modelData.provider !== 'custom' && (!modelData.api_key || modelData.api_key.trim() === '')) {
      message.warning('警告：您没有提供API密钥。如果此服务需要密钥，测试将失败。');
    }
    
    setLoading(true);
    try {
      console.log('正在创建新模型配置，API数据:', {
        ...modelData, 
        api_key: modelData.api_key ? '***已隐藏***' : undefined
      });
      
      const newModel = await modelConfigAPI.create(modelData);
      message.success('创建成功');
      
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
      console.error('创建模型失败:', error);
      message.error('创建失败: ' + (error.response?.data?.error || error.message));
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [message, fetchModelConfigs]);
  
  // 更新模型
  const updateModel = useCallback(async (modelId, modelData) => {
    setLoading(true);
    try {
      console.log('正在更新模型配置，API数据:', {
        ...modelData,
        api_key: modelData.api_key ? '***已隐藏***' : undefined
      });
      
      const updatedModel = await modelConfigAPI.update(modelId, modelData);
      message.success('更新成功');
      
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
      console.error('更新模型失败:', error);
      message.error('更新失败: ' + (error.response?.data?.error || error.message));
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [message, fetchModelConfigs]);
  
  // 删除模型
  const deleteModel = useCallback((model) => {
    return new Promise((resolve) => {
      modal.confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除模型配置 "${model.name}" 吗？`,
        onOk: async () => {
          try {
            await modelConfigAPI.delete(model.id);
            message.success('删除成功');
            
            setModelConfigsWithKeys(prev => {
              const newCache = { ...prev };
              delete newCache[model.id];
              return newCache;
            });
            
            await fetchModelConfigs();
            resolve({ success: true });
          } catch (error) {
            console.error('删除模型失败:', error);
            message.error('删除失败');
            resolve({ success: false, error });
          }
        },
        onCancel: () => resolve({ success: false, cancelled: true })
      });
    });
  }, [message, modal, fetchModelConfigs]);
  
  // 设置默认模型
  const setDefaultModels = useCallback(async (textModelId, embeddingModelId, rerankModelId) => {
    try {
      await modelConfigAPI.setDefaults(textModelId, embeddingModelId, rerankModelId);
      message.success('默认模型设置成功');
      await fetchDefaultModels();
      await fetchModelConfigs();
      return { success: true };
    } catch (error) {
      console.error('设置默认模型失败:', error);
      message.error('设置失败: ' + (error.response?.data?.error || error.message));
      return { success: false, error };
    }
  }, [message, fetchDefaultModels, fetchModelConfigs]);
  
  // ==================== Provider模型列表获取 ====================
  
  // 获取Ollama模型列表
  const fetchOllamaModels = useCallback(async (baseUrl) => {
    if (!baseUrl) return;
    
    setOllamaModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchOllamaModels(baseUrl);
      if (response.success) {
        setOllamaModels(response.models || []);
        console.log('获取到Ollama模型列表:', response.models);
      } else {
        throw new Error(response.message || '获取模型列表失败');
      }
    } catch (error) {
      console.error('获取Ollama模型列表失败:', error);
      message.error(`获取Ollama模型列表失败: ${error.message}`);
      setOllamaModels([]);
    } finally {
      setOllamaModelsLoading(false);
    }
  }, [message]);
  
  // 获取GPUStack模型列表
  const fetchGpustackModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setGpustackModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchGpustackModels(baseUrl, apiKey);
      if (response.success) {
        setGpustackModels(response.models || []);
        console.log('获取到GPUStack模型列表:', response.models);
      } else {
        throw new Error(response.message || '获取模型列表失败');
      }
    } catch (error) {
      console.error('获取GPUStack模型列表失败:', error);
      message.error(`获取GPUStack模型列表失败: ${error.message}`);
      setGpustackModels([]);
    } finally {
      setGpustackModelsLoading(false);
    }
  }, [message]);
  
  // 获取Anthropic模型列表
  const fetchAnthropicModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setAnthropicModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchAnthropicModels(baseUrl, apiKey);
      if (response.success) {
        setAnthropicModels(response.models || []);
        console.log('获取到Anthropic模型列表:', response.models);
      } else {
        throw new Error(response.message || '获取模型列表失败');
      }
    } catch (error) {
      console.error('获取Anthropic模型列表失败:', error);
      message.error(`获取Anthropic模型列表失败: ${error.message}`);
      setAnthropicModels([]);
    } finally {
      setAnthropicModelsLoading(false);
    }
  }, [message]);
  
  // 获取Google模型列表
  const fetchGoogleModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setGoogleModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchGoogleModels(baseUrl, apiKey);
      if (response.success) {
        setGoogleModels(response.models || []);
        console.log('获取到Google模型列表:', response.models);
      } else {
        throw new Error(response.message || '获取模型列表失败');
      }
    } catch (error) {
      console.error('获取Google模型列表失败:', error);
      message.error(`获取Google模型列表失败: ${error.message}`);
      setGoogleModels([]);
    } finally {
      setGoogleModelsLoading(false);
    }
  }, [message]);
  
  // 获取X.ai模型列表
  const fetchXaiModels = useCallback(async (baseUrl, apiKey) => {
    if (!baseUrl || !apiKey) return;
    
    setXaiModelsLoading(true);
    try {
      const response = await modelConfigAPI.fetchXaiModels(baseUrl, apiKey);
      if (response.success) {
        setXaiModels(response.models || []);
        console.log('获取到X.ai模型列表:', response.models);
      } else {
        throw new Error(response.message || '获取模型列表失败');
      }
    } catch (error) {
      console.error('获取X.ai模型列表失败:', error);
      message.error(`获取X.ai模型列表失败: ${error.message}`);
      setXaiModels([]);
    } finally {
      setXaiModelsLoading(false);
    }
  }, [message]);
  
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
      message.warning('请输入API基础URL');
      return { success: false };
    }
    
    setTestConnectionLoading(true);
    try {
      const response = await modelConfigAPI.testConnection(baseUrl, provider, apiKey);
      if (response.success) {
        message.success('连接测试成功');
        return { success: true };
      } else {
        throw new Error(response.message || '连接测试失败');
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      message.error(`连接测试失败: ${error.message}`);
      return { success: false, error };
    } finally {
      setTestConnectionLoading(false);
    }
  }, [message]);
  
  // 测试模型（流式响应）
  const testModelStream = useCallback(async (modelId, prompt, onChunk, systemPrompt) => {
    console.log("[模型测试] 发送参数:", { modelId, prompt, systemPrompt });
    
    try {
      await modelConfigAPI.testModelStream(modelId, prompt, onChunk, systemPrompt);
    } catch (error) {
      console.error('测试LLM失败:', error);
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
