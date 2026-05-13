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
          console.error('获取默认能力失败:', error);
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

    // 加载技能列表和角色绑定的技能
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
          console.error('加载技能失败:', e);
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
        message.warning('辅助生成功能未启用，请在系统设置中开启');
        return;
      }

      const values = form.getFieldsValue(['name', 'description']);
      if (!values.name || !values.description) {
        message.warning('请先填写角色名称和描述，然后再使用辅助生成');
        return;
      }

      setAssistantGenerating(true);

      let promptTemplate;
      try {
        const templates = await settingsAPI.getPromptTemplates();
        promptTemplate = templates.roleSystemPrompt;
        if (!promptTemplate) {
          throw new Error('未获取到角色系统提示词生成模板');
        }
      } catch (error) {
        console.error('获取提示词模板失败:', error);
        message.error('获取提示词模板失败，请检查系统设置');
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
        "你是一个专业的AI提示词工程师，擅长根据角色描述生成高质量的系统提示词。",
        { temperature: 0.7, max_tokens: 1000 }
      );

      const cleanedPrompt = generatedPrompt.replace(/null/g, '').replace(/undefined/g, '').trim();
      form.setFieldsValue({ systemPrompt: cleanedPrompt });
      message.success('系统提示词生成完成');
    } catch (error) {
      console.error('辅助生成失败:', error);
      message.error(`辅助生成失败: ${error.message || '未知错误'}`);
    } finally {
      setAssistantGenerating(false);
    }
  };

  const handleTestLLM = async () => {
    try {
      const values = await form.validateFields();
      if (values.model === undefined) {
        message.error('请先选择一个模型');
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
            throw new Error('未找到默认文本生成模型配置');
          }
        } else {
          selectedModelConfig = models.find(m => m.id.toString() === values.model?.toString());
          if (!selectedModelConfig) {
            const defaultModel = models.find(m => m.is_default_text);
            if (defaultModel) {
              selectedModelConfig = defaultModel;
            } else {
              throw new Error('未找到所选模型配置');
            }
          }
        }

        await modelConfigAPI.testModelStream(
          selectedModelConfig.id,
          values.systemPrompt || "请简单地介绍一下你自己。",
          handleStreamResponse,
          values.systemPrompt,
          advancedParams
        );
      } catch (error) {
        console.error('测试LLM失败:', error);
        setTestResult(`测试失败: ${error.message || '未知错误'}`);
      }
    } catch (error) {
      message.error('请先完成表单填写');
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
      console.error('保存失败:', error);
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
      'core': '核心能力',
      'advanced': '高级能力',
      'supervision': '监督能力',
      'execution': '执行能力',
      'specialized': '专业能力'
    };

    const typeIcons = {
      'core': <FunctionOutlined style={{ color: '#1677ff' }} />,
      'advanced': <ThunderboltOutlined style={{ color: '#722ed1' }} />,
      'supervision': <EyeOutlined style={{ color: '#fa8c16' }} />,
      'execution': <CodeOutlined style={{ color: '#eb2f96' }} />,
      'specialized': <AppstoreOutlined style={{ color: '#13c2c2' }} />
    };

    if (Object.keys(capabilities).length === 0) {
      return <Empty description="暂无能力数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text>选择智能体可以使用的能力，这些能力将决定智能体可以执行的操作范围和权限级别。</Text>
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
            description="暂无可用的知识库"
          >
            <Text type="secondary">
              请先创建内部知识库或配置外部知识库，然后再进行绑定
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
                              {kb.type === 'internal' ? '内部' : '外部'}
                            </Tag>
                            <Badge
                              status={kb.status === 'active' ? 'success' : 'error'}
                              text={kb.status === 'active' ? '正常' : '异常'}
                              style={{ marginLeft: 8 }}
                            />
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                            {kb.description || '暂无描述'}
                          </Text>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              提供商: {kb.provider_name || '未知'}
                            </Text>
                            {kb.external_id && (
                              <Text type="secondary" style={{ fontSize: '11px', marginLeft: 12 }}>
                                ID: {kb.external_id}
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
      return <Empty description="暂无可用技能，请先在技能管理中创建" />;
    }

    return (
      <div>
        <Alert
          message="技能绑定"
          description="选择要绑定到此角色的技能。绑定后，Agent 在对话中会根据技能描述自动激活对应技能。"
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
            label: <span><SettingOutlined />角色设置</span>,
            forceRender: true,
            children: (
              <Form form={form} layout="vertical">
                <Form.Item
                  name="name"
                  label="角色名称"
                  rules={[{ required: true, message: '请输入角色名称' }]}
                >
                  <Input placeholder="请输入角色名称" />
                </Form.Item>

                <Form.Item
                  name="source"
                  label="角色类型"
                  rules={[{ required: true, message: '请选择角色类型' }]}
                  initialValue="internal"
                >
                  {selectedRole ? (
                    <div>
                      <Tag color={selectedRole.source === 'external' ? 'green' : 'blue'}>
                        {selectedRole.source === 'external' ? '外部' : '内部'}
                      </Tag>
                      <Input type="hidden" value={selectedRole.source || 'internal'} />
                    </div>
                  ) : (
                    <div>
                      <Tag color="blue">内部</Tag>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        新建角色默认为内部类型，如需创建外部角色请使用"导入外部智能体"功能
                      </Text>
                      <Input type="hidden" value="internal" />
                    </div>
                  )}
                </Form.Item>

                <Form.Item
                  name="model"
                  label="使用的模型"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (value === undefined) {
                          return Promise.reject(new Error('请选择使用的模型'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <Select placeholder="请选择使用的模型" loading={loadingModels}>
                    <Option key="default" value="">
                      默认文本生成 {(() => {
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
                  label="描述"
                  rules={[{ required: true, message: '请输入描述' }]}
                >
                  <TextArea rows={2} placeholder="请简要描述该角色的功能和特点" />
                </Form.Item>

                <Form.Item name="is_shared" valuePropName="checked" tooltip="勾选后，该角色将对所有用户可见可用（但只有创建者可编辑）">
                  <Checkbox>
                    <Space>
                      <TeamOutlined />
                      共享给所有用户
                    </Space>
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  name="systemPrompt"
                  label={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>系统提示词</span>
                      <Button
                        type="link"
                        icon={<RobotOutlined />}
                        onClick={handleAssistantGenerate}
                        loading={assistantGenerating}
                        disabled={!globalSettings.enableAssistantGeneration}

                        style={{ color: '#1677ff', fontSize: '12px', padding: '0 4px', height: 'auto' }}
                      >
                        辅助生成
                      </Button>
                    </div>
                  }
                  rules={[{ required: true, message: '请输入系统提示词' }]}
                  extra={
                    !globalSettings.enableAssistantGeneration ?
                      <Text type="secondary" style={{ fontSize: '12px' }}>辅助生成功能未启用，请在系统设置中开启</Text> :
                      <Text type="secondary" style={{ fontSize: '12px' }}>点击"辅助生成"可根据角色名称和描述自动生成系统提示词</Text>
                  }
                >
                  <TextArea
                    rows={6}
                    placeholder="请输入详细的系统提示词，用于定义角色的行为和回答风格"
                    style={{
                      backgroundColor: assistantGenerating ? '#f6ffed' : undefined,
                      borderColor: assistantGenerating ? '#b7eb8f' : undefined
                    }}
                  />
                </Form.Item>

                <Divider>高级参数设置</Divider>

                <Collapse ghost items={[
                  {
                    key: "1",
                    label: "模型参数",
                    children: (
                      <>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              name="temperature"
                              label={
                                <Space>
                                  <span>Temperature</span>
                                  <Tooltip title="控制生成文本的随机性">
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: 0, max: 2, message: '温度值范围为0-2' }
                              ]}
                            >
                              <InputNumber min={0} max={2} step={0.1} placeholder="留空则不设置" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="topP"
                              label={
                                <Space>
                                  <span>Top P</span>
                                  <Tooltip title="控制生成文本的多样性">
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: 0, max: 1, message: 'Top P值范围为0-1' }
                              ]}
                            >
                              <InputNumber min={0} max={1} step={0.1} placeholder="留空则不设置" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              name="frequencyPenalty"
                              label={
                                <Space>
                                  <span>频率惩罚</span>
                                  <Tooltip title="减少重复使用相同词语的可能性">
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: -2, max: 2, message: '频率惩罚值范围为-2到2' }
                              ]}
                            >
                              <InputNumber min={-2} max={2} step={0.1} placeholder="留空则不设置" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="presencePenalty"
                              label={
                                <Space>
                                  <span>存在惩罚</span>
                                  <Tooltip title="减少讨论相同主题的可能性">
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                              }
                              rules={[
                                { type: 'number', min: -2, max: 2, message: '存在惩罚值范围为-2到2' }
                              ]}
                            >
                              <InputNumber min={-2} max={2} step={0.1} placeholder="留空则不设置" style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </>
                    )
                  }
                ]} />

                <Divider>测试角色</Divider>

                <Form.Item>
                  <Card
                    title="测试角色响应"

                    style={{ marginBottom: 16 }}
                    extra={<Button type="primary" onClick={handleTestLLM}>测试</Button>}
                  >
                    <div style={{ marginBottom: 8, color: 'var(--custom-text-secondary)' }}>
                      测试说明: 将使用上面填写的系统提示词内容作为测试输入，验证角色响应效果
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
            label: <span><FunctionOutlined />能力设置</span>,
            forceRender: true,
            children: renderCapabilitiesTabContent()
          },
          {
            key: 'knowledge',
            label: <span><DatabaseOutlined />知识库绑定</span>,
            forceRender: true,
            children: renderKnowledgeTabContent()
          },
          {
            key: 'skills',
            label: <span><ThunderboltOutlined />技能绑定</span>,
            forceRender: true,
            children: renderSkillsTabContent()
          }
        ]}
      />
    </Modal>
  );
};

export default InternalRoleModal;
