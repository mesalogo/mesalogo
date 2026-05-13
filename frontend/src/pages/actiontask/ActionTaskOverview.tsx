import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Card,
  Tag,
  Space,
  Badge,
  Tooltip,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Divider,
  Row,
  Col,
  Empty,
  Tabs,
  Spin,
  App,
  Checkbox,
  Segmented,
  Skeleton,
  Dropdown
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  MessageOutlined,
  GlobalOutlined,
  OrderedListOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  UserOutlined,
  ShareAltOutlined,
  StopOutlined,
  FileProtectOutlined,
  AppstoreOutlined,
  ExclamationCircleOutlined,
  CommentOutlined,
  RobotOutlined,
  LockOutlined,
  DownOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../services/api/actionTask';
import { agentAPI } from '../../services/api/agent';
import { roleAPI } from '../../services/api/role';
import { actionSpaceAPI } from '../../services/api/actionspace';
import { modelConfigAPI } from '../../services/api/model';
import { settingsAPI } from '../../services/api/settings';
import { replaceTemplateVariables, formatRolesForTemplate } from '../../utils/templateUtils';
import { getAssistantGenerationModelId } from '../../utils/modelUtils';
import PublishModal from './components/PublishModal';
import OneClickModal from '../../components/OneClickGeneration/OneClickModal';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
// 不再使用 TabPane，改用 items 属性

const ActionTaskOverview = () => {
  const { t } = useTranslation();
  // 使用 App 上下文中的 message
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [agents, setAgents] = useState([]);
  const [actionSpaces, setActionSpaces] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedActionSpace, setSelectedActionSpace] = useState(null);
  const [ruleSets, setRuleSets] = useState([]);
  const [loadingRuleSets, setLoadingRuleSets] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [selectedTasks, setSelectedTasks] = useState([]);

  // 发布相关状态
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [currentPublishTask, setCurrentPublishTask] = useState(null);

  // 一键创建相关状态
  const [oneClickModalVisible, setOneClickModalVisible] = useState(false);

  // 辅助生成相关状态
  const [assistantGenerating, setAssistantGenerating] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    enableAssistantGeneration: true,
    assistantGenerationModel: 'default'
  });
  const [modelConfigs, setModelConfigs] = useState([]);

  // 获取全局设置
  const fetchGlobalSettings = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      setGlobalSettings({
        enableAssistantGeneration: settings.enableAssistantGeneration !== undefined ? settings.enableAssistantGeneration : true,
        assistantGenerationModel: settings.assistantGenerationModel || 'default'
      });
    } catch (error) {
      console.error('获取全局设置失败:', error);
    }
  };

  // 获取模型配置
  const fetchModelConfigs = async () => {
    try {
      const configs = await modelConfigAPI.getAll();
      setModelConfigs(configs);
    } catch (error) {
      console.error('获取模型配置失败:', error);
    }
  };

  // 移除筛选菜单定义

  useEffect(() => {
    // 初始加载时只获取一次数据
    const initialDataFetch = async () => {
      setLoading(true); // 设置全局加载状态

      try {
        // 获取行动空间列表
        let allActionSpaces = [];
        try {
          const actionSpacesResponse = await actionSpaceAPI.getAll();
          if (actionSpacesResponse && Array.isArray(actionSpacesResponse)) {
            allActionSpaces = actionSpacesResponse;
            setActionSpaces(allActionSpaces);
            console.log('获取行动空间列表成功', allActionSpaces.length, '个行动空间');

            // 从行动空间中提取规则集
            try {
              const extractedRuleSets = await actionSpaceAPI.getRuleSets(null, allActionSpaces);
              setRuleSets(extractedRuleSets);
            } catch (ruleSetsError) {
              console.error('提取规则集失败:', ruleSetsError);
            }
          }
        } catch (spaceError) {
          console.error('获取行动空间列表失败:', spaceError);
        }

        // 获取任务数据
        let apiTasks = [];
        try {
          const response = await actionTaskAPI.getAll();
          if (response && Array.isArray(response) && response.length > 0) {
            apiTasks = response.map(task => {
              // 查找对应的行动空间名称
              let actionSpaceName = task.action_space_name;
              if (!actionSpaceName && task.action_space_id) {
                const matchedSpace = allActionSpaces.find(space => space.id === task.action_space_id);
                actionSpaceName = matchedSpace?.name || '未知行动空间';
              } else if (!actionSpaceName) {
                actionSpaceName = '未分配行动空间';
              }
              return {
                ...task,
                action_space_name: actionSpaceName,
                is_api: true
              };
            });
            console.log('成功加载API行动任务数据', apiTasks.length, '条记录');
          }
        } catch (apiError) {
          console.error('获取API行动任务失败:', apiError);
          message.warning(t('actionTask.loadFailed'));
        }

        // 设置任务数据
        setTasks(apiTasks);

        if (apiTasks.length > 0) {
          message.success(t('actionTask.tasksLoaded', { count: apiTasks.length }));
        } else {
          message.info(t('actionTask.noTaskData'));
        }
      } catch (error) {
        console.error('数据加载失败:', error);
        message.error(t('actionTask.dataLoadFailed') + ': ' + error.message);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    initialDataFetch();
    fetchGlobalSettings();
    fetchModelConfigs();
  }, []);

  // 刷新任务列表（如果需要重新加载数据）
  const refreshTasks = async () => {
    // 实现刷新逻辑，如果需要的话
    message.info('刷新任务列表功能尚未实现');
  };

  // 加载智能体和行动空间数据
  const loadResources = async () => {
    setLoadingResources(true);
    try {
      // 获取所有角色列表
      const rolesData = await roleAPI.getAll();
      setAgents(rolesData);

      // 获取行动空间列表
      const actionSpacesData = await actionSpaceAPI.getAll();
      setActionSpaces(actionSpacesData);
    } catch (error) {
      message.error(t('actionTask.loadResourcesFailed'));
      console.error('加载资源失败:', error);
    } finally {
      setLoadingResources(false);
    }
  };

  // 打开创建任务的模态框
  const showCreateModal = () => {
    setModalVisible(true);
    // 重置表单
    form.resetFields();
    // 加载必要资源
    loadResources();
  };

  // 创建新任务
  const handleCreateTask = async (values) => {
    setCreateLoading(true);
    try {
      // 不再需要手动创建智能体，后端会自动从行动空间角色创建参与智能体，从监督者角色创建监督者agent
      // 这里不再需要从角色创建智能体的代码，后端会自动处理

      // 保留一个空的agentIds数组，以便与旧版本兼容
      const agentIds = [];

      // 获取选择的规则集ID（可能是多个）
      const ruleSetIds = values.rule_set_id || [];

      // 使用第一个规则集作为主规则集，或者如果没有选择规则集则为空
      const primaryRuleSetId = ruleSetIds.length > 0 ? ruleSetIds[0] : null;

      // 构建请求数据
      const taskData = {
        title: values.title,
        description: values.description || '',
        mode: 'sequential', // 默认使用顺序模式
        action_space_id: values.action_space_id,
        rule_set_id: primaryRuleSetId, // 主规则集
        additional_rule_set_ids: ruleSetIds.slice(1), // 额外的规则集
        agent_ids: agentIds  // 添加智能体ID列表
      };

      console.log('创建行动任务数据:', taskData);

      // 调用API创建任务
      const response = await actionTaskAPI.create(taskData);

      // 添加到列表中
      if (response && response.id) {
        message.success(t('actionTask.createSuccess'));
        setModalVisible(false);

        // 查找行动空间名称
        const actionSpace = actionSpaces.find(space => space.id === values.action_space_id);
        const actionSpaceName = actionSpace ? actionSpace.name : t('actionTask.unknownSpace');

        // 构建新任务对象，确保与API返回格式一致
        const newTask = {
          id: response.id,
          title: response.title,
          description: values.description || '',
          status: 'active',
          mode: 'sequential', // 默认使用顺序模式
          rule_set_id: primaryRuleSetId,
          action_space_id: values.action_space_id,
          action_space_name: actionSpaceName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          agent_count: response.agent_count || agentIds.length,
          message_count: response.message_count || 0,
          conversation_count: response.conversation_count || 0,
          autonomous_task_count: response.autonomous_task_count || 0,
          supervisor_count: 1,
          // 使用API返回的环境变量或从任务详情API获取
          environment_variables: response.environment_variables || [],
          rule_triggers: [],
          is_api: true,  // 标记为API数据
          agent_ids: agentIds  // 添加智能体ID列表
        };

        // 将新任务添加到列表开头
        setTasks(prev => [newTask, ...prev]);

        console.log('添加新创建的任务到列表:', newTask);

        // 跳转到任务详情页
        setTimeout(() => {
          navigate(`/action-tasks/detail/${response.id}`);
        }, 500);
      }
    } catch (error: any) {
      // 检查是否是配额超限错误
      if (error.response?.status === 403 && error.response?.data?.quota) {
        message.error(`配额超限：${error.response.data.message || '您的计划已达到行动任务数量上限'}`);
      } else {
        message.error(`${t('actionTask.createFailed')}: ${error.message || t('message.tryAgainLater')}`);
      }
      console.error('创建行动任务失败:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  // 过滤任务数据
  const getFilteredTasks = () => {
    // 先过滤掉并行实验创建的任务
    let filteredTasks = tasks.filter(task => !task.is_experiment_clone);
    
    // 再根据搜索文本过滤任务
    if (searchText) {
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchText.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchText.toLowerCase())) ||
        (task.action_space_name && task.action_space_name.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    // 按创建时间降序排序，最新的排在前面
    return filteredTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // 辅助生成任务描述
  const handleAssistantGenerate = async () => {
    try {
      // 检查是否启用了辅助生成
      if (!globalSettings.enableAssistantGeneration) {
        message.warning(t('actionTask.assistantNotEnabled'));
        return;
      }

      // 获取当前表单的任务名称和行动空间
      const values = form.getFieldsValue(['title', 'action_space_id']);

      if (!values.title) {
        message.warning(t('actionTask.fillNameFirst'));
        return;
      }

      if (!values.action_space_id) {
        message.warning(t('actionTask.selectSpaceFirst'));
        return;
      }

      setAssistantGenerating(true);

      // 获取行动空间详细信息
      const actionSpace = actionSpaces.find(space => space.id === values.action_space_id);
      if (!actionSpace) {
        message.error(t('actionTask.spaceNotFound'));
        return;
      }

      // 获取行动空间内的角色信息
      let roles = [];
      if (selectedActionSpace && selectedActionSpace.roles && selectedActionSpace.roles.length > 0) {
        roles = selectedActionSpace.roles;
      }

      // 获取系统设置的提示词模板
      let promptTemplate;
      try {
        const templates = await settingsAPI.getPromptTemplates();
        promptTemplate = templates.actionTaskDescription;
        if (!promptTemplate) {
          throw new Error('未获取到任务描述生成模板');
        }
      } catch (error) {
        console.error('获取提示词模板失败:', error);
        message.error(t('actionTask.templateFailed'));
        setAssistantGenerating(false);
        return;
      }

      // 使用模板变量替换功能
      const generatePrompt = replaceTemplateVariables(promptTemplate, {
        title: values.title,
        action_space_name: actionSpace.name,
        action_space_description: actionSpace.description || '无描述',
        roles: formatRolesForTemplate(roles)
      });

      // 确定使用的模型
      const modelToUse = await getAssistantGenerationModelId(modelConfigs, globalSettings.assistantGenerationModel);

      // 调用模型API生成描述
      let generatedDescription = '';
      const handleStreamResponse = (chunk) => {
        // 过滤掉null、undefined和空字符串
        if (chunk && chunk !== 'null' && chunk !== 'undefined' && typeof chunk === 'string') {
          generatedDescription += chunk;
          // 实时更新表单中的任务描述字段
          form.setFieldsValue({
            description: generatedDescription
          });
        }
      };

      await modelConfigAPI.testModelStream(
        modelToUse,
        generatePrompt,
        handleStreamResponse,
        "你是一个专业的任务规划专家，擅长根据行动空间信息和任务名称生成详细的任务描述。",
        {
          temperature: 0.7,
          max_tokens: 1000
        }
      );

      // 最终清理生成的内容，移除可能的null字符串
      const cleanedDescription = generatedDescription
        .replace(/null/g, '')
        .replace(/undefined/g, '')
        .trim();

      form.setFieldsValue({
        description: cleanedDescription
      });

      message.success(t('actionTask.assistantGenerateDesc'));
    } catch (error) {
      console.error('辅助生成失败:', error);
      message.error(`${t('actionTask.assistantFailed')}: ${error.message || t('message.unknownError')}`);
    } finally {
      setAssistantGenerating(false);
    }
  };

  // 处理行动空间变更
  const handleActionSpaceChange = async (spaceId) => {
    if (!spaceId) {
      setSelectedActionSpace(null);
      // 清空规则集选择
      form.setFieldsValue({ rule_set_id: [] });
      return;
    }

    try {
      // 获取行动空间详情
      const spaceDetail = await actionSpaceAPI.getDetail(spaceId);
      setSelectedActionSpace(spaceDetail);

      // 筛选该行动空间的规则集
      const spaceRuleSets = ruleSets.filter(rs => rs.action_space_id === spaceId);

      // 如果找到了规则集，自动选中它们
      if (spaceRuleSets.length > 0) {
        const ruleSetIds = spaceRuleSets.map(rs => rs.id);
        form.setFieldsValue({ rule_set_id: ruleSetIds });
        console.log(`自动选择行动空间 ${spaceId} 的 ${ruleSetIds.length} 个规则集`);
      } else {
        // 如果没有找到规则集，清空选择
        form.setFieldsValue({ rule_set_id: [] });
        console.log(`行动空间 ${spaceId} 没有关联的规则集`);
      }
    } catch (error) {
      console.error('获取行动空间详情失败:', error);
      setSelectedActionSpace({
        id: spaceId,
        environment_variables: [],
        roles: []
      });
      message.error(t('actionTask.spaceDetailsFailed'));
    }
  };

  // 网格展示卡片统一样式
  const gridCardStyle = {
    height: '100%',
    minHeight: '300px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column' as const
  };

  const gridCardBodyStyle = {
    padding: '12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const
  };

  // 渲染任务卡片
  const renderTaskCards = (filteredTasks = getFilteredTasks()) => {
    return (
      <Row gutter={[16, 16]}>
        {filteredTasks.map(task => (
          <Col xs={24} sm={12} md={8} lg={6} key={task.id}>
            <Card
              hoverable
              className="task-card"
              style={gridCardStyle}
              styles={{ body: gridCardBodyStyle }}
              actions={[
                <Tooltip title={t('taskCard.viewDetails')}>
                  <EyeOutlined key="view" style={{ color: '#1677ff' }} onClick={() => navigate(`/action-tasks/detail/${task.id}`)} />
                </Tooltip>,
                <Tooltip title="发布">
                  <ShareAltOutlined key="publish" style={{ color: '#52c41a' }} onClick={(e) => handlePublishTask(task, e)} />
                </Tooltip>,
                <Tooltip title={t('taskCard.archiveTask')}>
                  <StopOutlined key="stop" style={{ color: '#faad14' }} onClick={() => handleTerminateTask(task.id)} />
                </Tooltip>,
                <Tooltip title={t('taskCard.deleteTask')}>
                  <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} onClick={(e) => handleDeleteTask(task.id, e)} />
                </Tooltip>,
              ]}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => navigate(`/action-tasks/detail/${task.id}`)}>
                {/* 标题和状态水平对齐 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Title level={5} ellipsis={{ rows: 2 }} style={{ marginTop: 0, marginBottom: 0, flex: 1, marginRight: 8 }}>
                    {task.title}
                  </Title>
                  <div style={{ flexShrink: 0 }}>
                    {task.status === 'active' && (
                      <Badge status="processing" text={t('taskCard.status.active')} />
                    )}

                    {task.status === 'completed' && (
                      <Badge status="success" text={t('taskCard.status.completed')} />
                    )}
                    {task.status === 'terminated' && (
                      <Badge status="error" text={t('taskCard.status.terminated')} />
                    )}
                  </div>
                </div>
                <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                  {task.description || t('taskCard.noDescription')}
                </Paragraph>

                {/* 关键信息区域 - 使用 marginTop: 'auto' 推到底部 */}
                <div className="task-info-section" style={{ marginTop: 'auto' }}>
                  <Divider />
                  <Space orientation="vertical" style={{ width: '100%' }} className="info-content">
                    <div>
                      <GlobalOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                      <Text type="secondary">{t('taskCard.actionSpace')}：</Text>
                      <Text strong style={{ color: '#1677ff' }}>{task.action_space_name || t('taskCard.notSpecified')}</Text>
                    </div>
                    <div>
                      <TeamOutlined style={{ marginRight: 8 }} />
                      <Text type="secondary">{t('taskCard.agents')}：</Text>
                      <Text>{t('taskCard.agentsCount', { count: task.agent_count || 0 })}</Text>
                    </div>
                    <div>
                      <CommentOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                      <Text type="secondary">{t('taskCard.conversations')}：</Text>
                      <Text>{t('taskCard.conversationsCount', { count: task.conversation_count || 0 })}</Text>
                    </div>
                    <div>
                      <MessageOutlined style={{ marginRight: 8 }} />
                      <Text type="secondary">{t('taskCard.messages')}：</Text>
                      <Text>{t('taskCard.messagesCount', { count: task.message_count || 0 })}</Text>
                    </div>
                    <div>
                      <RobotOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                      <Text type="secondary">{t('taskCard.autonomousActions')}：</Text>
                      <Text>
                        {t('taskCard.autonomousActionsCount', {
                          active: task.active_autonomous_task_count || 0,
                          total: task.total_autonomous_task_count || task.autonomous_task_count || 0
                        })}
                      </Text>
                    </div>
                    <div>
                      <ClockCircleOutlined style={{ marginRight: 8 }} />
                      <Text type="secondary">{t('taskCard.createdAt')}：</Text>
                      <Text>{new Date(task.created_at).toLocaleString()}</Text>
                    </div>
                    <div>
                      <UserOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                      <Text type="secondary">{t('taskCard.creator')}：</Text>
                      <Text>{task.creator_display_name || t('taskCard.notSpecified')}</Text>
                    </div>
                    <div>
                      <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
                      <Text type="secondary">{t('taskCard.updatedAt')}：</Text>
                      <Text>{new Date(task.updated_at).toLocaleString()}</Text>
                    </div>
                    <div>
                      <ShareAltOutlined style={{ marginRight: 8, color: task.is_published ? '#52c41a' : 'var(--custom-border)' }} />
                      <Text type="secondary">{t('taskCard.publishStatus')}：</Text>
                      <Text style={{ color: task.is_published ? '#52c41a' : 'var(--custom-text-secondary)' }}>
                        {task.is_published ? t('taskCard.published') : t('taskCard.notPublished')}
                      </Text>
                    </div>
                  </Space>
                </div>
              </div>
            </Card>
          </Col>
        ))}

        {/* 添加新任务卡片 */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            hoverable
            className="add-task-card"
            style={{
              ...gridCardStyle,
              minHeight: '300px',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--custom-border)',
              backgroundColor: 'var(--custom-header-bg)'
            }}
            onClick={showCreateModal}
          >
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <PlusOutlined style={{ fontSize: '48px', color: '#1677ff', marginBottom: '16px' }} />
              <Title level={4} style={{ color: '#1677ff', marginBottom: '8px' }}>
                {t('actionTask.createNew')}
              </Title>
              <Text type="secondary">
                {t('actionTask.clickToCreate')}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: t('actionTask.name'),
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/action-tasks/detail/${record.id}`)}>
          <Text strong>{text}</Text>
        </div>
      ),
    },
    {
      title: t('actionTask.actionSpace'),
      dataIndex: 'action_space_name',
      key: 'action_space_name',
    },
    {
      title: '来源',
      dataIndex: 'user_id',
      key: 'resource_source',
      width: 100,
      render: (user_id, record) => {
        // 系统资源：user_id 为 null
        if (!user_id) {
          return (
            <Tooltip title="系统资源，所有用户可见可用">
              <Tag icon={<GlobalOutlined />} color="blue">
                系统
              </Tag>
            </Tooltip>
          );
        }

        // 用户共享资源：user_id 有值且 is_shared 为 true
        if (record.is_shared) {
          return (
            <Tooltip title="用户共享资源，所有用户可见可用">
              <Tag icon={<TeamOutlined />} color="green">
                共享
              </Tag>
            </Tooltip>
          );
        }

        // 私有资源：user_id 有值且 is_shared 为 false
        return (
          <Tooltip title="私有资源，仅创建者可见">
            <Tag icon={<LockOutlined />} color="orange">
              私有
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('actionTask.status'),
      dataIndex: 'status',
      key: 'status',
      render: status => {
        if (status === 'active') {
          return <Badge status="processing" text={t('status.inProgress')} />;
        } else if (status === 'completed') {
          return <Badge status="success" text={t('status.completed')} />;
        } else if (status === 'terminated') {
          return <Badge status="error" text={t('status.terminated')} />;
        }
        return <Badge status="default" text={t('status.unknown')} />;
      },
    },
    {
      title: t('data.agents'),
      dataIndex: 'agent_count',
      key: 'agent_count',
      render: count => t('data.count', { count: count || 0 }),
    },
    {
      title: t('data.conversations'),
      dataIndex: 'conversation_count',
      key: 'conversation_count',
      render: count => t('data.count', { count: count || 0 }),
    },
    {
      title: t('data.messages'),
      dataIndex: 'message_count',
      key: 'message_count',
      render: count => t('data.messageCount', { count: count || 0 }),
    },
    {
      title: t('data.autonomousActions'),
      dataIndex: 'autonomous_task_count',
      key: 'autonomous_task_count',
      render: (_, record) => {
        const activeCount = record.active_autonomous_task_count || 0;
        const totalCount = record.total_autonomous_task_count || record.autonomous_task_count || 0;
        return t('data.activeTotal', { active: activeCount, total: totalCount });
      },
    },
    {
      title: t('actionTask.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: time => new Date(time).toLocaleString(),
    },
    {
      title: t('data.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: time => new Date(time).toLocaleString(),
    },
    {
      title: t('actionTask.actions'),
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title={t('actionTask.view')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/action-tasks/detail/${record.id}`)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>

          <Tooltip title={t('data.archive')}>
            <Button
              type="text"
              icon={<StopOutlined />}
              danger
              onClick={() => handleTerminateTask(record.id)}
            />
          </Tooltip>
          <Tooltip title={t('actionTask.delete')}>
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              onClick={(e) => handleDeleteTask(record.id, e)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];



  // 归档任务
  const handleTerminateTask = (taskId) => {
    message.success(t('actionTask.archived', { taskId }));
    // 更新状态
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status: 'terminated' } : task
      )
    );
  };

  // 删除任务
  const handleDeleteTask = (taskId, event) => {
    // 阻止事件冒泡，避免触发卡片的点击事件
    if (event) {
      event.stopPropagation();
    }

    // 确认对话框
    Modal.confirm({
      title: t('actionTask.confirmDelete'),
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>{t('actionTask.deleteWarning')}</p>
          <p><b>{t('message.warning')}：</b>{t('actionTask.deleteWarningDetail')}</p>
          <ul>
            <li>{t('actionTask.deleteItems.basic')}</li>
            <li><b>{t('actionTask.deleteItems.actions')}</b></li>
            <li>{t('actionTask.deleteItems.agents')}</li>
            <li>{t('actionTask.deleteItems.environment')}</li>
            <li>{t('actionTask.deleteItems.conversations')}</li>
            <li>{t('actionTask.deleteItems.files')}</li>
          </ul>
        </div>
      ),
      okText: t('button.confirmDelete'),
      okType: 'danger',
      cancelText: t('button.cancel'),
      onOk: async () => {
        try {
          // 调用API删除任务及其所有关联数据，启用强制清理
          const result = await actionTaskAPI.delete(taskId, true, true);

          // 从列表中移除该任务
          setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

          // 显示详细的删除结果消息
          if (result.stopped_autonomous_tasks > 0) {
            message.success(t('actionTask.deleteSuccessWithActions', { count: result.stopped_autonomous_tasks }));
          } else {
            message.success(t('actionTask.deleteSuccess'));
          }
        } catch (error) {
          console.error('删除任务失败:', error);
          message.error(`${t('actionTask.deleteFailed')}: ${error.message || t('message.unknownError')}`);
        }
      }
    });
  };

  // 处理发布任务
  const handlePublishTask = (task, e) => {
    if (e) {
      e.stopPropagation(); // 阻止事件冒泡，避免触发卡片点击
    }
    setCurrentPublishTask(task);
    setPublishModalVisible(true);
  };

  // 渲染创建任务的表单
  const renderCreateForm = () => {
    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleCreateTask}
      >
        <Form.Item
          name="title"
          label={t('actionTask.name')}
          rules={[{ required: true, message: t('actionTask.nameRequired') }]}
        >
          <Input placeholder={t('actionTask.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          name="action_space_id"
          label={t('actionTask.actionSpace')}
          rules={[{ required: true, message: t('actionTask.spaceRequired') }]}
        >
          <Select
            placeholder={t('actionTask.selectSpace')}
            onChange={handleActionSpaceChange}
            loading={loadingResources}
          >
            {actionSpaces.map(space => (
              <Select.Option key={space.id} value={space.id}>
                {space.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="rule_set_id"
          label="规则集"
          rules={[{ required: true, message: '请至少选择一个规则集' }]}
        >
          <Select
            mode="multiple"
            placeholder="请选择规则集"
            loading={loadingRuleSets}
            style={{ width: '100%' }}
          >
            {ruleSets.map(ruleSet => (
              <Select.Option key={ruleSet.id} value={ruleSet.id}>
                {ruleSet.name}{ruleSet.action_space_name ? ` (${ruleSet.action_space_name})` : ''}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="description"
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('actionTask.description')}</span>
              <Button
                type="link"
                icon={<RobotOutlined />}
                loading={assistantGenerating}
                onClick={handleAssistantGenerate}
                style={{
                  padding: '0 8px',
                  height: 'auto',
                  fontSize: '12px'
                }}
              >
                {t('actionTask.assistantGenerate')}
              </Button>
            </div>
          }
        >
          <Input.TextArea
            placeholder={t('actionTask.descPlaceholder')}
            rows={4}
            style={{
              borderColor: assistantGenerating ? '#52c41a' : undefined,
              boxShadow: assistantGenerating ? '0 0 0 2px rgba(82, 196, 26, 0.2)' : undefined
            }}
          />
        </Form.Item>

        <Form.Item
          name="is_shared"
          valuePropName="checked"
          tooltip="勾选后，该行动任务将对所有用户可见可用（但只有创建者可编辑）"
        >
          <Checkbox>
            <Space>
              <TeamOutlined />
              共享给所有用户
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={createLoading}>
            {t('actionTask.create')}
          </Button>
        </Form.Item>
      </Form>
    );
  };

  return (
    <div className="action-task-overview-container">
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('actionTask.title')}</Title>
            <Text type="secondary">
              {t('actionTask.subtitle')}
            </Text>
          </div>
          <Space>
            <Input
              placeholder={t('actionTask.search')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 250 }}
            />
            <Space.Compact>
              <Button type="primary" onClick={showCreateModal}>
                <PlusOutlined /> {t('actionTask.create')}
              </Button>
              <Dropdown
                trigger={['hover', 'click']}
                menu={{
                  items: [
                    {
                      key: 'oneClick',
                      label: t('home.oneClickCreate'),
                      icon: <ThunderboltOutlined />,
                      onClick: () => setOneClickModalVisible(true)
                    }
                  ]
                }}
              >
                <Button type="primary" icon={<DownOutlined />} />
              </Dropdown>
            </Space.Compact>
          </Space>
        </div>
      </div>

      {loading ? (
          <div>
            {/* 标签栏骨架屏 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Space>
                <Skeleton.Button active style={{ width: 80 }} />
                <Skeleton.Button active style={{ width: 80 }} />
                <Skeleton.Button active style={{ width: 80 }} />
              </Space>
              <Skeleton.Button active style={{ width: 120 }} />
            </div>

            {/* 任务卡片骨架屏 */}
            <Row gutter={[16, 16]}>
              {[1, 2, 3, 4, 5, 6].map(item => (
                <Col xs={24} sm={12} md={8} lg={6} key={item}>
                  <Card
                    style={gridCardStyle}
                  >
                    <Skeleton active avatar paragraph={{ rows: 4 }} />
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ) : (
          <Tabs
            defaultActiveKey="all"
            tabBarExtraContent={
              <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { label: t('taskCard.cardView'), value: 'card', icon: <AppstoreOutlined /> },
                  { label: t('taskCard.tableView'), value: 'table', icon: <OrderedListOutlined /> }
                ]}
              />
            }
            items={[
            {
              key: 'all',
              label: t('taskCard.allTasks'),
              children: viewMode === 'card' ? renderTaskCards() : (
                <Table
                  rowSelection={{
                    type: 'checkbox',
                    onChange: (selectedRowKeys) => setSelectedTasks(selectedRowKeys),
                    selectedRowKeys: selectedTasks,
                  }}
                  columns={columns}
                  dataSource={getFilteredTasks()}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              )
            },
            {
              key: 'active',
              label: t('taskCard.activeTasks'),
              children: viewMode === 'card' ?
                renderTaskCards(getFilteredTasks().filter(t => t.status === 'active')) :
                <Table
                  rowSelection={{
                    type: 'checkbox',
                    onChange: (selectedRowKeys) => setSelectedTasks(selectedRowKeys),
                    selectedRowKeys: selectedTasks,
                  }}
                  columns={columns}
                  dataSource={getFilteredTasks().filter(t => t.status === 'active')}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
            },

            {
              key: 'completed',
              label: t('taskCard.completedTasks'),
              children: viewMode === 'card' ?
                renderTaskCards(getFilteredTasks().filter(t => t.status === 'completed')) :
                <Table
                  rowSelection={{
                    type: 'checkbox',
                    onChange: (selectedRowKeys) => setSelectedTasks(selectedRowKeys),
                    selectedRowKeys: selectedTasks,
                  }}
                  columns={columns}
                  dataSource={getFilteredTasks().filter(t => t.status === 'completed')}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
            }
          ]}
      />
      )}

      {/* 创建任务模态框 */}
      <Modal
        title={t('actionTask.createNewTask')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        {renderCreateForm()}
      </Modal>

      {/* 发布任务模态框 */}
      {currentPublishTask && (
        <PublishModal
          visible={publishModalVisible}
          onCancel={() => {
            setPublishModalVisible(false);
            setCurrentPublishTask(null);
          }}
          task={currentPublishTask}
        />
      )}

      {/* 一键创建模态框 */}
      <OneClickModal
        visible={oneClickModalVisible}
        onCancel={() => setOneClickModalVisible(false)}
        onSuccess={(data) => {
          setOneClickModalVisible(false);
          // 刷新任务列表或跳转到新任务
          if (data?.task?.id) {
            navigate(`/action-tasks/detail/${data.task.id}`);
          } else {
            window.location.reload();
          }
        }}
      />
    </div>
  );
};

export default ActionTaskOverview;