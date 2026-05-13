import React from 'react';
import { Typography, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  UserOutlined,
  FileTextOutlined,
  BookOutlined,
  ApiOutlined,
  BranchesOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface NodeTypeConfig {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const nodeTypeConfigs: NodeTypeConfig[] = [
  {
    type: 'start',
    label: '开始',
    icon: <PlayCircleOutlined />,
    color: '#52c41a',
    bgColor: '#f6ffed',
  },
  {
    type: 'end',
    label: '结束',
    icon: <StopOutlined />,
    color: '#ff4d4f',
    bgColor: '#fff2f0',
  },
  {
    type: 'agent',
    label: '智能体',
    icon: <UserOutlined />,
    color: '#1677ff',
    bgColor: '#e6f4ff',
  },
  {
    type: 'task',
    label: '任务',
    icon: <FileTextOutlined />,
    color: '#722ed1',
    bgColor: '#f9f0ff',
  },
  {
    type: 'knowledge',
    label: '知识库',
    icon: <BookOutlined />,
    color: '#fa8c16',
    bgColor: '#fff7e6',
  },
  {
    type: 'api',
    label: 'API调用',
    icon: <ApiOutlined />,
    color: '#13c2c2',
    bgColor: '#e6fffb',
  },
  {
    type: 'condition',
    label: '条件判断',
    icon: <BranchesOutlined />,
    color: '#eb2f96',
    bgColor: '#fff0f6',
  },
];

interface NodePaletteProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

const NodePalette: React.FC<NodePaletteProps> = ({ collapsed = false, onCollapse }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: 48,
          height: '100%',
          background: 'var(--custom-header-bg)',
          borderRadius: 8,
          border: '1px solid var(--custom-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
          gap: 4,
        }}
      >
        <div
          onClick={() => onCollapse?.(false)}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: 6,
            marginBottom: 8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e6e6e6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <RightOutlined style={{ fontSize: 12, color: 'var(--custom-text-secondary)' }} />
        </div>
        {nodeTypeConfigs.map((config) => (
          <Tooltip key={config.type} title={config.label} placement="right">
            <div
              draggable
              onDragStart={(e) => onDragStart(e, config.type)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: config.bgColor,
                border: `1px solid ${config.color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 2px 8px ${config.color}40`;
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span style={{ color: config.color, fontSize: 18 }}>{config.icon}</span>
            </div>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 140,
        height: '100%',
        background: 'var(--custom-header-bg)',
        borderRadius: 8,
        border: '1px solid var(--custom-border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--custom-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong style={{ fontSize: 13 }}>节点面板</Text>
        <div
          onClick={() => onCollapse?.(true)}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e6e6e6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LeftOutlined style={{ fontSize: 12, color: 'var(--custom-text-secondary)' }} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nodeTypeConfigs.map((config) => (
            <div
              key={config.type}
              draggable
              onDragStart={(e) => onDragStart(e, config.type)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${config.color}30`,
                background: config.bgColor,
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 4px 12px ${config.color}30`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ color: config.color, fontSize: 18 }}>{config.icon}</span>
              <Text style={{ color: config.color, fontSize: 13, fontWeight: 500 }}>{config.label}</Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NodePalette;
