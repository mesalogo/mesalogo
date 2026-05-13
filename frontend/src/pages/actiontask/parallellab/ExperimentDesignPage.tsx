import React, { useState, useEffect, useCallback } from 'react';
import { Typography, message, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ExperimentDesign from './ExperimentDesign';
import * as parallelExperimentApi from '../../../services/api/parallelExperiment';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { Title, Text } = Typography;

const ExperimentDesignPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionSpaces, setActionSpaces] = useState<any[]>([]);
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
      const formatted = spaces.map((space: any) => ({
        id: space.id,
        name: space.name,
        description: space.description,
        variables: space.environment_variables?.map((v: any) => v.name) || []
      }));
      setActionSpaces(formatted);
    } catch (error) {
      console.error('加载行动空间失败:', error);
      message.error(t('parallelLab.list.loadSpaceFailed'));
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActionSpaces();
  }, [loadActionSpaces]);

  const handleCreateExperiment = async (config?: any) => {
    if (!selectedSpace || !experimentConfig.name) {
      message.warning(t('parallelLab.list.selectSpaceAndName'));
      return;
    }

    setLoading(true);
    try {
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
        message.success(t('parallelLab.message.experimentCreated'));
        setExperimentConfig({
          name: '',
          description: '',
          parallelCount: 5,
          maxDuration: 30
        });
        setSelectedSpace(null);
        navigate('/parallel-lab/monitoring');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || t('parallelLab.message.experimentFailed'));
    } finally {
      setLoading(false);
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
            {t('parallelLab.experimentDesign')}
          </Title>
          <Text type="secondary">
            {t('parallelLab.designPage.subtitle')}
          </Text>
        </div>
      </div>

      <ExperimentDesign
        actionSpaces={actionSpaces}
        experimentConfig={experimentConfig}
        setExperimentConfig={setExperimentConfig}
        selectedSpace={selectedSpace}
        setSelectedSpace={setSelectedSpace}
        handleCreateExperiment={handleCreateExperiment}
        loading={loading}
      />
    </div>
  );
};

export default ExperimentDesignPage;
