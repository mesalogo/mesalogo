import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import conversationAPI from '../../../../services/api/conversation';
import { actionTaskAPI } from '../../../../services/api/actionTask';
import settingsAPI from '../../../../services/api/settings';
import { modelConfigAPI } from '../../../../services/api/model';
import { getAssistantGenerationModelId } from '../../../../utils/modelUtils';

// 导入样式
import 'katex/dist/katex.min.css';
import '../../css/conversation.css';

// 导入自定义Hooks
import useConversationData from './useConversationData';
import useStreamingHandler from './useStreamingHandler';

// 导入子组件
import ConversationHeader from './ConversationHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ConversationModals from './ConversationModals';
import { PlannerPanel } from './Planner';

/**
 * 对话组件主入口
 * 协调所有子组件和业务逻辑
 */
const ActionTaskConversation = forwardRef(({
  task,
  messages: externalMessages,
  setMessages: setExternalMessages,
  onMessagesUpdated,
  onAgentRespondingChange,
  onUserMessageSent,
  onRefreshAutonomousTaskCard,
  readOnly = false,
  isPublicView = false,
  shareToken = null,
  password = null,
  externalConversations = null,
  onConversationCreated = null
}: any, ref) => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  // 滚动引用
  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  
  // 自动滚动控制（默认启用）
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const autoScrollEnabledRef = useRef(autoScrollEnabled);

  // SubAgent 协作开关（默认关闭）
  const [subAgentEnabled, setSubAgentEnabled] = useState(false);
  
  // 保持 ref 与 state 同步
  useEffect(() => {
    autoScrollEnabledRef.current = autoScrollEnabled;
  }, [autoScrollEnabled]);
  
  // 滚动到底部 - 使用平滑滚动
  const scrollToBottom = useCallback(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTo({
        top: messageContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  // ========== 1. 数据管理Hook ==========
  const conversationData = useConversationData(
    task,
    externalConversations,
    externalMessages,
    setExternalMessages,
    onMessagesUpdated
  );

  // ========== 2. 组件内部状态 ==========
  // 消息输入相关
  const [userMessage, setUserMessage] = useState('');
  const [targetAgentIds, setTargetAgentIds] = useState([]);
  const [isolationMode, setIsolationMode] = useState(false);
  const [smartDispatchEnabled, setSmartDispatchEnabled] = useState(true);

  // 图像相关
  const [attachedImages, setAttachedImages] = useState([]);
  const [showImageUpload, setShowImageUpload] = useState(false);

  // 消息辅助
  const [assistingMessage, setAssistingMessage] = useState(false);

  // 会话创建相关
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [showCreateValidation, setShowCreateValidation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [enableSummary, setEnableSummary] = useState(false);

  // 自主任务相关
  const [isAutoDiscussing, setIsAutoDiscussing] = useState(false);
  const [autoDiscussModalVisible, setAutoDiscussModalVisible] = useState(false);
  const [startingAutoDiscussion, setStartingAutoDiscussion] = useState(false);
  const [stoppingDiscussion, setStoppingDiscussion] = useState(false);

  // 计划相关
  const [activePlan, setActivePlan] = useState(null);

  // 监听 activePlan 变化
  useEffect(() => {
    console.log('[ActionTaskConversation] activePlan 状态变化:', activePlan);
  }, [activePlan]);
  const [autoDiscussionOptions, setAutoDiscussionOptions] = useState({
    rounds: 1,
    topic: '',
    summarize: true,
    summarizerAgentId: null,
    isInfinite: false,
    isTimeTrigger: false,
    isVariableTrigger: false,
    isAutonomousScheduling: false,
    stopConditions: [],
    speakingMode: 'sequential',
    enablePlanning: false,
    plannerAgentId: null,
    timeInterval: 30,
    maxExecutions: 0,
    triggerAction: 'single_round',
    triggerRounds: 2,
    enableTimeLimit: false,
    totalTimeLimit: 1440,
    apiUrl: '',
    apiMethod: 'GET',
    apiHeaders: [],
    apiBody: '',
    responseDataPath: '',
    triggerConditions: [],
    checkInterval: 60,
    maxTriggerExecutions: 0,
    variableTriggerAction: 'single_round',
    variableTriggerRounds: 2,
    maxRounds: 50,
    timeoutMinutes: 60
  });

  // 加载活跃计划
  const loadActivePlan = async (conversationId) => {
    const plan = await conversationAPI.getActivePlan(conversationId);
    setActivePlan(plan);
  };

  // ========== 3. 流式处理Hook ==========
  const streamingHandler = useStreamingHandler({
    task,
    activeConversationId: conversationData.activeConversationId,
    updateMessages: conversationData.updateMessages,
    messages: conversationData.messages,
    onMessagesUpdated,
    triggerVariablesRefresh: conversationData.triggerVariablesRefresh,
    isToolCallResult: conversationData.isToolCallResult,
    isToolCallResultMeta: conversationData.isToolCallResultMeta,
    isPlanToolResult: conversationData.isPlanToolResult,
    targetAgentIds,
    isAutoDiscussing,
    setIsAutoDiscussing,
    onAgentRespondingChange,
    onUserMessageSent,
    onRefreshAutonomousTaskCard,
    scrollToBottom,
    autoScrollEnabledRef,
    loadActivePlan
  });

  // ========== 4. 业务方法 ==========

  /**
   * 包装会话切换，确保清理流式状态
   */
  const handleChangeConversation = async (conversationId) => {
    // 先清理流式状态
    streamingHandler.setCurrentStreamingResponse('');
    streamingHandler.setIsObserving(false);
    streamingHandler.setStreamingAgentId(null);
    
    // 然后切换会话
    await conversationData.handleChangeConversation(conversationId);
    
    // 加载计划
    if (conversationId) {
      loadActivePlan(conversationId);
    }
  };

  /**
   * 包装刷新消息，同时刷新计划
   */
  const handleRefreshMessages = async () => {
    await conversationData.handleRefreshMessages();
    
    // 刷新计划
    if (conversationData.activeConversationId) {
      loadActivePlan(conversationData.activeConversationId);
    }
  };

  /**
   * 构建多模态消息内容
   */
  const buildMessageContent = () => {
    const content = [];

    if (userMessage.trim()) {
      content.push({
        type: 'text',
        text: userMessage.trim() // 去掉首尾空格和空行，保留中间的换行
      });
    }

    attachedImages.forEach(image => {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.info.mime_type,
          data: image.base64.split(',')[1]
        }
      });
    });

    return content;
  };

  /**
   * 图像处理函数
   */
  const handleImageUpload = (imageData) => {
    setAttachedImages(prev => [...prev, imageData]);
  };

  const removeImage = (imageId) => {
    setAttachedImages(prev => prev.filter(img => img.id !== imageId));
  };

  /**
   * 处理消息辅助
   */
  const handleMessageAssist = async (assistMode) => {
    try {
      if (!conversationData.globalSettings.enableAssistantGeneration) {
        message.warning(t('assistant.notEnabled'));
        return;
      }

      if (!userMessage.trim()) {
        message.warning(t('assistant.enterMessageFirst'));
        return;
      }

      setAssistingMessage(true);

      let promptTemplate;
      try {
        const templates = await settingsAPI.getPromptTemplates();
        promptTemplate = templates.userMessageExpand;

        if (!promptTemplate) {
          throw new Error(t('assistant.templateNotFound'));
        }
      } catch (error) {
        console.error('获取提示词模板失败:', error);
        message.error(t('assistant.templateFailed'));
        return;
      }

      const participantRoles = task?.agents?.filter(agent => !agent.is_observer).map(agent => agent.name).join(', ') || '';

      const generatePrompt = promptTemplate
        .replace('{{original_message}}', userMessage)
        .replace('{{action_space_name}}', task?.action_space?.name || '')
        .replace('{{action_space_description}}', task?.action_space?.description || '')
        .replace('{{participant_roles}}', participantRoles)
        .replace('{{assist_mode}}', assistMode);

      const modelToUse = await getAssistantGenerationModelId(conversationData.models, conversationData.globalSettings.assistantGenerationModel);

      let generatedContent = '';
      const handleStreamResponse = (content, meta) => {
        if (content !== null) {
          generatedContent += content;
          setUserMessage(generatedContent);
        }
      };

      await modelConfigAPI.testModelStream(
        modelToUse,
        generatePrompt,
        handleStreamResponse,
        "你是一个专业的消息优化助手，擅长根据上下文和需求优化用户消息。",
        {
          temperature: 0.7,
          max_tokens: 1000
        }
      );

      const cleanedContent = generatedContent
        .replace(/null/g, '')
        .replace(/undefined/g, '')
        .trim();

      setUserMessage(cleanedContent);
      
      const getModeLabel = (mode) => {
        return t(`assistant.mode.${mode}`) || t('assistant.mode.default');
      };
      
      message.success(getModeLabel(assistMode) + t('assistant.complete'));
    } catch (error) {
      console.error('辅助生成失败:', error);
      message.error(t('assistant.generateFailed') + ': ' + (error.message || t('message.unknownError')));
    } finally {
      setAssistingMessage(false);
    }
  };

  /**
   * 发送消息
   */
  const sendMessage = async () => {
    // 如果当前正在响应中，先取消当前响应
    if (streamingHandler.isResponding) {
      const currentAgentId = streamingHandler.streamingAgentId;
      const finalStreamContent = streamingHandler.currentStreamingResponse || '';

      let agentInfo = null;
      if (currentAgentId && task.agents) {
        agentInfo = task.agents.find(agent =>
          agent.id === Number(currentAgentId) || String(agent.id) === String(currentAgentId)
        );
      }

      streamingHandler.setSendingMessage(true);

      try {
        if (finalStreamContent) {
          const agentResponse = {
            id: `stream-${Date.now()}`,
            role: 'assistant',
            content: finalStreamContent,
            timestamp: new Date().toISOString(),
            agent_id: currentAgentId,
            agent_name: agentInfo ? agentInfo.name : null,
            agent: agentInfo ? {
              id: agentInfo.id,
              name: agentInfo.name,
              role_name: agentInfo.role_name
            } : null,
            is_cancelled: true
          };

          conversationData.updateMessages(prev => [...prev, agentResponse]);
        }

        await conversationAPI.cancelStreamingResponse(currentAgentId);
        console.log(`已发送取消流式响应请求，智能体ID: ${currentAgentId || '无'}`);

        const cancellationMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: agentInfo
            ? `用户中断了智能体 ${agentInfo.name}${agentInfo.role_name ? ` [${agentInfo.role_name}]` : ''} 的响应`
            : `用户中断了智能体的响应`,
          timestamp: new Date().toISOString()
        };

        conversationData.updateMessages(prev => [...prev, cancellationMessage]);

        if (onMessagesUpdated) {
          const updatedMessages = [...conversationData.messages];
          if (finalStreamContent) {
            updatedMessages.push({
              id: `stream-${Date.now()}`,
              role: 'assistant',
              content: finalStreamContent,
              timestamp: new Date().toISOString(),
              agent_id: currentAgentId,
              agent_name: agentInfo ? agentInfo.name : null,
              agent: agentInfo ? {
                id: agentInfo.id,
                name: agentInfo.name,
                role_name: agentInfo.role_name
              } : null,
              is_cancelled: true
            });
          }
          updatedMessages.push(cancellationMessage);
          setTimeout(() => {
            onMessagesUpdated(updatedMessages);
          }, 0);
        }

        if (isAutoDiscussing) {
          message.success(`已成功中断智能体${agentInfo ? ` ${agentInfo.name}` : ''}，自主任务将继续下一个智能体`);
        } else {
          message.success('已成功中断智能体响应');
        }
      } catch (error) {
        console.error('取消流式响应出错:', error);
        message.error('中断智能体响应时出错: ' + error.message);
      } finally {
        streamingHandler.setCurrentStreamingResponse('');
        streamingHandler.setIsObserving(false);
        const isMultiAgentScenario = targetAgentIds.length > 1 || (targetAgentIds.length === 0 && task.agents?.length > 1);
        if (!isAutoDiscussing && !isMultiAgentScenario) {
          console.log('取消流式响应 - 单智能体场景，完全清理流式状态');
          streamingHandler.setStreamingAgentId(null);
        } else {
          console.log('取消流式响应 - 多智能体场景，保持部分状态等待下一个智能体');
        }
        streamingHandler.setSendingMessage(false);
      }

      return;
    }

    if (!userMessage.trim() && attachedImages.length === 0) return;

    streamingHandler.setSendingMessage(true);

    try {
      const messageContent = buildMessageContent();

      const isSmartDispatch = smartDispatchEnabled && targetAgentIds.length === 0;
      const userMsg = {
        id: `msg-${Date.now()}`,
        role: 'human',
        content: messageContent.length === 1 && messageContent[0].type === 'text'
          ? messageContent[0].text
          : messageContent,
        timestamp: new Date().toISOString(),
        target_agent_ids: targetAgentIds.length > 0 ? targetAgentIds : null,
        smart_dispatch: isSmartDispatch
      };

      conversationData.updateMessages(prev => [...prev, userMsg]);

      setUserMessage('');
      setTargetAgentIds([]); // 清空目标智能体列表
      streamingHandler.setCurrentStreamingResponse('');
      setAttachedImages([]);
      setShowImageUpload(false);

      if (onUserMessageSent) {
        onUserMessageSent();
      }

      if (task.status === 'active') {
        try {
          let currentConversationId = conversationData.activeConversationId;

          if (!currentConversationId) {
            console.log('未选择会话，获取或创建默认会话');

            const conversations = await conversationAPI.getConversations(task.id);

            if (conversations && conversations.length > 0) {
              currentConversationId = conversations[0].id;
              conversationData.setActiveConversationId(currentConversationId);
              console.log(`使用现有默认会话ID: ${currentConversationId}`);
            } else {
              const newConversation = await conversationAPI.createConversation(task.id, {
                title: `${task.title || '行动任务'} - 默认会话`,
                description: '自动创建的默认会话',
                mode: task.mode || 'sequential'
              });

              currentConversationId = newConversation.id;
              conversationData.setActiveConversationId(currentConversationId);
              console.log(`创建并使用新默认会话ID: ${currentConversationId}`);

              if (onConversationCreated) {
                onConversationCreated(newConversation);
              }

              conversationData.fetchConversations();
            }
          }

          console.log(`流式发送消息到会话:${currentConversationId}`, messageContent, targetAgentIds);

          const messageData = {
            content: messageContent.length === 1 && messageContent[0].type === 'text'
              ? messageContent[0].text
              : messageContent,
            target_agent_ids: targetAgentIds.length > 0 ? targetAgentIds : null,
            isolation_mode: isolationMode,
            smart_dispatch: smartDispatchEnabled && targetAgentIds.length === 0,
            enable_subagent: subAgentEnabled
          };

          await conversationAPI.sendConversationMessageStream(
            task.id,
            currentConversationId,
            messageData,
            streamingHandler.handleStreamResponse
          );
        } catch (error) {
          console.error('API发送消息失败:', error);

          const currentAgentId = streamingHandler.streamingAgentId;
          let agentInfo = null;
          if (currentAgentId && task.agents) {
            agentInfo = task.agents.find(agent =>
              agent.id === Number(currentAgentId) || String(agent.id) === String(currentAgentId)
            );
          }

          const errorResponse: any = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `错误: ${error.message || '未知错误'}。请检查网络连接或联系管理员。`,
            timestamp: new Date().toISOString(),
            thinking: `错误详情: ${error.stack || error.message}`
          };

          if (agentInfo) {
            errorResponse.agent_id = agentInfo.id;
            errorResponse.agent_name = agentInfo.name;
            errorResponse.role_name = agentInfo.role_name;
            errorResponse.agent = {
              id: agentInfo.id,
              name: agentInfo.name,
              role_name: agentInfo.role_name
            };
          }

          conversationData.updateMessages(prev => [...prev, errorResponse]);

          if (onMessagesUpdated) {
            setTimeout(() => {
              onMessagesUpdated([...conversationData.messages, userMsg, errorResponse]);
            }, 0);
          }

          message.error(`消息发送失败: ${error.message}`);
        }
      } else {
        message.warning(`行动任务当前状态(${task.status})不允许发送消息`);

        const statusMessage = {
          id: `status-${Date.now()}`,
          role: 'system',
          content: `当前任务状态为 "${task.status}"，无法发送消息。请先激活任务。`,
          timestamp: new Date().toISOString()
        };

        conversationData.updateMessages(prev => [...prev, statusMessage]);

        if (onMessagesUpdated) {
          setTimeout(() => {
            onMessagesUpdated([...conversationData.messages, userMsg, statusMessage]);
          }, 0);
        }
      }
    } catch (error) {
      console.error('发送消息错误:', error);
      message.error('发送消息失败: ' + (error.message || '未知错误'));
      streamingHandler.setSendingMessage(false);
    }
  };

  /**
   * 监督者干预方法
   */
  const sendSupervisorIntervention = async (messageContent, supervisorAgentId) => {
    if (!conversationData.activeConversationId) {
      message.warning(t('conversation.selectFirst'));
      return;
    }

    if (!messageContent.trim()) {
      message.warning(t('conversation.enterMessage'));
      return;
    }

    try {
      console.log('监督者干预：直接发送消息', {
        content: messageContent,
        supervisorAgentId,
        conversationId: conversationData.activeConversationId
      });

      streamingHandler.setSendingMessage(true);
      streamingHandler.setCurrentStreamingResponse('');

      if (onUserMessageSent) {
        onUserMessageSent();
      }

      const userMsg = {
        id: `supervisor-intervention-${Date.now()}`,
        role: 'human',
        content: messageContent,
        timestamp: new Date().toISOString(),
        target_agent_ids: [supervisorAgentId],
        source: 'supervisorConversation',
        meta: { type: 'info' },
        isTemporary: true
      };

      conversationData.updateMessages(prev => [...prev, userMsg]);

      const messageData = {
        content: messageContent,
        target_agent_id: supervisorAgentId,
        send_target: 'task_intervention',
        isolation_mode: isolationMode
      };

      await conversationAPI.sendConversationMessageStream(
        task.id,
        conversationData.activeConversationId,
        messageData,
        streamingHandler.handleStreamResponse
      );

      console.log('监督者干预消息发送完成');
    } catch (error) {
      console.error('监督者干预发送失败:', error);
      message.error(t('message.sendFailed') + ': ' + (error.message || t('message.unknownError')));

      streamingHandler.setSendingMessage(false);
    }
  };

  /**
   * 创建会话
   */
  const handleCreateConversation = async () => {
    if (!newConversationTitle.trim()) {
      setShowCreateValidation(true);
      message.warning(t('conversation.titleRequired'));
      return;
    }

    try {
      setCreatingConversation(true);

      const conversationData_new: any = {
        title: newConversationTitle,
        mode: task.mode || 'sequential'
      };

      const willGenerateSummary = enableSummary && conversationData.activeConversationId && conversationData.messages.length > 0;
      if (willGenerateSummary) {
        conversationData_new.source_conversation_id = conversationData.activeConversationId;
        message.loading({ content: '正在生成会话总结...', key: 'createConversation', duration: 0 });
      }

      const newConversation = await conversationAPI.createConversation(task.id, conversationData_new);

      if (willGenerateSummary) {
        message.destroy('createConversation');
      }

      if (onConversationCreated) {
        onConversationCreated(newConversation);
      }

      await conversationData.fetchConversations();

      conversationData.setActiveConversationId(newConversation.id);

      try {
        const messagesData = await actionTaskAPI.getTaskMessages(task.id, newConversation.id);
        conversationData.updateMessages(messagesData);
        if (onMessagesUpdated) {
          setTimeout(() => {
            onMessagesUpdated(messagesData);
          }, 0);
        }
      } catch (error) {
        console.error('加载新会话消息失败:', error);
        conversationData.updateMessages([]);
      }

      streamingHandler.setCurrentStreamingResponse('');
      streamingHandler.setIsObserving(false);
      streamingHandler.setStreamingAgentId(null);

      setShowNewConversationModal(false);
      setShowCreateValidation(false);
      setNewConversationTitle('');
      setEnableSummary(false);

      message.success(t('conversation.createSuccess'));
    } catch (error) {
      console.error('创建会话失败:', error);
      message.error(t('conversation.createFailed') + ': ' + error.message);
    } finally {
      setCreatingConversation(false);
    }
  };

  /**
   * 自主任务方法
   */
  const showAutoDiscussModal = () => {
    if (!conversationData.activeConversationId) {
      message.warning('请先选择或创建一个会话');
      return;
    }

    const currentConversation = conversationData.conversations.find(conv => conv.id === conversationData.activeConversationId);
    if (!currentConversation || currentConversation.agent_count < 1) {
      message.warning('当前会话中智能体数量不足，自动讨论需要至少一个智能体');
      return;
    }

    setAutoDiscussModalVisible(true);
  };

  const handleAutoDiscussCancel = () => {
    setAutoDiscussModalVisible(false);
  };

  const handleAutoDiscussConfirm = async (confirmedOptions?: any) => {
    // 使用传入的选项数据（如果有），否则回退到状态变量（向后兼容）
    const options = confirmedOptions || autoDiscussionOptions;
    
    try {
      setStartingAutoDiscussion(true);
      setAutoDiscussModalVisible(false);

      if (!conversationData.activeConversationId) {
        message.warning('请先选择或创建一个会话');
        setStartingAutoDiscussion(false);
        return;
      }

      const currentConversation = conversationData.conversations.find(conv => conv.id === conversationData.activeConversationId);
      if (!currentConversation || currentConversation.agent_count < 1) {
        message.warning('当前会话中智能体数量不足，自动讨论需要至少一个智能体');
        setStartingAutoDiscussion(false);
        return;
      }

      setIsAutoDiscussing(true);

      if (onRefreshAutonomousTaskCard) {
        onRefreshAutonomousTaskCard();
      }

      if (options.isVariableTrigger) {
        const variableConfig: any = {
          topic: options.topic,
          triggerConditions: options.triggerConditions || [],
          conditionLogic: (options as any).triggerConditionLogic || 'or',
          checkInterval: options.checkInterval || 5,
          maxTriggers: options.maxTriggerExecutions || 0,
          maxRuntime: options.totalTimeLimit || 0,
          enable_planning: options.enablePlanning || false,
          planner_agent_id: options.plannerAgentId || null
        };

        await conversationAPI.startVariableTriggerConversation(
          task.id,
          conversationData.activeConversationId,
          variableConfig,
          streamingHandler.handleAutoDiscussionResponse
        );
      } else if ((options as any).isAutonomousScheduling) {
        const autonomousConfig: any = {
          topic: options.topic,
          plannerAgentId: options.plannerAgentId || null,
          enablePlanning: options.enablePlanning || false,
          maxRounds: (options as any).maxRounds || 50,
          timeoutMinutes: (options as any).timeoutMinutes || 60
        };

        await conversationAPI.startAutonomousScheduling(
          task.id,
          conversationData.activeConversationId,
          autonomousConfig,
          streamingHandler.handleAutoDiscussionResponse
        );
      } else {
        await conversationAPI.startAutoDiscussion(
          task.id,
          conversationData.activeConversationId,
          options,
          streamingHandler.handleAutoDiscussionResponse
        );
      }
    } catch (error) {
      console.error('启动自动讨论失败:', error);
      message.error('启动自动讨论失败: ' + error.message);
      setIsAutoDiscussing(false);

      if (onRefreshAutonomousTaskCard) {
        onRefreshAutonomousTaskCard();
      }
    } finally {
      setStartingAutoDiscussion(false);
    }
  };

  const handleCancelAutoDiscussion = async () => {
    if (isAutoDiscussing) {
      try {
        setStoppingDiscussion(true);

        // 获取当前会话的活动自主任务
        const autonomousTasksResult = await conversationAPI.getAutonomousTasks(
          task.id, 
          conversationData.activeConversationId
        );
        const activeTasks = autonomousTasksResult?.autonomous_tasks?.filter(
          (t: any) => t.status === 'active'
        ) || [];

        if (activeTasks.length > 0) {
          // 停止第一个活动的自主任务（调用 stop API）
          const activeTask = activeTasks[0];
          console.log(`停止自主任务: autonomousTaskId=${activeTask.id}`);
          await conversationAPI.stopAutonomousTask(
            task.id,
            conversationData.activeConversationId,
            activeTask.id
          );
          console.log('停止自主任务成功');
        } else {
          // 没有找到活动任务，报错
          throw new Error('未找到活动的自主任务');
        }

        message.info('已停止自动讨论');
        setIsAutoDiscussing(false);
        streamingHandler.setCurrentDiscussionRound(0);
        streamingHandler.setCurrentDiscussionTotalRounds(0);
        streamingHandler.setDiscussionAgentInfo(null);
        streamingHandler.setStreamingAgentId(null);

        if (onRefreshAutonomousTaskCard) {
          onRefreshAutonomousTaskCard();
        }

        const cancelMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: `用户手动停止了自动讨论`,
          timestamp: new Date().toISOString()
        };

        conversationData.updateMessages(prev => [...prev, cancelMessage]);

        if (onMessagesUpdated) {
          setTimeout(() => {
            onMessagesUpdated([...conversationData.messages, cancelMessage]);
          }, 0);
        }

        if (conversationData.activeConversationId) {
          await conversationData.handleChangeConversation(conversationData.activeConversationId);
        }
      } catch (error) {
        console.error('停止自动讨论失败:', error);
        message.error('停止自动讨论失败: ' + error.message);

        setIsAutoDiscussing(false);
        streamingHandler.setCurrentDiscussionRound(0);
        streamingHandler.setCurrentDiscussionTotalRounds(0);
        streamingHandler.setDiscussionAgentInfo(null);
        streamingHandler.setStreamingAgentId(null);

        if (onRefreshAutonomousTaskCard) {
          onRefreshAutonomousTaskCard();
        }
      } finally {
        setStoppingDiscussion(false);
      }
    }
  };

  // ========== 5. useImperativeHandle - 暴露方法给父组件 ==========
  useImperativeHandle(ref, () => ({
    sendSupervisorIntervention
  }), [conversationData.activeConversationId, task.id]);

  // ========== 6. useEffect - 智能滚动（仅在非流式状态下的消息变化时触发） ==========
  const prevMessageCountRef = useRef(conversationData.messages?.length || 0);
  useEffect(() => {
    const currentCount = conversationData.messages?.length || 0;
    // 仅在消息数量变化且非流式响应中时滚动（流式响应由 useStreamingHandler 内部节流处理）
    if (autoScrollEnabled && currentCount !== prevMessageCountRef.current && !streamingHandler.isResponding) {
      scrollToBottom();
    }
    prevMessageCountRef.current = currentCount;
  }, [conversationData.messages?.length, streamingHandler.isResponding, autoScrollEnabled]);

  // ========== 6.5 useEffect - 加载活跃计划 ==========
  useEffect(() => {
    if (conversationData.activeConversationId) {
      loadActivePlan(conversationData.activeConversationId);
    }
  }, [conversationData.activeConversationId]);

  // ========== 6.6 useEffect - 智能体响应完成后刷新计划 ==========
  const prevRespondingRef = useRef(streamingHandler.isResponding);
  useEffect(() => {
    // 检测从 responding -> not responding 的状态变化
    if (prevRespondingRef.current && !streamingHandler.isResponding) {
      // 智能体刚完成响应，刷新计划
      if (conversationData.activeConversationId) {
        console.log('[Planner] 智能体响应完成，刷新计划');
        loadActivePlan(conversationData.activeConversationId);
      }
    }
    prevRespondingRef.current = streamingHandler.isResponding;
  }, [streamingHandler.isResponding, conversationData.activeConversationId]);

  // ========== 7. 渲染 ==========
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--custom-hover-bg)'
    }}>
      {/* 头部 */}
      <ConversationHeader
        conversations={conversationData.conversations}
        activeConversationId={conversationData.activeConversationId}
        conversationsLoading={conversationData.conversationsLoading}
        onChangeConversation={handleChangeConversation}
        refreshingMessages={conversationData.refreshingMessages}
        onRefresh={handleRefreshMessages}
        onCreateClick={() => { setShowCreateValidation(false); setShowNewConversationModal(true); }}
        onStartAutoDiscuss={showAutoDiscussModal}
        onStopAutoDiscuss={handleCancelAutoDiscussion}
        isAutoDiscussing={isAutoDiscussing}
        startingAutoDiscussion={startingAutoDiscussion}
        stoppingDiscussion={stoppingDiscussion}
        isResponding={streamingHandler.isResponding}
        sendingMessage={streamingHandler.sendingMessage}
        currentDiscussionRound={streamingHandler.currentDiscussionRound}
        currentDiscussionTotalRounds={streamingHandler.currentDiscussionTotalRounds}
        discussionAgentInfo={streamingHandler.discussionAgentInfo}
        externalConversations={externalConversations}
        t={t}
      />

      {/* 计划面板 - 漂浮在消息之上 */}
      {activePlan && (
        <div style={{
          position: 'absolute',
          top: 58,
          left: 16,
          right: 16,
          zIndex: 10
        }}>
          <PlannerPanel plan={activePlan} />
        </div>
      )}

      {/* 消息列表 */}
      <MessageList
        messages={conversationData.messages}
        isResponding={streamingHandler.isResponding}
        streamingAgentId={streamingHandler.streamingAgentId}
        currentStreamingResponse={streamingHandler.currentStreamingResponse}
        isObserving={streamingHandler.isObserving}
        task={task}
        messagesEndRef={messagesEndRef}
        messageContainerRef={messageContainerRef}
        t={t}
      />

      {/* 输入区域 */}
      <MessageInput
        task={task}
        userMessage={userMessage}
        setUserMessage={setUserMessage}
        targetAgentIds={targetAgentIds}
        setTargetAgentIds={setTargetAgentIds}
        attachedImages={attachedImages}
        showImageUpload={showImageUpload}
        setShowImageUpload={setShowImageUpload}
        sendingMessage={streamingHandler.sendingMessage}
        isResponding={streamingHandler.isResponding}
        isSummarizing={streamingHandler.isSummarizing}
        onSendMessage={sendMessage}
        assistingMessage={assistingMessage}
        globalSettings={conversationData.globalSettings}
        onMessageAssist={handleMessageAssist}
        isolationMode={isolationMode}
        setIsolationMode={setIsolationMode}
        smartDispatchEnabled={smartDispatchEnabled}
        setSmartDispatchEnabled={setSmartDispatchEnabled}
        autoScrollEnabled={autoScrollEnabled}
        onToggleAutoScroll={() => setAutoScrollEnabled(!autoScrollEnabled)}
        subAgentEnabled={subAgentEnabled}
        onToggleSubAgent={() => setSubAgentEnabled(!subAgentEnabled)}
        isAutoDiscussing={isAutoDiscussing}
        readOnly={readOnly}
        t={t}
      />

      {/* 模态框 */}
      <ConversationModals
        showNewConversationModal={showNewConversationModal}
        setShowNewConversationModal={setShowNewConversationModal}
        newConversationTitle={newConversationTitle}
        setNewConversationTitle={setNewConversationTitle}
        creatingConversation={creatingConversation}
        showCreateValidation={showCreateValidation}
        onCreateConversation={handleCreateConversation}
        enableSummary={enableSummary}
        setEnableSummary={setEnableSummary}
        hasDefaultModel={conversationData.hasDefaultModel}
        activeConversationId={conversationData.activeConversationId}
        messages={conversationData.messages}
        showImageUpload={showImageUpload}
        setShowImageUpload={setShowImageUpload}
        attachedImages={attachedImages}
        onImageUpload={handleImageUpload}
        onRemoveImage={removeImage}
        task={task}
        autoDiscussModalVisible={autoDiscussModalVisible}
        setAutoDiscussModalVisible={setAutoDiscussModalVisible}
        startingAutoDiscussion={startingAutoDiscussion}
        onAutoDiscussConfirm={handleAutoDiscussConfirm}
        onAutoDiscussCancel={handleAutoDiscussCancel}
        autoDiscussionOptions={autoDiscussionOptions}
        setAutoDiscussionOptions={setAutoDiscussionOptions}
        environmentVariables={conversationData.environmentVariables}
        agentVariables={conversationData.agentVariables}
        t={t}
      />
    </div>
  );
});

export default ActionTaskConversation;
