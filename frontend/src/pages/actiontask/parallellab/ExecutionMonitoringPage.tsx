import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Typography, message, Skeleton, Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import ExecutionMonitoring from './ExecutionMonitoring';
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';

const { Title, Text } = Typography;

const ExecutionMonitoringPage = () => {
  const { t } = useTranslation();
  const [allExperiments, setAllExperiments] = useState<any[]>([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const isFirstLoad = useRef(true);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // 加载实验列表
  const loadExperiments = useCallback(async () => {
    try {
      const response = await parallelExperimentApi.listExperiments({
        include_templates: false
      });
      if (response.success && response.experiments) {
        // 显示所有非模板实验（包括已完成、已停止、失败的）
        const allExps = response.experiments
          .filter((exp: any) => ['running', 'paused', 'completed', 'stopped', 'failed'].includes(exp.status))
          .map((exp: any) => ({
            id: exp.id,
            name: exp.name,
            description: exp.description,
            actionSpaceId: exp.source_action_space_id,
            actionSpaceName: exp.source_action_space_name,
            parallelCount: exp.total_runs,
            status: exp.status,
            progress: exp.total_runs > 0 
              ? Math.round((exp.completed_runs + exp.failed_runs) / exp.total_runs * 100) 
              : 0,
            startTime: exp.start_time,
            endTime: exp.end_time,
            isTemplate: exp.is_template,
            completedRuns: exp.completed_runs,
            failedRuns: exp.failed_runs,
            totalRuns: exp.total_runs,
            total_runs: exp.total_runs,
            completed_runs: exp.completed_runs,
            failed_runs: exp.failed_runs,
            current_iteration: exp.current_iteration,
            config: exp.config,
            results: exp.results_summary
          }));
        setAllExperiments(allExps);
        
        // 只在首次加载时自动选择实验
        if (isFirstLoad.current && allExps.length > 0) {
          isFirstLoad.current = false;
          const runningExp = allExps.find((e: any) => e.status === 'running');
          setSelectedExperimentId(runningExp?.id || allExps[0].id);
        }
      }
    } catch (error) {
      console.error('加载实验列表失败:', error);
      message.error(t('parallelLab.monitor.loadListFailed'));
    } finally {
      setPageLoading(false);
    }
  }, []);

  // 根据选择的实验ID更新显示的实验
  useEffect(() => {
    if (selectedExperimentId) {
      const selected = allExperiments.find(e => e.id === selectedExperimentId);
      setExperiments(selected ? [selected] : []);
    } else {
      setExperiments([]);
    }
  }, [selectedExperimentId, allExperiments]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  // 轮询运行中的实验状态
  useEffect(() => {
    const runningExperiments = experiments.filter(e => e.status === 'running' || e.status === 'paused');
    if (runningExperiments.length === 0) return;

    const interval = setInterval(async () => {
      for (const exp of runningExperiments) {
        try {
          const status = await parallelExperimentApi.getExperimentStatus(exp.id);
          if (status.success) {
            setExperiments(prev => prev.map(e => {
              if (e.id !== exp.id) return e;
              return {
                ...e,
                status: status.status,
                progress: status.total_runs > 0 
                  ? Math.round((status.completed_runs + status.failed_runs) / status.total_runs * 100) 
                  : 0,
                completedRuns: status.completed_runs,
                failedRuns: status.failed_runs,
                results: status.results_summary
              };
            }));
          }
        } catch (error) {
          console.error('获取实验状态失败:', error);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [experiments]);

  const handleStopExperiment = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.stopExperiment(experimentId);
      if (response.success) {
        message.success(t('parallelLab.monitor.experimentStopped'));
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || t('parallelLab.list.stopFailed'));
    }
  };

  const handlePauseExperiment = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.pauseExperiment(experimentId);
      if (response.success) {
        message.success(t('parallelLab.monitor.experimentPaused'));
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || t('parallelLab.list.pauseFailed'));
    }
  };

  const handleResumeExperiment = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.resumeExperiment(experimentId);
      if (response.success) {
        message.success(t('parallelLab.monitor.experimentResumed'));
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || t('parallelLab.list.resumeFailed'));
    }
  };

  if (pageLoading) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton.Input active style={{ width: 150 }} />
            <Skeleton.Input active size="small" style={{ width: 200 }} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 400 }} />
        </div>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  // 获取状态标签
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      running: t('parallelLab.list.status.running'),
      paused: t('parallelLab.list.status.paused'),
      completed: t('parallelLab.list.status.completed'),
      stopped: t('parallelLab.list.status.stopped'),
      failed: t('parallelLab.list.status.failed')
    };
    return statusMap[status] || status;
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
            {t('parallelLab.executionMonitoring')}
          </Title>
          <Text type="secondary">
            {t('parallelLab.monitorPage.subtitle')}
          </Text>
        </div>
      </div>

      {/* 实验选择器 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text>{t('parallelLab.monitorPage.selectExperiment')}：</Text>
          <Select
            placeholder={t('parallelLab.monitorPage.selectPlaceholder')}
            style={{ width: 400 }}
            value={selectedExperimentId}
            onChange={setSelectedExperimentId}
            showSearch
            optionFilterProp="children"
          >
            {allExperiments.map(exp => (
              <Select.Option key={exp.id} value={exp.id}>
                {exp.name} ({getStatusLabel(exp.status)})
              </Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      <ExecutionMonitoring
        experiments={experiments}
        handleStopExperiment={handleStopExperiment}
        handlePauseExperiment={handlePauseExperiment}
        handleResumeExperiment={handleResumeExperiment}
      />
    </div>
  );
};

export default ExecutionMonitoringPage;
