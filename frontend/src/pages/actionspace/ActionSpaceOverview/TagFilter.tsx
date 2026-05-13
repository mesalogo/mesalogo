import React from 'react';
import { Card, Tag, Button, Typography } from 'antd';

const { Title } = Typography;

/**
 * 标签筛选面板组件
 * 用于筛选行动空间
 */
const TagFilter = ({ industryTags, scenarioTags, selectedTagIds, onTagClick, onClear }: any) => {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Title level={5} style={{ marginBottom: 12 }}>行业标签</Title>
      <div style={{ marginBottom: 16 }}>
        {industryTags.map(tag => (
          <Tag
            key={`filter-industry-${tag.id}`}
            color={selectedTagIds.includes(tag.id) ? tag.color : undefined}
            style={{
              marginRight: 8,
              marginBottom: 8,
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: '12px',
              padding: '4px 12px',
              border: selectedTagIds.includes(tag.id) ? 'none' : `1px solid ${tag.color}`,
              backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'transparent',
              color: selectedTagIds.includes(tag.id) ? '#fff' : tag.color,
              transition: 'all 0.2s ease'
            }}
            onClick={() => onTagClick(tag.id)}
          >
            {tag.name}
          </Tag>
        ))}
      </div>

      <Title level={5} style={{ marginBottom: 12 }}>场景标签</Title>
      <div style={{ marginBottom: 16 }}>
        {scenarioTags.map(tag => (
          <Tag
            key={`filter-scenario-${tag.id}`}
            color={selectedTagIds.includes(tag.id) ? tag.color : undefined}
            style={{
              marginRight: 8,
              marginBottom: 8,
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: '12px',
              padding: '4px 12px',
              border: selectedTagIds.includes(tag.id) ? 'none' : `1px solid ${tag.color}`,
              backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'transparent',
              color: selectedTagIds.includes(tag.id) ? '#fff' : tag.color,
              transition: 'all 0.2s ease'
            }}
            onClick={() => onTagClick(tag.id)}
          >
            {tag.name}
          </Tag>
        ))}
      </div>

      {selectedTagIds.length > 0 && (
        <Button type="link" onClick={onClear} style={{ padding: 0 }}>
          清除筛选
        </Button>
      )}
    </Card>
  );
};

export default TagFilter;
