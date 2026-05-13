import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Table,
  Tag,
  Select,
  Space,
  Statistic,
  Typography,
  Alert,
  Empty,
  Spin,
  message
} from 'antd';
import {
  TrophyOutlined,
  DownloadOutlined,
  RocketOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';

const { Option } = Select;
const { Text } = Typography;

interface AnalysisReportProps {
  experiments: any[];
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({ experiments }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [experimentDetail, setExperimentDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIteration, setSelectedIteration] = useState<number | null>(null);

  // 过滤出已完成的实验
  const completedExperiments = experiments.filter(e => e.status === 'completed' || e.status === 'stopped');

  // 加载实验详情
  const loadExperimentDetail = async (expId: string) => {
    setLoading(true);
    try {
      const response = await parallelExperimentApi.getExperiment(expId);
      if (response.success) {
        setExperimentDetail(response.experiment);
        // 默认选择当前轮次
        const currentIter = response.experiment?.current_iteration || 1;
        setSelectedIteration(currentIter);
      }
    } catch (error) {
      console.error('加载实验详情失败:', error);
      message.error(t('parallelLab.list.getDetailsFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 选择实验时加载详情
  useEffect(() => {
    if (selectedExperimentId) {
      loadExperimentDetail(selectedExperimentId);
    } else {
      setExperimentDetail(null);
      setSelectedIteration(null);
    }
  }, [selectedExperimentId]);

  // 使用最佳参数创建任务
  const handleCreateBestTask = async () => {
    if (!selectedExperimentId) return;
    try {
      const response = await parallelExperimentApi.createBestTask(selectedExperimentId);
      if (response.success) {
        message.success(t('parallelLab.report.taskCreated'));
        navigate(`/action-tasks/${response.action_task_id}`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || t('parallelLab.report.createTaskFailed'));
    }
  };

  // 获取可用的轮次列表
  const getAvailableIterations = (): number[] => {
    if (!experimentDetail?.results_summary) return [];
    const keys = Object.keys(experimentDetail.results_summary);
    return keys.map(k => parseInt(k, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
  };

  // 获取当前选中轮次的结果摘要
  const getCurrentIterationResults = () => {
    if (!experimentDetail?.results_summary || !selectedIteration) {
      return { best_run: null, all_results: [] };
    }
    // 多轮次结构: results_summary = { "1": { best_run, all_results }, "2": {...} }
    const iterationData = experimentDetail.results_summary[String(selectedIteration)];
    if (iterationData) {
      return iterationData;
    }
    // 兼容旧的单轮次结构: results_summary = { best_run, all_results }
    if (experimentDetail.results_summary.best_run !== undefined) {
      return experimentDetail.results_summary;
    }
    return { best_run: null, all_results: [] };
  };

  const availableIterations = getAvailableIterations();
  const results = getCurrentIterationResults();
  const bestRun = results?.best_run;
  const allResults = results?.all_results || [];

  // 导出 CSV
  const handleExportCSV = () => {
    if (!allResults.length) return;
    
    // 获取所有参数名和指标名
    const paramNames = Object.keys(allResults[0]?.parameters || {});
    const metricNames = Object.keys(allResults[0]?.metrics || {});
    
    // 构建 CSV 头
    const headers = ['运行#', ...paramNames, ...metricNames];
    
    // 构建数据行
    const rows = allResults.map((r, i) => [
      i + 1,
      ...paramNames.map(p => r.parameters?.[p] ?? ''),
      ...metricNames.map(m => r.metrics?.[m] ?? '')
    ]);
    
    // 生成 CSV 内容
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // 下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${experimentDetail?.name || 'experiment'}_results.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success(t('parallelLab.report.csvExported'));
  };

  // 导出 JSON
  const handleExportJSON = () => {
    if (!experimentDetail) return;
    
    const exportData = {
      experiment: {
        id: experimentDetail.id,
        name: experimentDetail.name,
        config: experimentDetail.config,
        start_time: experimentDetail.start_time,
        end_time: experimentDetail.end_time
      },
      iteration: selectedIteration,
      best_run: bestRun,
      all_results: allResults
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${experimentDetail?.name || 'experiment'}_results.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success(t('parallelLab.report.jsonExported'));
  };

  // 结果表格列
  const resultsColumns = [
    {
      title: t('parallelLab.report.runIndex'),
      key: 'index',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: t('parallelLab.report.parameters'),
      key: 'parameters',
      render: (_: any, record: any) => (
        <Space wrap>
          {record.parameters && Object.entries(record.parameters).map(([key, value]) => (
            <Tag key={key}>{key}: {String(value)}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: t('parallelLab.report.resultMetrics'),
      key: 'metrics',
      render: (_: any, record: any) => (
        <Space wrap>
          {record.metrics && Object.entries(record.metrics).map(([key, value]) => (
            <Tag key={key} color="blue">
              {key}: {typeof value === 'number' ? value.toFixed(3) : String(value)}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: t('parallelLab.report.best'),
      key: 'best',
      width: 60,
      render: (_: any, record: any) => (
        bestRun?.action_task_id === record.action_task_id ? (
          <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} />
        ) : null
      )
    }
  ];

  return (
    <div>
      {/* 实验选择器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space>
              <Text strong>{t('parallelLab.report.selectExperimentLabel')}</Text>
              <Select
                placeholder={t('parallelLab.report.selectExperimentPlaceholder')}
                style={{ width: 300 }}
                value={selectedExperimentId}
                onChange={setSelectedExperimentId}
                allowClear
              >
                {completedExperiments.map(exp => (
                  <Option key={exp.id} value={exp.id}>
                    {exp.name} ({exp.status === 'completed' ? t('parallelLab.list.status.completed') : t('parallelLab.list.status.stopped')})
                  </Option>
                ))}
              </Select>
              {availableIterations.length > 1 && (
                <>
                  <Text strong style={{ marginLeft: 16 }}>{t('parallelLab.report.selectRound')}</Text>
                  <Select
                    style={{ width: 120 }}
                    value={selectedIteration}
                    onChange={setSelectedIteration}
                  >
                    {availableIterations.map(iter => (
                      <Option key={iter} value={iter}>
                        {t('parallelLab.report.round', { round: iter })}
                      </Option>
                    ))}
                  </Select>
                </>
              )}
            </Space>
          </Col>
          {selectedExperimentId && bestRun && (
            <Col>
              <Button 
                type="primary" 
                icon={<RocketOutlined />}
                onClick={handleCreateBestTask}
              >
                {t('parallelLab.report.useBestParams')}
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* 加载状态 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      )}

      {/* 未选择实验时的提示 */}
      {!selectedExperimentId && !loading && (
        <Empty description={t('parallelLab.report.selectExperimentHint')}>
          {completedExperiments.length === 0 && (
            <Button type="primary" onClick={() => navigate('/parallel-lab/list')}>
              {t('parallelLab.monitorPage.goToList')}
            </Button>
          )}
        </Empty>
      )}

      {/* 实验结果展示 */}
      {experimentDetail && !loading && (
        <>
          {/* 最佳结果 */}
          {bestRun ? (
            <Alert
              message={t('parallelLab.report.bestParamsCombination')}
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{t('parallelLab.report.params')}</Text>
                    {Object.entries(bestRun.parameters || {}).map(([key, value]) => (
                      <Tag key={key} color="green">{key}: {String(value)}</Tag>
                    ))}
                  </div>
                  <div>
                    <Text strong>{t('parallelLab.report.results')}</Text>
                    {Object.entries(bestRun.metrics || {}).map(([key, value]) => (
                      <Tag key={key} color="blue">
                        {key}: {typeof value === 'number' ? value.toFixed(3) : String(value)}
                      </Tag>
                    ))}
                  </div>
                </div>
              }
              type="success"
              icon={<TrophyOutlined />}
              style={{ marginBottom: 24 }}
              action={
                <Button size="small" onClick={handleCreateBestTask}>
                  {t('parallelLab.report.useThisParams')}
                </Button>
              }
            />
          ) : (
            <Alert
              message={t('parallelLab.report.noBestResult')}
              description={t('parallelLab.report.noBestResultDesc')}
              type="info"
              style={{ marginBottom: 24 }}
            />
          )}

          {/* 统计概览 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('parallelLab.list.totalRuns')}
                  value={experimentDetail.total_runs || 0}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('parallelLab.report.successRuns')}
                  value={experimentDetail.completed_runs || 0}
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('parallelLab.report.failedRuns')}
                  value={experimentDetail.failed_runs || 0}
                  styles={{ content: { color: experimentDetail.failed_runs > 0 ? '#cf1322' : undefined } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('parallelLab.report.successRate')}
                  value={experimentDetail.total_runs > 0 
                    ? ((experimentDetail.completed_runs / experimentDetail.total_runs) * 100).toFixed(1) 
                    : 0}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>

          {/* 实验配置信息 */}
          <Card title={t('parallelLab.report.experimentConfig')} style={{ marginBottom: 24 }} size="small">
            <Row gutter={16}>
              <Col span={8}>
                <Text type="secondary">{t('parallelLab.report.actionSpace')}</Text>
                <Text strong>{experimentDetail.source_action_space_name || '-'}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">{t('parallelLab.report.startTime')}</Text>
                <Text>{experimentDetail.start_time ? new Date(experimentDetail.start_time).toLocaleString() : '-'}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">{t('parallelLab.report.endTime')}</Text>
                <Text>{experimentDetail.end_time ? new Date(experimentDetail.end_time).toLocaleString() : '-'}</Text>
              </Col>
            </Row>
            {experimentDetail.config?.variables && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">{t('parallelLab.report.scanVariables')}</Text>
                <div style={{ marginTop: 8 }}>
                  {Object.entries(experimentDetail.config.variables).map(([name, config]: [string, any]) => (
                    <Tag key={name} style={{ marginBottom: 4 }}>
                      {name}: {config.type === 'enumerated' 
                        ? JSON.stringify(config.values) 
                        : t('parallelLab.report.stepFormat', { start: config.start, end: config.end, step: config.step })}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* 参数 vs 指标可视化图表 */}
          {allResults.length > 0 && <ParameterMetricChart results={allResults} config={experimentDetail.config} />}

          {/* 变量历史图表 */}
          {selectedExperimentId && (
            <VariableHistoryChart 
              experimentId={selectedExperimentId} 
              config={experimentDetail.config}
              allResults={allResults}
            />
          )}

          {/* 所有运行结果 */}
          <Card title={t('parallelLab.report.runResultsDetail')}>
            {allResults.length > 0 ? (
              <Table
                dataSource={allResults}
                columns={resultsColumns}
                rowKey="action_task_id"
                pagination={{ pageSize: 10 }}
                size="small"
              />
            ) : (
              <Empty description={t('parallelLab.report.noRunResults')} />
            )}
          </Card>

          {/* 导出选项 */}
          <Card title={t('parallelLab.report.export')} style={{ marginTop: 24 }} size="small">
            <Space>
              <Button icon={<DownloadOutlined />} onClick={() => handleExportCSV()}>
                {t('parallelLab.report.exportCsv')}
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleExportJSON()}>
                {t('parallelLab.report.exportJson')}
              </Button>
            </Space>
          </Card>
        </>
      )}
    </div>
  );
};

// 参数 vs 指标可视化图表组件
const ParameterMetricChart: React.FC<{ results: any[]; config: any }> = ({ results, config }) => {
  const { t } = useTranslation();
  const chartOption = useMemo(() => {
    if (!results.length) return null;
    
    // 获取参数名和目标变量名
    const paramNames = Object.keys(config?.variables || {});
    const objectives = config?.objectives || [];
    const metricName = objectives[0]?.variable || Object.keys(results[0]?.metrics || {})[0];
    
    if (!paramNames.length || !metricName) return null;
    
    // 只取第一个参数做 X 轴（简化处理）
    const paramName = paramNames[0];
    
    // 准备数据：按参数值排序
    const data = results
      .map(r => ({
        param: parseFloat(r.parameters?.[paramName]) || 0,
        metric: parseFloat(r.metrics?.[metricName]) || 0
      }))
      .sort((a, b) => a.param - b.param);
    
    return {
      title: { text: `${paramName} vs ${metricName}`, left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      xAxis: { 
        type: 'category', 
        name: paramName,
        data: data.map(d => d.param)
      },
      yAxis: { type: 'value', name: metricName },
      series: [{
        type: 'bar',
        data: data.map(d => d.metric),
        itemStyle: { color: '#1677ff' },
        label: { show: true, position: 'top', formatter: (p: any) => p.value.toFixed(2) }
      }]
    };
  }, [results, config]);

  if (!chartOption) return null;

  return (
    <Card title={t('parallelLab.report.paramVsMetric')} style={{ marginBottom: 24 }}>
      <ReactECharts option={chartOption} style={{ height: 300 }} />
    </Card>
  );
};

// 变量历史图表组件
const VariableHistoryChart: React.FC<{ experimentId: string; config: any; allResults: any[] }> = ({ 
  experimentId, 
  config,
  allResults 
}) => {
  const { t } = useTranslation();
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);

  // 获取所有可用的变量名（从目标变量和扫描变量中提取）
  const availableVariables = useMemo(() => {
    const vars = new Set<string>();
    
    // 从目标变量中提取
    const objectives = config?.objectives || [];
    objectives.forEach((obj: any) => {
      if (obj.variable) vars.add(obj.variable);
    });
    
    // 从扫描变量中提取
    const scanVars = config?.variables || {};
    Object.keys(scanVars).forEach(v => vars.add(v));
    
    // 从结果中提取指标变量
    if (allResults.length > 0) {
      const firstResult = allResults[0];
      if (firstResult.metrics) {
        Object.keys(firstResult.metrics).forEach(v => vars.add(v));
      }
    }
    
    return Array.from(vars);
  }, [config, allResults]);

  // 加载步骤数据
  const loadSteps = useCallback(async () => {
    if (!experimentId) return;
    
    setLoading(true);
    try {
      const response = await parallelExperimentApi.getExperimentSteps(experimentId);
      if (response.success && response.steps) {
        setSteps(response.steps);
      }
    } catch (error) {
      console.error('加载变量历史失败:', error);
      message.error(t('parallelLab.report.loadVariableHistoryFailed'));
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  // 设置默认选中的变量
  useEffect(() => {
    if (!selectedVariable && availableVariables.length > 0) {
      // 优先选择目标变量
      const objectives = config?.objectives || [];
      if (objectives.length > 0 && objectives[0].variable) {
        setSelectedVariable(objectives[0].variable);
      } else {
        setSelectedVariable(availableVariables[0]);
      }
    }
  }, [availableVariables, selectedVariable, config]);

  // 构建图表数据
  const chartOption = useMemo(() => {
    if (!selectedVariable || steps.length === 0) return null;

    // 按 action_task_id 分组
    const groupedByTask: Record<string, any[]> = {};
    steps.forEach(step => {
      if (!groupedByTask[step.action_task_id]) {
        groupedByTask[step.action_task_id] = [];
      }
      groupedByTask[step.action_task_id].push(step);
    });

    // 为每个任务排序并提取数据
    const series: any[] = [];
    const taskIds = Object.keys(groupedByTask);
    
    // 找到最大步骤数
    let maxSteps = 0;
    taskIds.forEach(taskId => {
      const taskSteps = groupedByTask[taskId].sort((a, b) => a.step_number - b.step_number);
      maxSteps = Math.max(maxSteps, taskSteps.length);
    });

    // 获取参数信息用于图例
    const getRunLabel = (taskId: string, index: number) => {
      const result = allResults.find(r => r.action_task_id === taskId);
      if (result && result.parameters) {
        const paramStr = Object.entries(result.parameters)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        return `Run ${index + 1} (${paramStr})`;
      }
      return `Run ${index + 1}`;
    };

    taskIds.forEach((taskId, index) => {
      const taskSteps = groupedByTask[taskId].sort((a, b) => a.step_number - b.step_number);
      const data = taskSteps.map(step => {
        const value = step.variables_snapshot?.[selectedVariable];
        return value !== undefined ? parseFloat(value) || 0 : null;
      });

      series.push({
        name: getRunLabel(taskId, index),
        type: 'line',
        data: data,
        smooth: true,
        connectNulls: true
      });
    });

    // X轴标签
    const xAxisData = Array.from({ length: maxSteps }, (_, i) => `Step ${i + 1}`);

    return {
      title: {
        text: t('parallelLab.report.variableTrend', { variable: selectedVariable }),
        left: 'center',
        textStyle: { fontSize: 14 }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let result = params[0]?.axisValue + '<br/>';
          params.forEach((param: any) => {
            if (param.value !== null && param.value !== undefined) {
              result += `${param.marker} ${param.seriesName}: ${param.value.toFixed(3)}<br/>`;
            }
          });
          return result;
        }
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        data: series.map(s => s.name)
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        name: t('parallelLab.report.step')
      },
      yAxis: {
        type: 'value',
        name: selectedVariable
      },
      series: series
    };
  }, [steps, selectedVariable, allResults, t]);

  if (loading) {
    return (
      <Card title={t('parallelLab.report.variableHistory')} style={{ marginBottom: 24 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (steps.length === 0) {
    return (
      <Card title={t('parallelLab.report.variableHistory')} style={{ marginBottom: 24 }}>
        <Empty description={t('parallelLab.report.noVariableHistory')} />
      </Card>
    );
  }

  return (
    <Card 
      title={
        <Space>
          <LineChartOutlined />
          <span>{t('parallelLab.report.variableHistory')}</span>
        </Space>
      }
      extra={
        <Select
          value={selectedVariable}
          onChange={setSelectedVariable}
          style={{ width: 200 }}
          placeholder={t('parallelLab.report.selectVariable')}
        >
          {availableVariables.map(v => (
            <Select.Option key={v} value={v}>{v}</Select.Option>
          ))}
        </Select>
      }
      style={{ marginBottom: 24 }}
    >
      {chartOption ? (
        <ReactECharts option={chartOption} style={{ height: 350 }} />
      ) : (
        <Empty description={t('parallelLab.report.selectVariableHint')} />
      )}
    </Card>
  );
};

export default AnalysisReport;
