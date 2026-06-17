import React, { useState, useEffect, useCallback } from 'react';
import { App, Card, Table, Button, Space, Modal, Tag, Descriptions, Statistic, Row, Col, Timeline, Typography, Tabs, Empty, Spin, Avatar } from 'antd';
import { MonitorOutlined, EyeOutlined, SyncOutlined, ReloadOutlined, DatabaseOutlined, MessageOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { agentAPI } from '../../services/api/agent';
import AgentVariables from '../../components/agent/AgentVariables';
import ConversationExtraction from '../actiontask/components/ConversationExtraction';
import { getAgentAvatarStyle } from '../../utils/colorUtils';
import '../actiontask/css/conversation.css';

const { Text } = Typography;
const { TabPane } = Tabs;

const AgentMonitoring = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [memoryModalVisible, setMemoryModalVisible] = useState(false);
  const [memories, setMemories] = useState([]);
  const [activeDetailTab, setActiveDetailTab] = useState('info');
  const [agentMessages, setAgentMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesPagination, setMessagesPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // 行动监控是只读的

  // 获取智能体消息记录
  const fetchAgentMessages = useCallback(async (agentId: string, page = 1, pageSize = 20) => {
    setMessagesLoading(true);
    try {
      const res = await agentAPI.getMessages(agentId, { page, per_page: pageSize });
      if (res.success) {
        setAgentMessages(res.data.messages);
        setMessagesPagination({ current: res.data.page, pageSize: res.data.per_page, total: res.data.total });
      }
    } catch (error) {
      console.error('fetch agent messages failed:', error);
      setAgentMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // fetch agent list
  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await agentAPI.getAllActive();
      const agentData = Array.isArray(response) ? response : response.data || [];
      // filter out agents belonging to parallel-experiment clone tasks
      setAgents(agentData.filter(a => !a.action_task?.is_experiment_clone));
    } catch (error) {
      message.error(t('agentMon.msg.fetchListFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 行动监控只需要获取智能体列表

  useEffect(() => {
    fetchAgents();
  }, []);

  // 获取智能体记忆和详细信息
  const fetchMemories = async (agentId) => {
    try {
      // 获取记忆
      const memoryResponse = await agentAPI.getMemories(agentId);
      const memoryData = memoryResponse.data || [];
      setMemories(memoryData);

      // 获取智能体详细信息，包括行动空间和行动任务
      const agentResponse = await agentAPI.getById(agentId);
      const agentData = agentResponse.data || {};
      setSelectedAgent(prevAgent => ({
        ...prevAgent,
        ...agentData
      }));
    } catch (error) {
      message.error(t('agentMon.msg.fetchMemoriesFailed'));
      setMemories([]);
    }
  };

  // 行动监控是只读的，不需要停止和删除功能

  // 查看智能体详情
  const showDetail = (agent) => {
    setSelectedAgent(agent);
    setActiveDetailTab('info'); // 重置为基本信息标签
    setDetailModalVisible(true);
  };

  // 处理详情标签页切换
  const handleDetailTabChange = (key) => {
    setActiveDetailTab(key);
    if (key === 'messages' && selectedAgent) {
      fetchAgentMessages(selectedAgent.id);
    }
  };

  // 行动监控是只读的，不需要搜索和过滤功能

  // 查看智能体记忆
  const showMemories = (agent) => {
    setSelectedAgent(agent);
    fetchMemories(agent.id);
    setMemoryModalVisible(true);
  };

  const statusLabel = (status) =>
    status === 'active' ? t('agentMon.status.active') :
    status === 'idle' ? t('agentMon.status.idle') :
    status === 'busy' ? t('agentMon.status.busy') :
    t('agentMon.status.offline');

  const columns = [
    {
      title: t('agentMon.col.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <MonitorOutlined style={{ color: '#1677ff' }} />
          <span>{text}</span>
        </Space>
      ),
      width: 180,
    },
    {
      title: t('agentMon.col.role'),
      key: 'role',
      render: (_, record) => {
        if (record.role && record.role.name) {
          return record.role.name;
        }
        return record.role_name || t('agentMon.unknownRole');
      },
      width: 150,
    },
    {
      title: t('agentMon.col.type'),
      key: 'source',
      render: (_, record) => (
        <Tag color={record.source === 'internal' ? 'blue' : 'orange'}>
          {record.source === 'internal' ? t('agentMon.internal') : t('agentMon.external')}
        </Tag>
      ),
      width: 80,
    },
    {
      title: t('agentMon.col.actionTask'),
      key: 'action_task',
      render: (_, record) => {
        let taskName = '';
        if (record.action_task && record.action_task.name) {
          taskName = record.action_task.name;
        } else if (record.action_task_name && record.action_task_name !== t('agentMon.unassigned')) {
          taskName = record.action_task_name;
        } else if (record.action_task_id) {
          taskName = t('agentMon.taskNumber', { id: record.action_task_id });
        }

        let spaceName = '';
        if (record.action_space && record.action_space.name) {
          spaceName = record.action_space.name;
        } else if (record.action_space_name) {
          spaceName = record.action_space_name;
        }

        if (taskName && spaceName) {
          return <Tag color="green">{`${taskName}[${spaceName}]`}</Tag>;
        } else if (taskName) {
          return <Tag color="green">{taskName}</Tag>;
        } else {
          return <Text type="secondary">{t('agentMon.unassigned')}</Text>;
        }
      },
      width: 220,
    },
    {
      title: t('agentMon.col.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={
          status === 'active' ? 'success' :
          status === 'idle' ? 'default' :
          status === 'busy' ? 'processing' :
          'error'
        }>
          {statusLabel(status)}
        </Tag>
      ),
      width: 80,
    },
    {
      title: t('agentMon.col.conversationCount'),
      dataIndex: 'conversation_count',
      key: 'conversation_count',
      width: 90,
    },
    {
      title: t('agentMon.col.lastActive'),
      dataIndex: 'last_active',
      key: 'last_active',
      render: (date) => date ? new Date(date).toLocaleString() : t('agentMon.unknown'),
      width: 180,
    },
    {
      title: t('agentMon.col.action'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => showDetail(record)}
          >
            {t('agentMon.detail')}
          </Button>
          <Button
            type="text"
            icon={<SyncOutlined />}
            onClick={() => showMemories(record)}
          >
            {t('agentMon.memory')}
          </Button>
        </Space>
      ),
      width: 180,
      fixed: 'right' as const,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAgents}
          >
            {t('agentMon.refresh')}
          </Button>
        </div>
      </div>

      <Card
        style={{
          borderRadius: '12px',
          boxShadow: 'var(--custom-shadow)'
        }}
      >
        <Table
          columns={columns}
          dataSource={agents}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => t('agentMon.paginationTotal', { total }),
            position: ['bottomRight']
          }}
          style={{ overflowX: 'auto' }}
          scroll={{ x: 1500 }}
          locale={{
            emptyText: <Empty description={t('agentMon.empty')} />
          }}
        />
      </Card>

      {/* agent detail modal */}
      <Modal
        title={t('agentMon.detailTitle', { name: selectedAgent?.name || '' })}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedAgent && (
          <Tabs activeKey={activeDetailTab} onChange={handleDetailTabChange}>
            <TabPane tab={<span>{t('agentMon.tab.info')}</span>} key="info">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="ID">{selectedAgent.id}</Descriptions.Item>
                <Descriptions.Item label={t('agentMon.label.name')}>{selectedAgent.name}</Descriptions.Item>
                <Descriptions.Item label={t('agentMon.label.role')}>{selectedAgent.role?.name}</Descriptions.Item>
                <Descriptions.Item label={t('agentMon.label.status')}>
                  <Tag color={
                    selectedAgent.status === 'active' ? 'success' :
                    selectedAgent.status === 'idle' ? 'default' :
                    selectedAgent.status === 'busy' ? 'processing' :
                    'error'
                  }>
                    {statusLabel(selectedAgent.status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('agentMon.label.type')} span={1}>
                  <Tag color={selectedAgent?.source === 'internal' ? 'blue' : 'orange'}>
                    {selectedAgent?.source === 'internal' ? t('agentMon.internalAgent') : t('agentMon.externalAgent')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('agentMon.label.actionSpace')} span={1}>
                  {selectedAgent?.action_space ? (
                    <Tag color="purple">{selectedAgent.action_space.name}</Tag>
                  ) : (
                    <Text type="secondary">{t('agentMon.unassigned')}</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t('agentMon.label.actionTask')} span={2}>
                  {selectedAgent?.action_task ? (
                    <Tag color="green">{selectedAgent.action_task.name}</Tag>
                  ) : (
                    <Text type="secondary">{t('agentMon.unassigned')}</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>

              <Row gutter={16} style={{ marginTop: '24px' }}>
                <Col span={8}>
                  <Statistic title={t('agentMon.stat.totalConversations')} value={selectedAgent.conversation_count} />
                </Col>
                <Col span={8}>
                  <Statistic title={t('agentMon.stat.totalMessages')} value={selectedAgent.message_count} />
                </Col>
                <Col span={8}>
                  <Statistic title={t('agentMon.stat.avgResponseTime')} value={selectedAgent.avg_response_time} suffix="ms" />
                </Col>
              </Row>
            </TabPane>
            <TabPane
              tab={<span><DatabaseOutlined />{t('agentMon.tab.variables')}</span>}
              key="variables"
            >
              <AgentVariables agentId={selectedAgent.id} />
            </TabPane>
            <TabPane
              tab={<span><MessageOutlined />{t('agentMon.tab.messages')}</span>}
              key="messages"
            >
              {messagesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin tip={t('agentMon.loadingMessages')} />
                </div>
              ) : agentMessages.length > 0 ? (
                <>
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    maxHeight: '500px', overflowY: 'auto',
                    padding: '16px',
                    backgroundColor: 'var(--custom-header-bg)',
                    borderRadius: '8px',
                    border: '1px solid var(--custom-border)'
                  }}>
                    {agentMessages.map((msg: any, index: number) => {
                      const isHuman = msg.role === 'human';
                      const agentId = msg.agent?.id || msg.agent_id;
                      const agentName = msg.agent?.name || msg.agent_name || t('agentMon.agent');
                      return (
                        <div
                          key={msg.id || index}
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
                          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {isHuman ? (
                                <Avatar icon={<UserOutlined style={{ color: '#fff' }} />} style={{ backgroundColor: '#1677ff', marginRight: '8px' }} size="small" />
                              ) : (
                                <Avatar icon={<RobotOutlined style={{ color: '#fff' }} />} style={{ ...getAgentAvatarStyle(agentId || agentName), marginRight: '8px' }} size="small" />
                              )}
                              <Text strong style={{ color: isHuman ? '#1677ff' : '#52c41a' }}>
                                {isHuman ? t('agentMon.user') : agentName}
                              </Text>
                            </div>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                            </Text>
                          </div>
                          <div style={{ margin: 0 }}>
                            <ConversationExtraction message={msg} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <Space>
                      <Text type="secondary">{t('agentMon.totalCount', { total: messagesPagination.total })}</Text>
                      <Button size="small" disabled={messagesPagination.current <= 1}
                        onClick={() => selectedAgent && fetchAgentMessages(selectedAgent.id, messagesPagination.current - 1, messagesPagination.pageSize)}>
                        {t('agentMon.prevPage')}
                      </Button>
                      <Text>{messagesPagination.current} / {Math.ceil(messagesPagination.total / messagesPagination.pageSize) || 1}</Text>
                      <Button size="small" disabled={messagesPagination.current >= Math.ceil(messagesPagination.total / messagesPagination.pageSize)}
                        onClick={() => selectedAgent && fetchAgentMessages(selectedAgent.id, messagesPagination.current + 1, messagesPagination.pageSize)}>
                        {t('agentMon.nextPage')}
                      </Button>
                    </Space>
                  </div>
                </>
              ) : (
                <Empty description={t('agentMon.emptyMessages')} />
              )}
            </TabPane>
          </Tabs>
        )}
      </Modal>

      {/* agent memory modal */}
      <Modal
        title={t('agentMon.memoryTitle', { name: selectedAgent?.name || '' })}
        open={memoryModalVisible}
        onCancel={() => setMemoryModalVisible(false)}
        footer={null}
        width={800}
      >
        {/* agent ownership info */}
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'var(--custom-hover-bg)', borderRadius: '8px' }}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label={t('agentMon.label.role')} span={1}>
              {selectedAgent?.role?.name || t('agentMon.unknownRole')}
            </Descriptions.Item>
            <Descriptions.Item label={t('agentMon.label.type')} span={1}>
              <Tag color={selectedAgent?.source === 'internal' ? 'blue' : 'orange'}>
                {selectedAgent?.source === 'internal' ? t('agentMon.internalAgent') : t('agentMon.externalAgent')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('agentMon.label.actionSpace')} span={2}>
              {selectedAgent?.action_space ? (
                <Tag color="purple">{selectedAgent.action_space.name}</Tag>
              ) : (
                <Text type="secondary">{t('agentMon.unassigned')}</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('agentMon.label.actionTask')} span={2}>
              {selectedAgent?.action_task ? (
                <Tag color="green">{selectedAgent.action_task.name}</Tag>
              ) : (
                <Text type="secondary">{t('agentMon.unassigned')}</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* memory timeline */}
        <Timeline
          items={memories.map(memory => ({
            color: memory.type === 'conversation' ? 'blue' : 'green',
            children: (
              <>
                <p style={{ margin: 0 }}>
                  <Tag color={memory.type === 'conversation' ? 'blue' : 'green'}>
                    {memory.type === 'conversation' ? t('agentMon.memType.conversation') : t('agentMon.memType.knowledge')}
                  </Tag>
                  <span style={{ marginLeft: '8px' }}>{new Date(memory.created_at).toLocaleString()}</span>
                </p>
                <p style={{ margin: '8px 0 0 0' }}>{memory.content}</p>
              </>
            ),
          }))}
        />
      </Modal>
    </div>
  );
};

export default AgentMonitoring;
