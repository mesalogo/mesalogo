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

const { Text } = Typography;

/**
 * VSCode Server 代码管理应用配置组件
 */
const VSCodeApp = ({ appConfig = {}, onConfigChange, onClose }: any) => {
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
      console.error('保存配置失败:', error);
    }
  };

  return (
    <div style={{ height: '100%' }}>
      <Card 
       
        title={
          <Space>
            <CodeOutlined />
            <span>VSCode Server - 代码管理配置</span>
            <Tooltip title="配置在线代码编辑器的访问地址，支持多种编程语言和版本控制">
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
          <Card title="启动配置">
            <Form.Item
              name="url"
              label="访问地址"
              rules={[{ required: true, message: '请输入访问地址' }]}
              tooltip="VSCode Server 的访问URL路径"
            >
              <Input placeholder="/vscode" />
            </Form.Item>
          </Card>

          <Divider />

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            {onClose && (
              <Button onClick={onClose}>
                关闭
              </Button>
            )}
            <Button type="primary" htmlType="submit">
              保存配置
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default VSCodeApp;
