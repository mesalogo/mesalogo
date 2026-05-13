import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Skeleton,
  Card,
  Input,
  Select,
  Row,
  Col,
  Progress,
  Modal,
  Tabs,
  Descriptions,
  Tooltip,
  Badge,
  Empty,
  Form,
  App
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CopyOutlined,
  SearchOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  BarChartOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';
import ExperimentDesign from './ExperimentDesign';
import AnalysisReport from './AnalysisReport';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { modelConfigAPI } from '../../../services/api/model';
import { settingsAPI } from '../../../services/api/settings';

const { Title, Text } = Typography;

const ExperimentListPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Modal 状态
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('detail');

  // 创建实验 Modal 状态（简化版，只填基础信息）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [actionSpaces, setActionSpaces] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [experimentConfig, setExperimentConfig] = useState({ name: '', description: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // 实验编辑模式状态
  const [isEditMode, setIsEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // 模型和全局设置
  const [models, setModels] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({});

  const loadExperiments = useCallback(async () => {
    try {
      const response = await parallelExperimentApi.listExperiments({ include_templates: true });
      if (response.success && response.experiments) {
        setExperiments(response.experiments);
      }
    } catch (error) {
      console.error('加载实验列表失败:', error);
      message.error('加载实验列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActionSpaces = useCallback(async () => {
    try {
      const spaces = await actionSpaceAPI.getAll();
      setActionSpaces(spaces.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        variables: s.environment_variables?.map((v: any) => v.name) || []
      })));
    } catch (error) {
      console.error('加载行动空间失败:', error);
    }
  }, []);

  // 加载模型和全局设置
  const loadModelsAndSettings = useCallback(async () => {
    try {
      const [modelsData, settingsData] = await Promise.all([
        modelConfigAPI.getAll(),
        settingsAPI.getSettings()
      ]);
      setModels(modelsData || []);
      setGlobalSettings({
        enableAssistantGeneration: settingsData?.enable_assistant_generation !== false,
        assistantGenerationModel: settingsData?.assistant_generation_model || 'default'
      });
    } catch (error) {
      console.error('加载模型和设置失败:', error);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
    loadActionSpaces();
    loadModelsAndSettings();
  }, [loadExperiments, loadActionSpaces, loadModelsAndSettings]);

  // 打开实验详情 Modal
  const handleOpenExperiment = async (exp: any) => {
    // 从后端获取最新的实验数据，确保 config 是最新的
    try {
      const response = await parallelExperimentApi.getExperiment(exp.id);
      const latestExp = response.experiment || exp;
      setSelectedExperiment(latestExp);
      // 除运行中状态外都可编辑
      setIsEditMode(latestExp.status !== 'running' && !latestExp.is_template);
      setActiveTab(latestExp.status === 'created' && !latestExp.is_template ? 'design' : 'detail');
      setModalVisible(true);
    } catch (error) {
      console.error('获取实验详情失败:', error);
      // 降级使用列表中的数据
      setSelectedExperiment(exp);
      setIsEditMode(exp.status !== 'running' && !exp.is_template);
      setActiveTab(exp.status === 'created' && !exp.is_template ? 'design' : 'detail');
      setModalVisible(true);
    }
  };

  // 复制实验
  const handleClone = async (id: string, name: string, isTemplate: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const response = await parallelExperimentApi.cloneExperiment(id, `${name} - 副本`);
      if (response.success) {
        message.success(isTemplate ? '已基于模板创建实验' : '实验复制成功');
        loadExperiments();
        setModalVisible(false);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '复制失败');
    }
  };

  // 停止实验
  const handleStop = async (id: string) => {
    try {
      const response = await parallelExperimentApi.stopExperiment(id);
      if (response.success) {
        message.success('实验已停止');
        loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '停止失败');
    }
  };

  // 暂停实验
  const handlePause = async (id: string) => {
    try {
      const response = await parallelExperimentApi.pauseExperiment(id);
      if (response.success) {
        message.success('实验已暂停');
        loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '暂停失败');
    }
  };

  // 恢复实验
  const handleResume = async (id: string) => {
    try {
      const response = await parallelExperimentApi.resumeExperiment(id);
      if (response.success) {
        message.success('实验已恢复');
        loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '恢复失败');
    }
  };

  // 删除实验
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个实验吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await parallelExperimentApi.deleteExperiment(id);
          if (response.success) {
            message.success('实验已删除');
            setModalVisible(false);
            loadExperiments();
          }
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  // 创建草稿实验（仅基础信息）
  const handleCreateDraftExperiment = async () => {
    if (!selectedSpace || !experimentConfig.name) {
      message.warning('请选择行动空间并填写实验名称');
      return;
    }
    setCreateLoading(true);
    try {
      const response = await parallelExperimentApi.createDraftExperiment({
        name: experimentConfig.name,
        description: experimentConfig.description,
        source_action_space_id: selectedSpace
      });
      if (response.success) {
        message.success('实验创建成功，请继续配置实验参数');
        setCreateModalVisible(false);
        setExperimentConfig({ name: '', description: '' });
        setSelectedSpace(null);
        await loadExperiments();
        // 打开新创建的实验进行编辑
        const newExp = experiments.find(e => e.id === response.id) ||
          (await parallelExperimentApi.getExperiment(response.id)).experiment;
        if (newExp) {
          setSelectedExperiment(newExp);
          setIsEditMode(true);
          setActiveTab('design');
          setModalVisible(true);
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建实验失败');
    } finally {
      setCreateLoading(false);
    }
  };

  // 保存实验配置（不启动）
  const handleSaveExperimentConfig = async (config: any) => {
    if (!selectedExperiment) return;
    setEditLoading(true);
    try {
      const taskConfig = config?.task_config || {};
      const updateConfig = {
        experiment_type: config?.experiment_type || 'comparative',
        variables: config?.variables || {},
        objectives: config?.objectives || [],
        stop_conditions: config?.stopConditions || [],
        custom_variables: config?.customVariables || [],
        experiment_protocol: config?.experiment_protocol || '',
        task_config: {
          type: (taskConfig.type || 'discussion') as 'discussion' | 'conditional_stop',
          rounds: taskConfig.rounds || 3,
          topic: taskConfig.topic || '',
          totalTasks: taskConfig.totalTasks || 3,
          maxConcurrent: taskConfig.maxConcurrent || 3,
          singleTaskTimeout: taskConfig.singleTaskTimeout ?? 60
        }
      };
      const response = await parallelExperimentApi.updateExperiment(selectedExperiment.id, updateConfig);
      if (response.success) {
        message.success('配置已保存');
        await loadExperiments();
        // 更新 selectedExperiment
        const updated = (await parallelExperimentApi.getExperiment(selectedExperiment.id)).experiment;
        setSelectedExperiment(updated);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存配置失败');
    } finally {
      setEditLoading(false);
    }
  };

  // 启动实验（从详情页）
  const handleStartExperiment = async () => {
    if (!selectedExperiment) return;
    // 验证主题是否填写
    const taskConfig = selectedExperiment.config?.task_config;
    if (!taskConfig?.topic || taskConfig.topic.trim() === '') {
      message.warning('请先在实验设计中填写讨论主题');
      setActiveTab('design');
      return;
    }
    setEditLoading(true);
    try {
      const response = await parallelExperimentApi.startExperiment(selectedExperiment.id);
      if (response.success) {
        message.success('实验已启动');
        setIsEditMode(false);
        setModalVisible(false);
        // 跳转到执行监控页面
        navigate('/parallel-lab/monitoring');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '启动实验失败');
    } finally {
      setEditLoading(false);
    }
  };

  // 从列表启动实验
  const handleStartExpFromList = async (expId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // 先获取实验详情检查主题
    try {
      const expDetail = await parallelExperimentApi.getExperiment(expId);
      const taskConfig = expDetail.experiment?.config?.task_config;
      if (!taskConfig?.topic || taskConfig.topic.trim() === '') {
        message.warning('请先配置讨论主题');
        // 打开实验详情进行编辑
        handleOpenExperiment(expDetail.experiment);
        return;
      }
      const response = await parallelExperimentApi.startExperiment(expId);
      if (response.success) {
        message.success('实验已启动');
        // 跳转到执行监控页面
        navigate('/parallel-lab/monitoring');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '启动实验失败');
    }
  };

  // 过滤实验
  const filteredExperiments = experiments.filter(exp => {
    const matchSearch = !searchText ||
      exp.name.toLowerCase().includes(searchText.toLowerCase()) ||
      exp.description?.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = !statusFilter ||
      (statusFilter === 'template' ? exp.is_template : exp.status === statusFilter);
    return matchSearch && matchStatus;
  });

  // 渲染状态
  const renderStatus = (exp: any) => {
    if (exp.is_template) {
      return null; // 模板标签已在右上角显示
    }
    const statusMap: Record<string, { status: any; text: string }> = {
      created: { status: 'default', text: '已创建' },
      running: { status: 'processing', text: '运行中' },
      paused: { status: 'warning', text: '已暂停' },
      completed: { status: 'success', text: '已完成' },
      failed: { status: 'error', text: '失败' },
      stopped: { status: 'default', text: '已停止' }
    };
    const config = statusMap[exp.status] || { status: 'default', text: exp.status };
    return <Badge status={config.status} text={config.text} />;
  };

  // 渲染进度
  const renderProgress = (exp: any) => {
    if (exp.is_template) return null;
    const total = exp.total_runs || 0;
    const completed = (exp.completed_runs || 0) + (exp.failed_runs || 0);
    if (total === 0) return null;
    const percent = Math.round((completed / total) * 100);
    return (
      <div style={{ marginTop: 8 }}>
        <Progress percent={percent} size="small" format={() => `${completed}/${total}`} />
      </div>
    );
  };

  // 渲染卡片操作
  const renderCardActions = (exp: any) => {
    if (exp.is_template) {
      return [
        <Tooltip title="查看详情" key="view">
          <EyeOutlined style={{ color: '#1677ff' }} onClick={() => handleOpenExperiment(exp)} />
        </Tooltip>,
        <Tooltip title="使用模板" key="use">
          <CopyOutlined style={{ color: '#722ed1' }} onClick={(e) => handleClone(exp.id, exp.name, true, e)} />
        </Tooltip>
      ];
    }

    const actions = [
      <Tooltip title="查看详情" key="view">
        <EyeOutlined style={{ color: '#1677ff' }} onClick={() => handleOpenExperiment(exp)} />
      </Tooltip>
    ];

    // created 状态：显示启动按钮
    if (exp.status === 'created') {
      actions.push(
        <Tooltip title="启动实验" key="start">
          <PlayCircleOutlined style={{ color: '#52c41a' }} onClick={(e) => { e.stopPropagation(); handleStartExpFromList(exp.id); }} />
        </Tooltip>
      );
    } else if (exp.status === 'running') {
      actions.push(
        <Tooltip title="暂停" key="pause">
          <PauseCircleOutlined style={{ color: '#faad14' }} onClick={(e) => { e.stopPropagation(); handlePause(exp.id); }} />
        </Tooltip>,
        <Tooltip title="停止" key="stop">
          <StopOutlined style={{ color: '#ff4d4f' }} onClick={(e) => { e.stopPropagation(); handleStop(exp.id); }} />
        </Tooltip>
      );
    } else if (exp.status === 'paused') {
      actions.push(
        <Tooltip title="恢复" key="resume">
          <PlayCircleOutlined style={{ color: '#52c41a' }} onClick={(e) => { e.stopPropagation(); handleResume(exp.id); }} />
        </Tooltip>,
        <Tooltip title="停止" key="stop">
          <StopOutlined style={{ color: '#ff4d4f' }} onClick={(e) => { e.stopPropagation(); handleStop(exp.id); }} />
        </Tooltip>
      );
    } else if (['completed', 'stopped', 'failed'].includes(exp.status)) {
      // completed / stopped / failed 状态：可以重新执行
      actions.push(
        <Tooltip title={`重新执行 (第 ${(exp.current_iteration || 0) + 1} 轮)`} key="restart">
          <PlayCircleOutlined style={{ color: '#52c41a' }} onClick={(e) => { e.stopPropagation(); handleStartExpFromList(exp.id); }} />
        </Tooltip>,
        <Tooltip title="复制" key="clone">
          <CopyOutlined style={{ color: '#722ed1' }} onClick={(e) => handleClone(exp.id, exp.name, false, e)} />
        </Tooltip>,
        <Tooltip title="删除" key="delete">
          <DeleteOutlined style={{ color: '#ff4d4f' }} onClick={(e) => handleDelete(exp.id, e)} />
        </Tooltip>
      );
    } else {
      // created 状态
      actions.push(
        <Tooltip title="复制" key="clone">
          <CopyOutlined style={{ color: '#722ed1' }} onClick={(e) => handleClone(exp.id, exp.name, false, e)} />
        </Tooltip>,
        <Tooltip title="删除" key="delete">
          <DeleteOutlined style={{ color: '#ff4d4f' }} onClick={(e) => handleDelete(exp.id, e)} />
        </Tooltip>
      );
    }

    return actions;
  };

  // 更新实验基本信息
  const handleUpdateBasicInfo = async (name: string, description: string) => {
    if (!selectedExperiment) return;
    try {
      await parallelExperimentApi.updateExperiment(selectedExperiment.id, { name, description });
      message.success('基本信息已保存');
      await loadExperiments();
      setSelectedExperiment({ ...selectedExperiment, name, description });
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败');
    }
  };

  // Modal 中的详情 Tab
  const renderDetailTab = () => {
    if (!selectedExperiment) return null;
    const exp = selectedExperiment;
    const canEdit = exp.status !== 'running' && !exp.is_template;

    return (
      <div>
        {/* 可编辑的基本信息 */}
        {canEdit ? (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form layout="vertical">
              <Form.Item label="实验名称" required style={{ marginBottom: 12 }}>
                <Input
                  value={exp.name}
                  onChange={(e) => setSelectedExperiment({ ...exp, name: e.target.value })}
                  placeholder="输入实验名称"
                />
              </Form.Item>
              <Form.Item label="实验描述" required style={{ marginBottom: 12 }}>
                <Input.TextArea
                  value={exp.description || ''}
                  onChange={(e) => setSelectedExperiment({ ...exp, description: e.target.value })}
                  placeholder="描述实验目的（必填）"
                  rows={3}
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Button
                  type="primary"
                  onClick={() => handleUpdateBasicInfo(exp.name, exp.description || '')}
                  disabled={!exp.name || !exp.description}
                >
                  保存基本信息
                </Button>
              </Form.Item>
            </Form>
          </Card>
        ) : null}

        <Descriptions column={2} bordered size="small">
          {!canEdit && <Descriptions.Item label="实验名称">{exp.name}</Descriptions.Item>}
          <Descriptions.Item label="状态">{renderStatus(exp)}</Descriptions.Item>
          {!canEdit && <Descriptions.Item label="描述" span={2}>{exp.description || '-'}</Descriptions.Item>}
          <Descriptions.Item label="行动空间">{exp.source_action_space_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {exp.created_at ? new Date(exp.created_at).toLocaleString() : '-'}
          </Descriptions.Item>
          {!exp.is_template && (
            <>
              <Descriptions.Item label="当前轮次">第 {exp.current_iteration || 0} 轮</Descriptions.Item>
              <Descriptions.Item label="总运行数">{exp.total_runs || 0}</Descriptions.Item>
              <Descriptions.Item label="已完成">{exp.completed_runs || 0}</Descriptions.Item>
              <Descriptions.Item label="失败">{exp.failed_runs || 0}</Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {exp.start_time ? new Date(exp.start_time).toLocaleString() : '-'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {exp.is_template ? (
              <Button type="primary" icon={<CopyOutlined />} onClick={() => handleClone(exp.id, exp.name, true)}>
                使用此模板创建实验
              </Button>
            ) : (
              <>
                {exp.status === 'created' && (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartExperiment} loading={editLoading}>
                    启动实验
                  </Button>
                )}
                {['completed', 'stopped', 'failed'].includes(exp.status) && (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartExperiment} loading={editLoading}>
                    重新执行 (第 {(exp.current_iteration || 0) + 1} 轮)
                  </Button>
                )}
                {exp.status === 'running' && (
                  <>
                    <Button icon={<PauseCircleOutlined />} onClick={() => handlePause(exp.id)}>暂停</Button>
                    <Button danger icon={<StopOutlined />} onClick={() => handleStop(exp.id)}>停止</Button>
                  </>
                )}
                {exp.status === 'paused' && (
                  <>
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleResume(exp.id)}>恢复</Button>
                    <Button danger icon={<StopOutlined />} onClick={() => handleStop(exp.id)}>停止</Button>
                  </>
                )}
                <Button icon={<CopyOutlined />} onClick={() => handleClone(exp.id, exp.name, false)}>复制实验</Button>
                {!['running', 'paused'].includes(exp.status) && (
                  <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(exp.id)}>删除</Button>
                )}
              </>
            )}
          </Space>
        </div>
      </div>
    );
  };

  // 网格展示卡片统一样式
  const gridCardStyle = {
    height: '100%',
    minHeight: '280px',
    borderRadius: '8px',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const
  };

  const gridCardBodyStyle = {
    padding: '12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const
  };

  // 渲染实验卡片
  const renderExperimentCards = () => {
    if (filteredExperiments.length === 0) {
      return <Empty description='暂无实验，点击"创建实验"开始' />;
    }

    return (
      <Row gutter={[16, 16]}>
        {filteredExperiments.map(exp => (
          <Col xs={24} sm={12} md={8} lg={6} key={exp.id}>
            <Card
              hoverable
              style={gridCardStyle}
              styles={{ body: gridCardBodyStyle }}
              actions={renderCardActions(exp)}
              onClick={() => handleOpenExperiment(exp)}
            >
              {/* 模板标签 - 右上角 */}
              {exp.is_template && (
                <Tag
                  color="purple"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    margin: 0
                  }}
                >
                  模板
                </Tag>
              )}

              {/* 标题和状态 */}
              <div style={{ marginBottom: 8, paddingRight: exp.is_template ? 50 : 0 }}>
                <Text strong style={{ margin: 0, fontSize: 15, display: 'block' }}>
                  {exp.name}
                </Text>
                <div style={{ marginTop: 4 }}>{renderStatus(exp)}</div>
              </div>

              {/* 描述 */}
              <div style={{ fontSize: 13, color: 'var(--custom-text-secondary)', minHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                {exp.description || '暂无描述'}
              </div>

              {/* 进度条 */}
              {renderProgress(exp)}

              {/* 底部信息 */}
              <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 12, color: 'var(--custom-text-secondary)' }}>
                <Space separator={<span>·</span>}>
                  {exp.source_action_space_name && (
                    <span>{exp.source_action_space_name}</span>
                  )}
                  {exp.created_at && (
                    <span>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {new Date(exp.created_at).toLocaleDateString()}
                    </span>
                  )}
                </Space>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton.Input active style={{ width: 150 }} />
            <Skeleton.Input active size="small" style={{ width: 250 }} />
          </div>
          <Skeleton.Button active style={{ width: 100 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
          <Space>
            <Skeleton.Input active style={{ width: 250 }} />
            <Skeleton.Input active style={{ width: 120 }} />
          </Space>
        </div>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Col key={i} xs={24} sm={12} md={8} lg={6}>
              <Card style={{ borderRadius: '8px' }}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>{t('parallelLab.title')}</Title>
          <Text type="secondary">{t('parallelLab.list.subtitle')}</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          {t('parallelLab.list.createExperiment')}
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
        <Space>
          <Input
            placeholder={t('parallelLab.list.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            style={{ width: 250 }}
          />
          <Select
            placeholder={t('parallelLab.list.filterStatus')}
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
          >
            <Select.Option value="template">{t('parallelLab.list.status.template')}</Select.Option>
            <Select.Option value="running">{t('parallelLab.list.status.running')}</Select.Option>
            <Select.Option value="paused">{t('parallelLab.list.status.paused')}</Select.Option>
            <Select.Option value="completed">{t('parallelLab.list.status.completed')}</Select.Option>
            <Select.Option value="stopped">{t('parallelLab.list.status.stopped')}</Select.Option>
          </Select>
        </Space>
      </div>

      {/* 实验卡片网格 */}
      {renderExperimentCards()}

      {/* 实验详情 Modal */}
      <Modal
        title={selectedExperiment?.name || '实验详情'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width="80%"
        destroyOnHidden
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'detail',
              label: <span><InfoCircleOutlined /> 详情</span>,
              children: renderDetailTab()
            },
            {
              key: 'design',
              label: <span><SettingOutlined /> 实验设计</span>,
              children: selectedExperiment && (
                <ExperimentDesign
                  actionSpaces={actionSpaces}
                  experimentConfig={{
                    name: selectedExperiment.name,
                    description: selectedExperiment.description || ''
                  }}
                  setExperimentConfig={() => { }}
                  selectedSpace={selectedExperiment.source_action_space_id}
                  setSelectedSpace={() => { }}
                  handleCreateExperiment={handleSaveExperimentConfig}
                  handleStartExperiment={handleStartExperiment}
                  loading={editLoading}
                  readOnly={!isEditMode}
                  hideBasicInfo={true}
                  existingVariables={selectedExperiment.config?.variables}
                  existingObjectives={selectedExperiment.config?.objectives}
                  existingStopConditions={selectedExperiment.config?.stop_conditions}
                  existingTaskConfig={selectedExperiment.config?.task_config}
                  existingCustomVariables={selectedExperiment.config?.custom_variables}
                  existingProtocol={selectedExperiment.config?.experiment_protocol}
                  existingExperimentType={selectedExperiment.config?.experiment_type}
                  models={models}
                  globalSettings={globalSettings}
                />
              )
            },

          ]}
        />
      </Modal>

      {/* 创建实验 Modal */}
      <Modal
        title="创建实验"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setExperimentConfig({ name: '', description: '' });
          setSelectedSpace(null);
        }}
        onOk={handleCreateDraftExperiment}
        okText="创建"
        cancelText="取消"
        confirmLoading={createLoading}
        width={500}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="实验名称" required>
            <Input
              placeholder="输入实验名称"
              value={experimentConfig.name}
              onChange={(e) => setExperimentConfig({ ...experimentConfig, name: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="行动空间" required>
            <Select
              placeholder="选择行动空间"
              value={selectedSpace}
              onChange={setSelectedSpace}
            >
              {actionSpaces.map(space => (
                <Select.Option key={space.id} value={space.id}>{space.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="实验描述">
            <Input.TextArea
              placeholder="描述实验目的（可选）"
              value={experimentConfig.description}
              onChange={(e) => setExperimentConfig({ ...experimentConfig, description: e.target.value })}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExperimentListPage;
