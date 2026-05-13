import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { StopOutlined } from '@ant-design/icons';

interface EndNodeProps {
  data: {
    summary?: boolean;
  };
  selected?: boolean;
}

const EndNode: React.FC<EndNodeProps> = ({ data, selected }) => {
  return (
    <div
      style={{
        padding: '14px 24px',
        borderRadius: 12,
        border: selected ? '2px solid #ff4d4f' : '1px solid #ffccc7',
        background: '#fff2f0',
        minWidth: 110,
        textAlign: 'center',
        boxShadow: selected ? '0 4px 12px rgba(255, 77, 79, 0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#ff4d4f',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#ff4d4f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <StopOutlined style={{ color: '#fff', fontSize: 14 }} />
        </div>
        <span style={{ fontWeight: 600, color: '#cf1322', fontSize: 14 }}>结束</span>
      </div>
      {data?.summary && (
        <div style={{ fontSize: 11, color: 'var(--custom-text-secondary)', marginTop: 6 }}>
          自动总结
        </div>
      )}
    </div>
  );
};

export default EndNode;
