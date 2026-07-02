import React from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Tooltip,
  Divider
} from 'antd';
import {
  CodeOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * VSCode Server 代码管理应用配置组件
 */
const VSCodeApp = ({ appConfig = {}, onConfigChange, onClose }: any) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // 获取启动配置
  const launchConfig = appConfig.launch || appConfig.config?.launch || {};

  // 初始化表单
  React.useEffect(() => {
    form.setFieldsValue({
      url: launchConfig.url || '/vscode'
    });
  }, [appConfig, form, launchConfig]);

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      
      const newConfig = {
        ...appConfig,
        launch: {
          ...launchConfig,
          url: values.url
        }
      };

      if (onConfigChange) {
        await onConfigChange(newConfig);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  return (
    <div style={{ height: '100%' }}>
      <Card 
       
        title={
          <Space>
            <CodeOutlined />
            <span>{t('vscodeApp.title')}</span>
            <Tooltip title={t('vscodeApp.titleTooltip')}>
              <InfoCircleOutlined style={{ color: '#1677ff', cursor: 'pointer' }} />
            </Tooltip>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveConfig}
        >
          <Card title={t('vscodeApp.launchConfig')}>
            <Form.Item
              name="url"
              label={t('vscodeApp.accessUrl')}
              rules={[{ required: true, message: t('vscodeApp.accessUrlRequired') }]}
              tooltip={t('vscodeApp.accessUrlTooltip')}
            >
              <Input placeholder="/vscode" />
            </Form.Item>
          </Card>

          <Divider />

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            {onClose && (
              <Button onClick={onClose}>
                {t('vscodeApp.close')}
              </Button>
            )}
            <Button type="primary" htmlType="submit">
              {t('vscodeApp.saveConfig')}
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default VSCodeApp;
