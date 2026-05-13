import React, { useState, useEffect } from 'react';
import { Typography, Form, Button, Space, App } from 'antd';
import { PlusOutlined, StarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// 导入自定义Hook和组件
import { useModelConfigData } from './useModelConfigData';
import ModelListView from './ModelListView';
import ModelTestSection from './ModelTestSection';
import DefaultModelModal from './DefaultModelModal';
import ModelFormModal from './ModelFormModal';

const { Title, Text } = Typography;

const ModelConfigsPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  
  // 使用统一数据Hook
  const dataHook = useModelConfigData();
  
  // UI状态
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [defaultModalVisible, setDefaultModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  
  // 表单实例
  const [testForm] = Form.useForm();
  const [defaultForm] = Form.useForm();
  const [modelForm] = Form.useForm();
  
  // 测试相关状态
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState('idle');
  const [testResult, setTestResult] = useState('');
  
  // Modal相关状态
  const [currentProvider, setCurrentProvider] = useState('openai');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  
  // 初始化：加载数据
  useEffect(() => {
    dataHook.fetchModelConfigs();
    dataHook.fetchDefaultModels();
  }, [dataHook.fetchModelConfigs, dataHook.fetchDefaultModels]);
  
  // 初始化测试表单默认值
  useEffect(() => {
    testForm.setFieldsValue({
      prompt: "你好，你是谁？",
      systemPrompt: "你是一个友好的助手，请用简洁明了的方式回答问题。在回答开始时请说'作为您的助手'。"
    });
  }, [testForm]);
  
  // ==================== 事件处理函数 ====================
  
  // 显示添加模型Modal
  const handleAddModel = () => {
    setEditingModel(null);
    setCurrentProvider('custom');
    setApiKeyVisible(false);
    dataHook.clearAllProviderModels();
    
    modelForm.resetFields();
    modelForm.setFieldsValue({
      provider: 'custom',
      baseUrl: '',
      contextWindow: 16000,
      maxOutputTokens: 4000,
      requestTimeout: 60,
      modalities: ['text_input', 'text_output'],
      capabilities: [],
      additionalParams: '{}',
      formatCompatibility: 'custom'
    });
    
    setModelModalVisible(true);
  };
  
  // 显示编辑模型Modal
  const handleEditModel = (model) => {
    setEditingModel(model);
    
    const modelWithKey = dataHook.modelConfigsWithKeys[model.id];
    if (modelWithKey) {
      modelForm.setFieldsValue({
        name: model.name,
        provider: model.provider,
        model_id: model.model_id,
        baseUrl: model.base_url,
        apiKey: modelWithKey.api_key || '',
        contextWindow: model.context_window,
        maxOutputTokens: model.max_output_tokens,
        requestTimeout: model.request_timeout,
        modalities: model.modalities || ['text_input', 'text_output'],
        capabilities: model.capabilities || [],
        additionalParams: JSON.stringify(model.additional_params || {}, null, 2),
        formatCompatibility: model.format_compatibility || 'openai'
      });
      
      setCurrentProvider(model.provider);
      setApiKeyVisible(false);
      
      setModelModalVisible(true);
    }
  };
  
  // 显示默认模型Modal
  const handleShowDefaultModal = () => {
    dataHook.fetchDefaultModels();
    setDefaultModalVisible(true);
  };
  
  // 保存默认模型
  const handleSaveDefaultModels = async () => {
    try {
      const values = await defaultForm.validateFields();
      if (!values.textModelId && !values.embeddingModelId && !values.rerankModelId) {
        message.warning('请至少选择一个默认模型');
        return;
      }
      
      const result = await dataHook.setDefaultModels(
        values.textModelId,
        values.embeddingModelId,
        values.rerankModelId
      );
      
      if (result.success) {
        setDefaultModalVisible(false);
      }
    } catch (error) {
      // 表单验证失败
    }
  };
  
  // 测试模型
  const handleTestModel = async () => {
    try {
      const values = await testForm.validateFields();
      
      if (!values.modelId) {
        message.warning('请先选择要测试的模型');
        return;
      }
      
      setTestLoading(true);
      setTestStatus('loading');
      setTestResult('');
      
      const selectedModel = dataHook.modelConfigs.find(
        m => m.id.toString() === values.modelId.toString()
      );
      
      if (!selectedModel) {
        throw new Error('未找到所选模型配置');
      }
      
      let streamContent = '';
      let receivedFirstResponse = false;
      
      await dataHook.testModelStream(
        selectedModel.id,
        values.prompt,
        (chunk, meta) => {
          if (chunk) {
            receivedFirstResponse = true;
            streamContent += chunk;
            setTestResult(streamContent);
            
            if (testStatus === 'loading') {
              setTestStatus('streaming');
            }
          }
          
          if (meta && meta.connectionStatus) {
            if (meta.connectionStatus === 'error' && meta.error) {
              setTestResult(`测试失败: ${meta.error}`);
              setTestStatus('error');
            } else if (meta.connectionStatus === 'done') {
              setTestStatus('success');
            }
          }
        },
        values.systemPrompt
      );
      
      if (!receivedFirstResponse && streamContent === '') {
        if (!testResult) {
          setTestResult('测试完成，但未收到任何响应，请检查模型配置');
          setTestStatus('warning');
        }
      }
    } catch (error) {
      console.error('测试LLM失败:', error);
      setTestResult(`测试失败: ${error.message || '未知错误'}`);
      setTestStatus('error');
    } finally {
      setTestLoading(false);
    }
  };
  
  // 复制测试结果
  const handleCopyTestResult = () => {
    if (testResult) {
      navigator.clipboard.writeText(testResult)
        .then(() => message.success(t('common.copiedToClipboard')))
        .catch(() => message.error(t('common.copyFailed')));
    }
  };
  
  // 重置测试
  const handleResetTest = () => {
    testForm.resetFields();
    setTestResult('');
    setTestStatus('idle');
    
    testForm.setFieldsValue({
      prompt: "你好，你是谁？",
      systemPrompt: "你是一个友好的助手，请用简洁明了的方式回答问题。在回答开始时请说'作为您的助手'。"
    });
  };
  
  // Provider变更处理
  const handleProviderChange = (provider) => {
    setCurrentProvider(provider);
    dataHook.clearAllProviderModels();
    
    // 根据 provider 设置默认的格式兼容性
    const FORMAT_DEFAULTS = {
      'anthropic': 'anthropic',
      'openai': 'openai',
      'ollama': 'openai',
      'gpustack': 'openai',
      'deepseek': 'openai',
      'aliyun': 'openai',
      'volcengine': 'openai',
      'azure': 'openai',
      'google': 'openai',
      'xai': 'openai',
      'custom': 'custom',
    };
    
    // 清空模型ID字段并设置格式兼容性
    modelForm.setFieldsValue({
      model_id: '',
      name: '',
      formatCompatibility: FORMAT_DEFAULTS[provider] || 'openai'
    });
  };
  
  // 测试连接处理
  const handleTestConnection = async () => {
    try {
      const baseUrl = modelForm.getFieldValue('baseUrl');
      const apiKey = modelForm.getFieldValue('apiKey');
      
      if (!baseUrl) {
        message.warning('请先输入API基础URL');
        return;
      }
      
      const provider = currentProvider;
      
      if (provider === 'ollama') {
        await dataHook.fetchOllamaModels(baseUrl);
      } else if (provider === 'gpustack') {
        if (!apiKey) {
          message.warning('GPUStack需要API密钥');
          return;
        }
        await dataHook.fetchGpustackModels(baseUrl, apiKey);
      } else if (provider === 'anthropic') {
        if (!apiKey) {
          message.warning('Anthropic需要API密钥');
          return;
        }
        await dataHook.fetchAnthropicModels(baseUrl, apiKey);
      } else if (provider === 'google') {
        if (!apiKey) {
          message.warning('Google需要API密钥');
          return;
        }
        await dataHook.fetchGoogleModels(baseUrl, apiKey);
      } else if (provider === 'xai') {
        if (!apiKey) {
          message.warning('X.ai需要API密钥');
          return;
        }
        await dataHook.fetchXaiModels(baseUrl, apiKey);
      } else {
        message.info('此Provider无需测试连接');
      }
    } catch (error) {
      message.error(`测试连接失败: ${error.message}`);
    }
  };
  
  // 模型模特与能力选择处理
  const handleModelSelect = (provider, modelValue) => {
    if (provider === 'ollama') {
      const model = dataHook.ollamaModels.find(m => m.name === modelValue);
      if (model) {
        // 自动推断模型模态
        const modalities = [];
        const modelNameLower = model.name.toLowerCase();
        
        // 根据模型名称推断类型
        if (modelNameLower.includes('embed')) {
          // 嵌入模型
          modalities.push('text_input', 'vector_output');
        } else if (modelNameLower.includes('rerank')) {
          // 重排序模型
          modalities.push('rerank_input', 'rerank_output');
        } else {
          // 默认为 LLM
          modalities.push('text_input', 'text_output');
          
          // 检查是否支持视觉
          if (modelNameLower.includes('vision') || modelNameLower.includes('vl') || 
              modelNameLower.includes('llava') || modelNameLower.includes('minicpm')) {
            modalities.push('image_input');
          }
        }
        
        modelForm.setFieldsValue({
          model_id: model.name,
          name: model.name,
          modalities: modalities
        });
        
        if (modalities.length > 2 || modalities.includes('image_input')) {
          message.success('已根据模型名称自动识别模态');
        }
      }
    } else if (provider === 'gpustack') {
      const model = dataHook.gpustackModels.find(m => m.name === modelValue);
      if (model) {
        // 自动推断模型模态和特性
        const modalities = [];
        const capabilities = [];
        
        // 根据 categories 推断模态
        if (model.categories && model.categories.length > 0) {
          const category = model.categories[0];
          switch (category) {
            case 'llm':
              modalities.push('text_input', 'text_output');
              break;
            case 'embedding':
              modalities.push('text_input', 'vector_output');
              break;
            case 'reranker':
              modalities.push('rerank_input', 'rerank_output');
              break;
            case 'text_to_speech':
              modalities.push('text_input', 'audio_output');
              break;
            case 'speech_to_text':
              modalities.push('audio_input', 'text_output');
              break;
            default:
              modalities.push('text_input', 'text_output');
          }
        } else {
          // 默认为文本模型
          modalities.push('text_input', 'text_output');
        }
        
        // 根据 meta.support_vision 添加图像输入
        if (model.meta?.support_vision) {
          modalities.push('image_input');
        }
        
        // 根据 meta.support_* 推断能力
        if (model.meta?.support_tool_calls) {
          capabilities.push('function_calling');
        }
        if (model.meta?.support_reasoning) {
          capabilities.push('reasoning');
        }
        
        // 自动填充上下文窗口
        const contextWindow = model.meta?.n_ctx || 16000;
        
        modelForm.setFieldsValue({
          model_id: model.name,
          name: model.name,
          modalities: modalities,
          capabilities: capabilities,
          contextWindow: contextWindow
        });
        
        message.success('已根据模型信息自动填充模态和特性');
      }
    } else if (provider === 'anthropic') {
      const model = dataHook.anthropicModels.find(m => m.id === modelValue);
      if (model) {
        modelForm.setFieldsValue({
          model_id: model.id,
          name: model.display_name || model.id
        });
      }
    } else if (provider === 'google') {
      const model = dataHook.googleModels.find(m => m.name === modelValue);
      if (model) {
        modelForm.setFieldsValue({
          model_id: model.name,
          name: model.displayName || model.baseModelId || model.name
        });
      }
    } else if (provider === 'xai') {
      const model = dataHook.xaiModels.find(m => m.id === modelValue);
      if (model) {
        modelForm.setFieldsValue({
          model_id: model.id,
          name: model.id
        });
      }
    }
  };
  
  // 保存模型
  const handleSaveModel = async () => {
    try {
      const values = await modelForm.validateFields();
      
      // 解析JSON参数
      let additionalParams = {};
      if (values.additionalParams && values.additionalParams.trim()) {
        try {
          additionalParams = JSON.parse(values.additionalParams);
        } catch (e) {
          message.error('附加参数格式错误，请输入有效的JSON');
          return;
        }
      }
      
      const modelData = {
        name: values.name,
        provider: values.provider,
        model_id: values.model_id,
        base_url: values.baseUrl,
        api_key: values.apiKey || '',
        context_window: values.contextWindow,
        max_output_tokens: values.maxOutputTokens,
        request_timeout: values.requestTimeout,
        modalities: values.modalities || ['text_input', 'text_output'],
        capabilities: values.capabilities || [],
        additional_params: additionalParams,
        format_compatibility: values.formatCompatibility || 'openai'
      };
      
      let success = false;
      if (editingModel) {
        // 编辑模式
        if (!modelData.api_key) {
          // 留空表示保持原有密钥
          delete modelData.api_key;
        }
        success = (await dataHook.updateModel(editingModel.id, modelData)) as any;
      } else {
        // 新增模式
        success = (await dataHook.createModel(modelData)) as any;
      }
      
      if (success) {
        setModelModalVisible(false);
        modelForm.resetFields();
      }
    } catch (error) {
      console.error('保存模型失败:', error);
    }
  };
  
  return (
    <div>
      {/* 页面头部 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
              {t('modelConfig.title')}
            </Title>
            <Text type="secondary">{t('modelConfig.subtitle')}</Text>
          </div>
          <Space size="middle">
            <Button
              icon={<StarOutlined />}
              onClick={handleShowDefaultModal}
            >
              {t('modelConfig.setDefaults')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddModel}
            >
              {t('modelConfig.addModel')}
            </Button>
          </Space>
        </div>
      </div>
      
      {/* 模型列表视图 */}
      <ModelListView
        modelConfigs={dataHook.modelConfigs}
        loading={dataHook.loading}
        onEdit={handleEditModel}
        onDelete={dataHook.deleteModel}
        onTest={(model) => {
          testForm.setFieldsValue({ modelId: model.id });
        }}
        providerStats={dataHook.getProviderStats(dataHook.modelConfigs)}
        capabilityStats={dataHook.getCapabilityStats(dataHook.modelConfigs)}
      />
      
      {/* 模型测试区域 */}
      <ModelTestSection
        form={testForm}
        modelConfigs={dataHook.modelConfigs}
        loading={testLoading}
        status={testStatus}
        result={testResult}
        onTest={handleTestModel}
        onCopy={handleCopyTestResult}
        onReset={handleResetTest}
      />
      
      {/* 默认模型设置Modal */}
      <DefaultModelModal
        visible={defaultModalVisible}
        onOk={handleSaveDefaultModels}
        onCancel={() => setDefaultModalVisible(false)}
        loading={dataHook.loading}
        form={defaultForm}
        modelConfigs={dataHook.modelConfigs}
        currentDefaults={dataHook.currentDefaults}
      />
      
      {/* 模型表单Modal */}
      <ModelFormModal
        visible={modelModalVisible}
        onOk={handleSaveModel}
        onCancel={() => {
          setModelModalVisible(false);
          modelForm.resetFields();
        }}
        loading={dataHook.loading}
        form={modelForm}
        editingModel={editingModel}
        currentProvider={currentProvider}
        onProviderChange={handleProviderChange}
        apiKeyVisible={apiKeyVisible}
        onApiKeyVisibilityToggle={() => setApiKeyVisible(!apiKeyVisible)}
        providerModels={{
          ollamaModels: dataHook.ollamaModels,
          ollamaModelsLoading: dataHook.ollamaModelsLoading,
          gpustackModels: dataHook.gpustackModels,
          gpustackModelsLoading: dataHook.gpustackModelsLoading,
          anthropicModels: dataHook.anthropicModels,
          anthropicModelsLoading: dataHook.anthropicModelsLoading,
          googleModels: dataHook.googleModels,
          googleModelsLoading: dataHook.googleModelsLoading,
          xaiModels: dataHook.xaiModels,
          xaiModelsLoading: dataHook.xaiModelsLoading,
          testConnectionLoading: dataHook.testConnectionLoading
        }}
        onTestConnection={handleTestConnection}
        onModelSelect={handleModelSelect}
      />
    </div>
  );
};

export default ModelConfigsPage;
