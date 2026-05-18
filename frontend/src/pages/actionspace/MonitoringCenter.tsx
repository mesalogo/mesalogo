import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Table, Tabs, Form, DatePicker, Select, Space, Empty, Tag, Row, Col, Statistic, Progress, Timeline, Badge, App } from 'antd';
import { BarChartOutlined, FileTextOutlined, ReloadOutlined, SearchOutlined, DownloadOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, MessageOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { monitoringAPI } from '../../services/api/monitoring';
import AgentMonitoring from './AgentMonitoring';
import AutonomousTaskMonitoring from './AutonomousTaskMonitoring';
import ConversationHistoryTab from '../workspace/ConversationHistoryTab';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const EMPTY_DASHBOARD = {
  active_spaces: 0, total_rule_sets: 0, executions_today: 0,
  abnormal_executions: 0, total_executions: 0, execution_rate: 0,
  llm_percent: 0, logic_percent: 0, recent_abnormals: [], recent_logs: []
};

// Build API request params from logFilters
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
  const { t } = useTranslation();
  const { message } = App.useApp();
  const STATUS_CONFIG: Record<string, any> = {
    success: { color: 'success', icon: <CheckCircleOutlined />, text: t('monCenter.status.success') },
    error: { color: 'error', icon: <WarningOutlined />, text: t('monCenter.status.error') },
    info: { color: 'default', icon: <ClockCircleOutlined />, text: t('monCenter.status.info') }
  };
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
      message.error(t('monCenter.msg.fetchDashboardFailed'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

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
      message.error(t('monCenter.msg.fetchLogsFailed'));
    } finally {
      setLogLoading(false);
    }
  }, [logFilters, message, t]);

  const fetchActionSpaces = useCallback(async () => {
    try {
      const res = await monitoringAPI.getActionSpaces();
      if (res.success) setActionSpaces(res.data);
    } catch { /* ignore */ }
  }, []);

  const handleExportLogs = async () => {
    try {
      await monitoringAPI.exportRuleLogs(buildFilterParams(logFilters));
      message.success(t('monCenter.msg.exportSuccess'));
    } catch {
      message.error(t('monCenter.msg.exportFailed'));
    }
  };

  useEffect(() => { fetchDashboardData(); fetchActionSpaces(); }, [fetchDashboardData, fetchActionSpaces]);
  useEffect(() => { if (activeTab === 'logs') fetchRuleLogs(1, logPagination.pageSize); }, [activeTab]);

  const renderDashboardTab = () => {
    const { recent_abnormals = [], recent_logs = [] } = dashboardData;
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button icon={<ReloadOutlined />} onClick={fetchDashboardData} loading={loading}>{t('monCenter.refresh')}</Button>
        </div>

        <Row gutter={[16, 16]}>
          {[
            { title: t('monCenter.stat.activeSpaces'), value: dashboardData.active_spaces, color: '#1677ff' },
            { title: t('monCenter.stat.totalRuleSets'), value: dashboardData.total_rule_sets, color: '#52c41a' },
            { title: t('monCenter.stat.executionsToday'), value: dashboardData.executions_today, color: '#faad14' },
            { title: t('monCenter.stat.abnormalExecutions'), value: dashboardData.abnormal_executions, color: '#ff4d4f', prefix: <WarningOutlined /> },
          ].map((item, i) => (
            <Col span={6} key={i}>
              <Card><Statistic title={item.title} value={item.value} prefix={item.prefix} styles={{ content: { color: item.color } }} /></Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title={t('monCenter.cardRuleExec')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div><Text strong>{t('monCenter.totalExec')}</Text><Text>{dashboardData.total_executions}</Text></div>
                <div><Text strong>{t('monCenter.execSuccessRate')}</Text><Text>{dashboardData.execution_rate}%</Text></div>
              </div>
              <Text>{t('monCenter.llmRuleExec')}</Text>
              <Progress percent={dashboardData.llm_percent} status="active" />
              <Text>{t('monCenter.logicRuleExec')}</Text>
              <Progress percent={dashboardData.logic_percent} status="active" />
            </Card>
          </Col>
          <Col span={12}>
            <Card title={t('monCenter.cardRecentAbnormal')}>
              {recent_abnormals.length > 0 ? (
                <Timeline items={recent_abnormals.slice(0, 4).map((item: any, i: number) => ({
                  key: item.id || i, color: 'red',
                  children: (<>
                    <p><Text strong>{item.action_space || item.task_name}</Text> - <Text>{item.rule_name}</Text></p>
                    <p>{item.message}</p>
                    <p><Text type="secondary">{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</Text></p>
                  </>)
                }))} />
              ) : <Empty description={t('monCenter.emptyAbnormal')} />}
            </Card>
          </Col>
        </Row>

        <Card title={t('monCenter.cardRecentLogs')} style={{ marginTop: 16 }} extra={<Button type="link" onClick={() => setActiveTab('logs')}>{t('monCenter.viewAll')}</Button>}>
          {recent_logs.length > 0 ? recent_logs.slice(0, 5).map((log: any, i: number) => (
            <div key={log.id || i} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Space>
                <Badge status={log.passed === true ? 'success' : log.passed === false ? 'error' : 'processing'} />
                <Text>{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</Text>
                <Tag color={log.rule_type === 'llm' ? 'green' : 'blue'}>{log.rule_type === 'llm' ? t('monCenter.ruleType.llm') : t('monCenter.ruleType.logic')}</Tag>
                <Text strong>{log.action_space}</Text>
                <Text type="secondary">{log.rule_set}</Text>
                <Text>{log.rule_name}</Text>
                {log.execution_time != null && <Text type="secondary">{(log.execution_time * 1000).toFixed(2)}ms</Text>}
              </Space>
            </div>
          )) : <Empty description={t('monCenter.emptyLogs')} />}
        </Card>
      </div>
    );
  };

  const logColumns = [
    { title: t('monCenter.col.time'), dataIndex: 'timestamp', key: 'timestamp', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: t('monCenter.col.status'), dataIndex: 'type', key: 'type', width: 100,
      render: (type: string) => { const c = STATUS_CONFIG[type] || STATUS_CONFIG.info; return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>; } },
    { title: t('monCenter.col.actionSpace'), dataIndex: 'action_space', key: 'action_space', width: 150, ellipsis: true },
    { title: t('monCenter.col.ruleSet'), dataIndex: 'rule_set', key: 'rule_set', width: 150, ellipsis: true },
    { title: t('monCenter.col.ruleName'), dataIndex: 'rule_name', key: 'rule_name', width: 150 },
    { title: t('monCenter.col.ruleType'), dataIndex: 'rule_type', key: 'rule_type', width: 100,
      render: (rt: string) => <Tag color={rt === 'llm' ? 'green' : 'blue'}>{rt === 'llm' ? t('monCenter.ruleType.llm') : t('monCenter.ruleType.logic')}</Tag> },
    { title: t('monCenter.col.message'), dataIndex: 'message', key: 'message', ellipsis: true },
    { title: t('monCenter.col.execTime'), dataIndex: 'execution_time', key: 'execution_time', width: 100,
      render: (et: number | null) => et != null ? `${(et * 1000).toFixed(2)}ms` : '-' },
  ];

  const updateFilter = (key: string, value: any) => setLogFilters((prev: any) => ({ ...prev, [key]: value }));

  const renderLogsTab = () => (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <Form.Item label={t('monCenter.filter.dateRange')}>
            <RangePicker showTime value={logFilters.dateRange} onChange={(v) => updateFilter('dateRange', v)} />
          </Form.Item>
          <Form.Item label={t('monCenter.col.actionSpace')}>
            <Select placeholder={t('monCenter.filter.pickActionSpace')} style={{ width: 180 }} allowClear value={logFilters.action_space_id} onChange={(v) => updateFilter('action_space_id', v)}>
              {actionSpaces.map((s: any) => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('monCenter.col.ruleType')}>
            <Select placeholder={t('monCenter.filter.pickRuleType')} style={{ width: 120 }} allowClear value={logFilters.rule_type} onChange={(v) => updateFilter('rule_type', v)}>
              <Option value="llm">{t('monCenter.ruleType.llm')}</Option><Option value="logic">{t('monCenter.ruleType.logic')}</Option>
            </Select>
          </Form.Item>
          <Form.Item label={t('monCenter.col.status')}>
            <Select placeholder={t('monCenter.filter.pickStatus')} style={{ width: 120 }} allowClear value={logFilters.status} onChange={(v) => updateFilter('status', v)}>
              <Option value="success">{t('monCenter.status.success')}</Option><Option value="error">{t('monCenter.status.error')}</Option>
            </Select>
          </Form.Item>
          <Form.Item><Button type="primary" icon={<SearchOutlined />} onClick={() => fetchRuleLogs(1, logPagination.pageSize)}>{t('monCenter.search')}</Button></Form.Item>
          <Form.Item><Button icon={<DownloadOutlined />} onClick={handleExportLogs}>{t('monCenter.exportLogs')}</Button></Form.Item>
        </Form>
      </Card>
      <Table columns={logColumns} dataSource={logData} rowKey="id" loading={logLoading}
        pagination={{
          ...logPagination, showSizeChanger: true, showQuickJumper: true,
          showTotal: (total, range) => t('monCenter.paginationRange', { from: range[0], to: range[1], total }),
          onChange: (page, pageSize) => fetchRuleLogs(page, pageSize)
        }}
      />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('monCenter.pageTitle')}</Title>
          <Text type="secondary">{t('monCenter.pageDesc')}</Text>
        </div>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'dashboard', label: <span><BarChartOutlined />{t('monCenter.tab.dashboard')}</span>, children: renderDashboardTab() },
        { key: 'agents', label: <span><RobotOutlined />{t('monCenter.tab.agents')}</span>, children: <AgentMonitoring /> },
        { key: 'autonomous', label: <span><ThunderboltOutlined />{t('monCenter.tab.autonomous')}</span>, children: <AutonomousTaskMonitoring /> },
        { key: 'conversations', label: <span><MessageOutlined />{t('monCenter.tab.conversations')}</span>, children: (
          <div>
            <div style={{ marginBottom: 16 }}><Text type="secondary">{t('monCenter.convoDesc')}</Text></div>
            <Card style={{ borderRadius: '12px', boxShadow: 'var(--custom-shadow)' }}><ConversationHistoryTab /></Card>
          </div>
        )},
        { key: 'logs', label: <span><FileTextOutlined />{t('monCenter.tab.logs')}</span>, children: renderLogsTab() },
      ]} />
    </div>
  );
};

export default MonitoringCenter;
