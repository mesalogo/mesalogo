import React from 'react';
import { Card, Typography, Space, Tag, Divider, Tooltip } from 'antd';
import {
  InfoCircleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  CalendarOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// 网格展示卡片统一样式
const gridCardStyle = {
  cursor: 'pointer',
  height: '100%',
  minHeight: '300px',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column' as const
};

const gridCardBodyStyle = {
  padding: '12px',
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const
};

/**
 * 行动空间卡片组件
 * 使用 React.memo 优化性能，避免不必要的重新渲染
 */
const ActionSpaceCard = React.memo(({ space, onClick, onDelete }: any) => {
  const handleCardClick = (e: any) => {
    // 防止删除按钮触发卡片点击
    const deleteButton = (e.target as HTMLElement).closest('[data-action="delete"]');
    if (!deleteButton && onClick) {
      onClick(space);
    }
  };

  return (
    <Card
     
      hoverable
      onClick={handleCardClick}
      style={gridCardStyle}
      styles={{ body: gridCardBodyStyle }}
      actions={[
        <Tooltip title="详情">
          <InfoCircleOutlined
            style={{ color: '#1677ff' }}
            onClick={(e) => {
              e.stopPropagation();
              onClick(space);
            }}
          />
        </Tooltip>,
        <Tooltip title="删除">
          <DeleteOutlined
            style={{ color: '#ff4d4f' }}
            data-action="delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(space);
            }}
          />
        </Tooltip>
      ]}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
        {/* 标题 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <Title level={5} ellipsis={{ rows: 2 }} style={{ marginTop: 0, marginBottom: 0, flex: 1, marginRight: 8 }}>
            {space.name}
          </Title>
        </div>

        {/* 描述 */}
        <div style={{
          marginBottom: 10,
          height: '40px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <Text type="secondary" style={{
            fontSize: '12px',
            lineHeight: '20px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-word'
          }}>
            {space.description}
          </Text>
        </div>

        {/* 标签 */}
        <div style={{
          marginBottom: '12px',
          height: '68px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {space.tags && space.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {space.tags.map(tag => (
                <Tag
                  key={tag.id}
                  color={tag.color || '#1677ff'}
                  style={{
                    marginRight: 4,
                    marginBottom: 4,
                    borderRadius: 4,
                    fontSize: '12px',
                    padding: '2px 8px',
                    border: 'none'
                  }}
                >
                  {tag.name}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {/* 统计信息 - 固定在底部 */}
        <div style={{ marginTop: 'auto' }}>
          <Divider />
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div>
              <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              <Text type="secondary">规则集：</Text>
              <Text strong style={{ color: '#1677ff' }}>
                {(space.rule_sets || []).length}个
              </Text>
            </div>
            <div>
              <TeamOutlined style={{ marginRight: 8 }} />
              <Text type="secondary">角色：</Text>
              <Text>{(space.roles || []).length}个</Text>
            </div>
            <div>
              <ThunderboltOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              <Text type="secondary">行动任务：</Text>
              <Text>{(space.action_tasks || []).length}个</Text>
            </div>
            <div>
              <CalendarOutlined style={{ marginRight: 8 }} />
              <Text type="secondary">创建于：</Text>
              <Text>
              {space.created_at ? new Date(space.created_at).toLocaleString() : '未知'}
              </Text>
            </div>
          </Space>
        </div>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键属性变化时重新渲染
  return (
    prevProps.space.id === nextProps.space.id &&
    prevProps.space.updated_at === nextProps.space.updated_at &&
    prevProps.space.tags?.length === nextProps.space.tags?.length
  );
});

ActionSpaceCard.displayName = 'ActionSpaceCard';

export default ActionSpaceCard;
