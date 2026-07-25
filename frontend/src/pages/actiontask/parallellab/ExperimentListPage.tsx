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
  App,
  Statistic
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CopyOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  DeleteOutlined,
  MonitorOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';
import { getParallelExperimentError } from './errorMessage';
import ExperimentDesign from './ExperimentDesign';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { modelConfigAPI } from '../../../services/api/model';
import { settingsAPI } from '../../../services/api/settings';
import AnalysisReport from './AnalysisReport';
import ExecutionMonitoring from './ExecutionMonitoring';
import ExperimentEvidencePanel from './ExperimentEvidencePanel';
import ParallelLabWorkspaceHeader from './ParallelLabWorkspaceHeader';
import {
  getEvidenceChecks,
  getPortfolioStats,
  toWorkspaceExperiment
} from './researchWorkbench';
import { resolveProtocolGenerationSettings } from './protocolGeneration';

const { Text } = Typography;

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
  const [globalSettings, setGlobalSettings] = useState<any>({
    enableAssistantGeneration: false,
    enableExperimentProtocolGeneration: false,
    experimentProtocolModel: 'default'
  });

  const loadExperiments = useCallback(async () => {
    try {
      const response = await parallelExperimentApi.listAllExperiments({
        include_templates: true
      });
      if (response.success && response.experiments) {
        setExperiments(response.experiments);
      }
    } catch (error) {
      console.error('load experiment list failed:', error);
      message.error(t('parallelLab.list.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

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
      console.error('load action spaces failed:', error);
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
      setGlobalSettings(resolveProtocolGenerationSettings(settingsData));
    } catch (error) {
      console.error('load models and settings failed:', error);
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
      console.error('get experiment details failed:', error);
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
      const response = await parallelExperimentApi.cloneExperiment(id, t('parallelLab.list.cloneSuffix', { name }));
      if (response.success) {
        message.success(isTemplate
          ? t('parallelLab.list.templateCloneSuccess')
          : t('parallelLab.list.cloneSuccess'));
        loadExperiments();
        setModalVisible(false);
      }
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.cloneFailed')));
    }
  };

  // 停止实验
  const handleStop = async (id: string) => {
    try {
      const response = await parallelExperimentApi.stopExperiment(id);
      if (response.success) {
        message.success(t('parallelLab.list.experimentStopped'));
        loadExperiments();
      }
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.stopFailed')));
    }
  };

  // 暂停实验
  const handlePause = async (id: string) => {
    try {
      const response = await parallelExperimentApi.pauseExperiment(id);
      if (response.success) {
        message.success(t('parallelLab.list.experimentPaused'));
        loadExperiments();
      }
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.pauseFailed')));
    }
  };

  // 恢复实验
  const handleResume = async (id: string) => {
    try {
      const response = await parallelExperimentApi.resumeExperiment(id);
      if (response.success) {
        message.success(t('parallelLab.list.experimentResumed'));
        loadExperiments();
      }
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.resumeFailed')));
    }
  };

  // 删除实验
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    Modal.confirm({
      title: t('parallelLab.list.confirmDelete'),
      content: t('parallelLab.list.deleteWarning'),
      okText: t('parallelLab.list.delete'),
      okType: 'danger',
      cancelText: t('parallelLab.list.cancel'),
      onOk: async () => {
        try {
          const response = await parallelExperimentApi.deleteExperiment(id);
          if (response.success) {
            message.success(t('parallelLab.list.experimentDeleted'));
            setModalVisible(false);
            loadExperiments();
          }
        } catch (error: any) {
          message.error(getParallelExperimentError(error, t('parallelLab.list.deleteFailed')));
        }
      }
    });
  };

  // 创建草稿实验（仅基础信息）
  const handleCreateDraftExperiment = async () => {
    if (!selectedSpace || !experimentConfig.name) {
      message.warning(t('parallelLab.list.selectSpaceAndName'));
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
        message.success(t('parallelLab.list.createSuccess'));
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
      message.error(getParallelExperimentError(error, t('parallelLab.list.createFailed')));
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
        message.success(t('parallelLab.list.configSaved'));
        await loadExperiments();
        // 更新 selectedExperiment
        const updated = (await parallelExperimentApi.getExperiment(selectedExperiment.id)).experiment;
        setSelectedExperiment(updated);
      }
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.saveConfigFailed')));
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
      message.warning(t('parallelLab.list.configTopicInDesign'));
      setActiveTab('design');
      return;
    }
    setEditLoading(true);
    try {
      const response = await parallelExperimentApi.startExperiment(selectedExperiment.id);
      if (response.success) {
        message.success(t('parallelLab.list.experimentStarted'));
        setIsEditMode(false);
        setModalVisible(false);
        // 跳转到执行监控页面
        navigate('/parallel-lab/monitoring');
      }
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.startFailed')));
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
        message.warning(t('parallelLab.list.configTopicFirst'));
        // 打开实验详情进行编辑
        handleOpenExperiment(expDetail.experiment);
        return;
      }
      const response = await parallelExperimentApi.startExperiment(expId);
      if (response.success) {
        message.success(t('parallelLab.list.experimentStarted'));
        // 跳转到执行监控页面
        navigate('/parallel-lab/monitoring');
      }
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.startFailed')));
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
      created: { status: 'default', text: t('parallelLab.list.statusCreated') },
      running: { status: 'processing', text: t('parallelLab.list.statusRunning') },
      paused: { status: 'warning', text: t('parallelLab.list.statusPaused') },
      completed: { status: 'success', text: t('parallelLab.list.statusCompleted') },
      failed: { status: 'error', text: t('parallelLab.list.statusFailed') },
      stopped: { status: 'default', text: t('parallelLab.list.statusStopped') }
    };
    const config = statusMap[exp.status] || { status: 'default', text: exp.status };
    return <Badge status={config.status} text={config.text} />;
  };

  // 渲染进度
  const renderProgress = (exp: any) => {
    if (exp.is_template) return null;
    const total = exp.total_runs || 0;
    const succeeded = exp.completed_runs || 0;
    const failed = exp.failed_runs || 0;
    const completed = succeeded + failed;
    if (total === 0) return null;
    const percent = Math.round((completed / total) * 100);
    const successPercent = Math.round((succeeded / total) * 100);
    return (
      <div style={{ marginTop: 14 }}>
        <Progress
          percent={percent}
          success={{ percent: successPercent }}
          size="small"
          format={() => `${completed}/${total}`}
        />
        <Space size={12} style={{ marginTop: 2 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('parallelLab.portfolio.completedRuns', { count: succeeded })}
          </Text>
          <Text type={failed > 0 ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>
            {t('parallelLab.portfolio.failedRuns', { count: failed })}
          </Text>
        </Space>
      </div>
    );
  };

  // 渲染卡片操作
  const renderCardActions = (exp: any) => {
    if (exp.is_template) {
      return [
        <Tooltip title={t('parallelLab.list.viewDetails')} key="view">
          <EyeOutlined style={{ color: '#1677ff' }} onClick={() => handleOpenExperiment(exp)} />
        </Tooltip>,
        <Tooltip title={t('parallelLab.list.useTemplate')} key="use">
          <CopyOutlined style={{ color: '#722ed1' }} onClick={(e) => handleClone(exp.id, exp.name, true, e)} />
        </Tooltip>
      ];
    }

    const actions = [
      <Tooltip title={t('parallelLab.list.viewDetails')} key="view">
        <EyeOutlined style={{ color: '#1677ff' }} onClick={() => handleOpenExperiment(exp)} />
      </Tooltip>
    ];

    // created 状态：显示启动按钮
    if (exp.status === 'created') {
      actions.push(
        <Tooltip title={t('parallelLab.list.start')} key="start">
          <PlayCircleOutlined style={{ color: '#52c41a' }} onClick={(e) => { e.stopPropagation(); handleStartExpFromList(exp.id); }} />
        </Tooltip>
      );
    } else if (exp.status === 'running') {
      actions.push(
        <Tooltip title={t('parallelLab.list.pause')} key="pause">
          <PauseCircleOutlined style={{ color: '#faad14' }} onClick={(e) => { e.stopPropagation(); handlePause(exp.id); }} />
        </Tooltip>,
        <Tooltip title={t('parallelLab.list.stop')} key="stop">
          <StopOutlined style={{ color: '#ff4d4f' }} onClick={(e) => { e.stopPropagation(); handleStop(exp.id); }} />
        </Tooltip>
      );
    } else if (exp.status === 'paused') {
      actions.push(
        <Tooltip title={t('parallelLab.list.resume')} key="resume">
          <PlayCircleOutlined style={{ color: '#52c41a' }} onClick={(e) => { e.stopPropagation(); handleResume(exp.id); }} />
        </Tooltip>,
        <Tooltip title={t('parallelLab.list.stop')} key="stop">
          <StopOutlined style={{ color: '#ff4d4f' }} onClick={(e) => { e.stopPropagation(); handleStop(exp.id); }} />
        </Tooltip>
      );
    } else if (['completed', 'stopped', 'failed'].includes(exp.status)) {
      // completed / stopped / failed: can restart
      actions.push(
        <Tooltip title={t('parallelLab.list.restartRound', { round: (exp.current_iteration || 0) + 1 })} key="restart">
          <PlayCircleOutlined style={{ color: '#52c41a' }} onClick={(e) => { e.stopPropagation(); handleStartExpFromList(exp.id); }} />
        </Tooltip>,
        <Tooltip title={t('parallelLab.list.clone')} key="clone">
          <CopyOutlined style={{ color: '#722ed1' }} onClick={(e) => handleClone(exp.id, exp.name, false, e)} />
        </Tooltip>,
        <Tooltip title={t('parallelLab.list.delete')} key="delete">
          <DeleteOutlined style={{ color: '#ff4d4f' }} onClick={(e) => handleDelete(exp.id, e)} />
        </Tooltip>
      );
    } else {
      // created
      actions.push(
        <Tooltip title={t('parallelLab.list.clone')} key="clone">
          <CopyOutlined style={{ color: '#722ed1' }} onClick={(e) => handleClone(exp.id, exp.name, false, e)} />
        </Tooltip>,
        <Tooltip title={t('parallelLab.list.delete')} key="delete">
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
      message.success(t('parallelLab.list.basicInfoSaved'));
      await loadExperiments();
      setSelectedExperiment({ ...selectedExperiment, name, description });
    } catch (error: any) {
      message.error(getParallelExperimentError(error, t('parallelLab.list.saveFailed')));
    }
  };

  // Modal 中的详情 Tab
  const renderDetailTab = () => {
    if (!selectedExperiment) return null;
    const exp = selectedExperiment;
    const canEdit = exp.status !== 'running' && !exp.is_template;
    const evidenceChecks = getEvidenceChecks(exp);
    const readyCount = evidenceChecks.filter(check => check.ready).length;

    return (
      <div>
        <Card
          size="small"
          style={{ marginBottom: 16, borderRadius: 10 }}
          styles={{ body: { padding: 18 } }}
        >
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} lg={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('parallelLab.portfolio.researchQuestion')}
              </Text>
              <Typography.Paragraph
                strong
                style={{ margin: '5px 0 10px', fontSize: 16 }}
              >
                {exp.description || t('parallelLab.portfolio.questionMissing')}
              </Typography.Paragraph>
              <Tag color={readyCount === evidenceChecks.length ? 'success' : 'warning'}>
                {t('parallelLab.portfolio.setupProgress', {
                  ready: readyCount,
                  total: evidenceChecks.length
                })}
              </Tag>
            </Col>
            {!exp.is_template && (
              <Col xs={24} lg={12}>
                <Row gutter={[12, 12]}>
                  <Col span={6}>
                    <Statistic
                      title={t('parallelLab.list.totalRuns')}
                      value={exp.total_runs || 0}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title={t('parallelLab.list.completed')}
                      value={exp.completed_runs || 0}
                      valueStyle={{ color: '#389e0d' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title={t('parallelLab.list.failed')}
                      value={exp.failed_runs || 0}
                      valueStyle={exp.failed_runs ? { color: '#cf1322' } : undefined}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title={t('parallelLab.list.currentRound')}
                      value={exp.current_iteration || 0}
                    />
                  </Col>
                </Row>
              </Col>
            )}
          </Row>
        </Card>

        {/* 可编辑的基本信息 */}
        {canEdit ? (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form layout="vertical">
              <Form.Item label={t('parallelLab.list.experimentName')} required style={{ marginBottom: 12 }}>
                <Input
                  value={exp.name}
                  onChange={(e) => setSelectedExperiment({ ...exp, name: e.target.value })}
                  placeholder={t('parallelLab.list.experimentNamePlaceholder')}
                />
              </Form.Item>
              <Form.Item label={t('parallelLab.list.experimentDesc')} required style={{ marginBottom: 12 }}>
                <Input.TextArea
                  value={exp.description || ''}
                  onChange={(e) => setSelectedExperiment({ ...exp, description: e.target.value })}
                  placeholder={t('parallelLab.list.experimentDescPlaceholder')}
                  rows={3}
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Button
                  type="primary"
                  onClick={() => handleUpdateBasicInfo(exp.name, exp.description || '')}
                  disabled={!exp.name || !exp.description}
                >
                  {t('parallelLab.list.saveBasicInfo')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        ) : null}

        <Descriptions column={2} bordered size="small">
          {!canEdit && <Descriptions.Item label={t('parallelLab.list.experimentName')}>{exp.name}</Descriptions.Item>}
          <Descriptions.Item label={t('parallelLab.list.status')}>{renderStatus(exp)}</Descriptions.Item>
          {!canEdit && <Descriptions.Item label={t('parallelLab.list.description')} span={2}>{exp.description || '-'}</Descriptions.Item>}
          <Descriptions.Item label={t('parallelLab.list.actionSpace')}>{exp.source_action_space_name || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('parallelLab.list.createdAt')}>
            {exp.created_at ? new Date(exp.created_at).toLocaleString() : '-'}
          </Descriptions.Item>
          {!exp.is_template && (
            <>
              <Descriptions.Item label={t('parallelLab.list.currentRound')}>{t('parallelLab.list.roundFormat', { round: exp.current_iteration || 0 })}</Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.totalRuns')}>{exp.total_runs || 0}</Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.completed')}>{exp.completed_runs || 0}</Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.failed')}>{exp.failed_runs || 0}</Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.startTime')}>
                {exp.start_time ? new Date(exp.start_time).toLocaleString() : '-'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {exp.is_template ? (
              <Button type="primary" icon={<CopyOutlined />} onClick={() => handleClone(exp.id, exp.name, true)}>
                {t('parallelLab.list.useTemplateCreate')}
              </Button>
            ) : (
              <>
                {exp.status === 'created' && (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartExperiment} loading={editLoading}>
                    {t('parallelLab.list.start')}
                  </Button>
                )}
                {['completed', 'stopped', 'failed'].includes(exp.status) && (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartExperiment} loading={editLoading}>
                    {t('parallelLab.list.restartRound', { round: (exp.current_iteration || 0) + 1 })}
                  </Button>
                )}
                {exp.status === 'running' && (
                  <>
                    <Button icon={<PauseCircleOutlined />} onClick={() => handlePause(exp.id)}>{t('parallelLab.list.pause')}</Button>
                    <Button danger icon={<StopOutlined />} onClick={() => handleStop(exp.id)}>{t('parallelLab.list.stop')}</Button>
                  </>
                )}
                {exp.status === 'paused' && (
                  <>
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleResume(exp.id)}>{t('parallelLab.list.resume')}</Button>
                    <Button danger icon={<StopOutlined />} onClick={() => handleStop(exp.id)}>{t('parallelLab.list.stop')}</Button>
                  </>
                )}
                <Button icon={<CopyOutlined />} onClick={() => handleClone(exp.id, exp.name, false)}>{t('parallelLab.list.clone')}</Button>
                {!['running', 'paused'].includes(exp.status) && (
                  <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(exp.id)}>{t('parallelLab.list.delete')}</Button>
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
    minHeight: '318px',
    borderRadius: '12px',
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
      return <Empty description={t('parallelLab.list.noExperiments')} />;
    }

    return (
      <Row gutter={[16, 16]}>
        {filteredExperiments.map(exp => (
          <Col xs={24} sm={12} xl={8} key={exp.id}>
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
                  {t('parallelLab.list.templateTag')}
                </Tag>
              )}

              {/* 标题和状态 */}
              <div style={{ marginBottom: 8, paddingRight: exp.is_template ? 50 : 0 }}>
                <Text strong style={{ margin: 0, fontSize: 15, display: 'block' }}>
                  {exp.name}
                </Text>
                <div style={{ marginTop: 4 }}>{renderStatus(exp)}</div>
              </div>

              <Text type="secondary" style={{ fontSize: 11, marginBottom: 4 }}>
                {t('parallelLab.portfolio.researchQuestion')}
              </Text>
              <div style={{ fontSize: 13, minHeight: 42, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                {exp.description || t('parallelLab.list.noDescription')}
              </div>

              {/* 进度条 */}
              {renderProgress(exp)}

              {!exp.is_template && (
                <div style={{ marginTop: 12 }}>
                  {(() => {
                    const checks = getEvidenceChecks(exp);
                    const ready = checks.filter(check => check.ready).length;
                    return (
                      <Tag color={ready === checks.length ? 'success' : 'warning'}>
                        <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                        {t('parallelLab.portfolio.setupProgress', {
                          ready,
                          total: checks.length
                        })}
                      </Tag>
                    );
                  })()}
                </div>
              )}

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

  const portfolioStats = getPortfolioStats(experiments);
  const workspaceExperiment = selectedExperiment
    ? toWorkspaceExperiment(selectedExperiment)
    : null;

  return (
    <div>
      <ParallelLabWorkspaceHeader
        activeKey="studies"
        showWorkflow
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            {t('parallelLab.list.createExperiment')}
          </Button>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <Card size="small"><Statistic title={t('parallelLab.portfolio.studies')} value={portfolioStats.studies} /></Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small"><Statistic title={t('parallelLab.portfolio.active')} value={portfolioStats.active} /></Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small"><Statistic title={t('parallelLab.portfolio.completed')} value={portfolioStats.completed} /></Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small"><Statistic title={t('parallelLab.portfolio.templates')} value={portfolioStats.templates} /></Card>
        </Col>
      </Row>

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
        title={
          selectedExperiment ? (
            <Space direction="vertical" size={2}>
              <Space>
                <Text strong style={{ fontSize: 18 }}>{selectedExperiment.name}</Text>
                {renderStatus(selectedExperiment)}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedExperiment.description || t('parallelLab.portfolio.questionMissing')}
              </Text>
            </Space>
          ) : t('parallelLab.list.fallbackTitle')
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width="calc(100vw - 48px)"
        style={{ top: 24 }}
        styles={{ body: { maxHeight: 'calc(100vh - 150px)', overflow: 'auto' } }}
        destroyOnHidden
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'detail',
              label: <span><InfoCircleOutlined /> {t('parallelLab.workbench.detail.overview')}</span>,
              children: renderDetailTab()
            },
            {
              key: 'design',
              label: <span><SettingOutlined /> {t('parallelLab.list.design')}</span>,
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
            {
              key: 'runs',
              disabled: !workspaceExperiment || selectedExperiment?.is_template,
              label: <span><MonitorOutlined /> {t('parallelLab.workbench.detail.runs')}</span>,
              children: workspaceExperiment && (
                <ExecutionMonitoring
                  experiments={[workspaceExperiment]}
                  handleStopExperiment={handleStop}
                  handlePauseExperiment={handlePause}
                  handleResumeExperiment={handleResume}
                />
              )
            },
            {
              key: 'analysis',
              disabled: !workspaceExperiment || selectedExperiment?.is_template,
              label: <span><BarChartOutlined /> {t('parallelLab.workbench.detail.analysis')}</span>,
              children: workspaceExperiment && (
                <AnalysisReport experiments={[workspaceExperiment]} />
              )
            },
            {
              key: 'evidence',
              disabled: !selectedExperiment || selectedExperiment.is_template,
              label: <span><SafetyCertificateOutlined /> {t('parallelLab.workbench.detail.evidence')}</span>,
              children: selectedExperiment && (
                <ExperimentEvidencePanel experiment={selectedExperiment} />
              )
            }
          ]}
        />
      </Modal>

      {/* Create experiment modal */}
      <Modal
        title={t('parallelLab.list.createExperiment')}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setExperimentConfig({ name: '', description: '' });
          setSelectedSpace(null);
        }}
        onOk={handleCreateDraftExperiment}
        okText={t('parallelLab.list.create')}
        cancelText={t('parallelLab.list.cancel')}
        confirmLoading={createLoading}
        width={500}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label={t('parallelLab.list.experimentName')} required>
            <Input
              placeholder={t('parallelLab.list.experimentNamePlaceholder')}
              value={experimentConfig.name}
              onChange={(e) => setExperimentConfig({ ...experimentConfig, name: e.target.value })}
            />
          </Form.Item>
          <Form.Item label={t('parallelLab.list.actionSpace')} required>
            <Select
              placeholder={t('parallelLab.list.selectActionSpacePlaceholder')}
              value={selectedSpace}
              onChange={setSelectedSpace}
            >
              {actionSpaces.map(space => (
                <Select.Option key={space.id} value={space.id}>{space.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label={t('parallelLab.list.experimentDesc')}>
            <Input.TextArea
              placeholder={t('parallelLab.list.descriptionPlaceholderOptional')}
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
