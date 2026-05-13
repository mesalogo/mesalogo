import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { PlayCircleOutlined } from '@ant-design/icons';

interface StartNodeProps {
  selected?: boolean;
}

const StartNode: React.FC<StartNodeProps> = ({ selected }) => {
  return (
    <div
      style={{
        padding: '14px 24px',
        borderRadius: 12,
        border: selected ? '2px solid #52c41a' : '1px solid #b7eb8f',
        background: '#f6ffed',
        minWidth: 110,
        textAlign: 'center',
        boxShadow: selected ? '0 4px 12px rgba(82, 196, 26, 0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#52c41a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlayCircleOutlined style={{ color: '#fff', fontSize: 14 }} />
        </div>
        <span style={{ fontWeight: 600, color: '#389e0d', fontSize: 14 }}>开始</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#52c41a',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
};

export default StartNode;
