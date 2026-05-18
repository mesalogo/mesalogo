import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tooltip,
  Tag,
  Row,
  Col,
  Statistic,
  Slider,
  Collapse,
  Divider,
  App
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  RobotOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { agentAPI } from '../services/api/agent';
import { modelConfigAPI } from '../services/api/model';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { confirm } = Modal;

const Agents = () => {
  // We use the 'agents' namespace for page-specific keys and rely on
  // fallbackNS='translation' for legacy shared keys.
  const { t } = useTranslation('agents');
  const { message } = App.useApp();
  const [agents, setAgents] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState('');
  const [testVisible, setTestVisible] = useState(false);

  // Fetch agent + model lists on mount
  useEffect(() => {
    fetchAgents();
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const data = await agentAPI.getAllActive();
      setAgents(data);
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch agent list:', error);
      message.error(
        t('agents.fetchListFailed', {
          error: error?.message || t('agents.unknownError'),
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      const data = await agentAPI.getModelConfigs();
      setModels(data);
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch model list:', error);
      message.error(
        t('agents.fetchModelsFailed', {
          error: error?.message || t('agents.unknownError'),
        })
      );
    } finally {
      setLoadingModels(false);
    }
  };

  const showAddModal = () => {
    setSelectedAgent(null);
    form.resetFields();
    form.setFieldsValue({
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      maxTokens: 2000,
      stopSequences: [],
    });
    setTestResult('');
    setTestVisible(false);
    setModalVisible(true);
  };

  const showEditModal = (agent: any) => {
    setSelectedAgent(agent);
    form.setFieldsValue({
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      description: agent.description,
      temperature: agent.temperature || 0.7,
      topP: agent.topP || 1,
      frequencyPenalty: agent.frequencyPenalty || 0,
      presencePenalty: agent.presencePenalty || 0,
      maxTokens: agent.maxTokens || 2000,
      stopSequences: agent.stopSequences || [],
    });
    setTestResult('');
    setTestVisible(false);
    setModalVisible(true);
  };

  const handleDelete = (agent: any) => {
    confirm({
      title: t('agents.confirmDelete'),
      icon: <ExclamationCircleOutlined />,
      content: t('agents.deleteWarning', { name: agent.name }),
      onOk: async () => {
        try {
          await agentAPI.delete(agent.id);
          message.success(t('agents.deleteSuccess'));
          fetchAgents();
        } catch (error: any) {
          // eslint-disable-next-line no-console
          console.error('Failed to delete agent:', error);
          message.error(t('agents.deleteFailed'));
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (selectedAgent) {
        message.warning(t('agents.updateNotImplemented'));
        setModalVisible(false);
        return;
      }

      await agentAPI.create(values.roleId, values);
      message.success(t('agents.createSuccess'));
      setModalVisible(false);
      fetchAgents();
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Form validation or submit failed:', error);
      message.error(
        t('agents.opFailed', {
          error: error?.message || t('agents.unknownError'),
        })
      );
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setTestResult('');
    setTestVisible(false);
  };

  const getModelBadge = (model: string) => {
    const modelColors: Record<string, string> = {
      'gpt-4': 'cyan',
      'gpt-3.5-turbo': 'blue',
      'claude-3-opus': 'purple',
      'claude-3-sonnet': 'geekblue',
      'gemini-pro': 'green',
      'llama-3': 'orange',
    };
    return modelColors[model] || 'default';
  };

  const columns = [
    {
      title: t('agents.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left' as const,
      render: (text: string) => (
        <Space>
          <UserOutlined style={{ color: '#1677ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('agents.col.model'),
      dataIndex: 'model',
      key: 'model',
      width: 200,
      render: (model: any, record: any) => {
        const modelConfig = models.find(m => m.id.toString() === model?.toString());
        return (
          <Tag color={getModelBadge(modelConfig?.model_id)}>
            {record.model_name || modelConfig?.name || t('agents.modelUnspecified')}
          </Tag>
        );
      },
    },
    {
      title: t('agents.col.systemPrompt'),
      dataIndex: 'systemPrompt',
      key: 'systemPrompt',
      width: 200,
      ellipsis: { showTitle: false },
      render: (_: any, record: any) => (
        <Tooltip
          placement="topLeft"
          title={record.systemPrompt || t('agents.promptEmpty')}
        >
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {record.systemPrompt
              ? record.systemPrompt.substring(0, 50) +
                (record.systemPrompt.length > 50 ? '...' : '')
              : t('agents.promptEmpty')}
          </div>
        </Tooltip>
      ),
    },
    {
      title: t('agents.col.description'),
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: { showTitle: false },
      render: (description: string) => (
        <Tooltip placement="topLeft" title={description}>
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </div>
        </Tooltip>
      ),
    },
    {
      title: t('agents.col.usageCount'),
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 120,
      sorter: (a: any, b: any) => a.usageCount - b.usageCount,
    },
    {
      title: t('agents.col.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      sorter: (a: any, b: any) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    },
    {
      title: t('agents.col.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Tooltip title={t('agents.col.tooltip.edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('agents.col.tooltip.delete')}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const totalAgents = agents.length;
  const totalUsage = agents.reduce((sum, agent) => sum + (agent.usageCount || 0), 0);
  const mostUsedAgent = [...agents].sort((a, b) => b.usageCount - a.usageCount)[0];
  const averageUsage = totalAgents > 0 ? Math.round(totalUsage / totalAgents) : 0;

  const handleTestLLM = async () => {
    try {
      const values = await form.validateFields();
      setTestResult('');
      setTestVisible(true);

      try {
        const selectedModelConfig = models.find(
          m => m.id.toString() === values.model?.toString()
        );
        if (!selectedModelConfig) {
          throw new Error(t('agents.testNoModelFound'));
        }

        const baseUrl =
          selectedModelConfig.base_url ||
          selectedModelConfig.baseUrl ||
          selectedModelConfig.url ||
          selectedModelConfig.endpoint ||
          '';
        if (!baseUrl) {
          throw new Error(t('agents.testMissingBaseUrl'));
        }

        let streamContent = '';
        let receivedFirstResponse = false;

        await modelConfigAPI.testModelStream(
          selectedModelConfig.id,
          t('agents.testDefaultPrompt'),
          (chunk: string, meta: any) => {
            if (chunk) {
              receivedFirstResponse = true;
              streamContent += chunk;
              setTestResult(streamContent);
            }
            if (meta && meta.connectionStatus) {
              if (meta.connectionStatus === 'error' && meta.error) {
                setTestResult(t('agents.testFailed', { error: meta.error }));
              }
            }
          },
          values.systemPrompt
        );

        if (!receivedFirstResponse && streamContent === '') {
          if (!testResult) {
            setTestResult(t('agents.testEmptyResponse'));
          }
        }
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('Test LLM failed:', error);
        setTestResult(
          t('agents.testFailed', {
            error: error?.message || t('agents.unknownError'),
          })
        );
      }
    } catch {
      message.error(t('agents.formIncomplete'));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            {t('agents.title')}
          </Title>
          <Space>
            <Button
              onClick={async () => {
                try {
                  await agentAPI.getAllActive();
                  message.success(t('agents.testApiSuccess'));
                } catch (error: any) {
                  message.error(
                    t('agents.testApiFailed', {
                      error: error?.message || t('agents.unknownError'),
                    })
                  );
                }
              }}
            >
              {t('agents.testApi')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              {t('agents.create')}
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('agents.stats.total')}
              value={totalAgents}
              prefix={<RobotOutlined style={{ color: '#1677ff' }} />}
              style={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('agents.stats.totalUsage')}
              value={totalUsage}
              prefix={<ThunderboltOutlined style={{ color: '#52c41a' }} />}
              style={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('agents.stats.avgUsage')}
              value={averageUsage}
              prefix={<ApiOutlined style={{ color: '#fa8c16' }} />}
              style={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('agents.stats.mostUsed')}
              value={mostUsedAgent ? mostUsedAgent.name : 'N/A'}
              prefix={<UserOutlined style={{ color: '#722ed1' }} />}
              style={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{
          borderRadius: '12px',
          boxShadow: 'var(--custom-shadow)',
        }}
      >
        <Table
          columns={columns}
          dataSource={agents}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            defaultPageSize: 10,
            pageSizeOptions: [10, 50, 100],
            showTotal: (total) => t('agents.pagination.totalSuffix', { total }),
            showSizeChanger: true,
            showQuickJumper: true,
            position: ['bottomRight'],
          }}
          style={{ overflowX: 'auto' }}
        />
      </Card>

      <Modal
        title={selectedAgent ? t('agents.edit') : t('agents.create')}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={700}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('agents.name')}
            rules={[{ required: true, message: t('agents.nameRequired') }]}
          >
            <Input placeholder={t('agents.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="model"
            label={t('agents.modelLabel')}
            rules={[{ required: true, message: t('agents.modelRequired') }]}
          >
            <Select
              placeholder={t('agents.modelPlaceholder')}
              loading={loadingModels}
            >
              {models.map((model) => (
                <Option key={model.id} value={model.id}>
                  {model.name} ({model.model_id})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="systemPrompt"
            label={t('agents.systemPromptLabel')}
            rules={[
              { required: true, message: t('agents.systemPromptRequired') },
            ]}
          >
            <TextArea rows={6} placeholder={t('agents.systemPromptPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('agents.descriptionLabel')}
            rules={[
              { required: true, message: t('agents.descriptionRequired') },
            ]}
          >
            <TextArea rows={2} placeholder={t('agents.descriptionPlaceholder')} />
          </Form.Item>

          <Divider>{t('agents.testDivider')}</Divider>

          <Form.Item>
            <Card
              title={t('agents.testCardTitle')}
              style={{ marginBottom: 16 }}
              extra={
                <Button type="primary" onClick={handleTestLLM}>
                  {t('agents.testButton')}
                </Button>
              }
            >
              <div
                style={{
                  marginBottom: 8,
                  color: 'var(--custom-text-secondary)',
                }}
              >
                {t('agents.testDefaultPromptLabel')}: &quot;{t('agents.testDefaultPrompt')}&quot;
              </div>

              {testVisible && (
                <div
                  style={{
                    border: '1px solid var(--custom-border)',
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--custom-header-bg)',
                    minHeight: 100,
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}
                >
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {testResult}
                  </div>
                </div>
              )}
            </Card>
          </Form.Item>

          <Collapse
            style={{
              backgroundColor: 'var(--custom-header-bg)',
              marginBottom: '20px',
              marginTop: '20px',
            }}
            expandIcon={({ isActive }) => (
              <SettingOutlined rotate={isActive ? 90 : 0} />
            )}
            items={[
              {
                key: '1',
                label: t('agents.llmParams.title'),
                children: (
                  <>
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="temperature"
                          label={
                            <Tooltip title={t('agents.llmParams.temperatureTip')}>
                              {t('agents.llmParams.temperature')}
                            </Tooltip>
                          }
                          rules={[
                            {
                              required: true,
                              message: t('agents.llmParams.temperatureRequired'),
                            },
                          ]}
                        >
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            marks={{
                              0: t('agents.llmParams.mark.deterministic'),
                              1: t('agents.llmParams.mark.random'),
                            }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="topP"
                          label={
                            <Tooltip title={t('agents.llmParams.topPTip')}>
                              {t('agents.llmParams.topP')}
                            </Tooltip>
                          }
                          rules={[
                            {
                              required: true,
                              message: t('agents.llmParams.topPRequired'),
                            },
                          ]}
                        >
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            marks={{
                              0: t('agents.llmParams.mark.deterministic'),
                              1: t('agents.llmParams.mark.diverse'),
                            }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="frequencyPenalty"
                          label={
                            <Tooltip title={t('agents.llmParams.frequencyPenaltyTip')}>
                              {t('agents.llmParams.frequencyPenalty')}
                            </Tooltip>
                          }
                          rules={[
                            {
                              required: true,
                              message: t('agents.llmParams.frequencyPenaltyRequired'),
                            },
                          ]}
                        >
                          <Slider
                            min={0}
                            max={2}
                            step={0.01}
                            marks={{
                              0: t('agents.llmParams.mark.noPenalty'),
                              2: t('agents.llmParams.mark.strongPenalty'),
                            }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="presencePenalty"
                          label={
                            <Tooltip title={t('agents.llmParams.presencePenaltyTip')}>
                              {t('agents.llmParams.presencePenalty')}
                            </Tooltip>
                          }
                          rules={[
                            {
                              required: true,
                              message: t('agents.llmParams.presencePenaltyRequired'),
                            },
                          ]}
                        >
                          <Slider
                            min={0}
                            max={2}
                            step={0.01}
                            marks={{
                              0: t('agents.llmParams.mark.noPenalty'),
                              2: t('agents.llmParams.mark.strongPenalty'),
                            }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item
                      name="maxTokens"
                      label={
                        <Tooltip title={t('agents.llmParams.maxTokensTip')}>
                          {t('agents.llmParams.maxTokens')}
                        </Tooltip>
                      }
                      rules={[
                        {
                          required: true,
                          message: t('agents.llmParams.maxTokensRequired'),
                        },
                      ]}
                    >
                      <Slider
                        min={100}
                        max={8000}
                        step={100}
                        marks={{ 100: '100', 8000: '8000' }}
                        tooltip={{ formatter: (value) => `${value} tokens` }}
                      />
                    </Form.Item>

                    <Form.Item
                      name="stopSequences"
                      label={
                        <Tooltip title={t('agents.llmParams.stopSequencesTip')}>
                          {t('agents.llmParams.stopSequences')}
                        </Tooltip>
                      }
                    >
                      <Select
                        mode="tags"
                        style={{ width: '100%' }}
                        placeholder={t('agents.llmParams.stopSequencesPlaceholder')}
                        tokenSeparators={[',']}
                      />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default Agents;
