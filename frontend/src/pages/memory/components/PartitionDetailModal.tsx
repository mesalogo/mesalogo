import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Input,
  Button,
  List,
  Card,
  message,
  Empty,
  Typography,
  Space,
  Spin,
  Descriptions,
  Tag
} from 'antd';
import {
  NodeIndexOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api/axios';
import graphEnhancementAPI from '../../../services/api/graphEnhancement';

const { Title, Text } = Typography;

const PartitionDetailModal = ({ visible, partition, onClose, onViewFullGraph }: any) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [partitionStats, setPartitionStats] = useState(null);
  const [graphData, setGraphData] = useState(null);

  // 加载分区统计信息
  const loadPartitionStats = async (partitionId) => {
    try {
      const response = await api.get(`/memory/partition/${partitionId}/stats`);
      const data = response.data;

      if (data.success) {
        setPartitionStats(data.data);
      } else {
        console.error(t('memory.partition.loadStatsFailed', { reason: data.message }));
      }
    } catch (error) {
      console.error(t('memory.partition.loadStatsFailed', { reason: error }));
    }
  };

  // 加载分区图谱数据
  const loadGraphData = async (partitionId) => {
    try {
      setLoading(true);
      // 使用新的图谱增强API，传入group_id参数
      const response = await graphEnhancementAPI.getVisualizationData({ group_id: partitionId });

      if (response.success) {
        setGraphData(response.data);
      } else {
        message.error(t('memory.partition.loadGraphFailedWithReason', { reason: response.message }));
      }
    } catch (error) {
      console.error('Failed to load graph data:', error);
      message.error(t('memory.partition.loadGraphFailed'));
    } finally {
      setLoading(false);
    }
  };



  // 当分区变化时重新加载数据
  useEffect(() => {
    if (visible && partition) {
      setActiveTab('info');
      loadPartitionStats(partition.id);
      loadGraphData(partition.id);
    }
  }, [visible, partition]);

  // 渲染分区基本信息
  const renderPartitionInfo = () => (
    <div>
      <Descriptions column={2} bordered>
        <Descriptions.Item label={t('memory.partition.partitionId')}>
          {partition?.id}
        </Descriptions.Item>
        <Descriptions.Item label={t('memory.partition.partitionName')}>
          {partition?.name}
        </Descriptions.Item>
        <Descriptions.Item label={t('memory.partition.type')}>
          <Tag color="blue">{partition?.type}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('memory.partition.relatedEntity')}>
          {partition?.entity_name}
        </Descriptions.Item>
        <Descriptions.Item label={t('memory.partition.descriptionLabel')} span={2}>
          {partition?.description || t('memory.partition.noDescription')}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );

  // 渲染图谱数据
  const renderGraphData = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>{t('memory.partition.graphData')}</Text>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadGraphData(partition.id)}
            loading={loading}
          >
            {t('memory.partition.refresh')}
          </Button>
          {onViewFullGraph && (
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => {
                onViewFullGraph(partition.id);
                onClose();
              }}
            >
              {t('memory.partition.viewFullGraph')}
            </Button>
          )}
        </Space>
      </div>

      <Spin spinning={loading}>
        {graphData && graphData.nodes && graphData.nodes.length > 0 ? (
          <div>
            {/* 显示统计信息 */}
            {graphData.stats && (
              <Card style={{ marginBottom: 16 }}>
                <Space>
                  <Text strong>{t('memory.partition.graphStats')}</Text>
                  <Tag color="blue">{t('memory.partition.statNodes', { count: graphData.stats.entity_count || graphData.nodes.length })}</Tag>
                  <Tag color="green">{t('memory.partition.statRelations', { count: graphData.stats.relationship_count || graphData.edges?.length || 0 })}</Tag>
                  {graphData.stats.group_id && (
                    <Tag color="orange">{t('memory.partition.statPartition', { id: graphData.stats.group_id })}</Tag>
                  )}
                </Space>
              </Card>
            )}
            <Card title={t('memory.partition.nodesTitle', { count: graphData.nodes.length })} style={{ marginBottom: 16 }}>
              <List
                dataSource={graphData.nodes.slice(0, 10)}
                renderItem={(node: any) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<NodeIndexOutlined />}
                      title={node.label || node.id}
                      description={
                        <Space>
                          {node.group && <Tag color="blue">{node.group}</Tag>}
                          {node.title && (
                            <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
                              {node.title}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              {graphData.nodes.length > 10 && (
                <Text type="secondary">
                  {t('memory.partition.moreNodes', { count: graphData.nodes.length - 10 })}
                </Text>
              )}
            </Card>

            {graphData.edges && graphData.edges.length > 0 && (
              <Card title={t('memory.partition.relationsTitle', { count: graphData.edges.length })}>
                <List
                  dataSource={graphData.edges.slice(0, 5)}
                  renderItem={(edge: any) => (
                    <List.Item>
                      <Text>
                        {edge.from}
                        <Text type="secondary"> → </Text>
                        {edge.to}
                        <Tag style={{ marginLeft: 8 }}>{edge.label}</Tag>
                      </Text>
                      {edge.title && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {edge.title}
                          </Text>
                        </div>
                      )}
                    </List.Item>
                  )}
                />
                {graphData.edges.length > 5 && (
                  <Text type="secondary">
                    {t('memory.partition.moreRelations', { count: graphData.edges.length - 5 })}
                  </Text>
                )}
              </Card>
            )}
          </div>
        ) : (
          <Empty 
            description={graphData?.message || t('memory.partition.noGraphData')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Spin>
    </div>
  );



  return (
    <Modal
      title={`${t('memory.partition.detail')}: ${partition?.name || ''}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'info',
            label: t('memory.partition.basicInfo'),
            children: renderPartitionInfo()
          },
          {
            key: 'graph',
            label: t('memory.partition.graphData'),
            children: renderGraphData()
          }
        ]}
      />
    </Modal>
  );
};

export default PartitionDetailModal;
