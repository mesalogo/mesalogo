import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ApiOutlined } from '@ant-design/icons';

interface ApiNodeProps {
  data: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  selected?: boolean;
}

const ApiNode: React.FC<ApiNodeProps> = ({ data, selected }) => {
  const method = data?.method || 'GET';

  const methodColors: Record<string, string> = {
    GET: '#52c41a',
    POST: '#1677ff',
    PUT: '#fa8c16',
    DELETE: '#ff4d4f',
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: selected ? '2px solid #13c2c2' : '1px solid #87e8de',
        background: 'var(--custom-card-bg)',
        minWidth: 180,
        boxShadow: selected ? '0 4px 12px rgba(19, 194, 194, 0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#13c2c2',
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
            background: '#e6fffb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ApiOutlined style={{ color: '#13c2c2', fontSize: 16 }} />
        </div>
        <div style={{ fontWeight: 600, color: '#13c2c2', fontSize: 13 }}>API调用</div>
      </div>
      <div
        style={{
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--custom-hover-bg)',
          padding: '6px 8px',
          borderRadius: 6,
        }}
      >
        <span
          style={{
            background: methodColors[method] || '#666',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {method}
        </span>
        <span style={{ color: 'var(--custom-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data?.url?.substring(0, 18) || '配置URL...'}
          {data?.url && data.url.length > 18 ? '...' : ''}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#13c2c2',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
};

export default ApiNode;
