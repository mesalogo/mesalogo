import api from './axios';

/**
 * 行动任务相关API服务
 */
export const actionTaskAPI = {
  // 获取所有行动任务
  getAll: async (includeAgents = false) => {
    const params = includeAgents ? '?include_agents=true' : '';
    const response = await api.get(`/action-tasks${params}`);
    console.log('获取行动任务列表响应:', response.data);
    return response.data.action_tasks || []; // 返回action_tasks数组，如果不存在则返回空数组
  },

  // 获取所有行动任务及其智能体信息（用于记忆管理页面）
  getAllWithAgents: async () => {
    const response = await api.get('/action-tasks?include_agents=true');
    console.log('获取行动任务及智能体列表响应:', response.data);
    return response.data.action_tasks || [];
  },

  // 获取特定行动任务详情
  getById: async (id) => {
    const response = await api.get(`/action-tasks/${id}`);
    return response.data;
  },

  // 删除行动任务
  delete: async (id, cascade = true, forceCleanup = false) => {
    try {
      console.log('删除行动任务:', id, '级联删除:', cascade, '强制清理:', forceCleanup);
      const params = new URLSearchParams({
        cascade: cascade ? 'true' : 'false',
        force_cleanup: forceCleanup ? 'true' : 'false'
      });
      const response = await api.delete(`/action-tasks/${id}?${params}`);
      console.log('删除行动任务成功，响应数据:', response.data);
      return response.data;
    } catch (error) {
      console.error('删除行动任务失败:', error);
      throw error;
    }
  },

  // 创建新行动任务
  create: async (data) => {
    try {
      console.log('创建行动任务请求数据:', data);
      const response = await api.post('/action-tasks', data);
      console.log('创建行动任务成功，响应数据:', response.data);
      return response.data;
    } catch (error) {
      console.error('创建行动任务失败:', error);
      throw error;
    }
  },

  // 更新行动任务状态
  updateStatus: async (id, status) => {
    const response = await api.put(`/action-tasks/${id}/status`, { status });
    return response.data;
  },

  // 获取行动任务的智能体
  getAgents: async (id, isObserver = null) => {
    let url = `/action-tasks/${id}/agents`;
    if (isObserver !== null) {
      url += `?is_observer=${isObserver}`;
    }
    const response = await api.get(url);
    return response.data.agents || [];
  },

  // 获取行动任务的监督者智能体
  getSupervisorAgents: async (id) => {
    const response = await api.get(`/action-tasks/${id}/agents?is_observer=true`);
    return response.data.agents || [];
  },

  // 获取行动任务的普通智能体
  getNormalAgents: async (id) => {
    const response = await api.get(`/action-tasks/${id}/agents?is_observer=false`);
    return response.data.agents || [];
  },

  // 添加智能体到行动任务
  addAgent: async (taskId, agentId) => {
    const response = await api.post(`/action-tasks/${taskId}/agents`, { agent_id: agentId });
    return response.data;
  },

  // 从行动任务中移除智能体
  removeAgent: async (taskId, agentId) => {
    const response = await api.delete(`/action-tasks/${taskId}/agents/${agentId}`);
    return response.data;
  },

  // 设置默认智能体
  setDefaultAgent: async (taskId, agentId) => {
    const response = await api.put(`/action-tasks/${taskId}/agents/${agentId}/default`);
    return response.data;
  },

  // 从角色创建智能体实例并添加到行动任务
  createAgentFromRole: async (taskId, roleData) => {
    const response = await api.post(`/action-tasks/${taskId}/agents/from-role`, roleData);
    return response.data;
  },

  // 创建新行动任务并实例化智能体
  createWithAgents: async (data) => {
    try {
      console.log('创建行动任务请求数据:', data);
      const response = await api.post('/action-tasks', {
        ...data,
        role_ids: data.role_ids || []  // 确保包含role_ids字段
      });
      console.log('创建行动任务成功，响应数据:', response.data);
      return response.data;
    } catch (error) {
      console.error('创建行动任务失败:', error);
      throw error;
    }
  },

  // 获取行动任务的消息
  getMessages: async (id) => {
    console.warn('警告: actionTaskAPI.getMessages 已废弃，请使用 conversationAPI.getConversationMessages 代替');
    // 导入conversationAPI
    const { default: conversationAPI } = await import('./conversation');
    return conversationAPI.getMessages(id);
  },

  // 发送消息 (已废弃 - 不再支持非流式模式)
  sendMessage: async (id, content, targetAgentId = null) => {
    throw new Error('actionTaskAPI.sendMessage 已废弃且不再支持非流式模式，请使用 conversationAPI.sendConversationMessageStream 代替');
  },

  // 发送消息并获取流式响应 (WebSocket版本已废弃，请使用conversationAPI.sendConversationMessageStream)
  sendMessageStream: async (id, content, modelConfig, onChunk) => {
    console.warn('警告: actionTaskAPI.sendMessageStream 已废弃，请使用 conversationAPI.sendConversationMessageStream 代替');

    // 导入conversationAPI
    const { default: conversationAPI } = await import('./conversation');

    // 尝试获取默认会话
    try {
      const conversations = await conversationAPI.getConversations(id);

      if (conversations && conversations.length > 0) {
        // 使用第一个会话
        const conversationId = conversations[0].id;
        return conversationAPI.sendConversationMessageStream(id, conversationId, {
          content,
          target_agent_id: null
        }, onChunk);
      } else {
        // 如果没有会话，先创建一个
        const taskResponse = await api.get(`/action-tasks/${id}`);
        const task = taskResponse.data;

        const newConversation = await conversationAPI.createConversation(id, {
          title: `${task.title || '行动任务'} - 默认会话`,
          description: '自动创建的默认会话',
          mode: task.mode || 'sequential'
        });

        return conversationAPI.sendConversationMessageStream(id, newConversation.id, {
          content,
          target_agent_id: null
        }, onChunk);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      if (onChunk) {
        onChunk(null, {
          connectionStatus: 'error',
          error: error.message || '发送消息失败'
        });
      }
      throw error;
    }
  },

  // 添加监督意见
  addSupervisorComment: async (id, content, effectVariables = []) => {
    const data = {
      content,
      effect_variables: effectVariables
    };
    const response = await api.post(`/action-tasks/${id}/supervisor/comments`, data);
    return response.data;
  },

  // 获取行动任务的环境变量
  getEnvironmentVariables: async (id) => {
    try {
      // 获取任务环境变量（全局变量），同时包含智能体变量
      const response = await api.get(`/action-tasks/${id}/environment?agent_variables=true`);
      return response.data.variables;
    } catch (error) {
      console.error('获取任务环境变量失败:', error);
      return [];
    }
  },

  // 获取智能体的变量
  getAgentVariables: async (taskId, agentId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/agents/${agentId}/variables`);
      return response.data.variables;
    } catch (error) {
      console.error(`获取智能体 ${agentId} 的变量失败:`, error);
      return [];
    }
  },

  // 批量获取所有变量（环境变量和所有智能体变量）
  getBatchVariables: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/batch-variables`);
      return {
        environmentVariables: response.data.environment_variables || [],
        agentVariables: response.data.agent_variables || [],
        lastUpdated: response.data.last_updated
      };
    } catch (error) {
      console.error('批量获取变量失败:', error);
      return {
        environmentVariables: [],
        agentVariables: [],
        lastUpdated: new Date().toISOString()
      };
    }
  },

  // 监督者消息相关API
  // 发送监督者消息
  sendSupervisorMessage: async (taskId, conversationId, content, targetAgentId, sendTarget = 'supervisor') => {
    try {
      const response = await api.post(`/action-tasks/${taskId}/conversations/${conversationId}/messages`, {
        content: content,
        target_agent_id: targetAgentId,
        send_target: sendTarget // 'supervisor' 或 'task'
      });
      return response.data;
    } catch (error) {
      console.error('发送监督者消息失败:', error);
      throw error;
    }
  },

  // 获取监督者相关消息
  getSupervisorMessages: async (taskId, conversationId, supervisorAgentIds = []) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages`);
      const allMessages = response.data.messages || [];

      // 使用source字段筛选监督者相关消息
      const supervisorMessages = allMessages.filter(msg =>
        msg.source === 'supervisorConversation'
      );

      return supervisorMessages;
    } catch (error) {
      console.error('获取监督者消息失败:', error);
      return [];
    }
  },

  // 获取任务消息（包含监督者干预消息）
  getTaskMessages: async (taskId, conversationId, supervisorAgentIds = []) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages`);
      const allMessages = response.data.messages || [];

      // 筛选任务消息：
      // 1. source为taskConversation的消息
      // 2. source为supervisorConversation但有meta.type字段的监督者干预消息
      const taskMessages = allMessages.filter(msg => {
        // 普通任务消息
        if (msg.source === 'taskConversation' || !msg.source) {
          return true;
        }

        // 监督者干预消息（有meta.type字段的）
        if (msg.source === 'supervisorConversation' && msg.meta?.type) {
          return true;
        }

        return false;
      });

      return taskMessages;
    } catch (error) {
      console.error('获取任务消息失败:', error);
      return [];
    }
  },

  // 更新任务环境变量
  updateEnvironmentVariable: async (id, variableName, value) => {
    const data = {
      name: variableName,
      value: value
    };
    const response = await api.put(`/action-tasks/${id}/environment/variables`, data);
    return response.data;
  },

  // 删除任务环境变量
  deleteEnvironmentVariable: async (id, variableName) => {
    try {
      const response = await api.delete(`/action-tasks/${id}/environment/variables/${variableName}`);
      return response.data;
    } catch (error) {
      console.error(`删除任务 ${id} 的环境变量 ${variableName} 失败:`, error);
      throw error;
    }
  },

  // 获取分析报告
  getAnalysisReport: async (id) => {
    const response = await api.get(`/action-tasks/${id}/analysis`);
    return response.data;
  },

  // 导出任务数据
  exportTaskData: async (id, format = 'json') => {
    const response = await api.get(`/action-tasks/${id}/export?format=${format}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // 获取行动任务的监督者
  getObservers: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/observers`);
      return response.data.observers || [];
    } catch (error) {
      console.error(`获取行动任务${taskId}的监督者失败:`, error);
      return [];
    }
  },

  // 添加监督者到行动任务
  addObserver: async (taskId, observerData) => {
    try {
      const response = await api.post(`/action-tasks/${taskId}/observers`, observerData);
      return response.data;
    } catch (error) {
      console.error(`向行动任务${taskId}添加监督者失败:`, error);
      throw error;
    }
  },

  // 获取任务关联的规则
  getTaskRules: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/rules`);
      return response.data.rules;
    } catch (error) {
      console.error('获取任务规则失败:', error);
      throw error;
    }
  },

  // 获取任务的规则测试变量上下文
  getTaskRuleVariables: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/rule-variables`);
      return response.data.variables;
    } catch (error) {
      console.error('获取任务规则变量失败:', error);
      throw error;
    }
  },

  // 执行任务规则检查（复用规则测试API）
  testTaskRules: async (taskId: any, rules: any, testContext: any, roleId: any = null, options: any = {}) => {
    try {
      // 可选预加载变量，避免并发多次请求同一变量接口
      const variables = options.variables ?? await actionTaskAPI.getTaskRuleVariables(taskId);

      // 准备请求数据，包含完整的规则内容和任务变量
      const requestData: any = {
        rules: rules.map((rule: any) => ({
          id: rule.id,
          name: rule.name,
          type: rule.type,
          content: rule.content,
          interpreter: rule.type === 'logic' ? rule.interpreter : undefined
        })),
        context: testContext,
        variables: variables  // 使用任务的实际变量值
      };

      // 如果提供了角色ID，添加到请求中
      if (roleId) {
        requestData.role_id = roleId;
      }

      console.log('发送任务规则测试请求:', requestData);

      // 调用规则测试API
      const response = await api.post('/rules/test', requestData);
      console.log('任务规则测试成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('任务规则测试失败:', error);
      throw error;
    }
  },

  // 获取任务规则触发记录
  getRuleTriggers: async (taskId: any, params: any = {}) => {
    try {
      const queryParams = new URLSearchParams();

      // 添加分页参数
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);

      // 添加过滤参数
      if (params.rule_id) queryParams.append('rule_id', params.rule_id);
      if (params.trigger_type) queryParams.append('trigger_type', params.trigger_type);
      if (params.passed !== undefined) queryParams.append('passed', params.passed);

      const url = `/action-tasks/${taskId}/rule-triggers${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await api.get(url);
      console.log('获取规则触发记录成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取规则触发记录失败:', error);
      throw error;
    }
  },

  // 创建规则触发记录
  createRuleTrigger: async (taskId, triggerData) => {
    try {
      const response = await api.post(`/action-tasks/${taskId}/rule-triggers`, triggerData);
      console.log('创建规则触发记录成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('创建规则触发记录失败:', error);
      throw error;
    }
  },

  // 构建当前任务上下文
  buildTaskContext: async (taskId, conversationId) => {
    try {
      // 如果没有提供conversationId，尝试获取默认会话
      if (!conversationId || conversationId === 'undefined') {
        console.warn('会话ID无效，尝试获取默认会话');
        // 导入conversationAPI来获取会话列表
        const { default: conversationAPI } = await import('./conversation');
        const conversations = await conversationAPI.getConversations(taskId);

        if (conversations && conversations.length > 0) {
          conversationId = conversations[0].id;
          console.log('使用默认会话ID:', conversationId);
        } else {
          console.warn('没有找到可用的会话');
          return '当前任务会话上下文：暂无会话记录';
        }
      }

      // 获取最近的会话消息作为上下文
      const messages = await actionTaskAPI.getTaskMessages(taskId, conversationId);
      const recentMessages = messages.slice(-10); // 最近10条消息

      if (recentMessages.length === 0) {
        return '当前任务会话上下文：暂无消息记录';
      }

      const context = recentMessages.map(msg =>
        `${msg.role === 'human' ? '用户' : msg.agent_name || '智能体'}: ${msg.content}`
      ).join('\n');

      return `当前任务会话上下文：\n${context}`;
    } catch (error) {
      console.error('构建任务上下文失败:', error);
      return '当前任务会话上下文：无法获取会话内容，将使用默认测试场景';
    }
  },

  // 导出行动任务数据
  exportData: async (taskId, options) => {
    try {
      console.log('导出行动任务数据:', taskId, options);
      const response = await api.post(`/action-tasks/${taskId}/export`, options, {
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      console.error('导出行动任务数据失败:', error);
      throw error;
    }
  },

  // 更新智能体变量
  updateAgentVariable: async (agentId, variableName, value) => {
    try {
      const response = await api.put(`/agents/${agentId}/variables/${variableName}`, {
        value: value
      });
      return response.data;
    } catch (error) {
      console.error(`更新智能体 ${agentId} 的变量 ${variableName} 失败:`, error);
      throw error;
    }
  },

  // 删除智能体变量
  deleteAgentVariable: async (agentId, variableName) => {
    try {
      const response = await api.delete(`/agents/${agentId}/variables/${variableName}`);
      return response.data;
    } catch (error) {
      console.error(`删除智能体 ${agentId} 的变量 ${variableName} 失败:`, error);
      throw error;
    }
  }
};