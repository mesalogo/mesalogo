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

const { Text } = Typography;

/**
 * OnlyOffice 在线办公应用配置组件
 */
const OnlyOfficeApp = ({ appConfig = {}, onConfigChange, onClose }: any) => {
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
      console.error('保存配置失败:', error);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          配置文档服务器的连接参数，确保后端服务和文档服务器正常运行
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
              <span>文档服务器URL</span>
              <Tooltip title="OnlyOffice Document Server 的完整URL地址，例如 http://localhost:18080">
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>
          }
          rules={[
            { required: true, message: '请输入文档服务器URL' },
            { type: 'url', message: '请输入有效的URL' }
          ]}
        >
          <Input placeholder="http://localhost:18080" />
        </Form.Item>

        <Form.Item
          name="backendBaseUrl"
          label={
            <Space>
              <span>后端基础URL</span>
              <Tooltip title="后端服务的基础URL，用于文档回调。Docker环境下通常使用 host.docker.internal">
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>
          }
          rules={[
            { required: true, message: '请输入后端基础URL' },
            { type: 'url', message: '请输入有效的URL' }
          ]}
        >
          <Input placeholder="http://host.docker.internal:8080" />
        </Form.Item>

        <Form.Item
          name="jwtSecret"
          label={
            <Space>
              <span>JWT Secret（选填）</span>
              <Tooltip title="用于文档服务器和后端之间的安全通信，如果文档服务器未启用JWT验证可留空">
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>
          }
        >
          <Input.Password placeholder="输入JWT密钥（可选）" />
        </Form.Item>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {onClose && (
              <Button onClick={onClose}>
                关闭
              </Button>
            )}
            <Button type="primary" htmlType="submit">
              保存配置
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default OnlyOfficeApp;
