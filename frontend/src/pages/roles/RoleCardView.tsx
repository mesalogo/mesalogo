import React from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Space,
  Button,
  Tooltip,
  Typography,
  Empty,
  Skeleton
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  GlobalOutlined,
  TeamOutlined,
  LockOutlined
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface RoleCardViewProps {
  roles: any[];
  models: any[];
  loading: boolean;
  onEdit: (role: any) => void;
  onDelete: (roleId: string) => void;
}

const RoleCardView: React.FC<RoleCardViewProps> = ({
  roles,
  models,
  loading,
  onEdit,
  onDelete
}) => {
  const getModelBadge = (model: string) => {
    const modelColors: Record<string, string> = {
      'gpt-4': 'cyan',
      'gpt-3.5-turbo': 'blue',
      'claude-3-opus': 'purple',
      'claude-3-sonnet': 'geekblue',
      'gemini-pro': 'green',
      'llama-3': 'orange',
    };
    return modelColors[model] || 'default';
  };

  const getSourceTag = (created_by: any, is_shared: boolean) => {
    if (!created_by) {
      return (
        <Tooltip title="系统资源，所有用户可见可用">
          <Tag icon={<GlobalOutlined style={{ fontSize: '10px' }} />} color="blue" style={{ fontSize: '11px', margin: 0 }}>系统</Tag>
        </Tooltip>
      );
    }
    if (is_shared) {
      return (
        <Tooltip title="用户共享资源，所有用户可见可用">
          <Tag icon={<TeamOutlined style={{ fontSize: '10px' }} />} color="green" style={{ fontSize: '11px', margin: 0 }}>共享</Tag>
        </Tooltip>
      );
    }
    return (
      <Tooltip title="私有资源，仅创建者可见">
        <Tag icon={<LockOutlined style={{ fontSize: '10px' }} />} color="orange" style={{ fontSize: '11px', margin: 0 }}>私有</Tag>
      </Tooltip>
    );
  };

  const renderModelInfo = (role: any) => {
    if (role.source === 'external') {
      const platformType = role.external_type || 'custom';
      const platformColors: Record<string, string> = {
        'openai': 'blue',
        'dify': 'green',
        'fastgpt': 'cyan',
        'coze': 'purple',
        'custom': 'orange'
      };
      const platformLabels: Record<string, string> = {
        'openai': 'OpenAI',
        'dify': 'Dify',
        'fastgpt': 'FastGPT',
        'coze': 'Coze',
        'custom': '自定义'
      };
      const label = platformLabels[platformType] || platformType;
      return (
        <Tooltip title={label}>
          <Tag color={platformColors[platformType] || 'orange'} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </Tag>
        </Tooltip>
      );
    }

    if (role.model === null || role.model === undefined || role.model === '') {
      const defaultModel = models.find(m => m.is_default_text) || models.find(m => m.is_default);
      const label = `默认文本生成${defaultModel ? ` (${defaultModel.name})` : ''}`;
      return (
        <Tooltip title={label}>
          <Tag color={getModelBadge(defaultModel?.model_id)} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </Tag>
        </Tooltip>
      );
    }

    const modelConfig = models.find(m => m.id.toString() === role.model?.toString());
    const label = role.model_name || modelConfig?.name || '默认';
    return (
      <Tooltip title={label}>
        <Tag color={getModelBadge(modelConfig?.model_id)} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </Tag>
      </Tooltip>
    );
  };

  if (loading) {
    return (
      <Row gutter={[24, 24]}>
        {[1, 2, 3, 4, 5, 6].map(item => (
          <Col xs={24} sm={24} md={12} lg={8} xl={8} key={item}>
            <Card>
              <Skeleton active paragraph={{ rows: 6 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <Empty description="暂无角色数据" />
      </Card>
    );
  }

  const cardStyle = {
    height: '100%',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column' as const
  };

  const cardBodyStyle = {
    padding: '12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const
  };

  return (
    <Row gutter={[20, 20]}>
      {roles.map(role => (
        <Col xs={24} sm={24} md={12} lg={8} xl={6} key={role.id}>
          <Card
            hoverable
            style={cardStyle}
            styles={{ body: cardBodyStyle }}
            actions={[
              <Tooltip title="编辑" key="edit">
                <EditOutlined
                  style={{ color: '#1677ff' }}
                  onClick={() => onEdit(role)}
                />
              </Tooltip>,
              <Tooltip title="删除" key="delete">
                <DeleteOutlined
                  style={{ color: '#ff4d4f' }}
                  onClick={() => onDelete(role.id)}
                />
              </Tooltip>
            ]}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {/* 头部：名称和标签 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Space>
                    <UserOutlined style={{ color: '#1677ff', fontSize: '16px' }} />
                    <Text strong style={{ fontSize: '15px' }}>{role.name}</Text>
                  </Space>
                  <Space size={4}>
                    <Tag color={role.source === 'external' ? 'green' : 'blue'} style={{ fontSize: '11px', margin: 0 }}>
                      {role.source === 'external' ? '外部' : '内部'}
                    </Tag>
                    {getSourceTag(role.created_by, role.is_shared)}
                  </Space>
                </div>
                {/* 模型信息 */}
                <div style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {renderModelInfo(role)}
                </div>

                {/* 描述 */}
                {role.description && (
                  <div>
                    <Paragraph
                      ellipsis={{ rows: 2, tooltip: role.description }}
                      style={{ margin: 0, color: '#595959', fontSize: '13px', lineHeight: '1.6' }}
                    >
                      {role.description}
                    </Paragraph>
                  </div>
                )}

                {/* 系统提示词 */}
                {role.system_prompt && (
                  <div style={{
                    padding: '10px 12px',
                    background: '#fafafa',
                    borderRadius: '6px',
                    borderLeft: '3px solid #1890ff'
                  }}>
                    <Paragraph
                      ellipsis={{ rows: 2, tooltip: { title: role.system_prompt, overlayStyle: { maxWidth: '600px' } } }}
                      style={{ margin: 0, fontSize: '12px', color: '#8c8c8c', lineHeight: '1.5' }}
                    >
                      {role.system_prompt}
                    </Paragraph>
                  </div>
                )}

                {/* 分隔线 */}
                <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />

                {/* 能力和知识库 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* 绑定能力 */}
                  <div>
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>能力</Text>
                      {role.capabilities?.length > 0 && (
                        <Tag color="blue" style={{ fontSize: '11px', margin: 0, padding: '0 6px' }}>
                          {role.capabilities.length}
                        </Tag>
                      )}
                    </div>
                    {role.capabilities && role.capabilities.length > 0 ? (
                      <Space wrap size={[6, 6]}>
                        {role.capabilities.slice(0, 3).map((cap: any) => (
                          <Tag key={cap.id} color="blue" style={{ fontSize: '11px', margin: 0 }}>
                            {cap.name}
                          </Tag>
                        ))}
                        {role.capabilities.length > 3 && (
                          <Tooltip
                            title={
                              <div>
                                {role.capabilities.slice(3).map((cap: any) => (
                                  <div key={cap.id}>{cap.name}</div>
                                ))}
                              </div>
                            }
                          >
                            <Tag color="default" style={{ fontSize: '11px', cursor: 'pointer', margin: 0 }}>
                              +{role.capabilities.length - 3}
                            </Tag>
                          </Tooltip>
                        )}
                      </Space>
                    ) : (
                      <Text type="secondary" style={{ fontSize: '12px' }}>-</Text>
                    )}
                  </div>

                  {/* 绑定知识库 */}
                  <div>
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>知识库</Text>
                      {role.allKnowledges?.length > 0 && (
                        <Space size={4}>
                          {role.internalKnowledges?.length > 0 && (
                            <Tag color="blue" style={{ fontSize: '11px', margin: 0, padding: '0 6px' }}>
                              {role.internalKnowledges.length}
                            </Tag>
                          )}
                          {role.externalKnowledges?.length > 0 && (
                            <Tag color="green" style={{ fontSize: '11px', margin: 0, padding: '0 6px' }}>
                              {role.externalKnowledges.length}
                            </Tag>
                          )}
                        </Space>
                      )}
                    </div>
                    {role.allKnowledges && role.allKnowledges.length > 0 ? (
                      <Space wrap size={[6, 6]}>
                        {role.allKnowledges.slice(0, 3).map((kb: any, index: number) => (
                          <Tag
                            key={`${kb.id}-${index}`}
                            color={kb.provider_name ? 'green' : 'blue'}
                            style={{ fontSize: '11px', margin: 0 }}
                          >
                            {kb.name}
                          </Tag>
                        ))}
                        {role.allKnowledges.length > 3 && (
                          <Tooltip
                            title={
                              <div>
                                {role.allKnowledges.slice(3).map((kb: any, index: number) => (
                                  <div key={`${kb.id}-${index}`}>
                                    {kb.name} {kb.provider_name && `(${kb.provider_name})`}
                                  </div>
                                ))}
                              </div>
                            }
                          >
                            <Tag color="default" style={{ fontSize: '11px', cursor: 'pointer', margin: 0 }}>
                              +{role.allKnowledges.length - 3}
                            </Tag>
                          </Tooltip>
                        )}
                      </Space>
                    ) : (
                      <Text type="secondary" style={{ fontSize: '12px' }}>-</Text>
                    )}
                  </div>

                  {/* 绑定技能 */}
                  <div>
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>技能</Text>
                      {role.skills?.length > 0 && (
                        <Tag color="purple" style={{ fontSize: '11px', margin: 0, padding: '0 6px' }}>
                          {role.skills.length}
                        </Tag>
                      )}
                    </div>
                    {role.skills && role.skills.length > 0 ? (
                      <Space wrap size={[6, 6]}>
                        {role.skills.slice(0, 3).map((skill: any) => (
                          <Tag key={skill.id} color="purple" style={{ fontSize: '11px', margin: 0 }}>
                            📦 {skill.display_name || skill.name}
                          </Tag>
                        ))}
                        {role.skills.length > 3 && (
                          <Tooltip
                            title={
                              <div>
                                {role.skills.slice(3).map((skill: any) => (
                                  <div key={skill.id}>📦 {skill.display_name || skill.name}</div>
                                ))}
                              </div>
                            }
                          >
                            <Tag color="default" style={{ fontSize: '11px', cursor: 'pointer', margin: 0 }}>
                              +{role.skills.length - 3}
                            </Tag>
                          </Tooltip>
                        )}
                      </Space>
                    ) : (
                      <Text type="secondary" style={{ fontSize: '12px' }}>-</Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default React.memo(RoleCardView);
