import React from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  Typography,
  Tooltip
} from 'antd';
import {
  InfoCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * OnlyOffice 在线办公应用配置组件
 */
const OnlyOfficeApp = ({ appConfig = {}, onConfigChange, onClose }: any) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // 获取服务器配置 - appConfig 是完整的app对象，server在顶层
  const serverConfig = appConfig.server || {};

  // 初始化表单
  React.useEffect(() => {
    form.setFieldsValue({
      documentServerUrl: serverConfig.documentServerUrl || 'http://localhost:18080',
      backendBaseUrl: serverConfig.backendBaseUrl || 'http://host.docker.internal:8080',
      jwtSecret: serverConfig.jwtSecret || ''
    });
  }, [appConfig, form, serverConfig]);

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      
      // 构建正确的config对象结构（只包含config字段内容）
      const newConfig = {
        basic: appConfig.basic,
        server: {
          documentServerUrl: values.documentServerUrl,
          backendBaseUrl: values.backendBaseUrl,
          jwtSecret: values.jwtSecret || ''
        },
        launch: appConfig.launch,
        metadata: appConfig.metadata,
        stats: appConfig.stats
      };

      if (onConfigChange) {
        await onConfigChange(newConfig);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('onlyOffice.pageDesc')}
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveConfig}
      >
        <Form.Item
          name="documentServerUrl"
          label={
            <Space>
              <span>{t('onlyOffice.documentServerUrl')}</span>
              <Tooltip title={t('onlyOffice.documentServerUrlTooltip')}>
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>
          }
          rules={[
            { required: true, message: t('onlyOffice.documentServerUrlRequired') },
            { type: 'url', message: t('onlyOffice.urlInvalid') }
          ]}
        >
          <Input placeholder="http://localhost:18080" />
        </Form.Item>

        <Form.Item
          name="backendBaseUrl"
          label={
            <Space>
              <span>{t('onlyOffice.backendBaseUrl')}</span>
              <Tooltip title={t('onlyOffice.backendBaseUrlTooltip')}>
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>
          }
          rules={[
            { required: true, message: t('onlyOffice.backendBaseUrlRequired') },
            { type: 'url', message: t('onlyOffice.urlInvalid') }
          ]}
        >
          <Input placeholder="http://host.docker.internal:8080" />
        </Form.Item>

        <Form.Item
          name="jwtSecret"
          label={
            <Space>
              <span>{t('onlyOffice.jwtSecret')}</span>
              <Tooltip title={t('onlyOffice.jwtSecretTooltip')}>
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>
          }
        >
          <Input.Password placeholder={t('onlyOffice.jwtSecretPlaceholder')} />
        </Form.Item>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {onClose && (
              <Button onClick={onClose}>
                {t('onlyOffice.close')}
              </Button>
            )}
            <Button type="primary" htmlType="submit">
              {t('onlyOffice.saveConfig')}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default OnlyOfficeApp;
