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
              label: '角色系统提示词',
              children: (
                <Form.Item
                  name="roleSystemPrompt"
                  label="角色系统提示词生成模板"
                  extra="可用变量：{{name}} - 角色名称，{{description}} - 角色描述"
                >
                  <Input.TextArea
                    rows={12}
                    placeholder="请输入角色系统提示词生成模板..."
                  />
                </Form.Item>
              )
            },
            {
              key: 'actionSpaceBackground',
              label: '行动空间背景',
              children: (
                <Form.Item
                  name="actionSpaceBackground"
                  label="行动空间背景设定生成模板"
                  extra="可用变量：{{name}} - 空间名称，{{description}} - 空间描述"
                >
                  <Input.TextArea
                    rows={12}
                    placeholder="请输入行动空间背景设定生成模板..."
                  />
                </Form.Item>
              )
            },
            {
              key: 'actionSpaceRules',
              label: '行动空间规则',
              children: (
                <Form.Item
                  name="actionSpaceRules"
                  label="行动空间基本规则生成模板"
                  extra="可用变量：{{name}} - 空间名称，{{description}} - 空间描述"
                >
                  <Input.TextArea
                    rows={12}
                    placeholder="请输入行动空间基本规则生成模板..."
                  />
                </Form.Item>
              )
            },
            {
              key: 'actionTaskDescription',
              label: '行动任务描述',
              children: (
                <Form.Item
                  name="actionTaskDescription"
                  label="行动任务描述生成模板"
                  extra="可用变量：{{title}} - 任务名称，{{action_space_name}} - 空间名称，{{action_space_description}} - 空间描述，{{roles}} - 参与角色"
                >
                  <Input.TextArea
                    rows={12}
                    placeholder="请输入行动任务描述生成模板..."
                  />
                </Form.Item>
              )
            },
            {
              key: 'userMessageExpand',
              label: '用户消息辅助',
              children: (
                <Form.Item
                  name="userMessageExpand"
                  label="用户消息辅助生成模板"
                  extra="可用变量：{{original_message}} - 原始消息，{{action_space_name}} - 空间名称，{{action_space_description}} - 空间描述，{{participant_roles}} - 参与角色，{{assist_mode}} - 辅助模式"
                >
                  <Input.TextArea
                    rows={12}
                    placeholder="请输入用户消息辅助生成模板..."
                  />
                </Form.Item>
              )
            },
            {
              key: 'experimentProtocolGeneration',
              label: '实验协议生成',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item
                    name="experimentProtocolGeneration"
                    label="实验行为协议生成模板"
                    extra="可用变量：{{experiment_name}} - 实验名称，{{action_space_name}} - 空间名称，{{action_space_description}} - 空间描述，{{roles}} - 参与角色，{{topic}} - 实验主题，{{variables_json}} - 扫描变量JSON，{{objectives_json}} - 目标变量JSON"
                  >
                    <Input.TextArea
                      rows={12}
                      placeholder="请输入实验行为协议生成模板..."
                    />
                  </Form.Item>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    此模板用于并行实验室中生成实验行为协议，协议将指导智能体如何根据扫描参数调整行为。
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
