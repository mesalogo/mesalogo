import { useState, useEffect, useRef } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import conversationAPI from '../../../../services/api/conversation';
import { actionTaskAPI } from '../../../../services/api/actionTask';
import settingsAPI from '../../../../services/api/settings';
import { modelConfigAPI } from '../../../../services/api/model';

/**
 * 对话数据管理 Hook
 * 负责所有数据获取、状态管理和工具调用检测
 */
export default function useConversationData(task, externalConversations, externalMessages, setExternalMessages, onMessagesUpdated) {
  const { t } = useTranslation();
  const { message } = App.useApp();

  // 会话相关状态
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [refreshingMessages, setRefreshingMessages] = useState(false);
  const [hasDefaultModel, setHasDefaultModel] = useState(false);

  // 消息相关状态
  const [messages, setMessages] = useState([]);

  // 全局设置和模型
  const [globalSettings, setGlobalSettings] = useState({
    enableAssistantGeneration: true,
    assistantGenerationModel: 'default'
  });
  const [models, setModels] = useState([]);

  // 变量相关状态
  const [environmentVariables, setEnvironmentVariables] = useState([]);
  const [agentVariables, setAgentVariables] = useState({});

  // 工具调用结果处理标志 - 使用 useRef 替代全局变量
  const toolCallResultProcessedRef = useRef(false);

  /**
   * 统一的消息更新函数，同时更新内部和外部状态
   */
  const updateMessages = (newMessages) => {
    if (typeof newMessages === 'function') {
      setMessages(prev => {
        const updated = newMessages(prev);
        // 使用 setTimeout 延迟更新外部状态，避免在渲染期间更新
        if (setExternalMessages) {
          setTimeout(() => {
            setExternalMessages(updated);
          }, 0);
        }
        return updated;
      });
    } else {
      setMessages(newMessages);
      if (setExternalMessages) {
        setTimeout(() => {
          setExternalMessages(newMessages);
        }, 0);
      }
    }
  };

  /**
   * 检测内容是否包含工具调用结果
   */
  const isToolCallResult = (content) => {
    if (!content || typeof content !== 'string') return false;

    return content.includes('"meta":{"ToolCallResult"') ||
           (content.includes('"toolName"') && content.includes('"toolCallId"')) ||
           (content.includes('"type":"toolResult"') && content.includes('"role":"tool"')) ||
           (content.includes('tool_call_id') && content.includes('name') && content.includes('content'));
  };

  /**
   * 检测 meta 对象是否包含工具调用结果
   */
  const isToolCallResultMeta = (meta) => {
    if (!meta) return false;

    return meta.type === 'toolCallResult' ||
           (meta.ToolCallResult && meta.toolCallId) ||
           (meta.toolName && meta.toolCallId) ||
           (meta.type === 'toolResult' && meta.role === 'tool');
  };

  /**
   * 检测内容是否包含plan相关工具调用结果
   */
  const isPlanToolResult = (content) => {
    if (!content || typeof content !== 'string') return false;
    return content.includes('create_plan') || 
           content.includes('update_plan_item') || 
           content.includes('get_plan');
  };

  /**
   * 触发变量刷新回调（带防抖处理）
   */
  const triggerVariablesRefresh = (onUserMessageSent) => {
    if (!onUserMessageSent || toolCallResultProcessedRef.current) {
      return;
    }

    console.log('检测到工具调用结果，触发变量刷新');
    toolCallResultProcessedRef.current = true;

    setTimeout(() => {
      console.log('执行变量刷新回调');
      onUserMessageSent();

      // 5秒后重置标志
      setTimeout(() => {
        console.log('重置工具调用结果处理标志');
        toolCallResultProcessedRef.current = false;
      }, 5000);
    }, 100);
  };

  /**
   * 获取全局设置
   */
  const fetchGlobalSettings = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      setGlobalSettings({
        enableAssistantGeneration: settings.enableAssistantGeneration !== undefined ? settings.enableAssistantGeneration : true,
        assistantGenerationModel: settings.assistantGenerationModel || 'default'
      });
    } catch (error) {
      console.error('获取全局设置失败:', error);
    }
  };

  /**
   * 获取模型配置列表
   */
  const fetchModels = async () => {
    try {
      const configs = await modelConfigAPI.getAll();
      setModels(configs);
    } catch (error) {
      console.error('获取模型配置失败:', error);
      setModels([]);
    }
  };

  /**
   * 检查是否配置了默认模型
   */
  const checkDefaultModel = async () => {
    try {
      const models = await modelConfigAPI.getAll();
      console.log('[总结功能] 获取到的模型配置:', models);
      const hasDefault = Array.isArray(models) && models.some(m => m.is_default_text);
      console.log('[总结功能] 是否有默认文本模型:', hasDefault);
      setHasDefaultModel(hasDefault);
    } catch (error) {
      console.error('[总结功能] 检查默认模型配置失败:', error);
      setHasDefaultModel(false);
    }
  };

  /**
   * 加载会话列表
   */
  const fetchConversations = async () => {
    try {
      setConversationsLoading(true);

      // 如果有外部传入的会话列表，使用外部列表
      if (externalConversations !== null) {
        setConversations(externalConversations);

        // 如果存在会话且没有选中的会话，则选择第一个
        if (externalConversations.length > 0 && !activeConversationId) {
          const firstConvId = externalConversations[0].id;
          setActiveConversationId(firstConvId);
          const messagesData = await actionTaskAPI.getTaskMessages(task.id, firstConvId);
          updateMessages(messagesData);
          if (onMessagesUpdated) {
            setTimeout(() => {
              onMessagesUpdated(messagesData);
            }, 0);
          }
        }
      } else {
        // 否则从API获取会话列表
        const conversationsData = await conversationAPI.getConversations(task.id);
        setConversations(conversationsData);

        // 如果存在会话且没有选中的会话，则选择第一个
        if (conversationsData.length > 0 && !activeConversationId) {
          setActiveConversationId(conversationsData[0].id);
          const messagesData = await actionTaskAPI.getTaskMessages(task.id, conversationsData[0].id);
          updateMessages(messagesData);
          if (onMessagesUpdated) {
            setTimeout(() => {
              onMessagesUpdated(messagesData);
            }, 0);
          }
        }
      }
    } catch (error) {
      console.error(t('conversation.loadFailed') + ':', error);
      message.error(t('conversation.loadListFailed') + ': ' + error.message);
    } finally {
      setConversationsLoading(false);
    }
  };

  /**
   * 处理会话切换
   * 注意：流式状态的清理需要在调用此方法后由主组件处理
   */
  const handleChangeConversation = async (conversationId) => {
    try {
      setActiveConversationId(conversationId);

      // 清空所有消息
      updateMessages([]);

      // 加载新选择的会话的任务消息
      const messagesData = await actionTaskAPI.getTaskMessages(task.id, conversationId);
      updateMessages(messagesData);

      // 通知父组件
      if (onMessagesUpdated) {
        setTimeout(() => {
          onMessagesUpdated(messagesData);
        }, 0);
      }
    } catch (error) {
      console.error(t('conversation.switchFailed') + ':', error);
      message.error(t('conversation.loadMessagesFailed') + ': ' + error.message);
    }
  };

  /**
   * 刷新当前会话消息
   */
  const handleRefreshMessages = async () => {
    if (!activeConversationId) {
      message.warning(t('conversation.selectFirst'));
      return;
    }

    try {
      setRefreshingMessages(true);

      // 重新加载当前会话的任务消息
      const messagesData = await actionTaskAPI.getTaskMessages(task.id, activeConversationId);
      updateMessages(messagesData);

      // 通知父组件
      if (onMessagesUpdated) {
        setTimeout(() => {
          onMessagesUpdated(messagesData);
        }, 0);
      }

      message.success(t('conversation.refreshSuccess'));
    } catch (error) {
      console.error('刷新消息失败:', error);
      message.error(t('conversation.refreshFailed') + ': ' + error.message);
    } finally {
      setRefreshingMessages(false);
    }
  };

  /**
   * 加载环境变量和智能体变量
   */
  const fetchVariables = async () => {
    if (!task || !task.id) return;

    try {
      const batchVariables = await actionTaskAPI.getBatchVariables(task.id);

      setEnvironmentVariables(batchVariables.environmentVariables || []);

      const agentVars = {};
      if (task.agents && task.agents.length > 0) {
        for (const variable of batchVariables.agentVariables) {
          if (variable.agent_id) {
            if (!agentVars[variable.agent_id]) {
              agentVars[variable.agent_id] = [];
            }
            agentVars[variable.agent_id].push(variable);
          }
        }

        for (const agent of task.agents) {
          if (agentVars[agent.id]) {
            agent.variables = agentVars[agent.id];
          } else {
            agent.variables = [];
          }
        }
      }

      setAgentVariables(agentVars);
      console.log('批量获取变量成功，最后更新时间:', batchVariables.lastUpdated);
    } catch (error) {
      console.error('获取变量失败:', error);
      message.error('获取环境变量失败: ' + error.message);
    }
  };

  // 初始化时获取全局设置和模型配置
  useEffect(() => {
    fetchGlobalSettings();
    fetchModels();
    checkDefaultModel();
  }, []);

  // 同步外部messages状态
  useEffect(() => {
    if (externalMessages && Array.isArray(externalMessages)) {
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  // 同步外部会话列表
  useEffect(() => {
    if (externalConversations !== null) {
      setConversations(externalConversations);
    }
  }, [externalConversations]);

  // 初始化加载会话列表和变量
  useEffect(() => {
    if (task && task.id) {
      fetchConversations();
      fetchVariables();
    }
  }, [task]);

  return {
    // 会话相关
    conversations,
    activeConversationId,
    setActiveConversationId,
    conversationsLoading,
    fetchConversations,
    handleChangeConversation,

    // 消息相关
    messages,
    updateMessages,
    refreshingMessages,
    handleRefreshMessages,

    // 全局设置
    globalSettings,
    models,
    hasDefaultModel,

    // 变量管理
    environmentVariables,
    agentVariables,
    fetchVariables,

    // 工具调用刷新
    toolCallResultProcessedRef,
    triggerVariablesRefresh,
    isToolCallResult,
    isToolCallResultMeta,
    isPlanToolResult
  };
}
