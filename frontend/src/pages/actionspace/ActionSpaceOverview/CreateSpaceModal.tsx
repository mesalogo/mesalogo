import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Checkbox, message, Space, Typography } from 'antd';
import { RobotOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { modelConfigAPI } from '../../../services/api/model';
import { settingsAPI } from '../../../services/api/settings';
import { replaceTemplateVariables } from '../../../utils/templateUtils';
import { getAssistantGenerationModelId } from '../../../utils/modelUtils';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

/**
 * 创建行动空间 Modal 组件
 * 包含表单和辅助生成功能
 */
const CreateSpaceModal = ({ visible, onCancel, onSuccess, industryTags, scenarioTags }: any) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState({ background: false, rules: false });
  const [modelConfigs, setModelConfigs] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({
    enableAssistantGeneration: true,
    assistantGenerationModel: 'default'
  });

  // 获取模型配置和全局设置
  useEffect(() => {
    if (visible) {
      fetchModelConfigs();
      fetchGlobalSettings();
    }
  }, [visible]);

  const fetchModelConfigs = async () => {
    try {
      const models = await modelConfigAPI.getAll();
      setModelConfigs(models);
    } catch (error) {
      console.error('获取模型配置失败:', error);
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      setGlobalSettings({
        enableAssistantGeneration: settings.enableAssistantGeneration !== undefined 
          ? settings.enableAssistantGeneration 
          : true,
        assistantGenerationModel: settings.assistantGenerationModel || 'default'
      });
    } catch (error) {
      console.error('获取全局设置失败:', error);
    }
  };

  // 辅助生成背景设定
  const generateBackground = async () => {
    try {
      if (!globalSettings.enableAssistantGeneration) {
        message.warning('辅助生成功能未启用，请在系统设置中开启');
        return;
      }

      const { name, description } = form.getFieldsValue(['name', 'description']);
      if (!name || !description) {
        message.warning(t('actionSpace.fillNameDescFirst') || '请先填写名称和描述');
        return;
      }

      setGenerating(prev => ({ ...prev, background: true }));

      // 获取提示词模板
      const templates = await settingsAPI.getPromptTemplates();
      const promptTemplate = templates.actionSpaceBackground;
      if (!promptTemplate) {
        throw new Error('未获取到背景设定生成模板');
      }

      const generatePrompt = replaceTemplateVariables(promptTemplate, { name, description });
      const modelToUse = await getAssistantGenerationModelId(modelConfigs, globalSettings.assistantGenerationModel);

      let generatedContent = '';
      await modelConfigAPI.testModelStream(
        modelToUse,
        generatePrompt,
        (chunk) => {
          if (chunk && chunk !== 'null' && chunk !== 'undefined' && typeof chunk === 'string') {
            generatedContent += chunk;
            form.setFieldsValue({ background: generatedContent });
          }
        },
        "你是一个专业的场景设计师，擅长根据空间描述生成详细的背景设定。",
        { temperature: 0.7, max_tokens: 1000 }
      );

      const cleanedContent = generatedContent.replace(/null/g, '').replace(/undefined/g, '').trim();
      form.setFieldsValue({ background: cleanedContent });
      message.success('背景设定生成完成');
    } catch (error) {
      console.error('辅助生成背景设定失败:', error);
      message.error(`辅助生成失败: ${error.message || '未知错误'}`);
    } finally {
      setGenerating(prev => ({ ...prev, background: false }));
    }
  };

  // 辅助生成基本规则
  const generateRules = async () => {
    try {
      if (!globalSettings.enableAssistantGeneration) {
        message.warning('辅助生成功能未启用，请在系统设置中开启');
        return;
      }

      const { name, description } = form.getFieldsValue(['name', 'description']);
      if (!name || !description) {
        message.warning('请先填写行动空间名称和描述，然后再使用辅助生成');
        return;
      }

      setGenerating(prev => ({ ...prev, rules: true }));

      // 获取提示词模板
      const templates = await settingsAPI.getPromptTemplates();
      const promptTemplate = templates.actionSpaceRules;
      if (!promptTemplate) {
        throw new Error('未获取到基本规则生成模板');
      }

      const generatePrompt = replaceTemplateVariables(promptTemplate, { name, description });
      const modelToUse = await getAssistantGenerationModelId(modelConfigs, globalSettings.assistantGenerationModel);

      let generatedContent = '';
      await modelConfigAPI.testModelStream(
        modelToUse,
        generatePrompt,
        (chunk) => {
          if (chunk && chunk !== 'null' && chunk !== 'undefined' && typeof chunk === 'string') {
            generatedContent += chunk;
            form.setFieldsValue({ rules: generatedContent });
          }
        },
        "你是一个专业的规则制定专家，擅长根据空间描述生成详细的行为规则。",
        { temperature: 0.7, max_tokens: 1000 }
      );

      const cleanedContent = generatedContent.replace(/null/g, '').replace(/undefined/g, '').trim();
      form.setFieldsValue({ rules: cleanedContent });
      message.success('基本规则生成完成');
    } catch (error) {
      console.error('辅助生成基本规则失败:', error);
      message.error(`辅助生成失败: ${error.message || '未知错误'}`);
    } finally {
      setGenerating(prev => ({ ...prev, rules: false }));
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const spaceData = {
        name: values.name,
        description: values.description,
        rules: values.rules || '',
        settings: {
          background: values.background || ''
        },
        tag_ids: values.tag_ids || [],
        is_shared: values.is_shared || false
      };

      await actionSpaceAPI.create(spaceData);
      message.success(t('actionSpace.createSuccess') || '创建成功');
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      console.error('创建行动空间失败:', error);
      // 检查是否是配额超限错误
      if (error.response?.status === 403 && error.response?.data?.quota) {
        message.error(`配额超限：${error.response.data.message || '您的计划已达到行动空间数量上限'}`);
      } else {
        message.error(t('actionSpace.createFailed') || '创建失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="创建行动空间"
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入行动空间名称' }]}
        >
          <Input placeholder="输入行动空间名称" />
        </Form.Item>

        <Form.Item
          name="description"
          label="描述"
          rules={[{ required: true, message: '请输入行动空间描述' }]}
        >
          <TextArea rows={3} placeholder="输入行动空间描述" />
        </Form.Item>

        <Form.Item
          name="tag_ids"
          label="标签"
          extra="选择适合此行动空间的标签"
        >
          <Select
            mode="multiple"
            placeholder="选择标签"
            optionFilterProp="label"
            style={{ width: '100%' }}
          >
            <Select.OptGroup label="行业标签">
              {industryTags.map(tag => (
                <Option key={tag.id} value={tag.id} label={tag.name}>
                  {tag.name}
                </Option>
              ))}
            </Select.OptGroup>
            <Select.OptGroup label="场景标签">
              {scenarioTags.map(tag => (
                <Option key={tag.id} value={tag.id} label={tag.name}>
                  {tag.name}
                </Option>
              ))}
            </Select.OptGroup>
          </Select>
        </Form.Item>

        <Form.Item
          name="is_shared"
          valuePropName="checked"
          tooltip="勾选后，该行动空间将对所有用户可见可用（但只有创建者可编辑）"
        >
          <Checkbox>
            <Space>
              <TeamOutlined />
              共享给所有用户
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item
          name="background"
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>背景设定</span>
              <a 
                onClick={generateBackground}
                style={{
                  color: globalSettings.enableAssistantGeneration ? '#1677ff' : 'var(--custom-text-secondary)',
                  cursor: globalSettings.enableAssistantGeneration ? 'pointer' : 'not-allowed'
                }}
              >
                <RobotOutlined /> 辅助生成
              </a>
            </div>
          }
          extra={
            !globalSettings.enableAssistantGeneration ? (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                辅助生成功能未启用，请在系统设置中开启
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                点击"辅助生成"可根据行动空间名称和描述自动生成背景设定
              </Text>
            )
          }
        >
          <TextArea
            rows={5}
            placeholder="输入行动空间背景设定"
            style={{
              backgroundColor: generating.background ? '#f6ffed' : undefined,
              borderColor: generating.background ? '#b7eb8f' : undefined
            }}
            disabled={generating.background}
          />
        </Form.Item>

        <Form.Item
          name="rules"
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>基本规则</span>
              <a 
                onClick={generateRules}
                style={{
                  color: globalSettings.enableAssistantGeneration ? '#1677ff' : 'var(--custom-text-secondary)',
                  cursor: globalSettings.enableAssistantGeneration ? 'pointer' : 'not-allowed'
                }}
              >
                <RobotOutlined /> 辅助生成
              </a>
            </div>
          }
          extra={
            !globalSettings.enableAssistantGeneration ? (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                辅助生成功能未启用，请在系统设置中开启
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                点击"辅助生成"可根据行动空间名称和描述自动生成基本规则
              </Text>
            )
          }
        >
          <TextArea
            rows={5}
            placeholder="输入基本规则"
            style={{
              backgroundColor: generating.rules ? '#f6ffed' : undefined,
              borderColor: generating.rules ? '#b7eb8f' : undefined
            }}
            disabled={generating.rules}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateSpaceModal;
