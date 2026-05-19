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
  const { t } = useTranslation();
  const { message } = App.useApp();
  // supervisor conversation state
  const [supervisorMessages, setSupervisorMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState(false);

  // supervisor streaming output state
  const [supervisorResponse, setSupervisorResponse] = useState('');
  const [isReceivingResponse, setIsReceivingResponse] = useState(false);

  // supervisor selection and target state
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [sendTarget, setSendTarget] = useState('supervisor'); // 'supervisor' | 'task_intervention'

  // supervisor agent list state
  const [supervisorAgents, setSupervisorAgents] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  // get supervisor agent list
  const getSupervisorAgents = () => {
    return supervisorAgents;
  };

  // load supervisor agents from API
  const loadSupervisorAgents = async () => {
    if (!task?.id) return;

    setLoadingSupervisors(true);
    try {
      console.log('loading supervisor agents, task ID:', task.id);
      const agents = await actionTaskAPI.getSupervisorAgents(task.id);
      console.log('supervisor agents loaded:', agents);

      // validate agent payload completeness
      agents.forEach((agent, index) => {
        console.log(`supervisor ${index + 1}:`, {
          id: agent.id,
          name: agent.name,
          role_name: agent.role_name,
          is_observer: agent.is_observer
        });

        if (!agent.role_name) {
          console.warn(`supervisor ${agent.name} (ID: ${agent.id}) missing role_name field`);
        }
      });

      setSupervisorAgents(agents);

      // auto-select first supervisor
      if (agents.length > 0 && !selectedSupervisor) {
        setSelectedSupervisor(agents[0].id);
        console.log('auto-selected supervisor:', agents[0].id);
      }
    } catch (error) {
      console.error('load supervisor agents failed:', error);
      message.error(t('taskSupervisor.msg.loadAgentsFailed'));
    } finally {
      setLoadingSupervisors(false);
    }
  };

  // load supervisor messages
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
      console.error('load supervisor messages failed:', error);
      message.error(t('taskSupervisor.msg.loadMessagesFailed'));
    }
  };

  // fetch supervisor data on init
  useEffect(() => {
    console.log('ActionTaskSupervisor received task data:', task);
    if (task?.id) {
      loadSupervisorAgents();
    }
  }, [task?.id]);

  // load messages after supervisor agents are loaded
  useEffect(() => {
    if (supervisorAgents.length > 0 && task?.conversation_id) {
      loadSupervisorMessages();
    }
  }, [supervisorAgents, task?.conversation_id]);

  // send user message to supervisor conversation
  const sendUserMessage = async () => {
    if (!userMessage.trim() || !selectedSupervisor || !task?.conversation_id) return;

    const selectedAgent = getSupervisorAgents().find(agent => agent.id === selectedSupervisor);
    if (!selectedAgent) {
      message.error(t('taskSupervisor.msg.pickSupervisor'));
      return;
    }

    setSubmittingMessage(true);
    setIsReceivingResponse(true);
    setSupervisorResponse('');

    try {
      const targetText = sendTarget === 'supervisor' ? t('taskSupervisor.target.supervisor') : t('taskSupervisor.target.task');

      // build message data
      const messageData = {
        content: userMessage,
        target_agent_id: selectedSupervisor,
        send_target: sendTarget
      };

      // delegate task-session intervention to task conversation component
      if (sendTarget === 'task_intervention' && onSupervisorIntervention) {
        console.log('supervisor intervention delegated to task conversation component');

        // Delegate handling (stores user message and agent reply via streaming API)
        await onSupervisorIntervention(messageData);

        // clear input
        setUserMessage('');
        message.success(t('taskSupervisor.msg.sentTo', { target: targetText }));

        // reload supervisor messages with full meta fields
        setTimeout(async () => {
          await loadSupervisorMessages();
        }, 1500);
        return;
      }

      // regular supervisor-session message handled by this component
      await conversationAPI.sendConversationMessageStream(
        task.id,
        task.conversation_id,
        messageData,
        (content, meta) => {
          if (content !== null) {
            // append received content to supervisor response
            setSupervisorResponse(prev => prev + content);
          } else if (meta) {
            // handle metadata
            if (meta.connectionStatus === 'connecting') {
              console.log('connecting to supervisor...');
            } else if (meta.connectionStatus === 'connected') {
              console.log('connected to supervisor');
            } else if (meta.connectionStatus === 'error') {
              console.error('supervisor connection error:', meta.error);
              message.error(t('taskSupervisor.msg.connectionFailed', { error: meta.error }));
            }
          }
        }
      );

      // clear input
      setUserMessage('');
      message.success(t('taskSupervisor.msg.sentTo', { target: targetText }));

      // reload supervisor messages
      await loadSupervisorMessages();

    } catch (error) {
      console.error('send supervisor message failed:', error);
      message.error(t('taskSupervisor.msg.sendFailed', { error: error.message || t('taskSupervisor.unknownError') }));
    } finally {
      setSubmittingMessage(false);
      setIsReceivingResponse(false);
    }
  };

  return (
    <>
      {/* CSS styles */}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>

      {/* supervisor interaction */}
      <Card
        title={t('taskSupervisor.interactionTitle')}
        style={{ marginBottom: 16 }}
      >
        {/* supervisor output */}
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
              {t('taskSupervisor.responseLabel')}
              {isReceivingResponse && (
                <span style={{ marginLeft: 8, color: '#1677ff' }}>
                  {t('taskSupervisor.typing')}
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
                {isReceivingResponse ? t('taskSupervisor.thinking') : t('taskSupervisor.waiting')}
              </Text>
            )}
          </div>
        </div>

        {/* user input */}
        <TextArea
          rows={3}
          value={userMessage}
          onChange={e => setUserMessage(e.target.value)}
          placeholder={t('taskSupervisor.inputPh')}
        />

        {/* supervisor selection */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: '12px', marginRight: 8, whiteSpace: 'nowrap' }}>
            {t('taskSupervisor.supervisorList')}
          </Text>
          <Select
            value={selectedSupervisor}
            onChange={setSelectedSupervisor}
            placeholder={loadingSupervisors ? t('taskSupervisor.loadingSupervisors') : t('taskSupervisor.pickSupervisor')}
            style={{ flex: 1, minWidth: 200 }}
           
            showSearch
            optionFilterProp="children"
            loading={loadingSupervisors}
            notFoundContent={
              loadingSupervisors ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <Text type="secondary">{t('taskSupervisor.loading')}</Text>
                </div>
              ) : (
                <Empty
                  description={t('taskSupervisor.emptySupervisors')}
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
                    <Tooltip title={t('taskSupervisor.ruleTriggerCount')}>
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

        {/* target selection and send button */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          {/* send target */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px', marginRight: 8, whiteSpace: 'nowrap' }}>
              {t('taskSupervisor.sendTarget')}
            </Text>
            <Radio.Group
              value={sendTarget}
              onChange={e => setSendTarget(e.target.value)}
             
            >
              <Radio value="supervisor">{t('taskSupervisor.target.supervisor')}</Radio>
              <Radio value="task_intervention">{t('taskSupervisor.target.task')}</Radio>
            </Radio.Group>
          </div>

          {/* send button */}
          <Button
            type="primary"
            onClick={sendUserMessage}
            loading={submittingMessage}
            disabled={!userMessage.trim() || !selectedSupervisor}
          >
            {t('taskSupervisor.send')}
          </Button>
        </div>
      </Card>

      {/* supervisor conversation history */}
      <Card
        title={t('taskSupervisor.historyTitle')}
        style={{ marginBottom: 16 }}
      >
        {supervisorMessages.length === 0 ? (
          <div>
            <Empty description={t('taskSupervisor.emptyHistory')} />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('taskSupervisor.historyHint')}
              </Text>
            </div>
          </div>
        ) : (
          <List
            dataSource={supervisorMessages}
            renderItem={(message) => {
              const isHuman = message.role === 'human';
              const isSupervisor = message.role === 'supervisor';

              // get sender info
              let senderName = t('taskSupervisor.unknown');
              let senderAvatar = null;

              // check intervention message
              const isIntervention = message.meta && message.meta.type === 'info';

              if (isHuman) {
                // message sent to supervisor
                if (message.agent_id) {
                  const targetAgent = supervisorAgents.find(a => a.id === message.agent_id);
                  if (targetAgent) {
                    const interventionTag = isIntervention ? t('taskSupervisor.interventionTag') : '';
                    senderName = `${t('taskSupervisor.user')} → ${targetAgent.name}[${targetAgent.role_name || t('taskSupervisor.supervisor')}][ID: ${targetAgent.id}]${interventionTag}`;
                  } else {
                    const interventionTag = isIntervention ? t('taskSupervisor.interventionTag') : '';
                    senderName = `${t('taskSupervisor.user')} → ${t('taskSupervisor.supervisor')}${interventionTag}`;
                  }
                } else {
                  senderName = t('taskSupervisor.user');
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
                  const interventionTag = isIntervention ? t('taskSupervisor.interventionTag') : '';
                  senderName = `${agent.name}[${agent.role_name || t('taskSupervisor.supervisor')}][ID: ${agent.id}]${interventionTag}`;
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
                          count={t('taskSupervisor.supervisor')}
                          style={{ backgroundColor: '#52c41a', marginLeft: 8 }}
                         
                        />
                      )}
                      {isIntervention && (
                        <Badge
                          count={t('taskSupervisor.intervention')}
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