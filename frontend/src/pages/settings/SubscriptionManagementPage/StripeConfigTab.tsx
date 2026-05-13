import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Switch,
  Radio,
  Button,
  Space,
  Typography,
  Alert,
  App,
  Tooltip
} from 'antd';
import {
  SaveOutlined,
  ApiOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { subscriptionAPI, StripeConfig } from '../../../services/api/subscription';

const { Text } = Typography;

const StripeConfigTab = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // Webhook URL 应该指向后端 API 地址，生产环境通常是同一域名
  // 开发环境下后端默认运行在 8080 端口
  const getWebhookUrl = () => {
    const origin = window.location.origin;
    // 如果是开发环境（前端 3000 端口），替换为后端 8080 端口
    if (origin.includes(':3000')) {
      return origin.replace(':3000', ':8080') + '/api/webhooks/stripe';
    }
    // 生产环境通常前后端同域，直接使用 /api 路径
    return origin + '/api/webhooks/stripe';
  };
  const webhookUrl = getWebhookUrl();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await subscriptionAPI.adminGetStripeConfig(true);
      if (res.success && res.data?.config) {
        form.setFieldsValue(res.data.config);
      }
    } catch (error) {
      console.error('Failed to fetch Stripe config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const res = await subscriptionAPI.adminUpdateStripeConfig(values);
      if (res.success) {
        message.success(t('subscription.stripe.saveSuccess'));
        if (res.data?.config) {
          form.setFieldsValue(res.data.config);
        }
      } else {
        message.error(res.message || t('subscription.stripe.saveFailed'));
      }
    } catch (error) {
      console.error('Failed to save Stripe config:', error);
      message.error(t('subscription.stripe.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    try {
      const res = await subscriptionAPI.adminTestStripeConnection();
      if (res.success && res.data?.success) {
        message.success(t('subscription.stripe.testSuccess'));
      } else {
        message.error(res.data?.message || t('subscription.stripe.testFailed'));
      }
    } catch (error) {
      console.error('Faio test Stripe connection:', error);
      message.error(t('subscription.stripe.testFailed'));
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success(t('subscription.stripe.copied'));
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enabled: false,
          mode: 'test'
        }}
      >
        <Form.Item
          name="enabled"
          label={t('subscription.stripe.enabled')}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="mode"
          label={t('subscription.stripe.mode')}
        >
          <Radio.Group>
            <Radio value="test">{t('subscription.stripe.testMode')}</Radio>
            <Radio value="live">{t('subscription.stripe.liveMode')}</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="publishable_key"
          label={t('subscription.stripe.publishableKey')}
          tooltip={t('subscription.stripe.publishableKeyTip')}
        >
          <Input.Password placeholder="pk_test_xxx or pk_live_xxx" />
        </Form.Item>

        <Form.Item
          name="secret_key"
          label={t('subscription.stripe.secretKey')}
          tooltip={t('subscription.stripe.secretKeyTip')}
        >
          <Input.Password placeholder="sk_test_xxx or sk_live_xxx" />
        </Form.Item>

        <Form.Item
          name="webhook_secret"
          label={t('subscription.stripe.webhookSecret')}
          tooltip={t('subscription.stripe.webhookSecretTip')}
        >
          <Input.Password placeholder="whsec_xxx" />
        </Form.Item>

        <Form.Item
          label={t('subscription.stripe.webhookUrl')}
          tooltip={t('subscription.stripe.webhookUrlTip')}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="webhook_url" noStyle>
              <Input
                placeholder={webhookUrl}
                style={{ flex: 1 }}
              />
            </Form.Item>
            <Tooltip title={t('subscription.stripe.copy')}>
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  const url = form.getFieldValue('webhook_url') || webhookUrl;
                  copyToClipboard(url);
                }}
              />
            </Tooltip>
          </Space.Compact>
        </Form.Item>

        <Alert
          title={t('subscription.stripe.webhookTip')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              {t('subscription.stripe.save')}
            </Button>
            <Button
              icon={<ApiOutlined />}
              onClick={handleTestConnection}
              loading={testLoading}
            >
              {t('subscription.stripe.testConnection')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StripeConfigTab;
