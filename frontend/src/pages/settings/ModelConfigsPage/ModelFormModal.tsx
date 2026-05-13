import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  InputNumber,
  Tooltip,
  Tag,
  Button,
  Skeleton,
  Typography,
  Space,
  Dropdown
} from 'antd';
import {
  InfoCircleOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;
const { Option, OptGroup } = Select;
const { TextArea } = Input;

// 常量定义 - 与ModelListView保持一致
// 使用翻译key，在渲染时通过t函数翻译
const getModelModalities = (t) => [
  { value: 'text_input', labelKey: 'modelConfig.modality.textInput', icon: '📄', color: 'blue', descKey: 'modelConfig.modality.textInput.desc' },
  { value: 'text_output', labelKey: 'modelConfig.modality.textOutput', icon: '📄', color: 'blue', descKey: 'modelConfig.modality.textOutput.desc' },
  { value: 'image_input', labelKey: 'modelConfig.modality.imageInput', icon: '🖼️', color: 'purple', descKey: 'modelConfig.modality.imageInput.desc' },
  { value: 'image_output', labelKey: 'modelConfig.modality.imageOutput', icon: '🖼️', color: 'purple', descKey: 'modelConfig.modality.imageOutput.desc' },
  { value: 'audio_input', labelKey: 'modelConfig.modality.audioInput', icon: '🎵', color: 'orange', descKey: 'modelConfig.modality.audioInput.desc' },
  { value: 'audio_output', labelKey: 'modelConfig.modality.audioOutput', icon: '🎵', color: 'orange', descKey: 'modelConfig.modality.audioOutput.desc' },
  { value: 'video_input', labelKey: 'modelConfig.modality.videoInput', icon: '🎬', color: 'red', descKey: 'modelConfig.modality.videoInput.desc' },
  { value: 'video_output', labelKey: 'modelConfig.modality.videoOutput', icon: '🎬', color: 'red', descKey: 'modelConfig.modality.videoOutput.desc' },
  { value: 'vector_output', labelKey: 'modelConfig.modality.vectorOutput', icon: '📊', color: 'green', descKey: 'modelConfig.modality.vectorOutput.desc' },
  { value: 'rerank_input', labelKey: 'modelConfig.modality.rerankInput', icon: '🔄', color: 'orange', descKey: 'modelConfig.modality.rerankInput.desc' },
  { value: 'rerank_output', labelKey: 'modelConfig.modality.rerankOutput', icon: '📊', color: 'orange', descKey: 'modelConfig.modality.rerankOutput.desc' },
];

const getModelCapabilities = (t) => [
  { value: 'function_calling', labelKey: 'modelConfig.capability.functionCalling', icon: '🔧', color: 'geekblue', descKey: 'modelConfig.capability.functionCalling.desc' },
  { value: 'reasoning', labelKey: 'modelConfig.capability.reasoning', icon: '🧠', color: 'gold', descKey: 'modelConfig.capability.reasoning.desc' },
];

const ModelFormModal = ({
  visible,
  onOk,
  onCancel,
  loading,
  form,
  editingModel,
  currentProvider,
  onProviderChange,
  apiKeyVisible,
  onApiKeyVisibilityToggle,
  providerModels,
  onTestConnection,
  onModelSelect
}) => {
  const { t } = useTranslation();
  
  const MODEL_MODALITIES = getModelModalities(t);
  const MODEL_CAPABILITIES = getModelCapabilities(t);
  
  // Watch modalities to determine if maxOutputTokens should be shown
  const modalities = Form.useWatch('modalities', form) || [];
  const hasTextOutput = modalities.includes('text_output') || modalities.includes('audio_output') || modalities.includes('video_output') || modalities.includes('image_output');
  const isEmbeddingOrRerank = modalities.includes('vector_output') || modalities.includes('rerank_output');
  const showMaxOutputTokens = hasTextOutput || !isEmbeddingOrRerank;
  
  return (
    <Modal
      title={editingModel ? t('modelConfig.editModel') : t('modelConfig.addModel')}
      open={visible}
      onOk={onOk}
      onCancel={onCancel}
      width={700}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <div style={{ marginBottom: '24px' }}>
          <Title level={5}>{t('modelConfig.form.basicInfo')}</Title>
        </div>
        
        {/* 提供商选择 */}
        <Row gutter={24}>
          <Col span={24}>
            <Form.Item
              name="provider"
              label={t('modelConfig.form.provider')}
              rules={[{ required: true, message: t('modelConfig.form.providerRequired') }]}
            >
              <Select onChange={onProviderChange} placeholder={t('modelConfig.form.selectProvider')}>
                <Option value="custom">{t('modelConfig.provider.custom')}</Option>
                <OptGroup label={t('modelConfig.form.publicCloudProviders')}>
                  <Option value="openai">{t('modelConfig.provider.openai')}</Option>
                  <Option value="anthropic">{t('modelConfig.provider.anthropic')}</Option>
                  <Option value="google">{t('modelConfig.provider.google')}</Option>
                  <Option value="azure">{t('modelConfig.provider.azure')}</Option>
                  <Option value="xai">{t('modelConfig.provider.xai')}</Option>
                  <Option value="deepseek">{t('modelConfig.provider.deepseek')}</Option>
                  <Option value="aliyun">{t('modelConfig.provider.aliyun')}</Option>
                  <Option value="volcengine">{t('modelConfig.provider.volcengine')}</Option>
                </OptGroup>
                <OptGroup label={t('modelConfig.form.privateDeployment')}>
                  <Option value="ollama">{t('modelConfig.provider.ollama')}</Option>
                  <Option value="gpustack">{t('modelConfig.provider.gpustack')}</Option>
                </OptGroup>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        {/* API基础URL */}
        <Row gutter={24}>
          <Col span={20}>
            <Form.Item
              name="baseUrl"
              label={t('modelConfig.form.baseUrl')}
              rules={[{ required: true, message: t('modelConfig.form.baseUrlRequired') }]}
              tooltip={t('modelConfig.form.baseUrlTooltip')}
            >
              <Input placeholder={t('modelConfig.form.baseUrlPlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label=" ">
              <Button
                type="default"
                icon={<ApiOutlined />}
                onClick={onTestConnection}
                loading={providerModels.testConnectionLoading}
                style={{ width: '100%', height: '32px' }}
              >
                {t('modelConfig.form.fetchModels')}
              </Button>
            </Form.Item>
          </Col>
        </Row>
        
        {/* Ollama模型选择 */}
        {currentProvider === 'ollama' && (
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label={
                  <span>
                    {t('modelConfig.selectOllamaModel')}
                    <Tooltip title={t('modelConfig.ollama.fetchModelsHint')}>
                      <InfoCircleOutlined style={{ marginLeft: 8 }} />
                    </Tooltip>
                  </span>
                }
              >
                <Select
                  placeholder={t('modelConfig.selectModelPlaceholder')}
                  loading={providerModels.ollamaModelsLoading}
                  onChange={(value) => onModelSelect('ollama', value)}
                  disabled={providerModels.ollamaModels.length === 0 && !providerModels.ollamaModelsLoading}
                  notFoundContent={providerModels.ollamaModelsLoading ? <Skeleton.Button active /> : t('modelConfig.noModelsAvailable')}
                  optionLabelProp="label"
                >
                  {providerModels.ollamaModels.map(model => (
                    <Option key={model.name} value={model.name} label={model.name}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          {model.name}
                          {model.remote_model && <Tag color="blue" style={{ marginLeft: 8, fontSize: '10px' }}>云端</Tag>}
                        </div>
                        {model.details && (
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            {model.details.parameter_size && `参数: ${model.details.parameter_size}`}
                            {model.details.quantization_level && ` | 量化: ${model.details.quantization_level}`}
                            {model.details.family && ` | 系列: ${model.details.family}`}
                            {model.size > 1000 && ` | 大小: ${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB`}
                          </div>
                        )}
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}
        
        {/* GPUStack模型选择 */}
        {currentProvider === 'gpustack' && (
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label={
                  <span>
                    {t('modelConfig.selectGpustackModel')}
                    <Tooltip title={t('modelConfig.fetchModelsHint')}>
                      <InfoCircleOutlined style={{ marginLeft: 8 }} />
                    </Tooltip>
                  </span>
                }
              >
                <Select
                  placeholder={t('modelConfig.pleaseTestConnectionToFetchModels')}
                  loading={providerModels.gpustackModelsLoading}
                  onChange={(value) => onModelSelect('gpustack', value)}
                  disabled={providerModels.gpustackModels.length === 0 && !providerModels.gpustackModelsLoading}
                  notFoundContent={providerModels.gpustackModelsLoading ? <Skeleton.Button active /> : t('modelConfig.pleaseTestConnection')}
                  optionLabelProp="label"
                >
                  {providerModels.gpustackModels.map(model => (
                    <Option key={model.id} value={model.name} label={model.name} data-model={JSON.stringify(model)}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          {model.name}
                          {model.categories && model.categories.length > 0 && (
                            <Tag color="blue" style={{ marginLeft: 8, fontSize: '10px' }}>
                              {model.categories[0]}
                            </Tag>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                          {model.meta?.n_params && `参数: ${(model.meta.n_params / 1e9).toFixed(1)}B`}
                          {model.meta?.n_ctx && ` | 上下文: ${(model.meta.n_ctx / 1024).toFixed(0)}K`}
                          {model.meta?.size && ` | 大小: ${(model.meta.size / 1024 / 1024).toFixed(0)}MB`}
                          {model.replicas !== undefined && ` | 副本: ${model.ready_replicas || 0}/${model.replicas}`}
                          {model.backend && ` | 后端: ${model.backend}`}
                        </div>
                        {(model.meta?.support_vision || model.meta?.support_tool_calls || model.meta?.support_reasoning) && (
                          <div style={{ fontSize: '11px', marginTop: '2px' }}>
                            {model.meta.support_vision && <Tag color="purple" style={{ fontSize: '10px' }}>👁️视觉</Tag>}
                            {model.meta.support_tool_calls && <Tag color="geekblue" style={{ fontSize: '10px' }}>🔧工具</Tag>}
                            {model.meta.support_reasoning && <Tag color="gold" style={{ fontSize: '10px' }}>🧠推理</Tag>}
                          </div>
                        )}
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}
        
        {/* Anthropic模型选择 */}
        {currentProvider === 'anthropic' && (
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label={
                  <span>
                    {t('modelConfig.selectAnthropicModel')}
                    <Tooltip title={t('modelConfig.fetchModelsHint')}>
                      <InfoCircleOutlined style={{ marginLeft: 8 }} />
                    </Tooltip>
                  </span>
                }
              >
                <Select
                  placeholder={t('modelConfig.pleaseTestConnectionToFetchModels')}
                  loading={providerModels.anthropicModelsLoading}
                  onChange={(value) => onModelSelect('anthropic', value)}
                  disabled={providerModels.anthropicModels.length === 0 && !providerModels.anthropicModelsLoading}
                  notFoundContent={providerModels.anthropicModelsLoading ? <Skeleton.Button active /> : t('modelConfig.pleaseTestConnection')}
                  optionLabelProp="label"
                >
                  {providerModels.anthropicModels.map(model => (
                    <Option key={model.id} value={model.id} label={model.id}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{model.id}</div>
                        {model.display_name && model.display_name !== model.id && (
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            显示名称: {model.display_name}
                          </div>
                        )}
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}
        
        {/* Google模型选择 */}
        {currentProvider === 'google' && (
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label={
                  <span>
                    {t('modelConfig.selectGoogleModel')}
                    <Tooltip title={t('modelConfig.fetchModelsHint')}>
                      <InfoCircleOutlined style={{ marginLeft: 8 }} />
                    </Tooltip>
                  </span>
                }
              >
                <Select
                  placeholder={t('modelConfig.pleaseTestConnectionToFetchModels')}
                  loading={providerModels.googleModelsLoading}
                  onChange={(value) => onModelSelect('google', value)}
                  disabled={providerModels.googleModels.length === 0 && !providerModels.googleModelsLoading}
                  notFoundContent={providerModels.googleModelsLoading ? <Skeleton.Button active /> : t('modelConfig.pleaseTestConnection')}
                  optionLabelProp="label"
                >
                  {providerModels.googleModels.map(model => (
                    <Option key={model.name} value={model.name} label={model.displayName || model.baseModelId || model.name}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{model.displayName || model.baseModelId || model.name}</div>
                        {model.description && (
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            {model.description}
                          </div>
                        )}
                        {model.inputTokenLimit && (
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            输入限制: {model.inputTokenLimit.toLocaleString()} tokens
                            {model.outputTokenLimit && ` | 输出限制: ${model.outputTokenLimit.toLocaleString()} tokens`}
                          </div>
                        )}
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}
        
        {/* X.ai模型选择 */}
        {currentProvider === 'xai' && (
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label={
                  <span>
                    {t('modelConfig.selectXaiModel')}
                    <Tooltip title={t('modelConfig.fetchModelsHint')}>
                      <InfoCircleOutlined style={{ marginLeft: 8 }} />
                    </Tooltip>
                  </span>
                }
              >
                <Select
                  placeholder={t('modelConfig.pleaseTestConnectionToFetchModels')}
                  loading={providerModels.xaiModelsLoading}
                  onChange={(value) => onModelSelect('xai', value)}
                  disabled={providerModels.xaiModels.length === 0 && !providerModels.xaiModelsLoading}
                  notFoundContent={providerModels.xaiModelsLoading ? <Skeleton.Button active /> : t('modelConfig.pleaseTestConnection')}
                  optionLabelProp="label"
                >
                  {providerModels.xaiModels.map(model => (
                    <Option key={model.id} value={model.id} label={model.id}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{model.id}</div>
                        {model.object && (
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            类型: {model.object}
                          </div>
                        )}
                        {model.owned_by && (
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            提供商: {model.owned_by}
                          </div>
                        )}
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}
        
        {/* 模型名称和ID */}
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="name"
              label={t('modelConfig.form.name')}
              rules={[{ required: true, message: t('modelConfig.form.nameRequired') }]}
            >
              <Input placeholder={t('modelConfig.form.namePlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="model_id"
              label={t('modelConfig.form.modelId')}
              rules={[{ required: true, message: t('modelConfig.form.modelIdRequired') }]}
              tooltip={t('modelConfig.form.modelIdTooltip')}
            >
              <Input placeholder={t('modelConfig.form.modelIdPlaceholder')} />
            </Form.Item>
          </Col>
        </Row>
        
        {/* API密钥 */}
        {currentProvider !== 'ollama' && (
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                name="apiKey"
                label={
                  <span>
                    {t('modelConfig.form.apiKey')}
                    <Tooltip title={
                      editingModel
                        ? t('modelConfig.form.apiKeyTooltipEdit')
                        : currentProvider === 'custom'
                          ? t('modelConfig.form.apiKeyTooltipCustom')
                          : t('modelConfig.form.apiKeyTooltipDefault')
                    }>
                      <InfoCircleOutlined style={{ marginLeft: 8 }} />
                    </Tooltip>
                  </span>
                }
                rules={[
                  {
                    required: !editingModel && currentProvider !== 'custom',
                    message: t('modelConfig.form.apiKeyRequired')
                  }
                ]}
              >
                <Input.Password
                  placeholder={
                    editingModel
                      ? t('modelConfig.form.apiKeyPlaceholderEdit')
                      : currentProvider === 'custom'
                        ? t('modelConfig.form.apiKeyPlaceholderCustom')
                        : t('modelConfig.form.apiKeyPlaceholderDefault')
                  }
                  visibilityToggle={{
                    visible: apiKeyVisible,
                    onVisibleChange: onApiKeyVisibilityToggle
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        )}
        
        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
          <Title level={5}>{t('modelConfig.form.modelParameters')}</Title>
        </div>
        
        {/* 模型参数 */}
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="contextWindow"
              label={t('modelConfig.form.contextWindow')}
              rules={[{ required: true, message: t('modelConfig.form.contextWindowRequired') }]}
              tooltip={t('modelConfig.form.contextWindowTooltip')}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder={t('modelConfig.form.contextWindowPlaceholder')} />
            </Form.Item>
            <div style={{ marginTop: '-16px', marginBottom: '8px' }}>
              <Dropdown
                menu={{
                  items: [
                    { key: '4k', label: '4K (4096)', onClick: () => form.setFieldValue('contextWindow', 4096) },
                    { key: '8k', label: '8K (8192)', onClick: () => form.setFieldValue('contextWindow', 8192) },
                    { key: '16k', label: '16K (16384)', onClick: () => form.setFieldValue('contextWindow', 16384) },
                    { key: '32k', label: '32K (32768)', onClick: () => form.setFieldValue('contextWindow', 32768) },
                    { key: '64k', label: '64K (65536)', onClick: () => form.setFieldValue('contextWindow', 65536) },
                    { key: '128k', label: '128K (131072)', onClick: () => form.setFieldValue('contextWindow', 131072) },
                    { key: '1m', label: '1M (1048576)', onClick: () => form.setFieldValue('contextWindow', 1048576) }
                  ]
                }}
              >
                <Button type="link" style={{ padding: 0, height: 'auto', fontSize: '12px' }}>
                  {t('modelConfig.form.quickSelect')}
                </Button>
              </Dropdown>
            </div>
          </Col>
          {showMaxOutputTokens && (
            <Col span={8}>
              <Form.Item
                name="maxOutputTokens"
                label={t('modelConfig.form.maxOutputTokens')}
                rules={[{ required: showMaxOutputTokens, message: t('modelConfig.form.maxOutputTokensRequired') }]}
                tooltip={t('modelConfig.form.maxOutputTokensTooltip')}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
          <Col span={8}>
            <Form.Item
              name="requestTimeout"
              label={t('modelConfig.form.requestTimeout')}
              rules={[{ required: true, message: t('modelConfig.form.requestTimeoutRequired') }]}
              tooltip={t('modelConfig.form.requestTimeoutTooltip')}
            >
              <InputNumber min={10} max={300} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        
        {/* 模型模态和特性 */}
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="modalities"
              label={t('modelConfig.form.modalities')}
              rules={[{ required: true, message: t('modelConfig.form.modalitiesRequired') }]}
              tooltip={t('modelConfig.form.modalitiesTooltip')}
            >
              <Select
                mode="multiple"
                placeholder={t('modelConfig.form.modalitiesPlaceholder')}
                style={{ width: '100%' }}
                maxTagCount="responsive"
                allowClear
                showSearch={false}
                options={MODEL_MODALITIES.map(mod => ({
                  label: (
                    <span>
                      <Tag color={mod.color}>
                        <span style={{ marginRight: 4 }}>{mod.icon}</span>
                        {t(mod.labelKey)}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>{t(mod.descKey)}</span>
                    </span>
                  ),
                  value: mod.value
                }))}
                tagRender={(props) => {
                  const { value, closable, onClose } = props;
                  const modality = MODEL_MODALITIES.find(mod => mod.value === value);
                  return (
                    <Tag
                      color={modality?.color || 'default'}
                      closable={closable}
                      onClose={onClose}
                      style={{ marginRight: 3, marginBottom: 3 }}
                    >
                      <span style={{ marginRight: 2 }}>{modality?.icon}</span>
                      {modality ? t(modality.labelKey) : value}
                    </Tag>
                  );
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="capabilities"
              label={t('modelConfig.form.capabilities')}
              rules={[]}
              tooltip={t('modelConfig.form.capabilitiesTooltip')}
            >
              <Select
                mode="multiple"
                placeholder={t('modelConfig.form.capabilitiesPlaceholder')}
                style={{ width: '100%' }}
                maxTagCount="responsive"
                allowClear
                showSearch={false}
                options={MODEL_CAPABILITIES.map(cap => ({
                  label: (
                    <span>
                      <Tag color={cap.color}>
                        <span style={{ marginRight: 4 }}>{cap.icon}</span>
                        {t(cap.labelKey)}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>{t(cap.descKey)}</span>
                    </span>
                  ),
                  value: cap.value
                }))}
                tagRender={(props) => {
                  const { value, closable, onClose } = props;
                  const capability = MODEL_CAPABILITIES.find(cap => cap.value === value);
                  return (
                    <Tag
                      color={capability?.color || 'default'}
                      closable={closable}
                      onClose={onClose}
                      style={{ marginRight: 3, marginBottom: 3 }}
                    >
                      <span style={{ marginRight: 2 }}>{capability?.icon}</span>
                      {capability ? t(capability.labelKey) : value}
                    </Tag>
                  );
                }}
              />
            </Form.Item>
          </Col>
        </Row>
        
        {/* 格式兼容性 */}
        <Row gutter={24}>
          <Col span={24}>
            <Form.Item
              name="formatCompatibility"
              label={t('modelConfig.form.formatCompatibility')}
              tooltip={t('modelConfig.form.formatCompatibilityTooltip')}
              initialValue="openai"
            >
              <Select>
                <Option value="openai">
                  <Tag color="blue">OpenAI</Tag>
                  {t('modelConfig.formatCompatibility.openai')}
                </Option>
                <Option value="anthropic">
                  <Tag color="purple">Anthropic</Tag>
                  {t('modelConfig.formatCompatibility.anthropic')}
                </Option>
                <Option value="custom">
                  <Tag color="orange">Custom</Tag>
                  {t('modelConfig.formatCompatibility.custom')}
                </Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        {/* 附加参数 */}
        <Row gutter={24}>
          <Col span={24}>
            <Form.Item
              name="additionalParams"
              label={t('modelConfig.form.additionalParams')}
              tooltip={t('modelConfig.form.additionalParamsTooltip')}
            >
              <TextArea
                rows={4}
                placeholder={t('modelConfig.form.additionalParamsPlaceholder')}
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default React.memo(ModelFormModal);
