import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Switch,
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
  Select,
  Tooltip,
  Descriptions,
  Divider,
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
  
  const {
    config,
    loading,
    status,
    textModels,
    embeddingModels,
    rerankModels,
    defaultTextModelInfo,
    defaultRerankModelInfo,
    defaultEmbeddingModelInfo,
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
  } = useGraphEnhancement();
  
  const [graphitiEnabled, setGraphitiEnabled] = useState(false);
  const [graphitiQueryModalVisible, setGraphitiQueryModalVisible] = useState(false);
  const [graphitiRerankType, setGraphitiRerankType] = useState('reranker');
  const [graphitiDatabaseType, setGraphitiDatabaseType] = useState('neo4j');
  const [graphitiCommunityConfig, setGraphitiCommunityConfig] = useState({
    auto_build_enabled: false,
    return_community_summaries: false
  });
  const [partitionStrategies, setPartitionStrategies] = useState([]);

  const loadPartitionStrategies = async () => {
    try {
      const response = await fetch('/api/memory/partition-strategies');
      const data = await response.json();
      if (data.success) {
        setPartitionStrategies(data.data);
      }
    } catch (error) {
      console.error('加载分区策略失败:', error);
    }
  };

  useEffect(() => {
    const loadGraphitiConfig = async () => {
      await loadModelConfigs();
      await loadPartitionStrategies();
      
      const configData = await loadConfig();
      if (configData && configData.framework === 'graphiti') {
        setGraphitiEnabled(configData.enabled || false);
        const dbType = configData.framework_config?.database_type || 'neo4j';
        setGraphitiDatabaseType(dbType);

        const formValues = {
          ...configData,
          framework: 'graphiti'
        };

        const communityConfig = configData.framework_config?.community_config || { auto_build_enabled: false };
        setGraphitiCommunityConfig(communityConfig);

        const rerankType = configData.framework_config?.rerank_type || 'reranker';
        setGraphitiRerankType(rerankType);

        graphitiForm.setFieldsValue(formValues);
      }
    };

    loadGraphitiConfig();
    loadStatus();

    const statusInterval = setInterval(() => {
      loadStatus();
    }, 10000);

    return () => clearInterval(statusInterval);
  }, []);

  const handleSaveConfig = async (values: any) => {
    // 确保 framework 字段设置为 graphiti
    const configData = {
      ...values,
      framework: 'graphiti',
      enabled: graphitiEnabled
    };
    const success = await saveConfig(configData);
    if (success) {
      message.success('配置保存成功');
    }
  };

  const handleClearData = () => {
    Modal.confirm({
      title: '确认清空数据',
      content: '此操作将清空所有图谱数据，且不可恢复。是否继续？',
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const success = await clearGraph();
        if (success) {
          message.success('数据清空成功');
          await loadStatus();
        }
      }
    });
  };

  const handleBuildCommunities = async () => {
    const success = await buildCommunities();
    if (success) {
      message.success('社区构建任务已提交，请稍后查看结果');
    }
  };

  return (
    <>
      {/* 启用开关 */}
      <Card title="启用Graphiti长期记忆系统" style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Switch
              checked={graphitiEnabled}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              loading={loading}
              onChange={async (checked) => {
                if (checked) {
                  setGraphitiEnabled(true);
                  message.info('请先完成配置，然后点击保存按钮');
                } else {
                  const success = await saveConfig({
                    ...config,
                    framework: 'graphiti',
                    enabled: false
                  });
                  if (success) {
                    setGraphitiEnabled(false);
                    message.success('Graphiti已禁用');
                  } else {
                    setGraphitiEnabled(true);
                  }
                }
              }}
            />
          </Col>
          <Col flex={1}>
            <Text type="secondary">时序感知知识图谱，用于智能体长期记忆管理</Text>
          </Col>
        </Row>
      </Card>

      {graphitiEnabled && (
        <Form
          form={graphitiForm}
          layout="vertical"
          onFinish={handleSaveConfig}
          initialValues={{
            framework: 'graphiti',
            enabled: true,
            framework_config: {
              database_type: 'neo4j',
              neo4j_uri: 'bolt://neo4j:7687',
              neo4j_browser_uri: 'bolt://127.0.0.1:7687',
              neo4j_user: 'neo4j',
              neo4j_password: 'password',
              database_name: 'neo4j',
              service_url: 'http://localhost:8002',
              mcp_service_url: 'http://localhost:8003',
              service_port: '8002:8000',
              mcp_service_port: '8003:8001',
              text_model_id: 'default',
              embedding_model_id: 'default',
              rerank_model_id: 'default',
              rerank_type: 'reranker',
              openai_compatible: false,
              partition_strategy: 'by_space',
              message_sync_strategy: 'disabled',
              community_config: { auto_build_enabled: false }
            }
          }}
        >
          {/* 服务状态与配置 */}
          <Card
            title={
              <Space>
                <BarChartOutlined />
                服务状态与配置
                {status?.connected ? <Tag color="success">运行中</Tag> : <Tag color="default">未启动</Tag>}
              </Space>
            }
            extra={
              <Button icon={<ReloadOutlined />} onClick={loadStatus} loading={loading}>
                刷新
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            {/* 状态信息 */}
            {status && (
              <>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="服务状态">
                    {status.connected ? <Tag color="success">已连接</Tag> : <Tag color="default">未连接</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="节点数量">{status.statistics?.node_count || 0}</Descriptions.Item>
                  <Descriptions.Item label="关系数量">{status.statistics?.relation_count || 0}</Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '16px 0' }} />
              </>
            )}

            {/* 服务配置 */}
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'service_url']}
                  label="服务地址"
                  rules={[{ required: true, message: '请输入服务地址' }]}
                  tooltip="Graphiti FastAPI 服务的访问地址"
                >
                  <Input placeholder="http://localhost:8002" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'mcp_service_url']}
                  label="MCP服务地址"
                  tooltip="Graphiti MCP SSE 服务的访问地址"
                >
                  <Input placeholder="http://localhost:8003" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'neo4j_browser_uri']}
                  label="数据库访问地址"
                  rules={[{ required: true, message: '请输入数据库访问地址' }]}
                  tooltip="用于后端服务访问 Neo4j 数据库的地址"
                >
                  <Input placeholder="bolt://127.0.0.1:7687" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'service_port']}
                  label="服务端口映射"
                  tooltip="宿主机端口:容器端口"
                >
                  <Input placeholder="8002:8000" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'mcp_service_port']}
                  label="MCP端口映射"
                  tooltip="宿主机端口:容器端口"
                >
                  <Input placeholder="8003:8001" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="服务控制" style={{ marginBottom: 0 }}>
                  <Button
                    type={status?.connected ? "default" : "primary"}
                    icon={status?.connected ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => controlService(status?.connected ? 'stop' : 'start')}
                    loading={loading}
                  >
                    {status?.connected ? '停止服务' : '启动服务'}
                  </Button>
                </Form.Item>
              </Col>
            </Row>

            {/* 模型配置 */}
            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <CloudOutlined />
                模型配置
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'text_model_id']}
                  label={
                    <Space>
                      文本生成模型
                      <Tooltip title="用于LLM推理和知识提取">
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请选择文本生成模型' }]}
                >
                  <Select
                    placeholder="选择文本生成模型"
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: `默认 ${defaultTextModelInfo ? `(${defaultTextModelInfo.name})` : ''}` },
                      ...(textModels || []).map(model => ({
                        value: model.id.toString(),
                        label: `${model.name} (${model.provider})`,
                      }))
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'embedding_model_id']}
                  label={
                    <Space>
                      嵌入模型
                      <Tooltip title="用于生成向量表示">
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请选择嵌入模型' }]}
                >
                  <Select
                    placeholder="选择嵌入模型"
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: `默认 ${defaultEmbeddingModelInfo ? `(${defaultEmbeddingModelInfo.name})` : ''}` },
                      ...(embeddingModels || []).map(model => ({
                        value: model.id.toString(),
                        label: `${model.name} (${model.provider})`,
                      }))
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'embedding_dimension']}
                  label="向量维度"
                  tooltip="留空则自动检测"
                >
                  <InputNumber placeholder="自动检测" style={{ width: '100%' }} min={1} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'rerank_type']}
                  label="重排序类型"
                  rules={[{ required: true, message: '请选择重排序类型' }]}
                >
                  <Select
                    placeholder="选择重排序类型"
                    onChange={(value) => setGraphitiRerankType(value)}
                    options={[
                      { value: 'reranker', label: 'Reranker模型' },
                      { value: 'llm', label: 'LLM重排序' }
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'rerank_model_id']}
                  label={
                    <Space>
                      重排序模型
                      <Tooltip title="用于搜索结果重排序，提升检索准确性">
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请选择重排序模型' }]}
                >
                  <Select
                    placeholder="选择重排序模型"
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={
                      graphitiRerankType === 'llm'
                        ? [
                            { value: 'default', label: `默认 ${defaultTextModelInfo ? `(${defaultTextModelInfo.name})` : ''}` },
                            ...(textModels || []).map(model => ({
                              value: model.id.toString(),
                              label: `${model.name} (${model.provider})`,
                            }))
                          ]
                        : [
                            { value: 'default', label: `默认 ${defaultRerankModelInfo ? `(${defaultRerankModelInfo.name})` : ''}` },
                            ...(rerankModels || []).map(model => ({
                              value: model.id.toString(),
                              label: `${model.name} (${model.provider})`,
                            }))
                          ]
                    }
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'openai_compatible']}
                  label="宽松解析"
                  valuePropName="checked"
                  tooltip="提高与非OpenAI标准LLM的兼容性"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            {/* 记忆配置 */}
            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <SettingOutlined />
                记忆配置
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'partition_strategy']}
                  label="分区策略"
                  rules={[{ required: true, message: '请选择分区策略' }]}
                  tooltip="选择记忆数据的分区方式，影响智能体间的记忆共享范围"
                >
                  <Select placeholder="选择记忆分区策略" optionLabelProp="label">
                    {partitionStrategies.map(strategy => (
                      <Select.Option key={strategy.key} value={strategy.key} label={strategy.name}>
                        <div style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                            <Text strong>{strategy.name}</Text>
                            {strategy.default && <Tag color="blue" style={{ marginLeft: 8 }}>推荐</Tag>}
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>{strategy.description}</Text>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'message_sync_strategy']}
                  label="消息自动同步策略"
                  rules={[{ required: true, message: '请选择消息同步策略' }]}
                  tooltip="控制何时将对话消息自动同步到图谱记忆"
                >
                  <Select placeholder="选择消息同步策略" optionLabelProp="label">
                    <Select.Option value="disabled" label="关闭">
                      <div style={{ padding: '4px 0' }}>
                        <Text strong>关闭</Text>
                        <Tag color="orange" style={{ marginLeft: 8 }}>默认</Tag>
                        <div><Text type="secondary" style={{ fontSize: '12px' }}>不自动同步消息到图谱记忆</Text></div>
                      </div>
                    </Select.Option>
                    <Select.Option value="message_complete" label="消息完成">
                      <div style={{ padding: '4px 0' }}>
                        <Text strong>消息完成</Text>
                        <div><Text type="secondary" style={{ fontSize: '12px' }}>每条智能体消息完成后立即同步</Text></div>
                      </div>
                    </Select.Option>
                    <Select.Option value="round_complete" label="轮次完成">
                      <div style={{ padding: '4px 0' }}>
                        <Text strong>轮次完成</Text>
                        <div><Text type="secondary" style={{ fontSize: '12px' }}>完整对话轮次完成后同步</Text></div>
                      </div>
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'semaphore_limit']}
                  label="并发限制"
                  tooltip="控制同时处理的任务数量"
                >
                  <InputNumber placeholder="10" min={1} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {/* 社区管理 */}
            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <SortAscendingOutlined />
                社区管理
                <Tooltip title="社区构建使用Leiden算法将相关的实体节点聚集成群，有助于提供更高层次的语义信息和更好的检索效果">
                  <InfoCircleOutlined style={{ color: '#1677ff' }} />
                </Tooltip>
              </Space>
            </Divider>

            <Row gutter={16} align="middle">
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'community_config', 'auto_build_enabled']}
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Space>
                    <Switch
                      checkedChildren="开启"
                      unCheckedChildren="关闭"
                      onChange={(checked) => setGraphitiCommunityConfig({ ...graphitiCommunityConfig, auto_build_enabled: checked })}
                    />
                    <Text>自动构建社区</Text>
                  </Space>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'community_config', 'return_community_summaries']}
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Space>
                    <Switch
                      checkedChildren="开启"
                      unCheckedChildren="关闭"
                      onChange={(checked) => setGraphitiCommunityConfig({ ...graphitiCommunityConfig, return_community_summaries: checked })}
                    />
                    <Text>返回社区摘要</Text>
                  </Space>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleBuildCommunities}
                  loading={buildingCommunities}
                  disabled={!graphitiEnabled}
                >
                  {buildingCommunities ? '发送中...' : '立即构建社区'}
                </Button>
              </Col>
            </Row>

            {/* 高级选项 - Neo4j配置 */}
            <Collapse
              ghost
              style={{ marginTop: 16 }}
              items={[{
                key: 'advanced',
                label: (
                  <Space>
                    <DatabaseOutlined />
                    <Text strong>高级选项 - Neo4j 数据库配置（容器内部）</Text>
                    <Tooltip title="这些是容器内部的 Neo4j 配置，通常使用默认值即可。只有在使用外部 Neo4j 服务或自定义部署时才需要修改。">
                      <InfoCircleOutlined style={{ color: '#faad14' }} />
                    </Tooltip>
                  </Space>
                ),
                children: (
                  <>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          name={['framework_config', 'database_type']}
                          label="数据库类型"
                          rules={[{ required: true, message: '请选择数据库类型' }]}
                        >
                          <Select
                            placeholder="选择图数据库类型"
                            onChange={(value) => setGraphitiDatabaseType(value)}
                            options={[{ value: 'neo4j', label: 'Neo4j' }]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={['framework_config', 'neo4j_uri']}
                          label="连接URI"
                          rules={[{ required: true, message: '请输入连接URI' }]}
                          tooltip="容器部署: bolt://neo4j:7687"
                        >
                          <Input placeholder="bolt://neo4j:7687" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={['framework_config', 'database_name']}
                          label="数据库名"
                          tooltip="Neo4j数据库名称"
                        >
                          <Input placeholder="neo4j" />
                        </Form.Item>
                      </Col>
                    </Row>
                    {graphitiDatabaseType === 'neo4j' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            name={['framework_config', 'neo4j_user']}
                            label="用户名"
                            rules={[{ required: true, message: '请输入用户名' }]}
                          >
                            <Input placeholder="neo4j" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name={['framework_config', 'neo4j_password']}
                            label="密码"
                            rules={[{ required: true, message: '请输入密码' }]}
                          >
                            <Input.Password placeholder="password" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                  </>
                )
              }]}
            />

            {/* 底部操作按钮 */}
            <Divider style={{ margin: '16px 0' }} />
            <Space wrap style={{ width: '100%', justifyContent: 'center' }}>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                保存配置
              </Button>
              <Button
                type={status?.connected ? "default" : "primary"}
                icon={status?.connected ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => controlService(status?.connected ? 'stop' : 'start')}
                loading={loading}
              >
                {status?.connected ? '停止服务' : '启动服务'}
              </Button>
              <Button icon={<SearchOutlined />} onClick={() => setGraphitiQueryModalVisible(true)}>
                测试查询
              </Button>
              <Button danger icon={<ClearOutlined />} onClick={handleClearData} loading={clearLoading}>
                清空数据
              </Button>
            </Space>
          </Card>
        </Form>
      )}

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
