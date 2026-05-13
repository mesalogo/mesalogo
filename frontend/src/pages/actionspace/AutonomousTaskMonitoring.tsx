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

const { Text, Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

/**
 * 自主行动监控组件
 * 监控所有行动任务中的自主行动状态
 */
const AutonomousTaskMonitoring = () => {
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
                    conversationName: conversation.name || `会话 ${conversation.id}`
                  });
                });
              }
            } catch (error) {
              console.error(`获取任务 ${task.id} 会话 ${conversation.id} 的自主行动失败:`, error);
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
      console.error('获取自主行动数据失败:', error);
      message.error('获取自主行动数据失败');
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
      message.success('自主行动已停止');
      fetchAutonomousTasks();
    } catch (error) {
      console.error('停止自主行动失败:', error);
      message.error('停止自主行动失败');
    }
  };

  // 查看详情
  const showDetail = (task) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  // 获取状态标签
  const getStatusTag = (status) => {
    const statusConfig = {
      active: { color: 'green', icon: <PlayCircleOutlined />, text: '进行中' },
      completed: { color: 'blue', icon: <CheckCircleOutlined />, text: '已完成' },
      stopped: { color: 'red', icon: <StopOutlined />, text: '已停止' }
    };

    const config = statusConfig[status] || { color: 'default', icon: <ClockCircleOutlined />, text: status };

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取类型标签
  const getTypeTag = (type) => {
    const typeConfig = {
      discussion: { color: 'blue', text: '讨论模式' },
      conditional_stop: { color: 'purple', text: '条件停止' },
      variable_trigger: { color: 'cyan', text: '变量触发' },
      time_trigger: { color: 'orange', text: '时间触发' }
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
      title: '行动任务',
      dataIndex: 'actionTaskName',
      key: 'actionTaskName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '会话',
      dataIndex: 'conversationName',
      key: 'conversationName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => getTypeTag(type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
             
              onClick={() => showDetail(record)}
            />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title="停止">
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
      {/* 统计概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总自主行动"
              value={statistics.total}
              prefix={<RobotOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={statistics.active}
              prefix={<PlayCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statistics.completed}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已停止"
              value={statistics.stopped}
              prefix={<StopOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <Form.Item label="状态">
            <Select
              value={filters.status}
              style={{ width: 120 }}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <Option value="all">全部</Option>
              <Option value="active">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="stopped">已停止</Option>
            </Select>
          </Form.Item>
          <Form.Item label="类型">
            <Select
              value={filters.type}
              style={{ width: 120 }}
              onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
            >
              <Option value="all">全部</Option>
              <Option value="discussion">讨论模式</Option>
              <Option value="conditional_stop">条件停止</Option>
              <Option value="variable_trigger">变量触发</Option>
              <Option value="time_trigger">时间触发</Option>
            </Select>
          </Form.Item>
          <Form.Item label="行动任务">
            <Select
              value={filters.actionTaskId}
              style={{ width: 180 }}
              onChange={(value) => setFilters(prev => ({ ...prev, actionTaskId: value }))}
            >
              <Option value="all">全部</Option>
              {actionTasks.map(task => (
                <Option key={task.id} value={task.id.toString()}>{task.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="时间范围">
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
              刷新
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 自主行动列表 */}
      <Card title={`自主行动列表 (${filteredTasks.length})`}>
        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="自主行动详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedTask && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="ID">{selectedTask.id}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(selectedTask.status)}</Descriptions.Item>
            <Descriptions.Item label="类型">{getTypeTag(selectedTask.type)}</Descriptions.Item>
            <Descriptions.Item label="行动任务">{selectedTask.actionTaskName}</Descriptions.Item>
            <Descriptions.Item label="会话">{selectedTask.conversationName}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {selectedTask.updated_at ? new Date(selectedTask.updated_at).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="配置" span={2}>
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
