import React from 'react';
import { List, Input, Button, Space, Typography, Tag } from 'antd';
import { SearchOutlined, PlusOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text, Paragraph } = Typography;

// Mock data - knowledge bases
const mockKnowledgeBases = [
  {
    id: 'kb1',
    name: 'Product Docs Library',
    description: 'Contains all product-related documents, specifications, and user manuals',
    status: 'connected',
    documentCount: 156,
  },
  {
    id: 'kb2',
    name: 'Technical Docs Library',
    description: 'Contains technical architecture, API docs, and development guides',
    status: 'disconnected',
    documentCount: 89,
  },
  {
    id: 'kb3',
    name: 'Market Research Materials',
    description: 'Market analysis, competitor research, and user feedback',
    status: 'connected',
    documentCount: 42,
  },
];

/**
 * 专业知识记忆（知识库）标签页组件
 */
const KnowledgeBaseTab = () => {
  const { t } = useTranslation();
  return (
    <div>
      <Paragraph type="secondary">
        {t('kbTab.pageDesc')}
      </Paragraph>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />}>{t('kbTab.connect')}</Button>
          <Input 
            placeholder={t('kbTab.searchPlaceholder')} 
            prefix={<SearchOutlined />} 
            style={{ width: 300 }}
          />
        </Space>
      </div>
      <List
        itemLayout="horizontal"
        dataSource={mockKnowledgeBases}
        renderItem={item => (
          <List.Item
            actions={[
              item.status === 'connected' ? (
                <Button>{t('kbTab.disconnect')}</Button>
              ) : (
                <Button type="primary">{t('kbTab.connectAction')}</Button>
              ),
              <Button icon={<SearchOutlined />}>{t('kbTab.view')}</Button>
            ]}
          >
            <List.Item.Meta
              avatar={<DatabaseOutlined style={{ color: '#fa8c16', fontSize: '24px' }} />}
              title={
                <Space>
                  {item.name}
                  <Tag color={item.status === 'connected' ? 'green' : 'default'}>
                    {item.status === 'connected' ? t('kbTab.connected') : t('kbTab.disconnected')}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  <div>{item.description}</div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">{t('kbTab.documentCount', { count: item.documentCount })}</Text>
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default KnowledgeBaseTab;
