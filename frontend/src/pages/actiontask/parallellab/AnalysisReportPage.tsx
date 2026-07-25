import React, { useState, useEffect, useCallback } from 'react';
import { App, Skeleton, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
import AnalysisReport from './AnalysisReport';
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';
import ParallelLabWorkspaceHeader from './ParallelLabWorkspaceHeader';

const AnalysisReportPage = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // 加载已完成的实验
  const loadExperiments = useCallback(async () => {
    try {
      const response = await parallelExperimentApi.listAllExperiments({
        include_templates: false
      });
      if (response.success && response.experiments) {
        // 只显示已完成的实验
        const completedExps = response.experiments
          .filter((exp: any) => exp.status === 'completed' || exp.status === 'stopped')
          .map((exp: any) => ({
            id: exp.id,
            name: exp.name,
            description: exp.description,
            actionSpaceId: exp.source_action_space_id,
            actionSpaceName: exp.source_action_space_name,
            parallelCount: exp.total_runs,
            status: exp.status,
            progress: 100,
            startTime: exp.start_time,
            endTime: exp.end_time,
            config: exp.config,
            totalRuns: exp.total_runs,
            completedRuns: exp.completed_runs,
            failedRuns: exp.failed_runs,
            results: exp.results_summary
          }));
        setExperiments(completedExps);
      }
    } catch (error) {
      console.error('加载实验列表失败:', error);
      message.error(t('parallelLab.monitor.loadListFailed'));
    } finally {
      setPageLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  if (pageLoading) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton.Input active style={{ width: 150 }} />
            <Skeleton.Input active size="small" style={{ width: 200 }} />
          </div>
        </div>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Col>
          <Col span={16}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div>
      <ParallelLabWorkspaceHeader activeKey="analysis" />

      <AnalysisReport experiments={experiments} />
    </div>
  );
};

export default AnalysisReportPage;
