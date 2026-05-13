import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Table, Typography, DatePicker, Select,
  Space, Tag, Progress, Spin
} from 'antd';
import {
  DatabaseOutlined, ApiOutlined, UserOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, BarChartOutlined
} from '@ant-design/icons';
import { externalKnowledgeAPI } from '../../../services/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const ExternalKnowledgeStats = () => {
  const [loading, setLoading] = useState(false);
  const [statsData, setStatsData] = useState({
    overview: {
      total_providers: 0,
      total_knowledges: 0,
      total_bindings: 0,
      total_queries: 0
    },
    provider_stats: [],
    knowledge_stats: [],
    query_logs: [],
    performance_stats: {
      avg_response_time: 0,
      success_rate: 0,
      error_rate: 0
    }
  });
  const [dateRange, setDateRange] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [providers, setProviders] = useState([]);

  const fetchProviders = async () => {
    try {
      const response = await externalKnowledgeAPI.getProviders();
      if (response.success) {
        setProviders(response.data);
      }
    } catch (error) {
      console.error('获取提供商列表失败:', error);
    }
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      if (selectedProvider !== 'all') {
        params.provider_id = selectedProvider;
      }

      // 模拟API调用 - 实际实现中应该调用真实的统计API
      const mockStats = {
        overview: {
          total_providers: providers.length,
          total_knowledges: 8,
          total_bindings: 15,
          total_queries: 1247
        },
        provider_stats: providers.map((provider, index) => ({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          knowledge_count: Math.floor(Math.random() * 5) + 1,
          query_count: Math.floor(Math.random() * 500) + 100,
          success_rate: (Math.random() * 20 + 80).toFixed(1),
          avg_response_time: (Math.random() * 2000 + 500).toFixed(0)
        })),
        knowledge_stats: [
          {
            id: 1,
            name: 'Dify产品文档',
            provider_name: 'Dify测试环境',
            query_count: 456,
            success_rate: 95.2,
            avg_response_time: 1200,
            last_query: '2024-01-15 14:30:00'
          },
          {
            id: 2,
            name: 'RagFlow技术文档',
            provider_name: 'RagFlow演示',
            query_count: 321,
            success_rate: 92.8,
            avg_response_time: 1500,
            last_query: '2024-01-15 13:45:00'
          },
          {
            id: 3,
            name: 'FastGPT用户手册',
            provider_name: 'FastGPT本地',
            query_count: 234,
            success_rate: 88.5,
            avg_response_time: 980,
            last_query: '2024-01-15 12:20:00'
          }
        ],
        query_logs: [
          {
            id: 1,
            knowledge_name: 'Dify产品文档',
            role_name: '产品经理',
            query_text: '如何创建知识库？',
            status: 'success',
            response_time: 1200,
            created_at: '2024-01-15 14:30:00'
          },
          {
            id: 2,
            knowledge_name: 'RagFlow技术文档',
            role_name: '开发工程师',
            query_text: 'API接口文档',
            status: 'success',
            response_time: 1500,
            created_at: '2024-01-15 13:45:00'
          },
          {
            id: 3,
            knowledge_name: 'FastGPT用户手册',
            role_name: '客服专员',
            query_text: '常见问题解答',
            status: 'error',
            response_time: 0,
            error_message: '连接超时',
            created_at: '2024-01-15 12:20:00'
          }
        ],
        performance_stats: {
          avg_response_time: 1234,
          success_rate: 92.5,
          error_rate: 7.5
        }
      };

      setStatsData(mockStats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedProvider, providers]);

  useEffect(() => {
    fetchProviders();
    fetchStats();
  }, [fetchStats]);

  const providerColumns = [
    {
      title: '提供商',
      key: 'provider',
      render: (_, record) => (
        <Space>
          <ApiOutlined style={{ color: '#52c41a' }} />
          <span>{record.name}</span>
          <Tag color="blue">{record.type.toUpperCase()}</Tag>
        </Space>
      ),
    },
    {
      title: '知识库数量',
      dataIndex: 'knowledge_count',
      key: 'knowledge_count',
      render: (count) => <Text strong>{count}</Text>,
    },
    {
      title: '查询次数',
      dataIndex: 'query_count',
      key: 'query_count',
      render: (count) => <Text>{count.toLocaleString()}</Text>,
    },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (rate) => (
        <Progress 
          percent={parseFloat(rate)} 
          
          status={rate > 90 ? 'success' : rate > 80 ? 'normal' : 'exception'}
        />
      ),
    },
    {
      title: '平均响应时间',
      dataIndex: 'avg_response_time',
      key: 'avg_response_time',
      render: (time) => <Text>{time}ms</Text>,
    },
  ];

  const knowledgeColumns = [
    {
      title: '知识库',
      key: 'knowledge',
      render: (_, record) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1677ff' }} />
          <div>
            <div>{record.name}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.provider_name}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '查询次数',
      dataIndex: 'query_count',
      key: 'query_count',
      render: (count) => <Text>{count.toLocaleString()}</Text>,
    },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (rate) => (
        <Progress 
          percent={rate} 
          
          status={rate > 90 ? 'success' : rate > 80 ? 'normal' : 'exception'}
        />
      ),
    },
    {
      title: '平均响应时间',
      dataIndex: 'avg_response_time',
      key: 'avg_response_time',
      render: (time) => <Text>{time}ms</Text>,
    },
    {
      title: '最后查询',
      dataIndex: 'last_query',
      key: 'last_query',
      render: (time) => <Text type="secondary">{time}</Text>,
    },
  ];

  const queryLogColumns = [
    {
      title: '知识库',
      dataIndex: 'knowledge_name',
      key: 'knowledge_name',
      render: (name) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1677ff' }} />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role_name',
      key: 'role_name',
      render: (name) => (
        <Space>
          <UserOutlined style={{ color: '#fa8c16' }} />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '查询内容',
      dataIndex: 'query_text',
      key: 'query_text',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        if (status === 'success') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>;
        } else {
          return (
            <Tag color="error" icon={<ExclamationCircleOutlined />}>
              失败
            </Tag>
          );
        }
      },
    },
    {
      title: '响应时间',
      dataIndex: 'response_time',
      key: 'response_time',
      render: (time) => time > 0 ? `${time}ms` : '-',
    },
    {
      title: '查询时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => <Text type="secondary">{time}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <Title level={5}>外部知识库使用统计</Title>
            <Text type="secondary">查看外部知识库的使用情况、性能指标和查询日志</Text>
          </div>
          <Space>
            <Select
              value={selectedProvider}
              onChange={setSelectedProvider}
              style={{ width: 150 }}
            >
              <Option value="all">所有提供商</Option>
              {providers.map(provider => (
                <Option key={provider.id} value={provider.id}>
                  {provider.name}
                </Option>
              ))}
            </Select>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
            />
          </Space>
        </div>

        {/* 概览统计 */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="提供商数量"
                value={statsData.overview.total_providers}
                prefix={<ApiOutlined />}
                styles={{ content: { color: '#3f8600' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="外部知识库"
                value={statsData.overview.total_knowledges}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#1677ff' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="角色绑定"
                value={statsData.overview.total_bindings}
                prefix={<UserOutlined />}
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总查询次数"
                value={statsData.overview.total_queries}
                prefix={<BarChartOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Card>
          </Col>
        </Row>

        {/* 性能指标 */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Card title="平均响应时间">
              <Statistic
                value={statsData.performance_stats.avg_response_time}
                suffix="ms"
                styles={{ content: { color: '#1677ff' } }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card title="成功率">
              <Progress
                type="circle"
                percent={statsData.performance_stats.success_rate}
                format={percent => `${percent}%`}
                status={statsData.performance_stats.success_rate > 90 ? 'success' : 'normal'}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card title="错误率">
              <Progress
                type="circle"
                percent={statsData.performance_stats.error_rate}
                format={percent => `${percent}%`}
                status={statsData.performance_stats.error_rate < 10 ? 'success' : 'exception'}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <Spin spinning={loading}>
        {/* 提供商统计 */}
        <Card title="提供商统计" style={{ marginBottom: '16px' }}>
          <Table
            columns={providerColumns}
            dataSource={statsData.provider_stats}
            rowKey="id"
            pagination={false}
           
          />
        </Card>

        {/* 知识库统计 */}
        <Card title="知识库统计" style={{ marginBottom: '16px' }}>
          <Table
            columns={knowledgeColumns}
            dataSource={statsData.knowledge_stats}
            rowKey="id"
            pagination={false}
           
          />
        </Card>

        {/* 查询日志 */}
        <Card title="最近查询日志">
          <Table
            columns={queryLogColumns}
            dataSource={statsData.query_logs}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
           
          />
        </Card>
      </Spin>
    </div>
  );
};

export default ExternalKnowledgeStats;
