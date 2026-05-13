import React, { useState } from 'react';
import { Card, Tag, Space, Typography, Empty } from 'antd';
import { 
  DownOutlined, 
  UpOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined 
} from '@ant-design/icons';

const { Text, Title } = Typography;

/**
 * 计划面板组件 - KISS版本
 * 显示智能体创建的执行计划，可折叠/展开
 * 使用 React.memo 优化渲染性能
 */
const PlannerPanel = React.memo(({ plan }: any) => {
  const [collapsed, setCollapsed] = useState(true);

  console.log('[PlannerPanel] 渲染，plan 值:', plan);

  // 如果没有计划，不显示
  if (!plan) {
    console.log('[PlannerPanel] 没有计划，不显示面板');
    return null;
  }

  // 防御性检查：确保数据格式正确
  if (typeof plan !== 'object' || !plan.title) {
    console.error('[PlannerPanel] Invalid plan data:', plan);
    return null;
  }

  console.log('[PlannerPanel] 显示计划面板，标题:', plan.title, '状态:', plan.status);

  const { 
    title, 
    items = [], 
    completed_count = 0, 
    total_count = 0, 
    progress_percentage = 0, 
    status = 'active' 
  } = plan;

  // 确保 items 是数组
  const safeItems = Array.isArray(items) ? items : [];

  // 状态图标映射
  const statusIcons = {
    pending: <ClockCircleOutlined style={{ color: 'var(--custom-text-secondary)' }} />,
    completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />
  };

  // 状态文本映射
  const statusTexts = {
    pending: '待完成',
    completed: '已完成',
    active: '进行中'
  };

  // 状态颜色映射
  const statusColors = {
    pending: 'default',
    completed: 'success',
    active: 'processing'
  };

  return (
    <Card 
      className="glass-effect"
      style={{ 
        margin: '16px',
        borderRadius: '8px',
        boxShadow: 'var(--custom-shadow)'
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      {/* 头部：标题、进度、折叠按钮 */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <Space size="middle" style={{ flex: 1 }}>
          <Text strong style={{ fontSize: '14px' }}>
            📋 {title}
          </Text>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            {completed_count}/{total_count} 已完成
          </Text>
        </Space>
        
        <Space>
          {collapsed ? <DownOutlined /> : <UpOutlined />}
        </Space>
      </div>

      {/* 展开内容：任务列表 */}
      {!collapsed && (
        <div style={{ marginTop: '12px' }}>
          {safeItems.length === 0 ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无任务"
              style={{ margin: '16px 0' }}
            />
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {safeItems.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 12px',
                    marginBottom: '8px',
                    backgroundColor: item.status === 'completed' ? 'var(--tree-selected-bg)' : 'var(--custom-card-bg)',
                    border: `1px solid ${item.status === 'in_progress' ? '#1677ff' : 'var(--custom-border)'}`,
                    borderRadius: '6px',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {statusIcons[item.status]}
                    <Text 
                      strong={item.status === 'in_progress'}
                      style={{ 
                        flex: 1,
                        textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                        color: item.status === 'completed' ? 'var(--custom-text-secondary)' : 'inherit'
                      }}
                    >
                      {index + 1}. {item.title}
                    </Text>
                  </div>
                  {item.description && (
                    <Text 
                      type="secondary" 
                      style={{ 
                        fontSize: '12px', 
                        marginLeft: '24px',
                        display: 'block',
                        marginTop: '4px'
                      }}
                    >
                      {item.description}
                    </Text>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只有当计划数据真正变化时才重新渲染
  if (!prevProps.plan && !nextProps.plan) return true; // 都是 null，不重新渲染
  if (!prevProps.plan || !nextProps.plan) return false; // 一个是 null，需要重新渲染
  
  const prev = prevProps.plan;
  const next = nextProps.plan;
  
  // 比较基本字段
  if (prev.id !== next.id ||
      prev.status !== next.status ||
      prev.completed_count !== next.completed_count ||
      prev.total_count !== next.total_count) {
    return false;
  }
  
  // 比较任务项数组（优化：只比较关键字段，避免 JSON.stringify）
  if (!prev.items || !next.items || prev.items.length !== next.items.length) {
    return false;
  }
  
  // 逐项比较 id 和 status（最常变化的字段）
  return prev.items.every((item, i) => 
    item.id === next.items[i].id && 
    item.status === next.items[i].status &&
    item.title === next.items[i].title
  );
});

export default PlannerPanel;
