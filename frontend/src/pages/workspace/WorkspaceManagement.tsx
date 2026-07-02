import { useState } from 'react';
import { Tabs, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  ApartmentOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 项目空间管理主组件
 * 整合所有项目空间类型的标签页，包括分区项目空间功能
 */
const WorkspaceManagement = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('memory-graph');

  // 处理标签页切换
  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('workspace.title')}</Title>
            <Text type="secondary">
              {t('workspace.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'memory-graph',
            label: (
              <span>
                <ApartmentOutlined style={{ color: '#722ed1' }} />
                {t('wsManagement.memoryGraph')}
              </span>
            ),
            children: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <ApartmentOutlined style={{ fontSize: '48px', color: '#722ed1', marginBottom: '16px' }} />
                <Typography.Title level={4}>{t('wsManagement.memoryGraph')}</Typography.Title>
                <Typography.Text type="secondary">
                  {t('wsManagement.memoryGraphDesc')}
                </Typography.Text>
              </div>
            )
          }
        ]}
      />
    </div>
  );
};

export default WorkspaceManagement;
