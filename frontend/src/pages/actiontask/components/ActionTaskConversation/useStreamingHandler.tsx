import { useState, useEffect, useRef, useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../../services/api/actionTask';
import conversationAPI from '../../../../services/api/conversation';

/**
 * 流式响应处理 Hook
 * 负责处理所有流式响应逻辑，包括普通消息和自主任务
 */
export default function useStreamingHandler({
  task,
  activeConversationId,
  updateMessages,
  messages,
  onMessagesUpdated,
  triggerVariablesRefresh,
  isToolCallResult,
  isToolCallResultMeta,
  isPlanToolResult,
  targetAgentIds,
  isAutoDiscussing,
  setIsAutoDiscussing,
  onAgentRespondingChange,
  onUserMessageSent,
  onRefreshAutonomousTaskCard,
  scrollToBottom,
  autoScrollEnabledRef,
  loadActivePlan
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();

  // 流式状态
  const [isResponding, setIsResponding] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [streamingAgentId, setStreamingAgentId] = useState(null);
  const [currentStreamingResponse, setCurrentStreamingResponse] = useState('');
  const [isObserving, setIsObserving] = useState(false);
  
  // 上下文总结状态
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 自主任务状态
  const [currentDiscussionRound, setCurrentDiscussionRound] = useState(0);
  const [currentDiscussionTotalRounds, setCurrentDiscussionTotalRounds] = useState(0);
  const [discussionAgentInfo, setDiscussionAgentInfo] = useState(null);

  // 流式内容缓冲区 - 用 ref 累积 chunk，定时刷新到 state，减少渲染次数
  const streamingBufferRef = useRef('');
  const streamingFlushTimerRef = useRef<any>(null);
  const STREAMING_FLUSH_INTERVAL = 80; // ms，每80ms刷新一次UI

  // 用 ref 同步跟踪已刷新到 state 的完整流式内容，解决闭包捕获过期 state 的问题
  const currentStreamingResponseRef = useRef('');

  const flushStreamingBuffer = useCallback(() => {
    if (streamingBufferRef.current) {
      const buffered = streamingBufferRef.current;
      streamingBufferRef.current = '';
      currentStreamingResponseRef.current += buffered;
      setCurrentStreamingResponse(currentStreamingResponseRef.current);
    }
    streamingFlushTimerRef.current = null;
  }, []);

  // 节流版 scrollToBottom - 最多每100ms滚动一次
  const scrollThrottleRef = useRef<any>(null);
  const throttledScrollToBottom = useCallback(() => {
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null;
      if (autoScrollEnabledRef.current) {
        scrollToBottom();
      }
    }, 100);
  }, [scrollToBottom, autoScrollEnabledRef]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (streamingFlushTimerRef.current) clearTimeout(streamingFlushTimerRef.current);
      if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current);
    };
  }, []);

  /**
   * 清空流式状态
   */
  const clearStreamingState = () => {
    // 清空缓冲区中未刷新的内容
    streamingBufferRef.current = '';
    currentStreamingResponseRef.current = '';
    if (streamingFlushTimerRef.current) {
      clearTimeout(streamingFlushTimerRef.current);
      streamingFlushTimerRef.current = null;
    }
    setCurrentStreamingResponse('');
    setIsObserving(false);
    setStreamingAgentId(null);
    setIsResponding(false);
  };

  /**
   * 从服务器刷新消息列表
   */
  const refreshMessagesFromServer = async () => {
    if (!task?.id || !activeConversationId) return;
    try {
      const messagesData = await actionTaskAPI.getTaskMessages(task.id, activeConversationId);
      updateMessages(messagesData);
      if (onMessagesUpdated) {
        setTimeout(() => onMessagesUpdated(messagesData), 0);
      }
    } catch (error) {
      console.error('刷新消息列表失败:', error);
    }
  };

  /**
   * 处理流式响应回调（普通消息）
   */
  const handleStreamResponse = (content, meta) => {
    // 处理虚拟消息
    if (meta && meta.type === 'virtualMessage' && meta.isVirtual) {
      const virtualMessage = {
        id: `virtual-${Date.now()}`,
        role: meta.virtualRole || 'human',
        content: content,
        timestamp: meta.timestamp || new Date().toISOString(),
        isVirtual: true
      };

      updateMessages(prev => [...prev, virtualMessage]);
      if (onMessagesUpdated) {
        setTimeout(() => {
          onMessagesUpdated([...messages, virtualMessage]);
        }, 0);
      }
      return;
    }

    // 处理连接状态
    if (meta) {
      // 连接建立
      if (meta.connectionStatus === 'connected') {
        console.log('流式连接已建立');
        setSendingMessage(false);
        setIsResponding(true);
      }
      // 连接错误
      else if (meta.connectionStatus === 'error') {
        console.error('流式连接错误:', meta.error);

        if (meta.agentId && task.agents) {
          const agent = task.agents.find(a =>
            a.id === meta.agentId || String(a.id) === String(meta.agentId)
          );

          if (agent) {
            const errorMessage = {
              id: `error-${Date.now()}`,
              role: 'system',
              content: `[${t('message.error')}] API${t('message.requestFailed')}: ${meta.error}`,
              timestamp: new Date().toISOString(),
              agent_name: agent.name,
              agent_id: agent.id,
              role_name: agent.role_name,
              agent: {
                id: agent.id,
                name: agent.name,
                role_name: agent.role_name
              }
            };

            updateMessages(prev => [...prev, errorMessage]);
            if (onMessagesUpdated) {
              setTimeout(() => {
                onMessagesUpdated([...messages, errorMessage]);
              }, 0);
            }
          }
        }

        setIsObserving(false);
        setStreamingAgentId(null);
        setSendingMessage(false);
        setIsResponding(false);
        message.error(`${t('message.error')}: ${meta.error}`);
      }
      // 连接完成
      else if (meta.connectionStatus === 'done') {
        console.log('流式连接完成:', meta.responseObj);

        // 先刷新缓冲区中的剩余内容
        const bufferedContent = streamingBufferRef.current;
        streamingBufferRef.current = '';
        if (streamingFlushTimerRef.current) {
          clearTimeout(streamingFlushTimerRef.current);
          streamingFlushTimerRef.current = null;
        }
        const finalStreamContent = (currentStreamingResponseRef.current + bufferedContent) || '';
        currentStreamingResponseRef.current = '';
        setCurrentStreamingResponse('');
        setIsObserving(false);
        setStreamingAgentId(null);
        setSendingMessage(false);
        setIsResponding(false);

        // 检查是否是监督者干预消息
        let isSupervisorIntervention = false;
        if (meta.responseObj && meta.responseObj.response && meta.responseObj.response.agent_id) {
          const agentId = meta.responseObj.response.agent_id;
          const agent = task.agents?.find(a => a.id === agentId);
          isSupervisorIntervention = agent && agent.is_observer;
        }

        if (isSupervisorIntervention) {
          console.log('监督者干预完成，刷新消息列表');
          actionTaskAPI.getTaskMessages(task.id, activeConversationId)
            .then(messagesData => {
              updateMessages(messagesData);
              if (onMessagesUpdated) {
                setTimeout(() => {
                  onMessagesUpdated(messagesData);
                }, 0);
              }
            })
            .catch(error => {
              console.error('刷新监督者干预消息失败:', error);
              if (meta.responseObj && meta.responseObj.response) {
                const completeResponse = meta.responseObj.response;
                const agentResponse = {
                  id: completeResponse.id || `stream-${Date.now()}`,
                  role: 'assistant',
                  content: finalStreamContent || completeResponse.content || '无内容',
                  timestamp: completeResponse.timestamp || new Date().toISOString(),
                  agent_name: completeResponse.agent_name,
                  agent_id: completeResponse.agent_id,
                  agent: {
                    id: completeResponse.agent_id,
                    name: completeResponse.agent_name
                  },
                  response_order: completeResponse.response_order || null
                };
                updateMessages(prev => [...prev, agentResponse]);
                if (onMessagesUpdated) {
                  setTimeout(() => {
                    onMessagesUpdated([...messages, agentResponse]);
                  }, 0);
                }
              }
            });
        } else {
          if (meta.responseObj && meta.responseObj.response) {
            const completeResponse = meta.responseObj.response;
            const agentResponse = {
              id: completeResponse.id || `stream-${Date.now()}`,
              role: 'assistant',
              content: finalStreamContent || completeResponse.content || '无内容',
              timestamp: completeResponse.timestamp || new Date().toISOString(),
              agent_name: completeResponse.agent_name,
              agent_id: completeResponse.agent_id,
              agent: {
                id: completeResponse.agent_id,
                name: completeResponse.agent_name
              },
              response_order: completeResponse.response_order || null
            };

            updateMessages(prev => [...prev, agentResponse]);
            if (onMessagesUpdated) {
              setTimeout(() => {
                onMessagesUpdated([...messages, agentResponse]);
              }, 0);
            }
          }
        }
        
        // 检查是否需要触发上下文总结
        if (meta.need_summarize && task?.id && activeConversationId) {
          setIsSummarizing(true);
          conversationAPI.summarizeContext(task.id, activeConversationId)
            .then(() => {
              message.success(t('conversation.summarizeSuccess'));
              return refreshMessagesFromServer();
            })
            .catch(() => message.error(t('conversation.summarizeFailed')))
            .finally(() => setIsSummarizing(false));
        }
      }

      // 处理单个智能体完成事件
      else if (meta.connectionStatus === 'agentDone') {
        console.log('单个智能体完成:', meta.responseObj);

        // 先刷新缓冲区中的剩余内容
        const bufferedContent = streamingBufferRef.current;
        streamingBufferRef.current = '';
        if (streamingFlushTimerRef.current) {
          clearTimeout(streamingFlushTimerRef.current);
          streamingFlushTimerRef.current = null;
        }
        const finalStreamContent = (currentStreamingResponseRef.current + bufferedContent) || '';
        currentStreamingResponseRef.current = '';

        if (meta.responseObj && meta.responseObj.response) {
          const completeResponse = meta.responseObj.response;
          const agentResponse = {
            id: completeResponse.id || `stream-${Date.now()}`,
            role: 'assistant',
            content: finalStreamContent || completeResponse.content || '无内容',
            timestamp: completeResponse.timestamp || new Date().toISOString(),
            agent_name: completeResponse.agent_name,
            agent_id: completeResponse.agent_id,
            agent: {
              id: completeResponse.agent_id,
              name: completeResponse.agent_name
            },
            response_order: completeResponse.response_order || null
          };

          updateMessages(prev => [...prev, agentResponse]);
          if (onMessagesUpdated) {
            setTimeout(() => {
              onMessagesUpdated([...messages, agentResponse]);
            }, 0);
          }
        }

        setCurrentStreamingResponse('');
        currentStreamingResponseRef.current = '';
        setIsObserving(false);

        const isMultiAgentScenario = targetAgentIds.length > 1 || (targetAgentIds.length === 0 && task.agents?.length > 1);
        if (!isAutoDiscussing && !isMultiAgentScenario) {
          console.log('单智能体场景，完全清理流式状态');
          setStreamingAgentId(null);
          setIsResponding(false);
          setSendingMessage(false);
        } else {
          console.log('多智能体场景，等待下一个智能体');
        }
      }

      // 处理工具调用结果处理通知
      if (meta.type === 'processingToolResults') {
        console.log('处理工具调用结果:', meta);
        const processingMessage = {
          id: `processing-tools-${Date.now()}`,
          role: 'system',
          content: meta.message || '正在处理工具调用结果，继续生成回复...',
          timestamp: new Date().toISOString(),
          isTemporary: true
        };
        message.info(processingMessage.content);
        setIsResponding(true);
      }

      // 处理工具结果处理状态变更
      if (meta.type === 'toolResultsProcessing') {
        console.log('工具结果处理状态:', meta);
        if (meta.status === 'starting') {
          message.info(meta.message || '处理工具调用结果完成，正在生成最终回复...');
          if (meta.isContinuation) {
            setIsResponding(true);
          }
        } else if (meta.status === 'completed') {
          console.log('工具调用结果处理完成');
          setIsResponding(true);
        }
      }

      // 处理智能体信息事件
      if (meta.type === 'agentInfo') {
        console.log('智能体信息:', meta);
        if (meta.agentId) {
          setStreamingAgentId(String(meta.agentId));
          setSendingMessage(false);

          // 智能分发模式：回溯更新最近一条用户消息的 target_agent_ids
          // 让 MessageItem 从 "智能选择中..." Spin 变为实际选中的智能体名称
          updateMessages(prev => {
            // 从后往前找最近一条 smart_dispatch 的 human 消息
            const lastIndex = prev.length - 1;
            for (let i = lastIndex; i >= Math.max(0, lastIndex - 5); i--) {
              const msg = prev[i];
              if (msg.role === 'human' && msg.smart_dispatch && (!msg.target_agent_ids || msg.target_agent_ids.length === 0)) {
                const updated = [...prev];
                updated[i] = {
                  ...msg,
                  target_agent_ids: [meta.agentId]
                };
                return updated;
              }
            }
            return prev;
          });
        }

        const turnPrompt = meta.turnPrompt || `轮到智能体回应`;
        if (meta.responseOrder && meta.totalAgents) {
          message.info(`${turnPrompt} (${meta.responseOrder}/${meta.totalAgents})`);
        } else {
          message.info(turnPrompt);
        }
      }

      // 处理智能体取消完成事件
      if (meta.connectionStatus === 'agentDone' && meta.responseObj && meta.responseObj.response && meta.responseObj.response.is_cancelled) {
        console.log('智能体取消完成:', meta);

        // 先刷新缓冲区中的剩余内容
        const bufferedContent = streamingBufferRef.current;
        streamingBufferRef.current = '';
        if (streamingFlushTimerRef.current) {
          clearTimeout(streamingFlushTimerRef.current);
          streamingFlushTimerRef.current = null;
        }
        const finalStreamContent = (currentStreamingResponseRef.current + bufferedContent) || '';
        currentStreamingResponseRef.current = '';
        setCurrentStreamingResponse('');
        setIsObserving(false);

        const completeResponse = meta.responseObj.response;
        const agentResponse = {
          id: completeResponse.id || `cancel-${Date.now()}`,
          role: 'assistant',
          content: finalStreamContent,
          timestamp: completeResponse.timestamp || new Date().toISOString(),
          agent_name: completeResponse.agent_name,
          agent_id: completeResponse.agent_id,
          agent: {
            id: completeResponse.agent_id,
            name: completeResponse.agent_name
          },
          response_order: completeResponse.response_order || null,
          is_cancelled: true
        };

        updateMessages(prev => [...prev, agentResponse]);
        if (onMessagesUpdated) {
          setTimeout(() => {
            onMessagesUpdated([...messages, agentResponse]);
          }, 0);
        }

        const systemMessage = {
          id: `system-cancel-${Date.now()}`,
          role: 'system',
          content: completeResponse.content || t('message.agentCancelled', { name: completeResponse.agent_name }),
          timestamp: new Date().toISOString()
        };

        updateMessages(prev => [...prev, systemMessage]);
        if (onMessagesUpdated) {
          setTimeout(() => {
            onMessagesUpdated([...messages, agentResponse, systemMessage]);
          }, 0);
        }

        const isMultiAgentScenario = targetAgentIds.length > 1 || (targetAgentIds.length === 0 && task.agents?.length > 1);
        if (!isAutoDiscussing && !isMultiAgentScenario) {
          console.log('智能体取消完成 - 单智能体场景，完全清理流式状态');
          setStreamingAgentId(null);
          setIsResponding(false);
          setSendingMessage(false);
        } else {
          console.log('智能体取消完成 - 多智能体场景，等待下一个智能体');
        }

        message.info(t('autoTask.agentInterrupted'));
      }

      // 处理思考内容（观察）
      if (meta.type === 'thinking') {
        setIsObserving(true);
        if (meta.agentId) {
          console.log(`设置流式智能体ID: ${meta.agentId}, 类型: ${typeof meta.agentId}`);
          setStreamingAgentId(String(meta.agentId));
          setSendingMessage(false);
        }
      }

      // 处理智能体响应顺序信息
      if (meta.responseOrder) {
        console.log(`智能体响应顺序: ${meta.responseOrder}`);
      }
    }

    // 检测工具调用结果
    if (isToolCallResult(content)) {
      console.log('检测到工具调用结果内容:', content.substring(0, 100));
      triggerVariablesRefresh(onUserMessageSent);
      
      // 检测plan工具调用，刷新计划
      if (isPlanToolResult && isPlanToolResult(content) && loadActivePlan) {
        console.log('[Planner] 检测到plan工具调用，刷新计划');
        loadActivePlan(activeConversationId);
      }
    }

    // 处理实际内容 - 使用缓冲区减少渲染次数
    if (content) {
      setSendingMessage(false);
      streamingBufferRef.current += content;
      if (!streamingFlushTimerRef.current) {
        streamingFlushTimerRef.current = setTimeout(flushStreamingBuffer, STREAMING_FLUSH_INTERVAL);
      }
      throttledScrollToBottom();
    }
  };

  /**
   * 处理自动讨论响应
   */
  const handleAutoDiscussionResponse = (content, meta) => {
    console.log('自动讨论收到数据:', { content, meta });

    if (meta) {
      console.log('自动讨论meta详情:', JSON.stringify(meta));

      // 检查是否包含工具调用结果
      if (isToolCallResultMeta(meta)) {
        console.log('自动讨论中检测到工具调用结果:', meta);
        triggerVariablesRefresh(onUserMessageSent);
        
        // 检测plan工具调用，刷新计划（通过meta.toolName检测）
        if (loadActivePlan && meta.toolName && 
            (meta.toolName === 'create_plan' || meta.toolName === 'update_plan_item' || meta.toolName === 'get_plan')) {
          console.log('[Planner] 自动讨论中检测到plan工具调用，刷新计划');
          loadActivePlan(activeConversationId);
        }
      }

      // 连接建立
      if (meta.connectionStatus === 'connected') {
        console.log('自动讨论流式连接已建立');
        setIsResponding(true);
      }
      // 连接错误
      else if (meta.connectionStatus === 'error') {
        console.error('自动讨论流式连接错误:', meta.error);
        message.error(`自动讨论错误: ${meta.error}`);
        setStreamingAgentId(null);
        setIsResponding(false);
        setCurrentDiscussionRound(0);
        setCurrentDiscussionTotalRounds(0);
        setDiscussionAgentInfo(null);
        setCurrentStreamingResponse('');
        currentStreamingResponseRef.current = '';
        setIsAutoDiscussing(false);

        if (onRefreshAutonomousTaskCard) {
          onRefreshAutonomousTaskCard();
        }
      }
      // 连接完成
      else if (meta.connectionStatus === 'done') {
        console.log('自动讨论流式连接完成 - 收到done状态:', meta);
        message.success(meta.message || '自动讨论已完成');

        try {
          // 先刷新缓冲区中的剩余内容
          const bufferedContent = streamingBufferRef.current;
          streamingBufferRef.current = '';
          if (streamingFlushTimerRef.current) {
            clearTimeout(streamingFlushTimerRef.current);
            streamingFlushTimerRef.current = null;
          }
          const finalStreamContent = (currentStreamingResponseRef.current + bufferedContent) || '';
          currentStreamingResponseRef.current = '';
          if (meta.responseObj && meta.responseObj.response) {
            const completeResponse = meta.responseObj.response;
            const agentResponse = {
              id: completeResponse.id || `stream-${Date.now()}`,
              role: 'assistant',
              content: finalStreamContent || completeResponse.content || '无内容',
              timestamp: completeResponse.timestamp || new Date().toISOString(),
              agent_name: completeResponse.agent_name || (task?.current_agent?.name ?? '助手'),
              agent_id: completeResponse.agent_id || task?.current_agent?.id || null,
              agent: completeResponse.agent || task?.current_agent || null,
              response_order: completeResponse.response_order || null,
            };
            updateMessages(prev => [...prev, agentResponse]);
            if (onMessagesUpdated) {
              setTimeout(() => onMessagesUpdated([...(messages || []), agentResponse]), 0);
            }
          } else if (finalStreamContent) {
            const agentResponse = {
              id: `stream-${Date.now()}`,
              role: 'assistant',
              content: finalStreamContent,
              timestamp: new Date().toISOString(),
            };
            updateMessages(prev => [...prev, agentResponse]);
            if (onMessagesUpdated) {
              setTimeout(() => onMessagesUpdated([...(messages || []), agentResponse]), 0);
            }
          }
        } catch (e) {
          console.warn('自动讨论 done 阶段追加最终消息时出错:', e);
        }

        setCurrentDiscussionRound(0);
        setCurrentDiscussionTotalRounds(0);
        setDiscussionAgentInfo(null);
        setStreamingAgentId(null);
        setIsResponding(false);
        setCurrentStreamingResponse('');
        currentStreamingResponseRef.current = '';
        setIsAutoDiscussing(false);

        if (onRefreshAutonomousTaskCard) {
          onRefreshAutonomousTaskCard();
        }
        
        // 检查是否需要触发上下文总结（自主任务完成后）
        if (meta.need_summarize && task?.id && activeConversationId) {
          setIsSummarizing(true);
          conversationAPI.summarizeContext(task.id, activeConversationId)
            .then(() => {
              message.success(t('conversation.summarizeSuccess'));
              return refreshMessagesFromServer();
            })
            .catch(() => message.error(t('conversation.summarizeFailed')))
            .finally(() => setIsSummarizing(false));
        }
      }

      // 处理轮次信息
      if (meta.roundInfo) {
        console.log('轮次信息:', meta.roundInfo);
        setCurrentDiscussionRound(meta.roundInfo.current || 0);
        setCurrentDiscussionTotalRounds(meta.roundInfo.total || 0);

        const roundMessage = {
          id: `round-${Date.now()}`,
          role: 'system',
          content: `开始第${meta.roundInfo.current || 0}/${meta.roundInfo.total || 0}轮讨论`,
          timestamp: new Date().toISOString()
        };
        updateMessages(prev => {
          const updatedMessages = [...prev, roundMessage];
          if (onMessagesUpdated) {
            setTimeout(() => {
              onMessagesUpdated(updatedMessages);
            }, 0);
          }
          return updatedMessages;
        });

        message.info(`开始第${meta.roundInfo.current || 0}/${meta.roundInfo.total || 0}轮讨论`);
      }

      // 处理智能体信息
      if (meta.type === 'agentInfo') {
        console.log('智能体信息:', meta);
        const turnPrompt = meta.turnPrompt || `轮到智能体行动`;
        const agentId = meta.agentId;
        const agentName = meta.agentName;

        setDiscussionAgentInfo({
          id: agentId,
          name: agentName,
          responseOrder: meta.responseOrder,
          totalAgents: meta.totalAgents,
          round: meta.round,
          totalRounds: meta.totalRounds,
          isSummarizing: meta.isSummarizing || false,
          turnPrompt: turnPrompt
        });

        const promptMessage = {
          id: `prompt-${Date.now()}`,
          role: 'system',
          content: meta.isSummarizing ?
            turnPrompt :
            `${turnPrompt} (${meta.responseOrder}/${meta.totalAgents})`,
          timestamp: new Date().toISOString()
        };
        updateMessages(prev => {
          const updatedMessages = [...prev, promptMessage];
          if (onMessagesUpdated) {
            setTimeout(() => {
              onMessagesUpdated(updatedMessages);
            }, 0);
          }
          return updatedMessages;
        });

        setStreamingAgentId(String(agentId));
        setIsResponding(true);
        setCurrentStreamingResponse('');
        currentStreamingResponseRef.current = '';

        if (meta.isSummarizing) {
          message.info(turnPrompt);
        } else {
          message.info(`${turnPrompt} (${meta.responseOrder}/${meta.totalAgents})`);
        }
      }

      // 处理自动讨论中的消息
      if (meta.message) {
        console.log('收到系统消息:', meta.message);

        const systemMessage: any = {
          id: meta.message.id || `system-${Date.now()}`,
          role: 'system',
          content: meta.message.content || meta.message,
          timestamp: meta.message.created_at || new Date().toISOString()
        };
        if (meta.message.meta) {
          systemMessage.meta = meta.message.meta;
        }
        updateMessages(prev => [...prev, systemMessage]);
        if (onMessagesUpdated) {
          setTimeout(() => {
            onMessagesUpdated([...messages, systemMessage]);
          }, 0);
        }
      }

      // 处理智能体完成响应事件
      if (meta.connectionStatus === 'agentDone' && meta.responseObj && meta.responseObj.response) {
        console.log('智能体响应完成:', meta.responseObj.response);

        setCurrentStreamingResponse('');
        currentStreamingResponseRef.current = '';

        const response = meta.responseObj.response;
        const newMessage = {
          id: response.id || `msg-${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: response.timestamp || new Date().toISOString(),
          agent_name: response.agent_name,
          agent_id: response.agent_id,
          agent: {
            id: response.agent_id,
            name: response.agent_name
          }
        };

        updateMessages(prev => {
          const updatedMessages = [...prev, newMessage];
          if (onMessagesUpdated) {
            setTimeout(() => {
              onMessagesUpdated(updatedMessages);
            }, 0);
          }
          return updatedMessages;
        });
      }
    }

    // 处理实际内容（流式返回的内容）- 使用缓冲区减少渲染次数
    if (content) {
      if (isToolCallResult(content)) {
        console.log('自动讨论内容中检测到工具调用结果:', content.substring(0, 100));
        triggerVariablesRefresh(onUserMessageSent);
        
        // 检测plan工具调用，刷新计划
        if (isPlanToolResult && isPlanToolResult(content) && loadActivePlan) {
          console.log('[Planner] 自动讨论内容中检测到plan工具调用，刷新计划');
          loadActivePlan(activeConversationId);
        }
      }

      streamingBufferRef.current += content;
      setIsResponding(true);
      if (!streamingFlushTimerRef.current) {
        streamingFlushTimerRef.current = setTimeout(flushStreamingBuffer, STREAMING_FLUSH_INTERVAL);
      }
      throttledScrollToBottom();
    }
  };

  // 监听streamingAgentId变化并通知父组件
  useEffect(() => {
    if (onAgentRespondingChange) {
      onAgentRespondingChange(streamingAgentId !== null, streamingAgentId);
    }
    setIsResponding(streamingAgentId !== null);
  }, [streamingAgentId, onAgentRespondingChange]);

  // 防护机制，定期检查并清理异常的流式状态
  useEffect(() => {
    const checkStreamingState = () => {
      if (currentStreamingResponse && (!isResponding || !streamingAgentId)) {
        console.log('检测到异常的流式状态，执行清理:', {
          hasStreamingResponse: !!currentStreamingResponse,
          isResponding,
          streamingAgentId
        });
        setCurrentStreamingResponse('');
        currentStreamingResponseRef.current = '';
        setIsObserving(false);
        if (!isResponding) {
          setStreamingAgentId(null);
        }
      }
    };

    const interval = setInterval(checkStreamingState, 2000);
    return () => clearInterval(interval);
  }, [currentStreamingResponse, isResponding, streamingAgentId]);

  return {
    // 流式状态
    isResponding,
    sendingMessage,
    setSendingMessage,
    streamingAgentId,
    setStreamingAgentId,
    currentStreamingResponse,
    setCurrentStreamingResponse,
    isObserving,
    setIsObserving,
    
    // 上下文总结状态
    isSummarizing,

    // 自主任务状态
    currentDiscussionRound,
    currentDiscussionTotalRounds,
    discussionAgentInfo,
    setDiscussionAgentInfo,
    setCurrentDiscussionRound,
    setCurrentDiscussionTotalRounds,

    // 处理函数
    handleStreamResponse,
    handleAutoDiscussionResponse,
    clearStreamingState
  };
}
