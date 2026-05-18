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
import { useTranslation } from 'react-i18next';
import GraphEnhancementTestQuery from './GraphEnhancementTestQuery';
import { useGraphEnhancement } from './useGraphEnhancement';

const { Text } = Typography;
const { Panel } = Collapse;

const GraphitiTab = () => {
  const { t } = useTranslation();
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
      console.error('load partition strategies failed:', error);
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
    const configData = {
      ...values,
      framework: 'graphiti',
      enabled: graphitiEnabled
    };
    const success = await saveConfig(configData);
    if (success) {
      message.success(t('graphitiTab.saveSuccess'));
    }
  };

  const handleClearData = () => {
    Modal.confirm({
      title: t('graphitiTab.clearConfirmTitle'),
      content: t('graphitiTab.clearConfirmContent'),
      okText: t('graphitiTab.confirm'),
      cancelText: t('graphitiTab.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const success = await clearGraph();
        if (success) {
          message.success(t('graphitiTab.clearSuccess'));
          await loadStatus();
        }
      }
    });
  };

  const handleBuildCommunities = async () => {
    const success = await buildCommunities();
    if (success) {
      message.success(t('graphitiTab.buildSubmitted'));
    }
  };

  return (
    <>
      {/* enable switch */}
      <Card title={t('graphitiTab.enableTitle')} style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Switch
              checked={graphitiEnabled}
              checkedChildren={t('graphitiTab.on')}
              unCheckedChildren={t('graphitiTab.off')}
              loading={loading}
              onChange={async (checked) => {
                if (checked) {
                  setGraphitiEnabled(true);
                  message.info(t('graphitiTab.enableHint'));
                } else {
                  const success = await saveConfig({
                    ...config,
                    framework: 'graphiti',
                    enabled: false
                  });
                  if (success) {
                    setGraphitiEnabled(false);
                    message.success(t('graphitiTab.disabled'));
                  } else {
                    setGraphitiEnabled(true);
                  }
                }
              }}
            />
          </Col>
          <Col flex={1}>
            <Text type="secondary">{t('graphitiTab.enableDesc')}</Text>
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
          <Card
            title={
              <Space>
                <BarChartOutlined />
                {t('graphitiTab.statusConfigTitle')}
                {status?.connected ? <Tag color="success">{t('graphitiTab.running')}</Tag> : <Tag color="default">{t('graphitiTab.notStarted')}</Tag>}
              </Space>
            }
            extra={
              <Button icon={<ReloadOutlined />} onClick={loadStatus} loading={loading}>
                {t('graphitiTab.refresh')}
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            {status && (
              <>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label={t('graphitiTab.svcStatus')}>
                    {status.connected ? <Tag color="success">{t('graphitiTab.connected')}</Tag> : <Tag color="default">{t('graphitiTab.disconnected')}</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('graphitiTab.nodeCount')}>{status.statistics?.node_count || 0}</Descriptions.Item>
                  <Descriptions.Item label={t('graphitiTab.relationCount')}>{status.statistics?.relation_count || 0}</Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '16px 0' }} />
              </>
            )}

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'service_url']}
                  label={t('graphitiTab.svcUrl')}
                  rules={[{ required: true, message: t('graphitiTab.svcUrlRequired') }]}
                  tooltip={t('graphitiTab.svcUrlTip')}
                >
                  <Input placeholder="http://localhost:8002" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'mcp_service_url']}
                  label={t('graphitiTab.mcpUrl')}
                  tooltip={t('graphitiTab.mcpUrlTip')}
                >
                  <Input placeholder="http://localhost:8003" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'neo4j_browser_uri']}
                  label={t('graphitiTab.dbUrl')}
                  rules={[{ required: true, message: t('graphitiTab.dbUrlRequired') }]}
                  tooltip={t('graphitiTab.dbUrlTip')}
                >
                  <Input placeholder="bolt://127.0.0.1:7687" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'service_port']}
                  label={t('graphitiTab.svcPort')}
                  tooltip={t('graphitiTab.portTip')}
                >
                  <Input placeholder="8002:8000" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'mcp_service_port']}
                  label={t('graphitiTab.mcpPort')}
                  tooltip={t('graphitiTab.portTip')}
                >
                  <Input placeholder="8003:8001" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('graphitiTab.svcControl')} style={{ marginBottom: 0 }}>
                  <Button
                    type={status?.connected ? "default" : "primary"}
                    icon={status?.connected ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => controlService(status?.connected ? 'stop' : 'start')}
                    loading={loading}
                  >
                    {status?.connected ? t('graphitiTab.stopSvc') : t('graphitiTab.startSvc')}
                  </Button>
                </Form.Item>
              </Col>
            </Row>

            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <CloudOutlined />
                {t('graphitiTab.modelConfig')}
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'text_model_id']}
                  label={
                    <Space>
                      {t('graphitiTab.textModel')}
                      <Tooltip title={t('graphitiTab.textModelTip')}>
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('graphitiTab.textModelRequired') }]}
                >
                  <Select
                    placeholder={t('graphitiTab.selectTextModel')}
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: `${t('graphitiTab.default')} ${defaultTextModelInfo ? `(${defaultTextModelInfo.name})` : ''}` },
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
                      {t('graphitiTab.embeddingModel')}
                      <Tooltip title={t('graphitiTab.embeddingModelTip')}>
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('graphitiTab.embeddingModelRequired') }]}
                >
                  <Select
                    placeholder={t('graphitiTab.selectEmbeddingModel')}
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: `${t('graphitiTab.default')} ${defaultEmbeddingModelInfo ? `(${defaultEmbeddingModelInfo.name})` : ''}` },
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
                  label={t('graphitiTab.embeddingDim')}
                  tooltip={t('graphitiTab.embeddingDimTip')}
                >
                  <InputNumber placeholder={t('graphitiTab.autoDetect')} style={{ width: '100%' }} min={1} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'rerank_type']}
                  label={t('graphitiTab.rerankType')}
                  rules={[{ required: true, message: t('graphitiTab.rerankTypeRequired') }]}
                >
                  <Select
                    placeholder={t('graphitiTab.selectRerankType')}
                    onChange={(value) => setGraphitiRerankType(value)}
                    options={[
                      { value: 'reranker', label: t('graphitiTab.rerankerOpt') },
                      { value: 'llm', label: t('graphitiTab.llmRerankOpt') }
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'rerank_model_id']}
                  label={
                    <Space>
                      {t('graphitiTab.rerankModel')}
                      <Tooltip title={t('graphitiTab.rerankModelTip')}>
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('graphitiTab.rerankModelRequired') }]}
                >
                  <Select
                    placeholder={t('graphitiTab.selectRerankModel')}
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={
                      graphitiRerankType === 'llm'
                        ? [
                            { value: 'default', label: `${t('graphitiTab.default')} ${defaultTextModelInfo ? `(${defaultTextModelInfo.name})` : ''}` },
                            ...(textModels || []).map(model => ({
                              value: model.id.toString(),
                              label: `${model.name} (${model.provider})`,
                            }))
                          ]
                        : [
                            { value: 'default', label: `${t('graphitiTab.default')} ${defaultRerankModelInfo ? `(${defaultRerankModelInfo.name})` : ''}` },
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
                  label={t('graphitiTab.lenientParse')}
                  valuePropName="checked"
                  tooltip={t('graphitiTab.lenientParseTip')}
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <SettingOutlined />
                {t('graphitiTab.memoryConfig')}
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'partition_strategy']}
                  label={t('graphitiTab.partitionStrategy')}
                  rules={[{ required: true, message: t('graphitiTab.partitionStrategyRequired') }]}
                  tooltip={t('graphitiTab.partitionStrategyTip')}
                >
                  <Select placeholder={t('graphitiTab.selectPartitionStrategy')} optionLabelProp="label">
                    {partitionStrategies.map(strategy => (
                      <Select.Option key={strategy.key} value={strategy.key} label={strategy.name}>
                        <div style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                            <Text strong>{strategy.name}</Text>
                            {strategy.default && <Tag color="blue" style={{ marginLeft: 8 }}>{t('graphitiTab.recommended')}</Tag>}
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
                  label={t('graphitiTab.msgSyncStrategy')}
                  rules={[{ required: true, message: t('graphitiTab.msgSyncStrategyRequired') }]}
                  tooltip={t('graphitiTab.msgSyncStrategyTip')}
                >
                  <Select placeholder={t('graphitiTab.selectMsgSyncStrategy')} optionLabelProp="label">
                    <Select.Option value="disabled" label={t('graphitiTab.sync.disabled')}>
                      <div style={{ padding: '4px 0' }}>
                        <Text strong>{t('graphitiTab.sync.disabled')}</Text>
                        <Tag color="orange" style={{ marginLeft: 8 }}>{t('graphitiTab.default')}</Tag>
                        <div><Text type="secondary" style={{ fontSize: '12px' }}>{t('graphitiTab.sync.disabledDesc')}</Text></div>
                      </div>
                    </Select.Option>
                    <Select.Option value="message_complete" label={t('graphitiTab.sync.msgComplete')}>
                      <div style={{ padding: '4px 0' }}>
                        <Text strong>{t('graphitiTab.sync.msgComplete')}</Text>
                        <div><Text type="secondary" style={{ fontSize: '12px' }}>{t('graphitiTab.sync.msgCompleteDesc')}</Text></div>
                      </div>
                    </Select.Option>
                    <Select.Option value="round_complete" label={t('graphitiTab.sync.roundComplete')}>
                      <div style={{ padding: '4px 0' }}>
                        <Text strong>{t('graphitiTab.sync.roundComplete')}</Text>
                        <div><Text type="secondary" style={{ fontSize: '12px' }}>{t('graphitiTab.sync.roundCompleteDesc')}</Text></div>
                      </div>
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'semaphore_limit']}
                  label={t('graphitiTab.concurrentLimit')}
                  tooltip={t('graphitiTab.concurrentLimitTip')}
                >
                  <InputNumber placeholder="10" min={1} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <SortAscendingOutlined />
                {t('graphitiTab.communityMgmt')}
                <Tooltip title={t('graphitiTab.communityMgmtTip')}>
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
                      checkedChildren={t('graphitiTab.on')}
                      unCheckedChildren={t('graphitiTab.off')}
                      onChange={(checked) => setGraphitiCommunityConfig({ ...graphitiCommunityConfig, auto_build_enabled: checked })}
                    />
                    <Text>{t('graphitiTab.autoBuild')}</Text>
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
                      checkedChildren={t('graphitiTab.on')}
                      unCheckedChildren={t('graphitiTab.off')}
                      onChange={(checked) => setGraphitiCommunityConfig({ ...graphitiCommunityConfig, return_community_summaries: checked })}
                    />
                    <Text>{t('graphitiTab.returnCommunitySummaries')}</Text>
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
                  {buildingCommunities ? t('graphitiTab.sending') : t('graphitiTab.buildNow')}
                </Button>
              </Col>
            </Row>

            <Collapse
              ghost
              style={{ marginTop: 16 }}
              items={[{
                key: 'advanced',
                label: (
                  <Space>
                    <DatabaseOutlined />
                    <Text strong>{t('graphitiTab.advancedTitle')}</Text>
                    <Tooltip title={t('graphitiTab.advancedTip')}>
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
                          label={t('graphitiTab.dbType')}
                          rules={[{ required: true, message: t('graphitiTab.dbTypeRequired') }]}
                        >
                          <Select
                            placeholder={t('graphitiTab.selectDbType')}
                            onChange={(value) => setGraphitiDatabaseType(value)}
                            options={[{ value: 'neo4j', label: 'Neo4j' }]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={['framework_config', 'neo4j_uri']}
                          label={t('graphitiTab.connectUri')}
                          rules={[{ required: true, message: t('graphitiTab.connectUriRequired') }]}
                          tooltip={t('graphitiTab.connectUriTip')}
                        >
                          <Input placeholder="bolt://neo4j:7687" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={['framework_config', 'database_name']}
                          label={t('graphitiTab.dbName')}
                          tooltip={t('graphitiTab.dbNameTip')}
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
                            label={t('graphitiTab.username')}
                            rules={[{ required: true, message: t('graphitiTab.usernameRequired') }]}
                          >
                            <Input placeholder="neo4j" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name={['framework_config', 'neo4j_password']}
                            label={t('graphitiTab.password')}
                            rules={[{ required: true, message: t('graphitiTab.passwordRequired') }]}
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

            <Divider style={{ margin: '16px 0' }} />
            <Space wrap style={{ width: '100%', justifyContent: 'center' }}>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                {t('graphitiTab.saveConfig')}
              </Button>
              <Button
                type={status?.connected ? "default" : "primary"}
                icon={status?.connected ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => controlService(status?.connected ? 'stop' : 'start')}
                loading={loading}
              >
                {status?.connected ? t('graphitiTab.stopSvc') : t('graphitiTab.startSvc')}
              </Button>
              <Button icon={<SearchOutlined />} onClick={() => setGraphitiQueryModalVisible(true)}>
                {t('graphitiTab.testQuery')}
              </Button>
              <Button danger icon={<ClearOutlined />} onClick={handleClearData} loading={clearLoading}>
                {t('graphitiTab.clearData')}
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
