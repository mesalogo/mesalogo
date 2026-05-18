import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Tooltip,
  Tag,
  Row,
  Col,
  Collapse,
  InputNumber,
  Divider,
  Skeleton,
  Tabs,
  Checkbox,
  Empty,
  Badge,
  Alert,
  Button,
  Space,
  Card,
  App,
  Typography
} from 'antd';
import {
  SettingOutlined,
  QuestionCircleOutlined,
  FunctionOutlined,
  DatabaseOutlined,
  RobotOutlined,
  TeamOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  CodeOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { modelConfigAPI } from '../../services/api/model';
import capabilityAPI from '../../services/api/capability';
import skillAPI from '../../services/api/skill';
import { settingsAPI } from '../../services/api/settings';
import { replaceTemplateVariables } from '../../utils/templateUtils';
import { getAssistantGenerationModelId } from '../../utils/modelUtils';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const InternalRoleModal = ({
  visible,
  selectedRole,
  models,
  loadingModels,
  capabilities,
  loadingCapabilities,
  allKnowledges,
  loadingKnowledges,
  globalSettings,
  onOk,
  onCancel
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('roleSettings');
  const [selectedCapabilities, setSelectedCapabilities] = useState({});
  const [selectedKnowledges, setSelectedKnowledges] = useState([]);
  const [roleKnowledges, setRoleKnowledges] = useState([]);
  const [testResult, setTestResult] = useState('');
  const [testVisible, setTestVisible] = useState(false);
  const [assistantGenerating, setAssistantGenerating] = useState(false);
  const [allSkills, setAllSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  useEffect(() => {
    if (visible && selectedRole) {
      const modelToUse = selectedRole.model === null || selectedRole.model === undefined || selectedRole.model === ''
        ? ''
        : selectedRole.model;

      const capabilitiesMap = {};
      if (selectedRole.capabilities) {
        selectedRole.capabilities.forEach(cap => {
          capabilitiesMap[cap.id] = true;
        });
      }
      setSelectedCapabilities(capabilitiesMap);

      form.setFieldsValue({
        name: selectedRole.name,
        model: modelToUse,
        systemPrompt: selectedRole.system_prompt,
        description: selectedRole.description,
        source: selectedRole.source || 'internal',
        is_shared: selectedRole.is_shared || false,
        temperature: selectedRole.temperature || 0.7,
        topP: selectedRole.topP || 1,
        frequencyPenalty: selectedRole.frequencyPenalty || 0,
        presencePenalty: selectedRole.presencePenalty || 0,
        stopSequences: selectedRole.stopSequences || [],
        capabilities: selectedRole.capabilities || {},
        plugins: selectedRole.plugins || []
      });

      const roleKnowledges = [
        ...(selectedRole.internalKnowledges || []).map(kb => ({
          ...kb,
          type: 'internal',
          original_id: kb.id,
          id: `internal_${kb.id}`
        })),
        ...(selectedRole.externalKnowledges || []).map(kb => ({
          ...kb,
          type: 'external',
          original_id: kb.id,
          id: `external_${kb.id}`
        }))
      ];
      setRoleKnowledges(roleKnowledges);
      setSelectedKnowledges(roleKnowledges.map(kb => kb.id));
    } else if (visible && !selectedRole) {
      form.resetFields();
      form.setFieldsValue({
        source: 'internal',
        temperature: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        maxTokens: 2000,
        stopSequences: [],
        capabilities: {},
        plugins: []
      });

      const loadDefaultCapabilities = async () => {
        try {
          const response = await capabilityAPI.getAll();
          let capabilitiesData = [];
          if (response.data && Array.isArray(response.data)) {
            capabilitiesData = response.data;
          }

          const defaultCapabilities = {};
          capabilitiesData.forEach(cap => {
            if (cap.default_enabled) {
              defaultCapabilities[cap.id] = true;
            }
          });
          setSelectedCapabilities(defaultCapabilities);
        } catch (error) {
          console.error('load default capabilities failed:', error);
          setSelectedCapabilities({});
        }
      };

      loadDefaultCapabilities();
      setRoleKnowledges([]);
      setSelectedKnowledges([]);
    }
    setTestResult('');
    setTestVisible(false);
    setActiveFormTab('roleSettings');

    // load skill list and role-bound skills
    if (visible) {
      const loadSkills = async () => {
        setLoadingSkills(true);
        try {
          const res = await skillAPI.getAll();
          setAllSkills((res.data || []).filter(s => s.enabled));
          if (selectedRole) {
            const roleSkillsRes = await skillAPI.getRoleSkills(selectedRole.id);
            setSelectedSkills((roleSkillsRes.data || []).map(s => s.id));
          } else {
            setSelectedSkills([]);
          }
        } catch (e) {
          console.error('load skills failed:', e);
        } finally {
          setLoadingSkills(false);
        }
      };
      loadSkills();
    }
  }, [visible, selectedRole, form]);

  const handleAssistantGenerate = async () => {
    try {
      if (!globalSettings.enableAssistantGeneration) {
        message.warning(t('intRole.msg.assistantOff'));
        return;
      }

      const values = form.getFieldsValue(['name', 'description']);
      if (!values.name || !values.description) {
        message.warning(t('intRole.msg.fillNameDescFirst'));
        return;
      }

      setAssistantGenerating(true);

      let promptTemplate;
      try {
        const templates = await settingsAPI.getPromptTemplates();
        promptTemplate = templates.roleSystemPrompt;
        if (!promptTemplate) {
          throw new Error(t('intRole.err.noSysPromptTpl'));
        }
      } catch (error) {
        console.error('load prompt template failed:', error);
        message.error(t('intRole.msg.loadTplFailed'));
        setAssistantGenerating(false);
        return;
      }

      const generatePrompt = replaceTemplateVariables(promptTemplate, {
        name: values.name,
        description: values.description
      });

      const modelToUse = await getAssistantGenerationModelId(models, globalSettings.assistantGenerationModel);

      let generatedPrompt = '';
      const handleStreamResponse = (chunk) => {
        if (chunk && chunk !== 'null' && chunk !== 'undefined' && typeof chunk === 'string') {
          generatedPrompt += chunk;
          form.setFieldsValue({ systemPrompt: generatedPrompt });
        }
      };

      await modelConfigAPI.testModelStream(
        modelToUse,
        generatePrompt,
        handleStreamResponse,
        t('intRole.assistantSystemPrompt'),
        { temperature: 0.7, max_tokens: 1000 }
      );

      const cleanedPrompt = generatedPrompt.replace(/null/g, '').replace(/undefined/g, '').trim();
      form.setFieldsValue({ systemPrompt: cleanedPrompt });
      message.success(t('intRole.msg.sysPromptGenerated'));
    } catch (error) {
      console.error('assistant generate failed:', error);
      message.error(t('intRole.msg.assistantFailed', { msg: error.message || t('intRole.unknownError') }));
    } finally {
      setAssistantGenerating(false);
    }
  };

  const handleTestLLM = async () => {
    try {
      const values = await form.validateFields();
      if (values.model === undefined) {
        message.error(t('intRole.msg.pickModelFirst'));
        return;
      }

      setTestResult('');
      setTestVisible(true);

      try {
        const advancedParams = {
          system_prompt: values.systemPrompt,
          temperature: values.temperature,
          top_p: values.topP,
          frequency_penalty: values.frequencyPenalty,
          presence_penalty: values.presencePenalty,
          stop_sequences: values.stopSequences
        };

        let streamContent = '';
        const handleStreamResponse = (chunk) => {
          if (chunk) {
            streamContent += chunk;
            setTestResult(streamContent);
          }
        };

        let selectedModelConfig;
        if (values.model === null || values.model === '') {
          selectedModelConfig = models.find(m => m.is_default_text) || models.find(m => m.modalities && m.modalities.includes('text_output'));
          if (!selectedModelConfig) {
            throw new Error(t('intRole.err.noDefaultTextModel'));
          }
        } else {
          selectedModelConfig = models.find(m => m.id.toString() === values.model?.toString());
          if (!selectedModelConfig) {
            const defaultModel = models.find(m => m.is_default_text);
            if (defaultModel) {
              selectedModelConfig = defaultModel;
            } else {
              throw new Error(t('intRole.err.noPickedModel'));
            }
          }
        }

        await modelConfigAPI.testModelStream(
          selectedModelConfig.id,
          values.systemPrompt || t('intRole.defaultTestPrompt'),
          handleStreamResponse,
          values.systemPrompt,
          advancedParams
        );
      } catch (error) {
        console.error('test LLM failed:', error);
        setTestResult(t('intRole.testFailed', { msg: error.message || t('intRole.unknownError') }));
      }
    } catch (error) {
      message.error(t('intRole.msg.completeForm'));
    }
  };

  const handleCapabilityChange = (capabilityId, checked) => {
    setSelectedCapabilities(prev => ({
      ...prev,
      [capabilityId]: checked
    }));
  };

  const handleOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();

      await onOk({
        values,
        selectedCapabilities,
        selectedKnowledges,
        roleKnowledges: roleKnowledges.map(kb => kb.id),
        selectedSkills
      });
    } catch (error) {
      console.error('save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderCapabilitiesTabContent = () => {
    if (loadingCapabilities) {
      return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {[1, 2, 3, 4].map(item => (
            <Card key={item}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </Space>
      );
    }

    const typeLabels = {
      'core': t('intRole.capType.core'),
      'advanced': t('intRole.capType.advanced'),
      'supervision': t('intRole.capType.supervision'),
      'execution': t('intRole.capType.execution'),
      'specialized': t('intRole.capType.specialized'),
    };

    const typeIcons = {
      'core': <FunctionOutlined style={{ color: '#1677ff' }} />,
      'advanced': <ThunderboltOutlined style={{ color: '#722ed1' }} />,
      'supervision': <EyeOutlined style={{ color: '#fa8c16' }} />,
      'execution': <CodeOutlined style={{ color: '#eb2f96' }} />,
      'specialized': <AppstoreOutlined style={{ color: '#13c2c2' }} />
    };

    if (Object.keys(capabilities).length === 0) {
      return <Empty description={t('intRole.empty.noCapData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text>{t('intRole.capHint')}</Text>
        </div>

        {Object.entries(capabilities).map(([type, capList]: [string, any]) => {
          if (!capList || (capList as any).length === 0) return null;

          return (
            <Card
              key={type}
              title={
                <Space>
                  {typeIcons[type] || <AppstoreOutlined />}
                  {typeLabels[type] || type}
                  <Badge count={capList.length} style={{ backgroundColor: '#52c41a' }} />
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              {capList.map(cap => (
                <Form.Item key={cap.id}>
                  <Checkbox
                    checked={!!selectedCapabilities[cap.id]}
                    onChange={(e) => handleCapabilityChange(cap.id, e.target.checked)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Text strong style={{ marginRight: '8px' }}>{cap.name}</Text>
                      <Tooltip title={cap.description}>
                        <Text
                          type="secondary"
                          style={{
                            maxWidth: '400px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {cap.description}
                        </Text>
                      </Tooltip>
                    </div>
                  </Checkbox>
                </Form.Item>
              ))}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderKnowledgeTabContent = () => {
    if (loadingKnowledges) {
      return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {[1, 2, 3, 4, 5].map(item => (
            <Card key={item}>
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </Space>
      );
    }

    if (allKnowledges.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('intRole.empty.noKB')}
          >
            <Text type="secondary">
              {t('intRole.empty.noKBHint')}
            </Text>
          </Empty>
        </div>
      );
    }

    return (
      <div style={{ padding: '16px 0' }}>
        <Checkbox.Group
          value={selectedKnowledges}
          onChange={setSelectedKnowledges}
          style={{ width: '100%' }}
        >
          <Row gutter={[16, 16]}>
            {allKnowledges.map(kb => {
              const knowledgeId = `${kb.type}_${kb.id}`;
              return (
                <Col span={24} key={knowledgeId}>
                  <Card

                    style={{
                      border: selectedKnowledges.includes(knowledgeId) ? '2px solid #1677ff' : '1px solid var(--custom-border)',
                      borderRadius: 8,
                      transition: 'all 0.3s ease'
                    }}
                    styles={{ body: { padding: '12px 16px' } }}
                  >
                    <Checkbox value={knowledgeId} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                            <DatabaseOutlined style={{
                              marginRight: 8,
                              color: kb.type === 'internal' ? '#52c41a' : '#1677ff'
                            }} />
                            <Text strong>{kb.name}</Text>
                            <Tag
                              color={kb.type === 'internal' ? 'green' : 'blue'}
                              style={{ marginLeft: 8, fontSize: '10px' }}
                            >
                              {kb.type === 'internal' ? t('intRole.kb.internal') : t('intRole.kb.external')}
                            </Tag>
                            <Badge
                              status={kb.status === 'active' ? 'success' : 'error'}
                              text={kb.status === 'active' ? t('intRole.kb.statusOk') : t('intRole.kb.statusErr')}
                              style={{ marginLeft: 8 }}
                            />
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                            {kb.description || t('intRole.kb.noDesc')}
                          </Text>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {t('intRole.kb.providerLabel', { v: kb.provider_name || t('intRole.unknown') })}
                            </Text>
                            {kb.external_id && (
                              <Text type="secondary" style={{ fontSize: '11px', marginLeft: 12 }}>
                                {t('intRole.kb.idLabel', { v: kb.external_id })}
                              </Text>
                            )}
                          </div>
                        </div>
                        <div style={{ marginLeft: 16 }}>
                          {selectedKnowledges.includes(knowledgeId) ? (
                            <LinkOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                          ) : (
                            <DisconnectOutlined style={{ color: 'var(--custom-border)', fontSize: 16 }} />
                          )}
                        </div>
                      </div>
                    </Checkbox>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Checkbox.Group>
      </div>
    );
  };

  const renderSkillsTabContent = () => {
    if (loadingSkills) {
      return <Skeleton active />;
    }

    if (allSkills.length === 0) {
      return <Empty description={t('intRole.skill.empty')} />;
    }

    return (
      <div>
        <Alert
          message={t('intRole.skill.alertTitle')}
          description={t('intRole.skill.alertDesc')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Checkbox.Group
          value={selectedSkills}
          onChange={(checkedValues) => setSelectedSkills(checkedValues)}
          style={{ width: '100%' }}
        >
          <Row gutter={[12, 12]}>
            {allSkills.map(skill => (
              <Col span={12} key={skill.id}>
                <Card size="small" hoverable style={{ height: '100%' }}>
                  <Checkbox value={skill.id}>
                    <Space direction="vertical" size={0}>
                      <Space>
                        <span>📦</span>
                        <Text strong>{skill.display_name || skill.name}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>{skill.description}</Text>
                    </Space>
                  </Checkbox>
                </Card>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>
      </div>
    );
  };

  return (
    <Modal
      title={selectedRole ? t('roleManagement.editRole') : t('roleManagement.createRole')}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={saving}
      width={800}
      style={{ top: 20 }}
    >
      <Tabs
        activeKey={activeFormTab}
        onChange={setActiveFormTab}

        style={{ marginTop: '20px' }}
        items={[
          {
            key: 'roleSettings',
            label: <span><SettingOutlined />{t('intRole.tab.roleSettings')}</span>,
            forceRender: true,
            children: (
              <Form form={form} layout="vertical">
                <Form.Item
                  name="name"
                  label={t('intRole.field.name')}
                  rules={[{ required: true, message: t('intRole.req.name') }]}
                >
                  <Input placeholder={t('intRole.req.name')} />
                </Form.Item>

                <Form.Item
                  name="source"
                  label={t('intRole.field.source')}
                  rules={[{ required: true, message: t('intRole.req.source') }]}
                  initialValue="internal"
                >
                  {selectedRole ? (
                    <div>
                      <Tag color={selectedRole.source === 'external' ? 'green' : 'blue'}>
                        {selectedRole.source === 'external' ? t('intRole.kb.external') : t('intRole.kb.internal')}
                      </Tag>
                      <Input type="hidden" value={selectedRole.source || 'internal'} />
                    </div>
                  ) : (
                    <div>
                      <Tag color="blue">{t('intRole.kb.internal')}</Tag>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {t('intRole.newRoleHint')}
                      </Text>
                      <Input type="hidden" value="internal" />
                    </div>
                  )}
                </Form.Item>

                <Form.Item
                  name="model"
                  label={t('intRole.field.model')}
                  rules={[
                    {
                      validator: (_, value) => {
                        if (value === undefined) {
                          return Promise.reject(new Error(t('intRole.req.model')));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <Select placeholder={t('intRole.req.model')} loading={loadingModels}>
                    <Option key="default" value="">
                      {t('intRole.model.defaultText')} {(() => {
                        const defaultModel = models.find(m => m.is_default_text) || models.find(m => m.is_default);
                        return defaultModel ? `(${defaultModel.name})` : '';
                      })()}
                    </Option>
                    {models.map(model => (
                      <Option key={model.id} value={model.id}>
                        {model.name} ({model.model_id})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="description"
                  label={t('intRole.field.description')}
                  rules={[{ required: true, message: t('intRole.req.description') }]}
                >
                  <TextArea rows={2} placeholder={t('intRole.ph.description')} />
                </Form.Item>

                <Form.Item name="is_shared" valuePropName="checked" tooltip={t('intRole.tip.shareAll')}>
                  <Checkbox>
                    <Space>
                      <TeamOutlined />
                      {t('intRole.shareAll')}
                    </Space>
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  name="systemPrompt"
                  label={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>{t('intRole.field.systemPrompt')}</span>
                      <Button
                        type="link"
                        icon={<RobotOutlined />}
                        onClick={handleAssistantGenerate}
                        loading={assistantGenerating}
                        disabled={!globalSettings.enableAssistantGeneration}

                        style={{ color: '#1677ff', fontSize: '12px', padding: '0 4px', height: 'auto' }}
                      >
                        {t('intRole.assistantGenerate')}
                      </Button>
                    </div>
                  }
                  rules={[{ required: true, message: t('intRole.req.systemPrompt') }]}
                  extra={
                    !globalSettings.enableAssistantGeneration ?
                      <Text type="secondary" style={{ fontSize: '12px' }}>{t('intRole.assistantDisabledHint')}</Text> :
                      <Text type="secondary" style={{ fontSize: '12px' }}>{t('intRole.assistantHint')}</Text>
                  }
                >
                  <TextArea
                    rows={6}
                    placeholder={t('intRole.ph.systemPrompt')}
                    style={{
                      backgroundColor: assistantGenerating ? '#f6ffed' : undefined,
                      borderColor: assistantGenerating ? '#b7eb8f' : undefined
                    }}
                  />
                </Form.Item>

                <Divider>{t('intRole.advancedParams')}</Divider>

                <Collapse ghost items={[
                  {
                    key: "1",
                    label: t('intRole.modelParams'),
                    children: (
                      <>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              name="temperature"
                              label={
                                <Space>
                                  <span>Temperature</span>
                                  <Tooltip title={t('intRole.tip.temperature')}>
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: 0, max: 2, message: t('intRole.req.temperatureRange') }
                              ]}
                            >
                              <InputNumber min={0} max={2} step={0.1} placeholder={t('intRole.ph.leaveBlank')} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="topP"
                              label={
                                <Space>
                                  <span>Top P</span>
                                  <Tooltip title={t('intRole.tip.topP')}>
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: 0, max: 1, message: t('intRole.req.topPRange') }
                              ]}
                            >
                              <InputNumber min={0} max={1} step={0.1} placeholder={t('intRole.ph.leaveBlank')} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              name="frequencyPenalty"
                              label={
                                <Space>
                                  <span>{t('intRole.frequencyPenalty')}</span>
                                  <Tooltip title={t('intRole.tip.frequencyPenalty')}>
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: -2, max: 2, message: t('intRole.req.freqPenaltyRange') }
                              ]}
                            >
                              <InputNumber min={-2} max={2} step={0.1} placeholder={t('intRole.ph.leaveBlank')} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="presencePenalty"
                              label={
                                <Space>
                                  <span>{t('intRole.presencePenalty')}</span>
                                  <Tooltip title={t('intRole.tip.presencePenalty')}>
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: -2, max: 2, message: t('intRole.req.presPenaltyRange') }
                              ]}
                            >
                              <InputNumber min={-2} max={2} step={0.1} placeholder={t('intRole.ph.leaveBlank')} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </>
                    )
                  }
                ]} />

                <Divider>{t('intRole.testRole')}</Divider>

                <Form.Item>
                  <Card
                    title={t('intRole.testRoleResp')}

                    style={{ marginBottom: 16 }}
                    extra={<Button type="primary" onClick={handleTestLLM}>{t('intRole.test')}</Button>}
                  >
                    <div style={{ marginBottom: 8, color: 'var(--custom-text-secondary)' }}>
                      {t('intRole.testRoleHint')}
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
              </Form>
            )
          },
          {
            key: 'capabilities',
            label: <span><FunctionOutlined />{t('intRole.tab.capabilities')}</span>,
            forceRender: true,
            children: renderCapabilitiesTabContent()
          },
          {
            key: 'knowledge',
            label: <span><DatabaseOutlined />{t('intRole.tab.knowledge')}</span>,
            forceRender: true,
            children: renderKnowledgeTabContent()
          },
          {
            key: 'skills',
            label: <span><ThunderboltOutlined />{t('intRole.tab.skills')}</span>,
            forceRender: true,
            children: renderSkillsTabContent()
          }
        ]}
      />
    </Modal>
  );
};

export default InternalRoleModal;
