import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../../services/api/actionTask';
import conversationAPI from '../../../../services/api/conversation';

/**
 * 任务数据管理 Hook
 * 负责任务详情获取、消息获取、轮询更新
 */
export default function useTaskData(taskId) {
  const { t } = useTranslation();
  const [task, setTask] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState(null);

  /**
   * 获取任务数据
   */
  const fetchTaskData = useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      // 调用API获取任务详情
      const taskData = await actionTaskAPI.getById(taskId);
      console.log('获取到任务详情:', taskData);

      // 获取环境变量
      try {
        // 使用批量API一次性获取所有变量
        const batchVariables = await actionTaskAPI.getBatchVariables(taskId);

        // 将变量设置到任务数据中
        taskData.environment_variables = batchVariables.environmentVariables;
        taskData.agent_variables = batchVariables.agentVariables;

        console.log('批量获取变量成功，最后更新时间:', batchVariables.lastUpdated);
      } catch (error) {
        console.error('获取变量失败:', error);
        taskData.environment_variables = [];
        taskData.agent_variables = [];
      }

      setTask(taskData);

      // 获取消息历史
      try {
        // 先尝试通过会话获取消息
        const conversations = await conversationAPI.getConversations(taskId);

        if (conversations && conversations.length > 0) {
          // 设置活动会话ID（使用第一个会话）
          setActiveConversationId(conversations[0].id);

          const firstConversationMessages = await conversationAPI.getConversationMessages(
            taskId,
            conversations[0].id
          );
          setMessages(firstConversationMessages);
        } else {
          // 如果没有会话，设置空消息数组
          setActiveConversationId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error('获取消息失败:', error);
        // 设置空消息数组
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('获取任务详情失败:', error);
      message.error(t('actionTaskDetail.loadFailed') + ': ' + error.message);
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId, t]);

  /**
   * 刷新任务和消息
   */
  const refreshTaskMessages = useCallback(async () => {
    if (!activeConversationId) return;

    try {
      // 重新加载任务消息（包含监督者干预消息）
      const messagesData = await actionTaskAPI.getTaskMessages(task.id, activeConversationId);
      setMessages(messagesData);
      console.log('刷新任务消息成功');
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
  }, [fetchTaskData]);

  /**
   * 轮询更新（运行中的任务）
   * 注意：这里先注释掉轮询，避免不必要的请求
   * 如果需要轮询，可以根据任务状态启用
   */
  // useEffect(() => {
  //   if (!task || task.status !== 'running') return;
  //
  //   const interval = setInterval(() => {
  //     fetchTaskData();
  //   }, 5000); // 每5秒更新
  //
  //   return () => clearInterval(interval);
  // }, [task, fetchTaskData]);

  return {
    // 数据状态
    task,
    messages,
    loading,
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
