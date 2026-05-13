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
import knowledgeAPI from '../../../services/api/knowledge';
import { modelConfigAPI } from '../../../services/api/model';

const { Text } = Typography;
const { Option } = Select;
const { getChunkConfig, updateChunkConfig, getDefaultConfigs } = knowledgeAPI;

const ChunkSettings = ({ knowledgeId }) => {
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

  // ✅ 优化：使用 Form.useWatch 监听表单值变化，无需额外 state
  const chunkingStrategy = Form.useWatch('chunking_strategy', form) || 'semantic';

  useEffect(() => {
    if (knowledgeId) {
      loadData();
    }
  }, [knowledgeId]);

  // ✅ 优化：只在选择 slumber 方法时才加载模型配置
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

      // 获取文本生成模型
      const textModelList = configs.filter(model =>
        model.modalities && model.modalities.includes('text_output')
      );
      setTextModels(textModelList);

      // 使用 getDefaults() 获取完整的默认文本生成模型信息
      if (defaults?.text_model) {
        setDefaultTextModel(defaults.text_model.id);
        setDefaultTextModelInfo(defaults.text_model);
      } else {
        // 备用方案：从配置列表中查找
        const defaultText = configs.find(model => model.is_default_text);
        setDefaultTextModel(defaultText?.id || null);
        setDefaultTextModelInfo(defaultText || null);
      }
    } catch (error) {
      console.error('加载模型配置失败:', error);
    }
  };

  const loadData = async () => {
    if (!knowledgeId) {
      message.warning('请先选择一个知识库');
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

      // ✅ 优化：统一在这里设置表单初始值，不需要每个 Form.Item 都设置 initialValue
      form.setFieldsValue({
        method: config.method,
        ...config.config
      });
    } catch (error) {
      message.error('加载配置失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = (method) => {
    setSelectedMethod(method);
    const methodInfo = allMethods.find(m => m.name === method);
    if (methodInfo) {
      // ✅ 优化：重置为该方法的默认配置（后端已提供完整配置）
      const config = { ...methodInfo.default_config };

      // 如果是 slumber 方法且没有设置 model_id，使用默认模型
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

      message.success('分段配置已保存');
      loadData(); // 重新加载
    } catch (error) {
      if (error.errorFields) {
        message.error('请检查表单输入');
      } else {
        message.error('保存失败: ' + error.message);
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
      message.info('已恢复默认配置');
    }
  };

  const getPerformanceText = (performance) => {
    const map = {
      'fastest': '⚡⚡⚡ 极快',
      'fast': '⚡⚡ 快',
      'slow': '⚡ 慢'
    };
    return map[performance] || performance;
  };

  const getPriorityTag = (priority) => {
    const map = {
      'highest': { color: 'red', text: '最高优先级' },
      'high': { color: 'orange', text: '高优先级' },
      'medium': { color: 'blue', text: '中优先级' },
      'low': { color: 'default', text: '低优先级' }
    };
    return map[priority];
  };

  const renderMethodSelector = () => {
    return (
      <Form.Item name="method" label="分段方法">
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
                        {/* 推荐标签 */}
                        {method.name === 'recursive' && <Tag color="blue">推荐</Tag>}
                        {method.name === 'late' && method.enabled && <Tag color="red">RAG优化</Tag>}
                        {method.name === 'table' && method.enabled && <Tag color="orange">表格专用</Tag>}
                        {/* 成本标签 */}
                        {method.cost === 'high' && <Tag color="red">高成本</Tag>}
                        {/* 未启用标签 */}
                        {!method.enabled && <Tag>即将推出</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                        {method.description}
                      </Text>
                      <Space style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          性能: {getPerformanceText(method.performance)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          | 模型: {method.requires_model ? '需要' : '无需'}
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
        {/* Recursive 特定参数 */}
        {selectedMethod === 'recursive' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunking_strategy"
                label={
                  <Space>
                    <span>分割策略</span>
                    <Tooltip title="选择文本分割的层级策略">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <Select
                  style={{ width: '100%' }}
                  optionLabelProp="label"
                >
                  <Option value="semantic" label="智能分割（推荐）">
                    <Space orientation="vertical" size={0}>
                      <span>智能分割（推荐）</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>段落+句子，适合90%的场景</Text>
                    </Space>
                  </Option>
                  <Option value="markdown" label="Markdown文档">
                    <Space orientation="vertical" size={0}>
                      <span>Markdown文档</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>标题+段落，适合技术文档</Text>
                    </Space>
                  </Option>
                  <Option value="custom" label="自定义分隔符">
                    <Space orientation="vertical" size={0}>
                      <span>自定义分隔符</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>完全自定义规则</Text>
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
                    <span>分块大小</span>
                    <Tooltip title="每个分块的目标大小（token数）">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="推荐: 256-1024"
              >
                <InputNumber
                  min={100}
                  max={2048}
                  style={{ width: '100%' }}
                  placeholder="请输入分块大小"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="min_characters_per_chunk"
                label={
                  <Space>
                    <span>最小字符数</span>
                    <Tooltip title="每个分块的最小字符数">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="推荐: 10-100"
              >
                <InputNumber
                  min={5}
                  max={200}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {/* 当选择"自定义"策略时显示 */}
            {chunkingStrategy === 'custom' && (
              <>
                <Col xs={24} sm={16}>
                  <Form.Item
                    name="custom_delimiters"
                    label="自定义分隔符"
                    tooltip="每行一个分隔符，优先级从上到下"
                    extra="示例：第一行 '## '，第二行 '\n\n'，第三行 '. '"
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
                        <span>分隔符处理</span>
                        <Tooltip title="分隔符如何处理">
                          <QuestionCircleOutlined />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Select style={{ width: '100%' }}>
                      <Option value="prev">包含在前一个块中</Option>
                      <Option value="next">包含在后一个块中</Option>
                      <Option value={null}>不包含分隔符</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        )}

        {/* Token 特定参数 */}
        {selectedMethod === 'token' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>分块大小</span>
                    <Tooltip title="每个分块的目标大小（token数）">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="推荐: 256-1024"
              >
                <InputNumber
                  min={100}
                  max={2048}
                  style={{ width: '100%' }}
                  placeholder="请输入分块大小"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_overlap"
                label={
                  <Space>
                    <span>重叠大小</span>
                    <Tooltip title="相邻分块的重叠部分，用于保持上下文连续性">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="约占分块大小的 10-20%"
              >
                <InputNumber
                  min={0}
                  max={512}
                  style={{ width: '100%' }}
                  placeholder="请输入重叠大小"
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Semantic 特定参数 */}
        {selectedMethod === 'semantic' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="embedding_model"
                label="Embedding 模型"
              >
                <Select style={{ width: '100%' }}>
                  <Option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (推荐)</Option>
                  <Option value="paraphrase-MiniLM-L6-v2">paraphrase-MiniLM-L6-v2</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="similarity_threshold"
                label="相似度阈值"
                extra="取值范围: 0-1，推荐: 0.5"
              >
                <InputNumber
                  min={0}
                  max={1}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="请输入相似度阈值"
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Sentence 特定参数 */}
        {selectedMethod === 'sentence' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>分块大小</span>
                    <Tooltip title="每个分块的目标大小（token数）">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="推荐: 256-1024"
              >
                <InputNumber
                  min={100}
                  max={2048}
                  style={{ width: '100%' }}
                  placeholder="请输入分块大小"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_overlap"
                label={
                  <Space>
                    <span>重叠大小</span>
                    <Tooltip title="相邻分块的重叠部分，用于保持上下文连续性">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="约占分块大小的 10-20%"
              >
                <InputNumber
                  min={0}
                  max={512}
                  style={{ width: '100%' }}
                  placeholder="请输入重叠大小"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="min_sentences_per_chunk"
                label={
                  <Space>
                    <span>每块最少句子数</span>
                    <Tooltip title="确保每个分块至少包含指定数量的句子">
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

        {/* Token 特定参数 */}
        {selectedMethod === 'token' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="tokenizer"
                label="Tokenizer"
              >
                <Select style={{ width: '100%' }}>
                  <Option value="gpt2">GPT-2 (推荐)</Option>
                  <Option value="bert">BERT</Option>
                  <Option value="roberta">RoBERTa</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Code 特定参数 */}
        {selectedMethod === 'code' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="language"
                label="编程语言"
              >
                <Select style={{ width: '100%' }}>
                  <Option value="auto">自动检测</Option>
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
                    <span>分块大小</span>
                    <Tooltip title="每个代码块的目标大小">
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

        {/* Late Chunking 特定参数 */}
        {selectedMethod === 'late' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="embedding_model"
                label="Embedding 模型"
              >
                <Select style={{ width: '100%' }}>
                  <Option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (推荐)</Option>
                  <Option value="paraphrase-MiniLM-L6-v2">paraphrase-MiniLM-L6-v2</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="chunk_size"
                label={
                  <Space>
                    <span>分块大小</span>
                    <Tooltip title="每个分块的目标大小（token数）">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="推荐: 256-1024"
              >
                <InputNumber min={100} max={2048} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Table Chunking 特定参数 */}
        {selectedMethod === 'table' && (
          <>
            <Alert
              message="⚠️ 重要提示"
              description="TableChunker 仅适用于包含 Markdown 表格的文档。如果文档不包含表格，分段将失败。建议先检查文档是否包含表格，或使用【递归分割】等通用方法。"
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
                      <Tooltip title="用于计算chunk大小的tokenizer">
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                >
                  <Select style={{ width: '100%' }}>
                    <Option value="character">字符级（character）</Option>
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
                      <span>分块大小</span>
                      <Tooltip title="每个分块的最大token/字符数">
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  extra="推荐: 512-4096"
                >
                  <InputNumber min={100} max={8192} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {/* Neural Chunking 特定参数 */}
        {selectedMethod === 'neural' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="model"
                label={
                  <Space>
                    <span>Neural 模型</span>
                    <Tooltip title="使用fine-tuned模型进行语义分割">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <Select style={{ width: '100%' }}>
                  <Option value="mirth/chonky_distilbert_base_uncased_1">DistilBERT Base (推荐)</Option>
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
                    <span>最小字符数</span>
                    <Tooltip title="每个分块的最小字符数">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                extra="推荐: 10-100"
              >
                <InputNumber min={5} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {/* Slumber (LLM) Chunking 特定参数 */}
        {selectedMethod === 'slumber' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="warning" style={{ display: 'flex', alignItems: 'center' }}>
                <WarningOutlined style={{ marginRight: 8 }} />
                高成本方法：LLM分割使用大语言模型进行语义分析，速度较慢且成本较高。仅推荐用于极高质量要求的场景。
              </Text>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="model_id"
                  label={
                    <Space>
                      <CloudOutlined style={{ color: '#1677ff' }} />
                      <span>文本生成模型</span>
                    </Space>
                  }
                  tooltip="用于语义分析的大语言模型"
                  rules={[{ required: true, message: '请选择文本生成模型' }]}
                >
                  <Select
                    placeholder="选择文本生成模型"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.label?.toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%', borderRadius: '6px' }}
                    options={[
                      // 默认模型选项
                      {
                        value: 'default',
                        label: `默认文本生成模型${defaultTextModelInfo ? ` (${defaultTextModelInfo.name})` : ''}`,
                        isDefault: true,
                        model: defaultTextModelInfo
                      },
                      // 其他模型选项（排除默认模型避免重复）
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
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="chunk_size"
                  label={
                    <Space>
                      <span>分块大小</span>
                      <Tooltip title="每个分块的目标大小（token数）">
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  extra="推荐: 1024-4096"
                >
                  <InputNumber min={512} max={8192} style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Form.Item
                  name="candidate_size"
                  label={
                    <Space>
                      <span>候选块大小</span>
                      <Tooltip title="用于LLM分析的候选分块大小">
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  extra="推荐: 64-256"
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
    // 只为token方法显示预览（recursive使用策略，难以预估）
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
        message="效果预览"
        description={
          <Space orientation="vertical">
            <Text>📄 平均每1000字 → 约 {estimateChunks(1000)} 个分块</Text>
            <Text>📚 10000字文档 → 约 {estimateChunks(10000)} 个分块</Text>
            {overlap > 0 && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                * 重叠: {overlap} 字，有效分块大小: {effectiveSize} 字
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
            <Text strong>请先选择知识库</Text>
            <Text type="secondary">请从知识库列表中选择一个知识库，然后进入设置页面。</Text>
          </Space>
        </div>
      </Card>
    );
  }

  // 移除loading的Spin显示，配置加载很快，直接显示表单即可
  return (
    <Card
      title={
        <Space>
          <span>分段设置</span>
          <Tooltip title="这些设置决定了文档如何被分块。不同的文档类型适合不同的分段方法。修改配置后，只影响新上传的文档。">
            <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 14 }} />
          </Tooltip>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            恢复默认
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
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
