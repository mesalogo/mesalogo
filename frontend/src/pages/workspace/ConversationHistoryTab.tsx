import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Select,
  List,
  Typography,
  Card,
  Empty,
  Spin,
  message,
  Space,
  Tag,
  Button,
  Avatar
} from 'antd';
import {
  ClockCircleOutlined,
  MessageOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../services/api/actionTask';
import conversationAPI from '../../services/api/conversation';
import ConversationExtraction from '../actiontask/components/ConversationExtraction';
import { getAgentAvatarStyle, getAgentColor } from '../../utils/colorUtils';
import '../actiontask/css/conversation.css';
import { conversationHistoryMessageListStyle } from './ConversationHistoryTab.styles';

const { Text, Title } = Typography;
const { Option } = Select;

/**
 * 会话历史标签页组件
 * 可以按照不同的行动任务查看不同会话历史记录
 */
const ConversationHistoryTab = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [actionTasks, setActionTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // 加载行动任务列表
  useEffect(() => {
    loadActionTasks();
  }, []);

  // 当选择任务时，加载该任务的会话列表
  useEffect(() => {
    if (selectedTaskId) {
      loadConversations(selectedTaskId);
    } else {
      setConversations([]);
      setSelectedConversationId(null);
      setMessages([]);
    }
  }, [selectedTaskId]);

  // 当选择会话时，加载该会话的消息
  useEffect(() => {
    if (selectedTaskId && selectedConversationId) {
      loadMessages(selectedTaskId, selectedConversationId);
    } else {
      setMessages([]);
    }
  }, [selectedTaskId, selectedConversationId]);

  const loadActionTasks = async () => {
    try {
      setLoading(true);
      const data = await actionTaskAPI.getAll(true); // 包含智能体信息
      // 过滤掉并行实验克隆的任务
      const filtered = (data || []).filter(task => !task.is_experiment_clone);
      setActionTasks(filtered);
    } catch (error) {
      console.error('Failed to load action tasks:', error);
      message.error(t('convHistory.loadTasksFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (taskId) => {
    try {
      setLoading(true);
      const data = await conversationAPI.getConversations(taskId);
      setConversations(data || []);

      // 如果有会话，默认选择第一个
      if (data && data.length > 0) {
        setSelectedConversationId(data[0].id);
      } else {
        setSelectedConversationId(null);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      message.error(t('convHistory.loadConversationsFailed'));
      setConversations([]);
      setSelectedConversationId(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (taskId, conversationId) => {
    try {
      setMessagesLoading(true);
      const data = await conversationAPI.getConversationMessages(taskId, conversationId);
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      message.error(t('convHistory.loadMessagesFailed'));
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleTaskChange = (taskId) => {
    setSelectedTaskId(taskId);
    setSelectedConversationId(null);
    setMessages([]);
  };

  const handleConversationChange = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  const handleRefresh = () => {
    if (selectedTaskId && selectedConversationId) {
      loadMessages(selectedTaskId, selectedConversationId);
    }
  };

  // 格式化消息时间
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  // 渲染单个消息项
  const renderMessageItem = (msg, index) => {
    const isHuman = msg.role === 'human';
    const agentId = msg.agent?.id || msg.agent_id;
    const agentName = msg.agent?.name || msg.agent_name || t('convHistory.defaultAgentName');

    return (
      <div
        key={index}
        className={`message-item ${isHuman ? 'sent' : 'received'}`}
        style={{
          marginBottom: '16px',
          alignSelf: isHuman ? 'flex-end' : 'flex-start',
          width: isHuman ? 'auto' : '80%',
          maxWidth: '80%',
          padding: '12px 16px',
          borderRadius: isHuman ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          backgroundColor: isHuman ? 'var(--msg-human-bg)' : 'var(--custom-card-bg)',
          boxShadow: 'var(--custom-shadow)',
          border: '1px solid var(--custom-border)'
        }}
      >
        {/* 消息头部 */}
        <div style={{
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {!isHuman && (
              <Avatar
                icon={<RobotOutlined style={{ color: '#ffffff' }} />}
               
                style={{
                  ...getAgentAvatarStyle(agentId || agentName),
                  marginRight: '8px'
                }}
              />
            )}
            <Text strong style={{ color: isHuman ? '#1677ff' : '#52c41a' }}>
              {isHuman ? t('convHistory.user') : agentName}
            </Text>
            <Tag
              color={isHuman ? 'blue' : 'green'}
             
              style={{ marginLeft: '8px' }}
            >
              {isHuman ? t('convHistory.userMessage') : t('convHistory.agentReply')}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {formatMessageTime(msg.created_at)}
          </Text>
        </div>

        {/* 消息内容 */}
        <div style={{ margin: 0 }}>
          <ConversationExtraction message={msg} />
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('convHistory.pageDesc')}
        </Text>
      </div>

      {/* 任务和会话选择器 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('convHistory.selectTask')}</Text>
          <Select
            style={{ width: '100%' }}
            placeholder={t('convHistory.selectTaskPlaceholder')}
            value={selectedTaskId}
            onChange={handleTaskChange}
            loading={loading}
          >
            {actionTasks.map(task => (
              <Option key={task.id} value={task.id}>
                <Space>
                  <Text>{task.title}</Text>
                  <Text type="secondary">({task.status})</Text>
                </Space>
              </Option>
            ))}
          </Select>
        </Col>
        <Col span={12}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('convHistory.selectConversation')}</Text>
          <Select
            style={{ width: '100%' }}
            placeholder={t('convHistory.selectConversationPlaceholder')}
            value={selectedConversationId}
            onChange={handleConversationChange}
            loading={loading}
            disabled={!selectedTaskId}
          >
            {conversations.map(conv => (
              <Option key={conv.id} value={conv.id}>
                <Space>
                  <Text>{conv.title}</Text>
                  <Text type="secondary">{t('convHistory.messageCount', { count: conv.message_count })}</Text>
                </Space>
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* 刷新按钮 */}
      {selectedTaskId && selectedConversationId && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={messagesLoading}
          >
            {t('convHistory.refreshMessages')}
          </Button>
        </div>
      )}

      {/* 消息列表 */}
      {selectedTaskId && selectedConversationId ? (
        messagesLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : messages.length > 0 ? (
          <div
            style={conversationHistoryMessageListStyle}
          >
            {messages.map((msg, index) => renderMessageItem(msg, index))}
          </div>
        ) : (
          <Empty
            description={t('convHistory.noMessages')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )
      ) : (
        <Empty
          description={t('convHistory.selectFirst')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );
};

export default ConversationHistoryTab;
