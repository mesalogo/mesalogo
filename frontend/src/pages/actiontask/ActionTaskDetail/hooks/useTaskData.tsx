import { useState, useEffect, useCallback, useRef } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../../services/api/actionTask';
import conversationAPI from '../../../../services/api/conversation';

/**
 * 任务数据管理 Hook
 * 负责任务详情获取、消息获取、轮询更新
 */
export default function useTaskData(taskId, isActive = true) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [task, setTask] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const requestVersionRef = useRef(0);
  const activeConversationIdRef = useRef(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  /**
   * 获取任务数据
   */
  const fetchTaskData = useCallback(async ({
    showLoading = true,
    includeMessages = true,
    notifyOnError = true
  } = {}) => {
    if (!taskId) return;

    const requestVersion = ++requestVersionRef.current;
    if (showLoading) {
      setLoading(true);
    }
    try {
      const taskData = await actionTaskAPI.getById(taskId);

      try {
        const batchVariables = await actionTaskAPI.getBatchVariables(taskId);
        taskData.environment_variables = batchVariables.environmentVariables;
        taskData.agent_variables = batchVariables.agentVariables;
      } catch (error) {
        console.error('获取变量失败:', error);
        taskData.environment_variables = [];
        taskData.agent_variables = [];
      }

      if (requestVersion !== requestVersionRef.current) return;
      setTask(taskData);
      setLoadError(null);

      if (includeMessages) {
        try {
          const conversations = await conversationAPI.getConversations(taskId);

          if (requestVersion !== requestVersionRef.current) return;
          if (conversations && conversations.length > 0) {
            const currentConversation = conversations.find(
              conversation => String(conversation.id) === String(activeConversationIdRef.current)
            );
            const selectedConversation = currentConversation || conversations[0];
            setActiveConversationId(selectedConversation.id);

            const conversationMessages = await conversationAPI.getConversationMessages(
              taskId,
              selectedConversation.id
            );
            if (requestVersion === requestVersionRef.current) {
              setMessages(conversationMessages);
            }
          } else {
            setActiveConversationId(null);
            setMessages([]);
          }
        } catch (error) {
          console.error('获取消息失败:', error);
        }
      }
    } catch (error) {
      console.error('获取任务详情失败:', error);
      if (requestVersion !== requestVersionRef.current) return;
      const status = error?.response?.status;
      setLoadError({
        status,
        notFound: status === 404,
        message: error?.message || t('actionTaskDetail.loadFailed')
      });
      if (showLoading) {
        setTask(null);
      }
      if (notifyOnError) {
        message.error(t('actionTaskDetail.loadFailed') + ': ' + (error?.message || ''));
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [message, taskId, t]);

  /**
   * 刷新任务和消息
   */
  const refreshTaskMessages = useCallback(async () => {
    if (!activeConversationId || !task?.id) return;

    try {
      // 重新加载任务消息（包含监督者干预消息）
      const messagesData = await actionTaskAPI.getTaskMessages(task.id, activeConversationId);
      setMessages(messagesData);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('刷新任务消息失败:', error);
    }
  }, [activeConversationId, task]);

  /**
   * 初始加载
   */
  useEffect(() => {
    fetchTaskData();
    return () => {
      requestVersionRef.current += 1;
    };
  }, [fetchTaskData]);

  /**
   * Keep the visible task's status and variables fresh without replacing
   * in-flight conversation messages.
   */
  useEffect(() => {
    if (!isActive || !task) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTaskData({
          showLoading: false,
          includeMessages: false,
          notifyOnError: false
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isActive, task, fetchTaskData]);

  return {
    // 数据状态
    task,
    messages,
    loading,
    loadError,
    refreshKey,
    activeConversationId,

    // 数据操作
    setTask,
    setMessages,
    setRefreshKey,
    setActiveConversationId,
    fetchTaskData,
    refreshTaskMessages
  };
}
