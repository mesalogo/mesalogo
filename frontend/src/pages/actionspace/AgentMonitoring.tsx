import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Modal, Tag, Descriptions, Statistic, Row, Col, Timeline, message, Typography, Tabs, Empty, Spin, Avatar } from 'antd';
import { MonitorOutlined, EyeOutlined, SyncOutlined, ReloadOutlined, DatabaseOutlined, MessageOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { agentAPI } from '../../services/api/agent';
import AgentVariables from '../../components/agent/AgentVariables';
import ConversationExtraction from '../actiontask/components/ConversationExtraction';
import { getAgentAvatarStyle } from '../../utils/colorUtils';
import '../actiontask/css/conversation.css';

const { Text } = Typography;
const { TabPane } = Tabs;

const AgentMonitoring = () => {
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
      console.error('获取智能体消息失败:', error);
      setAgentMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // 获取智能体列表
  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await agentAPI.getAllActive();
      const agentData = Array.isArray(response) ? response : response.data || [];
      // 过滤掉属于并行实验克隆任务的智能体
      setAgents(agentData.filter(a => !a.action_task?.is_experiment_clone));
    } catch (error) {
      message.error('获取智能体列表失败');
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
      message.error('获取智能体记忆失败');
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

  const columns = [
    {
      title: '名称',
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
      title: '角色',
      key: 'role',
      render: (_, record) => {
        // 根据role_id获取角色名称，或直接使用返回的角色名
        if (record.role && record.role.name) {
          return record.role.name;
        }
        // 兼容API返回，可能会返回role_name字段
        return record.role_name || '未知角色';
      },
      width: 150,
    },
    {
      title: '类型',
      key: 'source',
      render: (_, record) => (
        <Tag color={record.source === 'internal' ? 'blue' : 'orange'}>
          {record.source === 'internal' ? '内部' : '外部'}
        </Tag>
      ),
      width: 80,
    },
    {
      title: '行动任务',
      key: 'action_task',
      render: (_, record) => {
        // 获取行动任务名称
        let taskName = '';
        if (record.action_task && record.action_task.name) {
          taskName = record.action_task.name;
        } else if (record.action_task_name && record.action_task_name !== '未分配') {
          taskName = record.action_task_name;
        } else if (record.action_task_id) {
          taskName = `任务#${record.action_task_id}`;
        }

        // 获取行动空间名称
        let spaceName = '';
        if (record.action_space && record.action_space.name) {
          spaceName = record.action_space.name;
        } else if (record.action_space_name) {
          spaceName = record.action_space_name;
        }

        // 如果有行动任务和行动空间，显示格式为 "任务[空间]"
        if (taskName && spaceName) {
          return <Tag color="green">{`${taskName}[${spaceName}]`}</Tag>;
        } else if (taskName) {
          // 只有任务没有空间
          return <Tag color="green">{taskName}</Tag>;
        } else {
          // 都没有
          return <Text type="secondary">未分配</Text>;
        }
      },
      width: 220,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={
          status === 'active' ? 'success' :
          status === 'idle' ? 'default' :
          status === 'busy' ? 'processing' :
          'error'
        }>
          {
            status === 'active' ? '活跃' :
            status === 'idle' ? '空闲' :
            status === 'busy' ? '忙碌' :
            '离线'
          }
        </Tag>
      ),
      width: 80,
    },
    {
      title: '会话数',
      dataIndex: 'conversation_count',
      key: 'conversation_count',
      width: 90,
    },
    {
      title: '最后活动时间',
      dataIndex: 'last_active',
      key: 'last_active',
      render: (date) => date ? new Date(date).toLocaleString() : '未知',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => showDetail(record)}
          >
            详情
          </Button>
          <Button
            type="text"
            icon={<SyncOutlined />}
            onClick={() => showMemories(record)}
          >
            记忆
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
            刷新状态
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
            showTotal: (total) => `共 ${total} 个智能体`,
            position: ['bottomRight']
          }}
          style={{ overflowX: 'auto' }}
          scroll={{ x: 1500 }}
          locale={{
            emptyText: <Empty description="暂无智能体数据" />
          }}
        />
      </Card>

      {/* 智能体详情模态框 */}
      <Modal
        title={`智能体详情 - ${selectedAgent?.name}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedAgent && (
          <Tabs activeKey={activeDetailTab} onChange={handleDetailTabChange}>
            <TabPane tab={<span>基本信息</span>} key="info">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="ID">{selectedAgent.id}</Descriptions.Item>
                <Descriptions.Item label="名称">{selectedAgent.name}</Descriptions.Item>
                <Descriptions.Item label="角色">{selectedAgent.role?.name}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={
                    selectedAgent.status === 'active' ? 'success' :
                    selectedAgent.status === 'idle' ? 'default' :
                    selectedAgent.status === 'busy' ? 'processing' :
                    'error'
                  }>
                    {
                      selectedAgent.status === 'active' ? '活跃' :
                      selectedAgent.status === 'idle' ? '空闲' :
                      selectedAgent.status === 'busy' ? '忙碌' :
                      '离线'
                    }
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="类型" span={1}>
                  <Tag color={selectedAgent?.source === 'internal' ? 'blue' : 'orange'}>
                    {selectedAgent?.source === 'internal' ? '内部智能体' : '外部智能体'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="行动空间" span={1}>
                  {selectedAgent?.action_space ? (
                    <Tag color="purple">{selectedAgent.action_space.name}</Tag>
                  ) : (
                    <Text type="secondary">未分配</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="行动任务" span={2}>
                  {selectedAgent?.action_task ? (
                    <Tag color="green">{selectedAgent.action_task.name}</Tag>
                  ) : (
                    <Text type="secondary">未分配</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>

              <Row gutter={16} style={{ marginTop: '24px' }}>
                <Col span={8}>
                  <Statistic title="总会话数" value={selectedAgent.conversation_count} />
                </Col>
                <Col span={8}>
                  <Statistic title="总消息数" value={selectedAgent.message_count} />
                </Col>
                <Col span={8}>
                  <Statistic title="平均响应时间" value={selectedAgent.avg_response_time} suffix="ms" />
                </Col>
              </Row>
            </TabPane>
            <TabPane
              tab={<span><DatabaseOutlined />代理变量</span>}
              key="variables"
            >
              <AgentVariables agentId={selectedAgent.id} />
            </TabPane>
            <TabPane
              tab={<span><MessageOutlined />消息记录</span>}
              key="messages"
            >
              {messagesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin tip="加载消息中..." />
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
                      const agentName = msg.agent?.name || msg.agent_name || '智能体';
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
                                {isHuman ? '用户' : agentName}
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
                      <Text type="secondary">共 {messagesPagination.total} 条</Text>
                      <Button size="small" disabled={messagesPagination.current <= 1}
                        onClick={() => selectedAgent && fetchAgentMessages(selectedAgent.id, messagesPagination.current - 1, messagesPagination.pageSize)}>
                        上一页
                      </Button>
                      <Text>{messagesPagination.current} / {Math.ceil(messagesPagination.total / messagesPagination.pageSize) || 1}</Text>
                      <Button size="small" disabled={messagesPagination.current >= Math.ceil(messagesPagination.total / messagesPagination.pageSize)}
                        onClick={() => selectedAgent && fetchAgentMessages(selectedAgent.id, messagesPagination.current + 1, messagesPagination.pageSize)}>
                        下一页
                      </Button>
                    </Space>
                  </div>
                </>
              ) : (
                <Empty description="暂无消息记录" />
              )}
            </TabPane>
          </Tabs>
        )}
      </Modal>

      {/* 智能体记忆模态框 */}
      <Modal
        title={`智能体记忆 - ${selectedAgent?.name}`}
        open={memoryModalVisible}
        onCancel={() => setMemoryModalVisible(false)}
        footer={null}
        width={800}
      >
        {/* 智能体所属信息 */}
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'var(--custom-hover-bg)', borderRadius: '8px' }}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="角色" span={1}>
              {selectedAgent?.role?.name || '未知角色'}
            </Descriptions.Item>
            <Descriptions.Item label="类型" span={1}>
              <Tag color={selectedAgent?.source === 'internal' ? 'blue' : 'orange'}>
                {selectedAgent?.source === 'internal' ? '内部智能体' : '外部智能体'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="行动空间" span={2}>
              {selectedAgent?.action_space ? (
                <Tag color="purple">{selectedAgent.action_space.name}</Tag>
              ) : (
                <Text type="secondary">未分配</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="行动任务" span={2}>
              {selectedAgent?.action_task ? (
                <Tag color="green">{selectedAgent.action_task.name}</Tag>
              ) : (
                <Text type="secondary">未分配</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 记忆时间线 */}
        <Timeline
          items={memories.map(memory => ({
            color: memory.type === 'conversation' ? 'blue' : 'green',
            children: (
              <>
                <p style={{ margin: 0 }}>
                  <Tag color={memory.type === 'conversation' ? 'blue' : 'green'}>
                    {memory.type === 'conversation' ? '对话' : '知识'}
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
