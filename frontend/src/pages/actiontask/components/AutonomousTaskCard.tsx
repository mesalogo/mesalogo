import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Tag,
  Typography,
  Collapse,
  Empty,
  Button,
  Space,
  Descriptions,
  Badge,
  Tooltip,
  App
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  HistoryOutlined,
  RobotOutlined,
  PoweroffOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import conversationAPI from '../../../services/api/conversation';
import '../css/conversation.css';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * 自主行动卡片组件
 * 显示当前自主行动的信息和历史记录
 */
const AutonomousTaskCard = ({ task, activeConversationId, refreshKey }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [autonomousTasks, setAutonomousTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTasks, setActiveTasks] = useState([]);
  const [stoppingTasks, setStoppingTasks] = useState(new Set());
  const [isUpdating, setIsUpdating] = useState(false);

  // 防抖引用
  const fetchTimeoutRef = useRef(null);
  // 记录上一次的活动任务数量，用于检测变化
  const prevActiveTasksCountRef = useRef(0);

  // 获取自主任务数据
  const fetchAutonomousTasks = async (showUpdatingAnimation = false) => {
    if (!task?.id) {
      return;
    }

    // 清除之前的定时器，实现防抖
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      // 如果需要显示更新动画，则设置更新状态
      if (showUpdatingAnimation) {
        setIsUpdating(true);
      } else {
        setLoading(true);
      }

      try {
        // 使用新的API获取行动任务的所有自主任务
        const response = await conversationAPI.getActionTaskAutonomousTasks(task.id);

        // 如果显示更新动画，添加短暂延迟以确保动画可见
        if (showUpdatingAnimation) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        setAutonomousTasks(response.autonomous_tasks || []);

        // 找到所有活动的任务
        const activeTasksList = response.autonomous_tasks?.filter(t => t.status === 'active') || [];
        setActiveTasks(activeTasksList);
      } catch (error) {
        console.error('获取自主任务失败:', error);
        message.error(t('autonomous.card.loadFailed', { defaultValue: '获取自主任务失败' }) + ': ' + error.message);
      } finally {
        setLoading(false);
        setIsUpdating(false);
      }
    }, 100); // 100ms防抖延迟
  };

  // 初始加载和刷新时重新获取数据
  useEffect(() => {
    // 初始加载时不显示动画，刷新时显示动画
    const isInitialLoad = refreshKey === 0;
    fetchAutonomousTasks(!isInitialLoad);
  }, [task?.id, refreshKey]);

  // 添加定时刷新，只在有活动任务时才刷新
  useEffect(() => {
    if (!task?.id) {
      return;
    }

    // 只有当存在活动任务时才启动定时刷新
    if (activeTasks.length === 0) {
      console.log('自主行动卡片: 没有活动任务，跳过自动刷新');
      return;
    }

    console.log(`自主行动卡片: 启动自动刷新，当前有 ${activeTasks.length} 个活动任务`);
    const interval = setInterval(() => {
      console.log('自主行动卡片: 执行定时自动刷新');
      // 自动刷新时使用平滑动画
      fetchAutonomousTasks(true);
    }, 30000); // 每30秒刷新一次

    return () => {
      clearInterval(interval);
      // 清理防抖定时器
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [task?.id, activeTasks.length]); // 依赖活动任务数量

  // 监听活动任务数量变化，当从0变为非0时立即刷新
  useEffect(() => {
    const currentCount = activeTasks.length;
    const prevCount = prevActiveTasksCountRef.current;

    // 如果从没有活动任务变为有活动任务，立即刷新一次
    if (prevCount === 0 && currentCount > 0) {
      console.log('自主行动卡片: 检测到新的活动任务，立即刷新');
      fetchAutonomousTasks(true);
    }

    // 更新引用值
    prevActiveTasksCountRef.current = currentCount;
  }, [activeTasks.length]);

  // 获取状态标签
  const getStatusTag = (status) => {
    const statusConfig = {
      active: { color: 'processing', text: t('autonomous.card.status.active'), icon: <PlayCircleOutlined /> },
      completed: { color: 'success', text: t('autonomous.card.status.completed'), icon: <CheckCircleOutlined /> },
      stopped: { color: 'default', text: t('autonomous.card.status.stopped'), icon: <StopOutlined /> },
      failed: { color: 'error', text: t('autonomous.card.status.failed'), icon: <StopOutlined /> }
    };

    const config = statusConfig[status] || { color: 'default', text: status, icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取任务类型标签
  const getTypeTag = (type) => {
    const typeConfig = {
      discussion: { color: 'blue', text: t('autonomous.type.discussion') },
      conditional_stop: { color: 'orange', text: t('autonomous.type.conditionalStop') },
      variable_trigger: { color: 'purple', text: t('autonomous.type.variableTrigger') },
      time_trigger: { color: 'green', text: t('autonomous.type.timeTrigger') },
      autonomous_scheduling: { color: 'cyan', text: t('autonomous.type.autonomousScheduling') },
      // 兼容后端可能使用的其他命名
      infinite: { color: 'orange', text: t('autonomous.type.infinite') },
      rounds: { color: 'blue', text: t('autonomous.type.rounds') }
    };

    const config = typeConfig[type] || { color: 'default', text: type || t('autonomous.type.unknown') };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 格式化执行时长
  const formatDuration = (startTime, endTime) => {
    if (!startTime) return '-';

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000); // 秒

    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`;
  };

  // 渲染执行记录详情
  const renderExecutionDetails = (execution) => {
    return (
      <Descriptions column={1}>
        <Descriptions.Item label="执行类型">
          {execution.execution_type === 'manual' ? '手动触发' : execution.execution_type}
        </Descriptions.Item>
        <Descriptions.Item label="触发源">
          {execution.trigger_source || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {execution.start_time ? new Date(execution.start_time).toLocaleString() : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {execution.end_time ? new Date(execution.end_time).toLocaleString() : '进行中'}
        </Descriptions.Item>
        <Descriptions.Item label="执行时长">
          {formatDuration(execution.start_time, execution.end_time)}
        </Descriptions.Item>
        {execution.result && (
          <Descriptions.Item label="执行结果">

              {typeof execution.result === 'object' ?
                execution.result.message || JSON.stringify(execution.result) :
                execution.result}

          </Descriptions.Item>
        )}
        {execution.error_message && (
          <Descriptions.Item label="错误信息">
            <Text type="danger" style={{ fontSize: '12px' }}>
              {execution.error_message}
            </Text>
          </Descriptions.Item>
        )}
      </Descriptions>
    );
  };

  // 停止自主任务
  const handleStopTask = async (autonomousTaskId) => {
    if (!task?.id) {
      return;
    }

    // 找到要停止的任务，获取其所属的会话ID
    const targetTask = autonomousTasks.find(t => t.id === autonomousTaskId);
    if (!targetTask) {
      message.error(t('autonomous.card.taskNotFound', { defaultValue: '未找到要停止的任务' }));
      return;
    }

    // 添加到停止中的任务集合
    setStoppingTasks(prev => new Set([...prev, autonomousTaskId]));

    try {
      await conversationAPI.stopAutonomousTask(task.id, targetTask.conversation_id, autonomousTaskId);
      message.success(t('autonomous.card.stopSuccess'));

      // 刷新数据，使用动画效果
      await fetchAutonomousTasks(true);
    } catch (error) {
      console.error('停止自主任务失败:', error);
      message.error(t('autonomous.card.stopFailed') + ': ' + error.message);
    } finally {
      // 从停止中的任务集合中移除
      setStoppingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(autonomousTaskId);
        return newSet;
      });
    }
  };

  // 渲染单个活动任务
  const renderActiveTask = (activeTask) => {
    const config = activeTask.config || {};
    const latestExecution = activeTask.executions?.[0];
    const isStopping = stoppingTasks.has(activeTask.id);

    return (
      <div key={activeTask.id} className="autonomous-task-item" style={{ marginBottom: 16, border: '1px solid var(--custom-border)', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space>
            {getTypeTag(activeTask.type)}
            {getStatusTag(activeTask.status)}
          </Space>
          <Tooltip title={t('autonomous.card.stop')}>
            <Button
              type="text"
              danger
             
              icon={<PoweroffOutlined />}
              loading={isStopping}
              onClick={() => handleStopTask(activeTask.id)}
              style={{ color: '#ff4d4f' }}
            />
          </Tooltip>
        </div>

        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {activeTask.id}
          </Text>
        </div>

        <Descriptions column={1}>
          <Descriptions.Item label="所属会话">
            <Text style={{ fontSize: '12px' }}>
              {activeTask.conversation?.name || `会话 ${activeTask.conversation_id}`}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(activeTask.created_at).toLocaleString()}
          </Descriptions.Item>
          {config.rounds && (
            <Descriptions.Item label="轮数设置">
              {config.rounds} 轮
            </Descriptions.Item>
          )}
          {config.topic && (
            <Descriptions.Item label="主题">
              <Paragraph
                ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                style={{ margin: 0, fontSize: '12px' }}
              >
                {config.topic}
              </Paragraph>
            </Descriptions.Item>
          )}
          {latestExecution && (
            <Descriptions.Item label="执行时长">
              {formatDuration(latestExecution.start_time, latestExecution.end_time)}
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    );
  };

  // 渲染活动任务列表
  const renderActiveTasks = () => {
    if (activeTasks.length === 0) {
      return (null);
    }

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: '14px' }}>
            {t('autonomous.card.activeActions')} ({activeTasks.length})
          </Text>
        </div>
        {activeTasks.map(renderActiveTask)}
      </div>
    );
  };

  return (
    <Card
      className={`task-detail-tab-card autonomous-task-card ${isUpdating ? 'updating' : ''}`}
      title={
        <Space>
          <RobotOutlined />
          <span>{t('autonomous.card.title')}</span>
          <Badge
            count={activeTasks.length}
            showZero={false}
            style={{ backgroundColor: '#52c41a' }}
          />
        </Space>
      }
      extra={
        <Tooltip title={t('autonomous.card.refresh')}>
          <Button
            type="text"
            icon={<ReloadOutlined />}
           
            onClick={() => fetchAutonomousTasks(true)}
            loading={loading || isUpdating}
          />
        </Tooltip>
      }
      style={{ marginBottom: 16 }}
    >

        {/* 活动任务列表 */}
        {renderActiveTasks()}

        {/* 历史记录 */}
        {autonomousTasks.length > 0 && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 8,
              borderTop: '1px solid var(--custom-border)',
              paddingTop: 12
            }}>
              <HistoryOutlined style={{ marginRight: 4, color: 'var(--custom-text-secondary)' }} />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                近期行动记录（最近5条）
              </Text>
            </div>

            <div className="autonomous-task-list">
              {autonomousTasks.slice(0, 5).map((autonomousTask, index) => (
                <div key={autonomousTask.id} className="autonomous-task-item" style={{ padding: 12, border: '1px solid var(--custom-border)', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Space>
                        {getTypeTag(autonomousTask.type)}
                        {getStatusTag(autonomousTask.status)}
                      </Space>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {new Date(autonomousTask.created_at).toLocaleString()}
                      </Text>
                    </div>

                    {/* 添加所属会话显示 */}
                    <div style={{ marginBottom: 4 }}>
                      <Text
                        type="secondary"
                        style={{
                          fontSize: '11px',
                          display: 'block',
                          color: 'var(--custom-text-secondary)'
                        }}
                      >
                        所属会话：{autonomousTask.conversation?.name || `会话 ${autonomousTask.conversation_id}`}
                      </Text>
                    </div>

                    {/* 添加行动主题显示 */}
                    {autonomousTask.config?.topic && (
                      <div style={{ marginBottom: 4 }}>
                        <Tooltip title={autonomousTask.config.topic} placement="topLeft">
                          <Text
                            type="secondary"
                            style={{
                              fontSize: '12px',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%',
                              color: 'var(--custom-text-secondary)'
                            }}
                          >
                            主题：{autonomousTask.config.topic.length > 10
                              ? `${autonomousTask.config.topic.substring(0, 10)}...`
                              : autonomousTask.config.topic}
                          </Text>
                        </Tooltip>
                      </div>
                    )}

                    {autonomousTask.executions && autonomousTask.executions.length > 0 && (
                      <Collapse
                       
                        ghost
                        items={[
                          {
                            key: autonomousTask.id,
                            label: (
                              <Text style={{ fontSize: '12px' }}>
                                执行详情 ({autonomousTask.executions.length} 次执行)
                              </Text>
                            ),
                            children: (
                              <div style={{ marginLeft: -12, marginRight: -12 }}>
                                {autonomousTask.executions.slice(0, 5).map((execution, execIndex) => (
                                  <div
                                    key={execution.id}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: execIndex % 2 === 0 ? 'var(--custom-header-bg)' : 'transparent',
                                      borderRadius: 4,
                                      marginBottom: 4
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <Text style={{ fontSize: '11px', fontWeight: 'bold' }}>
                                        执行 #{execution.id}
                                      </Text>
                                      {getStatusTag(execution.status)}
                                    </div>
                                    {renderExecutionDetails(execution)}
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        ]}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {autonomousTasks.length === 0 && !loading && (
          <Empty
            description={t('autonomous.card.noRecords')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ margin: '20px 0' }}
          />
        )}

    </Card>
  );
};

export default AutonomousTaskCard;
