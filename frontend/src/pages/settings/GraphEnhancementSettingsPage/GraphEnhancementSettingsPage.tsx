import React, { useState } from 'react';
import {
  Space,
  Typography,
  Tabs
} from 'antd';
import {
  ShareAltOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import GraphitiTab from './GraphitiTab';
import LightragTab from './LightragTab';

const { Title, Text } = Typography;

const GraphEnhancementSettingsPage = () => {
  const { t } = useTranslation();
  
  // Tab相关状态
  const [activeTab, setActiveTab] = useState('graphiti');

  return (
    <div className="graph-enhancement-settings-container">
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
          <ShareAltOutlined style={{ marginRight: '8px' }} />
          {t('graphEnhancement.title')}
        </Title>
        <Text type="secondary">
          {t('graphEnhancement.subtitle')}
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'graphiti',
            label: (
              <Space>
                <ShareAltOutlined />
                长期记忆
              </Space>
            ),
            children: <GraphitiTab />
          },
          {
            key: 'lightrag',
            label: (
              <Space>
                <DatabaseOutlined />
                知识库图谱
              </Space>
            ),
            children: <LightragTab />
          }
        ]}
      />
    </div>
  );
};

export default GraphEnhancementSettingsPage;
