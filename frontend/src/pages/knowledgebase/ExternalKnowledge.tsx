import React, { useState, useRef } from 'react';
import { Typography, Tabs, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { LinkOutlined, ApiOutlined, DatabaseOutlined, PlusOutlined } from '@ant-design/icons';
import ExternalProviders from './external/ExternalProviders';
import ExternalKnowledges from './external/ExternalKnowledges';

const { Title, Text } = Typography;

const ExternalKnowledge = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('providers');
  const providersRef = useRef<any>(null);
  const knowledgesRef = useRef<any>(null);

  const handleCreateClick = () => {
    if (activeTab === 'providers') {
      providersRef.current?.showModal();
    } else {
      knowledgesRef.current?.showModal();
    }
  };

  return (
    <div className="knowledge-base-container">
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
              <LinkOutlined style={{ marginRight: 8 }} />
              {t('menu.knowledgeExternal')}
            </Title>
            <Text type="secondary">
              {t('knowledgeBase.subtitle')}
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateClick}
          >
            {activeTab === 'providers' ? '添加提供商' : '添加知识库'}
          </Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'providers',
            label: <span><ApiOutlined />{t('knowledgeBase.providerManagement')}</span>,
            children: <ExternalProviders ref={providersRef} hideCreateButton />
          },
          {
            key: 'knowledges',
            label: <span><DatabaseOutlined />{t('knowledgeBase.knowledgeList')}</span>,
            children: <ExternalKnowledges ref={knowledgesRef} hideCreateButton />
          }
        ]}
      />
    </div>
  );
};

export default ExternalKnowledge;
