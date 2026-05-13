import React, { useState, useEffect } from 'react';
import { Card, Button, Empty, Typography, Input, List, Avatar, Badge, Tooltip, Space, Radio, Select, App } from 'antd';
import { EyeOutlined, MessageOutlined, ApartmentOutlined, ToolOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getAgentAvatarStyle } from '../../../utils/colorUtils';
import { actionTaskAPI } from '../../../services/api/actionTask';
import conversationAPI from '../../../services/api/conversation';
import ConversationExtraction from './ConversationExtraction';

const { Text } = Typography;
const { TextArea } = Input;

const ActionTaskSupervisor = ({ task, onTaskMessagesRefresh, onSupervisorIntervention }) => {
  const { message } = App.useApp();
  // 监督会话相关状态
  const [supervisorMessages, setSupervisorMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState(false);

  // 监督者流式输出相关状态
  const [supervisorResponse, setSupervisorResponse] = useState('');
  const [isReceivingResponse, setIsReceivingResponse] = useState(false);

  // 监督者选择和发送目标状态
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [sendTarget, setSendTarget] = useState('supervisor'); // 'supervisor' | 'task_intervention'

  // 监督者智能体列表状态
  const [supervisorAgents, setSupervisorAgents] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  // 获取监督者智能体列表
  const getSupervisorAgents = () => {
    return supervisorAgents;
  };

  // 从API加载监督者智能体
  const loadSupervisorAgents = async () => {
    if (!task?.id) return;

    setLoadingSupervisors(true);
    try {
      console.log('🔄 开始加载监督者智能体，任务ID:', task.id);
      const agents = await actionTaskAPI.getSupervisorAgents(task.id);
      console.log('✅ 监督者智能体加载成功:', agents);

      // 验证每个智能体的数据完整性
      agents.forEach((agent, index) => {
        console.log(`监督者 ${index + 1}:`, {
          id: agent.id,
          name: agent.name,
          role_name: agent.role_name,
          is_observer: agent.is_observer
        });

        if (!agent.role_name) {
          console.warn(`⚠️ 监督者 ${agent.name} (ID: ${agent.id}) 缺少 role_name 字段`);
        }
      });

      setSupervisorAgents(agents);

      // 自动选择第一个监督者
      if (agents.length > 0 && !selectedSupervisor) {
        setSelectedSupervisor(agents[0].id);
        console.log('🎯 自动选择监督者:', agents[0].id);
      }
    } catch (error) {
      console.error('❌ 加载监督者智能体失败:', error);
      message.error('加载监督者智能体失败');
    } finally {
      setLoadingSupervisors(false);
    }
  };

  // 加载监督者消息
  const loadSupervisorMessages = async () => {
    if (!task?.id || !task?.conversation_id) return;

    try {
      const supervisorAgentIds = supervisorAgents.map(agent => agent.id);
      const messages = await actionTaskAPI.getSupervisorMessages(
        task.id,
        task.conversation_id,
        supervisorAgentIds
      );
      setSupervisorMessages(messages);
    } catch (error) {
      console.error('加载监督者消息失败:', error);
      message.error('加载监督者消息失败');
    }
  };

  // 初始化时获取监督会话数据
  useEffect(() => {
    console.log('ActionTaskSupervisor组件接收到任务数据:', task);
    if (task?.id) {
      loadSupervisorAgents();
    }
  }, [task?.id]);

  // 当监督者智能体加载完成后，加载消息
  useEffect(() => {
    if (supervisorAgents.length > 0 && task?.conversation_id) {
      loadSupervisorMessages();
    }
  }, [supervisorAgents, task?.conversation_id]);

  // 发送用户消息到监督会话
  const sendUserMessage = async () => {
    if (!userMessage.trim() || !selectedSupervisor || !task?.conversation_id) return;

    const selectedAgent = getSupervisorAgents().find(agent => agent.id === selectedSupervisor);
    if (!selectedAgent) {
      message.error('请选择一个监督者');
      return;
    }

    setSubmittingMessage(true);
    setIsReceivingResponse(true);
    setSupervisorResponse('');

    try {
      const targetText = sendTarget === 'supervisor' ? '监督会话' : '任务会话';

      // 构建消息数据
      const messageData = {
        content: userMessage,
        target_agent_id: selectedSupervisor,
        send_target: sendTarget
      };

      // 如果是发送到任务会话（干预），委托给任务会话组件处理
      if (sendTarget === 'task_intervention' && onSupervisorIntervention) {
        console.log('监督者干预：委托给任务会话组件处理');

        // 委托给任务会话组件处理（这会通过流式API保存用户消息和智能体回复）
        await onSupervisorIntervention(messageData);

        // 清空输入
        setUserMessage('');
        message.success(`消息已发送到${targetText}`);

        // 重新加载监督者消息（获取包含meta字段的完整数据库记录）
        setTimeout(async () => {
          await loadSupervisorMessages();
        }, 1500); // 增加延迟确保数据库操作完成
        return;
      }

      // 普通监督会话消息，使用监督者组件自己的流式处理
      await conversationAPI.sendConversationMessageStream(
        task.id,
        task.conversation_id,
        messageData,
        (content, meta) => {
          if (content !== null) {
            // 接收到内容，追加到监督者回复中
            setSupervisorResponse(prev => prev + content);
          } else if (meta) {
            // 处理元数据
            if (meta.connectionStatus === 'connecting') {
              console.log('正在连接监督者...');
            } else if (meta.connectionStatus === 'connected') {
              console.log('已连接到监督者');
            } else if (meta.connectionStatus === 'error') {
              console.error('监督者连接错误:', meta.error);
              message.error('监督者连接失败: ' + meta.error);
            }
          }
        }
      );

      // 清空输入
      setUserMessage('');
      message.success(`消息已发送到${targetText}`);

      // 重新加载监督者消息
      await loadSupervisorMessages();

    } catch (error) {
      console.error('发送监督者消息失败:', error);
      message.error('发送消息失败: ' + (error.message || '未知错误'));
    } finally {
      setSubmittingMessage(false);
      setIsReceivingResponse(false);
    }
  };

  return (
    <>
      {/* CSS样式 */}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>

      {/* 与监督者交互卡片 */}
      <Card
        title="与监督者交互"
        style={{ marginBottom: 16 }}
      >
        {/* 监督者输出对话框 */}
        <div
          style={{
            minHeight: '120px',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid var(--custom-border)',
            borderRadius: '6px',
            padding: '12px',
            backgroundColor: 'var(--custom-header-bg)',
            marginBottom: '12px'
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              监督者响应：
              {isReceivingResponse && (
                <span style={{ marginLeft: 8, color: '#1677ff' }}>
                  正在输入...
                </span>
              )}
            </Text>
          </div>
          <div style={{ minHeight: '80px' }}>
            {supervisorResponse ? (
              <div style={{
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {supervisorResponse}
                {isReceivingResponse && (
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '13px',
                    backgroundColor: '#1677ff',
                    marginLeft: '2px',
                    animation: 'blink 1s infinite'
                  }} />
                )}
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: '13px', fontStyle: 'italic' }}>
                {isReceivingResponse ? '监督者正在思考...' : '等待监督者响应...'}
              </Text>
            )}
          </div>
        </div>

        {/* 用户输入区域 */}
        <TextArea
          rows={3}
          value={userMessage}
          onChange={e => setUserMessage(e.target.value)}
          placeholder="向监督者询问或发送消息..."
        />

        {/* 监督者选择 */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: '12px', marginRight: 8, whiteSpace: 'nowrap' }}>
            监督者列表：
          </Text>
          <Select
            value={selectedSupervisor}
            onChange={setSelectedSupervisor}
            placeholder={loadingSupervisors ? "加载监督者..." : "选择监督者"}
            style={{ flex: 1, minWidth: 200 }}
           
            showSearch
            optionFilterProp="children"
            loading={loadingSupervisors}
            notFoundContent={
              loadingSupervisors ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <Text type="secondary">加载中...</Text>
                </div>
              ) : (
                <Empty
                  description="暂无监督者智能体"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ margin: '8px 0' }}
                />
              )
            }
          >
            {getSupervisorAgents().map(agent => (
              <Select.Option key={agent.id} value={agent.id}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar
                    icon={<EyeOutlined style={{ color: '#ffffff' }} />}
                    size={16}
                    style={{
                      ...getAgentAvatarStyle(agent.id || agent.name, false, true),
                      marginRight: '6px'
                    }}
                  />
                  <span style={{ marginRight: 8 }}>
                    {agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name}
                  </span>
                  <Space size={4}>
                    <Tooltip title="触发规则数量">
                      <Badge
                        count={agent.rule_triggers_count || 0}
                        style={{ backgroundColor: '#faad14' }}
                       
                      />
                    </Tooltip>
                  </Space>
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* 发送目标选择和发送按钮 */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          {/* 发送目标选择 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px', marginRight: 8, whiteSpace: 'nowrap' }}>
              发送目标：
            </Text>
            <Radio.Group
              value={sendTarget}
              onChange={e => setSendTarget(e.target.value)}
             
            >
              <Radio value="supervisor">监督会话</Radio>
              <Radio value="task_intervention">任务会话</Radio>
            </Radio.Group>
          </div>

          {/* 发送按钮 */}
          <Button
            type="primary"
            onClick={sendUserMessage}
            loading={submittingMessage}
            disabled={!userMessage.trim() || !selectedSupervisor}
          >
            发送消息
          </Button>
        </div>
      </Card>

      {/* 监督会话历史记录 */}
      <Card
        title="监督会话记录"
        style={{ marginBottom: 16 }}
      >
        {supervisorMessages.length === 0 ? (
          <div>
            <Empty description="暂无监督会话记录" />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                历史会话记录将在这里显示
              </Text>
            </div>
          </div>
        ) : (
          <List
            dataSource={supervisorMessages}
            renderItem={(message) => {
              const isHuman = message.role === 'human';
              const isSupervisor = message.role === 'supervisor';

              // 获取发送者信息
              let senderName = '未知';
              let senderAvatar = null;

              // 检查是否是干预消息
              const isIntervention = message.meta && message.meta.type === 'info';

              if (isHuman) {
                // 检查是否是发送给监督者的消息
                if (message.agent_id) {
                  const targetAgent = supervisorAgents.find(a => a.id === message.agent_id);
                  if (targetAgent) {
                    // 显示用户 → 监督者名称[角色][ID]格式，如果是干预消息则添加标识
                    const interventionTag = isIntervention ? '[干预]' : '';
                    senderName = `用户 → ${targetAgent.name}[${targetAgent.role_name || '监督者'}][ID: ${targetAgent.id}]${interventionTag}`;
                  } else {
                    const interventionTag = isIntervention ? '[干预]' : '';
                    senderName = `用户 → 监督者${interventionTag}`;
                  }
                } else {
                  senderName = '用户';
                }
                senderAvatar = (
                  <Avatar
                    icon={<UserOutlined />}
                   
                    style={{ backgroundColor: isIntervention ? '#ff7875' : '#1677ff' }}
                  />
                );
              } else if (isSupervisor && message.agent_id) {
                const agent = supervisorAgents.find(a => a.id === message.agent_id);
                if (agent) {
                  // 显示监督者名称[角色][ID]格式，如果是干预消息则添加标识
                  const interventionTag = isIntervention ? '[干预]' : '';
                  senderName = `${agent.name}[${agent.role_name || '监督者'}][ID: ${agent.id}]${interventionTag}`;
                  senderAvatar = (
                    <Avatar
                      icon={<EyeOutlined style={{ color: '#ffffff' }} />}
                     
                      style={{
                        ...getAgentAvatarStyle(agent.id || agent.name, false, true),
                        ...(isIntervention ? { backgroundColor: '#ff7875' } : {})
                      }}
                    />
                  );
                }
              }

              return (
                <List.Item style={{ padding: '8px 0', border: 'none' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {senderAvatar}
                      <Text strong style={{ marginLeft: 8, fontSize: '13px' }}>
                        {senderName}
                      </Text>
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: '11px' }}>
                        {new Date(message.created_at).toLocaleString()}
                      </Text>
                      {isSupervisor && (
                        <Badge
                          count="监督者"
                          style={{ backgroundColor: '#52c41a', marginLeft: 8 }}
                         
                        />
                      )}
                      {isIntervention && (
                        <Badge
                          count="干预"
                          style={{ backgroundColor: '#ff7875', marginLeft: 8 }}
                         
                        />
                      )}
                    </div>
                    <div style={{
                      marginLeft: 32,
                      padding: '8px 12px',
                      backgroundColor: isIntervention
                        ? (isHuman ? '#fff2f0' : '#fff1f0')
                        : (isHuman ? 'var(--tree-hover-bg)' : '#f6ffed'),
                      borderRadius: '6px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      ...(isIntervention ? {
                        border: '1px solid #ffccc7',
                        boxShadow: '0 1px 3px rgba(255, 120, 117, 0.1)'
                      } : {})
                    }}>
                      <ConversationExtraction message={message} task={task} />
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </>
  );
};

export default ActionTaskSupervisor;