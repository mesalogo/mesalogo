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
  InputNumber,
  Divider,
  Spin,
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
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';

// 直接从源文件导入
import { agentAPI } from '../services/api/agent';
import { modelConfigAPI } from '../services/api/model';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { confirm } = Modal;
const { Panel } = Collapse;

const Agents = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [agents, setAgents] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState('');
  const [testVisible, setTestVisible] = useState(false);

  // 获取智能体列表和模型列表
  useEffect(() => {
    fetchAgents();
    fetchModels();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // 调用实际API获取数据
      console.log('开始获取智能体列表...');
      const data = await agentAPI.getAllActive();
      console.log('获取到智能体数据:', data);
      setAgents(data);
    } catch (error) {
      console.error('获取智能体列表失败:', error);
      console.error('错误详情:', error.response?.data || error.message);
      message.error(`获取智能体列表失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      console.log('开始获取模型列表...');
      // 使用agentAPI.getModelConfigs替代modelConfigAPI.getAll
      const data = await agentAPI.getModelConfigs();
      console.log('获取到模型数据:', data);
      setModels(data);
    } catch (error) {
      console.error('获取模型列表失败:', error);
      console.error('错误详情:', error.response?.data || error.message);
      message.error(`获取模型列表失败: ${error.message || '未知错误'}`);
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
      stopSequences: []
    });
    setTestResult('');
    setTestVisible(false);
    setModalVisible(true);
  };

  const showEditModal = (agent) => {
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
      stopSequences: agent.stopSequences || []
    });
    setTestResult('');
    setTestVisible(false);
    setModalVisible(true);
  };

  const handleDelete = (agent) => {
    confirm({
      title: t('agents.confirmDelete'),
      icon: <ExclamationCircleOutlined />,
      content: t('agents.deleteWarning', { name: agent.name }),
      onOk: async () => {
        try {
          await agentAPI.delete(agent.id);
          message.success(t('agents.deleteSuccess'));
          fetchAgents(); // 重新获取数据
        } catch (error) {
          console.error('删除智能体失败:', error);
          message.error(t('agents.deleteFailed'));
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (selectedAgent) {
        // 编辑模式 - 暂时不支持更新
        message.warning('更新功能暂未实现');
        setModalVisible(false);
        return;
      } else {
        // 添加模式
        await agentAPI.create(values.roleId, values);
        message.success('智能体创建成功');
      }

      setModalVisible(false);
      fetchAgents(); // 重新获取数据
    } catch (error) {
      console.error('表单验证或提交失败:', error);
      message.error('操作失败: ' + (error.message || '未知错误'));
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setTestResult('');
    setTestVisible(false);
  };

  const getRoleColor = (role) => {
    const roleColors = {
      assistant: '#1677ff',
      data_analyst: '#52c41a',
      creative_writer: '#f759ab',
      teaching_assistant: '#fa8c16',
      debater: '#722ed1',
    };
    return roleColors[role] || '#1677ff';
  };

  const getModelBadge = (model) => {
    const modelColors = {
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
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left' as const,
      render: (text) => (
        <Space>
          <UserOutlined style={{ color: '#1677ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '使用的模型',
      dataIndex: 'model',
      key: 'model',
      width: 200,
      render: (model, record) => {
        const modelConfig = models.find(m => m.id.toString() === model?.toString());
        return <Tag color={getModelBadge(modelConfig?.model_id)}>{record.model_name || modelConfig?.name || '未指定'}</Tag>;
      },
    },
    {
      title: '系统提示词',
      dataIndex: 'systemPrompt',
      key: 'systemPrompt',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text, record) => (
        <Tooltip placement="topLeft" title={record.systemPrompt || '无提示词'}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.systemPrompt ? record.systemPrompt.substring(0, 50) + (record.systemPrompt.length > 50 ? '...' : '') : '无提示词'}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (description) => (
        <Tooltip placement="topLeft" title={description}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {description}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 120,
      sorter: (a, b) => a.usageCount - b.usageCount,
    },
    {
      title: '最后更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="编辑智能体">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="删除智能体">
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
  const totalUsage = agents.reduce((sum, agent) => sum + agent.usageCount, 0);
  const mostUsedAgent = [...agents].sort((a, b) => b.usageCount - a.usageCount)[0];
  const averageUsage = totalAgents > 0 ? Math.round(totalUsage / totalAgents) : 0;

  const handleTestLLM = async () => {
    try {
      const values = await form.validateFields();
      setTestResult('');
      setTestVisible(true);

      try {
        // 获取当前选中的模型配置
        const selectedModelConfig = models.find(m => m.id.toString() === values.model?.toString());

        if (!selectedModelConfig) {
          throw new Error('未找到所选模型配置');
        }

        console.log('选中的模型配置:', {
          ...selectedModelConfig,
          api_key: selectedModelConfig.api_key ? '***已隐藏***' : undefined
        });

        // 检查模型配置中的URL，支持多种字段名称
        const baseUrl = selectedModelConfig.base_url ||
                        selectedModelConfig.baseUrl ||
                        selectedModelConfig.url ||
                        selectedModelConfig.endpoint ||
                        '';

        if (!baseUrl) {
          console.error('模型配置缺少URL:', selectedModelConfig);
          throw new Error('模型配置中没有找到基础URL (base_url/baseUrl/url/endpoint)，请确保已正确设置');
        }

        // 使用流式API替代常规API
        let streamContent = '';
        let receivedFirstResponse = false;

        // 真正的流式响应处理
        await modelConfigAPI.testModelStream(
          selectedModelConfig.id,
          "请简单地介绍一下你自己。",
          (chunk, meta) => {
            console.log("[模型测试] 收到流式数据:", {
              hasChunk: !!chunk,
              chunkLength: chunk?.length,
              meta
            });

            // 处理流式内容
            if (chunk) {
              // 无论收到多少字符，都立即更新UI
              receivedFirstResponse = true;
              streamContent += chunk;
              setTestResult(streamContent);
            }

            // 处理连接状态
            if (meta && meta.connectionStatus) {
              if (meta.connectionStatus === 'error' && meta.error) {
                setTestResult(`测试失败: ${meta.error}`);
              } else if (meta.connectionStatus === 'done') {
                console.log("[模型测试] 流式响应已完成");
              }
            }
          },
          values.systemPrompt // 传递表单中的系统提示
        );

        // 如果API调用完成但未收到任何内容
        if (!receivedFirstResponse && streamContent === '') {
          console.warn("[模型测试] 警告: 未接收到任何内容");
          if (!testResult) {
            setTestResult('测试完成，但未收到任何响应，请检查模型配置');
          }
        }
      } catch (error) {
        console.error('测试LLM失败:', error);
        setTestResult(`测试失败: ${error.message || '未知错误'}`);
      }
    } catch (error) {
      message.error('请先完成表单填写');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Title level={3} style={{ margin: 0, fontWeight: '700' }}>{t('agents.title')}</Title>
          <Space>
            <Button
              onClick={async () => {
                try {
                  console.log('测试获取智能体...');
                  console.log('agentAPI:', agentAPI);
                  const result = await agentAPI.getAllActive();
                  console.log('测试结果:', result);
                  message.success('API测试成功');
                } catch (error) {
                  console.error('API测试失败:', error);
                  message.error(`API测试失败: ${error.message}`);
                }
              }}
            >
              测试API
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
              title="智能体总数"
              value={totalAgents}
              prefix={<RobotOutlined style={{ color: '#1677ff' }} />}
              style={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总使用次数"
              value={totalUsage}
              prefix={<ThunderboltOutlined style={{ color: '#52c41a' }} />}
              style={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均使用次数"
              value={averageUsage}
              prefix={<ApiOutlined style={{ color: '#fa8c16' }} />}
              style={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="最常用智能体"
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
          boxShadow: 'var(--custom-shadow)'
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
            showTotal: (total) => `共 ${total} 个智能体`,
            showSizeChanger: true,
            showQuickJumper: true,
            position: ['bottomRight']
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
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={t('agents.name')}
            rules={[{ required: true, message: t('agents.nameRequired') }]}
          >
            <Input placeholder={t('agents.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="model"
            label="使用的模型"
            rules={[{ required: true, message: '请选择使用的模型' }]}
          >
            <Select placeholder="请选择使用的模型" loading={loadingModels}>
              {models.map(model => (
                <Option key={model.id} value={model.id}>
                  {model.name} ({model.model_id})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="systemPrompt"
            label="系统提示词"
            rules={[{ required: true, message: '请输入系统提示词' }]}
          >
            <TextArea rows={6} placeholder="请输入详细的系统提示词，用于定义智能体的行为和回答风格" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={2} placeholder="请简要描述该智能体的功能和特点" />
          </Form.Item>

          <Divider>测试智能体配置</Divider>

          <Form.Item>
            <Card
              title="测试智能体响应"
             
              style={{ marginBottom: 16 }}
              extra={
                <Button
                  type="primary"
                  onClick={handleTestLLM}
                >
                  测试
                </Button>
              }
            >
              <div style={{ marginBottom: 8, color: 'var(--custom-text-secondary)' }}>
                默认提示: "请简单地介绍一下你自己。"
              </div>

              {testVisible && (
                <div style={{
                  border: '1px solid var(--custom-border)',
                  padding: 16,
                  borderRadius: 8,
                  background: 'var(--custom-header-bg)',
                  minHeight: 100,
                  maxHeight: 300,
                  overflowY: 'auto'
                }}>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {testResult}
                  </div>
                </div>
              )}
            </Card>
          </Form.Item>

          <Collapse
            style={{ backgroundColor: 'var(--custom-header-bg)', marginBottom: '20px', marginTop: '20px' }}
            expandIcon={({ isActive }) => <SettingOutlined rotate={isActive ? 90 : 0} />}
            items={[
              {
                key: '1',
                label: "LLM参数配置",
                children: (
                  <>
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="temperature"
                          label={<Tooltip title="控制生成文本的随机性。较高的值会产生更多样化的回复，较低的值会使回复更加确定和集中。">温度 (Temperature)</Tooltip>}
                          rules={[{ required: true, message: '请设置温度' }]}
                        >
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            marks={{ 0: '确定性', 1: '随机性' }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="topP"
                          label={<Tooltip title="限制模型在选择下一个token时只考虑概率累积达到top_p的token。可以产生更集中的回复。">核采样 (Top P)</Tooltip>}
                          rules={[{ required: true, message: '请设置核采样' }]}
                        >
                          <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            marks={{ 0: '确定性', 1: '多样性' }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="frequencyPenalty"
                          label={<Tooltip title="减少模型重复同一短语的倾向。较高的值会降低文本中的重复度。">频率惩罚 (Frequency Penalty)</Tooltip>}
                          rules={[{ required: true, message: '请设置频率惩罚' }]}
                        >
                          <Slider
                            min={0}
                            max={2}
                            step={0.01}
                            marks={{ 0: '无惩罚', 2: '强惩罚' }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="presencePenalty"
                          label={<Tooltip title="降低模型讨论已经提及主题的可能性，鼓励模型探索新主题。">存在惩罚 (Presence Penalty)</Tooltip>}
                          rules={[{ required: true, message: '请设置存在惩罚' }]}
                        >
                          <Slider
                            min={0}
                            max={2}
                            step={0.01}
                            marks={{ 0: '无惩罚', 2: '强惩罚' }}
                            tooltip={{ formatter: (value) => value }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item
                      name="maxTokens"
                      label={<Tooltip title="模型在一次对话中生成的最大token数量。">最大生成长度 (Max Tokens)</Tooltip>}
                      rules={[{ required: true, message: '请设置最大生成长度' }]}
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
                      label={<Tooltip title="指定一系列字符串，当模型生成过程中遇到这些字符串时将停止生成。">停止序列 (Stop Sequences)</Tooltip>}
                    >
                      <Select
                        mode="tags"
                        style={{ width: '100%' }}
                        placeholder="可以输入多个停止序列，按回车确认"
                        tokenSeparators={[',']}
                      />
                    </Form.Item>
                  </>
                )
              }
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default Agents;