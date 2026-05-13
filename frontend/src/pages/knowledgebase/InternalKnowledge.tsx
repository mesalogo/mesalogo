import React, { useRef } from 'react';
import { Typography, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { DatabaseOutlined, PlusOutlined } from '@ant-design/icons';
import KnowledgeList from './KnowledgeList';

const { Title, Text } = Typography;

const InternalKnowledge = () => {
  const { t } = useTranslation();
  const knowledgeListRef = useRef<any>(null);

  const handleCreateClick = () => {
    knowledgeListRef.current?.showCreateModal();
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
              <DatabaseOutlined style={{ marginRight: 8 }} />
              {t('menu.knowledgeInternal')}
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
            新建知识库
          </Button>
        </div>
      </div>

      <KnowledgeList ref={knowledgeListRef} onViewDocuments={undefined} hideCreateButton />
    </div>
  );
};

export default InternalKnowledge;
