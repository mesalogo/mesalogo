import React from 'react';
import { Card, Typography, Button, Row, Col, Space } from 'antd';
import { TeamOutlined, UserAddOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;

const TeamSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
          <Space>
            <TeamOutlined />
            {t('account.teamSettings')}
          </Space>
        </Title>
        <Text type="secondary">
          {t('account.teamSettingsSubtitle')}
        </Text>
      </div>

      <Card>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '40px 20px'
        }}>
          <TeamOutlined style={{ fontSize: 64, color: isDark ? '#434343' : '#d9d9d9', marginBottom: 16 }} />
          <Title level={5} style={{ marginBottom: 8 }}>
            {t('account.teamComingSoon')}
          </Title>
          <Paragraph type="secondary" style={{ textAlign: 'center', maxWidth: 400, marginBottom: 16 }}>
            {t('account.teamDescription')}
          </Paragraph>
          <Space orientation="vertical" align="center">
            <Button type="primary" disabled icon={<UserAddOutlined />}>
              {t('account.createTeam')}
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('account.teamFeatureHint')}
            </Text>
          </Space>
        </div>
      </Card>

      {/* 预览功能卡片 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={8}>
          <Card hoverable style={{ textAlign: 'center', opacity: 0.6 }}>
            <UserAddOutlined style={{ fontSize: 28, color: '#1677ff', marginBottom: 8 }} />
            <Title level={5} style={{ marginBottom: 4 }}>{t('account.teamFeatureMember')}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('account.teamFeatureMemberDesc')}</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable style={{ textAlign: 'center', opacity: 0.6 }}>
            <SettingOutlined style={{ fontSize: 28, color: '#1677ff', marginBottom: 8 }} />
            <Title level={5} style={{ marginBottom: 4 }}>{t('account.teamFeaturePermission')}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('account.teamFeaturePermissionDesc')}</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable style={{ textAlign: 'center', opacity: 0.6 }}>
            <TeamOutlined style={{ fontSize: 28, color: '#1677ff', marginBottom: 8 }} />
            <Title level={5} style={{ marginBottom: 4 }}>{t('account.teamFeatureCollaboration')}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('account.teamFeatureCollaborationDesc')}</Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TeamSettingsPage;
