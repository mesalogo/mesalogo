import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Tabs, App, Select, Tag, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../services/api/settings';

const { Text } = Typography;

/**
 * 提示词模板管理Modal
 * 包含5个类型的提示词模板 + 实验协议生成模板
 */
export const PromptTemplateModal = ({
  visible,
  onClose,
  modelConfigs,
  defaultModels,
  initialValues
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 获取提示词模板
  const fetchPromptTemplates = async () => {
    try {
      const templates = await settingsAPI.getPromptTemplates();
      form.setFieldsValue(templates);
    } catch (error) {
      console.error('Failed to get prompt templates:', error);
      message.error(t('promptTemplate.getFailed') + ': ' + (error.message || t('message.unknownError')));
    }
  };

  // 当Modal打开时，获取模板数据
  useEffect(() => {
    if (visible) {
      fetchPromptTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 保存提示词模板
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await settingsAPI.updatePromptTemplates(values);
      message.success(t('promptTemplate.saveSuccess'));
      onClose();
    } catch (error) {
      console.error('Failed to save prompt templates:', error);
      message.error(t('promptTemplate.saveFailed') + ': ' + (error.message || t('message.unknownError')));
    } finally {
      setLoading(false);
    }
  };

  // 重置提示词模板为默认值
  const handleReset = async () => {
    try {
      setLoading(true);
      // 调用重置API
      const result = await settingsAPI.resetPromptTemplates();
      if (result.success) {
        // 使用返回的默认模板更新表单
        form.setFieldsValue(result.templates);
        message.success(t('promptTemplate.resetSuccess'));
      } else {
        message.error(t('promptTemplate.resetFailed') + ': ' + (result.message || t('message.unknownError')));
      }
    } catch (error) {
      console.error('Failed to reset prompt templates:', error);
      message.error(t('promptTemplate.resetFailed') + ': ' + (error.message || t('message.unknownError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('promptTemplate.management.title')}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="reset" onClick={handleReset}>
          {t('button.resetToDefault')}
        </Button>,
        <Button key="cancel" onClick={onClose}>
          {t('button.cancel')}
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={loading}
          onClick={handleSave}
        >
          {t('button.save')}
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Tabs
          defaultActiveKey="roleSystemPrompt"
          items={[
            {
              key: 'roleSystemPrompt',
              label: t('promptTemplate.tab.roleSystemPrompt'),
              children: (
                <Form.Item
                  name="roleSystemPrompt"
                  label={t('promptTemplate.roleSystemPrompt.label')}
                  extra={t('promptTemplate.roleSystemPrompt.extra')}
                >
                  <Input.TextArea
                    rows={12}
                    placeholder={t('promptTemplate.roleSystemPrompt.placeholder')}
                  />
                </Form.Item>
              )
            },
            {
              key: 'actionSpaceBackground',
              label: t('promptTemplate.tab.actionSpaceBackground'),
              children: (
                <Form.Item
                  name="actionSpaceBackground"
                  label={t('promptTemplate.actionSpaceBackground.label')}
                  extra={t('promptTemplate.actionSpaceBackground.extra')}
                >
                  <Input.TextArea
                    rows={12}
                    placeholder={t('promptTemplate.actionSpaceBackground.placeholder')}
                  />
                </Form.Item>
              )
            },
            {
              key: 'actionSpaceRules',
              label: t('promptTemplate.tab.actionSpaceRules'),
              children: (
                <Form.Item
                  name="actionSpaceRules"
                  label={t('promptTemplate.actionSpaceRules.label')}
                  extra={t('promptTemplate.actionSpaceRules.extra')}
                >
                  <Input.TextArea
                    rows={12}
                    placeholder={t('promptTemplate.actionSpaceRules.placeholder')}
                  />
                </Form.Item>
              )
            },
            {
              key: 'actionTaskDescription',
              label: t('promptTemplate.tab.actionTaskDescription'),
              children: (
                <Form.Item
                  name="actionTaskDescription"
                  label={t('promptTemplate.actionTaskDescription.label')}
                  extra={t('promptTemplate.actionTaskDescription.extra')}
                >
                  <Input.TextArea
                    rows={12}
                    placeholder={t('promptTemplate.actionTaskDescription.placeholder')}
                  />
                </Form.Item>
              )
            },
            {
              key: 'userMessageExpand',
              label: t('promptTemplate.tab.userMessageExpand'),
              children: (
                <Form.Item
                  name="userMessageExpand"
                  label={t('promptTemplate.userMessageExpand.label')}
                  extra={t('promptTemplate.userMessageExpand.extra')}
                >
                  <Input.TextArea
                    rows={12}
                    placeholder={t('promptTemplate.userMessageExpand.placeholder')}
                  />
                </Form.Item>
              )
            },
            {
              key: 'experimentProtocolGeneration',
              label: t('promptTemplate.tab.experimentProtocolGeneration'),
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item
                    name="experimentProtocolGeneration"
                    label={t('promptTemplate.experimentProtocolGeneration.label')}
                    extra={t('promptTemplate.experimentProtocolGeneration.extra')}
                  >
                    <Input.TextArea
                      rows={12}
                      placeholder={t('promptTemplate.experimentProtocolGeneration.placeholder')}
                    />
                  </Form.Item>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('promptTemplate.experimentProtocolGeneration.hint')}
                  </Text>
                </Space>
              )
            }
          ]}
        />
      </Form>
    </Modal>
  );
};
