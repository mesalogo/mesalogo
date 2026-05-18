// ActionSpaceDetail.tsx
// Action-space detail page split out of ActionSpaceOverview.
//
// i18n: all user-visible strings use the `actionspace` namespace via
// `useTranslation('actionspace')`. Do not re-introduce hardcoded CJK; add new
// keys to `src/locales/{zh-CN,en-US}/actionspace.ts` and reuse `t()`.

import React, { useState, useEffect } from 'react';
import {
  Card, Button, Table, Tabs, Empty,
  Space, Modal, Form, Input, message,
  Typography, Tag, Select, Skeleton, Collapse, Row, Col, Checkbox
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  ArrowLeftOutlined, SaveOutlined, CloseOutlined, TeamOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../services/api/actionspace';
import { roleAPI } from '../../services/api/role';
import { useParams, useNavigate } from 'react-router-dom';
import RuleSetAssociation from './RuleSetAssociation';
import ObserverManagement from './ObserverManagement';
import SharedVariableBinding from './Variable/components/SharedVariableBinding';
import { OrchestrationTab } from './orchestration';



const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ActionSpaceDetail = () => {
  const { t } = useTranslation('actionspace');
  const { id } = useParams(); // 从URL参数获取空间ID
  const navigate = useNavigate();

  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setModelConfigs] = useState<any[]>([]);

  // Environment-variable state
  const [envVarModalVisible, setEnvVarModalVisible] = useState(false);
  const [envVarForm] = Form.useForm();
  const [editingEnvVar, setEditingEnvVar] = useState<any>(null);
  const [currentRoleId, setCurrentRoleId] = useState<any>(null);
  const [envVarType, setEnvVarType] = useState<'space' | 'role'>('space');

  // Role state
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleForm] = Form.useForm();
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<any[]>([]);

  // Tag state
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<any[]>([]);

  // Basic-info edit state
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [basicInfoForm] = Form.useForm();

  // Tab state
  const [activeTabKey, setActiveTabKey] = useState('basic');



  // Fetch space detail (with roles + role variables)
  const fetchSpaceDetail = async () => {
    setLoading(true);
    try {
      const spaceDetail = await actionSpaceAPI.getDetail(id);
      const roles = await actionSpaceAPI.getRoles(id);

      const rolesWithVars = await Promise.all((roles || []).map(async (role: any) => {
        try {
          const variables = await roleAPI.getVariables(role.id, id);
          return { ...role, environment_variables: variables || [] };
        } catch (error) {
          console.error('fetch role variables failed:', error);
          return { ...role, environment_variables: [] };
        }
      }));

      const spaceWithRoles = {
        ...spaceDetail,
        roles: rolesWithVars || []
      };

      setSelectedSpace(spaceWithRoles);
    } catch (error) {
      console.error('fetch action-space detail failed:', error);
      message.error(t('actionSpaceDetail.roles.fetchDetailFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch model configurations
  const fetchModelConfigs = async () => {
    try {
      const models = await roleAPI.getModelConfigs();
      setModelConfigs(models);
      return models;
    } catch (error) {
      console.error('fetch model configs failed:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchSpaceDetail();
    fetchModelConfigs();
  }, [id]);



  // Fetch available roles
  const fetchAvailableRoles = async () => {
    try {
      const roles = await roleAPI.getAvailableRoles();
      setAvailableRoles(roles);
    } catch (error) {
      console.error('fetch available roles failed:', error);
      message.error(t('actionSpaceDetail.roles.fetchAvailableFailed'));
    }
  };

  useEffect(() => {
    if (roleModalVisible) {
      fetchAvailableRoles();
    }
  }, [roleModalVisible]);

  // Render tags (editable)
  const renderTags = (tags: any[] = []) => {
    return (
      <Space size={[0, 8]} wrap>
        <Tag
          style={{
            background: 'var(--custom-card-bg)',
            borderStyle: 'dashed',
            borderColor: 'var(--custom-border)',
            color: 'var(--custom-text-secondary)',
            marginRight: 4,
            marginBottom: 4,
            borderRadius: 4,
            fontSize: '12px',
            padding: '2px 8px'
          }}
          icon={<PlusOutlined />}
          onClick={handleAddTag}
        >
          {t('actionSpaceDetail.tag.add')}
        </Tag>

        {tags && tags.length > 0 && tags.map((tag: any) => (
          <Tag
            key={tag.id}
            color={tag.color || '#1677ff'}
            style={{
              marginRight: 4,
              marginBottom: 4,
              borderRadius: 4,
              fontSize: '12px',
              padding: '2px 8px'
            }}
          >
            {tag.name}
          </Tag>
        ))}
      </Space>
    );
  };

  const fetchAvailableTags = async () => {
    setTagsLoading(true);
    try {
      const tags = await actionSpaceAPI.getAllTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('fetch tag list failed:', error);
      message.error(t('actionSpaceDetail.tag.fetchFailed'));
    } finally {
      setTagsLoading(false);
    }
  };

  const handleAddTag = () => {
    const existingTagIds = selectedSpace.tags?.map((tag: any) => tag.id) || [];
    setSelectedTagIds(existingTagIds);
    setTagModalVisible(true);
    fetchAvailableTags();
  };



  const handleTagSelect = (tagId: any) => {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const handleConfirmAddTags = async () => {
    try {
      const existingTagIds = selectedSpace.tags?.map((tag: any) => tag.id) || [];

      const tagsToAdd = selectedTagIds.filter(tagId => !existingTagIds.includes(tagId));
      const tagsToRemove = existingTagIds.filter((tagId: any) => !selectedTagIds.includes(tagId));

      const operations: Array<Promise<any>> = [];

      if (tagsToAdd.length > 0) {
        const addPromises = tagsToAdd.map(tagId =>
          actionSpaceAPI.addTag(selectedSpace.id, tagId)
        );
        operations.push(...addPromises);
      }

      if (tagsToRemove.length > 0) {
        const removePromises = tagsToRemove.map((tagId: any) =>
          actionSpaceAPI.removeTag(selectedSpace.id, tagId)
        );
        operations.push(...removePromises);
      }

      if (operations.length > 0) {
        await Promise.all(operations);

        let message_text = '';
        if (tagsToAdd.length > 0 && tagsToRemove.length > 0) {
          message_text = t('actionSpaceDetail.tag.opMixed', { added: tagsToAdd.length, removed: tagsToRemove.length });
        } else if (tagsToAdd.length > 0) {
          message_text = t('actionSpaceDetail.tag.opAddOnly', { count: tagsToAdd.length });
        } else if (tagsToRemove.length > 0) {
          message_text = t('actionSpaceDetail.tag.opRemoveOnly', { count: tagsToRemove.length });
        }

        message.success(message_text);
      } else {
        message.info(t('actionSpaceDetail.tag.opNoChange'));
      }

      setTagModalVisible(false);
      setSelectedTagIds([]);
      fetchSpaceDetail();
    } catch (error) {
      console.error('tag operation failed:', error);
      message.error(t('actionSpaceDetail.tag.opFailed'));
    }
  };

  const handleCancelAddTags = () => {
    setTagModalVisible(false);
    setSelectedTagIds([]);
  };

  // Basic info editing
  const handleEditBasicInfo = () => {
    if (!selectedSpace) return;

    basicInfoForm.setFieldsValue({
      name: selectedSpace.name,
      description: selectedSpace.description,
      background: selectedSpace.settings?.background || '',
      rules: selectedSpace.settings?.rules || '',
      is_shared: selectedSpace.is_shared || false
    });

    setIsEditingBasicInfo(true);
  };

  const handleSaveBasicInfo = async () => {
    try {
      const values = await basicInfoForm.validateFields();

      const updateData = {
        name: values.name,
        description: values.description,
        is_shared: values.is_shared || false,
        settings: {
          ...selectedSpace.settings,
          background: values.background,
          rules: values.rules
        }
      };

      await actionSpaceAPI.update(selectedSpace.id, updateData);
      message.success(t('actionSpaceDetail.basicInfoUpdateSuccess'));
      setIsEditingBasicInfo(false);
      fetchSpaceDetail();
    } catch (error) {
      console.error('update basic info failed:', error);
      message.error(t('actionSpaceDetail.basicInfoUpdateFailed'));
    }
  };

  const handleCancelEditBasicInfo = () => {
    setIsEditingBasicInfo(false);
    basicInfoForm.resetFields();
  };

  // Role management
  const handleAddRole = () => {
    roleForm.resetFields();
    setEditingRole(null);
    setSelectedRoleIds([]);
    setRoleModalVisible(true);
  };

  const handleEditRole = (role: any) => {
    setEditingRole(role);

    const roleId = role.id;

    roleForm.setFieldsValue({
      role_id: roleId.toString(),
      additional_prompt: role.additional_prompt || ''
    });
    setRoleModalVisible(true);
  };

  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();

      if (!selectedSpace) {
        message.error(t('actionSpaceDetail.roles.spaceRequired'));
        return;
      }

      if (editingRole) {
        const roleData = {
          role_id: values.role_id,
          additional_prompt: values.additional_prompt || ''
        };
        await actionSpaceAPI.updateRole(selectedSpace.id, editingRole.id, roleData);
        message.success(t('actionSpaceDetail.roles.updateSuccess'));
      } else {
        if (Array.isArray(values.role_ids) && values.role_ids.length > 0) {
          const rolePrompts = values.rolePrompts || {};

          const addRolePromises = values.role_ids.map((roleId: any) => {
            const roleData = {
              role_id: roleId,
              additional_prompt: rolePrompts[roleId] || ''
            };
            return actionSpaceAPI.addRole(selectedSpace.id, roleData);
          });

          await Promise.all(addRolePromises);
          message.success(t('actionSpaceDetail.roles.addedNCount', { count: values.role_ids.length }));
        } else if (values.role_id) {
          const roleData = {
            role_id: values.role_id,
            additional_prompt: values.additional_prompt || ''
          };
          await actionSpaceAPI.addRole(selectedSpace.id, roleData);
          message.success(t('actionSpaceDetail.roles.addSuccess'));
        } else {
          message.error(t('actionSpaceDetail.roles.atLeastOne'));
          return;
        }
      }

      setRoleModalVisible(false);
      fetchSpaceDetail();
    } catch (error) {
      console.error('role operation failed:', error);
      message.error(t('actionSpaceDetail.roles.opFailed'));
    }
  };

  const handleDeleteRole = async (roleId: any) => {
    if (!selectedSpace || !roleId) return;

    try {
      await actionSpaceAPI.deleteRole(selectedSpace.id, roleId);
      message.success(t('actionSpaceDetail.roles.deleteSuccess'));
      fetchSpaceDetail();
    } catch (error) {
      console.error('delete role failed:', error);
      message.error(t('actionSpaceDetail.roles.deleteFailed'));
    }
  };

  // Environment variables
  const handleAddSpaceEnvVar = () => {
    envVarForm.resetFields();
    setEditingEnvVar(null);
    setEnvVarType('space');
    setEnvVarModalVisible(true);
  };

  const handleEditSpaceEnvVar = (envVar: any) => {
    setEditingEnvVar(envVar);
    envVarForm.setFieldsValue({
      name: envVar.name,
      label: envVar.label,
      value: envVar.value
    });
    setEnvVarType('space');
    setEnvVarModalVisible(true);
  };

  const handleDeleteSpaceEnvVar = (envVar: any) => {
    Modal.confirm({
      title: t('actionSpaceDetail.env.deleteConfirmTitle'),
      content: t('actionSpaceDetail.env.deleteSpaceVarContent', { name: envVar.name }),
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteSpaceEnvVar(selectedSpace.id, envVar.id);
          message.success(t('actionSpaceDetail.env.deleteSpaceSuccess'));
          fetchSpaceDetail();
        } catch (error) {
          console.error('delete space env var failed:', error);
          message.error(t('actionSpaceDetail.env.deleteSpaceFailed'));
        }
      }
    });
  };

  const handleAddRoleVarForRole = (roleId: any) => {
    envVarForm.resetFields();
    setEditingEnvVar(null);
    setCurrentRoleId(roleId);
    setEnvVarType('role');
    setEnvVarModalVisible(true);
  };

  const handleEditRoleEnvVar = (envVar: any, roleId: any) => {
    setEditingEnvVar(envVar);
    setCurrentRoleId(roleId);
    envVarForm.setFieldsValue({
      name: envVar.name,
      label: envVar.label,
      value: envVar.value
    });
    setEnvVarType('role');
    setEnvVarModalVisible(true);
  };

  const handleDeleteRoleEnvVar = (envVar: any, roleId: any) => {
    Modal.confirm({
      title: t('actionSpaceDetail.env.deleteConfirmTitle'),
      content: t('actionSpaceDetail.env.deleteRoleVarContent', { name: envVar.name }),
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteRoleEnvVar(selectedSpace.id, roleId, envVar.id);
          message.success(t('actionSpaceDetail.env.deleteRoleSuccess'));
          fetchSpaceDetail();
        } catch (error) {
          console.error('delete role env var failed:', error);
          message.error(t('actionSpaceDetail.env.deleteRoleFailed'));
        }
      }
    });
  };

  const handleEnvVarSubmit = async () => {
    try {
      const values = await envVarForm.validateFields();

      if (!selectedSpace) {
        message.error(t('actionSpaceDetail.env.spaceRequired'));
        return;
      }

      const envVarData = {
        name: values.name,
        label: values.label,
        value: values.value
      };

      if (envVarType === 'space') {
        if (editingEnvVar) {
          await actionSpaceAPI.updateSpaceEnvVar(selectedSpace.id, editingEnvVar.id, envVarData);
          message.success(t('actionSpaceDetail.env.spaceVarUpdated'));
        } else {
          await actionSpaceAPI.addSpaceEnvVar(selectedSpace.id, envVarData);
          message.success(t('actionSpaceDetail.env.spaceVarAdded'));
        }
      } else if (envVarType === 'role' && currentRoleId) {
        if (editingEnvVar) {
          await actionSpaceAPI.updateRoleEnvVar(selectedSpace.id, currentRoleId, editingEnvVar.id, envVarData);
          message.success(t('actionSpaceDetail.env.roleVarUpdated'));
        } else {
          await actionSpaceAPI.addRoleEnvVar(selectedSpace.id, currentRoleId, envVarData);
          message.success(t('actionSpaceDetail.env.roleVarAdded'));
        }
      }

      setEnvVarModalVisible(false);
      fetchSpaceDetail();
    } catch (error) {
      console.error('env var operation failed:', error);
      message.error(t('actionSpaceDetail.env.opFailed'));
    }
  };

  const handleBackToList = () => {
    navigate('/action-spaces/overview');
  };

  if (loading) {
    return (
      <div className="action-space-detail-page">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBackToList}
              disabled={true}
            >
              {t('actionSpaceDetail.backToList')}
            </Button>
            <Title level={3} style={{ margin: 0 }}>{t('actionSpaceDetail.loading')}</Title>
          </Space>
        </div>

        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
            </Space>
          </div>

          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            </Col>
            <Col span={24}>
              <Card>
                <Skeleton active avatar paragraph={{ rows: 5 }} />
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    );
  }

  if (!selectedSpace) {
    return (
      <Empty
        description={
          <span>
            {t('actionSpaceDetail.notFound')}
          </span>
        }
      />
    );
  }

  const envOp = editingEnvVar
    ? t('actionSpaceDetail.envModal.op.edit')
    : t('actionSpaceDetail.envModal.op.add');
  const envScope = envVarType === 'space'
    ? t('actionSpaceDetail.envModal.scope.space')
    : t('actionSpaceDetail.envModal.scope.role');
  const envModalTitle = t('actionSpaceDetail.envModal.title', { op: envOp, scope: envScope });
  const roleModalTitle = editingRole
    ? t('actionSpaceDetail.roles.modal.editTitle')
    : t('actionSpaceDetail.roles.modal.addTitle');

  return (
    <div className="action-space-detail-page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToList}
          >
            {t('actionSpaceDetail.backToList')}
          </Button>
          <Title level={3} style={{ margin: 0 }}>{selectedSpace.name}</Title>
        </Space>
      </div>

      <Tabs
        activeKey={activeTabKey}
        onChange={setActiveTabKey}
        items={[
          {
            key: 'basic',
            label: t('actionSpaceDetail.tab.basic'),
            children: (
              <Card
                title={t('actionSpaceDetail.basicInfo')}
                extra={
                  !isEditingBasicInfo ? (
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={handleEditBasicInfo}
                    >
                      {t('actionSpaceDetail.edit')}
                    </Button>
                  ) : (
                    <Space>
                      <Button
                        icon={<SaveOutlined />}
                        type="primary"
                        onClick={handleSaveBasicInfo}
                      >
                        {t('actionSpaceDetail.save')}
                      </Button>
                      <Button
                        icon={<CloseOutlined />}
                        onClick={handleCancelEditBasicInfo}
                      >
                        {t('actionSpaceDetail.cancel')}
                      </Button>
                    </Space>
                  )
                }
              >
                {!isEditingBasicInfo ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>{t('actionSpaceDetail.field.name')}</Title>
                      <Paragraph>{selectedSpace.name}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>{t('actionSpaceDetail.field.description')}</Title>
                      <Paragraph>{selectedSpace.description}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>{t('actionSpaceDetail.field.tags')}</Title>
                      {renderTags(selectedSpace.tags)}
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>{t('actionSpaceDetail.field.sharedStatus')}</Title>
                      <Paragraph>
                        {selectedSpace.is_shared ? (
                          <Tag icon={<TeamOutlined />} color="blue">{t('actionSpaceDetail.shared.yes')}</Tag>
                        ) : (
                          <Tag>{t('actionSpaceDetail.shared.no')}</Tag>
                        )}
                      </Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>{t('actionSpaceDetail.field.background')}</Title>
                      <Paragraph>{selectedSpace.settings?.background || t('actionSpaceDetail.empty.background')}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>{t('actionSpaceDetail.field.rules')}</Title>
                      <Paragraph>{selectedSpace.settings?.rules || t('actionSpaceDetail.empty.rules')}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>{t('actionSpaceDetail.field.oddFramework')}</Title>
                      <Paragraph style={{ color: 'var(--custom-text-secondary)' }}>
                        {selectedSpace.odd_framework?.purpose || t('actionSpaceDetail.empty.odd')}
                      </Paragraph>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('actionSpaceDetail.odd.readonly')}
                      </Text>
                    </div>
                  </>
                ) : (
                  <Form
                    form={basicInfoForm}
                    layout="vertical"
                  >
                    <Form.Item
                      name="name"
                      label={t('actionSpaceDetail.field.name')}
                      rules={[{ required: true, message: t('actionSpaceDetail.required.name') }]}
                    >
                      <Input placeholder={t('actionSpaceDetail.placeholder.name')} />
                    </Form.Item>

                    <Form.Item
                      name="description"
                      label={t('actionSpaceDetail.field.description')}
                      rules={[{ required: true, message: t('actionSpaceDetail.required.description') }]}
                    >
                      <TextArea rows={3} placeholder={t('actionSpaceDetail.placeholder.description')} />
                    </Form.Item>

                    <Form.Item label={t('actionSpaceDetail.field.tags')}>
                      <div>
                        {renderTags(selectedSpace.tags)}
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 8 }}>
                          {t('actionSpaceDetail.tagEditHint')}
                        </Text>
                      </div>
                    </Form.Item>

                    <Form.Item
                      name="is_shared"
                      valuePropName="checked"
                      tooltip={t('actionSpaceDetail.shared.tooltip')}
                    >
                      <Checkbox>
                        <Space>
                          <TeamOutlined />
                          {t('actionSpaceDetail.shared.toggle')}
                        </Space>
                      </Checkbox>
                    </Form.Item>

                    <Form.Item
                      name="background"
                      label={t('actionSpaceDetail.field.background')}
                    >
                      <TextArea rows={4} placeholder={t('actionSpaceDetail.placeholder.background')} />
                    </Form.Item>

                    <Form.Item
                      name="rules"
                      label={t('actionSpaceDetail.field.rules')}
                    >
                      <TextArea rows={4} placeholder={t('actionSpaceDetail.placeholder.rules')} />
                    </Form.Item>

                    <Form.Item label={t('actionSpaceDetail.field.oddFramework')}>
                      <div style={{ padding: '8px 12px', backgroundColor: 'var(--custom-hover-bg)', borderRadius: '6px' }}>
                        <Text type="secondary">
                          {selectedSpace.odd_framework?.purpose || t('actionSpaceDetail.empty.odd')}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {t('actionSpaceDetail.oddReadonly')}
                        </Text>
                      </div>
                    </Form.Item>
                  </Form>
                )}
              </Card>
            )
          },
          {
            key: 'roles',
            label: t('actionSpaceDetail.tab.roles'),
            children: (
              <Card
                title={t('actionSpaceDetail.roles.cardTitle')}
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddRole}
                  >
                    {t('actionSpaceDetail.roles.addBtn')}
                  </Button>
                }
              >
                <Paragraph>
                  {t('actionSpaceDetail.roles.intro')}
                </Paragraph>
                {selectedSpace.roles && selectedSpace.roles.length > 0 ? (
                  <Table
                    dataSource={selectedSpace.roles}
                    rowKey="id"
                    columns={[
                      {
                        title: t('actionSpaceDetail.roles.col.name'),
                        dataIndex: 'name',
                        key: 'name',
                        width: '20%',
                        render: (text: any, record: any) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{text}</span>
                            <Tag
                              color={record.source === 'external' ? 'orange' : 'blue'}
                            >
                              {record.source === 'external'
                                ? t('actionSpaceDetail.roles.tag.external')
                                : t('actionSpaceDetail.roles.tag.internal')}
                            </Tag>
                          </div>
                        )
                      },
                      { title: t('actionSpaceDetail.roles.col.description'), dataIndex: 'description', key: 'description', ellipsis: true, width: '25%' },
                      {
                        title: t('actionSpaceDetail.roles.col.additionalPrompt'),
                        dataIndex: 'additional_prompt',
                        key: 'additional_prompt',
                        ellipsis: true,
                        width: '30%',
                        render: (text: any) => text || t('actionSpaceDetail.roles.noAdditionalPrompt')
                      },
                      {
                        title: t('actionSpaceDetail.roles.col.actions'),
                        key: 'action',
                        width: '25%',
                        render: (_: any, record: any) => (
                          <Space>
                            <Button type="link" onClick={() => handleEditRole(record)}>{t('actionSpaceDetail.roles.col.edit')}</Button>
                            <Button type="link" danger onClick={() => handleDeleteRole(record.id)}>{t('actionSpaceDetail.roles.col.delete')}</Button>
                          </Space>
                        )
                      }
                    ]}
                  />
                ) : (
                  <Empty description={t('actionSpaceDetail.roles.empty')} />
                )}
              </Card>
            )
          },
          {
            key: 'observer',
            label: t('actionSpaceDetail.tab.observer'),
            children: <ObserverManagement actionSpaceId={id} onDataChange={fetchSpaceDetail} />
          },
          {
            key: 'environment',
            label: t('actionSpaceDetail.tab.environment'),
            children: (
              selectedSpace ? (
                <div>
                  <Card
                    title={t('actionSpaceDetail.env.spaceCardTitle')}
                    style={{ marginBottom: 16 }}
                    extra={
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddSpaceEnvVar}
                      >
                        {t('actionSpaceDetail.env.addBtn')}
                      </Button>
                    }
                  >
                    <Paragraph>
                      {t('actionSpaceDetail.env.spaceCardIntro')}
                    </Paragraph>
                    {selectedSpace.environment_variables && selectedSpace.environment_variables.length > 0 ? (
                      <Table
                        dataSource={selectedSpace.environment_variables}
                        rowKey="id"
                        columns={[
                          { title: t('actionSpaceDetail.env.col.name'), dataIndex: 'name', key: 'name' },
                          { title: t('actionSpaceDetail.env.col.label'), dataIndex: 'label', key: 'label' },
                          { title: t('actionSpaceDetail.env.col.type'), dataIndex: 'type', key: 'type', render: () => <Tag color="default">{t('actionSpaceDetail.env.type.text')}</Tag> },
                          {
                            title: t('actionSpaceDetail.env.col.value'),
                            dataIndex: 'value',
                            key: 'value',
                            render: (value: any) => String(value || '')
                          },
                          {
                            title: t('actionSpaceDetail.env.col.actions'),
                            key: 'action',
                            render: (_: any, record: any) => (
                              <Space>
                                <Button type="link" onClick={() => handleEditSpaceEnvVar(record)}>{t('actionSpaceDetail.roles.col.edit')}</Button>
                                <Button type="link" danger onClick={() => handleDeleteSpaceEnvVar(record)}>{t('actionSpaceDetail.roles.col.delete')}</Button>
                              </Space>
                            )
                          }
                        ]}
                      />
                    ) : (
                      <Empty description={t('actionSpaceDetail.env.emptySpace')} />
                    )}
                  </Card>

                  <Card
                    title={t('actionSpaceDetail.env.roleCardTitle')}
                  >
                    <Paragraph>
                      {t('actionSpaceDetail.env.roleCardIntro')}
                    </Paragraph>
                    {selectedSpace.roles && selectedSpace.roles.length > 0 ? (
                      <Collapse
                        items={selectedSpace.roles.map((role: any) => ({
                          key: role.id,
                          label: role.name,
                          extra: (
                            <Button
                              type="link"
                              icon={<PlusOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddRoleVarForRole(role.id);
                              }}
                            >
                              {t('actionSpaceDetail.env.addRoleVar')}
                            </Button>
                          ),
                          children: (
                            role.environment_variables && role.environment_variables.length > 0 ? (
                              <Table
                                dataSource={role.environment_variables}
                                rowKey="id"
                                columns={[
                                  { title: t('actionSpaceDetail.env.col.name'), dataIndex: 'name', key: 'name' },
                                  { title: t('actionSpaceDetail.env.col.label'), dataIndex: 'label', key: 'label' },
                                  { title: t('actionSpaceDetail.env.col.type'), dataIndex: 'type', key: 'type', render: () => <Tag color="default">{t('actionSpaceDetail.env.type.text')}</Tag> },
                                  { title: t('actionSpaceDetail.env.col.value'), dataIndex: 'value', key: 'value', render: (value: any) => String(value || '') },
                                  {
                                    title: t('actionSpaceDetail.env.col.actions'),
                                    key: 'action',
                                    render: (_: any, record: any) => (
                                      <Space>
                                        <Button type="link" onClick={() => handleEditRoleEnvVar(record, role.id)}>{t('actionSpaceDetail.roles.col.edit')}</Button>
                                        <Button type="link" danger onClick={() => handleDeleteRoleEnvVar(record, role.id)}>{t('actionSpaceDetail.roles.col.delete')}</Button>
                                      </Space>
                                    )
                                  }
                                ]}
                              />
                            ) : (
                              <Empty description={t('actionSpaceDetail.env.emptyRoleVars')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )
                          )
                        }))}
                      />
                    ) : (
                      <Empty description={t('actionSpaceDetail.env.emptyRoles')} />
                    )}
                  </Card>

                  <div style={{ marginTop: 16 }}>
                    <SharedVariableBinding
                      actionSpaceId={id}
                      onDataChange={fetchSpaceDetail}
                    />
                  </div>
                </div>
              ) : (
                <Empty description={t('actionSpaceDetail.env.spaceRequired')} />
              )
            )
          },
          {
            key: 'rules',
            label: t('actionSpaceDetail.tab.rules'),
            children: <RuleSetAssociation actionSpaceId={id} />
          },
          {
            key: 'orchestration',
            label: t('actionSpaceDetail.tab.orchestration'),
            children: (
              <OrchestrationTab
                actionSpaceId={id}
                settings={selectedSpace.settings}
                roles={selectedSpace.roles || []}
                onSave={fetchSpaceDetail}
              />
            )
          },

        ]}
      />

      {/* Environment-variable modal */}
      <Modal
        title={envModalTitle}
        open={envVarModalVisible}
        onCancel={() => setEnvVarModalVisible(false)}
        onOk={handleEnvVarSubmit}
        width={600}
      >
        <Form
          form={envVarForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={t('actionSpaceDetail.envModal.field.name')}
            rules={[
              { required: true, message: t('actionSpaceDetail.envModal.required.name') },
              {
                pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                message: t('actionSpaceDetail.envModal.namePattern')
              }
            ]}
          >
            <Input placeholder={t('actionSpaceDetail.envModal.placeholder.name')} />
          </Form.Item>

          <Form.Item
            name="label"
            label={t('actionSpaceDetail.envModal.field.label')}
            rules={[{ required: true, message: t('actionSpaceDetail.envModal.required.label') }]}
          >
            <Input placeholder={t('actionSpaceDetail.envModal.placeholder.label')} />
          </Form.Item>

          <Form.Item
            name="value"
            label={t('actionSpaceDetail.envModal.field.value')}
            rules={[{ required: true, message: t('actionSpaceDetail.envModal.required.value') }]}
          >
            <Input placeholder={t('actionSpaceDetail.envModal.placeholder.value')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Role modal */}
      <Modal
        title={roleModalTitle}
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        onOk={handleRoleSubmit}
        width={800}
      >
        <Form
          form={roleForm}
          layout="vertical"
        >
          {editingRole ? (
            <>
              <Form.Item
                name="role_id"
                label={t('actionSpaceDetail.roles.modal.selectLabel')}
                rules={[{ required: true, message: t('actionSpaceDetail.roles.modal.selectRequired') }]}
              >
                <Select
                  placeholder={t('actionSpaceDetail.roles.modal.selectPlaceholder')}
                  optionFilterProp="children"
                  showSearch
                  disabled={true}
                >
                  {availableRoles.map((role: any) => (
                    <Option key={role.id} value={role.id.toString()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{role.name}</span>
                        <Tag color={role.source === 'external' ? 'orange' : 'blue'}>
                          {role.source === 'external'
                            ? t('actionSpaceDetail.roles.tag.external')
                            : t('actionSpaceDetail.roles.tag.internal')}
                        </Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="additional_prompt"
                label={t('actionSpaceDetail.roles.modal.promptLabel')}
              >
                <TextArea
                  placeholder={t('actionSpaceDetail.roles.modal.promptPlaceholder')}
                  rows={4}
                  maxLength={1000}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="role_ids"
                label={t('actionSpaceDetail.roles.modal.selectLabel')}
                rules={[{ required: true, message: t('actionSpaceDetail.roles.modal.selectMultiRequired') }]}
              >
                <Select
                  mode="multiple"
                  placeholder={t('actionSpaceDetail.roles.modal.selectMultiPlaceholder')}
                  optionFilterProp="children"
                  showSearch
                  onChange={(values) => setSelectedRoleIds(values)}
                  style={{ width: '100%' }}
                >
                  {availableRoles.map((role: any) => (
                    <Option key={role.id} value={role.id.toString()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{role.name}</span>
                        <Tag color={role.source === 'external' ? 'orange' : 'blue'}>
                          {role.source === 'external'
                            ? t('actionSpaceDetail.roles.tag.external')
                            : t('actionSpaceDetail.roles.tag.internal')}
                        </Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label={t('actionSpaceDetail.roles.modal.perRolePromptLabel')}
              >
                <Form.List name="rolePrompts">
                  {() => (
                    <>
                      {selectedRoleIds.map(roleId => {
                        const role = availableRoles.find((r: any) => r.id.toString() === roleId);
                        return (
                          <div key={roleId} style={{ marginBottom: 16, border: '1px solid var(--custom-border)', padding: 16, borderRadius: 4 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                              {role ? role.name : t('actionSpaceDetail.roles.modal.roleIdLabel', { id: roleId })}
                            </div>
                            <Form.Item
                              name={roleId}
                              noStyle
                            >
                              <TextArea
                                placeholder={t('actionSpaceDetail.roles.modal.perRolePromptPlaceholder')}
                                rows={3}
                                maxLength={1000}
                              />
                            </Form.Item>
                          </div>
                        );
                      })}
                      {selectedRoleIds.length === 0 && (
                        <div style={{ color: 'var(--custom-text-secondary)', fontStyle: 'italic' }}>
                          {t('actionSpaceDetail.roles.modal.perRoleHint')}
                        </div>
                      )}
                    </>
                  )}
                </Form.List>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Tag-selection modal */}
      <Modal
        title={t('actionSpaceDetail.tag.modalTitle')}
        open={tagModalVisible}
        onCancel={handleCancelAddTags}
        footer={[
          <Button key="cancel" onClick={handleCancelAddTags}>
            {t('actionSpaceDetail.tag.cancel')}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleConfirmAddTags}
          >
            {t('actionSpaceDetail.tag.confirm')} {selectedTagIds.length > 0 ? `(${selectedTagIds.length})` : ''}
          </Button>
        ]}
        width={600}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {tagsLoading ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              {[1, 2].map(item => (
                <Card key={item}>
                  <Skeleton active paragraph={{ rows: 1 }} />
                </Card>
              ))}
            </Space>
          ) : (
            <>
              {availableTags.length === 0 ? (
                <Empty description={t('actionSpaceDetail.tag.empty')} />
              ) : (
                <div>
                  <Title level={5} style={{ marginBottom: 12 }}>{t('actionSpaceDetail.tag.industry')}</Title>
                  <div style={{ marginBottom: 16 }}>
                    {availableTags
                      .filter((tag: any) => tag.type === 'industry')
                      .map((tag: any) => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        return (
                          <Tag
                            key={tag.id}
                            color={isSelected ? tag.color : undefined}
                            style={{
                              marginRight: 8,
                              marginBottom: 8,
                              cursor: 'pointer',
                              borderRadius: 4,
                              fontSize: '12px',
                              padding: '4px 12px',
                              border: isSelected ? 'none' : `1px solid ${tag.color}`,
                              backgroundColor: isSelected ? tag.color : 'transparent',
                              color: isSelected ? '#fff' : tag.color,
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => handleTagSelect(tag.id)}
                          >
                            {tag.name}
                          </Tag>
                        );
                      })}
                  </div>

                  <Title level={5} style={{ marginBottom: 12 }}>{t('actionSpaceDetail.tag.scenario')}</Title>
                  <div style={{ marginBottom: 16 }}>
                    {availableTags
                      .filter((tag: any) => tag.type === 'scenario')
                      .map((tag: any) => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        return (
                          <Tag
                            key={tag.id}
                            color={isSelected ? tag.color : undefined}
                            style={{
                              marginRight: 8,
                              marginBottom: 8,
                              cursor: 'pointer',
                              borderRadius: 4,
                              fontSize: '12px',
                              padding: '4px 12px',
                              border: isSelected ? 'none' : `1px solid ${tag.color}`,
                              backgroundColor: isSelected ? tag.color : 'transparent',
                              color: isSelected ? '#fff' : tag.color,
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => handleTagSelect(tag.id)}
                          >
                            {tag.name}
                          </Tag>
                        );
                      })}
                  </div>

                  {availableTags.filter((tag: any) => !selectedSpace.tags?.some((existingTag: any) => existingTag.id === tag.id)).length === 0 && (
                    <Text type="secondary">{t('actionSpaceDetail.tag.allAdded')}</Text>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ActionSpaceDetail;
