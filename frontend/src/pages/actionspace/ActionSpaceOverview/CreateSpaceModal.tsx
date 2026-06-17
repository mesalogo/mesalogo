import React, { useState, useEffect } from 'react';
import { App, Modal, Form, Input, Select, Checkbox, Space, Typography } from 'antd';
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
 * Create action space modal.
 * Includes form fields and assistant generation.
 */
const CreateSpaceModal = ({ visible, onCancel, onSuccess, industryTags, scenarioTags }: any) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState({ background: false, rules: false });
  const [modelConfigs, setModelConfigs] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({
    enableAssistantGeneration: true,
    assistantGenerationModel: 'default'
  });

  // Fetch model configs and global settings
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
      console.error('fetch model configs failed:', error);
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
      console.error('fetch global settings failed:', error);
    }
  };

  // Generate background with assistant
  const generateBackground = async () => {
    try {
      if (!globalSettings.enableAssistantGeneration) {
        message.warning(t('createSpace.assistantDisabled'));
        return;
      }

      const { name, description } = form.getFieldsValue(['name', 'description']);
      if (!name || !description) {
        message.warning(t('createSpace.fillNameDescFirst'));
        return;
      }

      setGenerating(prev => ({ ...prev, background: true }));

      // Fetch prompt template
      const templates = await settingsAPI.getPromptTemplates();
      const promptTemplate = templates.actionSpaceBackground;
      if (!promptTemplate) {
        throw new Error(t('createSpace.backgroundTemplateMissing'));
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
        "You are a professional scenario designer who creates detailed background settings from action-space descriptions.",
        { temperature: 0.7, max_tokens: 1000 }
      );

      const cleanedContent = generatedContent.replace(/null/g, '').replace(/undefined/g, '').trim();
      form.setFieldsValue({ background: cleanedContent });
      message.success(t('createSpace.backgroundGenerated'));
    } catch (error) {
      console.error('assistant background generation failed:', error);
      message.error(t('createSpace.assistantFailed', { error: error.message || t('createSpace.unknownError') }));
    } finally {
      setGenerating(prev => ({ ...prev, background: false }));
    }
  };

  // Generate basic rules with assistant
  const generateRules = async () => {
    try {
      if (!globalSettings.enableAssistantGeneration) {
        message.warning(t('createSpace.assistantDisabled'));
        return;
      }

      const { name, description } = form.getFieldsValue(['name', 'description']);
      if (!name || !description) {
        message.warning(t('createSpace.fillNameDescFirst'));
        return;
      }

      setGenerating(prev => ({ ...prev, rules: true }));

      // Fetch prompt template
      const templates = await settingsAPI.getPromptTemplates();
      const promptTemplate = templates.actionSpaceRules;
      if (!promptTemplate) {
        throw new Error(t('createSpace.rulesTemplateMissing'));
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
        "You are a professional rule designer who creates detailed behavioral rules from action-space descriptions.",
        { temperature: 0.7, max_tokens: 1000 }
      );

      const cleanedContent = generatedContent.replace(/null/g, '').replace(/undefined/g, '').trim();
      form.setFieldsValue({ rules: cleanedContent });
      message.success(t('createSpace.rulesGenerated'));
    } catch (error) {
      console.error('assistant rule generation failed:', error);
      message.error(t('createSpace.assistantFailed', { error: error.message || t('createSpace.unknownError') }));
    } finally {
      setGenerating(prev => ({ ...prev, rules: false }));
    }
  };

  // Submit form
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
      message.success(t('actionSpace.createSuccess'));
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      console.error('create action space failed:', error);
      // Check quota errors
      if (error.response?.status === 403 && error.response?.data?.quota) {
        message.error(t('createSpace.quotaExceeded', { message: error.response.data.message || t('createSpace.quotaDefault') }));
      } else {
        message.error(t('actionSpace.createFailed'));
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
      title={t('createSpace.title')}
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t('createSpace.name')}
          rules={[{ required: true, message: t('createSpace.nameRequired') }]}
        >
          <Input placeholder={t('createSpace.namePh')} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('createSpace.description')}
          rules={[{ required: true, message: t('createSpace.descRequired') }]}
        >
          <TextArea rows={3} placeholder={t('createSpace.descPh')} />
        </Form.Item>

        <Form.Item
          name="tag_ids"
          label={t('createSpace.tags')}
          extra={t('createSpace.tagsExtra')}
        >
          <Select
            mode="multiple"
            placeholder={t('createSpace.selectTags')}
            optionFilterProp="label"
            style={{ width: '100%' }}
          >
            <Select.OptGroup label={t('createSpace.industryTags')}>
              {industryTags.map(tag => (
                <Option key={tag.id} value={tag.id} label={tag.name}>
                  {tag.name}
                </Option>
              ))}
            </Select.OptGroup>
            <Select.OptGroup label={t('createSpace.scenarioTags')}>
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
          tooltip={t('createSpace.shareTooltip')}
        >
          <Checkbox>
            <Space>
              <TeamOutlined />
              {t('createSpace.shareAll')}
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item
          name="background"
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{t('createSpace.background')}</span>
              <a 
                onClick={generateBackground}
                style={{
                  color: globalSettings.enableAssistantGeneration ? '#1677ff' : 'var(--custom-text-secondary)',
                  cursor: globalSettings.enableAssistantGeneration ? 'pointer' : 'not-allowed'
                }}
              >
                <RobotOutlined /> {t('createSpace.assistantGenerate')}
              </a>
            </div>
          }
          extra={
            !globalSettings.enableAssistantGeneration ? (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('createSpace.assistantDisabled')}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('createSpace.backgroundAssistHint')}
              </Text>
            )
          }
        >
          <TextArea
            rows={5}
            placeholder={t('createSpace.backgroundPh')}
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
              <span>{t('createSpace.rules')}</span>
              <a 
                onClick={generateRules}
                style={{
                  color: globalSettings.enableAssistantGeneration ? '#1677ff' : 'var(--custom-text-secondary)',
                  cursor: globalSettings.enableAssistantGeneration ? 'pointer' : 'not-allowed'
                }}
              >
                <RobotOutlined /> {t('createSpace.assistantGenerate')}
              </a>
            </div>
          }
          extra={
            !globalSettings.enableAssistantGeneration ? (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('createSpace.assistantDisabled')}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('createSpace.rulesAssistHint')}
              </Text>
            )
          }
        >
          <TextArea
            rows={5}
            placeholder={t('createSpace.rulesPh')}
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
