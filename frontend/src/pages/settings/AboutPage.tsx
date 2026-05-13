import React, { useState, useEffect } from 'react';
import { Card, Typography, Space, Tag, Spin, Alert, Button, Form, Input, Tabs, Upload, Modal, message, Row, Col, Progress, Statistic } from 'antd';
import { SafetyCertificateOutlined, KeyOutlined, UploadOutlined, CopyOutlined, RobotOutlined, AppstoreOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { licenseAPI } from '../../services/api/license';
import { agentAPI } from '../../services/api/agent';
import { roleAPI } from '../../services/api/role';
import { actionSpaceAPI } from '../../services/api/actionspace';
import packageJson from '../../../package.json';

// Feature color mapping
const featureColorMap = {
  'basic_agents': 'blue',
  'basic_roles': 'cyan',
  'basic_action_spaces': 'geekblue',
  'advanced_agents': 'purple',
  'advanced_roles': 'magenta',
  'knowledge_base': 'orange',
  'custom_tools': 'volcano',
  'advanced_analytics': 'gold',
  'unlimited_memory': 'lime'
};

// 计算许可证剩余天数
const calculateRemainingDays = (expiryDate: any) => {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// 获取许可证状态信息
const getLicenseStatus = (license, t) => {
  if (!license) return { status: 'error', text: t('about.notActivated'), color: '#ff4d4f' };
  if (license.is_expired) return { status: 'exception', text: t('about.expired'), color: '#ff4d4f' };
  const days = calculateRemainingDays(license.expiry_date);
  if (days === null) return { status: 'success', text: t('about.permanentValid'), color: '#52c41a' };
  if (days <= 30) return { status: 'warning', text: t('about.daysRemaining', { days }), color: '#faad14' };
  return { status: 'success', text: t('about.daysRemaining', { days }), color: '#52c41a' };
};

const { Title, Text, Paragraph } = Typography;

/**
 * 关于页面组件
 * 显示系统的基本信息、版本和版权声明
 */
const AboutPage = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [form] = Form.useForm();
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activationModalVisible, setActivationModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('key');
  const [fileList, setFileList] = useState([]);
  const [activating, setActivating] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [activationError, setActivationError] = useState(null);
  const [systemKey, setSystemKey] = useState('');
  const [loadingSystemKey, setLoadingSystemKey] = useState(false);
  const [showFullLicenseKey, setShowFullLicenseKey] = useState(false);
  const [resourceUsage, setResourceUsage] = useState({ agents: 0, actionSpaces: 0, roles: 0 });

  // Get feature info with translation
  const getFeatureInfo = (featureCode) => ({
    name: t(`about.feature.${featureCode}`, featureCode),
    color: featureColorMap[featureCode] || 'default'
  });

  const fetchLicense = async () => {
    setLoading(true);
    setError(null);
    try {
      const licenseData = await licenseAPI.getCurrentLicense();
      setLicense(licenseData);
    } catch (err) {
      console.error('Failed to fetch license:', err);
      if (err.response?.data?.code === 'LICENSE_EXPIRED') {
        try {
          const expiredLicense = await licenseAPI.getExpiredLicense();
          if (expiredLicense) {
            setLicense(expiredLicense);
            setError(t('about.error.licenseExpired'));
          } else {
            setError(t('about.error.cannotGetLicense'));
          }
        } catch (innerError) {
          console.error('Failed to fetch expired license:', innerError);
          if (innerError.isLicenseError && innerError.code === 'LICENSE_NOT_FOUND') {
            setError(t('about.error.notActivated'));
          } else {
            setError(t('about.error.cannotGetLicense'));
          }
        }
      } else if (err.response?.status === 404) {
        setError(t('about.error.notActivated'));
      } else {
        setError(t('about.error.cannotGetLicense'));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemKey = async () => {
    setLoadingSystemKey(true);
    try {
      const key = await licenseAPI.getSystemKey();
      setSystemKey(key);
    } catch (err) {
      console.error('Failed to fetch system key:', err);
      message.error(t('about.error.systemKeyFailed'));
      setSystemKey(t('about.error.cannotGetSystemKey'));
    } finally {
      setLoadingSystemKey(false);
    }
  };

  const fetchResourceUsage = async () => {
    try {
      const [agents, actionSpaces, roles] = await Promise.all([
        agentAPI.getAllActive().catch(() => []),
        actionSpaceAPI.getAll().catch(() => []),
        roleAPI.getAll().catch(() => [])
      ]);
      setResourceUsage({
        agents: Array.isArray(agents) ? agents.length : 0,
        actionSpaces: Array.isArray(actionSpaces) ? actionSpaces.length : 0,
        roles: Array.isArray(roles) ? roles.length : 0
      });
    } catch (err) {
      console.error('Failed to fetch resource usage:', err);
    }
  };

  useEffect(() => {
    fetchLicense();
    fetchResourceUsage();
  }, []);

  useEffect(() => {
    if (activationModalVisible) {
      fetchSystemKey();
    }
  }, [activationModalVisible]);

  const showActivationModal = () => {
    setActivationModalVisible(true);
    setActivationError(null);
    form.resetFields();
    setFileList([]);
  };

  const closeActivationModal = () => {
    setActivationModalVisible(false);
  };

  const handleActivate = async (values) => {
    setActivating(true);
    setActivationError(null);
    try {
      await licenseAPI.activateLicense(values.licenseKey);
      message.success(t('about.activationSuccess'));
      closeActivationModal();
      fetchLicense();
    } catch (err) {
      setActivationError(err.response?.data?.message || t('about.error.activationFailed'));
    } finally {
      setActivating(false);
    }
  };

  const handleFileActivate = async () => {
    if (fileList.length === 0) {
      message.error(t('about.error.uploadFileFirst'));
      return;
    }
    setFileUploading(true);
    setActivationError(null);
    try {
      const file = fileList[0].originFileObj;
      await licenseAPI.activateLicenseFile(file);
      message.success(t('about.activationSuccess'));
      closeActivationModal();
      fetchLicense();
    } catch (err) {
      setActivationError(err.response?.data?.message || t('about.error.fileActivationFailed'));
    } finally {
      setFileUploading(false);
    }
  };

  const beforeUpload = () => true;

  const handleFileChange = (info) => {
    let newFileList = [...info.fileList].slice(-1);
    newFileList = newFileList.map(file => {
      if (file.response) {
        file.url = file.response.url;
      }
      return file;
    });
    setFileList(newFileList);
  };

  const licenseStatus = getLicenseStatus(license, t);
  const remainingDays = license ? calculateRemainingDays(license.expiry_date) : null;
  const progressPercent = remainingDays !== null ? Math.min(100, Math.max(0, (remainingDays / 365) * 100)) : 100;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 8 }}>{t('about.title')}</Title>
        <Text type="secondary">{t('about.subtitle')}</Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* 系统信息卡片 */}
        <Col xs={24}>
          <Card title={t('about.systemInfo')} bordered={false}>
            <Space align="start" size="middle">
              <img src={isDark ? "/logo-white.png" : "/logo.png"} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
              <div>
                <Title level={3} style={{ margin: 0, color: '#1677ff' }}>{t('system.title')}</Title>
                <Text type="secondary">{t('system.version')}: v{packageJson.version}</Text>
                <Paragraph style={{ marginTop: 12, marginBottom: 8 }}>{t('system.description')}</Paragraph>
                <Text type="secondary">© 2025 MesaLogo. All Rights Reserved.</Text>
              </div>
            </Space>
          </Card>
        </Col>

        {/* 许可证状态卡片 */}
        <Col xs={24} lg={8}>
          <Card 
            title={<Space><SafetyCertificateOutlined />{t('about.licenseStatus')}</Space>} 
            bordered={false}
            extra={
              <Button
                type={license?.is_expired ? 'primary' : 'default'}
                danger={license?.is_expired}
                icon={<SafetyCertificateOutlined />}
                onClick={showActivationModal}
               
              >
                {license?.is_expired ? t('about.reactivate') : license ? t('about.update') : t('about.activate')}
              </Button>
            }
          >
            {loading ? (
              <Spin><div style={{ padding: 40 }} /></Spin>
            ) : error && !license ? (
              <Alert title={t('about.licenseLoadFailed')} description={error} type="error" showIcon />
            ) : license ? (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                {error && (
                  <Alert title={t('about.licenseExpiredWarning')} type="warning" showIcon banner />
                )}
                <Statistic
                  title={t('about.licenseType')}
                  value={String(t(`about.licenseType.${license.license_type}`, license.license_name || t('about.unknown')))}
                  styles={{ content: { color: license.license_type === 'enterprise' ? '#f50' : '#1677ff', fontSize: 18 } }}
                />
                <Statistic
                  title={t('about.licensee')}
                  value={license.customer_name || t('about.unknown')}
                  styles={{ content: { fontSize: 18 } }}
                />
                <div>
                  <Text type="secondary">{t('about.expiryDate')}</Text>
                  <Progress
                    percent={progressPercent}
                    status={licenseStatus.status === 'exception' ? 'exception' : licenseStatus.status === 'warning' ? 'active' : 'success'}
                    format={() => licenseStatus.text}
                    strokeColor={licenseStatus.color}
                  />
                </div>
              </Space>
            ) : (
              <Alert title={t('about.notActivated')} description={t('about.activateLicenseFirst')} type="warning" showIcon />
            )}
          </Card>
        </Col>

        {/* 资源使用情况卡片 */}
        <Col xs={24} lg={16}>
          <Card title={t('about.resourceUsage')} bordered={false} style={{ height: '100%' }}>
            {license ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title={t('about.agents')}
                    value={resourceUsage.agents}
                    suffix={`/ ${license.max_agents || '∞'}`}
                    prefix={<RobotOutlined style={{ color: '#1677ff' }} />}
                  />
                  {license.max_agents && (
                    <Progress 
                      percent={Math.round((resourceUsage.agents / license.max_agents) * 100)} 
                      
                      status={resourceUsage.agents >= license.max_agents ? 'exception' : 'active'}
                    />
                  )}
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title={t('about.actionSpaces')}
                    value={resourceUsage.actionSpaces}
                    suffix={`/ ${license.max_action_spaces || '∞'}`}
                    prefix={<AppstoreOutlined style={{ color: '#52c41a' }} />}
                  />
                  {license.max_action_spaces && (
                    <Progress 
                      percent={Math.round((resourceUsage.actionSpaces / license.max_action_spaces) * 100)} 
                     
                      status={resourceUsage.actionSpaces >= license.max_action_spaces ? 'exception' : 'active'}
                      strokeColor="#52c41a"
                    />
                  )}
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title={t('about.roles')}
                    value={resourceUsage.roles}
                    suffix={`/ ${license.max_roles || '∞'}`}
                    prefix={<TeamOutlined style={{ color: '#faad14' }} />}
                  />
                  {license.max_roles && (
                    <Progress 
                      percent={Math.round((resourceUsage.roles / license.max_roles) * 100)} 
                     
                      status={resourceUsage.roles >= license.max_roles ? 'exception' : 'active'}
                      strokeColor="#faad14"
                    />
                  )}
                </Col>
              </Row>
            ) : (
              <Text type="secondary">{t('about.activateLicenseFirst')}</Text>
            )}
          </Card>
        </Col>

        {/* 功能列表卡片 */}
        {license && license.features && license.features.length > 0 && (
          <Col xs={24}>
            <Card title={t('about.authorizedFeatures')} bordered={false}>
              <Space size={[8, 8]} wrap>
                {license.features.map((feature: any, index: number) => {
                  const info = getFeatureInfo(feature);
                  return (
                    <Tag key={index} color={info.color} icon={<CheckCircleOutlined />}>
                      {String(info.name)}
                    </Tag>
                  );
                })}
              </Space>
            </Card>
          </Col>
        )}

        {/* 许可证详情卡片 */}
        {license && (
          <Col xs={24}>
            <Card title={t('about.licenseDetails')} bordered={false}>
              <Row gutter={[16, 8]}>
                <Col xs={24} sm={12}>
                  <Text type="secondary">{t('about.activationDate')}: </Text>
                  <Text>{license.activation_date ? new Date(license.activation_date).toLocaleString() : t('about.unknown')}</Text>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">{t('about.licenseKey')}: </Text>
                  <Text code>
                    {license.license_key
                      ? (showFullLicenseKey ? license.license_key : license.license_key.substring(0, 8) + '...')
                      : t('about.unknown')}
                  </Text>
                  {license.license_key && (
                    <Button type="link" onClick={() => setShowFullLicenseKey(!showFullLicenseKey)}>
                      {showFullLicenseKey ? t('about.hide') : t('about.show')}
                    </Button>
                  )}
                  {showFullLicenseKey && license.license_key && (
                    <Button
                      type="link"
                     
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(license.license_key);
                        message.success(t('about.copiedToClipboard'));
                      }}
                    >
                      {t('about.copy')}
                    </Button>
                  )}
                </Col>
              </Row>
            </Card>
          </Col>
        )}

      </Row>

      {/* 许可证激活对话框 */}
      <Modal
        title={license ? t('about.updateLicense') : t('about.activate')}
        open={activationModalVisible}
        onCancel={closeActivationModal}
        footer={null}
        width={520}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%', paddingTop: 8 }}>
          {/* 系统密钥 */}
          <div>
            <Text type="secondary">{t('about.systemKeyForVendor')}</Text>
            {loadingSystemKey ? <Spin /> : <Text code copyable>{systemKey}</Text>}
          </div>

          {/* 激活方式 Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => { setActiveTab(key); setActivationError(null); }}
            items={[
              {
                key: 'key',
                label: <span><KeyOutlined /> {t('about.keyActivation')}</span>,
                children: (
                  <Form form={form} layout="vertical" onFinish={handleActivate}>
                    <Form.Item
                      name="licenseKey"
                      rules={[
                        { required: true, message: t('about.licenseKeyRequired') },
                        { min: 16, message: t('about.licenseKeyTooShort') }
                      ]}
                      validateStatus={activationError ? 'error' : undefined}
                      help={activationError}
                    >
                      <Input.Password
                        prefix={<SafetyCertificateOutlined />}
                        placeholder={t('about.enterLicenseKeyPlaceholder')}
                        size="large"
                      />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={activating} size="large" block>
                      {t('about.activate')}
                    </Button>
                  </Form>
                )
              },
              {
                key: 'file',
                label: <span><UploadOutlined /> {t('about.fileActivation')}</span>,
                children: (
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Upload.Dragger
                      name="license"
                      fileList={fileList}
                      beforeUpload={beforeUpload}
                      onChange={handleFileChange}
                      maxCount={1}
                      customRequest={({ onSuccess }) => setTimeout(() => onSuccess("ok"), 0)}
                    >
                      <p><UploadOutlined style={{ fontSize: 24, color: '#1677ff' }} /></p>
                      <p>{t('about.dragOrClickToUpload')}</p>
                    </Upload.Dragger>
                    {activationError && <Text type="danger">{activationError}</Text>}
                    <Button
                      type="primary"
                      onClick={handleFileActivate}
                      loading={fileUploading}
                      disabled={fileList.length === 0}
                      size="large"
                      block
                    >
                      {t('about.uploadAndActivate')}
                    </Button>
                  </Space>
                )
              }
            ]}
          />

          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            {t('about.contactForLicense')}
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default AboutPage;
