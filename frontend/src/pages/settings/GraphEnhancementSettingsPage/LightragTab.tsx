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
  Select,
  Tooltip,
  Descriptions,
  Divider
} from 'antd';
import {
  SaveOutlined,
  InfoCircleOutlined,
  CloudOutlined,
  BarChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLightRAG } from './useLightRAG';

const { Text } = Typography;

const LightragTab = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [lightragForm] = Form.useForm();
  
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
    loadConfig,
    saveConfig,
    loadStatus,
    loadModelConfigs,
    controlService
  } = useLightRAG();
  
  const [lightragEnabled, setLightragEnabled] = useState(false);

  useEffect(() => {
    const loadLightragConfig = async () => {
      await loadModelConfigs();
      
      const configData = await loadConfig();
      if (configData && configData.framework === 'lightrag') {
        setLightragEnabled(configData.enabled || false);
        
        const formValues = {
          ...configData,
          framework: 'lightrag'
        };

        if (configData.enabled) {
          lightragForm.setFieldsValue(formValues);
        }
      }
    };

    loadLightragConfig();
    loadStatus();
  }, [loadConfig, loadStatus, loadModelConfigs, lightragForm]);

  const handleSaveLightragConfig = async (values) => {
    try {
      let processedValues = { ...values };

      try {
        const textModelId = values.framework_config?.text_model_id;
        if (textModelId && textModelId !== 'default') {
          const textModel = textModels.find(m => m.id.toString() === textModelId.toString());
          if (!textModel) {
            processedValues.framework_config.text_model_id = 'default';
          }
        } else {
          processedValues.framework_config.text_model_id = 'default';
        }

        const embeddingModelId = values.framework_config?.embedding_model_id;
        if (embeddingModelId && embeddingModelId !== 'default') {
          const embeddingModel = embeddingModels.find(m => m.id.toString() === embeddingModelId.toString());
          if (!embeddingModel) {
            processedValues.framework_config.embedding_model_id = 'default';
          }
        } else {
          processedValues.framework_config.embedding_model_id = 'default';
        }

        const rerankModelId = values.framework_config?.rerank_model_id;
        if (rerankModelId && rerankModelId !== 'default') {
          const rerankModel = rerankModels.find(m => m.id.toString() === rerankModelId.toString());
          if (!rerankModel) {
            processedValues.framework_config.rerank_model_id = 'default';
          }
        } else {
          processedValues.framework_config.rerank_model_id = 'default';
        }

        delete processedValues.framework_config.text_model;
        delete processedValues.framework_config.embedding_model;
        delete processedValues.framework_config.rerank_model;

      } catch (error) {
        message.error(t('lightrag.msg.modelProcessFailed', { msg: error.message }));
        return;
      }

      const configData = {
        ...processedValues,
        enabled: lightragEnabled,
        framework: 'lightrag'
      };

      const result = await saveConfig(configData);

      if (!result) {
        message.error(t('lightrag.msg.saveFailed'));
      } else {
        // backend syncs config to the LightRAG container automatically
        if (result.sync_result?.synced) {
          message.success(t('lightrag.msg.savedAndSynced'));
        } else if (result.sync_result) {
          message.warning(t('lightrag.msg.savedSyncFailed', { msg: result.sync_result.message }));
        } else {
          message.success(t('lightrag.msg.saved'));
        }
        loadStatus();
      }
    } catch (error) {
      message.error(t('lightrag.msg.saveFailedWith', { msg: error.message }));
    }
  };

  const handleControlService = async (action: 'start' | 'stop') => {
    await controlService(action);
  };

  const renderStatusTag = (status) => {
    const statusConfig = {
      healthy: { color: 'green', text: t('lightrag.status.healthy') },
      unhealthy: { color: 'orange', text: t('lightrag.status.unhealthy') },
      unreachable: { color: 'red', text: t('lightrag.status.unreachable') }
    };
    const cfg = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  return (
    <>
      {/* enable switch */}
      <Card title={t('lightrag.enableTitle')} style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Switch
              checked={lightragEnabled}
              checkedChildren={t('lightrag.switchOn')}
              unCheckedChildren={t('lightrag.switchOff')}
              loading={loading}
              onChange={async (checked) => {
                if (checked) {
                  setLightragEnabled(true);
                  message.info(t('lightrag.msg.completeConfigThenSave'));
                } else {
                  const success = await saveConfig({
                    ...config,
                    framework: 'lightrag',
                    enabled: false
                  });
                  if (success) {
                    setLightragEnabled(false);
                    message.success(t('lightrag.msg.disabled'));
                  } else {
                    setLightragEnabled(true);
                  }
                }
              }}
            />
          </Col>
          <Col flex={1}>
            <Text type="secondary">{t('lightrag.enableDesc')}</Text>
          </Col>
        </Row>
      </Card>

      {lightragEnabled && (
        <Form
          form={lightragForm}
          layout="vertical"
          onFinish={handleSaveLightragConfig}
          initialValues={{
            ...config,
            framework: 'lightrag',
            framework_config: {
              partition_strategy: 'by_knowledge',
              chunk_size: 1200,
              chunk_overlap: 100,
              summary_language: 'Chinese',
              top_k: 40,
              enable_rerank: true,
              ...config?.framework_config
            }
          }}
        >
          {/* main config card */}
          <Card
            title={
              <Space>
                <BarChartOutlined />
                {t('lightrag.section.statusAndConfig')}
                {status?.status === 'healthy' ? <Tag color="success">{t('lightrag.status.healthy')}</Tag> : <Tag color="default">{t('lightrag.status.notStarted')}</Tag>}
              </Space>
            }
            extra={
              <Button icon={<ReloadOutlined />} onClick={loadStatus} loading={loading}>
                {t('lightrag.refresh')}
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            {/* status */}
            {status && (
              <>
                <Descriptions column={4} size="small">
                  <Descriptions.Item label={t('lightrag.label.serviceStatus')}>{renderStatusTag(status.status)}</Descriptions.Item>
                  <Descriptions.Item label={t('lightrag.label.serviceUrl')}>{config?.framework_config?.service_url || 'http://localhost:9621'}</Descriptions.Item>
                  <Descriptions.Item label={t('lightrag.label.workspaceCount')}>{status.statistics?.workspace_count || 0}</Descriptions.Item>
                  <Descriptions.Item label={t('lightrag.label.documentCount')}>{status.statistics?.document_count || 0}</Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '16px 0' }} />
              </>
            )}

            {/* service config */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name={['framework_config', 'service_url']}
                  label={t('lightrag.field.serviceUrl')}
                  rules={[{ required: true, message: t('lightrag.req.serviceUrl') }]}
                  tooltip={t('lightrag.tip.serviceUrl')}
                >
                  <Input placeholder="http://localhost:9621" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('lightrag.field.serviceControl')} style={{ marginBottom: 0 }}>
                  <Button
                    type={status?.status === 'healthy' ? "default" : "primary"}
                    icon={status?.status === 'healthy' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => handleControlService(status?.status === 'healthy' ? 'stop' : 'start')}
                    loading={loading}
                  >
                    {status?.status === 'healthy' ? t('lightrag.stopService') : t('lightrag.startService')}
                  </Button>
                </Form.Item>
              </Col>
            </Row>

            {/* model config */}
            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <CloudOutlined />
                {t('lightrag.section.modelConfig')}
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'text_model_id']}
                  label={
                    <Space>
                      {t('lightrag.field.textModel')}
                      <Tooltip title={t('lightrag.tip.textModel')}>
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('lightrag.req.textModel') }]}
                >
                  <Select
                    placeholder={t('lightrag.ph.pickTextModel')}
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: t('lightrag.defaultLabel', { name: defaultTextModelInfo ? `(${defaultTextModelInfo.name})` : '' }) },
                      ...(textModels || []).filter(m => m.id !== defaultTextModel).map(model => ({
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
                      {t('lightrag.field.embeddingModel')}
                      <Tooltip title={t('lightrag.tip.embeddingModel')}>
                        <InfoCircleOutlined style={{ color: '#1677ff' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('lightrag.req.embeddingModel') }]}
                >
                  <Select
                    placeholder={t('lightrag.ph.pickEmbeddingModel')}
                    showSearch
                    filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                    options={[
                      { value: 'default', label: t('lightrag.defaultLabel', { name: defaultEmbeddingModelInfo ? `(${defaultEmbeddingModelInfo.name})` : '' }) },
                      ...(embeddingModels || []).filter(m => m.id !== defaultEmbeddingModel).map(model => ({
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
                  label={t('lightrag.field.embeddingDim')}
                  tooltip={t('lightrag.tip.embeddingDim')}
                >
                  <InputNumber min={128} max={4096} placeholder={t('lightrag.ph.embeddingDim')} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['framework_config', 'enable_rerank']}
                  label={t('lightrag.field.enableRerank')}
                  valuePropName="checked"
                  tooltip={t('lightrag.tip.enableRerank')}
                >
                  <Switch checkedChildren={t('lightrag.enabled')} unCheckedChildren={t('lightrag.disabled')} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues?.framework_config?.enable_rerank !== currentValues?.framework_config?.enable_rerank
                  }
                >
                  {({ getFieldValue }) => {
                    const enableRerank = getFieldValue(['framework_config', 'enable_rerank']);
                    return enableRerank ? (
                      <Form.Item
                        name={['framework_config', 'rerank_model_id']}
                        label={
                          <Space>
                            {t('lightrag.field.rerankModel')}
                            <Tooltip title={t('lightrag.tip.rerankModel')}>
                              <InfoCircleOutlined style={{ color: '#1677ff' }} />
                            </Tooltip>
                          </Space>
                        }
                      >
                        <Select
                          placeholder={t('lightrag.ph.pickRerankModel')}
                          showSearch
                          filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
                          options={[
                            { value: 'default', label: t('lightrag.defaultLabel', { name: defaultRerankModelInfo ? `(${defaultRerankModelInfo.name})` : '' }) },
                            ...(rerankModels || []).filter(m => m.id !== defaultRerankModel).map(model => ({
                              value: model.id.toString(),
                              label: `${model.name} (${model.provider})`,
                            }))
                          ]}
                        />
                      </Form.Item>
                    ) : null;
                  }}
                </Form.Item>
              </Col>
            </Row>

            {/* document processing */}
            <Divider orientationMargin={0} style={{ margin: '8px 0 16px' }}>
              <Space>
                <SettingOutlined />
                {t('lightrag.section.docConfig')}
              </Space>
            </Divider>

            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'chunk_size']}
                  label={t('lightrag.field.chunkSize')}
                  tooltip={t('lightrag.tip.chunkSize')}
                >
                  <InputNumber min={100} max={2000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'chunk_overlap']}
                  label={t('lightrag.field.chunkOverlap')}
                  tooltip={t('lightrag.tip.chunkOverlap')}
                >
                  <InputNumber min={0} max={500} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'summary_language']}
                  label={t('lightrag.field.summaryLanguage')}
                  tooltip={t('lightrag.tip.summaryLanguage')}
                >
                  <Select>
                    <Select.Option value="Chinese">{t('lightrag.lang.zh')}</Select.Option>
                    <Select.Option value="English">{t('lightrag.lang.en')}</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name={['framework_config', 'top_k']}
                  label="Top K"
                  tooltip={t('lightrag.tip.topK')}
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {/* bottom actions */}
            <Divider style={{ margin: '16px 0' }} />
            <Space wrap style={{ width: '100%', justifyContent: 'center' }}>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                {t('lightrag.saveConfig')}
              </Button>
              <Button
                type={status?.status === 'healthy' ? "default" : "primary"}
                icon={status?.status === 'healthy' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => handleControlService(status?.status === 'healthy' ? 'stop' : 'start')}
                loading={loading}
              >
                {status?.status === 'healthy' ? t('lightrag.stopService') : t('lightrag.startService')}
              </Button>
            </Space>
          </Card>
        </Form>
      )}
    </>
  );
};

export default LightragTab;
