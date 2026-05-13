import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Switch,
  Radio,
  Input,
  InputNumber,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  App,
  Modal,
  Alert,
  Select,
  Tooltip,
  Descriptions,
  Collapse
} from 'antd';
import {
  BarChartOutlined,
  ReloadOutlined,
  ClearOutlined,
  SaveOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  CloudOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CloudServerOutlined,
  SortAscendingOutlined,
  SettingOutlined
} from '@ant-design/icons';
import GraphEnhancementTestQuery from './GraphEnhancementTestQuery';
import { useGraphEnhancement } from './useGraphEnhancement';

const { Text } = Typography;
const { Panel } = Collapse;

const GraphitiTab = () => {
  const { message } = App.useApp();
  const [graphitiForm] = Form.useForm();
  
  // Use custom Hook
  const {
    config,
    loading,
    status,
    textModels,
    embeddingModels,
    rerankModels,
    defaultTextModel,
    defaultEmbeddingModel,
    defaultRerankModel,
    defaultTextModelInfo,
    defaultEmbeddingModelInfo,
    defaultRerankModelInfo,
    clearLoading,
    buildingCommunities,
    testResult,
    loadConfig,
    saveConfig,
    loadStatus,
    loadModelConfigs,
    controlService,
    clearGraph,
    buildCommunities,
    testQuery,
    setTestResult
  } = useGraphEnhancement();
  
  // Graphiti related states
  const [graphitiEnabled, setGraphitiEnabled] = useState(false);
  const [graphitiQueryModalVisible, setGraphitiQueryModalVisible] = useState(false);
  const [graphitiRerankType, setGraphitiRerankType] = useState('reranker');
  const [graphitiDatabaseType, setGraphitiDatabaseType] = useState('neo4j');
  const [graphitiCommunityConfig, setGraphitiCommunityConfig] = useState({
    auto_build_enabled: false
  });

  // Load configuration
  useEffect(() => {
    const loadGraphitiConfig = async () => {
      // Load model configs first
      await loadModelConfigs();
      
      const configData = await loadConfig();
      if (configData && configData.framework === 'graphiti') {
        setGraphitiEnabled(configData.enabled || false);
        const dbType = configData.framework_config?.database_type || 'neo4j';
        setGraphitiDatabaseType(dbType);

        const formValues = {
          ...configData,
          framework: 'graphiti'
        };

        // Set community config
        const rawCommunityConfig = configData.framework_config?.community_config || {};
        const communityConfigData = {
          auto_build_enabled: rawCommunityConfig.auto_build_enabled || false
        };
        setGraphitiCommunityConfig(communityConfigData);

        // Only set form values when form is enabled
        if (configData.enabled) {
          graphitiForm.setFieldsValue(formValues);
        }
        // Sync rerank type state
        setGraphitiRerankType(formValues.framework_config?.rerank_type || 'reranker');
      }
    };

    loadGraphitiConfig();
    loadStatus();
  }, [loadConfig, loadStatus, loadModelConfigs, graphitiForm]);

  // 保存Graphiti配置
  const handleSaveGraphitiConfig = async (values) => {
    try {
      // 处理模型配置 - 只保存模型ID，不保存完整的模型信息
      let processedValues = { ...values };

      try {
        // 处理文本生成模型配置 - 只保存ID
        const textModelId = values.framework_config?.text_model_id;
        if (textModelId && textModelId !== 'default') {
          // 验证模型是否存在
          const textModel = textModels.find(m => m.id.toString() === textModelId.toString());
          if (textModel) {
            console.log(`保存文本生成模型ID: ${textModelId} (${textModel.name})`);
          } else {
            console.warn(`文本生成模型ID ${textModelId} 不存在，将使用默认模型`);
            processedValues.framework_config.text_model_id = 'default';
          }
        } else {
          // 使用默认文本生成模型
          processedValues.framework_config.text_model_id = 'default';
          console.log('使用默认文本生成模型');
        }

        // 处理嵌入模型配置 - 只保存ID
        const embeddingModelId = values.framework_config?.embedding_model_id;
        if (embeddingModelId && embeddingModelId !== 'default') {
          // 验证模型是否存在
          const embeddingModel = embeddingModels.find(m => m.id.toString() === embeddingModelId.toString());
          if (embeddingModel) {
            console.log(`保存嵌入模型ID: ${embeddingModelId} (${embeddingModel.name})`);
          } else {
            console.warn(`嵌入模型ID ${embeddingModelId} 不存在，将使用默认模型`);
            processedValues.framework_config.embedding_model_id = 'default';
          }
        } else {
          // 使用默认嵌入模型
          processedValues.framework_config.embedding_model_id = 'default';
          console.log('使用默认嵌入模型');
        }

        // 处理重排序模型配置 - 只保存ID和类型
        const rerankType = values.framework_config?.rerank_type || 'reranker';
        const rerankModelId = values.framework_config?.rerank_model_id;

        // 保存重排序类型
        processedValues.framework_config.rerank_type = rerankType;
        console.log(`重排序类型: ${rerankType}`);

        if (rerankModelId && rerankModelId !== 'default') {
          // 根据重排序类型验证模型
          const availableModels = rerankType === 'llm' ? textModels : rerankModels;
          const rerankModel = availableModels.find(m => m.id.toString() === rerankModelId.toString());

          if (rerankModel) {
            console.log(`保存重排序模型ID: ${rerankModelId} (${rerankModel.name})`);
          } else {
            console.warn(`重排序模型ID ${rerankModelId} 不存在，将使用默认模型`);
            processedValues.framework_config.rerank_model_id = 'default';
          }
        } else {
          // 使用默认重排序模型
          processedValues.framework_config.rerank_model_id = 'default';
          console.log('使用默认重排序模型');
        }

        // 移除旧的完整模型配置字段（如果存在）
        delete processedValues.framework_config.text_model;
        delete processedValues.framework_config.embedding_model;
        delete processedValues.framework_config.rerank_model;

      } catch (error) {
        console.error('处理模型配置时出错:', error);
        message.error('处理模型配置失败: ' + error.message);
        return;
      }

      // 将社区配置合并到framework_config中
      const frameworkConfig = {
        ...processedValues.framework_config,
        community_config: graphitiCommunityConfig
      };

      const configData = {
        ...processedValues,
        enabled: graphitiEnabled,
        framework: 'graphiti',
        framework_config: frameworkConfig
      };

      const success = await saveConfig(configData);
      
      if (!success) {
        message.error('配置保存失败');
      }
    } catch (error) {
      message.error('配置保存失败: ' + error.message);
    }
  };

  // 清空数据
  const handleClearData = async () => {
    Modal.confirm({
      title: '确认清空数据',
      content: '此操作将清空所有图谱数据，无法恢复。确定要继续吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        await clearGraph();
      }
    });
  };

  // Graphiti自动构建开关处理
  const handleGraphitiAutoToggle = (enabled) => {
    const updatedCommunityConfig = {
      ...graphitiCommunityConfig,
      auto_build_enabled: enabled
    };
    setGraphitiCommunityConfig(updatedCommunityConfig);
  };

  const renderStatusTag = (status) => {
    const statusConfig = {
      connected: { color: 'green', text: '已连接' },
      ready: { color: 'green', text: '服务正常' },
      disconnected: { color: 'red', text: '未连接' },
      error: { color: 'red', text: '错误' },
      initializing: { color: 'blue', text: '初始化中' }
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <>
      {/* 顶部开关区域 */}
      <Card
        title="启用Graphiti长期记忆"
        style={{ marginBottom: 24 }}
      >
        <Row align="middle" gutter={16}>
          <Col>
            <Switch
              checked={graphitiEnabled}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              loading={loading}
              onChange={async (checked) => {
                if (checked) {
                  // 启用时：只更新界面状态，不立即保存
                  setGraphitiEnabled(true);
                  message.info('请先完成配置，然后点击保存按钮');
                } else {
                  // 禁用时：直接保存禁用状态
                  const success = await saveConfig({
                    ...config,
                    framework: 'graphiti',
                    enabled: false
                  });

                  if (success) {
                    setGraphitiEnabled(false);
                    message.success('Graphiti已禁用');
                  } else {
                    // 如果保存失败，恢复原状态
                    setGraphitiEnabled(true);
                  }
                }
              }}
            />
          </Col>
          <Col flex={1}>
            <Text type="secondary">
              时序感知的知识图谱，用于长期记忆管理
            </Text>
          </Col>
        </Row>
      </Card>

      {graphitiEnabled && (
        <Form
          form={graphitiForm}
          layout="vertical"
          onFinish={handleSaveGraphitiConfig}
          initialValues={{
            ...config,
            framework: 'graphiti'
          }}
        >
          {/* 图谱状态监控 */}
          <Card
            title={
              <Space>
                <BarChartOutlined />
                服务状态监控
              </Space>
            }
            style={{ marginBottom: 24 }}
            extra={
              <Button
                onClick={loadStatus}
                icon={<ReloadOutlined />}
              >
                刷新状态
              </Button>
            }
          >
            {status ? (
              <Descriptions column={2} bordered>
                <Descriptions.Item label="服务状态">
                  {renderStatusTag(status.status)}
                </Descriptions.Item>
                <Descriptions.Item label="服务地址">
                  {config?.framework_config?.service_url || 'http://localhost:8000'}
                </Descriptions.Item>
                <Descriptions.Item label="节点数量">
                  {status.statistics?.node_count || status.statistics?.entity_count || 0}
                </Descriptions.Item>
                <Descriptions.Item label="关系数量">
                  {status.statistics?.relation_count || 0}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--custom-text-secondary)', padding: '20px 0' }}>
                <Text type="secondary">暂无状态信息</Text>
              </div>
            )}
          </Card>

          {/* Graphiti配置 */}
          <Card
            title={
              <Space>
                <DatabaseOutlined />
                Graphiti 配置
                <Tag color="blue">时序感知知识图谱</Tag>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            {/* 1. 容器化服务配置 */}
            <Card
              type="inner"
              title={
                <Space>
                  <CloudServerOutlined />
                  Graphiti 容器化服务
                  <Tag color="green">Docker</Tag>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'service_url']}
                    label="服务地址"
                    rules={[{ required: true, message: '请输入服务地址' }]}
                    tooltip="Graphiti FastAPI 服务的访问地址（用于图谱操作）"
                  >
                    <Input placeholder="http://localhost:8002" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'mcp_service_url']}
                    label="MCP服务地址"
                    tooltip="Graphiti MCP SSE 服务的访问地址（用于 MCP 集成）"
                  >
                    <Input placeholder="http://localhost:8003" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'service_port']}
                    label="服务端口映射"
                    tooltip="宿主机端口:容器端口，例如 8002:8000"
                  >
                    <Input placeholder="8002:8000" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'mcp_service_port']}
                    label="MCP端口映射"
                    tooltip="宿主机端口:容器端口，例如 8003:8001"
                  >
                    <Input placeholder="8003:8001" />
                  </Form.Item>
                </Col>
              </Row>
              <Row>
                <Col span={24}>
                  <Form.Item label="服务控制" style={{ marginBottom: 0 }}>
                    <Space>
                      <Button
                        type={status?.connected ? "default" : "primary"}
                        icon={status?.connected ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={() => controlService(status?.connected ? 'stop' : 'start')}
                        loading={loading}
                      >
                        {status?.connected ? '停止服务' : '启动服务'}
                      </Button>
                      <Text type="secondary">
                        {status?.connected ? '服务运行中' : '服务未启动'}
                      </Text>
                    </Space>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 2. 图谱模型设置 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              {/* 文本生成模型和嵌入模型 */}
              <Col span={12}>
                <Card
                  type="inner"
                  title={
                    <Space>
                      <CloudOutlined />
                      文本生成模型
                      <Tooltip title="用于LLM推理和知识提取的模型">
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  style={{ height: '100%' }}
                >
                  <Form.Item
                    name={['framework_config', 'database_type']}
                    label="数据库类型"
                    rules={[{ required: true, message: '请选择数据库类型' }]}
                    style={{ marginBottom: 16 }}
                  >
                    <Select
                      placeholder="选择图数据库类型"
                      onChange={(value) => setGraphitiDatabaseType(value)}
                    >
                      <Select.Option value="neo4j">
                        <Space>
                          <DatabaseOutlined />
                          Neo4j
                        </Space>
                      </Select.Option>
                    </Select>
                  </Form.Item>

                  {/* Neo4j 配置 */}
                  {graphitiDatabaseType === 'neo4j' && (
                    <>
                      <Form.Item
                        name={['framework_config', 'neo4j_uri']}
                        label="连接URI"
                        rules={[{ required: true, message: '请输入连接URI' }]}
                        tooltip="Neo4j连接地址。容器部署使用: bolt://neo4j:7687，本地开发使用: bolt://localhost:7687"
                        style={{ marginBottom: 12 }}
                      >
                        <Input placeholder="bolt://neo4j:7687" />
                      </Form.Item>
                      <Form.Item
                        name={['framework_config', 'database_name']}
                        label="数据库名"
                        tooltip="Neo4j数据库名称，默认为'neo4j'"
                        style={{ marginBottom: 12 }}
                      >
                        <Input placeholder="neo4j" />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item
                            name={['framework_config', 'neo4j_user']}
                            label="用户名"
                            rules={[{ required: true, message: '请输入用户名' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="neo4j" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name={['framework_config', 'neo4j_password']}
                            label="密码"
                            rules={[{ required: true, message: '请输入密码' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input.Password />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                </Card>
              </Col>

              {/* 图谱模型设置卡片 */}
              <Col span={12}>
                <Card
                  type="inner"
                  title={
                    <Space>
                      <CloudOutlined />
                      图谱模型设置
                      <Tooltip title="Graphiti需要三种模型：1) 文本生成模型用于LLM推理和知识提取；2) 嵌入模型用于生成向量表示；3) 重排序模型用于搜索结果重排序，提升检索准确性。请确保已在系统中正确配置了相应的模型。">
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  style={{ height: '100%' }}
                >
                  {/* 文本生成模型 */}
                  <Form.Item
                    name={['framework_config', 'text_model_id']}
                    label={
                      <Space>
                        <CloudOutlined style={{ color: '#1677ff' }} />
                        <span>文本生成模型</span>
                      </Space>
                    }
                    tooltip="用于LLM推理和知识提取的模型"
                    rules={[{ required: true, message: '请选择文本生成模型' }]}
                    style={{ marginBottom: 16 }}
                  >
                    <Select
                      placeholder="选择文本生成模型"
                      allowClear
                      showSearch
                      filterOption={(input, option) =>
                        option?.label?.toLowerCase().includes(input.toLowerCase())
                      }
                      options={[
                        {
                          value: 'default',
                          label: `默认文本生成模型${defaultTextModelInfo ? ` (${defaultTextModelInfo.name})` : ''}`,
                          isDefault: true,
                          model: defaultTextModelInfo
                        },
                        ...(textModels && textModels.length > 0 ?
                          textModels
                            .filter(model => model.id !== defaultTextModel)
                            .map(model => ({
                              value: model.id.toString(),
                              label: `${model.name} (${model.provider})`,
                              isDefault: false,
                              model: model
                            })) : [
                          {
                            value: 'loading',
                            label: '加载中...',
                            isDefault: false,
                            model: null,
                            disabled: true
                          }
                        ])
                      ]}
                      optionRender={(option: any) => {
                        if ((option.data as any).disabled) {
                          return <span>加载中...</span>;
                        }

                        if (option.data.isDefault) {
                          return (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>默认文本生成模型</span>
                                <Tag color="blue">默认</Tag>
                              </div>
                              {option.data.model && (
                                <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                                  {option.data.model.provider} - {option.data.model.model_id}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{option.data.model.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                                {option.data.model.provider} - {option.data.model.model_id}
                              </div>
                            </div>
                          );
                        }
                      }}
                    />
                  </Form.Item>

                  {/* 宽松解析开关 */}
                  <Form.Item
                    name={['framework_config', 'openai_compatible']}
                    label={
                      <Space>
                        <SettingOutlined style={{ color: '#1677ff' }} />
                        <span>宽松解析</span>
                        <Tooltip title="启用此选项可以提高与非OpenAI标准LLM提供商的兼容性，如国产大模型（智谱、阿里云、百度等）。如果遇到响应格式验证错误，请尝试启用此选项。">
                          <InfoCircleOutlined style={{ color: '#1677ff' }} />
                        </Tooltip>
                      </Space>
                    }
                    valuePropName="checked"
                    style={{ marginBottom: 16 }}
                  >
                    <Switch />
                  </Form.Item>

                  {/* 嵌入模型 */}
                  <Form.Item
                    name={['framework_config', 'embedding_model_id']}
                    label={
                      <Space>
                        <CloudOutlined style={{ color: '#52c41a' }} />
                        <span>嵌入模型</span>
                      </Space>
                    }
                    tooltip="用于生成向量嵌入的模型"
                    rules={[{ required: true, message: '请选择嵌入模型' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      placeholder="选择嵌入模型"
                      allowClear
                      showSearch
                      filterOption={(input, option) =>
                        option?.label?.toLowerCase().includes(input.toLowerCase())
                      }
                      options={[
                        {
                          value: 'default',
                          label: `默认嵌入模型${defaultEmbeddingModelInfo ? ` (${defaultEmbeddingModelInfo.name})` : ''}`,
                          isDefault: true,
                          model: defaultEmbeddingModelInfo
                        },
                        ...(embeddingModels && embeddingModels.length > 0 ?
                          embeddingModels
                            .filter(model => model.id !== defaultEmbeddingModel)
                            .map(model => ({
                              value: model.id.toString(),
                              label: `${model.name} (${model.provider})`,
                              isDefault: false,
                              model: model
                            })) : [
                          {
                            value: 'loading',
                            label: '加载中...',
                            isDefault: false,
                            model: null,
                            disabled: true
                          }
                        ])
                      ]}
                      optionRender={(option: any) => {
                        if ((option.data as any).disabled) {
                          return <span>加载中...</span>;
                        }

                        if (option.data.isDefault) {
                          return (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>默认嵌入模型</span>
                                <Tag color="green">默认</Tag>
                              </div>
                              {option.data.model && (
                                <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                                  {option.data.model.provider} - {option.data.model.model_id}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{option.data.model.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                                {option.data.model.provider} - {option.data.model.model_id}
                              </div>
                            </div>
                          );
                        }
                      }}
                    />
                  </Form.Item>

                  {/* 嵌入维度 */}
                  <Form.Item
                    name={['framework_config', 'embedding_dimension']}
                    label={
                      <Space>
                        <SettingOutlined style={{ color: '#722ed1' }} />
                        <span>嵌入维度</span>
                        <Tooltip title="嵌入向量的维度大小。不同模型有不同的默认维度，如text-embedding-3-small为1536，bge-m3为1024等。">
                          <InfoCircleOutlined style={{ color: '#1677ff' }} />
                        </Tooltip>
                      </Space>
                    }
                    tooltip="嵌入向量的维度大小"
                    style={{ marginBottom: 16 }}
                  >
                    <InputNumber
                      min={128}
                      max={4096}
                      step={1}
                      placeholder="如：1536, 1024, 768"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  {/* 重排序类型选择 */}
                  <Form.Item
                    name={['framework_config', 'rerank_type']}
                    label={
                      <Space>
                        <SortAscendingOutlined style={{ color: '#fa8c16' }} />
                        <span>重排序类型</span>
                      </Space>
                    }
                    tooltip="选择重排序实现方式"
                    style={{ marginBottom: 16 }}
                  >
                    <Radio.Group
                      onChange={(e) => setGraphitiRerankType(e.target.value)}
                      value={graphitiRerankType}
                    >
                      <Radio value="reranker">标准重排序</Radio>
                      <Radio value="llm">基于文本生成重排序</Radio>
                    </Radio.Group>
                  </Form.Item>

                  {/* 重排序模型 */}
                  <Form.Item
                    name={['framework_config', 'rerank_model_id']}
                    label={
                      <Space>
                        <SortAscendingOutlined style={{ color: '#fa8c16' }} />
                        <span>重排序模型</span>
                      </Space>
                    }
                    tooltip="用于搜索结果重排序、提升检索准确性的模型（可选）"
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      placeholder="选择重排序模型"
                      allowClear
                      showSearch
                      filterOption={(input, option) =>
                        option?.label?.toLowerCase().includes(input.toLowerCase())
                      }
                      options={(() => {
                        if (graphitiRerankType === 'llm') {
                          const availableModels = textModels;
                          const defaultModel = defaultTextModel;
                          const defaultModelInfo = defaultTextModelInfo;

                          return [
                            {
                              value: 'default',
                              label: `默认文本生成模型${defaultModelInfo ? ` (${defaultModelInfo.name})` : ''}`,
                              isDefault: true,
                              isTextModel: true,
                              model: defaultModelInfo
                            },
                            ...(availableModels && availableModels.length > 0 ?
                              availableModels
                                .filter(model => model.id !== defaultModel)
                                .map(model => ({
                                  value: model.id.toString(),
                                  label: `${model.name} (${model.provider})`,
                                  isDefault: false,
                                  model: model
                                })) : [
                              {
                                value: 'loading',
                                label: '加载中...',
                                isDefault: false,
                                model: null,
                                disabled: true
                              }
                            ])
                          ];
                        } else {
                          const availableModels = rerankModels;
                          const defaultModel = defaultRerankModel;
                          const defaultModelInfo = defaultRerankModelInfo;

                          return [
                            {
                              value: 'default',
                              label: `默认重排序模型${defaultModelInfo ? ` (${defaultModelInfo.name})` : ''}`,
                              isDefault: true,
                              isRerankModel: true,
                              model: defaultModelInfo
                            },
                            ...(availableModels && availableModels.length > 0 ?
                              availableModels
                                .filter(model => model.id !== defaultModel)
                                .map(model => ({
                                  value: model.id.toString(),
                                  label: `${model.name} (${model.provider})`,
                                  isDefault: false,
                                  model: model
                                })) : [
                              {
                                value: 'loading',
                                label: '加载中...',
                                isDefault: false,
                                model: null,
                                disabled: true
                              }
                            ])
                          ];
                        }
                      })()}
                      optionRender={(option: any) => {
                        if ((option.data as any).disabled) {
                          return <span>加载中...</span>;
                        }

                        if ((option.data as any).isDefault) {
                          const labelText = (option.data as any).isTextModel ? '默认文本生成模型' : '默认重排序模型';
                          return (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>{labelText}</span>
                                <Tag color="orange">默认</Tag>
                              </div>
                              {option.data.model && (
                                <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                                  {option.data.model.provider} - {option.data.model.model_id}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{option.data.model.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                                {option.data.model.provider} - {option.data.model.model_id}
                              </div>
                            </div>
                          );
                        }
                      }}
                    />
                  </Form.Item>
                </Card>
              </Col>
            </Row>

            {/* 社区管理区域 */}
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={24}>
                <Card
                  type="inner"
                  title={
                    <Space>
                      <SortAscendingOutlined />
                      社区管理
                      <Tag color="orange">图谱聚类</Tag>
                    </Space>
                  }
                >
                  <Row gutter={16} align="middle">
                    <Col span={12}>
                      <Space orientation="vertical" style={{ width: '100%' }}>
                        <div>
                          <Text strong>自动构建社区</Text>
                          <div style={{ marginTop: 8 }}>
                            <Switch
                              checked={graphitiCommunityConfig.auto_build_enabled}
                              onChange={handleGraphitiAutoToggle}
                              checkedChildren="开启"
                              unCheckedChildren="关闭"
                            />
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              在添加新数据时自动更新社区结构
                            </Text>
                          </div>
                        </div>
                      </Space>
                    </Col>

                    <Col span={12}>
                      <Space orientation="vertical" style={{ width: '100%' }}>
                        <div>
                          <Text strong>手动构建社区</Text>
                          <div style={{ marginTop: 8 }}>
                            <Button
                              type="primary"
                              icon={<PlayCircleOutlined />}
                              onClick={buildCommunities}
                              loading={buildingCommunities}
                              disabled={!graphitiEnabled}
                            >
                              {buildingCommunities ? '发送中...' : '立即构建'}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Text type="secondary">
                            点击"立即构建"将异步触发社区构建过程
                          </Text>
                        </div>
                      </Space>
                    </Col>
                  </Row>

                  <Alert
                    message="社区构建说明"
                    description="社区构建使用Leiden算法将相关的实体节点聚集成群，有助于提供更高层次的语义信息和更好的检索效果。建议在添加大量数据后手动构建一次社区。"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>

          {/* 操作按钮区域 */}
          <Card
            title="操作"
            style={{ marginBottom: 24 }}
          >
            {/* Graphiti服务配置 */}
            <Card
              type="inner"
              title={
                <Space>
                  <CloudServerOutlined />
                  Graphiti服务
                  <Tag color="green">容器化部署</Tag>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'service_url']}
                    label="服务地址"
                    rules={[{ required: true, message: '请输入服务地址' }]}
                    tooltip="Graphiti FastAPI 服务的访问地址（用于图谱操作）"
                  >
                    <Input placeholder="http://localhost:8000" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'mcp_service_url']}
                    label="MCP服务地址"
                    tooltip="Graphiti MCP SSE 服务的访问地址（用于 MCP 集成）"
                  >
                    <Input placeholder="http://localhost:8001" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'service_port']}
                    label="服务端口映射"
                    tooltip="宿主机端口:容器端口，例如 8000:8000"
                  >
                    <Input placeholder="8000:8000" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['framework_config', 'mcp_service_port']}
                    label="MCP端口映射"
                    tooltip="宿主机端口:容器端口，例如 8001:8001"
                  >
                    <Input placeholder="8001:8001" />
                  </Form.Item>
                </Col>
              </Row>
              <Row>
                <Col span={24}>
                  <Form.Item label="服务控制" style={{ marginBottom: 0 }}>
                    <Space>
                      <Button
                        type={status?.connected ? "default" : "primary"}
                        icon={status?.connected ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={() => controlService(status?.connected ? 'stop' : 'start')}
                        loading={loading}
                      >
                        {status?.connected ? '停止服务' : '启动服务'}
                      </Button>
                      <Text type="secondary">
                        {status?.connected ? '服务运行中' : '服务未启动'}
                      </Text>
                    </Space>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Space wrap>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={loading}
              >
                保存配置
              </Button>

              <Button
                icon={<SearchOutlined />}
                onClick={() => setGraphitiQueryModalVisible(true)}
              >
                测试查询
              </Button>

              <Button
                danger
                icon={<ClearOutlined />}
                onClick={handleClearData}
                loading={clearLoading}
              >
                清空数据
              </Button>
            </Space>
          </Card>
        </Form>
      )}

      {/* 测试查询Modal */}
      <GraphEnhancementTestQuery
        visible={graphitiQueryModalVisible}
        onCancel={() => setGraphitiQueryModalVisible(false)}
        onQuery={testQuery}
        loading={loading}
        result={testResult}
        config={config}
      />
    </>
  );
};

export default GraphitiTab;
