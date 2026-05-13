import { useState, useEffect, useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../services/api/settings';
import { modelConfigAPI } from '../../../services/api/model';

/**
 * 通用设置数据管理Hook
 * 统一管理系统设置、模型配置、默认模型等数据的获取和状态
 */
export const useGeneralSettings = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  // 核心状态
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelConfigs, setModelConfigs] = useState([]);
  const [defaultModels, setDefaultModels] = useState({});
  const [useBuiltinVectorDB, setUseBuiltinVectorDB] = useState(true);
  const [currentVectorDBConfig, setCurrentVectorDBConfig] = useState({});

  // 获取模型配置列表
  const fetchModelConfigs = useCallback(async () => {
    try {
      console.log('开始获取模型配置...');
      const configs = await modelConfigAPI.getAll();
      console.log('获取到的模型配置:', configs);
      
      // 过滤出具备文本生成能力的模型（与分段设置保持一致）
      const textCapableModels = configs.filter(config =>
        config.modalities && config.modalities.includes('text_output')
      );
      console.log('过滤后的文本生成模型:', textCapableModels);
      setModelConfigs(textCapableModels);
    } catch (error) {
      console.error('Failed to get model configurations:', error);
      // If fetch fails, set to empty array but keep default options
      setModelConfigs([]);
    }
  }, []);

  // 获取默认模型配置
  const fetchDefaultModels = useCallback(async () => {
    try {
      console.log('开始获取默认模型配置...');
      const defaults = await modelConfigAPI.getDefaults();
      console.log('获取到的默认模型配置:', defaults);
      setDefaultModels(defaults);
    } catch (error) {
      console.error('Failed to get default model configurations:', error);
      setDefaultModels({});
    }
  }, []);

  // 获取系统设置
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      // 使用API获取设置
      const data = await settingsAPI.getSettings();
      console.log('获取到系统设置:', data);
      console.log('文档解析器配置:', data.document_parsers);

      // 存储设置数据，供各个TAB组件使用
      setSettings(data);

      // 更新向量数据库状态
      setUseBuiltinVectorDB(data.use_builtin_vector_db !== undefined ? data.use_builtin_vector_db : true);

      // 加载向量数据库配置 - 使用下划线命名保持一致
      if (data.vector_db_config) {
        setCurrentVectorDBConfig(data.vector_db_config);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to get system settings:', error);

      // 设置默认值
      const defaultSettings = {
        api_url: process.env.REACT_APP_API_URL || 'http://localhost:8080/api',
        max_conversation_history_length: 10,
        streaming_enabled: true,
        timezone: 'Asia/Shanghai',
        platform_language: 'zh-CN',
        include_thinking_content_in_context: true,
        split_tool_calls_in_history: true,
        tool_call_context_rounds: 2,
        tool_result_max_length: 500,
        compress_tool_definitions: true,
        tool_call_correction: false,
        tool_call_correction_threshold: 5,
        use_builtin_vector_db: true,
        vector_db_provider: 'aliyun',
        builtin_vector_db_host: 'localhost',
        builtin_vector_db_port: 19530,
        enable_assistant_generation: true,
        assistant_generation_model: 'default',
        http_connection_timeout: 30,
        http_read_timeout: 300,
        stream_socket_timeout: 60,
        default_model_timeout: 60,
        document_parser_tool: 'mineru',
        document_parser_mineru_config: {
          backend_type: 'local',
          executable_path: '',
          server_url: '',
          timeout: 300
        },
        document_parser_paddleocr_vl_config: {
          executable_path: 'paddleocr',
          vl_rec_backend: 'vllm-server',
          server_url: 'http://127.0.0.1:8118/v1',
          extra_args: '',
          timeout: 300
        }
      };
      setSettings(defaultSettings);
      message.error(t('settings.loadDefaultSettings') + ': ' + (error.message || t('message.unknownError')));
      setLoading(false);
    }
  }, [message, t]);

  // 初始化数据获取
  useEffect(() => {
    fetchSettings();
    fetchModelConfigs();
    fetchDefaultModels();
  }, [fetchSettings, fetchModelConfigs, fetchDefaultModels]);

  // 返回统一接口
  return {
    // 状态
    settings,
    loading,
    modelConfigs,
    defaultModels,
    useBuiltinVectorDB,
    currentVectorDBConfig,
    
    // 状态更新方法
    setSettings,
    setUseBuiltinVectorDB,
    setCurrentVectorDBConfig,
    
    // 数据获取方法
    refetchSettings: fetchSettings,
    refetchModelConfigs: fetchModelConfigs,
    refetchDefaultModels: fetchDefaultModels
  };
};
