import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Typography,
  Spin,
  Alert,
  List,
  Avatar,
  Tag,
  Empty,
  Input,
  Button,
  Space,
  Modal,
  message,
  Row,
  Col,
  Tabs,
  Badge,
  Descriptions,
  Statistic,
  Tooltip,
  Table
} from 'antd';
import {
  RobotOutlined,
  MessageOutlined,
  LockOutlined,
  UserOutlined,
  TeamOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  ToolOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  BranchesOutlined,
  ShopOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../services/api/axios';
import './PublicTaskView.css';
import { getAgentAvatarStyle } from '../../utils/colorUtils';
import ActionTaskConversation from '../actiontask/components/ActionTaskConversation';
import ActionTaskEnvironment from '../actiontask/components/ActionTaskEnvironment';
import ActionTaskRules from '../actiontask/components/ActionTaskRules';
import ActionTaskSupervisor from '../actiontask/components/ActionTaskSupervisor';
import ActionTaskWorkspace from '../actiontask/components/ActionTaskWorkspace';
import TaskAppTools from '../actiontask/components/TaskAppTools';
import AppRenderer from '../actiontask/components/AppRenderer';
import { useAppTabManager } from '../actiontask/components/AppTabManager';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 公开任务查看页面
 * 无需登录即可访问
 * 布局与任务详情页面一致（无左侧菜单）
 */
const PublicTaskView = () => {
  const { shareToken } = useParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [error, setError] = useState(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('info');
  const [messages, setMessages] = useState([]);
  const conversationRef = useRef(null);

  // 临时会话管理（用于不展示历史会话的交互模式）
  const [tempConversations, setTempConversations] = useState([]);

  // 变量刷新键
  const [variablesRefreshKey, setVariablesRefreshKey] = useState(0);

  // 应用Tab管理器
  const handleAppClosed = (appId) => {
    const closedTabKey = `app-${appId}`;
    if (activeSidebarTab === closedTabKey) {
      setActiveSidebarTab('apps');
    }
  };

  const handleAppFullscreen = () => {
    // 公开页面不支持全屏
  };

  const appTabManager = useAppTabManager(handleAppClosed, handleAppFullscreen, task?.action_space_id, task?.id);

  // 处理应用启动后的tab切换
  const handleAppLaunched = (app) => {
    if (app && app.tabKey) {
      setActiveSidebarTab(app.tabKey);
    }
  };

  // localStorage 管理函数
  const getLocalStorageKey = () => {
    return `public_task_conversations_${shareToken}`;
  };

  const getLocalConversations = () => {
    try {
      const stored = localStorage.getItem(getLocalStorageKey());
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('读取本地会话失败:', error);
    }
    return { conversationIds: [] };
  };

  const saveLocalConversations = (conversationIds) => {
    try {
      const data = { conversationIds };
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(data));
    } catch (error) {
      console.error('保存本地会话失败:', error);
    }
  };

  const addLocalConversation = (conversationId) => {
    const localData = getLocalConversations();
    if (!localData.conversationIds.includes(conversationId)) {
      localData.conversationIds.push(conversationId);
      saveLocalConversations(localData.conversationIds);
    }
  };

  // 处理会话创建回调
  const handleConversationCreated = (conversation) => {
    console.log('会话已创建:', conversation);
    // 添加到本地存储
    addLocalConversation(conversation.id);
    // 更新临时会话列表
    setTempConversations(prev => [...prev, conversation]);
  };

  // 刷新环境变量和智能体变量的函数
  const refreshVariables = async () => {
    if (!task || !task.id) return;

    try {
      console.log('刷新环境变量...');

      // 使用公开API获取所有变量
      const params = password ? { password } : {};
      const variablesResponse = await api.get(`/public/task/${shareToken}/variables`, { params });

      if (variablesResponse.data) {
        // 更新任务状态中的变量
        setTask(prevTask => ({
          ...prevTask,
          environment_variables: variablesResponse.data.environmentVariables || [],
          agent_variables: variablesResponse.data.agentVariables || []
        }));

        // 刷新变量表格部分
        setVariablesRefreshKey(prev => prev + 1);

        console.log('环境变量刷新成功');
      }
    } catch (error) {
      console.error('刷新环境变量失败:', error);
    }
  };

  // 处理侧边栏标签页切换
  const handleSidebarTabChange = (key) => {
    // 检查要切换到的tab是否存在
    const tabItems = generateTabItems();
    const tabExists = tabItems.some(item => item.key === key);

    if (tabExists) {
      setActiveSidebarTab(key);
    } else {
      console.warn(`Tab ${key} does not exist`);
      setActiveSidebarTab('info');
    }
  };

  useEffect(() => {
    loadPublishedTask();
  }, [shareToken]);

  const loadPublishedTask = async (pwd = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = pwd ? { password: pwd } : {};
      const response = await api.get(`/public/task/${shareToken}`, { params });
      
      // 转换数据格式以匹配ActionTaskConversation组件的期望
      const taskData: any = {
        id: response.data.task.id,
        title: response.data.task.title,
        description: response.data.task.description,
        status: response.data.task.status,
        action_space_id: response.data.task.action_space_id,  // 添加行动空间ID
        agents: response.data.agents || [],
        config: response.data.task.config,
        mode: response.data.task.mode,
        theme: response.data.task.theme,
        branding: response.data.task.branding
      };
      
      // 获取环境变量（使用公开API）
      try {
        const params = pwd ? { password: pwd } : {};
        const variablesResponse = await api.get(`/public/task/${shareToken}/variables`, { params });
        if (variablesResponse.data) {
          taskData.environment_variables = variablesResponse.data.environmentVariables || [];
          taskData.agent_variables = variablesResponse.data.agentVariables || [];
          console.log('获取环境变量成功:', taskData.environment_variables);
        }
      } catch (error) {
        console.error('获取环境变量失败:', error);
        taskData.environment_variables = [];
        taskData.agent_variables = [];
      }

      setTask(taskData);
      setNeedPassword(false);

      // 提取所有会话的消息
      if (response.data.conversations) {
        const allMessages = [];
        response.data.conversations.forEach(conv => {
          if (conv.messages) {
            conv.messages.forEach(msg => {
              allMessages.push({
                ...msg,
                conversation_id: conv.id
              });
            });
          }
        });
        setMessages(allMessages);
      }

      // 如果是不展示历史会话的交互模式，加载临时会话
      if (!taskData.config?.show_messages && taskData.mode === 'interactive') {
        const localData = getLocalConversations();
        if (localData.conversationIds.length > 0) {
          // 从后端获取这些会话的详细信息
          try {
            const conversationsResponse = await api.get(`/action-tasks/${taskData.id}/conversations`);
            // API 返回格式是 { conversations: [...] }
            const allConversations = conversationsResponse.data?.conversations || [];

            // 过滤出本地存储的会话
            const filteredConversations = allConversations.filter(conv =>
              localData.conversationIds.includes(conv.id)
            );

            setTempConversations(filteredConversations);

            // 清理本地存储中不存在的会话ID
            const existingIds = filteredConversations.map(conv => conv.id);
            const cleanedIds = localData.conversationIds.filter(id => existingIds.includes(id));
            if (cleanedIds.length !== localData.conversationIds.length) {
              saveLocalConversations(cleanedIds);
            }
          } catch (error) {
            console.error('加载临时会话失败:', error);
            setTempConversations([]);
          }
        } else {
          setTempConversations([]);
        }
      }
    } catch (err) {
      console.error('加载任务失败:', err);
      
      if (err.response?.status === 401) {
        if (err.response.data.requires_password) {
          setNeedPassword(true);
        } else {
          setError(err.response.data.error || t('public.accessFailed'));
        }
      } else if (err.response?.status === 404) {
        setError(t('public.shareNotFound'));
      } else {
        setError(err.response?.data?.error || '加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      message.warning(t('public.passwordPlaceholder'));
      return;
    }

    setVerifying(true);
    try {
      await loadPublishedTask(password);
    } finally {
      setVerifying(false);
    }
  };

  // 密码输入界面
  if (needPassword) {
    return (
      <div className="public-task-container">
        <Card
          style={{
            maxWidth: 500,
            margin: '100px auto',
            textAlign: 'center'
          }}
        >
          <LockOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <Title level={3}>需要访问密码</Title>
          <Paragraph type="secondary">
            此分享受密码保护，请输入访问密码
          </Paragraph>
          
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }} style={{ marginTop: 24 }}>
            <Input.Password
              size="large"
              placeholder={t('public.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefix={<LockOutlined />}
              style={{ marginBottom: 16 }}
            />
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={verifying}
              block
            >
              验证访问
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className="public-task-container">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="public-task-container">
        <Card style={{ maxWidth: 600, margin: '100px auto' }}>
          <Alert
            message={t('public.accessFailed')}
            description={error}
            type="error"
            showIcon
          />
        </Card>
      </div>
    );
  }

  // 正常显示任务
  if (!task) {
    return null;
  }

  // 生成侧边栏标签页
  const generateTabItems = () => {
    const baseTabItems = [
      {
        key: 'info',
        label: <span><InfoCircleOutlined />{t('actionTaskDetail.taskInfo')}</span>,
      },
      {
        key: 'monitor',
        label: <span><EnvironmentOutlined />{t('actionTaskDetail.taskMonitor')}</span>,
      },
      {
        key: 'memory',
        label: <span><BranchesOutlined />{t('actionTaskDetail.workspace')}</span>,
      },
      {
        key: 'audit',
        label: <span><ApartmentOutlined />{t('actionTaskDetail.supervisorChat')}</span>,
      },
      {
        key: 'apps',
        label: <span><ShopOutlined />{t('actionTaskDetail.appManagement')}</span>,
      }
    ];

    // 添加应用tabs
    const appTabItems = appTabManager.generateAppTabItems();

    return [...baseTabItems, ...appTabItems];
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--custom-bg-layout)' }}>
      {/* 头部 */}
      <div style={{ padding: '16px 16px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Title level={3} style={{ margin: 0 }}>{task.title}</Title>
          <Space>
            {task.status === 'active' && (
              <Badge status="processing" text={t('actionTaskDetail.status.active')} />
            )}
            {task.status === 'completed' && (
              <Badge status="success" text={t('actionTaskDetail.status.completed')} />
            )}
            {task.status === 'terminated' && (
              <Badge status="error" text={t('actionTaskDetail.status.terminated')} />
            )}
          </Space>
        </Space>
        <Space>
          <Tag color="blue" icon={<EyeOutlined />}>
            公开访问
          </Tag>
        </Space>
      </div>

      <Card
        style={{ margin: '16px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' } }}
      >
        <Row gutter={16} style={{ flex: 1, minHeight: 0, height: '100%' }}>
          {/* 左侧：对话区域 */}
          <Col
            span={16}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <MessageOutlined style={{ marginRight: 8 }} />
              <Text strong style={{ fontSize: '16px' }}>{t('actionTask.interactionRecord')}</Text>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* 展示历史会话模式 */}
              {task && task.config?.show_messages && (
                <ActionTaskConversation
                  ref={conversationRef}
                  task={task}
                  messages={messages}
                  setMessages={setMessages}
                  readOnly={task.mode !== 'interactive'}
                  isPublicView={true}
                  shareToken={shareToken}
                  password={password}
                  onUserMessageSent={refreshVariables}
                />
              )}
              {/* 不展示历史会话 + 交互模式：使用临时会话 */}
              {task && !task.config?.show_messages && task.mode === 'interactive' && (
                <ActionTaskConversation
                  ref={conversationRef}
                  task={task}
                  messages={messages}
                  setMessages={setMessages}
                  readOnly={false}
                  isPublicView={true}
                  shareToken={shareToken}
                  password={password}
                  externalConversations={tempConversations}
                  onConversationCreated={handleConversationCreated}
                  onUserMessageSent={refreshVariables}
                />
              )}
              {/* 不展示历史会话 + 只读模式：显示提示 */}
              {task && !task.config?.show_messages && task.mode !== 'interactive' && (
                <Empty description={t('public.readonlyMode')} style={{ marginTop: 100 }} />
              )}
            </div>
          </Col>

          {/* 右侧：侧边栏 */}
          <Col
            span={8}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--custom-border)',
              paddingLeft: '16px'
            }}
          >
            <Tabs
              activeKey={activeSidebarTab}
              onChange={handleSidebarTabChange}
             
              tabPlacement="top"
              style={{ marginBottom: 16, flexShrink: 0 }}
              items={generateTabItems()}
            />

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '8px' }}>
              {/* 任务信息标签页 */}
              {activeSidebarTab === 'info' && (
              <>
                <Card title={t('actionTaskDetail.statisticsOverview')} style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Statistic
                        title={t('actionTaskDetail.messageCount')}
                        value={messages.length}
                        prefix={<MessageOutlined />}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title={t('actionTaskDetail.agents')}
                        value={task.agents?.length || 0}
                        prefix={<TeamOutlined />}
                      />
                    </Col>
                  </Row>
                </Card>

                <Card title={t('actionTaskDetail.taskInfo')} style={{ marginBottom: 16 }}>
                  <Descriptions column={1}>
                    <Descriptions.Item label={t('name')}>
                      {task.title}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('description')}>
                      {task.description || t('actionTaskDetail.noDescription')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('public.accessMode')}>
                      {task.mode === 'readonly' ? t('publish.modeReadonly') : t('publish.modeInteractive')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('status')}>
                      {task.status === 'active' ? t('actionTaskDetail.status.active') : task.status}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            )}

            {/* 任务监控标签页 */}
            {activeSidebarTab === 'monitor' && (
              <>
                <Card
                  title={<><TeamOutlined /> {t('actionTaskDetail.participatingAgents')}</>}
                  styles={{ body: { padding: '12px 8px' } }}
                  style={{ marginBottom: 16 }}
                >
                  {task.agents && task.agents.length > 0 ? (
                    <List
                      dataSource={task.agents.filter((agent: any) => !agent.is_observer && agent.type !== 'observer')}
                      itemLayout="horizontal"
                      split={true}
                      renderItem={(agent: any) => {
                        const agentMessages = messages.filter((m: any) => m.agent_id === agent.id).length;
                        const toolCallsCount = messages.reduce((count: number, message: any) => {
                          if (message.agent_id === agent.id) {
                            const content = message.content || '';
                            const toolMatches = content.match(/tool_call_id|toolResult|tool_name/g);
                            if (toolMatches) {
                              const toolCallIdMatches = content.match(/tool_call_id/g);
                              return count + (toolCallIdMatches ? toolCallIdMatches.length : 1);
                            }
                          }
                          return count;
                        }, 0);

                        return (
                          <List.Item style={{
                            borderRadius: '8px',
                            padding: '4px 6px',
                            marginBottom: '4px'
                          }}>
                            <div style={{ width: '100%', padding: '4px 2px' }}>
                              <div style={{ display: 'flex', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <Avatar
                                    icon={<RobotOutlined style={{ color: '#ffffff' }} />}
                                    style={{
                                      ...getAgentAvatarStyle(agent.id || agent.name, false),
                                      marginRight: '12px'
                                    }}
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text strong>{agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name}</Text>
                                    <Space>
                                      <Tooltip title={t('monitor.messageCount')}>
                                        <Badge count={agentMessages} style={{ backgroundColor: '#1677ff' }}>
                                          <MessageOutlined style={{ fontSize: '16px', color: 'var(--custom-text-secondary)' }} />
                                        </Badge>
                                      </Tooltip>
                             <Tooltip title={t('monitor.toolCallsCount')}>
                                        <Badge count={toolCallsCount} style={{ backgroundColor: '#722ed1' }}>
                                          <ToolOutlined style={{ fontSize: '16px', color: 'var(--custom-text-secondary)' }} />
                                        </Badge>
                                      </Tooltip>
                                    </Space>
                                  </div>
                                  <div style={{ marginTop: '4px' }}>
                                    <Text type="secondary">{agent.description || t('common.noDescription')}</Text>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  ) : (
                    <Empty description={t('monitor.noAgentData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Card>

                <Card
                  title={<><EnvironmentOutlined /> {t('actionTaskDetail.environment')}</>}
                  style={{ marginBottom: 16 }}
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {t('actionTaskDetail.environmentDesc')}
                    </Text>
                  </div>
                  {task && <ActionTaskEnvironment task={task} showGlobalOnly={true} key={`env-vars-${variablesRefreshKey}`} />}
                </Card>
              </>
            )}

            {/* 工作空间标签页 */}
            {activeSidebarTab === 'memory' && (
              <div style={{ marginBottom: 16 }}>
                {task && <ActionTaskWorkspace task={task} respondingAgentId={null} />}
              </div>
            )}

            {/* 监督会话标签页 */}
            {activeSidebarTab === 'audit' && (
              <>
                <Card
                  title={<><ApartmentOutlined /> {t('actionTaskDetail.rules')}</>}
                  style={{ marginBottom: 16 }}
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      任务的规则配置
                    </Text>
                  </div>
                  {task && <ActionTaskRules task={task} />}
                </Card>

                <Card
                  title={<><EyeOutlined /> 监督会话</>}
                  style={{ marginBottom: 16 }}
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      监督者与用户的交互会话记录
                    </Text>
                  </div>
                  {task && <ActionTaskSupervisor task={task} onTaskMessagesRefresh={() => {}} onSupervisorIntervention={() => {}} />}
                </Card>
              </>
            )}

            {/* 应用管理标签页 */}
            {activeSidebarTab === 'apps' && (
              <div style={{ marginBottom: 16 }}>
                {task && <TaskAppTools
                  task={task}
                  appTabManager={appTabManager}
                  onAppLaunched={handleAppLaunched}
                />}
              </div>
            )}

            {/* 动态应用标签页 */}
            {activeSidebarTab.startsWith('app-') && (
              <div style={{ marginBottom: 16, height: 'calc(100vh - 300px)' }}>
                {(() => {
                  const appId = activeSidebarTab.replace('app-', '');
                  const app = appTabManager.getOpenApp(appId);
                  return app ? <AppRenderer app={app} /> : null;
                })()}
              </div>
            )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default PublicTaskView;

