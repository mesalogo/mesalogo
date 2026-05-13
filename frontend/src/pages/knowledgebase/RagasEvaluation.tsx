import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Space, 
  Typography, 
  Select, 
  Input, 
  Progress, 
  Tag, 
  Modal, 
  Form, 
  message, 
  Tooltip,
  Statistic,
  Row,
  Col,
  Alert,
  Spin,
  Empty
} from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  EyeOutlined, 
  DownloadOutlined, 
  SettingOutlined,
  InfoCircleOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const RagasEvaluation = () => {
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [form] = Form.useForm();

  // 模拟数据
  const mockEvaluations = [
    {
      id: 1,
      name: '产品知识库评测-2024-01',
      knowledgeBase: '产品知识库',
      status: 'completed',
      createdAt: '2024-01-15 10:30:00',
      completedAt: '2024-01-15 11:45:00',
      metrics: {
        faithfulness: 0.85,
        answer_relevancy: 0.78,
        context_precision: 0.82,
        context_recall: 0.76,
        overall_score: 0.80
      },
      testCases: 50,
      passedCases: 40
    },
    {
      id: 2,
      name: '技术文档评测-2024-01',
      knowledgeBase: '技术文档库',
      status: 'running',
      createdAt: '2024-01-16 09:15:00',
      progress: 65,
      testCases: 30,
      completedCases: 19
    },
    {
      id: 3,
      name: '客服FAQ评测-2024-01',
      knowledgeBase: '客服知识库',
      status: 'failed',
      createdAt: '2024-01-14 14:20:00',
      error: '测试数据格式错误',
      testCases: 25
    }
  ];

  const mockKnowledgeBases = [
    { id: 1, name: '产品知识库' },
    { id: 2, name: '技术文档库' },
    { id: 3, name: '客服知识库' },
    { id: 4, name: '法律法规库' }
  ];

  useEffect(() => {
    setEvaluations(mockEvaluations);
    setKnowledgeBases(mockKnowledgeBases);
  }, []);

  // 获取状态标签
  const getStatusTag = (status) => {
    const statusMap = {
      'completed': { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
      'running': { color: 'processing', text: '运行中', icon: <SyncOutlined spin /> },
      'failed': { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
      'pending': { color: 'default', text: '等待中', icon: <InfoCircleOutlined /> }
    };
    const config = statusMap[status] || statusMap['pending'];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取指标颜色
  const getMetricColor = (score) => {
    if (score >= 0.8) return '#52c41a';
    if (score >= 0.6) return '#faad14';
    return '#ff4d4f';
  };

  // 表格列定义
  const columns = [
    {
      title: '评测名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            知识库: {record.knowledgeBase}
          </Text>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status, record) => (
        <div>
          {getStatusTag(status)}
          {status === 'running' && record.progress && (
            <Progress 
              percent={record.progress} 
              
              style={{ marginTop: 4 }}
              format={() => `${record.completedCases}/${record.testCases}`}
            />
          )}
        </div>
      )
    },
    {
      title: '测试用例',
      key: 'testCases',
      width: 100,
      render: (_, record) => (
        <div>
          <Text>{record.testCases}</Text>
          {record.passedCases && (
            <div>
              <Text type="success" style={{ fontSize: '12px' }}>
                通过: {record.passedCases}
              </Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: '综合评分',
      key: 'score',
      width: 120,
      render: (_, record) => {
        if (record.status === 'completed' && record.metrics) {
          return (
            <Statistic
              value={record.metrics.overall_score}
              precision={2}
              styles={{ content: { 
                color: getMetricColor(record.metrics.overall_score),
                fontSize: '16px'
              } }}
              suffix="/1.0"
            />
          );
        }
        return <Text type="secondary">-</Text>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (text) => <Text type="secondary">{text}</Text>
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === 'running' && (
            <Tooltip title="停止评测">
              <Button 
                
                icon={<StopOutlined />}
                onClick={() => handleStopEvaluation(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'completed' && (
            <Tooltip title="下载报告">
              <Button 
                
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadReport(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  // 处理创建评测
  const handleCreateEvaluation = () => {
    setCreateModalVisible(true);
  };

  // 处理查看详情
  const handleViewDetail = (evaluation) => {
    setSelectedEvaluation(evaluation);
    setDetailModalVisible(true);
  };

  // 处理停止评测
  const handleStopEvaluation = (id) => {
    Modal.confirm({
      title: '确认停止评测',
      content: '停止后的评测无法恢复，确定要停止吗？',
      onOk: () => {
        message.success('评测已停止');
        // 这里应该调用API停止评测
      }
    });
  };

  // 处理下载报告
  const handleDownloadReport = (id) => {
    message.success('报告下载中...');
    // 这里应该调用API下载报告
  };

  // 处理提交创建表单
  const handleSubmitCreate = async (values) => {
    try {
      setLoading(true);
      // 这里应该调用API创建评测
      console.log('创建评测:', values);
      message.success('评测创建成功，正在启动...');
      setCreateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('创建评测失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
          <BarChartOutlined style={{ marginRight: '8px' }} />
          RAGAS 评测管理
        </Title>
        <Text type="secondary">
          基于RAGAS框架对知识库进行全面的RAG系统评测，包括忠实度、相关性、精确度和召回率等关键指标
        </Text>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Select
            placeholder="选择知识库"
            style={{ width: 200 }}
            value={selectedKnowledgeBase}
            onChange={setSelectedKnowledgeBase}
            allowClear
          >
            {knowledgeBases.map(kb => (
              <Option key={kb.id} value={kb.id}>{kb.name}</Option>
            ))}
          </Select>
          <Button icon={<SettingOutlined />}>评测配置</Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleCreateEvaluation}
          >
            创建评测
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={evaluations}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个评测任务`,
        }}
      />

      {/* 创建评测模态框 */}
      <Modal
        title="创建RAGAS评测"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitCreate}
        >
          <Form.Item
            name="name"
            label="评测名称"
            rules={[{ required: true, message: '请输入评测名称' }]}
          >
            <Input placeholder="请输入评测名称" />
          </Form.Item>

          <Form.Item
            name="knowledgeBaseId"
            label="选择知识库"
            rules={[{ required: true, message: '请选择知识库' }]}
          >
            <Select placeholder="请选择要评测的知识库">
              {knowledgeBases.map(kb => (
                <Option key={kb.id} value={kb.id}>{kb.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="testData"
            label="测试数据"
            rules={[{ required: true, message: '请输入测试数据' }]}
          >
            <TextArea
              rows={6}
              placeholder="请输入测试问题，每行一个问题，或上传JSON格式的测试数据文件"
            />
          </Form.Item>

          <Form.Item
            name="metrics"
            label="评测指标"
            initialValue={['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall']}
          >
            <Select
              mode="multiple"
              placeholder="选择评测指标"
            >
              <Option value="faithfulness">忠实度 (Faithfulness)</Option>
              <Option value="answer_relevancy">答案相关性 (Answer Relevancy)</Option>
              <Option value="context_precision">上下文精确度 (Context Precision)</Option>
              <Option value="context_recall">上下文召回率 (Context Recall)</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建并启动评测
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 评测详情模态框 */}
      <Modal
        title="评测详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedEvaluation && (
          <div>
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="评测名称"
                    value={selectedEvaluation.name}
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="知识库"
                    value={selectedEvaluation.knowledgeBase}
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Card>
              </Col>
            </Row>

            {selectedEvaluation.status === 'completed' && selectedEvaluation.metrics && (
              <Card title="评测指标" style={{ marginBottom: '16px' }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title="忠实度"
                      value={selectedEvaluation.metrics.faithfulness}
                      precision={3}
                      styles={{ content: { color: getMetricColor(selectedEvaluation.metrics.faithfulness) } }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="答案相关性"
                      value={selectedEvaluation.metrics.answer_relevancy}
                      precision={3}
                      styles={{ content: { color: getMetricColor(selectedEvaluation.metrics.answer_relevancy) } }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="上下文精确度"
                      value={selectedEvaluation.metrics.context_precision}
                      precision={3}
                      styles={{ content: { color: getMetricColor(selectedEvaluation.metrics.context_precision) } }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="上下文召回率"
                      value={selectedEvaluation.metrics.context_recall}
                      precision={3}
                      styles={{ content: { color: getMetricColor(selectedEvaluation.metrics.context_recall) } }}
                    />
                  </Col>
                </Row>
              </Card>
            )}

            {selectedEvaluation.error && (
              <Alert
                message="评测失败"
                description={selectedEvaluation.error}
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RagasEvaluation;
