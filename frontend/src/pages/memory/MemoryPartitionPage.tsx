import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Button,
  Spin,
  Alert,
  Typography,
  App,
  Space
} from 'antd';
import {
  EyeOutlined,
  ReloadOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api/axios';
import PartitionBrowserTab from './components/PartitionBrowserTab';
import GraphVisualizationTab from './components/GraphVisualizationTab';

const { Title, Text } = Typography;

const MemoryPartitionPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('browser');
  const [partitionConfig, setPartitionConfig] = useState(null);
  const [memoryOverview, setMemoryOverview] = useState(null);
  const [selectedPartitionId, setSelectedPartitionId] = useState(null);

  // 加载分区配置
  const loadPartitionConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/memory/partition-config');
      const data = response.data;

      if (data.success) {
        setPartitionConfig(data.data);
      } else {
        message.error(`${t('memory.loadConfigFailed')}: ${data.message}`);
      }
    } catch (error) {
      console.error('加载分区配置失败:', error);
      message.error(t('memory.loadConfigFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 加载记忆系统总览
  const loadMemoryOverview = async () => {
    try {
      const response = await api.get('/memory/overview');
      const data = response.data;

      if (data.success) {
        setMemoryOverview(data.data);
      } else {
        console.error('加载记忆系统总览失败:', data.message);
      }
    } catch (error) {
      console.error('加载记忆系统总览失败:', error);
    }
  };

  // 页面初始化
  useEffect(() => {
    loadPartitionConfig();
    loadMemoryOverview();
  }, []);

  // 刷新数据
  const handleRefresh = () => {
    loadPartitionConfig();
    loadMemoryOverview();
  };

  // 切换到图谱可视化tab
  const handleSwitchToGraphTab = (partitionId) => {
    setSelectedPartitionId(partitionId);
    setActiveTab('graph');
  };

  // 渲染页面头部
  const renderHeader = () => (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
            {t('memory.title')}
          </Title>
          <Text type="secondary">
            {t('memory.subtitle')}
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>
    </div>
  );

  // 渲染状态提示
  const renderStatusAlert = () => {
    if (!partitionConfig) return null;

    if (!partitionConfig.enabled) {
      return (
        <Alert
          message={t('memory.graphNotEnabled')}
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                {t('memory.graphNotEnabledDesc')}
              </div>
              <Text type="secondary">
                请先在图谱增强设置中启用 Graphiti 并配置分区策略和消息同步策略。
              </Text>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button 
              type="primary"
              onClick={() => navigate('/settings/graph-enhancement')}
            >
              {t('memory.goToSettings')}
            </Button>
          }
        />
      );
    }

    return null;
  };

  return (
    <div>
      {renderHeader()}
      {renderStatusAlert()}

      {/* 只有在图谱增强启用时才显示Tab */}
      {partitionConfig?.enabled ? (
        <Spin spinning={loading}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'browser',
                label: (
                  <span>
                    <EyeOutlined />
                    {t('memory.partitionBrowser')}
                  </span>
                ),
                children: (
                  <PartitionBrowserTab
                    config={partitionConfig}
                    overview={memoryOverview}
                    onRefresh={handleRefresh}
                    onSwitchToGraphTab={handleSwitchToGraphTab}
                  />
                )
              },
              {
                key: 'graph',
                label: (
                  <span>
                    <ApartmentOutlined />
                    {t('memory.graphVisualization')}
                  </span>
                ),
                children: (
                  <GraphVisualizationTab
                    initialPartitionId={selectedPartitionId}
                  />
                )
              }
            ]}
          />
        </Spin>
      ) : null}
    </div>
  );
};

export default MemoryPartitionPage;
