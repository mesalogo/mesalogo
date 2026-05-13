import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, DatePicker, Select, Table, Tag, Empty, Spin, Divider, List, Space, Progress } from 'antd';
import { QuestionCircleOutlined, SearchOutlined, FileTextOutlined, UserOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// 知识库名称映射
const knowledgeNames = {
  1: '客户服务知识库',
  2: '产品知识库',
  3: '销售培训资料',
  4: '技术文档库',
  5: '市场分析报告'
};

// 模拟使用数据 - 每日查询统计
const mockDailyStats = {
  1: [
    { date: '2023-09-01', queries: 45, hits: 38, misses: 7 },
    { date: '2023-09-02', queries: 52, hits: 43, misses: 9 },
    { date: '2023-09-03', queries: 48, hits: 40, misses: 8 },
    { date: '2023-09-04', queries: 60, hits: 51, misses: 9 },
    { date: '2023-09-05', queries: 72, hits: 65, misses: 7 },
    { date: '2023-09-06', queries: 58, hits: 50, misses: 8 },
    { date: '2023-09-07', queries: 63, hits: 55, misses: 8 }
  ],
  2: [
    { date: '2023-09-01', queries: 32, hits: 28, misses: 4 },
    { date: '2023-09-02', queries: 38, hits: 33, misses: 5 },
    { date: '2023-09-03', queries: 35, hits: 30, misses: 5 },
    { date: '2023-09-04', queries: 42, hits: 36, misses: 6 },
    { date: '2023-09-05', queries: 50, hits: 45, misses: 5 },
    { date: '2023-09-06', queries: 45, hits: 40, misses: 5 },
    { date: '2023-09-07', queries: 48, hits: 42, misses: 6 }
  ]
};

// 模拟使用数据 - 文档访问统计
const mockDocumentStats = {
  1: [
    { id: 1, name: '客户服务手册.pdf', access_count: 120, last_accessed: '2023-09-07T14:30:00Z' },
    { id: 2, name: '常见问题解答.docx', access_count: 95, last_accessed: '2023-09-07T10:15:00Z' },
    { id: 3, name: '服务流程图.xlsx', access_count: 45, last_accessed: '2023-09-06T16:45:00Z' }
  ],
  2: [
    { id: 1, name: '产品规格说明书.pdf', access_count: 85, last_accessed: '2023-09-07T11:20:00Z' },
    { id: 2, name: '用户手册.docx', access_count: 72, last_accessed: '2023-09-07T09:30:00Z' },
    { id: 3, name: '技术参数表.xlsx', access_count: 38, last_accessed: '2023-09-05T15:10:00Z' },
    { id: 4, name: '产品更新日志.md', access_count: 25, last_accessed: '2023-09-04T14:25:00Z' }
  ]
};

// 模拟使用数据 - 热门查询
const mockTopQueries = {
  1: [
    { query: '如何重置密码', count: 28, success_rate: 0.92 },
    { query: '退款政策', count: 23, success_rate: 0.87 },
    { query: '账户注销流程', count: 19, success_rate: 0.95 },
    { query: '联系客服', count: 17, success_rate: 0.88 },
    { query: '修改订单', count: 15, success_rate: 0.80 }
  ],
  2: [
    { query: '产品尺寸规格', count: 22, success_rate: 0.95 },
    { query: '兼容性要求', count: 18, success_rate: 0.89 },
    { query: '安装指南', count: 16, success_rate: 0.94 },
    { query: '保修政策', count: 14, success_rate: 0.86 },
    { query: '技术支持', count: 12, success_rate: 0.92 }
  ]
};

// 模拟使用数据 - 用户访问统计
const mockUserStats = {
  1: [
    { user: '用户A', queries: 45, success_rate: 0.91 },
    { user: '用户B', queries: 38, success_rate: 0.84 },
    { user: '用户C', queries: 32, success_rate: 0.88 },
    { user: '用户D', queries: 28, success_rate: 0.93 },
    { user: '用户E', queries: 25, success_rate: 0.80 }
  ],
  2: [
    { user: '用户F', queries: 35, success_rate: 0.94 },
    { user: '用户G', queries: 30, success_rate: 0.87 },
    { user: '用户H', queries: 28, success_rate: 0.89 },
    { user: '用户I', queries: 25, success_rate: 0.92 },
    { user: '用户J', queries: 22, success_rate: 0.86 }
  ]
};



const UsageAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [dailyStats, setDailyStats] = useState([]);
  const [documentStats, setDocumentStats] = useState([]);
  const [topQueries, setTopQueries] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [timeRange, setTimeRange] = useState('week');
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(1); // 默认选择第一个知识库
  const [selectedKnowledgeName, setSelectedKnowledgeName] = useState('');

  // 总计统计
  const [totalQueries, setTotalQueries] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);

  // 获取使用统计数据
  useEffect(() => {
    fetchUsageData(selectedKnowledgeId);
    setSelectedKnowledgeName(knowledgeNames[selectedKnowledgeId] || '');
  }, [selectedKnowledgeId, timeRange]);

  // 处理知识库选择变化
  const handleKnowledgeChange = (value) => {
    setSelectedKnowledgeId(value);
  };

  const resetData = () => {
    setDailyStats([]);
    setDocumentStats([]);
    setTopQueries([]);
    setUserStats([]);
    setTotalQueries(0);
    setSuccessRate(0);
    setUniqueUsers(0);
    setAvgResponseTime(0);
  };

  const fetchUsageData = (id) => {
    setLoading(true);
    // 模拟API调用
    setTimeout(() => {
      // 设置每日统计
      setDailyStats(mockDailyStats[id] || []);

      // 设置文档访问统计
      setDocumentStats(mockDocumentStats[id] || []);

      // 设置热门查询
      setTopQueries(mockTopQueries[id] || []);

      // 设置用户访问统计
      setUserStats(mockUserStats[id] || []);

      // 计算总计统计
      if (mockDailyStats[id]) {
        const stats = mockDailyStats[id];
        const totalQ = stats.reduce((sum, day) => sum + day.queries, 0);
        const totalHits = stats.reduce((sum, day) => sum + day.hits, 0);

        setTotalQueries(totalQ);
        setSuccessRate(Number(totalQ > 0 ? (totalHits / totalQ * 100).toFixed(1) : 0));
        setUniqueUsers(mockUserStats[id]?.length || 0);
        setAvgResponseTime(Number((Math.random() * 0.5 + 0.2).toFixed(2))); // 随机生成0.2-0.7秒的响应时间
      }

      setLoading(false);
    }, 500);
  };

  // 处理时间范围变化
  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
  };

  // 文档访问统计表格列
  const documentColumns = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <FileTextOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '访问次数',
      dataIndex: 'access_count',
      key: 'access_count',
      sorter: (a: any, b: any) => a.access_count - b.access_count,
      defaultSortOrder: 'descend' as any,
    },
    {
      title: '最后访问时间',
      dataIndex: 'last_accessed',
      key: 'last_accessed',
      render: (date) => new Date(date).toLocaleString(),
    },
  ];

  // 热门查询表格列
  const queryColumns = [
    {
      title: '查询内容',
      dataIndex: 'query',
      key: 'query',
      render: (text) => (
        <Space>
          <SearchOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '查询次数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
      defaultSortOrder: 'descend' as any,
    },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (rate) => {
        const percent = (rate * 100).toFixed(1);
        const color = rate >= 0.9 ? 'success' : (rate >= 0.7 ? 'warning' : 'error');
        return <Tag color={color}>{percent}%</Tag>;
      },
      sorter: (a, b) => a.success_rate - b.success_rate,
    },
  ];

  // 用户访问统计表格列
  const userColumns = [
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      render: (text) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '查询次数',
      dataIndex: 'queries',
      key: 'queries',
      sorter: (a: any, b: any) => a.queries - b.queries,
      defaultSortOrder: 'descend' as any,
    },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (rate) => {
        const percent = (rate * 100).toFixed(1);
        const color = rate >= 0.9 ? 'success' : (rate >= 0.7 ? 'warning' : 'error');
        return <Tag color={color}>{percent}%</Tag>;
      },
      sorter: (a, b) => a.success_rate - b.success_rate,
    },
  ];

  return (
    <div>
      <Spin spinning={loading}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={5}>使用分析</Title>
            <Text type="secondary">查看知识库的使用情况和性能指标</Text>
          </div>
          <Space>
            <Select
              value={selectedKnowledgeId}
              onChange={handleKnowledgeChange}
              style={{ width: 180 }}
              placeholder="选择知识库"
            >
              {Object.entries(knowledgeNames).map(([id, name]) => (
                <Option key={id} value={Number(id)}>{name}</Option>
              ))}
            </Select>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              style={{ width: 120 }}
            >
              <Option value="day">今日</Option>
              <Option value="week">本周</Option>
              <Option value="month">本月</Option>
              <Option value="year">全年</Option>
            </Select>
          </Space>
        </div>

          {/* 总计统计卡片 */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总查询次数"
                  value={totalQueries}
                  prefix={<SearchOutlined />}
                  styles={{ content: { color: '#1677ff' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="查询成功率"
                  value={successRate}
                  suffix="%"
                  precision={1}
                  prefix={<CheckCircleOutlined />}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="独立用户数"
                  value={uniqueUsers}
                  prefix={<UserOutlined />}
                  styles={{ content: { color: '#fa8c16' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均响应时间"
                  value={avgResponseTime}
                  suffix="秒"
                  precision={2}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: '#eb2f96' } }}
                />
              </Card>
            </Col>
          </Row>

          {/* 每日查询统计图表 */}
          <Card title="每日查询统计" style={{ marginBottom: '24px' }}>
            <div style={{ padding: '20px 0' }}>
              {dailyStats.map((stat, index) => (
                <div key={index} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Text>{stat.date}</Text>
                    <Text>{stat.queries} 次查询</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px' }}>
                      <Text type="secondary">成功查询:</Text>
                    </div>
                    <Progress
                      percent={Math.round(stat.hits / stat.queries * 100)}
                      strokeColor="#52c41a"
                      showInfo={false}
                      style={{ flex: 1 }}
                    />
                    <div style={{ width: '60px', paddingLeft: '12px' }}>
                      <Text>{stat.hits} 次</Text>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px' }}>
                      <Text type="secondary">失败查询:</Text>
                    </div>
                    <Progress
                      percent={Math.round(stat.misses / stat.queries * 100)}
                      strokeColor="#ff4d4f"
                      showInfo={false}
                      style={{ flex: 1 }}
                    />
                    <div style={{ width: '60px', paddingLeft: '12px' }}>
                      <Text>{stat.misses} 次</Text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 文档访问统计和热门查询 */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={12}>
              <Card title="文档访问统计" style={{ height: '100%' }}>
                <Table
                  columns={documentColumns}
                  dataSource={documentStats}
                  rowKey="id"
                  pagination={false}
                 
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="热门查询" style={{ height: '100%' }}>
                <Table
                  columns={queryColumns}
                  dataSource={topQueries}
                  rowKey="query"
                  pagination={false}
                 
                />
              </Card>
            </Col>
          </Row>

          {/* 用户访问统计 */}
          <Row gutter={16}>
            <Col span={12}>
              <Card title="用户访问统计">
                <Table
                  columns={userColumns}
                  dataSource={userStats}
                  rowKey="user"
                  pagination={false}
                 
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="查询成功率分布">
                <List
                  dataSource={userStats}
                  renderItem={(user, index) => (
                    <List.Item>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Space>
                            <UserOutlined />
                            <Text>{user.user}</Text>
                          </Space>
                          <Text>{(user.success_rate * 100).toFixed(1)}%</Text>
                        </div>
                        <Progress
                          percent={Math.round(user.success_rate * 100)}
                          strokeColor={
                            user.success_rate >= 0.9 ? '#52c41a' :
                            user.success_rate >= 0.7 ? '#faad14' : '#ff4d4f'
                          }
                         
                        />
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </Spin>
    </div>
  );
};

export default UsageAnalytics;
