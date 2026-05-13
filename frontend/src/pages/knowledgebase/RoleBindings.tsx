import React from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { TeamOutlined } from '@ant-design/icons';
import RoleKnowledgeBinding from './external/RoleKnowledgeBinding';

const { Title, Text } = Typography;

const RoleBindings = () => {
  const { t } = useTranslation();

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
              <TeamOutlined style={{ marginRight: 8 }} />
              {t('menu.knowledgeBindings')}
            </Title>
            <Text type="secondary">
              {t('knowledgeBase.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      <RoleKnowledgeBinding />
    </div>
  );
};

export default RoleBindings;
