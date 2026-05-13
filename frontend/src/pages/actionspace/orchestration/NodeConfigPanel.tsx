import React from 'react';
import { Drawer, Form, Input, Select, Switch, InputNumber, Empty, Typography } from 'antd';
import { Node } from '@xyflow/react';
import {
  PlayCircleOutlined,
  StopOutlined,
  UserOutlined,
  FileTextOutlined,
  BookOutlined,
  ApiOutlined,
  BranchesOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

interface Role {
  id: string;
  name: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
}

interface NodeConfigPanelProps {
  node: Node | null;
  roles?: Role[];
  knowledgeBases?: KnowledgeBase[];
  onUpdate: (nodeId: string, data: any) => void;
  onClose: () => void;
}

const nodeTypeInfo: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  start: { label: '开始节点', icon: <PlayCircleOutlined />, color: '#52c41a' },
  end: { label: '结束节点', icon: <StopOutlined />, color: '#ff4d4f' },
  agent: { label: '智能体节点', icon: <UserOutlined />, color: '#1677ff' },
  task: { label: '任务节点', icon: <FileTextOutlined />, color: '#722ed1' },
  knowledge: { label: '知识库节点', icon: <BookOutlined />, color: '#fa8c16' },
  api: { label: 'API调用节点', icon: <ApiOutlined />, color: '#13c2c2' },
  condition: { label: '条件判断节点', icon: <BranchesOutlined />, color: '#eb2f96' },
};

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  roles = [],
  knowledgeBases = [],
  onUpdate,
  onClose,
}) => {
  const nodeType = node?.type || '';
  const nodeData = (node?.data || {}) as Record<string, any>;
  const typeInfo = nodeTypeInfo[nodeType] || { label: '节点配置', icon: null, color: 'var(--custom-text-secondary)' };

  const handleChange = (field: string, value: any) => {
    if (node) {
      onUpdate(node.id, { [field]: value });
    }
  };

  const renderConfigForm = () => {
    if (!node) return null;

    switch (nodeType) {
      case 'start':
        return (
          <div style={{ color: 'var(--custom-text-secondary)', textAlign: 'center', padding: 40 }}>
            开始节点无需配置
          </div>
        );

      case 'end':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label="自动总结">
              <Switch
                checked={nodeData.summary || false}
                onChange={(checked) => handleChange('summary', checked)}
              />
            </Form.Item>
          </Form>
        );

      case 'agent':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label="选择角色" required>
              <Select
                placeholder="选择角色"
                value={nodeData.role_id}
                onChange={(value) => {
                  const role = roles.find((r) => r.id === value);
                  handleChange('role_id', value);
                  if (role) {
                    handleChange('roleName', role.name);
                  }
                }}
              >
                {roles.map((role) => (
                  <Option key={role.id} value={role.id}>
                    {role.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="提示词">
              <TextArea
                rows={6}
                placeholder="输入提示词，支持 {{prev_output}} 和 {{task_var.xxx}} 变量"
                value={nodeData.prompt || ''}
                onChange={(e) => handleChange('prompt', e.target.value)}
              />
            </Form.Item>
          </Form>
        );

      case 'task':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label="任务指令" required>
              <TextArea
                rows={6}
                placeholder="输入任务指令"
                value={nodeData.instruction || ''}
                onChange={(e) => handleChange('instruction', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="输出变量名">
              <Input
                placeholder="可选，用于后续引用"
                value={nodeData.output_var || ''}
                onChange={(e) => handleChange('output_var', e.target.value)}
              />
            </Form.Item>
          </Form>
        );

      case 'knowledge':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label="选择知识库" required>
              <Select
                placeholder="选择知识库"
                value={nodeData.kb_id}
                onChange={(value) => {
                  const kb = knowledgeBases.find((k) => k.id === value);
                  handleChange('kb_id', value);
                  if (kb) {
                    handleChange('kbName', kb.name);
                  }
                }}
              >
                {knowledgeBases.map((kb) => (
                  <Option key={kb.id} value={kb.id}>
                    {kb.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="查询内容">
              <TextArea
                rows={4}
                placeholder="输入查询内容，支持变量"
                value={nodeData.query || ''}
                onChange={(e) => handleChange('query', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="返回数量">
              <InputNumber
                min={1}
                max={20}
                value={nodeData.top_k || 5}
                onChange={(value) => handleChange('top_k', value)}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>
        );

      case 'api':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label="请求方法">
              <Select
                value={nodeData.method || 'GET'}
                onChange={(value) => handleChange('method', value)}
              >
                <Option value="GET">GET</Option>
                <Option value="POST">POST</Option>
                <Option value="PUT">PUT</Option>
                <Option value="DELETE">DELETE</Option>
              </Select>
            </Form.Item>
            <Form.Item label="URL" required>
              <Input
                placeholder="https://api.example.com/endpoint"
                value={nodeData.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="请求头 (JSON)">
              <TextArea
                rows={3}
                placeholder='{"Authorization": "Bearer xxx"}'
                value={
                  typeof nodeData.headers === 'object'
                    ? JSON.stringify(nodeData.headers, null, 2)
                    : nodeData.headers || ''
                }
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    handleChange('headers', headers);
                  } catch {
                    handleChange('headers', e.target.value);
                  }
                }}
              />
            </Form.Item>
            <Form.Item label="请求体 (JSON)">
              <TextArea
                rows={4}
                placeholder='{"key": "value"}'
                value={
                  typeof nodeData.body === 'object'
                    ? JSON.stringify(nodeData.body, null, 2)
                    : nodeData.body || ''
                }
                onChange={(e) => {
                  try {
                    const body = JSON.parse(e.target.value);
                    handleChange('body', body);
                  } catch {
                    handleChange('body', e.target.value);
                  }
                }}
              />
            </Form.Item>
          </Form>
        );

      case 'condition':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label="条件类型">
              <Select
                value={nodeData.condition_type || 'contains'}
                onChange={(value) => handleChange('condition_type', value)}
              >
                <Option value="contains">包含</Option>
                <Option value="equals">相等</Option>
                <Option value="expression">表达式</Option>
                <Option value="not_empty">非空</Option>
                <Option value="regex">正则匹配</Option>
              </Select>
            </Form.Item>
            <Form.Item label="条件表达式" required>
              <TextArea
                rows={4}
                placeholder="例如: {{prev_output}} contains '需要审核'"
                value={nodeData.condition || ''}
                onChange={(e) => handleChange('condition', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="True 分支标签">
              <Input
                placeholder="是"
                value={nodeData.true_label || ''}
                onChange={(e) => handleChange('true_label', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="False 分支标签">
              <Input
                placeholder="否"
                value={nodeData.false_label || ''}
                onChange={(e) => handleChange('false_label', e.target.value)}
              />
            </Form.Item>
          </Form>
        );

      default:
        return (
          <div style={{ color: 'var(--custom-text-secondary)', textAlign: 'center', padding: 40 }}>
            未知节点类型
          </div>
        );
    }
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: typeInfo.color, fontSize: 18 }}>{typeInfo.icon}</span>
          <Text strong>{typeInfo.label}</Text>
        </div>
      }
      placement="right"
      width={320}
      open={!!node}
      onClose={onClose}
      mask={false}
      styles={{
        body: { padding: '16px 20px' },
      }}
    >
      {node ? (
        renderConfigForm()
      ) : (
        <Empty description="选择一个节点进行配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Drawer>
  );
};

export default NodeConfigPanel;
