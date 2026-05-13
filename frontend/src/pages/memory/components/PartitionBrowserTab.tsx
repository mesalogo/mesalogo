import React, { useState, useEffect } from 'react';
import {
  List,
  Card,
  Button,
  Input,
  Empty,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Modal,
  Spin,
  Alert,
  App
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  NodeIndexOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api/axios';
import PartitionDetailModal from './PartitionDetailModal';

const { Title, Text } = Typography;
const { Search } = Input;

const PartitionBrowserTab = ({ config, overview, onRefresh, onSwitchToGraphTab }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [partitions, setPartitions] = useState([]);
  const [filteredPartitions, setFilteredPartitions] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedPartition, setSelectedPartition] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const loadPartitions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/memory/partitions');
      const data = response.data;

      if (data.success) {
        setPartitions(data.data);
        setFilteredPartitions(data.data);
      } else {
        message.error(t('memory.partition.clearFailed') + ': ' + data.message);
      }
    } catch (error) {
      console.error('Load partitions failed:', error);
      message.error(t('memory.partition.clearFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    if (config?.enabled) {
      loadPartitions();
    }
  }, [config]);

  // 搜索过滤
  useEffect(() => {
    if (!searchText) {
      setFilteredPartitions(partitions);
    } else {
      const filtered = partitions.filter(partition =>
        partition.name.toLowerCase().includes(searchText.toLowerCase()) ||
        partition.description.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredPartitions(filtered);
    }
  }, [searchText, partitions]);

  // 查看分区详情
  const handleViewPartition = (partition) => {
    setSelectedPartition(partition);
    setDetailModalVisible(true);
  };

  const handleClearPartition = (partition) => {
    Modal.confirm({
      title: t('memory.partition.confirmClear'),
      content: t('memory.partition.confirmClearContent', { name: partition.name }),
      okText: t('common.confirm'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          const response = await api.post(`/memory/partition/${partition.id}/clear`);
          const data = response.data;

          if (data.success) {
            message.success(t('memory.partition.clearSuccess'));
            loadPartitions();
            onRefresh && onRefresh();
          } else {
            message.error(t('memory.partition.clearFailed') + ': ' + data.message);
          }
        } catch (error) {
          console.error('Clear partition failed:', error);
          message.error(t('memory.partition.clearFailed'));
        }
      },
    });
  };

  // 查看完整图谱
  const handleViewFullGraph = (partitionId) => {
    if (onSwitchToGraphTab) {
      onSwitchToGraphTab(partitionId);
    }
  };

  const renderPartitionTypeTag = (type) => {
    const typeConfig = {
      'action_space': { color: 'blue', text: t('memory.partition.type.actionSpace') },
      'action_task': { color: 'green', text: t('memory.partition.type.actionTask') },
      'role': { color: 'orange', text: t('memory.partition.type.role') },
      'agent': { color: 'purple', text: t('memory.partition.type.agent') }
    };
    
    const cfg = typeConfig[type] || { color: 'default', text: type };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  const renderPartitionItem = (partition) => (
    <List.Item
      key={partition.id}
      actions={[
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => handleViewPartition(partition)}
          style={{ color: '#1677ff' }}
        >
          {t('memory.partition.view')}
        </Button>,
        <Button
          type="text"
          icon={<DeleteOutlined />}
          danger
          onClick={() => handleClearPartition(partition)}
        >
          {t('memory.partition.clear')}
        </Button>
      ]}
    >
      <List.Item.Meta
        avatar={<DatabaseOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
        title={
          <Space>
            {partition.name}
            {renderPartitionTypeTag(partition.type)}
          </Space>
        }
        description={
          <div>
            <Text type="secondary">{partition.description}</Text>
            <br />
            <Space size="large" style={{ marginTop: 8 }}>
              <Text type="secondary">
                <NodeIndexOutlined /> {t('memory.graph.nodes')}: {partition.node_count || 0}
              </Text>
              <Text type="secondary">
                {t('memory.graph.edges')}: {partition.edge_count || 0}
              </Text>
            </Space>
          </div>
        }
      />
    </List.Item>
  );

  if (!config?.enabled) {
    return (
      <div>
        <Alert
          message={t('memory.partition.notEnabled')}
          description={t('memory.partition.notEnabledDesc')}
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return (
    <div>
      <Card
        title={t('memory.partition.list')}
        extra={
          <Space>
            <Search
              placeholder={t('memory.partition.search')}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={loadPartitions}
              loading={loading}
            >
              {t('refresh')}
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {filteredPartitions.length > 0 ? (
            <List
              dataSource={filteredPartitions}
              renderItem={renderPartitionItem}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  t('memory.partition.pageInfo', { start: range[0], end: range[1], total })
              }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                searchText ? t('memory.partition.noMatch') : t('memory.partition.noData')
              }
            />
          )}
        </Spin>
      </Card>

      {/* 分区详情模态框 */}
      <PartitionDetailModal
        visible={detailModalVisible}
        partition={selectedPartition}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedPartition(null);
        }}
        onViewFullGraph={handleViewFullGraph}
      />
    </div>
  );
};

export default PartitionBrowserTab;
