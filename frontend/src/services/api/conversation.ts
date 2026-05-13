import api from './axios';

// Type definitions
interface ConversationAPI {
  _activeTaskId: string | null;
  _activeConversationId: string | null;
  _activeStreamControllers: Map<string, AbortController>;
  getActivePlan: (conversationId: string) => Promise<any>;
  getPlans: (conversationId: string) => Promise<any[]>;
  updatePlanItem: (conversationId: string, planId: string, itemId: string, updates: any) => Promise<any>;
  _getBaseUrl: () => string;
  [key: string]: any; // Allow additional properties for extensibility
}

/**
 * 会话API服务
 * 提供与智能体会话相关的API函数
 */
const conversationAPI: ConversationAPI = {
  _activeTaskId: null,
  _activeConversationId: null,
  _activeStreamControllers: new Map(),
  
  /**
   * 获取会话的活跃计划
   * @param {string} conversationId 会话ID
   * @returns {Promise<Object|null>} 活跃计划，如果没有则返回 null
   */
  getActivePlan: async (conversationId: string) => {
    try {
      const response = await api.get(`/conversations/${conversationId}/plans/active`);
      // 后端现在会返回 null 而不是 404，直接返回响应数据
      return response.data;
    } catch (error) {
      // 记录错误
      console.error('获取活跃计划失败:', error);
      return null;
    }
  },

  /**
   * 获取会话的所有计划
   * @param {string} conversationId 会话ID
   * @returns {Promise<Array>} 计划列表
   */
  getPlans: async (conversationId) => {
    try {
      const response = await api.get(`/conversations/${conversationId}/plans`);
      return response.data || [];
    } catch (error) {
      console.error('获取计划列表失败:', error);
      throw error;
    }
  },

  /**
   * 更新计划项状态
   * @param {string} conversationId 会话ID
   * @param {string} planId 计划ID
   * @param {string} itemId 计划项ID
   * @param {Object} updates 更新数据
   * @returns {Promise<Object>} 更新后的计划项
   */
  updatePlanItem: async (conversationId, planId, itemId, updates) => {
    try {
      const response = await api.put(
        `/conversations/${conversationId}/plans/${planId}/items/${itemId}`,
        updates
      );
      return response.data;
    } catch (error) {
      console.error('更新计划项失败:', error);
      throw error;
    }
  },

  // 获取API基础URL（从api实例或环境变量）
  _getBaseUrl: () => {
    // 从api导入的baseURL中移除'/api'，因为我们的端点已经包含了它
    const apiBaseUrl = api.defaults.baseURL;
    if (apiBaseUrl) {
      // 移除末尾的'/api'如果存在
      const baseUrlWithoutApi = apiBaseUrl.endsWith('/api')
        ? apiBaseUrl.substring(0, apiBaseUrl.length - 4)
        : apiBaseUrl;
      return baseUrlWithoutApi;
    }
    // 回退到环境变量
    return process.env.REACT_APP_API_URL || '';
  },

  /**
   * 获取行动任务的所有会话
   * @param {string} taskId 行动任务ID
   * @returns {Promise<Array>} 会话列表
   */
  getConversations: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations`);
      return response.data.conversations || [];
    } catch (error) {
      console.error('获取会话列表失败:', error);
      throw error;
    }
  },

  /**
   * 获取特定会话详情
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @returns {Promise<Object>} 会话详情
   */
  getConversationById: async (taskId, conversationId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('获取会话详情失败:', error);
      throw error;
    }
  },

  /**
   * 创建子任务
   * @param {string} taskId 行动任务ID
   * @param {Object} data 会话数据
   * @returns {Promise<Object>} 创建的会话信息
   */
  createConversation: async (taskId, data) => {
    try {
      const response = await api.post(`/action-tasks/${taskId}/conversations`, data);
      return response.data;
    } catch (error) {
      console.error('创建会话失败:', error);
      throw error;
    }
  },

  /**
   * 获取特定会话的消息历史
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @returns {Promise<Array>} 消息历史数组
   */
  getConversationMessages: async (taskId, conversationId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages`);
      return response.data.messages || [];
    } catch (error) {
      console.error('获取会话消息历史失败:', error);
      throw error;
    }
  },

  /**
   * 发送消息到特定会话 (仅支持流式模式)
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @param {object} messageData 消息数据对象
   * @param {string} messageData.content 消息内容
   * @param {string} [messageData.target_agent_id] 目标智能体ID（可选）
   * @param {boolean} [stream=true] 是否使用流式响应 (必须为true)
   * @param {function} onStreamCallback 流式响应回调函数，格式为(content, meta) => {}
   * @returns {Promise<object>} 发送结果
   */
  sendConversationMessage: async (taskId, conversationId, messageData, stream = true, onStreamCallback) => {
    try {
      console.log(`发送会话消息: 任务ID=${taskId}, 会话ID=${conversationId}, 流式=${stream}`, messageData);

      // 仅支持流式响应模式
      if (stream && onStreamCallback) {
        // 构建API端点，添加stream=1参数，使用统一的方法获取基础URL
        const baseUrl = conversationAPI._getBaseUrl();
        const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/messages?stream=1`;
        console.log('流式请求端点:', endpoint);

        // 通知连接已开始建立
        onStreamCallback(null, { connectionStatus: 'connecting' });

        // 使用fetch发送请求
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        });

        // 检查响应状态
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API 错误 (${response.status}): ${errorText}`);
        }

        // 获取响应正文作为流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // 通知连接已建立
        onStreamCallback(null, { connectionStatus: 'connected' });

        let responseObj = {};
        let buffer = '';

        // 读取流
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // 解码二进制数据为文本
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // 按行分割，处理完整的SSE消息
          let lines = buffer.split('\n');

          // 保留最后一行（可能不完整）到buffer
          buffer = lines.pop() || '';

          // 处理完整的行
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 跳过空行和注释行
            if (!line || line.startsWith(':')) {
              continue;
            }

            // 处理SSE行
            if (line.startsWith('data: ')) {
              const data = line.substring(6); // 移除 "data: " 前缀

              // 如果数据为空，可能是流结束信号
              if (!data.trim()) {
                console.log('接收到空数据，可能是流结束信号');
                continue;
              }

              // 检查是否是HTML注释分隔符
              if (data.includes('<!-- LLM开始处理工具调用结果 -->') ||
                  data.includes('<!-- LLM处理工具调用结果结束 -->')) {
                console.log('检测到工具调用处理分隔符:', data);
                // 直接将HTML注释作为内容传递给回调，用于前端分隔显示
                onStreamCallback(data, null);
                continue;
              }

              // 尝试解析JSON
              try {
                const parsed = JSON.parse(data);
                console.log('解析后的流式消息:', parsed);

                // 分支1: 内容事件 - 包含content字段的普通内容
                if (parsed.content !== undefined && !parsed.type && !parsed.connectionStatus) {
                  onStreamCallback(parsed.content, null);
                  continue;
                }

                // 分支2: 如果是字符串类型
                if (typeof parsed === 'string') {
                  onStreamCallback(parsed, null);
                  continue;
                }

                // 分支3: 有connectionStatus字段的事件 (连接状态更新)
                if (parsed.connectionStatus) {
                  onStreamCallback(null, parsed);
                  continue;
                }

                // 分支4: 有type字段的事件 (如思考事件、工具调用、处理通知等)
                if (parsed.type) {
                  // 对特定类型进行额外处理
                  if (parsed.type === 'processingToolResults' && parsed.meta) {
                    console.log('工具调用结果处理中:', parsed.meta);
                    // 将meta数据传递给回调
                    onStreamCallback(null, {
                      type: 'processingToolResults',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // 处理工具结果状态变化
                  if (parsed.type === 'toolResultsProcessing' && parsed.meta) {
                    console.log('工具结果处理状态变化:', parsed.meta);
                    // 将meta数据传递给回调
                    onStreamCallback(null, {
                      type: 'toolResultsProcessing',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // 传递所有其他类型事件
                  onStreamCallback(null, parsed);
                  continue;
                }

                // 分支5: 其他情况，尝试作为内容传递
                console.log('未识别的JSON格式，作为内容传递:', parsed);
                onStreamCallback(data, null);

              } catch (error) {
                // 如果JSON解析失败，将数据作为纯文本内容处理
                console.log('JSON解析失败，将数据作为纯文本处理:', data);
                onStreamCallback(data, null);
              }
            }
          }
        }

        // 处理流结束
        console.log('流读取完成');
        return responseObj;
      }

      // 如果没有提供流式回调，抛出错误
      throw new Error('sendConversationMessage 必须使用流式模式，请提供 stream=true 和 onStreamCallback 参数');
    } catch (error) {
      // 如果是用户中断的错误，使用警告级别而不是错误级别
      if (error.name === 'AbortError' || error.message.includes('用户中断')) {
        console.warn('流式请求被用户中断:', error);
      } else {
        console.error('发送消息到会话失败:', error);
      }
      throw error; // 直接抛出错误，让调用方处理
    }
  },

  /**
   * 获取特定任务的消息历史
   * @param {string} taskId 任务ID
   * @returns {Promise<Array>} 消息历史数组
   */
  getMessages: async (taskId) => {
    try {
      // 尝试获取任务的第一个会话
      try {
        const conversations = await conversationAPI.getConversations(taskId);
        if (conversations && conversations.length > 0) {
          // 使用第一个会话的消息
          const conversationMessages = await conversationAPI.getConversationMessages(taskId, conversations[0].id);
          return conversationMessages;
        }
      } catch (err) {
        console.warn('获取会话消息失败，尝试获取任务消息:', err);
      }

      // 降级处理：尝试直接获取任务消息（旧API，将来会废弃）
      const response = await api.get(`/action-tasks/${taskId}/messages`);
      console.warn('警告：直接从任务获取消息的API将会被废弃，请迁移到基于会话的API');
      return response.data.messages || [];
    } catch (error) {
      console.error('获取消息历史失败:', error);
      throw error;
    }
  },

  /**
   * 轮询获取新消息
   * @param {string} taskId 任务ID
   * @param {string} [conversationId] 会话ID（可选）
   * @param {string} lastMessageId 最后一条消息的ID
   * @returns {Promise<Array>} 新消息数组
   */
  pollNewMessages: async (taskId, conversationId, lastMessageId) => {
    try {
      // 优先使用指定的会话ID
      if (conversationId) {
        const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages/new`, {
          params: { last_message_id: lastMessageId }
        });
        return response.data.messages || [];
      }

      // 否则尝试获取默认会话
      const conversations = await conversationAPI.getConversations(taskId);
      if (conversations && conversations.length > 0) {
        const response = await api.get(`/action-tasks/${taskId}/conversations/${conversations[0].id}/messages/new`, {
          params: { last_message_id: lastMessageId }
        });
        return response.data.messages || [];
      }

      // 降级处理：使用任务消息API
      console.warn('警告：直接从任务轮询消息的API将会被废弃，请迁移到基于会话的API');
      const response = await api.get(`/action-tasks/${taskId}/messages/new`, {
        params: { last_message_id: lastMessageId }
      });
      return response.data.messages || [];
    } catch (error) {
      console.error('轮询消息失败:', error);
      throw error;
    }
  },

  /**
   * 获取会话的元数据
   * @param {string} taskId 任务ID
   * @returns {Promise<object>} 会话元数据
   */
  getConversationMetadata: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}`);
      return response.data;
    } catch (error) {
      console.error('获取会话元数据失败:', error);
      throw error;
    }
  },

  /**
   * 发送消息到会话（流式API版本）
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @param {object} messageData 消息数据
   * @param {function} onStreamCallback 流式回调函数，格式为(content, meta) => {}
   * @returns {Promise<object>} 发送结果
   */
  sendConversationMessageStream: async (taskId, conversationId, messageData, onStreamCallback) => {
    // 根据 send_target 生成唯一的 controller key，避免监督者会话和任务会话冲突
    const sendTarget = messageData.send_target || 'task';
    const controllerKey = `${conversationId}:${sendTarget}`;
    
    try {
      console.log(`流式发送消息: 任务ID=${taskId}, 会话ID=${conversationId}, sendTarget=${sendTarget}`, messageData);

      // 记录当前活动的会话信息，用于取消流式输出
      conversationAPI._activeTaskId = taskId;
      conversationAPI._activeConversationId = conversationId;

      // 如果该会话有正在进行的流式请求，先取消它
      const existingController = conversationAPI._activeStreamControllers.get(controllerKey);
      if (existingController) {
        console.log(`取消该会话之前的流式请求 (${sendTarget})`);
        try {
          existingController.abort();
        } catch (e) {
          console.error('取消之前的流式请求失败:', e);
        }
      }

      // 创建新的AbortController实例
      const controller = new AbortController();
      conversationAPI._activeStreamControllers.set(controllerKey, controller);

      // 构建API端点，添加stream=1参数，使用统一的方法获取基础URL
      const baseUrl = conversationAPI._getBaseUrl();
      const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/messages?stream=1`;
      console.log('流式请求端点:', endpoint);

      // 通知连接已开始建立
      onStreamCallback(null, { connectionStatus: 'connecting' });

      // 使用fetch发送请求
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
        signal: controller.signal // 使用AbortController的信号
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 错误 (${response.status}): ${errorText}`);
      }

      // 获取响应正文作为流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 通知连接已建立
      onStreamCallback(null, { connectionStatus: 'connected' });

      let responseObj = {};
      let buffer = '';

      // 读取流
      while (true) {
        try {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // 解码二进制数据为文本
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // 按行分割，处理完整的SSE消息
          let lines = buffer.split('\n');

          // 保留最后一行（可能不完整）到buffer
          buffer = lines.pop() || '';

          // 处理完整的行
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 跳过空行和注释行
            if (!line || line.startsWith(':')) {
              continue;
            }

            // 处理SSE行
            if (line.startsWith('data: ')) {
              const data = line.substring(6); // 移除 "data: " 前缀

              // 如果数据为空，可能是流结束信号
              if (!data.trim()) {
                console.log('接收到空数据，可能是流结束信号');
                continue;
              }

              // 不再需要处理HTML注释分隔符
              // 前端可以通过消息类型识别工具调用和结果处理的状态

              // 尝试解析JSON
              try {
                const parsed = JSON.parse(data);
                console.log('解析后的流式消息:', parsed);

                // 分支1: 内容事件 - 包含content字段的普通内容
                if (parsed.content !== undefined && !parsed.type && !parsed.connectionStatus) {
                  onStreamCallback(parsed.content, null);
                  continue;
                }

                // 分支2: 如果是字符串类型
                if (typeof parsed === 'string') {
                  onStreamCallback(parsed, null);
                  continue;
                }

                // 分支3: 有connectionStatus字段的事件 (连接状态更新)
                if (parsed.connectionStatus) {
                  onStreamCallback(null, parsed);
                  continue;
                }

                // 分支4: 有type字段的事件 (如思考事件、工具调用、处理通知等)
                if (parsed.type) {
                  // 对特定类型进行额外处理
                  if (parsed.type === 'processingToolResults' && parsed.meta) {
                    console.log('工具调用结果处理中:', parsed.meta);
                    // 将meta数据传递给回调
                    onStreamCallback(null, {
                      type: 'processingToolResults',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // 处理工具结果状态变化
                  if (parsed.type === 'toolResultsProcessing' && parsed.meta) {
                    console.log('工具结果处理状态变化:', parsed.meta);
                    // 将meta数据传递给回调
                    onStreamCallback(null, {
                      type: 'toolResultsProcessing',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // 传递所有其他类型事件
                  onStreamCallback(null, parsed);
                  continue;
                }

                // 分支5: 其他情况，尝试作为内容传递
                console.log('未识别的JSON格式，作为内容传递:', parsed);
                onStreamCallback(data, null);

              } catch (error) {
                // 如果JSON解析失败，将数据作为纯文本内容处理
                console.log('JSON解析失败，将数据作为纯文本处理:', data);
                onStreamCallback(data, null);
              }
            }
          }
        } catch (error) {
          // 检查是否是由于中止信号导致的错误
          if (error.name === 'AbortError') {
            console.log('流式请求被中止');
            // 通知回调流已被取消
            onStreamCallback(null, {
              connectionStatus: 'error',
              error: '流式请求被用户中断'
            });
            break;
          }

          // 其他错误
          console.error('读取流时出错:', error);
          onStreamCallback(null, {
            connectionStatus: 'error',
            error: `读取流时出错: ${error.message}`
          });
          break;
        }
      }

      // 清除控制器引用（使用 controllerKey）
      if (conversationAPI._activeStreamControllers.get(controllerKey) === controller) {
        conversationAPI._activeStreamControllers.delete(controllerKey);
      }

      // 处理流结束
      console.log('流读取完成');
      return responseObj;
    } catch (error) {
      // 检查是否是由于中止信号导致的错误
      if (error.name === 'AbortError') {
        console.log('流式请求被中止');
        // 不显示错误消息，因为可能是切换会话导致的正常中断
      } else {
        console.error('发送流式消息到会话失败:', error);
        onStreamCallback(null, {
          connectionStatus: 'error',
          error: error.message
        });
      }

      // 清除控制器引用（使用 controllerKey）
      conversationAPI._activeStreamControllers.delete(controllerKey);

      throw error; // 直接抛出错误，让调用方处理
    }
  },

  /**
   * 取消当前正在进行的流式响应
   * @param {string} [agentId] 智能体ID，如果提供则只取消该智能体的流式任务
   * @returns {Promise<boolean>} 是否成功取消
   */
  cancelStreamingResponse: async (agentId) => {
    return new Promise((resolve) => {
      try {
        // 存储当前活动的会话信息
        const activeTaskId = conversationAPI._activeTaskId;
        const activeConversationId = conversationAPI._activeConversationId;

        // 如果只是取消特定智能体，不要中止整个SSE连接
        // 只有在取消整个会话时才中止连接
        if (!agentId && activeConversationId) {
          const controller = conversationAPI._activeStreamControllers.get(activeConversationId);
          if (controller) {
            console.log('取消整个会话，中止前端流式请求');
            try {
              controller.abort();
              conversationAPI._activeStreamControllers.delete(activeConversationId);
            } catch (e) {
              console.error('中止前端流式请求失败:', e);
            }
          }
        } else if (agentId) {
          console.log(`取消特定智能体 ${agentId}，保持SSE连接以接收后续智能体信息`);
        }

        // 如果有活动的会话，调用后端API取消流式输出
        if (activeTaskId && activeConversationId) {
          // 准备请求数据
          const requestData = agentId ? { agent_id: agentId } : {};

          // 调用后端API取消流式输出
          api.post(`/action-tasks/${activeTaskId}/conversations/${activeConversationId}/cancel-stream`, requestData)
            .then(response => {
              console.log('后端取消流式输出结果:', response.data);
              // 无论后端返回什么，都认为取消成功，避免前端卡住
              resolve(true);
            })
            .catch(error => {
              console.error('后端取消流式输出错误:', error);
              // 即使API调用失败，也认为取消成功
              resolve(true);
            });
        } else {
          console.log('没有活动的会话信息，无法取消流式输出');
          // 即使没有活动会话，也返回成功，避免前端卡住
          resolve(true);
        }
      } catch (error) {
        console.error('取消流式响应出错:', error);
        // 即使出现异常，也返回成功，避免前端卡住
        resolve(true);
      }
    });
  },

  /**
   * 启动自动讨论（流式API版本）
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @param {object} discussionOptions 讨论选项
   * @param {number} discussionOptions.rounds 讨论轮数
   * @param {string} [discussionOptions.topic] 讨论主题
   * @param {boolean} [discussionOptions.summarize] 是否进行总结
   * @param {number} [discussionOptions.summarizerAgentId] 指定进行总结的智能体ID（可选，默认使用第一个智能体）
   * @param {function} onStreamCallback 流式响应回调函数，格式为(content, meta) => {}
   * @returns {Promise<object>} 讨论结果
   */
  startAutoDiscussion: async (taskId, conversationId, discussionOptions, onStreamCallback) => {
    try {
      console.log(`启动自动讨论: 任务ID=${taskId}, 会话ID=${conversationId}`, discussionOptions);

      // 记录当前活动的会话信息，用于取消流式输出
      conversationAPI._activeTaskId = taskId;
      conversationAPI._activeConversationId = conversationId;

      // 如果该会话有正在进行的流式请求，先取消它
      const existingController = conversationAPI._activeStreamControllers.get(conversationId);
      if (existingController) {
        console.log('取消该会话之前的流式请求');
        try {
          existingController.abort();
        } catch (e) {
          console.error('取消之前的流式请求失败:', e);
        }
      }

      // 创建新的AbortController实例
      const controller = new AbortController();
      conversationAPI._activeStreamControllers.set(conversationId, controller);

      // 构建API端点，添加stream=1参数，使用统一的方法获取基础URL
      const baseUrl = conversationAPI._getBaseUrl();
      const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/auto-discussion?stream=1`;
      console.log('自动讨论流式请求端点:', endpoint);

      // 通知连接已开始建立
      onStreamCallback(null, { connectionStatus: 'connecting' });

      // 使用fetch发送请求
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discussionOptions),
        signal: controller.signal // 使用AbortController的信号
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 错误 (${response.status}): ${errorText}`);
      }

      // 获取响应正文作为流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 通知连接已建立
      onStreamCallback(null, { connectionStatus: 'connected' });

      let responseObj = {};
      let buffer = '';

      // 读取流
      while (true) {
        try {
          // 读取下一块数据
          const { done, value } = await reader.read();

          // 如果流结束，退出循环
          if (done) {
            console.log('自动讨论流已结束');
            break;
          }

          // 将二进制数据解码为文本
          const chunk = decoder.decode(value, { stream: true });
          console.log('收到自动讨论数据块:', chunk.length, '字节');

          // 添加到缓冲区
          buffer += chunk;

          // 按行拆分缓冲区
          const lines = buffer.split('\n');

          // 如果只有一行且没有完整的行，则继续读取
          if (lines.length === 1 && !buffer.endsWith('\n')) {
            continue;
          }

          // 保留最后一个不完整的行用于下一次拼接
          buffer = lines.pop() || '';

          // 处理完整的行
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 跳过空行和注释行
            if (!line || line.startsWith(':')) {
              continue;
            }

            console.log('自动讨论处理行:', line.substring(0, 50) + (line.length > 50 ? '...' : ''));

            // 处理SSE行
            if (line.startsWith('data: ')) {
              const data = line.substring(6); // 移除 "data: " 前缀

              // 如果数据为空，可能是流结束信号
              if (!data.trim()) {
                console.log('接收到空数据，可能是流结束信号');
                continue;
              }

              // 不再需要处理HTML注释分隔符
              // 前端可以通过消息类型识别工具调用和结果处理的状态

              // 尝试解析JSON
              try {
                const parsed = JSON.parse(data);
                console.log('自动讨论JSON解析结果:', typeof parsed, parsed ?
                  (typeof parsed === 'object' ? Object.keys(parsed) : '非对象') : '空值');

                // 特殊处理可能导致"done"状态未被正确处理的情况
                if (parsed.connectionStatus === 'done') {
                  console.log('自动讨论完成状态信号已收到:', parsed);

                  // 确保回调接收到完成状态
                  onStreamCallback(null, {
                    connectionStatus: 'done',
                    message: parsed.message || '自动讨论已完成',
                    ...(parsed) // 保留原有字段
                  });

                  // 清除活动的控制器
                  console.log('自动讨论正常完成，清除活动控制器');
                  conversationAPI._activeStreamControllers.delete(conversationId);

                  // 跳过后续处理
                  continue;
                }

                // 特殊处理connectionStatus字段（可能直接在根对象上）
                if (parsed.connectionStatus) {
                  console.log('自动讨论直接收到连接状态:', parsed.connectionStatus);
                  onStreamCallback(null, parsed); // 传递整个对象作为meta

                  // 如果是完成事件，清除控制器引用
                  if (parsed.connectionStatus === 'done' || parsed.connectionStatus === 'error') {
                    console.log(`自动讨论${parsed.connectionStatus === 'done' ? '正常完成' : '出错结束'}`);
                    conversationAPI._activeStreamControllers.delete(conversationId);
                  }
                }
                // 正常处理content和meta
                else {
                  // 调用回调函数，传递content和meta
                  onStreamCallback(parsed.content, parsed.meta);

                  // 处理连接状态
                  if (parsed.meta && parsed.meta.connectionStatus) {
                    console.log('自动讨论收到连接状态:', parsed.meta.connectionStatus);
                    // 如果是完成事件，清除控制器引用
                    if (parsed.meta.connectionStatus === 'done' || parsed.meta.connectionStatus === 'error') {
                      console.log(`自动讨论${parsed.meta.connectionStatus === 'done' ? '正常完成' : '出错结束'}`);
                      conversationAPI._activeStreamControllers.delete(conversationId);
                    }
                  }
                }

              } catch (error) {
                // 如果JSON解析失败，将数据作为纯文本内容处理
                console.error('自动讨论JSON解析失败:', error, '原始数据:', data);
                onStreamCallback(data, null);
              }
            }
          }
        } catch (error) {
          // 检查是否是由于中止信号导致的错误
          if (error.name === 'AbortError') {
            console.log('自动讨论流式请求被中止');
            // 不显示错误消息，因为可能是切换会话导致的正常中断
            break;
          }

          // 其他错误
          console.error('自动讨论读取流时出错:', error);
          onStreamCallback(null, {
            connectionStatus: 'error',
            error: `读取流时出错: ${error.message}`
          });
          break;
        }
      }

      // 清除控制器引用
      if (conversationAPI._activeStreamControllers.get(conversationId) === controller) {
        conversationAPI._activeStreamControllers.delete(conversationId);
      }

      // 处理流结束
      console.log('自动讨论流读取完成');
      return responseObj;
    } catch (error) {
      // 检查是否是由于中止信号导致的错误
      if (error.name === 'AbortError') {
        console.log('自动讨论流式请求被中止');
        // 不显示错误消息，因为可能是切换会话导致的正常中断
      } else {
        console.error('自动讨论流式请求失败:', error);
        onStreamCallback(null, {
          connectionStatus: 'error',
          error: error.message
        });
      }

      // 清除控制器引用
      conversationAPI._activeStreamControllers.delete(conversationId);

      throw error; // 直接抛出错误，让调用方处理
    }
  },

  /**
   * 获取行动任务的所有自主任务记录
   * @param {string} taskId 行动任务ID
   * @returns {Promise<object>} 自主任务记录列表
   */
  getActionTaskAutonomousTasks: async (taskId) => {
    try {
      console.log(`获取行动任务自主任务记录: 任务ID=${taskId}`);
      const response = await api.get(`/action-tasks/${taskId}/autonomous-tasks`);
      console.log('获取行动任务自主任务记录成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取行动任务自主任务记录失败:', error);
      throw error;
    }
  },

  /**
   * 获取会话的自主任务记录（保持兼容性）
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @returns {Promise<object>} 自主任务记录列表
   */
  getAutonomousTasks: async (taskId, conversationId) => {
    try {
      console.log(`获取自主任务记录: 任务ID=${taskId}, 会话ID=${conversationId}`);
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/autonomous-tasks`);
      console.log('获取自主任务记录成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取自主任务记录失败:', error);
      throw error;
    }
  },

  /**
   * 停止自主任务
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @param {string} autonomousTaskId 自主任务ID
   * @returns {Promise<object>} 停止结果
   */
  stopAutonomousTask: async (taskId, conversationId, autonomousTaskId) => {
    try {
      console.log(`停止自主任务: 任务ID=${taskId}, 会话ID=${conversationId}, 自主任务ID=${autonomousTaskId}`);
      const response = await api.post(`/action-tasks/${taskId}/conversations/${conversationId}/autonomous-tasks/${autonomousTaskId}/stop`);
      console.log('停止自主任务成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('停止自主任务失败:', error);
      throw error;
    }
  },

  /**
   * 启动变量触发会话
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @param {object} config 变量触发配置
   * @param {string} config.topic 讨论主题
   * @param {Array} config.triggerConditions 触发条件数组
   * @param {string} config.conditionLogic 条件逻辑 ('and' | 'or')
   * @param {number} config.checkInterval 检查间隔（秒）
   * @param {number} config.maxTriggers 最大触发次数
   * @param {number} config.maxRuntime 最大运行时间（分钟）
   * @param {function} onStreamCallback 流式响应回调函数
   * @returns {Promise<object>} 启动结果
   */
  startVariableTriggerConversation: async (taskId, conversationId, config, onStreamCallback) => {
    try {
      console.log(`启动变量触发会话: 任务ID=${taskId}, 会话ID=${conversationId}`, config);

      // 构建变量触发选项，复用startAutoDiscussion的结构
      const variableTriggerOptions = {
        isVariableTrigger: true,
        topic: config.topic || '请基于各自角色和知识，响应变量变化进行行动',
        triggerConditions: config.triggerConditions || [],
        triggerConditionLogic: config.conditionLogic || 'or',
        checkInterval: config.checkInterval || 5,
        maxTriggerExecutions: config.maxTriggers || 0,
        totalTimeLimit: config.maxRuntime || 0,
        enablePlanning: config.enable_planning || false,
        plannerAgentId: config.planner_agent_id || null
      };

      // 复用现有的startAutoDiscussion方法，保持一致性
      return await conversationAPI.startAutoDiscussion(
        taskId,
        conversationId,
        variableTriggerOptions,
        onStreamCallback
      );

    } catch (error) {
      console.error('启动变量触发会话失败:', error);
      throw error;
    }
  },

  /**
   * 总结会话上下文（自动总结功能）
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @returns {Promise<object>} 总结结果
   */
  summarizeContext: async (taskId: string, conversationId: string) => {
    try {
      console.log(`总结会话上下文: 任务ID=${taskId}, 会话ID=${conversationId}`);
      const response = await api.post(`/action-tasks/${taskId}/conversations/${conversationId}/summarize-context`);
      console.log('总结会话上下文成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('总结会话上下文失败:', error);
      throw error;
    }
  },

  /**
   * 启动自主调度会话
   * @param {string} taskId 行动任务ID
   * @param {string} conversationId 会话ID
   * @param {object} config 自主调度配置
   * @param {string} config.topic 任务主题
   * @param {string} config.plannerAgentId 计划智能体ID（可选）
   * @param {number} config.maxRounds 最大轮数
   * @param {number} config.timeoutMinutes 超时时间（分钟）
   * @param {function} onStreamCallback 流式响应回调函数
   * @returns {Promise<object>} 启动结果
   */
  startAutonomousScheduling: async (taskId, conversationId, config, onStreamCallback) => {
    try {
      console.log(`启动自主调度会话: 任务ID=${taskId}, 会话ID=${conversationId}`, config);

      // 构建自主调度选项
      const autonomousSchedulingOptions = {
        topic: config.topic || '请基于各自角色和知识，进行自主调度协作',
        plannerAgentId: config.plannerAgentId || null,
        enablePlanning: config.enablePlanning || false,
        maxRounds: config.maxRounds || 50,
        timeoutMinutes: config.timeoutMinutes || 60,
        stream: true  // 始终使用流式模式
      };

      // 如果该会话有正在进行的流式请求，先取消它
      const existingController = conversationAPI._activeStreamControllers.get(conversationId);
      if (existingController) {
        console.log('取消该会话之前的流式请求');
        try {
          existingController.abort();
        } catch (e) {
          console.error('取消之前的流式请求失败:', e);
        }
      }

      // 创建新的AbortController实例
      const controller = new AbortController();
      conversationAPI._activeStreamControllers.set(conversationId, controller);

      // 构建API端点，添加stream=1参数，使用统一的方法获取基础URL
      const baseUrl = conversationAPI._getBaseUrl();
      const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/autonomous-scheduling`;
      console.log('自主调度流式请求端点:', endpoint);

      // 通知连接已开始建立
      onStreamCallback(null, { connectionStatus: 'connecting' });

      // 使用fetch发送请求
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(autonomousSchedulingOptions),
        signal: controller.signal // 使用AbortController的信号
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 错误 (${response.status}): ${errorText}`);
      }

      // 通知连接已建立
      onStreamCallback(null, { connectionStatus: 'connected' });

      // 读取流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseObj = { status: 'success' };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('自主调度流读取完成');
            break;
          }

          // 解码数据
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '') continue;

            // 处理SSE格式的数据
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // 移除 'data: ' 前缀

              if (data === '[DONE]') {
                console.log('自主调度流结束标记');
                onStreamCallback(null, { connectionStatus: 'done' });
                // 清除活动控制器引用，防止后续状态异常
                if (conversationAPI._activeStreamControllers.get(conversationId) === controller) {
                  conversationAPI._activeStreamControllers.delete(conversationId);
                }
                continue;
              }

              try {
                const parsedData = JSON.parse(data);
                console.log('自主调度解析的数据:', parsedData);

                // 调用回调函数处理数据
                if (parsedData.content !== undefined || parsedData.meta) {
                  onStreamCallback(parsedData.content, parsedData.meta);
                } else {
                  onStreamCallback(null, parsedData);
                }

              } catch (error) {
                // 如果JSON解析失败，将数据作为纯文本内容处理
                console.log('JSON解析失败，将数据作为纯文本处理:', data);
                onStreamCallback(data, null);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 处理流结束
      console.log('自主调度流读取完成');
      return responseObj;

    } catch (error) {
      console.error('启动自主调度会话失败:', error);
      throw error;
    }
  },


};

export default conversationAPI;