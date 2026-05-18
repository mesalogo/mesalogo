import React, { useState, useEffect } from 'react';
import {
  Card, Form, Radio, InputNumber, Input, Button, Space,
  Alert, App, Tooltip, Tag, Divider, Typography, Select, Row, Col
} from 'antd';
import {
  ThunderboltOutlined, FireOutlined, RocketOutlined,
  CodeOutlined, SaveOutlined, ReloadOutlined, QuestionCircleOutlined,
  CloudOutlined, InfoCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../../services/api/knowledge';
import { modelConfigAPI } from '../../../services/api/model';

const { Text } = Typography;
const { Option } = Select;
const { getChunkConfig, updateChunkConfig, getDefaultConfigs } = knowledgeAPI;

const ChunkSettings = ({ knowledgeId }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [allMethods, setAllMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('recursive');
  const [textModels, setTextModels] = useState([]);
  const [defaultTextModel, setDefaultTextModel] = useState(null);
  const [defaultTextModelInfo, setDefaultTextModelInfo] = useState(null);

  // watch form value
  const chunkingStrategy = Form.useWatch('chunking_strategy', form) || 'semantic';

  useEffect(() => {
    if (knowledgeId) {
      loadData();
    }
  }, [knowledgeId]);

  useEffect(() => {
    if (selectedMethod === 'slumber' && textModels.length === 0) {
      loadModelConfigs();
    }
  }, [selectedMethod]);

  const loadModelConfigs = async () => {
    try {
      const [configs, defaults] = await Promise.all([
        modelConfigAPI.getAll(),
        modelConfigAPI.getDefaults()
      ]);

      const textModelList = configs.filter(model =>
        model.modalities && model.modalities.includes('text_output')
      );
      setTextModels(textModelList);

      if (defaults?.text_model) {
        setDefaultTextModel(defaults.text_model.id);
        setDefaultTextModelInfo(defaults.text_model);
      } else {
        const defaultText = configs.find(model => model.is_default_text);
        setDefaultTextModel(defaultText?.id || null);
        setDefaultTextModelInfo(defaultText || null);
      }
    } catch (error) {
      console.error('load model configs failed:', error);
    }
  };

  const loadData = async () => {
    if (!knowledgeId) {
      message.warning(t('chunkSettings.selectKbFirst'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [configRes, defaultsRes] = await Promise.all([
        getChunkConfig(knowledgeId),
        getDefaultConfigs()
      ]);

      const config = configRes.data;
      setCurrentConfig(config);
      setSelectedMethod(config.method);
      setAllMethods(defaultsRes.data.methods);

      form.setFieldsValue({
        method: config.method,
        ...config.config
      });
    } catch (error) {
      message.error(t('chunkSettings.loadFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = (method) => {
    setSelectedMethod(method);
    const methodInfo = allMethods.find(m => m.name === method);
    if (methodInfo) {
      const config = { ...methodInfo.default_config };

      if (method === 'slumber' && !config.model_id && defaultTextModel) {
        config.model_id = defaultTextModel;
      }

      form.setFieldsValue({
        method,
        ...config
      });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const { method, ...config } = values;

      setSaving(true);
      await updateChunkConfig(knowledgeId, {
        method,
        config
      });

      message.success(t('chunkSettings.saveSuccess'));
      loadData();
    } catch (error) {
      if (error.errorFields) {
        message.error(t('chunkSettings.checkForm'));
      } else {
        message.error(t('chunkSettings.saveFailed') + ': ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const methodInfo = allMethods.find(m => m.name === selectedMethod);
    if (methodInfo) {
      form.setFieldsValue({
        method: selectedMethod,
        ...methodInfo.default_config
      });
      message.info(t('chunkSettings.resetDone'));
    }
  };

  const getPerformanceText = (performance) => {
    const map = {
      'fastest': `⚡⚡⚡ ${t('chunkSettings.perf.fastest')}`,
      'fast': `⚡⚡ ${t('chunkSettings.perf.fast')}`,
      'slow': `⚡ ${t('chunkSettings.perf.slow')}`
    };
    return map[performance] || performance;
  };

  const getPriorityTag = (priority) => {
    const map = {
      'highest': { color: 'red', text: t('chunkSettings.priority.highest') },
      'high': { color: 'orange', text: t('chunkSettings.priority.high') },
      'medium': { color: 'blue', text: t('chunkSettings.priority.medium') },
      'low': { color: 'default', text: t('chunkSettings.priority.low') }
    };
    return map[priority];
  };

  const renderMethodSelector = () => {
    return (
      <Form.Item name="method" label={t('chunkSettings.methodLabel')}>
        <Radio.Group onChange={(e) => handleMethodChange(e.target.value)} size="large">
          <Row gutter={[16, 16]}>
            {allMethods.map(method => {
              const priorityInfo = method.priority ? getPriorityTag(method.priority) : null;

              return (
                <Col xs={24} sm={12} lg={8} key={method.name}>
                  <Radio
                    value={method.name}
                    disabled={!method.enabled}
                    style={{
                      padding: '12px',
                      border: '1px solid var(--custom-border)',
                      borderRadius: '6px',
                      width: '100%',
                      height: '100%',
                      background: method.name === selectedMethod ? 'var(--tree-selected-bg)' : 'var(--custom-card-bg)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      opacity: method.enabled ? 1 : 0.6
                    }}
                  >
                    <Space orientation="vertical" size={0} style={{ width: '100%' }}>
                      <Space wrap>
                        <strong>{method.display_name}</strong>
                        {method.name === 'recursive' && <Tag color="blue">{t('chunkSettings.tag.recommended')}</Tag>}
                        {method.name === 'late' && method.enabled && <Tag color="red">{t('chunkSettings.tag.ragOptimized')}</Tag>}
                        {method.name === 'table' && method.enabled && <Tag color="orange">{t('chunkSettings.tag.tableOnly')}</Tag>}
                        {method.cost === 'high' && <Tag color="red">{t('chunkSettings.tag.highCost')}</Tag>}
                        {!method.enabled && <Tag>{t('chunkSettings.tag.comingSoon')}</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                        {method.description}
                      </Text>
                      <Space style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {t('chunkSettings.perfLabel')}: {getPerformanceText(method.performance)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          | {t('chunkSettings.modelLabel')}: {method.requires_model ? t('chunkSettings.modelRequired') : t('chunkSettings.modelNotRequired')}
                        </Text>
                      </Space>
                      {method.model_info && (
                        <Text type="secondary" style={{ fontSize: '11px', marginTop: '8px', display: 'flex', alignItems: 'flex-start' }}>
                          <InfoCircleOutlined style={{ marginRight: 4, marginTop: 2, color: '#1677ff' }} />
                          {method.model_info}
                        </Text>
                      )}
                    </Space>
                  </Radio>
                </Col>
              );
            })}
          </Row>
        </Radio.Group>
      </Form.Item>
    );
  };

  const renderConfigForm = () => {
    const methodInfo = allMethods.find(m => m.name === selectedMethod);
    if (!methodInfo) return null;

    return (
      <>
        {/* Recursive */}
        {selectedMethod === 'recursive' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunking_strategy"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.splitStrategy')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.splitStrategy')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <Select
                  style={{ width: '100%' }}
                  optionLabelProp="label"
                >
                  <Option value="semantic" label={t('chunkSettings.strategy.semanticLabel')}>
                    <Space orientation="vertical" size={0}>
                      <span>{t('chunkSettings.strategy.semanticLabel')}</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>{t('chunkSettings.strategy.semanticDesc')}</Text>
                    </Space>
                  </Option>
                  <Option value="markdown" label={t('chunkSettings.strategy.markdownLabel')}>
                    <Space orientation="vertical" size={0}>
                      <span>{t('chunkSettings.strategy.markdownLabel')}</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>{t('chunkSettings.strategy.markdownDesc')}</Text>
                    </Space>
                  </Option>
                  <Option value="custom" label={t('chunkSettings.strategy.customLabel')}>
                    <Space orientation="vertical" size={0}>
                      <span>{t('chunkSettings.strategy.customLabel')}</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>{t('chunkSettings.strategy.customDesc')}</Text>
                    </Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.chunkSize')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.chunkSize')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.chunkSizeRange')}
              >
                <InputNumber
                  min={100}
                  max={2048}
                  style={{ width: '100%' }}
                  placeholder={t('chunkSettings.placeholder.chunkSize')}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="min_characters_per_chunk"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.minChars')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.minChars')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.minCharsRange')}
              >
                <InputNumber
                  min={5}
                  max={200}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {chunkingStrategy === 'custom' && (
              <>
                <Col xs={24} sm={16}>
                  <Form.Item
                    name="custom_delimiters"
                    label={t('chunkSettings.field.customDelim')}
                    tooltip={t('chunkSettings.tooltip.customDelim')}
                    extra={t('chunkSettings.extra.customDelimExample')}
                  >
                    <Input.TextArea
                      rows={5}
                      placeholder={"## \n\n\n. \n! \n? "}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name="include_delim"
                    label={
                      <Space>
                        <span>{t('chunkSettings.field.includeDelim')}</span>
                        <Tooltip title={t('chunkSettings.tooltip.includeDelim')}>
                          <QuestionCircleOutlined />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Select style={{ width: '100%' }}>
                      <Option value="prev">{t('chunkSettings.delim.prev')}</Option>
                      <Option value="next">{t('chunkSettings.delim.next')}</Option>
                      <Option value={null}>{t('chunkSettings.delim.none')}</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        )}

        {/* Token */}
        {selectedMethod === 'token' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.chunkSize')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.chunkSize')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.chunkSizeRange')}
              >
                <InputNumber
                  min={100}
                  max={2048}
                  style={{ width: '100%' }}
                  placeholder={t('chunkSettings.placeholder.chunkSize')}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_overlap"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.overlap')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.overlap')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.overlapRange')}
              >
                <InputNumber
                  min={0}
                  max={512}
                  style={{ width: '100%' }}
                  placeholder={t('chunkSettings.placeholder.overlap')}
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Semantic */}
        {selectedMethod === 'semantic' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="embedding_model"
                label={t('chunkSettings.field.embeddingModel')}
              >
                <Select style={{ width: '100%' }}>
                  <Option value="all-MiniLM-L6-v2">{t('chunkSettings.embedding.miniLM6Recommended')}</Option>
                  <Option value="paraphrase-MiniLM-L6-v2">paraphrase-MiniLM-L6-v2</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="similarity_threshold"
                label={t('chunkSettings.field.simThreshold')}
                extra={t('chunkSettings.extra.simThreshold')}
              >
                <InputNumber
                  min={0}
                  max={1}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder={t('chunkSettings.placeholder.simThreshold')}
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Sentence */}
        {selectedMethod === 'sentence' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.chunkSize')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.chunkSize')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.chunkSizeRange')}
              >
                <InputNumber
                  min={100}
                  max={2048}
                  style={{ width: '100%' }}
                  placeholder={t('chunkSettings.placeholder.chunkSize')}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_overlap"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.overlap')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.overlap')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.overlapRange')}
              >
                <InputNumber
                  min={0}
                  max={512}
                  style={{ width: '100%' }}
                  placeholder={t('chunkSettings.placeholder.overlap')}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="min_sentences_per_chunk"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.minSentences')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.minSentences')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Token tokenizer */}
        {selectedMethod === 'token' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="tokenizer"
                label="Tokenizer"
              >
                <Select style={{ width: '100%' }}>
                  <Option value="gpt2">{t('chunkSettings.tokenizer.gpt2Recommended')}</Option>
                  <Option value="bert">BERT</Option>
                  <Option value="roberta">RoBERTa</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Code */}
        {selectedMethod === 'code' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="language"
                label={t('chunkSettings.field.programmingLang')}
              >
                <Select style={{ width: '100%' }}>
                  <Option value="auto">{t('chunkSettings.lang.auto')}</Option>
                  <Option value="python">Python</Option>
                  <Option value="javascript">JavaScript</Option>
                  <Option value="java">Java</Option>
                  <Option value="cpp">C++</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.chunkSize')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.codeChunkSize')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={100} max={2048} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Late */}
        {selectedMethod === 'late' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="embedding_model"
                label={t('chunkSettings.field.embeddingModel')}
              >
                <Select style={{ width: '100%' }}>
                  <Option value="all-MiniLM-L6-v2">{t('chunkSettings.embedding.miniLM6Recommended')}</Option>
                  <Option value="paraphrase-MiniLM-L6-v2">paraphrase-MiniLM-L6-v2</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.chunkSize')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.chunkSize')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.chunkSizeRange')}
              >
                <InputNumber min={100} max={2048} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Table */}
        {selectedMethod === 'table' && (
          <>
            <Alert
              message={t('chunkSettings.table.alertTitle')}
              description={t('chunkSettings.table.alertDesc')}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="tokenizer"
                  label={
                    <Space>
                      <span>Tokenizer</span>
                      <Tooltip title={t('chunkSettings.tooltip.tokenizer')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                >
                  <Select style={{ width: '100%' }}>
                    <Option value="character">{t('chunkSettings.tokenizer.character')}</Option>
                    <Option value="gpt2">GPT-2</Option>
                    <Option value="o200k_base">GPT-4</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="chunk_size"
                  label={
                    <Space>
                      <span>{t('chunkSettings.field.chunkSize')}</span>
                      <Tooltip title={t('chunkSettings.tooltip.tableChunkSize')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  extra={t('chunkSettings.extra.tableChunkSizeRange')}
                >
                  <InputNumber min={100} max={8192} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {/* Neural */}
        {selectedMethod === 'neural' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="model"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.neuralModel')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.neuralModel')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <Select style={{ width: '100%' }}>
                  <Option value="mirth/chonky_distilbert_base_uncased_1">{t('chunkSettings.neural.distilBertRecommended')}</Option>
                  <Option value="mirth/chonky_modernbert_base_1">ModernBERT Base</Option>
                  <Option value="mirth/chonky_modernbert_large_1">ModernBERT Large</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="min_characters_per_chunk"
                label={
                  <Space>
                    <span>{t('chunkSettings.field.minChars')}</span>
                    <Tooltip title={t('chunkSettings.tooltip.minChars')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra={t('chunkSettings.extra.minCharsRange')}
              >
                <InputNumber min={5} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Slumber */}
        {selectedMethod === 'slumber' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="warning" style={{ display: 'flex', alignItems: 'center' }}>
                <WarningOutlined style={{ marginRight: 8 }} />
                {t('chunkSettings.slumber.warn')}
              </Text>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="model_id"
                  label={
                    <Space>
                      <CloudOutlined style={{ color: '#1677ff' }} />
                      <span>{t('chunkSettings.field.textModel')}</span>
                    </Space>
                  }
                  tooltip={t('chunkSettings.tooltip.textModel')}
                  rules={[{ required: true, message: t('chunkSettings.required.textModel') }]}
                >
                  <Select
                    placeholder={t('chunkSettings.placeholder.textModel')}
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.label?.toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%', borderRadius: '6px' }}
                    options={[
                      {
                        value: 'default',
                        label: `${t('chunkSettings.defaultTextModel')}${defaultTextModelInfo ? ` (${defaultTextModelInfo.name})` : ''}`,
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
                          })) : []
                      )
                    ]}
                    optionRender={(option) => {
                      if (option.data.isDefault) {
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 'bold' }}>{t('chunkSettings.defaultTextModel')}</span>
                              <Tag color="blue">{t('chunkSettings.default')}</Tag>
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
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="chunk_size"
                  label={
                    <Space>
                      <span>{t('chunkSettings.field.chunkSize')}</span>
                      <Tooltip title={t('chunkSettings.tooltip.chunkSize')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  extra={t('chunkSettings.extra.slumberChunkSizeRange')}
                >
                  <InputNumber min={512} max={8192} style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="candidate_size"
                  label={
                    <Space>
                      <span>{t('chunkSettings.field.candidateSize')}</span>
                      <Tooltip title={t('chunkSettings.tooltip.candidateSize')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  extra={t('chunkSettings.extra.candidateSizeRange')}
                >
                  <InputNumber min={32} max={512} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}
      </>
    );
  };

  const renderPreview = () => {
    if (selectedMethod !== 'token') {
      return null;
    }

    const chunkSize = form.getFieldValue('chunk_size') || 512;
    const overlap = form.getFieldValue('chunk_overlap') || 0;
    const effectiveSize = chunkSize - overlap;

    const estimateChunks = (textLength) => {
      return effectiveSize > 0 ? Math.max(1, Math.ceil(textLength / effectiveSize)) : 0;
    };

    return (
      <Alert
        message={t('chunkSettings.preview.title')}
        description={
          <Space orientation="vertical">
            <Text>📄 {t('chunkSettings.preview.line1k', { count: estimateChunks(1000) })}</Text>
            <Text>📚 {t('chunkSettings.preview.line10k', { count: estimateChunks(10000) })}</Text>
            {overlap > 0 && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('chunkSettings.preview.overlapNote', { overlap, effective: effectiveSize })}
              </Text>
            )}
          </Space>
        }
        type="info"
        showIcon
        style={{ marginTop: '16px' }}
      />
    );
  };

  if (!knowledgeId) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Space direction="vertical">
            <InfoCircleOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            <Text strong>{t('chunkSettings.selectKbFirst')}</Text>
            <Text type="secondary">{t('chunkSettings.selectKbHint')}</Text>
          </Space>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <span>{t('chunkSettings.cardTitle')}</span>
          <Tooltip title={t('chunkSettings.cardTooltip')}>
            <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 14 }} />
          </Tooltip>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            {t('chunkSettings.resetBtn')}
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {t('chunkSettings.saveBtn')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        {renderMethodSelector()}

        <Divider />

        {renderConfigForm()}

        {renderPreview()}
      </Form>
    </Card>
  );
};

export default ChunkSettings;
