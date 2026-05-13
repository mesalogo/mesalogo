import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BookOutlined } from '@ant-design/icons';

interface KnowledgeNodeProps {
  data: {
    kb_id?: string;
    kbName?: string;
    query?: string;
    top_k?: number;
  };
  selected?: boolean;
}

const KnowledgeNode: React.FC<KnowledgeNodeProps> = ({ data, selected }) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: selected ? '2px solid #fa8c16' : '1px solid #ffd591',
        background: 'var(--custom-card-bg)',
        minWidth: 180,
        boxShadow: selected ? '0 4px 12px rgba(250, 140, 22, 0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#fa8c16',
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
            background: '#fff7e6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BookOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#fa8c16', fontSize: 13 }}>知识库</div>
          <div style={{ fontSize: 12, color: 'var(--custom-text)', marginTop: 2 }}>
            {data?.kbName || '选择知识库'}
          </div>
        </div>
      </div>
      {data?.query && (
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
          查询: {data.query.substring(0, 30)}...
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#fa8c16',
          width: 10,
          height: 10,
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
};

export default KnowledgeNode;
