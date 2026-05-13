import React, { useState, useCallback } from 'react';
import { Button, message, Space, Switch, Typography } from 'antd';
import { SaveOutlined, ClearOutlined } from '@ant-design/icons';
import { Node, Edge } from '@xyflow/react';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import OrchestrationEditor from './OrchestrationEditor';
import NodePalette from './NodePalette';
import NodeConfigPanel from './NodeConfigPanel';

const { Text } = Typography;

interface Role {
  id: string;
  name: string;
}

interface OrchestrationTabProps {
  actionSpaceId: string;
  settings: any;
  roles: Role[];
  onSave?: () => void;
}

const OrchestrationTab: React.FC<OrchestrationTabProps> = ({
  actionSpaceId,
  settings,
  roles,
}) => {
  const orchestration = settings?.orchestration || { enabled: false, nodes: [], edges: [] };
  const [enabled, setEnabled] = useState(orchestration.enabled || false);
  const [nodes, setNodes] = useState<Node[]>(orchestration.nodes || []);
  const [edges, setEdges] = useState<Edge[]>(orchestration.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveData = {
        settings: {
          ...settings,
          orchestration: {
            enabled,
            nodes: nodes.map(n => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
            })),
            edges: edges.map(e => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
              type: e.type,
              animated: e.animated,
            })),
          },
        },
      };
      console.log('Saving orchestration:', saveData.settings.orchestration);
      await actionSpaceAPI.update(actionSpaceId, saveData);
      message.success('编排配置已保存');
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
  };

  const handleNodeUpdate = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
      )
    );
    setSelectedNode((prev) =>
      prev && prev.id === nodeId
        ? { ...prev, data: { ...prev.data, ...newData } }
        : prev
    );
  }, []);

  const handleDrop = useCallback((type: string, position: { x: number; y: number }) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: {},
    };

    switch (type) {
      case 'agent':
        newNode.data = { role_id: '', roleName: '', prompt: '' };
        break;
      case 'task':
        newNode.data = { instruction: '', output_var: '' };
        break;
      case 'knowledge':
        newNode.data = { kb_id: '', kbName: '', query: '', top_k: 5 };
        break;
      case 'api':
        newNode.data = { method: 'GET', url: '', headers: {}, body: {} };
        break;
      case 'condition':
        newNode.data = { condition: '', condition_type: 'contains', true_label: '是', false_label: '否' };
      break;
      case 'end':
        newNode.data = { summary: false };
        break;
    }

    setNodes((nds) => [...nds, newNode]);
  }, []);

  const handleNodesChange = useCallback((newNodes: Node[]) => {
    setNodes(newNodes);
  }, []);

  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
  }, []);

  const handleCloseConfigPanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div style={{ height: 600 }}>
      <div
        style={{
          marginBottom: 12,
          padding: '8px 12px',
          background: 'var(--custom-header-bg)',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text style={{ fontSize: 13 }}>启用编排:</Text>
          <Switch checked={enabled} onChange={setEnabled} size="small" />
        </Space>
        <Space size={8}>
          <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
            清空
          </Button>
          <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', height: 'calc(100% - 52px)', gap: 12 }}>
        <NodePalette collapsed={paletteCollapsed} onCollapse={setPaletteCollapsed} />

        <div
          style={{
            flex: 1,
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--custom-header-bg)',
            border: '1px solid var(--custom-border)',
          }}
        >
          <OrchestrationEditor
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeSelect={setSelectedNode}
            onDrop={handleDrop}
          />
        </div>
      </div>

      <NodeConfigPanel
        node={selectedNode}
        roles={roles}
        knowledgeBases={[]}
        onUpdate={handleNodeUpdate}
        onClose={handleCloseConfigPanel}
      />
    </div>
  );
};

export default OrchestrationTab;
