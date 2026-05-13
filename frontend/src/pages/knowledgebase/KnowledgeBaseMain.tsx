import React, { useState } from 'react';
import { Tabs, Card, Typography, Skeleton, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { DatabaseOutlined, ApiOutlined, LinkOutlined, TeamOutlined, ExperimentOutlined } from '@ant-design/icons';
import KnowledgeList from './KnowledgeList';
import RagasEvaluation from './RagasEvaluation';
// 新增外部知识库相关组件
import ExternalProviders from './external/ExternalProviders';
import ExternalKnowledges from './external/ExternalKnowledges';
import RoleKnowledgeBinding from './external/RoleKnowledgeBinding';

const { Title, Text } = Typography;

const KnowledgeBaseMain = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('internal');
  const [externalActiveTab, setExternalActiveTab] = useState('providers');
  const [loading, setLoading] = useState(false);

  // 处理主标签页切换
  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  // 处理外部知识库子标签页切换
  const handleExternalTabChange = (key) => {
    setExternalActiveTab(key);
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
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('knowledgeBase.title')}</Title>
            <Text type="secondary">
              {t('knowledgeBase.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      {loading ? (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {[1, 2, 3, 4].map(item => (
            <Card key={item}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Card>
          ))}
        </Space>
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'internal',
              label: (
                <span>
                  <DatabaseOutlined />{t('knowledgeBase.internal')}
                </span>
              ),
              children: <KnowledgeList onViewDocuments={undefined} />
            },
            {
              key: 'external',
              label: <span><LinkOutlined />{t('knowledgeBase.external')}</span>,
              children: (
                <Tabs
                  activeKey={externalActiveTab}
                  onChange={handleExternalTabChange}
                  items={[
                    {
                      key: 'providers',
                      label: <span><ApiOutlined />{t('knowledgeBase.providerManagement')}</span>,
                      children: <ExternalProviders />
                    },
                    {
                      key: 'knowledges',
                      label: <span><DatabaseOutlined />{t('knowledgeBase.knowledgeList')}</span>,
                      children: <ExternalKnowledges />
                    }
                  ]}
                />
              )
            },
            {
              key: 'role-bindings',
              label: <span><TeamOutlined />{t('knowledgeBase.roleBindings')}</span>,
              children: <RoleKnowledgeBinding />
            },
            {
              key: 'ragas-evaluation',
              label: <span><ExperimentOutlined />{t('knowledgeBase.ragasEvaluation')}</span>,
              children: <RagasEvaluation />
            }
          ]}
        />
      )}
    </div>
  );
};

export default KnowledgeBaseMain;
