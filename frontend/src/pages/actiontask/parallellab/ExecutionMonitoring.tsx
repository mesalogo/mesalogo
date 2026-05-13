import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Space,
  Progress,
  Tag,
  Statistic,
  Empty,
  Table,
  Typography,
  Badge,
  Segmented,
  Spin,
  Select,
  Pagination
} from 'antd';
import {
  StopOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  TableOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';
import TimelineTrackView from './TimelineTrackView';

const { Text } = Typography;

interface ExecutionMonitoringProps {
  experiments: any[];
  handleStopExperiment: (id: string) => void;
  handlePauseExperiment?: (id: string) => void;
  handleResumeExperiment?: (id: string) => void;
}

const ExecutionMonitoring: React.FC<ExecutionMonitoringProps> = ({ 
  experiments, 
  handleStopExperiment,
  handlePauseExperiment,
  handleResumeExperiment
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<string | number>('table');
  const [experimentRuns, setExperimentRuns] = useState<Record<string, any[]>>({});
  const [loadingRuns, setLoadingRuns] = useState<Record<string, boolean>>({});
  const [selectedIterations, setSelectedIterations] = useState<Record<string, number>>({});
  const [allIterations, setAllIterations] = useState<Record<string, string[]>>({});
  const [iterationStats, setIterationStats] = useState<Record<string, { total: number; completed: number; failed: number; stopped: number; progress: number }>>({});
  // 后端分页状态（表格+时间线共用）
  const [runsPageSize, setRunsPageSize] = useState<number>(10);
  const [runsCurrentPage, setRunsCurrentPage] = useState<Record<string, number>>({});
  const [runsPagination, setRunsPagination] = useState<Record<string, { total: number; totalPages: number }>>({});

  // 核心请求函数（无 useCallback 依赖问题，page/pageSize 全部由调用方显式传入）
  const fetchRuns = async (experimentId: string, iteration?: number, page: number = 1, pageSize: number = 10) => {
    setLoadingRuns(prev => ({ ...prev, [experimentId]: true }));
    try {
      const response = await parallelExperimentApi.getExperimentStatus(
        experimentId, true, iteration, page, pageSize
      );
      if (response.success && response.runs) {
        setExperimentRuns(prev => ({ ...prev, [experimentId]: response.runs }));
        if (response.all_iterations) {
          setAllIterations(prev => ({ ...prev, [experimentId]: response.all_iterations || [] }));
        }
        setSelectedIterations(prev => {
          if (!prev[experimentId] && response.current_iteration) {
            return { ...prev, [experimentId]: response.current_iteration };
          }
          return prev;
        });
        // 更新统计数据（来自全量计算，不受分页影响）
        const total = response.total_runs || 0;
        const completed = response.completed_runs || 0;
        const failed = response.failed_runs || 0;
        const stopped = response.stopped_runs || 0;
        const ended = completed + failed + stopped;
        const progress = total > 0 ? Math.round(ended / total * 100) : 0;
        setIterationStats(prev => ({
          ...prev,
          [experimentId]: { total, completed, failed, stopped, progress }
        }));
        // 更新分页信息
        if (response.runs_total !== undefined) {
          setRunsPagination(prev => ({
            ...prev,
            [experimentId]: {
              total: response.runs_total!,
              totalPages: response.runs_total_pages!
            }
          }));
          setRunsCurrentPage(prev => ({ ...prev, [experimentId]: page }));
        }
      }
    } catch (error) {
      console.error('加载实验运行状态失败:', error);
    } finally {
      setLoadingRuns(prev => ({ ...prev, [experimentId]: false }));
    }
  };

  // 刷新按钮：保持当前页码和轮次
  const loadExperimentRuns = useCallback((experimentId: string, iteration?: number) => {
    const page = runsCurrentPage[experimentId] || 1;
    fetchRuns(experimentId, iteration ?? selectedIterations[experimentId], page, runsPageSize);
  }, [runsCurrentPage, selectedIterations, runsPageSize]);

  // 切换轮次（重置到第1页）
  const handleIterationChange = useCallback((experimentId: string, iteration: number) => {
    setSelectedIterations(prev => ({ ...prev, [experimentId]: iteration }));
    setRunsCurrentPage(prev => ({ ...prev, [experimentId]: 1 }));
    fetchRuns(experimentId, iteration, 1, runsPageSize);
  }, [runsPageSize]);

  // runs 翻页
  const handleRunsPageChange = useCallback((experimentId: string, page: number, pageSize?: number) => {
    const newPageSize = pageSize || runsPageSize;
    if (pageSize && pageSize !== runsPageSize) {
      setRunsPageSize(pageSize);
    }
    setRunsCurrentPage(prev => ({ ...prev, [experimentId]: page }));
    const iteration = selectedIterations[experimentId];
    fetchRuns(experimentId, iteration, page, newPageSize);
  }, [selectedIterations, runsPageSize]);

  // 初始加载（只在 experiments 列表变化时触发，不依赖回调引用）
  const initializedRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    const relevantExps = experiments.filter(e => 
      ['running', 'paused', 'completed', 'stopped', 'failed'].includes(e.status)
    );
    relevantExps.forEach(exp => {
      if (!initializedRef.current.has(exp.id)) {
        initializedRef.current.add(exp.id);
        fetchRuns(exp.id, undefined, 1, runsPageSize);
      }
    });
  }, [experiments, runsPageSize]);

  // 运行实例表格列定义
  const runColumns = [
    {
      title: t('parallelLab.monitor.runNumber'),
      dataIndex: 'run_number',
      key: 'run_number',
      width: 80
    },
    {
      title: t('parallelLab.monitor.paramCombination'),
      key: 'parameters',
      render: (_: any, record: any) => (
        <div>
          {record.parameters && Object.entries(record.parameters).map(([key, value]) => (
            <Tag key={key}>{key}: {String(value)}</Tag>
          ))}
        </div>
      )
    },
    {
      title: t('parallelLab.monitor.currentMetrics'),
      key: 'metrics',
      render: (_: any, record: any) => (
        <Space style={{ flexDirection: 'column' }} size="small">
          {record.current_metrics && Object.entries(record.current_metrics).map(([key, value]) => (
            <Text key={key} type="secondary" style={{ fontSize: 12 }}>
              {key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
            </Text>
          ))}
        </Space>
      )
    },
    {
      title: t('parallelLab.monitor.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig: Record<string, { color: any; text: string }> = {
          queued: { color: 'default', text: t('parallelLab.monitor.status.queued', '排队中') },
          pending: { color: 'warning', text: t('parallelLab.monitor.status.pending') },
          running: { color: 'processing', text: t('parallelLab.monitor.status.running') },
          completed: { color: 'success', text: t('parallelLab.monitor.status.completed') },
          failed: { color: 'error', text: t('parallelLab.monitor.status.failed') },
          stopped: { color: 'warning', text: t('parallelLab.monitor.status.stopped', '已停止') }
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Badge status={config.color} text={config.text} />;
      }
    },
    {
      title: t('parallelLab.monitor.actions'),
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Button 
          size="small" 
          icon={<EyeOutlined />}
          onClick={() => navigate(`/action-tasks/detail/${record.action_task_id}`)}
          disabled={!record.action_task_id}
        >
          {record.action_task_id ? t('parallelLab.monitor.details') : t('parallelLab.monitor.status.queued', '排队中')}
        </Button>
      )
    }
  ];

  // 统计数据
  const runningCount = experiments.filter(e => e.status === 'running').length;
  const completedCount = experiments.filter(e => e.status === 'completed').length;
  const pausedCount = experiments.filter(e => e.status === 'paused').length;

  // 计算所有运行中实验的活跃运行数
  const allRuns = Object.values(experimentRuns).flat();
  const activeRunsCount = allRuns.filter(r => r.status === 'running').length;
  const completedRunsCount = allRuns.filter(r => r.status === 'completed').length;

  return (
    <div>
      {/* 总体统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('parallelLab.monitor.runningExperiments')}
              value={runningCount}
              prefix={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('parallelLab.monitor.pausedExperiments')}
              value={pausedCount}
              prefix={<PauseCircleOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('parallelLab.monitor.completedExperiments')}
              value={completedCount}
              prefix={<Badge status="success" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('parallelLab.monitor.activeTasksTotal')}
              value={activeRunsCount}
              suffix={`/ ${allRuns.length}`}
            />
          </Card>
        </Col>
      </Row>

      {/* 实验详情（包括运行中、已暂停、已完成、已停止、失败的实验） */}
      {experiments.filter(e => ['running', 'paused', 'completed', 'stopped', 'failed'].includes(e.status)).map(experiment => (
        <Card
          key={experiment.id}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <span>{experiment.name}</span>
                {experiment.current_iteration > 0 && (
                  <Tag>{t('parallelLab.list.roundFormat', { round: experiment.current_iteration })}</Tag>
                )}
                <Tag color={
                  experiment.status === 'running' ? 'processing' : 
                  experiment.status === 'paused' ? 'warning' :
                  experiment.status === 'completed' ? 'success' :
                  experiment.status === 'failed' ? 'error' : 'default'
                }>
                  {experiment.status === 'running' ? t('parallelLab.list.status.running') : 
                   experiment.status === 'paused' ? t('parallelLab.list.status.paused') :
                   experiment.status === 'completed' ? t('parallelLab.list.status.completed') :
                   experiment.status === 'failed' ? t('parallelLab.list.status.failed') : t('parallelLab.list.status.stopped')}
                </Tag>
              </Space>
              <Space>
                <Segmented
                  value={viewMode}
                  onChange={setViewMode}
                  options={[
                    { label: t('parallelLab.monitor.tableView'), value: 'table', icon: <TableOutlined /> },
                    { label: t('parallelLab.monitor.timelineView'), value: 'timeline', icon: <BranchesOutlined /> }
                  ]}
                />
                {experiment.status === 'running' && handlePauseExperiment && (
                  <Button icon={<PauseCircleOutlined />} onClick={() => handlePauseExperiment(experiment.id)}>
                    {t('parallelLab.monitor.pause')}
                  </Button>
                )}
                {experiment.status === 'paused' && handleResumeExperiment && (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleResumeExperiment(experiment.id)}>
                    {t('parallelLab.monitor.resume')}
                  </Button>
                )}
                {['running', 'paused'].includes(experiment.status) && (
                  <Button icon={<StopOutlined />} danger onClick={() => handleStopExperiment(experiment.id)}>
                    {t('parallelLab.monitor.stop')}
                  </Button>
                )}
                <Button icon={<ReloadOutlined />} onClick={() => loadExperimentRuns(experiment.id)}>
                  {t('parallelLab.monitor.refresh')}
                </Button>
              </Space>
            </div>
          }
          style={{ marginBottom: 16 }}
        >
          {/* 轮次选择器 */}
          {allIterations[experiment.id]?.length > 1 && (
            <Row style={{ marginBottom: 16 }}>
              <Col>
                <Space>
                  <Text>{t('parallelLab.monitor.selectRound')}：</Text>
                  <Select
                    value={selectedIterations[experiment.id] ?? experiment.current_iteration}
                    onChange={(value: number) => handleIterationChange(experiment.id, value)}
                    style={{ width: 120 }}
                  >
                    {allIterations[experiment.id].map((iter) => {
                      const iterNum = typeof iter === 'string' ? parseInt(iter, 10) : iter;
                      return (
                        <Select.Option key={iterNum} value={iterNum}>
                          {t('parallelLab.monitor.round', { round: iterNum })}
                        </Select.Option>
                      );
                    })}
                  </Select>
                </Space>
              </Col>
            </Row>
          )}

          {/* 实验进度统计 - 使用选中轮次的数据 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col flex="1">
              <Statistic
                title={t('parallelLab.monitor.roundProgress')}
                value={iterationStats[experiment.id]?.progress ?? experiment.progress ?? 0}
                suffix="%"
              />
              <Progress percent={iterationStats[experiment.id]?.progress ?? experiment.progress ?? 0} showInfo={false} />
            </Col>
            <Col flex="1">
              <Statistic
                title={t('parallelLab.monitor.totalRuns')}
                value={iterationStats[experiment.id]?.total ?? experiment.total_runs ?? experiment.totalRuns ?? 0}
              />
            </Col>
            <Col flex="1">
              <Statistic
                title={t('parallelLab.monitor.completed')}
                value={iterationStats[experiment.id]?.completed ?? experiment.completed_runs ?? experiment.completedRuns ?? 0}
                styles={{ content: { color: '#3f8600' } }}
              />
            </Col>
            <Col flex="1">
              <Statistic
                title={t('parallelLab.monitor.failed')}
                value={iterationStats[experiment.id]?.failed ?? experiment.failed_runs ?? experiment.failedRuns ?? 0}
                styles={{ content: { color: (iterationStats[experiment.id]?.failed ?? experiment.failed_runs ?? experiment.failedRuns ?? 0) > 0 ? '#cf1322' : undefined } }}
              />
            </Col>
            <Col flex="1">
              <Statistic
                title={t('parallelLab.monitor.status.stopped', '已停止')}
                value={iterationStats[experiment.id]?.stopped ?? 0}
                styles={{ content: { color: (iterationStats[experiment.id]?.stopped ?? 0) > 0 ? '#faad14' : undefined } }}
              />
            </Col>
          </Row>

          {/* 运行详情 — 翻页时保持骨架，Spin 叠加在内容上避免高度塌陷导致滚动跳顶 */}
          {experimentRuns[experiment.id]?.length > 0 ? (
            <Spin spinning={!!loadingRuns[experiment.id]}>
              {viewMode === 'timeline' ? (
                <TimelineTrackView
                  runningRuns={experimentRuns[experiment.id]?.filter(run => run.action_task_id).map(run => ({
                    key: run.action_task_id,
                    experimentName: experiment.name,
                    runNumber: run.run_number,
                    parameters: run.parameters || {},
                    progress: run.status === 'completed' ? 100 : run.status === 'running' ? 50 : 0,
                    status: run.status,
                    startTime: run.start_time || new Date().toISOString(),
                    messages: run.messages || []
                  }))}
                />
              ) : (
                <Table
                  dataSource={experimentRuns[experiment.id]}
                  columns={runColumns}
                  rowKey="run_number"
                  pagination={false}
                  size="small"
                />
              )}
              {/* 后端分页控件（表格+时间线共用） */}
              {runsPagination[experiment.id] && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <Pagination
                    current={runsCurrentPage[experiment.id] || 1}
                    pageSize={runsPageSize}
                    total={runsPagination[experiment.id].total}
                    onChange={(page, pageSize) => handleRunsPageChange(experiment.id, page, pageSize)}
                    onShowSizeChange={(_current, size) => handleRunsPageChange(experiment.id, 1, size)}
                    size="small"
                    showSizeChanger
                    pageSizeOptions={['10', '20', '50', '100']}
                    showTotal={(total) => t('parallelLab.monitor.total', { total })}
                  />
                </div>
              )}
            </Spin>
          ) : loadingRuns[experiment.id] ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : (
            <Empty description={t('parallelLab.monitor.noRunData')} />
          )}
        </Card>
      ))}

      {/* 空状态 - 只在没有任何相关实验时显示 */}
      {experiments.filter(e => ['running', 'paused', 'completed', 'stopped', 'failed'].includes(e.status)).length === 0 && (
        <Empty description={t('parallelLab.monitor.noExperimentData')}>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/parallel-lab/list')}>
            {t('parallelLab.monitorPage.goToList')}
          </Button>
        </Empty>
      )}
    </div>
  );
};

export default ExecutionMonitoring;
