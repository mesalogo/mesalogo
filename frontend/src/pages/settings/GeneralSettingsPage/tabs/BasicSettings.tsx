import React, { useState, useEffect } from 'react';
import { Form, Select, Space, Tooltip, Button, Divider, App, InputNumber } from 'antd';
import { GlobalOutlined, InfoCircleOutlined, SaveOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../services/api/settings';

// 定义主要时区列表
const getTimezoneOptions = (t) => [
  { value: 'Asia/Shanghai', label: t ? t('timezone.asia.shanghai') : '亚洲/上海 (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: t ? t('timezone.asia.hongkong') : '亚洲/香港 (GMT+8)' },
  { value: 'Asia/Tokyo', label: t ? t('timezone.asia.tokyo') : '亚洲/东京 (GMT+9)' },
  { value: 'Asia/Singapore', label: t ? t('timezone.asia.singapore') : '亚洲/新加坡 (GMT+8)' },
  { value: 'Europe/London', label: t ? t('timezone.europe.london') : '欧洲/伦敦 (GMT+0/+1)' },
  { value: 'Europe/Paris', label: t ? t('timezone.europe.paris') : '欧洲/巴黎 (GMT+1/+2)' },
  { value: 'Europe/Berlin', label: t ? t('timezone.europe.berlin') : '欧洲/柏林 (GMT+1/+2)' },
  { value: 'America/New_York', label: t ? t('timezone.america.newyork') : '美洲/纽约 (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: t ? t('timezone.america.losangeles') : '美洲/洛杉矶 (GMT-8/-7)' },
  { value: 'America/Chicago', label: t ? t('timezone.america.chicago') : '美洲/芝加哥 (GMT-6/-5)' },
  { value: 'Australia/Sydney', label: t ? t('timezone.australia.sydney') : '澳洲/悉尼 (GMT+10/+11)' },
  { value: 'Pacific/Auckland', label: t ? t('timezone.pacific.auckland') : '太平洋/奥克兰 (GMT+12/+13)' },
  { value: 'UTC', label: t ? t('timezone.utc') : '协调世界时 (UTC)' }
];

// 定义平台语言选项
const getLanguageOptions = (t) => [
  { value: 'zh-CN', label: t ? t('language.chinese') : '中文 (简体)', flag: '🇨🇳' },
  { value: 'en-US', label: t ? t('language.english') : 'English', flag: '🇺🇸' }
];

const BasicSettings = ({ color, initialValues }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        platform_language: initialValues.platform_language || 'zh-CN',
        timezone: initialValues.timezone || 'Asia/Shanghai',
        job_manager_max_workers: initialValues.job_manager_max_workers || 10
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

      // 只保存基本设置相关的字段
      await settingsAPI.updateSettings({
        platform_language: values.platform_language,
        timezone: values.timezone,
        job_manager_max_workers: values.job_manager_max_workers
      });

      message.success(t('settings.saveSuccess'));
      setLoading(false);
    } catch (error) {
      console.error('Save basic settings failed:', error);
      if (error.errorFields) {
        // 表单验证错误
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
        platform_language: initialValues.platform_language || 'zh-CN',
        timezone: initialValues.timezone || 'Asia/Shanghai',
        job_manager_max_workers: initialValues.job_manager_max_workers || 10
      });
      message.success(t('settings.resetSuccess'));
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <Form.Item
        name="platform_language"
        label={renderLabel(
          <GlobalOutlined />,
          t('settings.platformLanguage'),
          t('settings.platformLanguage.tooltip')
        )}
        rules={[{ required: true, message: t('validation.required', { field: t('settings.platformLanguage') }) }]}
        style={{ marginBottom: '16px' }}
      >
        <Select
          placeholder={t('settings.platformLanguage')}

        >
          {getLanguageOptions(t).map((option: any) => (
            <Select.Option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              <Space>
                <span role="img" aria-label={option.label}>{option.flag}</span>
                <span>{option.label}</span>
              </Space>
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="timezone"
        label={renderLabel(
          <GlobalOutlined />,
          t('settings.timezone'),
          t('settings.timezone.tooltip')
        )}
        rules={[{ required: true, message: t('validation.required', { field: t('settings.timezone') }) }]}
        style={{ marginBottom: '16px' }}
      >
        <Select
          showSearch
          placeholder={t('settings.timezone')}
          optionFilterProp="label"
          filterOption={(input, option) =>
            option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
          options={getTimezoneOptions(t)}

        />
      </Form.Item>

      <Form.Item
        name="job_manager_max_workers"
        label={renderLabel(
          <ThunderboltOutlined />,
          t('settings.maxWorkers'),
          t('settings.maxWorkers.tooltip')
        )}
        rules={[
          { required: true, message: t('validation.required', { field: t('settings.maxWorkers') }) },
          { type: 'number', min: 1, max: 50, message: t('settings.maxWorkers.range') }
        ]}
        style={{ marginBottom: '16px' }}
      >
        <InputNumber
          min={1}
          max={50}
          placeholder="10"
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

export default BasicSettings;

