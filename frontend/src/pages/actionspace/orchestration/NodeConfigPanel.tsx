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
import { useTranslation } from 'react-i18next';

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

const nodeTypeInfo: Record<string, { labelKey: string; icon: React.ReactNode; color: string }> = {
  start: { labelKey: 'nodeConfig.type.start', icon: <PlayCircleOutlined />, color: '#52c41a' },
  end: { labelKey: 'nodeConfig.type.end', icon: <StopOutlined />, color: '#ff4d4f' },
  agent: { labelKey: 'nodeConfig.type.agent', icon: <UserOutlined />, color: '#1677ff' },
  task: { labelKey: 'nodeConfig.type.task', icon: <FileTextOutlined />, color: '#722ed1' },
  knowledge: { labelKey: 'nodeConfig.type.knowledge', icon: <BookOutlined />, color: '#fa8c16' },
  api: { labelKey: 'nodeConfig.type.api', icon: <ApiOutlined />, color: '#13c2c2' },
  condition: { labelKey: 'nodeConfig.type.condition', icon: <BranchesOutlined />, color: '#eb2f96' },
};

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  roles = [],
  knowledgeBases = [],
  onUpdate,
  onClose,
}) => {
  const { t } = useTranslation();
  const nodeType = node?.type || '';
  const nodeData = (node?.data || {}) as Record<string, any>;
  const typeInfo = nodeTypeInfo[nodeType] || { labelKey: 'nodeConfig.title', icon: null, color: 'var(--custom-text-secondary)' };

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
            {t('nodeConfig.startNoConfig')}
          </div>
        );

      case 'end':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label={t('nodeConfig.autoSummary')}>
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
            <Form.Item label={t('nodeConfig.pickRole')} required>
              <Select
                placeholder={t('nodeConfig.pickRole')}
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
            <Form.Item label={t('nodeConfig.prompt')}>
              <TextArea
                rows={6}
                placeholder={t('nodeConfig.promptPh')}
                value={nodeData.prompt || ''}
                onChange={(e) => handleChange('prompt', e.target.value)}
              />
            </Form.Item>
          </Form>
        );

      case 'task':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label={t('nodeConfig.instruction')} required>
              <TextArea
                rows={6}
                placeholder={t('nodeConfig.instructionPh')}
                value={nodeData.instruction || ''}
                onChange={(e) => handleChange('instruction', e.target.value)}
              />
            </Form.Item>
            <Form.Item label={t('nodeConfig.outputVar')}>
              <Input
                placeholder={t('nodeConfig.outputVarPh')}
                value={nodeData.output_var || ''}
                onChange={(e) => handleChange('output_var', e.target.value)}
              />
            </Form.Item>
          </Form>
        );

      case 'knowledge':
        return (
          <Form layout="vertical" size="middle">
            <Form.Item label={t('nodeConfig.pickKB')} required>
              <Select
                placeholder={t('nodeConfig.pickKB')}
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
            <Form.Item label={t('nodeConfig.query')}>
              <TextArea
                rows={4}
                placeholder={t('nodeConfig.queryPh')}
                value={nodeData.query || ''}
                onChange={(e) => handleChange('query', e.target.value)}
              />
            </Form.Item>
            <Form.Item label={t('nodeConfig.topK')}>
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
            <Form.Item label={t('nodeConfig.method')}>
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
            <Form.Item label={t('nodeConfig.headers')}>
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
            <Form.Item label={t('nodeConfig.body')}>
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
            <Form.Item label={t('nodeConfig.conditionType')}>
              <Select
                value={nodeData.condition_type || 'contains'}
                onChange={(value) => handleChange('condition_type', value)}
              >
                <Option value="contains">{t('nodeConfig.condition.contains')}</Option>
                <Option value="equals">{t('nodeConfig.condition.equals')}</Option>
                <Option value="expression">{t('nodeConfig.condition.expression')}</Option>
                <Option value="not_empty">{t('nodeConfig.condition.notEmpty')}</Option>
                <Option value="regex">{t('nodeConfig.condition.regex')}</Option>
              </Select>
            </Form.Item>
            <Form.Item label={t('nodeConfig.conditionExpr')} required>
              <TextArea
                rows={4}
                placeholder={t('nodeConfig.conditionExprPh')}
                value={nodeData.condition || ''}
                onChange={(e) => handleChange('condition', e.target.value)}
              />
            </Form.Item>
            <Form.Item label={t('nodeConfig.trueLabel')}>
              <Input
                placeholder={t('nodeConfig.yes')}
                value={nodeData.true_label || ''}
                onChange={(e) => handleChange('true_label', e.target.value)}
              />
            </Form.Item>
            <Form.Item label={t('nodeConfig.falseLabel')}>
              <Input
                placeholder={t('nodeConfig.no')}
                value={nodeData.false_label || ''}
                onChange={(e) => handleChange('false_label', e.target.value)}
              />
            </Form.Item>
          </Form>
        );

      default:
        return (
          <div style={{ color: 'var(--custom-text-secondary)', textAlign: 'center', padding: 40 }}>
            {t('nodeConfig.unknownType')}
          </div>
        );
    }
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: typeInfo.color, fontSize: 18 }}>{typeInfo.icon}</span>
          <Text strong>{t(typeInfo.labelKey)}</Text>
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
        <Empty description={t('nodeConfig.pickNode')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Drawer>
  );
};

export default NodeConfigPanel;
