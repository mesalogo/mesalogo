import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Tabs,
  message,
  Skeleton
} from 'antd';
import {
  SettingOutlined,
  MonitorOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// 导入拆分后的组件
import ExperimentDesign from './ExperimentDesign';
import ExecutionMonitoring from './ExecutionMonitoring';
import AnalysisReport from './AnalysisReport';

// 导入 API 服务
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { Title, Text } = Typography;

const ParallelLab = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('design');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionSpaces, setActionSpaces] = useState<any[]>([]);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [experimentConfig, setExperimentConfig] = useState({
    name: '',
    description: '',
    parallelCount: 5,
    maxDuration: 30
  });

  // 加载行动空间列表
  const loadActionSpaces = useCallback(async () => {
    try {
      const spaces = await actionSpaceAPI.getAll();
      // 转换为组件需要的格式
      const formatted = spaces.map((space: any) => ({
        id: space.id,
        name: space.name,
        description: space.description,
        variables: space.environment_variables?.map((v: any) => v.name) || []
      }));
      setActionSpaces(formatted);
    } catch (error) {
      console.error('加载行动空间失败:', error);
      message.error('加载行动空间失败');
    }
  }, []);

  // 加载实验列表
  const loadExperiments = useCallback(async () => {
    try {
      const response = await parallelExperimentApi.listExperiments({
        include_templates: true
      });
      if (response.success && response.experiments) {
        // 转换为组件需要的格式
        const exps = response.experiments.map((exp: any) => ({
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
          config: exp.config,
          results: exp.results_summary
        }));
        setExperiments(exps);
      }
    } catch (error) {
      console.error('加载实验列表失败:', error);
      message.error('加载实验列表失败');
    }
  }, []);

  // 初始加载
  useEffect(() => {
    const init = async () => {
      setPageLoading(true);
      await Promise.all([loadActionSpaces(), loadExperiments()]);
      setPageLoading(false);
    };
    init();
  }, [loadActionSpaces, loadExperiments]);

  // 轮询运行中的实验状态
  useEffect(() => {
    const runningExperiments = experiments.filter(e => e.status === 'running');
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
    }, 10000); // 每10秒轮询一次

    return () => clearInterval(interval);
  }, [experiments]);

  // 创建并行实验
  const handleCreateExperiment = async (config?: any) => {
    if (!selectedSpace || !experimentConfig.name) {
      message.warning('请选择行动空间并填写实验名称');
      return;
    }

    setLoading(true);
    try {
      // 构建实验配置
      const expConfig: parallelExperimentApi.ExperimentConfig = {
        name: experimentConfig.name,
        description: experimentConfig.description,
        source_action_space_id: selectedSpace,
        variables: config?.variables || {},
        objectives: config?.objectives || [],
        stop_conditions: config?.stopConditions || [],
        task_config: {
          type: 'discussion',
          rounds: config?.rounds || 3,
          topic: config?.topic
        }
      };

      const response = await parallelExperimentApi.createExperiment(expConfig);
      if (response.success) {
        message.success('实验创建成功');
        // 重新加载实验列表
        await loadExperiments();
        // 重置表单
        setExperimentConfig({
          name: '',
          description: '',
          parallelCount: 5,
          maxDuration: 30
        });
        setSelectedSpace(null);
        // 切换到监控标签
        setActiveTab('monitoring');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建实验失败');
    } finally {
      setLoading(false);
    }
  };

  // 停止实验
  const handleStopExperiment = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.stopExperiment(experimentId);
      if (response.success) {
        message.success('实验已停止');
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '停止实验失败');
    }
  };

  // 暂停实验
  const handlePauseExperiment = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.pauseExperiment(experimentId);
      if (response.success) {
        message.success('实验已暂停');
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '暂停实验失败');
    }
  };

  // 恢复实验
  const handleResumeExperiment = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.resumeExperiment(experimentId);
      if (response.success) {
        message.success('实验已恢复');
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '恢复实验失败');
    }
  };

  // 复制实验
  const handleCloneExperiment = async (experimentId: string, newName?: string) => {
    try {
      const response = await parallelExperimentApi.cloneExperiment(experimentId, newName);
      if (response.success) {
        message.success('实验复制成功');
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '复制实验失败');
    }
  };

  // 删除实验
  const handleDeleteExperiment = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.deleteExperiment(experimentId);
      if (response.success) {
        message.success('实验已删除');
        await loadExperiments();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除实验失败');
    }
  };

  // 使用最佳参数创建任务
  const handleCreateBestTask = async (experimentId: string) => {
    try {
      const response = await parallelExperimentApi.createBestTask(experimentId);
      if (response.success) {
        message.success('已使用最佳参数创建任务');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建任务失败');
    }
  };

  if (pageLoading) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton.Input active style={{ width: 200 }} />
            <Skeleton.Input active size="small" style={{ width: 300 }} />
          </div>
        </div>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

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
            {t('parallelLab.title')}
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal', marginLeft: 8 }}>
              BehaviorSpace
            </Text>
          </Title>
          <Text type="secondary">
            {t('parallelLab.subtitle')}
          </Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
            {
              key: 'design',
              label: (
                <span>
                  <SettingOutlined />
                  {t('parallelLab.experimentDesign')}
                </span>
              ),
              children: (
                <ExperimentDesign
                  actionSpaces={actionSpaces}
                  experimentConfig={experimentConfig}
                  setExperimentConfig={setExperimentConfig}
                  selectedSpace={selectedSpace}
                  setSelectedSpace={setSelectedSpace}
                  handleCreateExperiment={handleCreateExperiment}
                  loading={loading}
                />
              )
            },
            {
              key: 'monitoring',
              label: (
                <span>
                  <MonitorOutlined />
                  {t('parallelLab.executionMonitoring')}
                </span>
              ),
              children: (
                <ExecutionMonitoring
                  experiments={experiments}
                  handleStopExperiment={handleStopExperiment}
                  handlePauseExperiment={handlePauseExperiment}
                  handleResumeExperiment={handleResumeExperiment}
                />
              )
            },
            {
              key: 'analysis-report',
              label: (
                <span>
                  <BarChartOutlined />
                  {t('parallelLab.analysisReport')}
                </span>
              ),
              children: <AnalysisReport experiments={experiments} />
            }
          ]}
        />
    </div>
  );
};

export default ParallelLab;
