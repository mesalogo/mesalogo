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
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Next RPA — MCP desktop-automation app config component.
 */
const NextRPAApp = ({ appConfig = {}, onConfigChange, onClose }: any) => {
  const { t } = useTranslation();
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
        message.success(t('nextRPA.msg.testSuccess'));
      } else {
        setConnectionStatus('error');
        message.error(t('nextRPA.msg.testFailedConfig'));
      }
    } catch (error: any) {
      setConnectionStatus('error');
      message.error(t('nextRPA.msg.testFailed') + ': ' + error.message);
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
      
      message.success(t('nextRPA.msg.saveSuccess'));
    } catch (error: any) {
      message.error(t('nextRPA.msg.saveFailed') + ': ' + error.message);
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge status="success" text={t('nextRPA.status.connected')} />;
      case 'disconnected':
        return <Badge status="default" text={t('nextRPA.status.disconnected')} />;
      case 'error':
        return <Badge status="error" text={t('nextRPA.status.failed')} />;
      default:
        return <Badge status="default" text={t('nextRPA.status.unknown')} />;
    }
  };

  const tabItems = [
    {
      key: 'connection',
      label: (
        <span>
          <LinkOutlined /> {t('nextRPA.tab.connection')}
        </span>
      ),
      children: (
        <>
          <Title level={5}>{t('nextRPA.section.connectionMode')}</Title>
          <Form.Item
            name="vncWebProxyUrl"
            label={t('nextRPA.field.vncWebProxyUrl')}
            tooltip={t('nextRPA.tip.vncWebProxyUrl')}
          >
            <Input placeholder="https://your-domain.com/websockify" />
          </Form.Item>

          <Form.Item
            name="connectionMode"
            label={t('nextRPA.field.connectionMode')}
            rules={[{ required: true, message: t('nextRPA.req.connectionMode') }]}
          >
            <Select onChange={handleConnectionModeChange}>
              <Option value="local">
                <Space>
                  <DesktopOutlined />
                  {t('nextRPA.mode.local')}
                </Space>
              </Option>
              <Option value="cloud">
                <Space>
                  <CloudServerOutlined />
                  {t('nextRPA.mode.cloud')}
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
                    <Title level={5}>{t('nextRPA.section.hostConfig')}</Title>
                    <Form.Item
                      name="sseUrl"
                      label={t('nextRPA.field.sseUrl')}
                      rules={[
                        { required: true, message: t('nextRPA.req.sseUrl') },
                        { type: 'url', message: t('nextRPA.req.urlValid') }
                      ]}
                      tooltip={t('nextRPA.tip.sseUrl')}
                    >
                      <Input placeholder="http://192.168.1.100:3232/mcp" />
                    </Form.Item>

                    <Form.Item
                      name="vncUrl"
                      label={t('nextRPA.field.vncUrl')}
                      tooltip={t('nextRPA.tip.vncUrl')}
                    >
                      <Input placeholder="ws://192.168.1.100:5900" />
                    </Form.Item>

                    <Form.Item
                      name="vncPassword"
                      label={t('nextRPA.field.vncPassword')}
                      tooltip={t('nextRPA.tip.vncPassword')}
                    >
                      <Input.Password placeholder={t('nextRPA.ph.vncPassword')} />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type="primary"
                        onClick={handleTestConnection}
                        loading={testingConnection}
                        icon={testingConnection ? <SyncOutlined spin /> : <LinkOutlined />}
                      >
                        {t('nextRPA.testConnection')}
                      </Button>
                    </Form.Item>
                  </>
                );
              } else if (mode === 'cloud') {
                return (
                  <>
                    <Divider />
                    <Title level={5}>{t('nextRPA.section.cloudConfig')}</Title>
                    <Form.Item
                      name="cloudVendor"
                      label={t('nextRPA.field.cloudVendor')}
                      rules={[{ required: true, message: t('nextRPA.req.cloudVendor') }]}
                      tooltip={t('nextRPA.tip.cloudVendor')}
                    >
                      <Select placeholder={t('nextRPA.ph.cloudVendor')}>
                        <Option value="aws">AWS (Amazon Web Services)</Option>
                        <Option value="azure">Microsoft Azure</Option>
                        <Option value="gcp">Google Cloud Platform</Option>
                        <Option value="vmware-vsphere">{t('nextRPA.cloud.vmware')}</Option>
                        <Option value="zstack">{t('nextRPA.cloud.zstack')}</Option>
                        <Option value="other">{t('nextRPA.cloud.other')}</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="cloudApiKey"
                      label="API Key"
                      rules={[{ required: true, message: t('nextRPA.req.cloudApiKey') }]}
                    >
                      <Input.Password placeholder={t('nextRPA.ph.cloudApiKey')} />
                    </Form.Item>

                    <Form.Item
                      name="cloudEndpoint"
                      label={t('nextRPA.field.cloudEndpoint')}
                      rules={[{ type: 'url', message: t('nextRPA.req.urlValid') }]}
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
          <Title level={5}>{t('nextRPA.section.transport')}</Title>
          <Form.Item name="transportType" label={t('nextRPA.field.transportType')}>
            <Select>
              <Option value="sse">SSE (Server-Sent Events)</Option>
              <Option value="stdio">{t('nextRPA.transport.stdio')}</Option>
            </Select>
          </Form.Item>
        </>
      )
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyOutlined /> {t('nextRPA.tab.security')}
        </span>
      ),
      children: (
        <>
          <Title level={5}>{t('nextRPA.section.httpsConfig')}</Title>
          <Alert
            message={t('nextRPA.alert.remoteDeployTitle')}
            description={t('nextRPA.alert.remoteDeployDesc')}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item name="enableHttps" label={t('nextRPA.field.enableHttps')} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.enableHttps !== curr.enableHttps}>
            {({ getFieldValue }) =>
              getFieldValue('enableHttps') ? (
                <>
                  <Form.Item name="certPath" label={t('nextRPA.field.certPath')} tooltip={t('nextRPA.tip.certPath')}>
                    <Input placeholder="/path/to/cert.pem" />
                  </Form.Item>
                  <Form.Item name="keyPath" label={t('nextRPA.field.keyPath')} tooltip={t('nextRPA.tip.keyPath')}>
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
          <SettingOutlined /> {t('nextRPA.tab.provider')}
        </span>
      ),
      children: (
        <>
          <Title level={5}>{t('nextRPA.section.automationBackend')}</Title>
          <Alert
            message={t('nextRPA.alert.providerTitle')}
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li><strong>keysender</strong>: {t('nextRPA.providerDesc.keysender')}</li>
                <li><strong>powershell</strong>: {t('nextRPA.providerDesc.powershell')}</li>
                <li><strong>autohotkey</strong>: {t('nextRPA.providerDesc.autohotkey')}</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item name="globalProvider" label={t('nextRPA.field.globalProvider')} tooltip={t('nextRPA.tip.globalProvider')}>
            <Select>
              <Option value="keysender">{t('nextRPA.opt.keysenderRecommended')}</Option>
              <Option value="powershell">powershell</Option>
              <Option value="autohotkey">autohotkey</Option>
            </Select>
          </Form.Item>

          <Divider>{t('nextRPA.section.modularConfig')}</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="keyboardProvider" label={t('nextRPA.field.keyboard')} tooltip={t('nextRPA.tip.moduleProvider')}>
                <Select allowClear placeholder={t('nextRPA.ph.useGlobal')}>
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mouseProvider" label={t('nextRPA.field.mouse')} tooltip={t('nextRPA.tip.moduleProvider')}>
                <Select allowClear placeholder={t('nextRPA.ph.useGlobal')}>
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="screenProvider" label={t('nextRPA.field.screen')} tooltip={t('nextRPA.tip.moduleProvider')}>
                <Select allowClear placeholder={t('nextRPA.ph.useGlobal')}>
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="clipboardProvider" label={t('nextRPA.field.clipboard')} tooltip={t('nextRPA.tip.moduleProvider')}>
                <Select allowClear placeholder={t('nextRPA.ph.useGlobal')}>
                  <Option value="keysender">keysender</Option>
                  <Option value="powershell">powershell</Option>
                  <Option value="autohotkey">autohotkey</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="autohotkeyPath" label={t('nextRPA.field.autohotkeyPath')} tooltip={t('nextRPA.tip.autohotkeyPath')}>
            <Input placeholder="C:\Program Files\AutoHotkey\v2\AutoHotkey.exe" />
          </Form.Item>
        </>
      )
    },
    {
      key: 'runtime',
      label: (
        <span>
          <SettingOutlined /> {t('nextRPA.tab.runtime')}
        </span>
      ),
      children: (
        <>
          <Title level={5}>{t('nextRPA.section.runtimeParams')}</Title>
          <Form.Item name="screenshotQuality" label={t('nextRPA.field.screenshotQuality')} tooltip={t('nextRPA.tip.screenshotQuality')}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="operationTimeout" label={t('nextRPA.field.operationTimeout')} tooltip={t('nextRPA.tip.operationTimeout')}>
            <InputNumber min={1} max={300} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enableClipboard" label={t('nextRPA.field.enableClipboard')} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="logLevel" label={t('nextRPA.field.logLevel')}>
            <Select>
              <Option value="debug">{t('nextRPA.log.debug')}</Option>
              <Option value="info">{t('nextRPA.log.info')}</Option>
              <Option value="warning">{t('nextRPA.log.warning')}</Option>
              <Option value="error">{t('nextRPA.log.error')}</Option>
            </Select>
          </Form.Item>
        </>
      )
    },
    {
      key: 'environment',
      label: (
        <span>
          <InfoCircleOutlined /> {t('nextRPA.tab.environment')}
        </span>
      ),
      children: (
        <>
          <Title level={5}>{t('nextRPA.section.bestPractices')}</Title>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('nextRPA.env.resolutionLabel')}>
              <Tag color="blue">1280x720</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>{t('nextRPA.env.resolutionDesc')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('nextRPA.env.vmLabel')}>
              <Tag color="green">{t('nextRPA.env.recommended')}</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>{t('nextRPA.env.vmDesc')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('nextRPA.env.screensLabel')}>
              <Tag color="orange">{t('nextRPA.env.singleScreen')}</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>{t('nextRPA.env.screensDesc')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('nextRPA.env.osLabel')}>
              <Tag color="red">Windows Only</Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>{t('nextRPA.env.osDesc')}</Text>
            </Descriptions.Item>
          </Descriptions>

          <Divider />
          <Title level={5}>{t('nextRPA.section.systemRequirements')}</Title>
          <Alert
            message={t('nextRPA.alert.depsTitle')}
            description={
              <ul style={{ margin: 8, paddingLeft: 20 }}>
                <li>Windows OS</li>
                <li>{t('nextRPA.dep.nodejs')}</li>
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
        message={t('nextRPA.headerAlert')}
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
          {onClose && <Button onClick={onClose}>{t('nextRPA.close')}</Button>}
          <Button type="primary" htmlType="submit">{t('nextRPA.saveConfig')}</Button>
        </Space>
      </Form>
    </div>
  );
};

export default NextRPAApp;
