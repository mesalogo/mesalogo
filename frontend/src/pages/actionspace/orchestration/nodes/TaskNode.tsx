import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileTextOutlined } from '@ant-design/icons';

interface TaskNodeProps {
  data: {
    instruction?: string;
    output_var?: string;
  };
  selected?: boolean;
}

const TaskNode: React.FC<TaskNodeProps> = ({ data, selected }) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: selected ? '2px solid #722ed1' : '1px solid #d3adf7',
        background: 'var(--custom-card-bg)',
        minWidth: 180,
        boxShadow: selected ? '0 4px 12px rgba(114, 46, 209, 0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#722ed1',
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
            background: '#f9f0ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FileTextOutlined style={{ color: '#722ed1', fontSize: 16 }} />
        </div>
        <div style={{ fontWeight: 600, color: '#722ed1', fontSize: 13 }}>任务</div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--custom-text-secondary)',
          background: 'var(--custom-hover-bg)',
          padding: '6px 8px',
          borderRadius: 6,
          lineHeight: 1.4,
        }}
      >
        {data?.instruction?.substring(0, 40) || '配置指令...'}
        {data?.instruction && data.instruction.length > 40 ? '...' : ''}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#722ed1',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
};

export default TaskNode;
