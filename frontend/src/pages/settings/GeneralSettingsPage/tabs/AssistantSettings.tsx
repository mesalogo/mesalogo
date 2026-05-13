import React, { useState, useEffect } from 'react';
import { Form, Select, Switch, Button, Space, Tooltip, Tag, Divider, App, Typography } from 'antd';
import { RobotOutlined, EyeOutlined, EditOutlined, InfoCircleOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../services/api/settings';

const { Text } = Typography;

const AssistantSettings = ({
  color,
  modelConfigs,
  defaultModels,
  handleOpenPromptTemplateModal,
  initialValues
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        enable_assistant_generation: initialValues.enable_assistant_generation !== undefined ? initialValues.enable_assistant_generation : true,
        assistant_generation_model: initialValues.assistant_generation_model || 'default'
      });
    }
  }, [initialValues, form]);

  const renderLabel = (icon, label, tooltip) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ color, marginRight: '8px', fontSize: '14px' }}>
        {icon}
      </span>
      <span style={{ fontSize: '14px', fontWeight: '500' }}>
        {label}
      </span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined
          style={{
            marginLeft: '6px',
            color: 'var(--custom-text-secondary)',
            fontSize: '12px'
          }}
        />
      </Tooltip>
    </div>
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 保存辅助生成相关的字段
      await settingsAPI.updateSettings({
        enable_assistant_generation: values.enable_assistant_generation,
        assistant_generation_model: values.assistant_generation_model
      });

      message.success(t('settings.saveSuccess'));
      setLoading(false);
    } catch (error) {
      console.error('Save assistant settings failed:', error);
      if (error.errorFields) {
        message.error(t('message.validationFailed'));
      } else {
        message.error(t('message.operationFailed') + ': ' + (error.message || t('message.unknownError')));
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (initialValues) {
      form.setFieldsValue({
        enable_assistant_generation: initialValues.enable_assistant_generation !== undefined ? initialValues.enable_assistant_generation : true,
        assistant_generation_model: initialValues.assistant_generation_model || 'default'
      });
      message.success(t('settings.resetSuccess'));
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Form.Item
          name="enable_assistant_generation"
          label={renderLabel(
            <RobotOutlined />,
            t('settings.enableAssistant'),
            t('settings.enableAssistant.tooltip')
          )}
          valuePropName="checked"
          style={{ marginBottom: '16px' }}
        >
          <Switch />
        </Form.Item>

        <div style={{ marginBottom: '16px' }}>
          <Button
            type="default"
            icon={<EditOutlined />}
            onClick={handleOpenPromptTemplateModal}
          >
            {t('settings.managePromptTemplates')}
          </Button>
        </div>

        <Form.Item
          name="assistant_generation_model"
          label={renderLabel(
            <EyeOutlined />,
            t('settings.assistantModel'),
            t('settings.assistantModel.tooltip')
          )}
          style={{ marginBottom: '16px' }}
        >
          <Select
            placeholder="选择辅助生成模型"
            allowClear
            showSearch
            filterOption={(input, option) =>
              option?.label?.toLowerCase().includes(input.toLowerCase())
            }
            options={[
              // 默认模型选项
              {
                value: 'default',
                label: `默认文本生成模型${defaultModels?.text_model ? ` (${defaultModels.text_model.name})` : ''}`,
                isDefault: true,
                model: defaultModels?.text_model
              },
              // 其他模型选项
              ...(modelConfigs && modelConfigs.length > 0 ?
                modelConfigs.map(config => ({
                  value: config.id.toString(),
                  label: `${config.name} (${config.provider})`,
                  isDefault: false,
                  model: config
                })) : [
                  // 加载状态或模拟数据
                  {
                    value: 'loading',
                    label: '加载中...',
                    isDefault: false,
                    model: null,
                    disabled: true
                  }
                ]
              )
            ]}
            optionRender={(option) => {
              if (option.data.disabled) {
                return <span>加载中...</span>;
              }

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
      </Space>

      <Divider />

      <Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={loading}
        >
          {t('settings.save')}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleReset}
        >
          {t('settings.reset')}
        </Button>
      </Space>
    </Form>
  );
};

export default AssistantSettings;

