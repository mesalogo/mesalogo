import React, { useState } from 'react';
import { Typography, Tabs } from 'antd';
import { ShareAltOutlined, DatabaseOutlined, CloudOutlined } from '@ant-design/icons';
import SharedEnvironmentVariables from './SharedEnvironmentVariables';
import InternalEnvironmentVariables from './InternalEnvironmentVariables';
import ExternalEnvironmentVariables from './ExternalEnvironmentVariables';

const { Title, Text } = Typography;

const EnvironmentVariables = () => {
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
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>环境变量</Title>
          <Text type="secondary">
            管理共享环境变量、内部环境变量模板和外部环境变量同步配置
          </Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'shared',
            label: <span><ShareAltOutlined />共享环境变量</span>,
            children: <SharedEnvironmentVariables />
          },
          {
            key: 'internal',
            label: <span><DatabaseOutlined />内部环境变量</span>,
            children: <InternalEnvironmentVariables />
          },
          {
            key: 'external',
            label: <span><CloudOutlined />外部环境变量</span>,
            children: <ExternalEnvironmentVariables />
          }
        ]}
      />
    </div>
  );
};

export default EnvironmentVariables;