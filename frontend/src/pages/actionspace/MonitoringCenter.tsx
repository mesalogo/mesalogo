import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Table, Tabs, Form, DatePicker, Select, Space, Empty, Tag, Row, Col, Statistic, Progress, Timeline, Badge, App } from 'antd';
import { BarChartOutlined, FileTextOutlined, ReloadOutlined, SearchOutlined, DownloadOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, MessageOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { monitoringAPI } from '../../services/api/monitoring';
import AgentMonitoring from './AgentMonitoring';
import AutonomousTaskMonitoring from './AutonomousTaskMonitoring';
import ConversationHistoryTab from '../workspace/ConversationHistoryTab';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const EMPTY_DASHBOARD = {
  active_spaces: 0, total_rule_sets: 0, executions_today: 0,
  abnormal_executions: 0, total_executions: 0, execution_rate: 0,
  llm_percent: 0, logic_percent: 0, recent_abnormals: [], recent_logs: []
};

const STATUS_CONFIG: Record<string, any> = {
  success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
  error: { color: 'error', icon: <WarningOutlined />, text: '失败' },
  info: { color: 'default', icon: <ClockCircleOutlined />, text: '信息' }
};

// 从 logFilters state 构建 API 请求参数
const buildFilterParams = (filters: any) => {
  const params: any = {};
  if (filters.action_space_id) params.action_space_id = filters.action_space_id;
  if (filters.rule_type) params.rule_type = filters.rule_type;
  if (filters.status) params.status = filters.status;
  if (filters.dateRange?.length === 2) {
    params.start_time = filters.dateRange[0].toISOString();
    params.end_time = filters.dateRange[1].toISOString();
  }
  return params;
};

const MonitoringCenter = () => {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(EMPTY_DASHBOARD);

  const [logLoading, setLogLoading] = useState(false);
  const [logData, setLogData] = useState<any[]>([]);
  const [logPagination, setLogPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [actionSpaces, setActionSpaces] = useState<any[]>([]);
  const [logFilters, setLogFilters] = useState<any>({});

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await monitoringAPI.getDashboard();
      if (res.success) setDashboardData(res.data);
    } catch {
      message.error('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchRuleLogs = useCallback(async (page = 1, pageSize = 10) => {
    setLogLoading(true);
    try {
      const params = { page, per_page: pageSize, ...buildFilterParams(logFilters) };
      const res = await monitoringAPI.getRuleLogs(params);
      if (res.success) {
        setLogData(res.data.logs);
        setLogPagination({ current: res.data.page, pageSize: res.data.per_page, total: res.data.total });
      }
    } catch {
      message.error('获取执行日志失败');
    } finally {
      setLogLoading(false);
    }
  }, [logFilters, message]);

  const fetchActionSpaces = useCallback(async () => {
    try {
      const res = await monitoringAPI.getActionSpaces();
      if (res.success) setActionSpaces(res.data);
    } catch { /* ignore */ }
  }, []);

  const handleExportLogs = async () => {
    try {
      await monitoringAPI.exportRuleLogs(buildFilterParams(logFilters));
      message.success('日志导出成功');
    } catch {
      message.error('导出日志失败');
    }
  };

  useEffect(() => { fetchDashboardData(); fetchActionSpaces(); }, [fetchDashboardData, fetchActionSpaces]);
  useEffect(() => { if (activeTab === 'logs') fetchRuleLogs(1, logPagination.pageSize); }, [activeTab]);

  const renderDashboardTab = () => {
    const { recent_abnormals = [], recent_logs = [] } = dashboardData;
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button icon={<ReloadOutlined />} onClick={fetchDashboardData} loading={loading}>刷新数据</Button>
        </div>

        <Row gutter={[16, 16]}>
          {[
            { title: '活跃行动空间', value: dashboardData.active_spaces, color: '#1677ff' },
            { title: '规则集总数', value: dashboardData.total_rule_sets, color: '#52c41a' },
            { title: '今日规则执行次数', value: dashboardData.executions_today, color: '#faad14' },
            { title: '异常执行数', value: dashboardData.abnormal_executions, color: '#ff4d4f', prefix: <WarningOutlined /> },
          ].map((item, i) => (
            <Col span={6} key={i}>
              <Card><Statistic title={item.title} value={item.value} prefix={item.prefix} styles={{ content: { color: item.color } }} /></Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="规则执行情况">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div><Text strong>总执行次数：</Text><Text>{dashboardData.total_executions}</Text></div>
                <div><Text strong>执行成功率：</Text><Text>{dashboardData.execution_rate}%</Text></div>
              </div>
              <Text>自然语言规则执行</Text>
              <Progress percent={dashboardData.llm_percent} status="active" />
              <Text>逻辑规则执行</Text>
              <Progress percent={dashboardData.logic_percent} status="active" />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="最近异常">
              {recent_abnormals.length > 0 ? (
                <Timeline items={recent_abnormals.slice(0, 4).map((item: any, i: number) => ({
                  key: item.id || i, color: 'red',
                  children: (<>
                    <p><Text strong>{item.action_space || item.task_name}</Text> - <Text>{item.rule_name}</Text></p>
                    <p>{item.message}</p>
                    <p><Text type="secondary">{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</Text></p>
                  </>)
                }))} />
              ) : <Empty description="暂无异常记录" />}
            </Card>
          </Col>
        </Row>

        <Card title="最近执行记录" style={{ marginTop: 16 }} extra={<Button type="link" onClick={() => setActiveTab('logs')}>查看全部</Button>}>
          {recent_logs.length > 0 ? recent_logs.slice(0, 5).map((log: any, i: number) => (
            <div key={log.id || i} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Space>
                <Badge status={log.passed === true ? 'success' : log.passed === false ? 'error' : 'processing'} />
                <Text>{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</Text>
                <Tag color={log.rule_type === 'llm' ? 'green' : 'blue'}>{log.rule_type === 'llm' ? '大模型' : '逻辑'}</Tag>
                <Text strong>{log.action_space}</Text>
                <Text type="secondary">{log.rule_set}</Text>
                <Text>{log.rule_name}</Text>
                {log.execution_time != null && <Text type="secondary">{(log.execution_time * 1000).toFixed(2)}ms</Text>}
              </Space>
            </div>
          )) : <Empty description="暂无执行记录" />}
        </Card>
      </div>
    );
  };

  const logColumns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '状态', dataIndex: 'type', key: 'type', width: 100,
      render: (type: string) => { const c = STATUS_CONFIG[type] || STATUS_CONFIG.info; return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>; } },
    { title: '行动空间', dataIndex: 'action_space', key: 'action_space', width: 150, ellipsis: true },
    { title: '规则集', dataIndex: 'rule_set', key: 'rule_set', width: 150, ellipsis: true },
    { title: '规则名称', dataIndex: 'rule_name', key: 'rule_name', width: 150 },
    { title: '规则类型', dataIndex: 'rule_type', key: 'rule_type', width: 100,
      render: (t: string) => <Tag color={t === 'llm' ? 'green' : 'blue'}>{t === 'llm' ? '大模型' : '逻辑'}</Tag> },
    { title: '执行消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '执行时间', dataIndex: 'execution_time', key: 'execution_time', width: 100,
      render: (t: number | null) => t != null ? `${(t * 1000).toFixed(2)}ms` : '-' },
  ];

  const updateFilter = (key: string, value: any) => setLogFilters((prev: any) => ({ ...prev, [key]: value }));

  const renderLogsTab = () => (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <Form.Item label="时间范围">
            <RangePicker showTime value={logFilters.dateRange} onChange={(v) => updateFilter('dateRange', v)} />
          </Form.Item>
          <Form.Item label="行动空间">
            <Select placeholder="选择行动空间" style={{ width: 180 }} allowClear value={logFilters.action_space_id} onChange={(v) => updateFilter('action_space_id', v)}>
              {actionSpaces.map((s: any) => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="规则类型">
            <Select placeholder="选择规则类型" style={{ width: 120 }} allowClear value={logFilters.rule_type} onChange={(v) => updateFilter('rule_type', v)}>
              <Option value="llm">大模型</Option><Option value="logic">逻辑</Option>
            </Select>
          </Form.Item>
          <Form.Item label="状态">
            <Select placeholder="选择状态" style={{ width: 120 }} allowClear value={logFilters.status} onChange={(v) => updateFilter('status', v)}>
              <Option value="success">成功</Option><Option value="error">失败</Option>
            </Select>
          </Form.Item>
          <Form.Item><Button type="primary" icon={<SearchOutlined />} onClick={() => fetchRuleLogs(1, logPagination.pageSize)}>搜索</Button></Form.Item>
          <Form.Item><Button icon={<DownloadOutlined />} onClick={handleExportLogs}>导出日志</Button></Form.Item>
        </Form>
      </Card>
      <Table columns={logColumns} dataSource={logData} rowKey="id" loading={logLoading}
        pagination={{
          ...logPagination, showSizeChanger: true, showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, pageSize) => fetchRuleLogs(page, pageSize)
        }}
      />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>行动监控</Title>
          <Text type="secondary">实时监控行动空间和智能体的运行状态，查看执行日志和配置监控告警规则</Text>
        </div>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'dashboard', label: <span><BarChartOutlined />仪表盘</span>, children: renderDashboardTab() },
        { key: 'agents', label: <span><RobotOutlined />智能体监控</span>, children: <AgentMonitoring /> },
        { key: 'autonomous', label: <span><ThunderboltOutlined />自主行动监控</span>, children: <AutonomousTaskMonitoring /> },
        { key: 'conversations', label: <span><MessageOutlined />任务会话</span>, children: (
          <div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">查看不同行动任务的会话历史记录，包括智能体对话内容和思考过程。</Text></div>
            <Card style={{ borderRadius: '12px', boxShadow: 'var(--custom-shadow)' }}><ConversationHistoryTab /></Card>
          </div>
        )},
        { key: 'logs', label: <span><FileTextOutlined />执行日志</span>, children: renderLogsTab() },
      ]} />
    </div>
  );
};

export default MonitoringCenter;
