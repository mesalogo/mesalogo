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
import api from '../../../services/api/axios';
import graphEnhancementAPI from '../../../services/api/graphEnhancement';

const { Title, Text } = Typography;

const PartitionDetailModal = ({ visible, partition, onClose, onViewFullGraph }: any) => {
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
        console.error('加载分区统计失败:', data.message);
      }
    } catch (error) {
      console.error('加载分区统计失败:', error);
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
        message.error(`加载图谱数据失败: ${response.message}`);
      }
    } catch (error) {
      console.error('加载图谱数据失败:', error);
      message.error('加载图谱数据失败');
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
        <Descriptions.Item label="分区ID">
          {partition?.id}
        </Descriptions.Item>
        <Descriptions.Item label="分区名称">
          {partition?.name}
        </Descriptions.Item>
        <Descriptions.Item label="分区类型">
          <Tag color="blue">{partition?.type}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="关联实体">
          {partition?.entity_name}
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {partition?.description || '无描述'}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );

  // 渲染图谱数据
  const renderGraphData = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>图谱数据</Text>
          <Button
           
            icon={<ReloadOutlined />}
            onClick={() => loadGraphData(partition.id)}
            loading={loading}
          >
            刷新
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
              查看完整图谱
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
                  <Text strong>图谱统计:</Text>
                  <Tag color="blue">节点: {graphData.stats.entity_count || graphData.nodes.length}</Tag>
                  <Tag color="green">关系: {graphData.stats.relationship_count || graphData.edges?.length || 0}</Tag>
                  {graphData.stats.group_id && (
                    <Tag color="orange">分区: {graphData.stats.group_id}</Tag>
                  )}
                </Space>
              </Card>
            )}
            <Card title={`节点 (${graphData.nodes.length})`} style={{ marginBottom: 16 }}>
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
                  还有 {graphData.nodes.length - 10} 个节点...
                </Text>
              )}
            </Card>

            {graphData.edges && graphData.edges.length > 0 && (
              <Card title={`关系 (${graphData.edges.length})`}>
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
                    还有 {graphData.edges.length - 5} 个关系...
                  </Text>
                )}
              </Card>
            )}
          </div>
        ) : (
          <Empty 
            description={graphData?.message || "暂无图谱数据"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Spin>
    </div>
  );



  return (
    <Modal
      title={`分区详情: ${partition?.name || ''}`}
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
            label: '基本信息',
            children: renderPartitionInfo()
          },
          {
            key: 'graph',
            label: '图谱数据',
            children: renderGraphData()
          }
        ]}
      />
    </Modal>
  );
};

export default PartitionDetailModal;
