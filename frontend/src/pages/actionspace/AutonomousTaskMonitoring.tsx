import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Tooltip,
  Modal,
  Descriptions,
  Badge,
  Select,
  DatePicker,
  Form,
  Row,
  Col,
  Statistic,
  Progress,
  Typography,
  App
} from 'antd';
import {
  RobotOutlined,
  PlayCircleOutlined,

  StopOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { actionTaskAPI } from '../../services/api/actionTask';
import conversationAPI from '../../services/api/conversation';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

/**
 * Autonomous task monitoring
 */
const AutonomousTaskMonitoring = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [autonomousTasks, setAutonomousTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [actionTasks, setActionTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    completed: 0,
    stopped: 0
  });

  // 过滤条件
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    actionTaskId: 'all',
    dateRange: null
  });

  // 获取所有自主行动数据
  const fetchAutonomousTasks = async () => {
    setLoading(true);
    try {
      // 首先获取所有行动任务
      const tasksResponse = await actionTaskAPI.getAll(true);
      setActionTasks(tasksResponse);

      // 获取所有自主行动
      const allAutonomousTasks = [];

      for (const task of tasksResponse) {
        if (task.conversations && task.conversations.length > 0) {
          for (const conversation of task.conversations) {
            try {
              const autonomousResponse = await conversationAPI.getAutonomousTasks(task.id, conversation.id);
              if (autonomousResponse.autonomous_tasks && autonomousResponse.autonomous_tasks.length > 0) {
                autonomousResponse.autonomous_tasks.forEach(autonomousTask => {
                  allAutonomousTasks.push({
                    ...autonomousTask,
                    actionTaskId: task.id,
                    actionTaskName: task.name,
                    conversationId: conversation.id,
                    conversationName: conversation.name || t('autoMon.fallbackConvName', { id: conversation.id })
                  });
                });
              }
            } catch (error) {
              console.error(`fetch autonomous tasks failed for task ${task.id} conversation ${conversation.id}:`, error);
            }
          }
        }
      }

      setAutonomousTasks(allAutonomousTasks);
      setFilteredTasks(allAutonomousTasks);

      // 计算统计数据
      const stats = {
        total: allAutonomousTasks.length,
        active: allAutonomousTasks.filter(t => t.status === 'active').length,
        completed: allAutonomousTasks.filter(t => t.status === 'completed').length,
        stopped: allAutonomousTasks.filter(t => t.status === 'stopped').length,

      };
      setStatistics(stats);

    } catch (error) {
      console.error('fetch autonomous data failed:', error);
      message.error(t('autoMon.msg.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchAutonomousTasks();

    // 设置定时刷新
    const interval = setInterval(fetchAutonomousTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  // 应用过滤条件
  useEffect(() => {
    let filtered = [...autonomousTasks];

    // 状态过滤
    if (filters.status !== 'all') {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    // 类型过滤
    if (filters.type !== 'all') {
      filtered = filtered.filter(task => task.type === filters.type);
    }

    // 行动任务过滤
    if (filters.actionTaskId !== 'all') {
      filtered = filtered.filter(task => task.actionTaskId === filters.actionTaskId);
    }

    // 时间范围过滤
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.created_at);
        return taskDate >= startDate.toDate() && taskDate <= endDate.toDate();
      });
    }

    setFilteredTasks(filtered);
  }, [filters, autonomousTasks]);

  // 停止自主行动
  const handleStopTask = async (task) => {
    try {
      await conversationAPI.stopAutonomousTask(task.actionTaskId, task.conversationId, task.id);
      message.success(t('autoMon.msg.stopSuccess'));
      fetchAutonomousTasks();
    } catch (error) {
      console.error('stop autonomous task failed:', error);
      message.error(t('autoMon.msg.stopFailed'));
    }
  };

  // 查看详情
  const showDetail = (task) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  // status tag
  const getStatusTag = (status) => {
    const statusConfig = {
      active: { color: 'green', icon: <PlayCircleOutlined />, text: t('autoMon.status.active') },
      completed: { color: 'blue', icon: <CheckCircleOutlined />, text: t('autoMon.status.completed') },
      stopped: { color: 'red', icon: <StopOutlined />, text: t('autoMon.status.stopped') }
    };

    const config = statusConfig[status] || { color: 'default', icon: <ClockCircleOutlined />, text: status };

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // type tag
  const getTypeTag = (type) => {
    const typeConfig = {
      discussion: { color: 'blue', text: t('autoMon.type.discussion') },
      conditional_stop: { color: 'purple', text: t('autoMon.type.conditional_stop') },
      variable_trigger: { color: 'cyan', text: t('autoMon.type.variable_trigger') },
      time_trigger: { color: 'orange', text: t('autoMon.type.time_trigger') }
    };

    const config = typeConfig[type] || { color: 'default', text: type };

    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: t('autoMon.col.actionTask'),
      dataIndex: 'actionTaskName',
      key: 'actionTaskName',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('autoMon.col.conversation'),
      dataIndex: 'conversationName',
      key: 'conversationName',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('autoMon.col.type'),
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => getTypeTag(type),
    },
    {
      title: t('autoMon.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: t('autoMon.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: t('autoMon.col.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: t('autoMon.col.actions'),
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('autoMon.action.view')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => showDetail(record)}
            />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title={t('autoMon.action.stop')}>
              <Button
                type="text"
                icon={<StopOutlined />}
                danger
                onClick={() => handleStopTask(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('autoMon.stat.total')}
              value={statistics.total}
              prefix={<RobotOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('autoMon.status.active')}
              value={statistics.active}
              prefix={<PlayCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('autoMon.status.completed')}
              value={statistics.completed}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('autoMon.status.stopped')}
              value={statistics.stopped}
              prefix={<StopOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* filters */}
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <Form.Item label={t('autoMon.col.status')}>
            <Select
              value={filters.status}
              style={{ width: 120 }}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <Option value="all">{t('autoMon.filter.all')}</Option>
              <Option value="active">{t('autoMon.status.active')}</Option>
              <Option value="completed">{t('autoMon.status.completed')}</Option>
              <Option value="stopped">{t('autoMon.status.stopped')}</Option>
            </Select>
          </Form.Item>
          <Form.Item label={t('autoMon.col.type')}>
            <Select
              value={filters.type}
              style={{ width: 120 }}
              onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
            >
              <Option value="all">{t('autoMon.filter.all')}</Option>
              <Option value="discussion">{t('autoMon.type.discussion')}</Option>
              <Option value="conditional_stop">{t('autoMon.type.conditional_stop')}</Option>
              <Option value="variable_trigger">{t('autoMon.type.variable_trigger')}</Option>
              <Option value="time_trigger">{t('autoMon.type.time_trigger')}</Option>
            </Select>
          </Form.Item>
          <Form.Item label={t('autoMon.col.actionTask')}>
            <Select
              value={filters.actionTaskId}
              style={{ width: 180 }}
              onChange={(value) => setFilters(prev => ({ ...prev, actionTaskId: value }))}
            >
              <Option value="all">{t('autoMon.filter.all')}</Option>
              {actionTasks.map(task => (
                <Option key={task.id} value={task.id.toString()}>{task.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label={t('autoMon.filter.dateRange')}>
            <RangePicker
              showTime
              value={filters.dateRange}
              onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={fetchAutonomousTasks}
            >
              {t('autoMon.action.refresh')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* autonomous task list */}
      <Card title={t('autoMon.listTitle', { count: filteredTasks.length })}>
        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => t('autoMon.paginationRange', { from: range[0], to: range[1], total }),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* detail modal */}
      <Modal
        title={t('autoMon.detailTitle')}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedTask && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="ID">{selectedTask.id}</Descriptions.Item>
            <Descriptions.Item label={t('autoMon.col.status')}>{getStatusTag(selectedTask.status)}</Descriptions.Item>
            <Descriptions.Item label={t('autoMon.col.type')}>{getTypeTag(selectedTask.type)}</Descriptions.Item>
            <Descriptions.Item label={t('autoMon.col.actionTask')}>{selectedTask.actionTaskName}</Descriptions.Item>
            <Descriptions.Item label={t('autoMon.col.conversation')}>{selectedTask.conversationName}</Descriptions.Item>
            <Descriptions.Item label={t('autoMon.col.createdAt')}>
              {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('autoMon.col.updatedAt')}>
              {selectedTask.updated_at ? new Date(selectedTask.updated_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('autoMon.col.config')} span={2}>
              <pre style={{ background: 'var(--custom-hover-bg)', padding: '8px', borderRadius: '4px' }}>
                {JSON.stringify(selectedTask.config, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AutonomousTaskMonitoring;
