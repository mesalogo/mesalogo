import React from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ExperimentOutlined } from '@ant-design/icons';
import RagasEvaluation from './RagasEvaluation';

const { Title, Text } = Typography;

const RagasEvaluationPage = () => {
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
              <ExperimentOutlined style={{ marginRight: 8 }} />
              {t('menu.knowledgeEvaluation')}
            </Title>
            <Text type="secondary">
              {t('knowledgeBase.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      <RagasEvaluation />
    </div>
  );
};

export default RagasEvaluationPage;
