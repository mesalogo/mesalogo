import { useState, useCallback } from 'react';
import { App } from 'antd';
import graphEnhancementAPI from '../../../services/api/graphEnhancement';
import { modelConfigAPI } from '../../../services/api/model';

export const useGraphEnhancement = () => {
  const { message } = App.useApp();
  
  // 配置管理
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 状态管理
  const [status, setStatus] = useState(null);
  
  // 模型配置
  const [textModels, setTextModels] = useState([]);
  const [embeddingModels, setEmbeddingModels] = useState([]);
  const [rerankModels, setRerankModels] = useState([]);
  const [defaultTextModel, setDefaultTextModel] = useState(null);
  const [defaultEmbeddingModel, setDefaultEmbeddingModel] = useState(null);
  const [defaultRerankModel, setDefaultRerankModel] = useState(null);
  const [defaultTextModelInfo, setDefaultTextModelInfo] = useState(null);
  const [defaultEmbeddingModelInfo, setDefaultEmbeddingModelInfo] = useState(null);
  const [defaultRerankModelInfo, setDefaultRerankModelInfo] = useState(null);
  
  // 其他状态
  const [clearLoading, setClearLoading] = useState(false);
  const [buildingCommunities, setBuildingCommunities] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const result = await graphEnhancementAPI.getConfig();
      
      if (result.success) {
        const configData = result.data || {};
        setConfig(configData);
        return configData;
      } else {
        message.error(result.message || '获取配置失败');
        return null;
      }
    } catch (error) {
      message.error('获取配置失败: ' + error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [message]);

  // 保存配置
  const saveConfig = useCallback(async (values) => {
    try {
      setLoading(true);
      const result = await graphEnhancementAPI.saveConfig(values);

      if (result.success) {
        message.success('配置保存成功');
        setConfig(values);
        await loadStatus();
        return true;
      } else {
        message.error(result.message || '配置保存失败');
        return false;
      }
    } catch (error) {
      message.error('配置保存失败: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [message]);

  // 加载状态
  const loadStatus = useCallback(async () => {
    try {
      const result = await graphEnhancementAPI.getStatus();
      if (result.success) {
        setStatus(result.data);
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('获取状态失败:', error);
      return null;
    }
  }, []);

  // 加载模型配置
  const loadModelConfigs = useCallback(async () => {
    try {
      // 同时获取所有模型和默认模型信息
      const [configs, defaults] = await Promise.all([
        modelConfigAPI.getAll(),
        modelConfigAPI.getDefaults()
      ]);

      // 分离文本生成模型和嵌入模型
      const textModelList = configs.filter(model =>
        model.modalities && model.modalities.includes('text_output')
      );
      setTextModels(textModelList);

      // 使用 getDefaults() 获取完整的默认文本生成模型信息
      if (defaults?.text_model) {
        setDefaultTextModel(defaults.text_model.id);
        setDefaultTextModelInfo(defaults.text_model);
      } else {
        // 备用方案：从配置列表中查找
        const defaultText = configs.find(model => model.is_default_text);
        setDefaultTextModel(defaultText?.id || null);
        setDefaultTextModelInfo(defaultText || null);
      }

      // 获取嵌入模型列表
      const embeddingModelList = configs.filter(model =>
        model.modalities && model.modalities.includes('vector_output')
      );
      setEmbeddingModels(embeddingModelList);

      // 使用 getDefaults() 获取完整的默认嵌入模型信息
      if (defaults?.embedding_model) {
        setDefaultEmbeddingModel(defaults.embedding_model.id);
        setDefaultEmbeddingModelInfo(defaults.embedding_model);
      } else {
        // 备用方案：从配置列表中查找
        const defaultEmbedding = configs.find(model => model.is_default_embedding);
        setDefaultEmbeddingModel(defaultEmbedding?.id || null);
        setDefaultEmbeddingModelInfo(defaultEmbedding || null);
      }

      // 获取重排序模型列表
      const rerankModelList = configs.filter(model =>
        model.modalities && model.modalities.includes('rerank_output')
      );
      setRerankModels(rerankModelList);

      // 使用 getDefaults() 获取完整的默认重排序模型信息
      if (defaults?.rerank_model) {
        setDefaultRerankModel(defaults.rerank_model.id);
        setDefaultRerankModelInfo(defaults.rerank_model);
      } else {
        // 备用方案：从配置列表中查找
        const defaultRerank = configs.find(model => model.is_default_rerank);
        setDefaultRerankModel(defaultRerank?.id || null);
        setDefaultRerankModelInfo(defaultRerank || null);
      }

      return configs;
    } catch (error) {
      console.error('加载模型配置失败:', error);
      return [];
    }
  }, []);

  // 服务控制
  const controlService = useCallback(async (action) => {
    try {
      setLoading(true);

      // 验证操作类型
      if (!['start', 'stop'].includes(action)) {
        message.error('未知的服务操作');
        return false;
      }

      const actionText = {
        'start': '启动',
        'stop': '停止'
      }[action];

      message.info(`正在${actionText}Graphiti服务...`);

      const result = await graphEnhancementAPI.controlService({ action });

      if (result.success) {
        message.success(`Graphiti服务${actionText}成功`);

        // 如果是启动服务，等待一段时间让服务完全启动
        if (action === 'start') {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // 刷新状态
        await loadStatus();
        return true;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('服务控制失败:', error);
      message.error(`服务控制失败: ${error.message || '未知错误'}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [message, loadStatus]);

  // 清空数据
  const clearGraph = useCallback(async () => {
    try {
      setClearLoading(true);
      const result = await graphEnhancementAPI.clearGraph();

      if (result.success) {
        message.success('数据清空成功');
        await loadStatus();
        return true;
      } else {
        message.error(result.message || '数据清空失败');
        return false;
      }
    } catch (error) {
      message.error('数据清空失败: ' + error.message);
      return false;
    } finally {
      setClearLoading(false);
    }
  }, [message, loadStatus]);

  // 手动构建社区
  const buildCommunities = useCallback(async () => {
    try {
      setBuildingCommunities(true);
      const result = await graphEnhancementAPI.buildCommunities();

      if (result.success) {
        message.success(result.message || '社区构建请求已发送');
        return true;
      } else {
        message.error(result.message || '社区构建请求失败');
        return false;
      }
    } catch (error) {
      message.error('社区构建请求失败: ' + error.message);
      return false;
    } finally {
      setBuildingCommunities(false);
    }
  }, [message]);

  // 测试查询
  const testQuery = useCallback(async (queryData) => {
    try {
      setLoading(true);
      const result = await graphEnhancementAPI.testQuery(queryData);

      if (result.success) {
        setTestResult(result.data);
        message.success('查询测试成功');
        return result.data;
      } else {
        message.error(result.message || '查询测试失败');
        setTestResult(null);
        return null;
      }
    } catch (error) {
      console.error('查询测试失败:', error);
      let errorMessage = '查询测试失败';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = '未知错误，请检查网络连接';
      }

      message.error(errorMessage);
      setTestResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [message]);

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
    clearLoading,
    buildingCommunities,
    testResult,
    
    // 方法
    loadConfig,
    saveConfig,
    loadStatus,
    loadModelConfigs,
    controlService,
    clearGraph,
    buildCommunities,
    testQuery,
    setTestResult
  };
};
