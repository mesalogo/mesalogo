import React, { useState, useEffect } from 'react';
import { Form, Select, Switch, Button, Space, Tooltip, Tag, Divider, App, Typography } from 'antd';
import {
  ExperimentOutlined,
  RobotOutlined,
  EyeOutlined,
  EditOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../services/api/settings';
import {
  buildAssistantSettingsPayload,
  getAssistantSettingsFormValues
} from './assistantSettingsState';

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
  const assistantGenerationEnabled = Form.useWatch(
    'enable_assistant_generation',
    form
  );
  const protocolGenerationEnabled = Form.useWatch(
    'enable_experiment_protocol_generation',
    form
  );

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(getAssistantSettingsFormValues(initialValues));
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

  const modelOptions = [
    {
      value: 'default',
      label: t('assistantSettings.defaultTextModel', {
        suffix: defaultModels?.text_model
          ? ` (${defaultModels.text_model.name})`
          : ''
      }),
      isDefault: true,
      model: defaultModels?.text_model
    },
    ...(modelConfigs && modelConfigs.length > 0
      ? modelConfigs.map(config => ({
        value: config.id.toString(),
        label: `${config.name} (${config.provider})`,
        isDefault: false,
        model: config
      }))
      : [{
        value: 'loading',
        label: t('assistantSettings.loading'),
        isDefault: false,
        model: null,
        disabled: true
      }])
  ];

  const renderModelOption = (option) => {
    if (option.data.disabled) {
      return <span>{t('assistantSettings.loading')}</span>;
    }

    if (option.data.isDefault) {
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>
              {t('assistantSettings.defaultTextModelName')}
            </span>
            <Tag color="blue">{t('assistantSettings.defaultTag')}</Tag>
          </div>
          {option.data.model && (
            <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
              {option.data.model.provider} - {option.data.model.model_id}
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div style={{ fontWeight: 'bold' }}>{option.data.model.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
          {option.data.model.provider} - {option.data.model.model_id}
        </div>
      </div>
    );
  };

  const renderModelSelect = (placeholder, disabled = false) => (
    <Select
      placeholder={placeholder}
      disabled={disabled}
      allowClear
      showSearch
      filterOption={(input, option) =>
        option?.label?.toLowerCase().includes(input.toLowerCase())
      }
      options={modelOptions}
      optionRender={renderModelOption}
    />
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 保存辅助生成相关的字段
      await settingsAPI.updateSettings(buildAssistantSettingsPayload(values));

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
      form.setFieldsValue(getAssistantSettingsFormValues(initialValues));
      message.success(t('settings.resetSuccess'));
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>{t('assistantSettings.generalTitle')}</Text>
          <br />
          <Text type="secondary">
            {t('assistantSettings.generalDescription')}
          </Text>
        </div>

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
          {renderModelSelect(
            t('assistantSettings.selectModel'),
            !assistantGenerationEnabled
          )}
        </Form.Item>

        <Divider style={{ margin: '4px 0' }} />

        <div>
          <Space>
            <ExperimentOutlined style={{ color }} />
            <Text strong>{t('assistantSettings.experimentProtocolTitle')}</Text>
          </Space>
          <br />
          <Text type="secondary">
            {t('assistantSettings.experimentProtocolDescription')}
          </Text>
        </div>

        <Form.Item
          name="enable_experiment_protocol_generation"
          label={renderLabel(
            <RobotOutlined />,
            t('assistantSettings.enableExperimentProtocol'),
            t('assistantSettings.enableExperimentProtocol.tooltip')
          )}
          valuePropName="checked"
          style={{ marginBottom: '16px' }}
        >
          <Switch disabled={!assistantGenerationEnabled} />
        </Form.Item>

        <Form.Item
          name="experiment_protocol_model"
          label={renderLabel(
            <EyeOutlined />,
            t('assistantSettings.experimentProtocolModel'),
            t('assistantSettings.experimentProtocolModel.tooltip')
          )}
          style={{ marginBottom: '16px' }}
        >
          {renderModelSelect(
            t('assistantSettings.selectExperimentProtocolModel'),
            !assistantGenerationEnabled || !protocolGenerationEnabled
          )}
        </Form.Item>

        <Button
          type="default"
          icon={<EditOutlined />}
          onClick={handleOpenPromptTemplateModal}
          disabled={!assistantGenerationEnabled}
        >
          {t('assistantSettings.manageExperimentProtocolTemplate')}
        </Button>
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
