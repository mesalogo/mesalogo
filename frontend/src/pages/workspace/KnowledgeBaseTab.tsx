import React from 'react';
import { List, Input, Button, Space, Typography, Tag } from 'antd';
import { SearchOutlined, PlusOutlined, DatabaseOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

// 模拟数据 - 知识库
const mockKnowledgeBases = [
  {
    id: 'kb1',
    name: '产品文档库',
    description: '包含所有产品相关的文档、规格说明和用户手册',
    status: 'connected',
    documentCount: 156,
  },
  {
    id: 'kb2',
    name: '技术文档库',
    description: '包含技术架构、API文档和开发指南',
    status: 'disconnected',
    documentCount: 89,
  },
  {
    id: 'kb3',
    name: '市场研究资料',
    description: '市场分析、竞品研究和用户反馈',
    status: 'connected',
    documentCount: 42,
  },
];

/**
 * 专业知识记忆（知识库）标签页组件
 */
const KnowledgeBaseTab = () => {
  return (
    <div>
      <Paragraph type="secondary">
        专业知识记忆通过知识库工具实现，您可以连接和搜索知识库内容。
      </Paragraph>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />}>连接知识库</Button>
          <Input 
            placeholder="搜索知识库内容" 
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
                <Button>断开</Button>
              ) : (
                <Button type="primary">连接</Button>
              ),
              <Button icon={<SearchOutlined />}>查看</Button>
            ]}
          >
            <List.Item.Meta
              avatar={<DatabaseOutlined style={{ color: '#fa8c16', fontSize: '24px' }} />}
              title={
                <Space>
                  {item.name}
                  <Tag color={item.status === 'connected' ? 'green' : 'default'}>
                    {item.status === 'connected' ? '已连接' : '未连接'}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  <div>{item.description}</div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">文档数量: {item.documentCount}</Text>
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
