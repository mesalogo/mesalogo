import React from 'react';
import { Card, Alert, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const AccessControl = ({ knowledgeId }) => {
  return (
    <Card
      title={
        <Space>
          <LockOutlined />
          <span>访问控制</span>
        </Space>
      }
    >
      <Alert
        message="功能开发中"
        description="访问控制功能正在开发中，敬请期待。将支持：权限管理、用户分享、团队协作等功能。"
        type="info"
        showIcon
      />
    </Card>
  );
};

export default AccessControl;
