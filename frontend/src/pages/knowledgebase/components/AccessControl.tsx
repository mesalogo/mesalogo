import React from 'react';
import { Card, Alert, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const AccessControl = ({ knowledgeId }) => {
  const { t } = useTranslation();
  return (
    <Card
      title={
        <Space>
          <LockOutlined />
          <span>{t('accessControl.title')}</span>
        </Space>
      }
    >
      <Alert
        message={t('accessControl.wipTitle')}
        description={t('accessControl.wipDesc')}
        type="info"
        showIcon
      />
    </Card>
  );
};

export default AccessControl;
