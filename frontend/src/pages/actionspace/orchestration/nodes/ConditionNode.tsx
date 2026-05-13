import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BranchesOutlined } from '@ant-design/icons';

interface ConditionNodeProps {
  data: {
    condition?: string;
    condition_type?: string;
    true_label?: string;
    false_label?: string;
  };
  selected?: boolean;
}

const ConditionNode: React.FC<ConditionNodeProps> = ({ data, selected }) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: selected ? '2px solid #eb2f96' : '1px solid #ffadd2',
        background: 'var(--custom-card-bg)',
        minWidth: 180,
        boxShadow: selected ? '0 4px 12px rgba(235, 47, 150, 0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#eb2f96',
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
            background: '#fff0f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BranchesOutlined style={{ color: '#eb2f96', fontSize: 16 }} />
        </div>
        <div style={{ fontWeight: 600, color: '#eb2f96', fontSize: 13 }}>条件判断</div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--custom-text-secondary)',
          background: 'var(--custom-hover-bg)',
          padding: '6px 8px',
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        {data?.condition?.substring(0, 30) || '配置条件...'}
        {data?.condition && data.condition.length > 30 ? '...' : ''}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: '#52c41a', fontWeight: 500 }}>✓ {data?.true_label || '是'}</span>
        <span style={{ color: '#ff4d4f', fontWeight: 500 }}>✗ {data?.false_label || '否'}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="source-true"
        style={{
          background: '#52c41a',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          top: '35%',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-false"
        style={{
          background: '#ff4d4f',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          top: '65%',
        }}
      />
    </div>
  );
};

export default ConditionNode;
