import React, { useState, useEffect } from 'react';
import { Form, InputNumber, Space, Tooltip, Button, Divider, App } from 'antd';
import {
  ClockCircleOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../services/api/settings';

const TimeoutSettings = ({ color, initialValues }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        http_connection_timeout: initialValues.http_connection_timeout || 30,
        http_read_timeout: initialValues.http_read_timeout || 300,
        stream_socket_timeout: initialValues.stream_socket_timeout || 60,
        default_model_timeout: initialValues.default_model_timeout || 60
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

      // 只保存超时配置相关的字段
      await settingsAPI.updateSettings({
        http_connection_timeout: values.http_connection_timeout,
        http_read_timeout: values.http_read_timeout,
        stream_socket_timeout: values.stream_socket_timeout,
        default_model_timeout: values.default_model_timeout
      });

      message.success(t('settings.saveSuccess'));
      setLoading(false);
    } catch (error) {
      console.error('Save timeout settings failed:', error);
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
        http_connection_timeout: initialValues.http_connection_timeout || 30,
        http_read_timeout: initialValues.http_read_timeout || 300,
        stream_socket_timeout: initialValues.stream_socket_timeout || 60,
        default_model_timeout: initialValues.default_model_timeout || 60
      });
      message.success(t('settings.resetSuccess'));
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <Form.Item
        name="http_connection_timeout"
        label={renderLabel(
          <ClockCircleOutlined />,
          t('settings.httpConnectionTimeout'),
          t('settings.httpConnectionTimeout.tooltip')
        )}
        rules={[{ required: true, message: `请输入${t('settings.httpConnectionTimeout')}` }]}
        style={{ marginBottom: '16px' }}
      >
        <InputNumber
          min={5}
          max={120}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="http_read_timeout"
        label={renderLabel(
          <ClockCircleOutlined />,
          t('settings.httpReadTimeout'),
          t('settings.httpReadTimeout.tooltip')
        )}
        rules={[{ required: true, message: `请输入${t('settings.httpReadTimeout')}` }]}
        style={{ marginBottom: '16px' }}
      >
        <InputNumber
          min={30}
          max={600}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="stream_socket_timeout"
        label={renderLabel(
          <ThunderboltOutlined />,
          t('settings.streamSocketTimeout'),
          t('settings.streamSocketTimeout.tooltip')
        )}
        rules={[{ required: true, message: `请输入${t('settings.streamSocketTimeout')}` }]}
        style={{ marginBottom: '16px' }}
      >
        <InputNumber
          min={10}
          max={300}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="default_model_timeout"
        label={renderLabel(
          <FieldTimeOutlined />,
          t('settings.defaultModelTimeout'),
          t('settings.defaultModelTimeout.tooltip')
        )}
        rules={[{ required: true, message: `请输入${t('settings.defaultModelTimeout')}` }]}
        style={{ marginBottom: '16px' }}
      >
        <InputNumber
          min={10}
          max={300}
          style={{ width: '100%' }}
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

export default TimeoutSettings;

