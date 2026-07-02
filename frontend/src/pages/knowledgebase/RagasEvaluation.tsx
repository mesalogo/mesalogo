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
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  EyeOutlined,
  DownloadOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const RagasEvaluation = () => {
  const { t } = useTranslation('knowledgebase');
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<any>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [form] = Form.useForm();

  // NOTE: these mock objects represent SERVER-SIDE entity records (names,
  // descriptions etc. would arrive from the API once integration lands).
  // They intentionally stay as raw strings — they are data, not UI copy.
  const mockEvaluations = [
    {
      id: 1,
      name: 'Product KB Evaluation-2024-01',
      knowledgeBase: 'Product Knowledge Base',
      status: 'completed',
      createdAt: '2024-01-15 10:30:00',
      completedAt: '2024-01-15 11:45:00',
      metrics: {
        faithfulness: 0.85,
        answer_relevancy: 0.78,
        context_precision: 0.82,
        context_recall: 0.76,
        overall_score: 0.80,
      },
      testCases: 50,
      passedCases: 40,
    },
    {
      id: 2,
      name: 'Technical Docs Evaluation-2024-01',
      knowledgeBase: 'Technical Docs Library',
      status: 'running',
      createdAt: '2024-01-16 09:15:00',
      progress: 65,
      testCases: 30,
      completedCases: 19,
    },
    {
      id: 3,
      name: 'Customer Service FAQ Evaluation-2024-01',
      knowledgeBase: 'Customer Service Knowledge Base',
      status: 'failed',
      createdAt: '2024-01-14 14:20:00',
      error: 'Test data format error',
      testCases: 25,
    },
  ];

  const mockKnowledgeBases = [
    { id: 1, name: 'Product Knowledge Base' },
    { id: 2, name: 'Technical Docs Library' },
    { id: 3, name: 'Customer Service Knowledge Base' },
    { id: 4, name: 'Laws & Regulations Library' },
  ];

  useEffect(() => {
    setEvaluations(mockEvaluations);
    setKnowledgeBases(mockKnowledgeBases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, any> = {
      completed: {
        color: 'success',
        text: t('ragas.status.completed'),
        icon: <CheckCircleOutlined />,
      },
      running: {
        color: 'processing',
        text: t('ragas.status.running'),
        icon: <SyncOutlined spin />,
      },
      failed: {
        color: 'error',
        text: t('ragas.status.failed'),
        icon: <CloseCircleOutlined />,
      },
      pending: {
        color: 'default',
        text: t('ragas.status.pending'),
        icon: <InfoCircleOutlined />,
      },
    };
    const config = statusMap[status] || statusMap.pending;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getMetricColor = (score: number) => {
    if (score >= 0.8) return '#52c41a';
    if (score >= 0.6) return '#faad14';
    return '#ff4d4f';
  };

  const columns = [
    {
      title: t('ragas.col.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {t('ragas.kbLabel', { name: record.knowledgeBase })}
          </Text>
        </div>
      ),
    },
    {
      title: t('ragas.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: any) => (
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
      ),
    },
    {
      title: t('ragas.col.testCases'),
      key: 'testCases',
      width: 100,
      render: (_: any, record: any) => (
        <div>
          <Text>{record.testCases}</Text>
          {record.passedCases && (
            <div>
              <Text type="success" style={{ fontSize: '12px' }}>
                {t('ragas.col.passed', { count: record.passedCases })}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('ragas.col.score'),
      key: 'score',
      width: 120,
      render: (_: any, record: any) => {
        if (record.status === 'completed' && record.metrics) {
          return (
            <Statistic
              value={record.metrics.overall_score}
              precision={2}
              styles={{
                content: {
                  color: getMetricColor(record.metrics.overall_score),
                  fontSize: '16px',
                },
              }}
              suffix="/1.0"
            />
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: t('ragas.col.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: t('ragas.col.actions'),
      key: 'actions',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title={t('ragas.action.viewDetail')}>
            <Button
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === 'running' && (
            <Tooltip title={t('ragas.action.stop')}>
              <Button
                icon={<StopOutlined />}
                onClick={() => handleStopEvaluation(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'completed' && (
            <Tooltip title={t('ragas.action.download')}>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadReport(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const handleCreateEvaluation = () => {
    setCreateModalVisible(true);
  };

  const handleViewDetail = (evaluation: any) => {
    setSelectedEvaluation(evaluation);
    setDetailModalVisible(true);
  };

  const handleStopEvaluation = (_id: number) => {
    Modal.confirm({
      title: t('ragas.confirmStopTitle'),
      content: t('ragas.confirmStopContent'),
      onOk: () => {
        message.success(t('ragas.stopSuccess'));
        // TODO: call API to stop evaluation
      },
    });
  };

  const handleDownloadReport = (_id: number) => {
    message.success(t('ragas.downloadStarted'));
    // TODO: call API to download report
  };

  const handleSubmitCreate = async (_values: any) => {
    try {
      setLoading(true);
      // TODO: call API to create evaluation
      message.success(t('ragas.createSuccess'));
      setCreateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error(t('ragas.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
          <BarChartOutlined style={{ marginRight: '8px' }} />
          {t('ragas.title')}
        </Title>
        <Text type="secondary">{t('ragas.subtitle')}</Text>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Select
            placeholder={t('ragas.selectKnowledgeBase')}
            style={{ width: 200 }}
            value={selectedKnowledgeBase}
            onChange={setSelectedKnowledgeBase}
            allowClear
          >
            {knowledgeBases.map((kb) => (
              <Option key={kb.id} value={kb.id}>
                {kb.name}
              </Option>
            ))}
          </Select>
          <Button icon={<SettingOutlined />}>{t('ragas.configureBtn')}</Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleCreateEvaluation}
          >
            {t('ragas.createBtn')}
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
          showTotal: (total) => t('ragas.pagination.total', { total }),
        }}
      />

      {/* Create modal */}
      <Modal
        title={t('ragas.create.title')}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitCreate}>
          <Form.Item
            name="name"
            label={t('ragas.col.name')}
            rules={[{ required: true, message: t('ragas.create.nameRequired') }]}
          >
            <Input placeholder={t('ragas.create.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="knowledgeBaseId"
            label={t('ragas.create.kbLabel')}
            rules={[{ required: true, message: t('ragas.create.kbRequired') }]}
          >
            <Select placeholder={t('ragas.create.kbPlaceholder')}>
              {knowledgeBases.map((kb) => (
                <Option key={kb.id} value={kb.id}>
                  {kb.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="testData"
            label={t('ragas.create.testDataLabel')}
            rules={[{ required: true, message: t('ragas.create.testDataRequired') }]}
          >
            <TextArea rows={6} placeholder={t('ragas.create.testDataPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="metrics"
            label={t('ragas.create.metricsLabel')}
            initialValue={[
              'faithfulness',
              'answer_relevancy',
              'context_precision',
              'context_recall',
            ]}
          >
            <Select mode="multiple" placeholder={t('ragas.create.metricsPlaceholder')}>
              <Option value="faithfulness">
                {t('ragas.metric.faithfulness')} (Faithfulness)
              </Option>
              <Option value="answer_relevancy">
                {t('ragas.metric.answerRelevancy')} (Answer Relevancy)
              </Option>
              <Option value="context_precision">
                {t('ragas.metric.contextPrecision')} (Context Precision)
              </Option>
              <Option value="context_recall">
                {t('ragas.metric.contextRecall')} (Context Recall)
              </Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>
                {t('ragas.create.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t('ragas.create.submit')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail modal */}
      <Modal
        title={t('ragas.detail.title')}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            {t('ragas.detail.close')}
          </Button>,
        ]}
        width={800}
      >
        {selectedEvaluation && (
          <div>
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={12}>
                <Card>
                  <Statistic
                    title={t('ragas.detail.name')}
                    value={selectedEvaluation.name}
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title={t('ragas.detail.kb')}
                    value={selectedEvaluation.knowledgeBase}
                    styles={{ content: { fontSize: '16px' } }}
                  />
                </Card>
              </Col>
            </Row>

            {selectedEvaluation.status === 'completed' &&
              selectedEvaluation.metrics && (
                <Card title={t('ragas.detail.metrics')} style={{ marginBottom: '16px' }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Statistic
                        title={t('ragas.metric.faithfulness')}
                        value={selectedEvaluation.metrics.faithfulness}
                        precision={3}
                        styles={{
                          content: {
                            color: getMetricColor(
                              selectedEvaluation.metrics.faithfulness
                            ),
                          },
                        }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title={t('ragas.metric.answerRelevancy')}
                        value={selectedEvaluation.metrics.answer_relevancy}
                        precision={3}
                        styles={{
                          content: {
                            color: getMetricColor(
                              selectedEvaluation.metrics.answer_relevancy
                            ),
                          },
                        }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title={t('ragas.metric.contextPrecision')}
                        value={selectedEvaluation.metrics.context_precision}
                        precision={3}
                        styles={{
                          content: {
                            color: getMetricColor(
                              selectedEvaluation.metrics.context_precision
                            ),
                          },
                        }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title={t('ragas.metric.contextRecall')}
                        value={selectedEvaluation.metrics.context_recall}
                        precision={3}
                        styles={{
                          content: {
                            color: getMetricColor(
                              selectedEvaluation.metrics.context_recall
                            ),
                          },
                        }}
                      />
                    </Col>
                  </Row>
                </Card>
              )}

            {selectedEvaluation.error && (
              <Alert
                message={t('ragas.detail.failedAlert')}
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
