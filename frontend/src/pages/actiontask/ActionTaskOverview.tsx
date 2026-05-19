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
// TabPane is no longer used; use the items prop instead

const ActionTaskOverview = () => {
  const { t } = useTranslation();
  // Use message from App context
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

  // publish state
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [currentPublishTask, setCurrentPublishTask] = useState(null);

  // one-click creation state
  const [oneClickModalVisible, setOneClickModalVisible] = useState(false);

  // assistant generation state
  const [assistantGenerating, setAssistantGenerating] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    enableAssistantGeneration: true,
    assistantGenerationModel: 'default'
  });
  const [modelConfigs, setModelConfigs] = useState([]);

  // Fetch global settings
  const fetchGlobalSettings = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      setGlobalSettings({
        enableAssistantGeneration: settings.enableAssistantGeneration !== undefined ? settings.enableAssistantGeneration : true,
        assistantGenerationModel: settings.assistantGenerationModel || 'default'
      });
    } catch (error) {
      console.error('fetch global settings failed:', error);
    }
  };

  // Fetch model configs
  const fetchModelConfigs = async () => {
    try {
      const configs = await modelConfigAPI.getAll();
      setModelConfigs(configs);
    } catch (error) {
      console.error('fetch model configs failed:', error);
    }
  };

  // filter menu removed

  useEffect(() => {
    // Fetch data once on initial load
    const initialDataFetch = async () => {
      setLoading(true); // set global loading state

      try {
        // Fetch action space list
        let allActionSpaces = [];
        try {
          const actionSpacesResponse = await actionSpaceAPI.getAll();
          if (actionSpacesResponse && Array.isArray(actionSpacesResponse)) {
            allActionSpaces = actionSpacesResponse;
            setActionSpaces(allActionSpaces);
            console.log('action space list loaded', allActionSpaces.length, 'action spaces');

            // Extract rule sets from action spaces
            try {
              const extractedRuleSets = await actionSpaceAPI.getRuleSets(null, allActionSpaces);
              setRuleSets(extractedRuleSets);
            } catch (ruleSetsError) {
              console.error('extract rule sets failed:', ruleSetsError);
            }
          }
        } catch (spaceError) {
          console.error('fetch action space list failed:', spaceError);
        }

        // Fetch task data
        let apiTasks = [];
        try {
          const response = await actionTaskAPI.getAll();
          if (response && Array.isArray(response) && response.length > 0) {
            apiTasks = response.map(task => {
              // Find matching action space name
              let actionSpaceName = task.action_space_name;
              if (!actionSpaceName && task.action_space_id) {
                const matchedSpace = allActionSpaces.find(space => space.id === task.action_space_id);
                actionSpaceName = matchedSpace?.name || t('actionTask.unknownSpace');
              } else if (!actionSpaceName) {
                actionSpaceName = t('actionTask.unassignedSpace');
              }
              return {
                ...task,
                action_space_name: actionSpaceName,
                is_api: true
              };
            });
            console.log('API action task data loaded', apiTasks.length, 'records');
          }
        } catch (apiError) {
          console.error('fetch API action tasks failed:', apiError);
          message.warning(t('actionTask.loadFailed'));
        }

        // Set task data
        setTasks(apiTasks);

        if (apiTasks.length > 0) {
          message.success(t('actionTask.tasksLoaded', { count: apiTasks.length }));
        } else {
          message.info(t('actionTask.noTaskData'));
        }
      } catch (error) {
        console.error('data loading failed:', error);
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

  // Refresh task list if data needs reloading
  const refreshTasks = async () => {
    // Implement refresh logic if needed
    message.info(t('actionTask.refreshNotImplemented'));
  };

  // Load agent and action space data
  const loadResources = async () => {
    setLoadingResources(true);
    try {
      // Fetch all roles
      const rolesData = await roleAPI.getAll();
      setAgents(rolesData);

      // Fetch action space list
      const actionSpacesData = await actionSpaceAPI.getAll();
      setActionSpaces(actionSpacesData);
    } catch (error) {
      message.error(t('actionTask.loadResourcesFailed'));
      console.error('load resources failed:', error);
    } finally {
      setLoadingResources(false);
    }
  };

  // Open create-task modal
  const showCreateModal = () => {
    setModalVisible(true);
    // Reset form
    form.resetFields();
    // Load required resources
    loadResources();
  };

  // Create new task
  const handleCreateTask = async (values) => {
    setCreateLoading(true);
    try {
      // Manual agent creation is no longer needed; backend creates participants and supervisors from action-space roles
      // Role-to-agent creation is handled by the backend

      // Keep an empty agentIds array for legacy compatibility
      const agentIds = [];

      // Get selected rule set IDs
      const ruleSetIds = values.rule_set_id || [];

      // Use the first rule set as primary, or null if none selected
      const primaryRuleSetId = ruleSetIds.length > 0 ? ruleSetIds[0] : null;

      // Build request payload
      const taskData = {
        title: values.title,
        description: values.description || '',
        mode: 'sequential', // default to sequential mode
        action_space_id: values.action_space_id,
        rule_set_id: primaryRuleSetId, // primary rule set
        additional_rule_set_ids: ruleSetIds.slice(1), // additional rule sets
        agent_ids: agentIds  // add agent ID list
      };

      console.log('create action task payload:', taskData);

      // Call API to create task
      const response = await actionTaskAPI.create(taskData);

      // Add to list
      if (response && response.id) {
        message.success(t('actionTask.createSuccess'));
        setModalVisible(false);

        // Find action space name
        const actionSpace = actionSpaces.find(space => space.id === values.action_space_id);
        const actionSpaceName = actionSpace ? actionSpace.name : t('actionTask.unknownSpace');

        // Build new task object aligned with API format
        const newTask = {
          id: response.id,
          title: response.title,
          description: values.description || '',
          status: 'active',
          mode: 'sequential', // default to sequential mode
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
          // Use API-returned environment variables or fetch them from task details
          environment_variables: response.environment_variables || [],
          rule_triggers: [],
          is_api: true,  // mark as API data
          agent_ids: agentIds  // add agent ID list
        };

        // Prepend the newly created task
        setTasks(prev => [newTask, ...prev]);

        console.log('added newly created task to list:', newTask);

        // Navigate to task details
        setTimeout(() => {
          navigate(`/action-tasks/detail/${response.id}`);
        }, 500);
      }
    } catch (error: any) {
      // Check quota errors
      if (error.response?.status === 403 && error.response?.data?.quota) {
        message.error(t('actionTask.quotaExceeded', { message: error.response.data.message || t('actionTask.quotaDefault') }));
      } else {
        message.error(`${t('actionTask.createFailed')}: ${error.message || t('message.tryAgainLater')}`);
      }
      console.error('create action task failed:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  // Filter task data
  const getFilteredTasks = () => {
    // Filter out tasks cloned from parallel experiments first
    let filteredTasks = tasks.filter(task => !task.is_experiment_clone);
    
    // Then filter by search text
    if (searchText) {
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchText.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchText.toLowerCase())) ||
        (task.action_space_name && task.action_space_name.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    // Sort by created time descending
    return filteredTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Generate task description with assistant
  const handleAssistantGenerate = async () => {
    try {
      // Check whether assistant generation is enabled
      if (!globalSettings.enableAssistantGeneration) {
        message.warning(t('actionTask.assistantNotEnabled'));
        return;
      }

      // Get task name and action space from the form
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

      // Get action space details
      const actionSpace = actionSpaces.find(space => space.id === values.action_space_id);
      if (!actionSpace) {
        message.error(t('actionTask.spaceNotFound'));
        return;
      }

      // Get roles in the action space
      let roles = [];
      if (selectedActionSpace && selectedActionSpace.roles && selectedActionSpace.roles.length > 0) {
        roles = selectedActionSpace.roles;
      }

      // Get prompt template from system settings
      let promptTemplate;
      try {
        const templates = await settingsAPI.getPromptTemplates();
        promptTemplate = templates.actionTaskDescription;
        if (!promptTemplate) {
          throw new Error(t('actionTask.templateNotFound'));
        }
      } catch (error) {
        console.error('fetch prompt template failed:', error);
        message.error(t('actionTask.templateFailed'));
        setAssistantGenerating(false);
        return;
      }

      // Replace template variables
      const generatePrompt = replaceTemplateVariables(promptTemplate, {
        title: values.title,
        action_space_name: actionSpace.name,
        action_space_description: actionSpace.description || t('taskCard.noDescription'),
        roles: formatRolesForTemplate(roles)
      });

      // Determine model to use
      const modelToUse = await getAssistantGenerationModelId(modelConfigs, globalSettings.assistantGenerationModel);

      // Call model API to generate description
      let generatedDescription = '';
      const handleStreamResponse = (chunk) => {
        // Filter null, undefined, and empty chunks
        if (chunk && chunk !== 'null' && chunk !== 'undefined' && typeof chunk === 'string') {
          generatedDescription += chunk;
          // Update task description field in real time
          form.setFieldsValue({
            description: generatedDescription
          });
        }
      };

      await modelConfigAPI.testModelStream(
        modelToUse,
        generatePrompt,
        handleStreamResponse,
        "You are a professional task planner who generates detailed task descriptions from action-space information and task names.",
        {
          temperature: 0.7,
          max_tokens: 1000
        }
      );

      // Clean generated content and remove possible null strings
      const cleanedDescription = generatedDescription
        .replace(/null/g, '')
        .replace(/undefined/g, '')
        .trim();

      form.setFieldsValue({
        description: cleanedDescription
      });

      message.success(t('actionTask.assistantGenerateDesc'));
    } catch (error) {
      console.error('assistant generation failed:', error);
      message.error(`${t('actionTask.assistantFailed')}: ${error.message || t('message.unknownError')}`);
    } finally {
      setAssistantGenerating(false);
    }
  };

  // Handle action space changes
  const handleActionSpaceChange = async (spaceId) => {
    if (!spaceId) {
      setSelectedActionSpace(null);
      // Clear rule set selection
      form.setFieldsValue({ rule_set_id: [] });
      return;
    }

    try {
      // Get action space details
      const spaceDetail = await actionSpaceAPI.getDetail(spaceId);
      setSelectedActionSpace(spaceDetail);

      // Filter rule sets for this action space
      const spaceRuleSets = ruleSets.filter(rs => rs.action_space_id === spaceId);

      // Auto-select rule sets if found
      if (spaceRuleSets.length > 0) {
        const ruleSetIds = spaceRuleSets.map(rs => rs.id);
        form.setFieldsValue({ rule_set_id: ruleSetIds });
        console.log(`auto-selected ${ruleSetIds.length} rule sets for action space ${spaceId}`);
      } else {
        // Clear selection if no rule set was found
        form.setFieldsValue({ rule_set_id: [] });
        console.log(`action space ${spaceId} has no associated rule sets`);
      }
    } catch (error) {
      console.error('fetch action space details failed:', error);
      setSelectedActionSpace({
        id: spaceId,
        environment_variables: [],
        roles: []
      });
      message.error(t('actionTask.spaceDetailsFailed'));
    }
  };

  // Shared grid card style
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

  // Render task cards
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
                <Tooltip title={t('taskCard.publish')}>
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
                {/* align title and status horizontally */}
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

                {/* key info area; marginTop auto pushes it to the bottom */}
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

        {/* add new task card */}
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

  // Table column definitions
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
      title: t('actionTask.source'),
      dataIndex: 'user_id',
      key: 'resource_source',
      width: 100,
      render: (user_id, record) => {
        // system resource: user_id is null
        if (!user_id) {
          return (
            <Tooltip title={t('actionTask.source.systemTip')}>
              <Tag icon={<GlobalOutlined />} color="blue">
                {t('actionTask.source.system')}
              </Tag>
            </Tooltip>
          );
        }

        // shared user resource: user_id exists and is_shared is true
        if (record.is_shared) {
          return (
            <Tooltip title={t('actionTask.source.sharedTip')}>
              <Tag icon={<TeamOutlined />} color="green">
                {t('actionTask.source.shared')}
              </Tag>
            </Tooltip>
          );
        }

        // private resource: user_id exists and is_shared is false
        return (
          <Tooltip title={t('actionTask.source.privateTip')}>
            <Tag icon={<LockOutlined />} color="orange">
              {t('actionTask.source.private')}
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



  // Archive task
  const handleTerminateTask = (taskId) => {
    message.success(t('actionTask.archived', { taskId }));
    // Update status
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status: 'terminated' } : task
      )
    );
  };

  // Delete task
  const handleDeleteTask = (taskId, event) => {
    // Stop event propagation to avoid triggering card click
    if (event) {
      event.stopPropagation();
    }

    // Confirmation dialog
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
          // Delete task and related data via API with force cleanup enabled
          const result = await actionTaskAPI.delete(taskId, true, true);

          // Remove task from list
          setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

          // Show detailed delete result
          if (result.stopped_autonomous_tasks > 0) {
            message.success(t('actionTask.deleteSuccessWithActions', { count: result.stopped_autonomous_tasks }));
          } else {
            message.success(t('actionTask.deleteSuccess'));
          }
        } catch (error) {
          console.error('delete task failed:', error);
          message.error(`${t('actionTask.deleteFailed')}: ${error.message || t('message.unknownError')}`);
        }
      }
    });
  };

  // Handle task publishing
  const handlePublishTask = (task, e) => {
    if (e) {
      e.stopPropagation(); // stop propagation to avoid card click
    }
    setCurrentPublishTask(task);
    setPublishModalVisible(true);
  };

  // Render create-task form
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
          label={t('actionTask.ruleSet')}
          rules={[{ required: true, message: t('actionTask.ruleSetRequired') }]}
        >
          <Select
            mode="multiple"
            placeholder={t('actionTask.selectRuleSet')}
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
          tooltip={t('actionTask.shareTooltip')}
        >
          <Checkbox>
            <Space>
              <TeamOutlined />
              {t('actionTask.shareAll')}
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
            {/* tab bar skeleton */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Space>
                <Skeleton.Button active style={{ width: 80 }} />
                <Skeleton.Button active style={{ width: 80 }} />
                <Skeleton.Button active style={{ width: 80 }} />
              </Space>
              <Skeleton.Button active style={{ width: 120 }} />
            </div>

            {/* task card skeleton */}
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

      {/* create task modal */}
      <Modal
        title={t('actionTask.createNewTask')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        {renderCreateForm()}
      </Modal>

      {/* publish task modal */}
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

      {/* one-click creation modal */}
      <OneClickModal
        visible={oneClickModalVisible}
        onCancel={() => setOneClickModalVisible(false)}
        onSuccess={(data) => {
          setOneClickModalVisible(false);
          // Refresh task list or navigate to the new task
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