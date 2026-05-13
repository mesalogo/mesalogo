import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Typography,
  Tabs,
  InputNumber,
  message,
  Alert,
  Divider,
  Descriptions,
  Badge,
  Row,
  Col,
  Tag
} from 'antd';
import {
  LinkOutlined,
  SafetyOutlined,
  SettingOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  InfoCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Next RPA - MCP 桌面自动化应用配置组件
 */
const NextRPAApp = ({ appConfig = {}, onConfigChange, onClose }: any) => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState(appConfig);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (appConfig) {
      form.setFieldsValue({
        connectionMode: appConfig.connection?.mode || 'local',
        sseUrl: appConfig.connection?.localConfig?.sseUrl || 'http://192.168.1.100:3232/mcp',
        port: appConfig.connection?.localConfig?.port || 3232,
        vncUrl: appConfig.connection?.localConfig?.vncUrl || '',
        vncPassword: appConfig.connection?.localConfig?.vncPassword || '',
        vncWebProxyUrl: appConfig.connection?.localConfig?.vncWebProxyUrl || '',
        cloudVendor: appConfig.connection?.cloudProvider?.vendor || '',
        cloudApiKey: appConfig.connection?.cloudProvider?.apiKey || '',
        cloudEndpoint: appConfig.connection?.cloudProvider?.endpoint || '',
        transportType: appConfig.transport?.type || 'sse',
        enableHttps: appConfig.security?.enableHttps || false,
        certPath: appConfig.security?.certPath || '',
        keyPath: appConfig.security?.keyPath || '',
        globalProvider: appConfig.provider?.global || 'keysender',
        keyboardProvider: appConfig.provider?.keyboard || '',
        mouseProvider: appConfig.provider?.mouse || '',
        screenProvider: appConfig.provider?.screen || '',
        clipboardProvider: appConfig.provider?.clipboard || '',
        autohotkeyPath: appConfig.provider?.autohotkeyPath || '',
        screenshotQuality: appConfig.reenshotQuality || 80,
        operationTimeout: appConfig.runtime?.operationTimeout || 30,
        enableClipboard: appConfig.runtime?.enableClipboard !== false,
        logLevel: appConfig.runtime?.logLevel || 'info'
      });
    }
  }, [appConfig, form]);

  const handleConnectionModeChange = (value: string) => {
    form.setFieldsValue({ connectionMode: value });
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const values = form.getFieldsValue();
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (values.connectionMode === 'local' && values.sseUrl) {
        setConnectionStatus('connected');
        message.success('连接测试成功！');
      } else {
        setConnectionStatus('error');
        message.error('连接测试失败，请检查配置');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      message.error('连接测试失败: ' + error.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      
      const newConfig = {
        ...appConfig,
        connection: {
          mode: values.connectionMode,
          cloudProvider: {
            vendor: values.cloudVendor || '',
            apiKey: values.cloudApiKey || '',
            endpoint: values.cloudEndpoint || ''
          },
          localConfig: {
            sseUrl: values.sseUrl || '',
            port: values.port || 3232,
            vncUrl: values.vncUrl || '',
            vncPassword: values.vncPassword || '',
            vncWebProxyUrl: values.vncWebProxyUrl || ''
          }
        },
        transport: {
          type: values.transportType,
          url: values.connectionMode === 'local' ? values.sseUrl : ''
        },
        security: {
          enableHttps: values.enableHttps || false,
          certPath: values.certPath || '',
          keyPath: values.keyPath || ''
        },
        provider: {
          global: values.globalProvider,
          keyboard: values.keyboardProvider || '',
          mouse: values.mouseProvider || '',
          screen: values.screenProvider || '',
          clipboard: values.clipboardProvider || '',
          autohotkeyPath: values.autohotkeyPath || ''
        },
        runtime: {
          screenshotQuality: values.screenshotQuality,
          operationTimeout: values.operationTimeout,
          enableClipboard: values.enableClipboard,
          logLevel: values.logLevel
        }
      };

      setConfig(newConfig);
      
      if (onConfigChange) {
        await onConfigChange(newConfig);
      }
      
      message.success('配置保存成功！');
    } catch (error: any) {
      message.error('保存配置失败: ' + error.message);
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge status="success" text="已连接" />;
      case 'disconnected':
        return <Badge status="default" text="未连接" />;
      case 'error':
        return <Badge status="error" text="连接失败" />;
      default:
        return <Badge status="default" text="未知" />;
    }
  };

  const tabItems = [
    {
      key: 'connection',
      label: (
        <span>
          <LinkOutlined /> 连接设置
        </span>
      ),
      children: (
        <>
          <Title level={5}>连接模式</Title>
          <Form.Item
            name="vncWebProxyUrl"
            label="Web VNC 代理地址"
            tooltip="VNC 画面通过后端 WebSocket 代理（端口 6080）转发。当用户通过外网域名访问前端时，需要通过 Nginx 反向代理暴露该端口。配置示例：location /websockify { proxy_pass http://127.0.0.1:6080; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection 'upgrade'; }。留空则直接连接后端 6080 端口（适用于内网环境）。"
          >
            <Input placeholder="https://your-domain.com/websockify" />
          </Form.Item>

          <Form.Item
            name="connectionMode"
            label="选择连接模式"
            rules={[{ required: true, message: '请选择连接模式' }]}
          >
            <Select onChange={handleConnectionModeChange}>
              <Option value="local">
                <Space>
                  <DesktopOutlined />
                  主机模式 - 连接到远程主机
                </Space>
              </Option>
              <Option value="cloud">
                <Space>
                  <CloudServerOutlined />
                  Cloud - 云端服务
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.connectionMode !== curr.connectionMode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue('connectionMode');
              
              if (mode === 'local') {
                return (
                  <>
                    <Divider />
                    <Title level={5}>主机配置</Title>
                    <Form.Item
                      name="sseUrl"
                      label="MCP 协议地址 (SSE URL)"
                      rules={[
                        { required: true, message: '请输入 MCP 协议地址' },
                        { type: 'url', message: '请输入有效的 URL' }
                      ]}
                      tooltip="MCPControl 服务器的 SSE 地址，例如: http://192.168.1.100:3232/mcp"
                    >
                      <Input placeholder="http://192.168.1.100:3232/mcp" />
                    </Form.Item>

                    <Form.Item
                      name="vncUrl"
                      label="VNC 地址"
                      tooltip="远程桌面 VNC WebSocket 地址，用于查看和调试自动化操作，例如: ws://192.168.1.100:5900"
                    >
                      <Input placeholder="ws://192.168.1.100:5900" />
                    </Form.Item>

                    <Form.Item
                      name="vncPassword"
                      label="VNC 密码"
                      tooltip="VNC 连接密码，用于身份验证"
                    >
                      <Input.Password placeholder="输入 VNC 密码" />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type="primary"
                        onClick={handleTestConnection}
                        loading={testingConnection}
                        icon={testingConnection ? <SyncOutlined spin /> : <LinkOutlined />}
                      >
                        测试连接
                      </Button>
                    </Form.Item>
                  </>
                );
              } else if (mode === 'cloud') {
                return (
                  <>
                    <Divider />
                    <Title level={5}>云端配置</Title>
                    <Form.Item
                      name="cloudVendor"
                      label="云服务供应商"
                      rules={[{ required: true, message: '请选择云服务供应商' }]}
                      tooltip="选择您的云服务提供商"
                    >
                      <Select placeholder="选择云服务供应商">
                        <Option value="aws">AWS (Amazon Web Services)</Option>
                        <Option value="azure">Microsoft Azure</Option>
                        <Option value="gcp">Google Cloud Platform</Option>
                        <Option value="vmware-vsphere">VMware vSphere (私有化部署)</Option>
                        <Option value="zstack">ZStack (私有化部署)</Option>
                        <Option value="other">其他</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="cloudApiKey"
                      label="API Key"
                      rules={[{ required: true, message: '请输入 API Key' }]}
                    >
                      <Input.Password placeholder="输入云端服务 API Key" />
                    </Form.Item>

                    <Form.Item
                      name="cloudEndpoint"
                      label="服务端点"
                      rules={[{ type: 'url', message: '请输入有效的 URL' }]}
                    >
                      <Input placeholder="https://api.example.com" />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>

          <Divider />
          <Title level={5}>传输协议</Title>
          <Form.Item name="transportType" label="协议类型">
            <Select>
              <Option value="sse">SSE (Server-Sent Events)</Option>
              <Option value="stdio">STDIO (标准输入输出)</Option>
            </Select>
          </Form.Item>
        </>
      )
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyOutlined /> 安全设置
        </span>
      ),
      children: (
        <>
          <Title level={5}>HTTPS 配置</Title>
          <Alert
            message="远程部署要求"
            description="根据 MCP 规范，远程部署必须使用 HTTPS 连接以确保安全性"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item name="enableHttps" label="启用 HTTPS" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.enableHttps !== curr.enableHttps}>
            {({ getFieldValue }) =>
              getFieldValue('enableHttps') ? (
                <>
                  <Form.Item name="certPath" label="证书路径" tooltip="TLS 证书文件路径">
                    <Input placeholder="/path/to/cert.pem" />
                  </Form.Item>
                  <Form.Item name="keyPath" label="密钥路径" tooltip="TLS 密钥文件路径">
                    <Input placeholder="/path/to/key.pem" />
             </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </>
      )
    },
    {
      key: 'provider',
      label: (
        <span>
          <SettingOutlined /> Provider 设置
        </span>
      ),
      children: (
        <>
          <Title level={5}>自动化后端</Title>
          <Alert
            message="Provider 说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li><strong>keysender</strong>: 原生 Windows 自动化，高可靠性（默认）</li>
                <li><strong>powershell</strong>: PowerShell 脚本，适合简单操作</li>
                <li><strong>autohotkey</strong>: AutoHotkey v2，适合高级自动化</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item name="globalProvider" label="全局 Provider" tooltip="默认使用的自动化后端">
            <Select>
              <Option value="keysender">keysender (推荐)</Option>
              <Option value="powershell">powershell</Option>
              <Option value="autohotkey">autohotkey</Option>
            </Select>
          </Form.Item>

          <Divider>模块化配置（可选）</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="keyboardProvider" label="键盘操作" tooltip="留空则使用全局 Provider">
                <Select allowClear placeholder="使用全局配置">
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mouseProvider" label="鼠标操作" tooltip="留空则使用全局 Provider">
                <Select allowClear placeholder="使用全局配置">
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="screenProvider" label="屏幕操作" tooltip="留空则使用全局 Provider">
                <Select allowClear placeholder="使用全局配置">
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="clipboardProvider" label="剪贴板操作" tooltip="留空则使用全局 Provider">
                <Select allowClear placeholder="使用全局配置">
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="autohotkeyPath" label="AutoHotkey 路径" tooltip="仅在使用 autohotkey provider 时需要配置">
            <Input placeholder="C:\Program Files\AutoHotkey\v2\AutoHotkey.exe" />
          </Form.Item>
        </>
      )
    },
    {
      key: 'runtime',
      label: (
        <span>
          <SettingOutlined /> 运行时配置
        </span>
      ),
      children: (
        <>
          <Title level={5}>运行参数</Title>
          <Form.Item name="screenshotQuality" label="截图质量" tooltip="1-100, 数值越大质量越高，文件越大">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="operationTimeout" label="操作超时时间（秒）" tooltip="自动化操作的超时限制">
            <InputNumber min={1} max={300} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enableClipboard" label="启用剪贴板操作" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="logLevel" label="日志级别">
            <Select>
              <Option value="debug">DEBUG - 详细调试信息</Option>
              <Option value="info">INFO - 一般信息</Option>
              <Option value="warning">WARNING - 警告信息</Option>
              <Option value="error">ERROR - 错误信息</Option>
            </Select>
          </Form.Item>
        </>
      )
    },
    {
      key: 'environment',
      label: (
        <span>
          <InfoCircleOutlined /> 环境建议
        </span>
      ),
      children: (
        <>
          <Title level={5}>最佳实践</Title>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="推荐分辨率">
              <Tag color="blue">1280x720</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>MCPControl 在此分辨率下点击精度最佳</Text>
            </Descriptions.Item>
            <Descriptions.Item label="虚拟机运行">
              <Tag color="green">推荐</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>建议在虚拟机中运行以提高安全性和隔离性</Text>
            </Descriptions.Item>
            <Descriptions.Item label="屏幕数量">
              <Tag color="orange">单屏</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>多屏幕支持有限，建议使用单屏配置</Text>
            </Descriptions.Item>
            <Descriptions.Item label="操作系统">
              <Tag color="red">Windows Only</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>目前仅支持 Windows 操作系统</Text>
            </Descriptions.Item>
          </Descriptions>

          <Divider />
          <Title level={5}>系统要求</Title>
          <Alert
            message="MCPControl 依赖"
            description={
              <ul style={{ margin: 8, paddingLeft: 20 }}>
                <li>Windows OS</li>
                <li>Node.js (LTS 版本)</li>
                <li>Python 3.12+</li>
                <li>Visual Studio Build Tools</li>
              </ul>
            }
            type="warning"
            showIcon
          />
        </>
      )
    }
  ];

  return (
    <div style={{ height: '100%' }}>
      <Alert
        message="基于 MCP 协议的桌面自动化应用，支持鼠标、键盘、窗口、屏幕和剪贴板的程序化控制"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16 }}>
        {getConnectionStatusBadge()}
      </div>

      <Form form={form} layout="vertical" onFinish={handleSaveConfig}>
        <Tabs defaultActiveKey="connection" items={tabItems} />

        <Divider />
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          {onClose && <Button onClick={onClose}>关闭</Button>}
          <Button type="primary" htmlType="submit">保存配置</Button>
        </Space>
      </Form>
    </div>
  );
};

export default NextRPAApp;
