import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Select, Spin, Row, Col, Statistic, Typography, Space, Divider, App } from 'antd';
import { ReloadOutlined, ClearOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import graphEnhancementAPI from '../../../services/api/graphEnhancement';
import api from '../../../services/api/axios';

const { Title, Text } = Typography;
const { Option } = Select;

const GraphVisualizationTab = ({ initialPartitionId }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const networkRef = useRef(null);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [partitionsLoading, setPartitionsLoading] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [databaseInfo, setDatabaseInfo] = useState(null);
  const [config, setConfig] = useState(null);
  const [groupId, setGroupId] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [partitions, setPartitions] = useState([]);

  // 网络配置
  const networkOptions = {
    nodes: {
      shape: 'dot',
      size: 20,
      font: {
        size: 14,
        color: '#333333'
      },
      borderWidth: 2,
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.2)',
        size: 5,
        x: 2,
        y: 2
      },
      color: {
        border: '#2B7CE9',
        background: '#97C2FC',
        highlight: {
          border: '#2B7CE9',
          background: '#D2E5FF'
        }
      }
    },
    edges: {
      width: 2,
      color: {
        color: '#848484',
        highlight: '#2B7CE9'
      },
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 1,
          type: 'arrow'
        }
      },
      smooth: {
        enabled: true,
        type: 'continuous',
        roundness: 0.5
      }
    },
    physics: {
      enabled: true,
      stabilization: {
        iterations: 100
      },
      barnesHut: {
        gravitationalConstant: -2000,
        centralGravity: 0.3,
        springLength: 95,
        springConstant: 0.04,
        damping: 0.09
      }
    },
    interaction: {
      hover: true,
      selectConnectedEdges: false
    }
  };

  // 初始化网络
  useEffect(() => {
    if (networkRef.current && !network) {
      const nodes = new DataSet();
      const edges = new DataSet();
      const data = { nodes, edges };

      const networkInstance = new Network(networkRef.current, data, networkOptions);
      setNetwork(networkInstance);
    }
  }, [networkRef.current]);

  // 添加点击事件监听器
  useEffect(() => {
    if (network) {
      const handleClick = (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];

          // 从当前graphData中查找节点信息
          const nodeData = graphData.nodes?.find(node => node.id === nodeId);

          if (nodeData) {
            setSelectedNode(nodeData);
          } else {
            // 如果从graphData中找不到，尝试从网络的DataSet中获取
            const networkData = network.getDataSet();
            if (networkData && networkData.nodes) {
              const networkNode = networkData.nodes.get(nodeId);
              if (networkNode) {
                setSelectedNode(networkNode);
              }
            }
          }
        } else {
          setSelectedNode(null);
        }
      };

      network.on('click', handleClick);

      // 清理函数
      return () => {
        network.off('click', handleClick);
      };
    }
  }, [network, graphData]);

  // 加载配置信息
  useEffect(() => {
    loadConfig();
    loadDatabaseInfo();
    loadPartitions();
  }, []);

  // 处理初始分区ID
  useEffect(() => {
    if (initialPartitionId) {
      setGroupId(initialPartitionId);
      // 延迟加载图谱数据，确保组件已完全初始化
      const timer: any = setTimeout(() => {
        loadGraphData();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPartitionId]);

  const loadConfig = async () => {
    try {
      const response = await graphEnhancementAPI.getVisualizationConfig();
      if (response.success) {
        setConfig(response.data);
      }
    } catch (error) {
      console.error('Load config failed:', error);
    }
  };

  const loadDatabaseInfo = async () => {
    try {
      const response = await graphEnhancementAPI.getVisualizationInfo();
      if (response.success) {
        setDatabaseInfo(response.data);
      }
    } catch (error) {
      console.error('Load database info failed:', error);
    }
  };

  const loadPartitions = async () => {
    try {
      setPartitionsLoading(true);
      const response = await api.get('/memory/partitions');
      const data = response.data;

      if (data.success) {
        setPartitions(data.data);
      } else {
        console.error('Load partitions failed:', data.message);
      }
    } catch (error) {
      console.error('Load partitions failed:', error);
    } finally {
      setPartitionsLoading(false);
    }
  };

  const loadGraphData = async () => {
    if (!config || !config.enabled) {
      message.warning(t('memory.graph.notEnabled'));
      return;
    }

    setLoading(true);
    try {
      const params = groupId ? { group_id: groupId } : {};
      const response = await graphEnhancementAPI.getVisualizationData(params);

      if (response.success) {
        const data = response.data;
        setGraphData(data);

        if (network) {
          const nodes = new DataSet(data.nodes || []);
          const edges = new DataSet(data.edges || []);
          network.setData({ nodes, edges });
        }

        message.success(t('memory.graph.loadSuccess', { nodes: data.nodes?.length || 0, edges: data.edges?.length || 0 }));
      } else {
        message.error(response.message || t('memory.graph.loadFailed'));
      }
    } catch (error) {
      console.error('Load graph data failed:', error);
      message.error(t('memory.graph.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const clearGraph = () => {
    if (network) {
      network.setData({ nodes: new DataSet(), edges: new DataSet() });
    }
    setGraphData({ nodes: [], edges: [] });
    setSelectedNode(null);
    message.info(t('memory.graph.cleared'));
  };

  const exportData = () => {
    if (!graphData.nodes || graphData.nodes.length === 0) {
      message.warning(t('memory.graph.noDataToExport'));
      return;
    }

    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph_data_${new Date().getTime()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    message.success(t('memory.graph.exported'));
  };

  return (
    <div>
      {/* 控制面板 */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Select
              showSearch
              allowClear
              placeholder={t('memory.graph.selectPartition')}
              value={groupId || undefined}
              onChange={(value) => setGroupId(value || '')}
              onSearch={(value) => setGroupId(value)}
              loading={partitionsLoading}
              style={{ width: '100%' }}
              filterOption={(input, option) =>
                option?.label?.toLowerCase().includes(input.toLowerCase()) ||
                option?.value?.toLowerCase().includes(input.toLowerCase())
              }
              options={partitions.map(partition => ({
                value: partition.id,
                label: `${partition.name} (${partition.id})`,
                partition: partition
              }))}
              optionRender={(option) => (
                <div>
                  <div style={{ fontWeight: 'bold' }}>{option.data.partition.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                    ID: {option.data.partition.id} |
                    {t('memory.graph.nodes')}: {option.data.partition.node_count || 0} |
                    {t('memory.graph.edges')}: {option.data.partition.edge_count || 0}
                  </div>
                </div>
              )}
            />
          </Col>
          <Col span={12}>
            <Space>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />} 
                onClick={loadGraphData}
                loading={loading}
              >
                {t('memory.graph.loadGraph')}
              </Button>
              <Button 
                icon={<ClearOutlined />} 
                onClick={clearGraph}
              >
                {t('common.clear')}
              </Button>
              <Button 
                icon={<DownloadOutlined />} 
                onClick={exportData}
              >
                {t('memory.graph.exportData')}
              </Button>
            </Space>
          </Col>
          <Col span={6}>
            <Text type="secondary">
              {t('memory.graph.framework')}: {config?.framework || t('common.unknown')} | 
              {t('memory.graph.status')}: {config?.enabled ? t('common.enabled') : t('common.disabled')}
            </Text>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 图谱可视化区域 */}
        <Col span={18}>
          <Card title={t('memory.graph.graphView')} style={{ height: '600px' }}>
            <Spin spinning={loading}>
              <div 
                ref={networkRef} 
                style={{ 
                  height: '520px', 
                  width: '100%',
                  border: '1px solid var(--custom-border)',
                  borderRadius: '6px'
                }} 
              />
            </Spin>
          </Card>
        </Col>

        {/* 信息面板 */}
        <Col span={6}>
          {/* 统计信息 */}
          <Card title={t('memory.graph.statistics')} style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic 
                  title={t('memory.graph.nodeCount')} 
                  value={graphData.nodes?.length || 0} 
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title={t('memory.graph.edgeCount')} 
                  value={graphData.edges?.length || 0} 
                  styles={{ content: { color: '#cf1322' } }}
                />
              </Col>
            </Row>
            {databaseInfo && (
              <>
                <Divider />
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic 
                      title={t('memory.graph.totalEntities')} 
                      value={databaseInfo.entity_count || 0} 
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic 
                      title={t('memory.graph.totalRelations')} 
                      value={databaseInfo.relationship_count || 0} 
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary">
                    {t('memory.graph.partitionCount')}: {databaseInfo.group_ids?.length || 0}
                  </Text>
                </div>
              </>
            )}
          </Card>

          {/* 节点详情 */}
          <Card title={t('memory.graph.nodeDetails')} style={{ marginBottom: '16px' }}>
            {selectedNode ? (
              <div>
                <div>
                  <Text strong>{t('memory.graph.name')}: </Text>
                  <Text>{selectedNode.label || selectedNode.name || t('common.unknown')}</Text>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text strong>ID: </Text>
                  <Text code>{selectedNode.id || selectedNode.uuid || t('common.unknown')}</Text>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text strong>{t('memory.graph.group')}: </Text>
                  <Text>{selectedNode.group || selectedNode.group_id || t('common.unknown')}</Text>
                </div>
                {(selectedNode.title || selectedNode.summary) && (
                  <div style={{ marginTop: '8px' }}>
                    <Text strong>{t('memory.graph.description')}: </Text>
                    <Text>{selectedNode.title || selectedNode.summary}</Text>
                  </div>
                )}
                {selectedNode.labels && selectedNode.labels.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <Text strong>{t('memory.graph.labels')}: </Text>
                    <div style={{ marginTop: '4px' }}>
                      {selectedNode.labels.map((label, index) => (
                        <span key={index} style={{
                          display: 'inline-block',
                          background: 'var(--custom-hover-bg)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginRight: '4px',
                          fontSize: '12px'
                        }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedNode.created_at && (
                  <div style={{ marginTop: '8px' }}>
                    <Text strong>{t('memory.graph.createdAt')}: </Text>
                    <Text type="secondary">{new Date(selectedNode.created_at).toLocaleString()}</Text>
                  </div>
                )}
                {selectedNode.attributes && Object.keys(selectedNode.attributes).length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <Text strong>{t('memory.graph.attributes')}: </Text>
                    <div style={{ marginTop: '4px' }}>
                      {Object.entries(selectedNode.attributes).map(([key, value]) => (
                        <div key={key} style={{ marginLeft: '8px', fontSize: '12px' }}>
                          <Text type="secondary">{key}: </Text>
                          <Text>{String(value)}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <Text strong>{t('memory.graph.otherProperties')}: </Text>
                    <div style={{ marginTop: '4px' }}>
                      {Object.entries(selectedNode.properties).map(([key, value]) => (
                        <div key={key} style={{ marginLeft: '8px', fontSize: '12px' }}>
                          <Text type="secondary">{key}: </Text>
                          <Text>{String(value)}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <InfoCircleOutlined style={{ fontSize: '24px', color: 'var(--custom-border)', marginBottom: '8px' }} />
                <div>
                  <Text type="secondary">{t('memory.graph.clickNodeHint')}</Text>
                </div>
              </div>
            )}
          </Card>

          {/* 配置信息 */}
          {config && (
            <Card title={t('memory.graph.configInfo')}>
              <div>
                <Text strong>{t('memory.graph.databaseType')}: </Text>
                <Text>{config.database_type}</Text>
              </div>
              <div style={{ marginTop: '8px' }}>
                <Text strong>{t('memory.graph.connectionUri')}: </Text>
                <Text code>{config.neo4j_uri}</Text>
              </div>
              <div style={{ marginTop: '8px' }}>
                <Text strong>{t('memory.graph.username')}: </Text>
                <Text>{config.neo4j_user}</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default GraphVisualizationTab;
