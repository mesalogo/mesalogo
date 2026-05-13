import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Tabs,
  Button,
  Space,
  Badge,
  Tag,
  Row,
  Col,
  List,
  Avatar,
  Tooltip,
  Empty,
  message,
  Descriptions,
  Statistic,
  Result,
  Table,
  Spin,
  Dropdown,
  Menu,
  Splitter
} from 'antd';
import {
  LeftOutlined,
  MessageOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  StopOutlined,
  ExportOutlined,
  GlobalOutlined,
  ReloadOutlined,
  DownOutlined,
  SettingOutlined,
  ImportOutlined,
  BookOutlined,
  InfoCircleOutlined,
  BranchesOutlined,
  ShopOutlined,
  ShareAltOutlined,
  WindowsOutlined,
  CaretDownOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../services/api/actionTask';
// 导入对话样式
import '../css/conversation.css';
import ActionTaskConversation from '../components/ActionTaskConversation';
import ExportModal from '../components/ExportModal';
import PublishModal from '../components/PublishModal';
import { useAppTabManager } from '../components/AppTabManager';
import AppRenderer from '../components/AppRenderer';
import { useTaskWindow } from '../../../components/TaskWindowManager';

// 导入重构的组件（保守方案：只使用 UI 组件）
import LoadingSkeleton from './components/LoadingSkeleton';
import InfoTab from './components/tabs/InfoTab';
import MonitorTab from './components/tabs/MonitorTab';
import { MemoryTab, AuditTab, AppsTab } from './components/tabs/SimpleTabs';

// 导入自定义 Hooks
import useTaskData from './hooks/useTaskData';
import useVariablesRefresh from './hooks/useVariablesRefresh';

const { Title, Text } = Typography;

// 变量闪烁效果的CSS样式
const variableFlashStyle = `
  @keyframes variableFlash {
    0% { background-color: rgba(24, 144, 255, 0.2); }
    50% { background-color: rgba(24, 144, 255, 0.5); }
    100% { background-color: rgba(24, 144, 255, 0.2); }
  }

  .variable-flash {
    animation: variableFlash 1s ease-in-out;
    border-radius: 2px;
  }
`;

const ActionTaskDetail = ({ taskIdProp }) => {
  const { t } = useTranslation();
  const { taskId: taskIdFromRoute } = useParams();
  const taskId = taskIdProp || taskIdFromRoute; // 优先使用 prop，fallback 到路由参数
  const navigate = useNavigate();
  
  // 使用任务窗口管理器
  const { windows, activeTaskId, updateTaskInfo } = useTaskWindow();
  
  // 获取所有任务列表（用于显示未加载的窗口）
  const [allTasks, setAllTasks] = useState([]);
  
  // 使用任务数据管理 Hook
  const {
    task,
    messages,
    loading,
    refreshKey,
    activeConversationId,
    setTask,
    setMessages,
    setRefreshKey,
    setActiveConversationId,
    fetchTaskData,
    refreshTaskMessages
  } = useTaskData(taskId);
  
  // 使用变量刷新 Hook
  const { variablesRefreshKey, refreshVariables } = useVariablesRefresh();
  
  const [respondingAgentId, setRespondingAgentId] = useState(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState('info');
  const [fullscreenApp, setFullscreenApp] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);

  // 组件引用
  const conversationRef = useRef(null);
  
  // 当任务数据加载完成后，更新任务信息到 TaskWindowManager
  useEffect(() => {
    if (task && taskId && updateTaskInfo) {
      updateTaskInfo(taskId, {
        title: task.title,
        actionSpaceName: task.action_space?.name || task.action_space_name
      });
    }
  }, [task, taskId, updateTaskInfo]);
  
  // 获取所有任务列表
  useEffect(() => {
    const fetchAllTasks = async () => {
      try {
        const tasks = await actionTaskAPI.getAll(false);
        // 只显示active状态的任务，并过滤掉并行实验创建的任务
        const activeTasks = tasks.filter(t => t.status === 'active' && !t.is_experiment_clone);
        setAllTasks(activeTasks);
      } catch (error) {
        console.error('获取任务列表失败:', error);
      }
    };
    
    fetchAllTasks();
    // 每30秒刷新一次任务列表
    const interval = setInterval(fetchAllTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  // 处理应用关闭后的tab切换
  const handleAppClosed = useCallback((appId) => {
    const closedTabKey = `app-${appId}`;

    // 如果当前活动的tab是被关闭的应用tab，则切换到应用管理tab
    if (activeSidebarTab === closedTabKey) {
      setActiveSidebarTab('apps');
    }
  }, [activeSidebarTab]);

  // 处理应用全屏显示
  const handleAppFullscreen = useCallback((app) => {
    setFullscreenApp(app);
  }, []);

  // 退出全屏
  const handleExitFullscreen = useCallback(() => {
    setFullscreenApp(null);
  }, []);

  // 应用Tab管理器
  const appTabManager = useAppTabManager(handleAppClosed, handleAppFullscreen, task?.action_space_id, task?.id);

  // 生成动态tab配置
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



  // 处理应用启动后的tab切换
  const handleAppLaunched = (app) => {
    if (app && app.tabKey) {
      setActiveSidebarTab(app.tabKey);
    }
  };

  // 包装 refreshVariables 以便作为回调使用
  const handleRefreshVariables = useCallback(() => {
    return refreshVariables(task, setTask, setRefreshKey);
  }, [task, setTask, setRefreshKey, refreshVariables]);

  // 刷新组件的函数
  const refreshComponent = () => {
    // Increment refresh key to force child components to re-render
    setRefreshKey(prev => prev + 1);
  };

  // 处理侧边栏标签页切换
  const handleSidebarTabChange = (key) => {
    // 检查要切换到的tab是否存在
    const tabItems = generateTabItems();
    const tabExists = tabItems.some(item => item.key === key);

    if (tabExists) {
      setActiveSidebarTab(key);
    } else {
      // 如果tab不存在，切换到默认的应用管理tab
      setActiveSidebarTab('apps');
    }
  };



  // 添加自定义样式
  const customStyles = `
    .full-height-tabs > .ant-tabs-content-holder {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    .full-height-tabs > .ant-tabs-content-holder > .ant-tabs-content {
      height: 100%;
      position: relative;
    }
    .full-height-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane {
      height: 100%;
      overflow: hidden;
      position: relative;
    }
    .tab-content-container {
      position: relative;
      height: 100%;
      width: 100%;
      overflow: auto;
    }
    .message-history {
      position: relative !important;
      overflow-y: auto !important;
    }
    .message-input-area {
      position: relative !important;
      z-index: 1 !important;
      border-top: 1px solid var(--custom-border);
    }
  `;

  // 注入自定义样式
  useEffect(() => {
    // 创建style元素
    const styleEl = document.createElement('style');
    styleEl.setAttribute('id', 'action-task-detail-styles');
    styleEl.innerHTML = customStyles;
    document.head.appendChild(styleEl);

    // 清理函数
    return () => {
      const existingStyle = document.getElementById('action-task-detail-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // 返回任务列表
  const handleBack = () => {
    navigate('/action-tasks/overview');
  };



  // 归档任务
  const handleTerminateTask = async () => {
    try {
      // 实际应用中调用API
      // await actionTaskAPI.updateStatus(taskId, 'terminated');
      setTask({...task, status: 'terminated'});
      message.success(t('actionTaskDetail.taskTerminated'));
    } catch (error) {
      message.error(t('actionTaskDetail.operationFailed') + ': ' + error.message);
    }
  };

  // 处理消息更新事件 - 更新消息数量
  const handleMessagesUpdated = (updatedMessages) => {
    // 如果提供了更新后的消息数组，使用它更新状态
    if (updatedMessages && Array.isArray(updatedMessages)) {
      // 检查是否有重复消息，如果有，使用最新的消息数组
      // 这是因为ActionTaskConversation组件可能传递的是当前消息数组加上新消息
      const messageIds = new Set();
      const uniqueMessages = [];

      // 从后向前遍历，保留最新的消息
      for (let i = updatedMessages.length - 1; i >= 0; i--) {
        const msg = updatedMessages[i];
        if (msg.id && !messageIds.has(msg.id)) {
          messageIds.add(msg.id);
          uniqueMessages.unshift(msg); // 添加到数组开头，保持原始顺序
        }
      }

      // 更新消息状态
      setMessages(uniqueMessages);
    }

    // 我们不在这里检查工具调用结果，而是在ActionTaskConversation组件中处理
  };

  // 刷新任务消息的回调函数，供监督者组件调用
  const handleRefreshTaskMessages = async () => {
    if (!activeConversationId) return;

    try {
      // 重新加载任务消息（包含监督者干预消息）
      const messagesData = await actionTaskAPI.getTaskMessages(task.id, activeConversationId);
      setMessages(messagesData);
      console.log('监督者干预后刷新任务消息成功');
    } catch (error) {
      console.error('刷新任务消息失败:', error);
    }
  };

  // 处理监督者干预，委托给任务会话组件处理
  const handleSupervisorIntervention = async (messageData) => {
    try {
      console.log('处理监督者干预，委托给任务会话组件:', messageData);

      // 通过ref调用任务会话组件的监督者干预方法
      if (conversationRef.current && conversationRef.current.sendSupervisorIntervention) {
        await conversationRef.current.sendSupervisorIntervention(
          messageData.content,
          messageData.target_agent_id
        );
      } else {
        console.error('无法调用任务会话组件的监督者干预方法');
      }
    } catch (error) {
      console.error('监督者干预失败:', error);
    }
  };

  // 智能体响应状态变化处理
  const handleAgentRespondingChange = (isResponding, agentId) => {
    // 更新当前响应的智能体ID
    setRespondingAgentId(isResponding ? agentId : null);
  };

  if (loading) {
    return (
      <LoadingSkeleton
        onBack={handleBack}
        onExport={() => setExportModalVisible(true)}
        t={t}
        customStyles={customStyles}
        variableFlashStyle={variableFlashStyle}
      />
    );
  }

  if (!task) {
    return (
      <Result
        status="404"
        title={t('actionTaskDetail.taskNotFound')}
        subTitle={t('actionTaskDetail.taskNotFoundDesc')}
        extra={
          <Button type="primary" onClick={handleBack}>
{t('actionTaskDetail.backToList')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="action-task-detail-page">
      <style>{customStyles}</style>
      <style>{variableFlashStyle}</style>
      <div className="page-header" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          {/* 返回/切换任务按钮（合并返回和切换窗口功能） */}
          <Space.Compact>
            <Button onClick={handleBack}>
              <LeftOutlined /> 返回
            </Button>
            <Dropdown
              trigger={['click', 'hover']}
              menu={{
                items: (() => {
                  // 已加载的窗口（除当前窗口）
                  const loadedItems = windows ? 
                    Array.from(windows.entries())
                      .filter(([windowTaskId]) => windowTaskId !== activeTaskId)
                      .map(([windowTaskId, window]) => {
                        const taskInfo = window.taskInfo;
                        return {
                          key: `loaded-${windowTaskId}`,
                          taskId: windowTaskId,
                          label: (
                            <div style={{ minWidth: 200, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>
                                  {taskInfo?.title || `任务 ${windowTaskId.slice(0, 8)}...`}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--custom-text-secondary)', marginTop: 2 }}>
                                  {taskInfo?.actionSpaceName || '未知行动空间'}
                                </div>
                              </div>
                              {/* 已加载窗口显示绿色光标 */}
                              <div style={{ 
                                width: 8, 
                                height: 8, 
                                borderRadius: '50%', 
                                backgroundColor: '#52c41a',
                                marginLeft: 12,
                                flexShrink: 0
                              }} />
                            </div>
                          ),
                          icon: <WindowsOutlined />,
                          onClick: () => {
                            navigate(`/action-tasks/detail/${windowTaskId}`);
                          }
                        };
                      })
                    : [];
                  
                  // 未加载的任务（不在windows中且不是当前任务）
                  const loadedTaskIds = windows ? new Set([...windows.keys(), activeTaskId]) : new Set([activeTaskId]);
                  const unloadedItems = allTasks
                    .filter(t => !loadedTaskIds.has(t.id))
                    .map(t => ({
                      key: `unloaded-${t.id}`,
                      taskId: t.id,
                      label: (
                        <div style={{ minWidth: 200, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--custom-text-secondary)', marginTop: 2 }}>
                              {t.action_space?.name || t.action_space_name || '未知行动空间'}
                            </div>
                          </div>
                        </div>
                      ),
                      icon: <WindowsOutlined style={{ color: 'var(--custom-text-secondary)' }} />,
                      onClick: () => {
                        navigate(`/action-tasks/detail/${t.id}`);
                      }
                    }));
                  
                  // 合并列表：已加载的在前，未加载的在后
                  const allItems = [...loadedItems];
                  
                  // 如果有未加载的任务，添加分隔符和未加载任务
                  if (unloadedItems.length > 0) {
                    if (loadedItems.length > 0) {
                      allItems.push({ type: 'divider' as const, key: 'divider' } as any);
                    }
                    allItems.push(...unloadedItems);
                  }
                  
                  // 如果没有任何其他任务
                  if (allItems.length === 0) {
                    return [{
                      key: 'no-tasks',
                      label: '暂无其他任务',
                      disabled: true
                    }];
                  }
                  
                  return allItems;
                })()
              }}
              placement="bottomLeft"
            >
              <Button>
                <DownOutlined /> 切换
              </Button>
            </Dropdown>
          </Space.Compact>
          
          <Space size="middle" align="center">
            <span style={{ fontSize: '20px', fontWeight: 600 }}>{task.title}</span>
            <Tag color="blue" icon={<GlobalOutlined />}>
              {task.action_space ? task.action_space.name : (task.action_space_name || t('actionTaskDetail.unspecifiedActionSpace'))}
            </Tag>
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
          {task.status === 'active' && (
            <Button
              icon={<StopOutlined />}
              danger
              onClick={handleTerminateTask}
            >
              {t('actionTaskDetail.archiveTask')}
            </Button>
          )}
          <Button
            icon={<ShareAltOutlined />}
            onClick={() => setPublishModalVisible(true)}
          >
            {t('actionTaskDetail.publish')}
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={() => setExportModalVisible(true)}
          >
            {t('actionTaskDetail.exportData')}
          </Button>
        </Space>
      </div>

      <Card styles={{ body: { padding: '12px' } }}>
        <div style={{ height: 'calc(100vh - 168px)', minHeight: '600px' }}>
          <Splitter
            style={{ height: '100%' }}
          >
            <Splitter.Panel
              defaultSize="66%"
              min="30%"
              max="80%"
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <MessageOutlined style={{ marginRight: 4 }} />
                <Text strong style={{ fontSize: '16px' }}>{t('actionTask.interactionRecord')}</Text>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div className="tab-content-container" style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
                  {task && <ActionTaskConversation
                    ref={conversationRef}
                    task={task}
                    messages={messages}
                    setMessages={setMessages}
                    onMessagesUpdated={handleMessagesUpdated}
                    onAgentRespondingChange={handleAgentRespondingChange}
                    onUserMessageSent={handleRefreshVariables}
                    onRefreshAutonomousTaskCard={refreshComponent}
                  />}
                </div>
              </div>
            </Splitter.Panel>
            
            <Splitter.Panel
              min="20%"
              max="70%"
              collapsible={{
                start: true,
                end: false
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto'
              }}
            >
              <div style={{ paddingLeft: '8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Tabs
                  activeKey={activeSidebarTab}
                  onChange={handleSidebarTabChange}
                  tabPlacement="top"
                  style={{ marginBottom: 8 }}
                  items={generateTabItems()}
                />
              {/* 任务信息标签页 */}
              {activeSidebarTab === 'info' && (
                <InfoTab task={task} messages={messages} t={t} />
              )}

              {/* 任务监控标签页 */}
              {activeSidebarTab === 'monitor' && (
                <MonitorTab
                  task={task}
                  messages={messages}
                  variablesRefreshKey={variablesRefreshKey}
                  respondingAgentId={respondingAgentId}
                  activeConversationId={activeConversationId}
                  refreshKey={refreshKey}
                  t={t}
                  onVariablesChange={handleRefreshVariables}
                  onAgentAdded={fetchTaskData}
                />
              )}

              {/* 工作空间标签页 */}
              {activeSidebarTab === 'memory' && (
                <MemoryTab 
                  task={task} 
                  respondingAgentId={respondingAgentId}
                />
              )}

              {/* 监督会话标签页 */}
              {activeSidebarTab === 'audit' && (
                <AuditTab
                  task={task}
                  activeConversationId={activeConversationId}
                  refreshKey={refreshKey}
                  onTaskMessagesRefresh={handleRefreshTaskMessages}
                  onSupervisorIntervention={handleSupervisorIntervention}
                  t={t}
                />
              )}

              {/* 应用管理标签页 */}
              {activeSidebarTab === 'apps' && (
                <AppsTab
                  task={task}
                  appTabManager={appTabManager}
                  onAppLaunched={handleAppLaunched}
                />
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
            </Splitter.Panel>
          </Splitter>
        </div>
      </Card>

      {/* 全屏应用渲染 */}
      {fullscreenApp && (
        <AppRenderer
          app={fullscreenApp}
          fullscreen={true}
          onExitFullscreen={handleExitFullscreen}
        />
      )}

      {/* 导出数据Modal */}
      <ExportModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        task={task}
        currentConversationId={activeConversationId}
      />

      {/* 发布任务Modal */}
      <PublishModal
        visible={publishModalVisible}
        onCancel={() => setPublishModalVisible(false)}
        task={task}
      />
    </div>
  );
};

export default ActionTaskDetail;