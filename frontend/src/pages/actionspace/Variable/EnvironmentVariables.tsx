import React, { useState } from 'react';
import { Typography, Tabs } from 'antd';
import { ShareAltOutlined, DatabaseOutlined, CloudOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import SharedEnvironmentVariables from './SharedEnvironmentVariables';
import InternalEnvironmentVariables from './InternalEnvironmentVariables';
import ExternalEnvironmentVariables from './ExternalEnvironmentVariables';

const { Title, Text } = Typography;

const EnvironmentVariables = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('shared');

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('envVarsPage.title')}</Title>
          <Text type="secondary">
            {t('envVarsPage.desc')}
          </Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'shared',
            label: <span><ShareAltOutlined />{t('envVarsPage.tabShared')}</span>,
            children: <SharedEnvironmentVariables />
          },
          {
            key: 'internal',
            label: <span><DatabaseOutlined />{t('envVarsPage.tabInternal')}</span>,
            children: <InternalEnvironmentVariables />
          },
          {
            key: 'external',
            label: <span><CloudOutlined />{t('envVarsPage.tabExternal')}</span>,
            children: <ExternalEnvironmentVariables />
          }
        ]}
      />
    </div>
  );
};

export default EnvironmentVariables;