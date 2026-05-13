import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserOutlined } from '@ant-design/icons';

interface AgentNodeProps {
  data: {
    role_id?: string;
    roleName?: string;
    prompt?: string;
  };
  selected?: boolean;
}

const AgentNode: React.FC<AgentNodeProps> = ({ data, selected }) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: selected ? '2px solid #1677ff' : '1px solid #91caff',
        background: 'var(--custom-card-bg)',
        minWidth: 180,
        boxShadow: selected ? '0 4px 12px rgba(22, 119, 255, 0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#1677ff',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#e6f4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserOutlined style={{ color: '#1677ff', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#1677ff', fontSize: 13 }}>智能体</div>
          <div style={{ fontSize: 12, color: 'var(--custom-text)', marginTop: 2 }}>
            {data?.roleName || '选择角色'}
          </div>
        </div>
      </div>
      {data?.prompt && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--custom-text-secondary)',
            background: 'var(--custom-hover-bg)',
            padding: '6px 8px',
            borderRadius: 6,
            lineHeight: 1.4,
          }}
        >
          {data.prompt.substring(0, 40)}
          {data.prompt.length > 40 ? '...' : ''}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#1677ff',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
};

export default AgentNode;
