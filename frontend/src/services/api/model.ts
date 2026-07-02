import api from './axios';


// Type definitions
interface ModelConfig {
  id?: string;
  provider: string;
  model_id: string;
  api_key?: string;
  base_url?: string;
  temperature?: number;
  max_output_tokens?: number;
  modalities?: string[];
  additional_params?: Record<string, any>;
  [key: string]: any;
}

interface ModelConfigAPI {
  getAll: (includeKeys?: boolean) => Promise<ModelConfig[]>;
  getById: (id: string, includeKeys?: boolean) => Promise<ModelConfig>;
  create: (configData: Partial<ModelConfig>) => Promise<any>;
  update: (id: string, configData: Partial<ModelConfig>) => Promise<any>;
  delete: (id: string) => Promise<any>;
  setDefault: (id: string) => Promise<any>;
  setDefaults: (textModelId?: string, embeddingModelId?: string, rerankModelId?: string) => Promise<any>;
  getDefaults: () => Promise<any>;
  [key: string]: any; // Allow additional methods not explicitly typed
}

/**
 * 模型配置相关API服务
 */
export const modelConfigAPI: ModelConfigAPI = {
  // 获取所有模型配置
  getAll: async (includeKeys = false) => {
    console.log('Fetching all model configurations, includeKeys =', includeKeys);
    const response = await api.get(`/model-configs${includeKeys ? '?include_api_keys=true' : ''}`);
    return response.data.model_configs || [];
  },

  // 获取单个模型配置
  getById: async (id: string, includeKeys = false) => {
    console.log('Fetching a single model configuration, id =', id, 'includeKeys =', includeKeys);
    const response = await api.get(`/model-configs/${id}${includeKeys ? '?include_api_keys=true' : ''}`);
    return response.data;
  },

  // 创建模型配置
  create: async (configData: Partial<ModelConfig>) => {
    const response = await api.post('/model-configs', configData);
    return response.data;
  },

  // 更新模型配置
  update: async (id: string, configData: Partial<ModelConfig>) => {
    const response = await api.put(`/model-configs/${id}`, configData);
    return response.data;
  },

  // 删除模型配置
  delete: async (id: string) => {
    const response = await api.delete(`/model-configs/${id}`);
    return response.data;
  },

  // 设置默认模型（保留向后兼容）
  setDefault: async (id: string) => {
    const response = await api.post(`/model-configs/${id}/set-default`);
    return response.data;
  },

  // 设置默认模型（支持分别设置文本生成、嵌入和重排序模型）
  setDefaults: async (textModelId?: string, embeddingModelId?: string, rerankModelId?: string) => {
    const data: any = {};
    if (textModelId) data.text_model_id = textModelId;
    if (embeddingModelId) data.embedding_model_id = embeddingModelId;
    if (rerankModelId) data.rerank_model_id = rerankModelId;

    const response = await api.post('/model-configs/set-defaults', data);
    return response.data;
  },

  // 获取当前默认模型
  getDefaults: async () => {
    const response = await api.get('/model-configs/defaults');
    return response.data;
  },

  // 测试模型配置（统一走后端代理，避免前端暴露模型接口和API密钥）
  testModel: async (modelId, prompt) => {
    try {
      const response = await api.post(`/model-configs/${modelId}/test`, { prompt });
      const data = response.data;

      if (data.success && !data.response && data.message && data.message.includes('测试成功:')) {
        const messageParts = data.message.split('测试成功:');
        if (messageParts.length > 1) {
          let extractedResponse = messageParts[1].trim();
          if (extractedResponse.endsWith('...')) {
            extractedResponse = extractedResponse.substring(0, extractedResponse.length - 3);
          }
          data.response = extractedResponse;
        }
      }

      return data;
    } catch (error) {
      console.error(`Failed to test model (ID: ${modelId}):`, error);
      throw error;
    }
  },

  // 测试聊天功能
  chatTest: async (modelId, prompt, systemPrompt = '', parameters = {}) => {
    try {
      console.log('Testing chat, modelId =', modelId, 'prompt =', prompt);

      // 尝试通过API测试
      const response = await api.post(`/model-configs/${modelId}/chat-test`, {
        prompt,
        system_prompt: systemPrompt,
        parameters
      });

      if (response.data && response.data.text) {
        return {
          success: true,
          text: response.data.text
        };
      } else if (response.data && response.data.error) {
        return {
          success: false,
          error: response.data.error
        };
      }

      // 如果API测试失败，抛出错误
      throw new Error('API test failed, no response received');
    } catch (error) {
      console.error('Chat test failed:', error);

      // 返回错误信息
      return {
        success: false,
        error: error.message || 'Test failed, please check the network connection and model configuration'
      };
    }
  },

  // 获取可用的模型配置选项
  getModelConfigs: async () => {
    const response = await api.get('/model-configs/options');
    return response.data.options || [];
  },

  // 运行模型诊断
  diagnoseCorsIssue: async (baseUrl, options = {}) => {
    // 实现CORS问题诊断逻辑
    try {
      // 尝试发送一个简单的请求来检测CORS问题
      const testUrl = baseUrl || api.defaults.baseURL;
      const response = await fetch(`${testUrl}/health-check`, {
        method: 'GET',
        mode: 'cors',
        ...options
      });

      if (response.ok) {
        return { success: true, corsStatus: "Accessible" };
      } else {
        throw new Error(`HTTP error: ${response.status}`);
      }
    } catch (error) {
      return { success: false, corsStatus: "CORS restriction detected", error: error.message };
    }
  },

  // 使用SSE测试模型配置
  testModelStream: async (modelId, prompt, onChunkReceived = null, systemPrompt = "You are a helpful assistant.", advancedParams = {}) => {
    try {
      console.log(`[ModelConfigAPI] Starting SSE streaming test: modelId=${modelId}, prompt="${prompt?.substring(0, 30)}..."`);

      const url = `${api.defaults.baseURL}/model-configs/${modelId}/test-stream`;

      // 基本参数
      const payload = {
        prompt: prompt || 'Hello, can you introduce yourself?',
        system_prompt: systemPrompt || 'You are a helpful assistant.'
      };

      // 添加高级参数
      if (advancedParams) {
        // 检查并添加各个高级参数
        if ((advancedParams as any).temperature !== undefined) (payload as any).temperature = (advancedParams as any).temperature;
        if ((advancedParams as any).top_p !== undefined) (payload as any).top_p = (advancedParams as any).top_p;
        if ((advancedParams as any).frequency_penalty !== undefined) (payload as any).frequency_penalty = (advancedParams as any).frequency_penalty;
        if ((advancedParams as any).presence_penalty !== undefined) (payload as any).presence_penalty = (advancedParams as any).presence_penalty;
        if ((advancedParams as any).max_tokens !== undefined) (payload as any).max_tokens = (advancedParams as any).max_tokens;
        if ((advancedParams as any).stop_sequences !== undefined) (payload as any).stop = (advancedParams as any).stop_sequences;
      }

      console.log('[ModelConfigAPI] Sending request body:', payload);

      // 发送POST请求，获取SSE流响应
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Streaming request failed (${response.status}): ${errorText}`);
      }

      console.log('[ModelConfigAPI] SSE connection established, receiving data stream');

      // 读取流
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullResponse = '';

      // 读取启动消息已通知UI
      if (onChunkReceived) {
        onChunkReceived(null, { connectionStatus: 'connected' });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 使用UTF-8解码二进制数据
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 处理缓冲区中的SSE消息
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep the last possibly incomplete message

        for (const message of messages) {
          if (!message || message.trim() === '') continue;

          // 检查是否为注释或心跳
          if (message.startsWith(':')) continue;

          // 处理数据消息
          if (message.startsWith('data:')) {
            const dataContent = message.slice(5).trim();

            // 检查是否为结束标记
            if (dataContent === '[DONE]') {
              console.log('[ModelConfigAPI] Received end marker');
              if (onChunkReceived) {
                onChunkReceived(null, { connectionStatus: 'done' });
              }
              continue;
            }

            try {
              // 解析JSON数据
              const jsonData = JSON.parse(dataContent);

              // 处理状态消息
              if (jsonData.status) {
                console.log(`[ModelConfigAPI] Status update: ${jsonData.status}`);
                if (onChunkReceived) {
                  onChunkReceived(null, {
                    connectionStatus: jsonData.status,
                    message: jsonData.message || ''
                  });
                }
                continue;
              }

              // 处理错误消息
              if (jsonData.error) {
                console.error(`[ModelConfigAPI] Error: ${jsonData.error}`);
                if (onChunkReceived) {
                  onChunkReceived(null, {
                    connectionStatus: 'error',
                    error: jsonData.error
                  });
                }
                throw new Error(jsonData.error);
              }

              // 处理内容块
              if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.content !== undefined) {
                const content = jsonData.choices[0].delta.content;
                // 过滤掉null、undefined和'null'字符串，但允许空字符串
                if (onChunkReceived && content !== null && content !== undefined && content !== 'null' && content !== 'undefined') {
                  console.log(`[ModelConfigAPI] Received content chunk: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}" (${content.length} chars)`);

                  // 更新全部响应
                  fullResponse += content;

                  // 立即通知前端更新UI，不使用setTimeout
                  onChunkReceived(content, { connectionStatus: 'active' });
                }
              }
            } catch (e) {
              // 如果是API错误（非JSON解析错误），需要向上抛出
              if (e.message && !e.message.includes('JSON')) {
                throw e;
              }
              console.error(`[ModelConfigAPI] Failed to parse SSE data: ${e.message}`, dataContent);
            }
          }
        }
      }

      console.log(`[ModelConfigAPI] SSE stream ended, total response length: ${fullResponse.length}`);
      return { success: true, response: fullResponse };

    } catch (error) {
      console.error('[ModelConfigAPI] Model stream test error:', error);
      if (onChunkReceived) {
        onChunkReceived(null, {
          connectionStatus: 'error',
          error: error.message
        });
      }
      throw error;
    }
  },

  // 获取单个模型配置详情
  getModelById: async (modelId) => {
    try {
      console.log(`[ModelConfigAPI] Fetching model configuration details: ID=${modelId}`);
      const response = await api.get(`/model-configs/${modelId}`);
      return response.data;
    } catch (error) {
      console.error(`[ModelConfigAPI] Failed to fetch model configuration details: ${error.message}`);
      throw error;
    }
  },

  // 获取GPUStack模型列表
  fetchGpustackModels: async (baseUrl, apiKey) => {
    try {
      console.log(`[ModelConfigAPI] Fetching GPUStack model list: baseUrl=${baseUrl}`);
      const response = await api.post('/model-configs/gpustack/models', {
        base_url: baseUrl,
        api_key: apiKey
      });
      return response.data;
    } catch (error) {
      console.error(`[ModelConfigAPI] Failed to fetch GPUStack model list: ${error.message}`);
      throw error;
    }
  },

  // 获取Ollama模型列表
  fetchOllamaModels: async (baseUrl) => {
    try {
      console.log(`[ModelConfigAPI] Fetching Ollama model list: baseUrl=${baseUrl}`);
      const response = await api.post('/model-configs/ollama/models', {
        base_url: baseUrl
      });
      return response.data;
    } catch (error) {
      console.error(`[ModelConfigAPI] Failed to fetch Ollama model list: ${error.message}`);
      throw error;
    }
  },

  // 获取Anthropic模型列表
  fetchAnthropicModels: async (baseUrl, apiKey) => {
    try {
      console.log(`[ModelConfigAPI] Fetching Anthropic model list: baseUrl=${baseUrl}`);
      const response = await api.post('/model-configs/anthropic/models', {
        base_url: baseUrl,
        api_key: apiKey
      });
      return response.data;
    } catch (error) {
      console.error(`[ModelConfigAPI] Failed to fetch Anthropic model list: ${error.message}`);
      throw error;
    }
  },

  // 获取Google模型列表
  fetchGoogleModels: async (baseUrl, apiKey) => {
    try {
      console.log(`[ModelConfigAPI] Fetching Google model list: baseUrl=${baseUrl}`);
      const response = await api.post('/model-configs/google/models', {
        base_url: baseUrl,
        api_key: apiKey
      });
      return response.data;
    } catch (error) {
      console.error(`[ModelConfigAPI] Failed to fetch Google model list: ${error.message}`);
      throw error;
    }
  },

  // 获取X.ai模型列表
  fetchXaiModels: async (baseUrl, apiKey) => {
    try {
      console.log(`[ModelConfigAPI] Fetching X.ai model list: baseUrl=${baseUrl}`);
      const response = await api.post('/model-configs/xai/models', {
        base_url: baseUrl,
        api_key: apiKey
      });
      return response.data;
    } catch (error) {
      console.error(`[ModelConfigAPI] Failed to fetch X.ai model list: ${error.message}`);
      throw error;
    }
  },

  // 测试模型服务连接
  testConnection: async (baseUrl, provider, apiKey = '') => {
    try {
      console.log(`[ModelConfigAPI] Testing connection: baseUrl=${baseUrl}, provider=${provider}`);
      const response = await api.post('/model-configs/test-connection', {
        base_url: baseUrl,
        provider: provider,
        api_key: apiKey
      });
      return response.data;
    } catch (error) {
      console.error(`[ModelConfigAPI] Connection test failed: ${error.message}`);
      throw error;
    }
  }
};