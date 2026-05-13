// ActionSpaceDetail.js
// 此文件包含行动空间详情页组件，从ActionSpaceOverview.js拆分出来

import React, { useState, useEffect } from 'react';
import {
  Card, Button, Table, Tabs, Empty,
  Space, Modal, Form, Input, message,
  Typography, Tag, Select, Radio, Dropdown, Menu, Skeleton, Collapse, InputNumber, Row, Col, Checkbox
} from 'antd';
import {
  PlusOutlined, TableOutlined, AppstoreOutlined,
  EditOutlined, DeleteOutlined, InfoCircleOutlined,
  FilterOutlined, EllipsisOutlined, LinkOutlined,
  ArrowLeftOutlined, SaveOutlined, CloseOutlined, TeamOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../services/api/actionspace';
import { roleAPI } from '../../services/api/role';
import api from '../../services/api/axios';
import { useParams, useNavigate } from 'react-router-dom';
import RuleSetAssociation from './RuleSetAssociation';
import ObserverManagement from './ObserverManagement';
import SharedVariableBinding from './Variable/components/SharedVariableBinding';
import { OrchestrationTab } from './orchestration';



const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

const ActionSpaceDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams(); // 从URL参数获取空间ID
  const navigate = useNavigate();

  const [selectedSpace, setSelectedSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modelConfigs, setModelConfigs] = useState([]);

  // 环境变量相关状态和方法
  const [envVarModalVisible, setEnvVarModalVisible] = useState(false);
  const [envVarForm] = Form.useForm();
  const [editingEnvVar, setEditingEnvVar] = useState(null);
  const [currentRoleId, setCurrentRoleId] = useState(null);
  const [envVarType, setEnvVarType] = useState('space'); // 'space' 或 'role'

  // 角色相关状态和方法
  const [editingRole, setEditingRole] = useState(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleForm] = Form.useForm();
  const [availableRoles, setAvailableRoles] = useState([]); // 存储可用的角色列表
  const [selectedRoleIds, setSelectedRoleIds] = useState([]); // 存储多选的角色ID

  // 标签管理相关状态
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]); // 多选标签ID列表

  // 基本信息编辑相关状态
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [basicInfoForm] = Form.useForm();

  // Tab管理状态
  const [activeTabKey, setActiveTabKey] = useState('basic');



  // 获取空间详情
  const fetchSpaceDetail = async () => {
    setLoading(true);
    try {
      // 获取行动空间详情
      const spaceDetail = await actionSpaceAPI.getDetail(id);

      // 获取该行动空间关联的角色
      const roles = await actionSpaceAPI.getRoles(id);

      // 为每个角色获取环境变量
      const rolesWithVars = await Promise.all((roles || []).map(async (role) => {
        try {
          const variables = await roleAPI.getVariables(role.id, id);
          return { ...role, environment_variables: variables || [] };
        } catch (error) {
          console.error(`获取角色变量失败:`, error);
          return { ...role, environment_variables: [] };
        }
      }));

      // 合并空间详情和角色信息（包含环境变量）
      const spaceWithRoles = {
        ...spaceDetail,
        roles: rolesWithVars || []
      };

      setSelectedSpace(spaceWithRoles);
    } catch (error) {
      console.error('获取行动空间详情失败:', error);
      message.error('获取行动空间详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取模型配置
  const fetchModelConfigs = async () => {
    try {
      const models = await roleAPI.getModelConfigs();
      setModelConfigs(models);
      return models;
    } catch (error) {
      console.error('获取模型配置失败:', error);
      return [];
    }
  };

  // 在组件加载时获取数据
  useEffect(() => {
    fetchSpaceDetail();
    fetchModelConfigs();
  }, [id]);



  // 根据模型ID获取模型名称
  const getModelNameById = (modelId) => {
    if (!modelId) return '未指定';

    const modelConfig = modelConfigs.find(m => m.id.toString() === modelId.toString());
    if (modelConfig) {
      return `${modelConfig.name} (${modelConfig.model_id})`;
    }

    // 如果没找到配置，返回ID
    return `模型 ID: ${modelId}`;
  };

  // 获取可用角色
  const fetchAvailableRoles = async () => {
    try {
      const roles = await roleAPI.getAvailableRoles();
      setAvailableRoles(roles);
    } catch (error) {
      console.error('获取可用角色失败:', error);
      message.error('获取可用角色失败');
    }
  };

  useEffect(() => {
    if (roleModalVisible) {
      fetchAvailableRoles();
    }
  }, [roleModalVisible]);

  // 渲染标签（支持编辑）
  const renderTags = (tags = []) => {
    return (
      <Space size={[0, 8]} wrap>
        {/* 添加标签按钮 */}
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
          添加标签
        </Tag>

        {/* 现有标签 */}
        {tags && tags.length > 0 && tags.map(tag => (
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

  // 获取可用标签
  const fetchAvailableTags = async () => {
    setTagsLoading(true);
    try {
      const tags = await actionSpaceAPI.getAllTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('获取标签列表失败:', error);
      message.error('获取标签列表失败');
    } finally {
      setTagsLoading(false);
    }
  };

  // 处理添加标签
  const handleAddTag = () => {
    // 初始化已添加的标签为选中状态
    const existingTagIds = selectedSpace.tags?.map(tag => tag.id) || [];
    setSelectedTagIds(existingTagIds);
    setTagModalVisible(true);
    fetchAvailableTags();
  };



  // 处理标签选择（多选）
  const handleTagSelect = (tagId) => {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) {
        // 如果已选中，则取消选中
        return prev.filter(id => id !== tagId);
      } else {
        // 如果未选中，则添加到选中列表
        return [...prev, tagId];
      }
    });
  };

  // 确认标签选择（支持添加和删除）
  const handleConfirmAddTags = async () => {
    try {
      const existingTagIds = selectedSpace.tags?.map(tag => tag.id) || [];

      // 找出需要添加的标签（在选中列表中但不在现有列表中）
      const tagsToAdd = selectedTagIds.filter(tagId => !existingTagIds.includes(tagId));

      // 找出需要删除的标签（在现有列表中但不在选中列表中）
      const tagsToRemove = existingTagIds.filter(tagId => !selectedTagIds.includes(tagId));

      const operations = [];

      // 添加新标签
      if (tagsToAdd.length > 0) {
        const addPromises = tagsToAdd.map(tagId =>
          actionSpaceAPI.addTag(selectedSpace.id, tagId)
        );
        operations.push(...addPromises);
      }

      // 删除取消选中的标签
      if (tagsToRemove.length > 0) {
        const removePromises = tagsToRemove.map(tagId =>
          actionSpaceAPI.removeTag(selectedSpace.id, tagId)
        );
        operations.push(...removePromises);
      }

      if (operations.length > 0) {
        await Promise.all(operations);

        let message_text = '';
        if (tagsToAdd.length > 0 && tagsToRemove.length > 0) {
          message_text = `成功添加 ${tagsToAdd.length} 个标签，移除 ${tagsToRemove.length} 个标签`;
        } else if (tagsToAdd.length > 0) {
          message_text = `成功添加 ${tagsToAdd.length} 个标签`;
        } else if (tagsToRemove.length > 0) {
          message_text = `成功移除 ${tagsToRemove.length} 个标签`;
        }

        message.success(message_text);
      } else {
        message.info('标签没有变化');
      }

      setTagModalVisible(false);
      setSelectedTagIds([]);
      fetchSpaceDetail(); // 重新获取数据
    } catch (error) {
      console.error('标签操作失败:', error);
      message.error('标签操作失败');
    }
  };

  // 取消添加标签
  const handleCancelAddTags = () => {
    setTagModalVisible(false);
    setSelectedTagIds([]);
  };

  // 基本信息编辑相关方法
  const handleEditBasicInfo = () => {
    if (!selectedSpace) return;

    // 设置表单初始值
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
      fetchSpaceDetail(); // 重新获取数据
    } catch (error) {
      console.error('更新基本信息失败:', error);
      message.error(t('actionSpaceDetail.basicInfoUpdateFailed'));
    }
  };

  const handleCancelEditBasicInfo = () => {
    setIsEditingBasicInfo(false);
    basicInfoForm.resetFields();
  };

  // 角色管理相关方法
  const handleAddRole = () => {
    roleForm.resetFields();
    setEditingRole(null);
    setSelectedRoleIds([]); // 重置选中的角色ID列表
    setRoleModalVisible(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);

    // 找到角色对应的角色ID
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
        message.error('请先选择一个行动空间');
        return;
      }

      if (editingRole) {
        // 更新已有角色
        const roleData = {
          role_id: values.role_id, // UUID格式，不需要parseInt
          additional_prompt: values.additional_prompt || ''
        };
        await actionSpaceAPI.updateRole(selectedSpace.id, editingRole.id, roleData);
        message.success('角色更新成功');
      } else {
        // 添加新角色 - 支持多选
        if (Array.isArray(values.role_ids) && values.role_ids.length > 0) {
          // 多角色添加
          const rolePrompts = values.rolePrompts || {};

          // 创建一个Promise数组来处理所有角色添加请求
          const addRolePromises = values.role_ids.map(roleId => {
            const roleData = {
              role_id: roleId, // UUID格式，不需要parseInt
              additional_prompt: rolePrompts[roleId] || ''
            };
            return actionSpaceAPI.addRole(selectedSpace.id, roleData);
          });

          // 等待所有角色添加完成
          await Promise.all(addRolePromises);
          message.success(`成功添加 ${values.role_ids.length} 个角色`);
        } else if (values.role_id) {
          // 单角色添加（兼容旧版本）
          const roleData = {
            role_id: values.role_id, // UUID格式，不需要parseInt
            additional_prompt: values.additional_prompt || ''
          };
          await actionSpaceAPI.addRole(selectedSpace.id, roleData);
          message.success('角色添加成功');
        } else {
          message.error('请至少选择一个角色');
          return;
        }
      }

      setRoleModalVisible(false);
      fetchSpaceDetail(); // 重新获取数据
    } catch (error) {
      console.error('角色操作失败:', error);
      message.error('角色操作失败');
    }
  };

  const handleViewRoleVars = (role) => {
    // 切换到环境变量标签页并聚焦到该角色的折叠面板
    setActiveTabKey('environment');
    setTimeout(() => {
      const element = document.querySelector(`div[data-node-key="${role.id}"]`) as HTMLElement;
      element?.click();
    }, 300);
  };

  const handleDeleteRole = async (roleId) => {
    if (!selectedSpace || !roleId) return;

    try {
      await actionSpaceAPI.deleteRole(selectedSpace.id, roleId);
      message.success('角色删除成功');
      fetchSpaceDetail(); // 重新获取数据
    } catch (error) {
      console.error('删除角色失败:', error);
      message.error('删除角色失败');
    }
  };

  // 环境变量相关方法
  const handleAddSpaceEnvVar = () => {
    envVarForm.resetFields();
    setEditingEnvVar(null);
    setEnvVarType('space');
    setEnvVarModalVisible(true);
  };

  const handleEditSpaceEnvVar = (envVar) => {
    setEditingEnvVar(envVar);
    envVarForm.setFieldsValue({
      name: envVar.name,
      label: envVar.label,
      value: envVar.value
    });
    setEnvVarType('space');
    setEnvVarModalVisible(true);
  };

  const handleDeleteSpaceEnvVar = (envVar) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除环境变量 "${envVar.name}" 吗？`,
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteSpaceEnvVar(selectedSpace.id, envVar.id);
          message.success('环境变量删除成功');
          fetchSpaceDetail(); // 重新获取数据
        } catch (error) {
          console.error('删除环境变量失败:', error);
          message.error('删除环境变量失败');
        }
      }
    });
  };

  const handleAddRoleVarForRole = (roleId) => {
    envVarForm.resetFields();
    setEditingEnvVar(null);
    setCurrentRoleId(roleId);
    setEnvVarType('role');
    setEnvVarModalVisible(true);
  };

  const handleEditRoleEnvVar = (envVar, roleId) => {
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

  const handleDeleteRoleEnvVar = (envVar, roleId) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色变量 "${envVar.name}" 吗？`,
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteRoleEnvVar(selectedSpace.id, roleId, envVar.id);
          message.success('角色变量删除成功');
          fetchSpaceDetail(); // 重新获取数据
        } catch (error) {
          console.error('删除角色变量失败:', error);
          message.error('删除角色变量失败');
        }
      }
    });
  };

  const handleEnvVarSubmit = async () => {
    try {
      const values = await envVarForm.validateFields();

      if (!selectedSpace) {
        message.error('请先选择一个行动空间');
        return;
      }

      // 构造请求数据，类型固定为text
      const envVarData = {
        name: values.name,
        label: values.label,
        value: values.value
      };

      if (envVarType === 'space') {
        // 空间级环境变量
        if (editingEnvVar) {
          // 更新
          await actionSpaceAPI.updateSpaceEnvVar(selectedSpace.id, editingEnvVar.id, envVarData);
          message.success('环境变量更新成功');
        } else {
          // 新增
          await actionSpaceAPI.addSpaceEnvVar(selectedSpace.id, envVarData);
          message.success('环境变量添加成功');
        }
      } else if (envVarType === 'role' && currentRoleId) {
        // 角色级环境变量
        if (editingEnvVar) {
          // 更新
          await actionSpaceAPI.updateRoleEnvVar(selectedSpace.id, currentRoleId, editingEnvVar.id, envVarData);
          message.success('角色变量更新成功');
        } else {
          // 新增
          await actionSpaceAPI.addRoleEnvVar(selectedSpace.id, currentRoleId, envVarData);
          message.success('角色变量添加成功');
        }
      }

      setEnvVarModalVisible(false);
      fetchSpaceDetail(); // 重新获取数据
    } catch (error) {
      console.error('环境变量操作失败:', error);
      message.error('环境变量操作失败');
    }
  };

  // 返回列表页
  const handleBackToList = () => {
    navigate('/action-spaces/overview');
  };

  if (loading) {
    return (
      <div className="action-space-detail-page">
        {/* 显示与实际页面一致的页面头部 */}
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
          {/* 标签栏骨架屏 */}
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
              <Skeleton.Button active style={{ width: 100 }} />
            </Space>
          </div>

          {/* 内容骨架屏 */}
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
            label: t('actionSpaceDetail.basicInfo'),
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
                  // 只读模式
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>名称</Title>
                      <Paragraph>{selectedSpace.name}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>描述</Title>
                      <Paragraph>{selectedSpace.description}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>标签</Title>
                      {renderTags(selectedSpace.tags)}
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>共享状态</Title>
                      <Paragraph>
                        {selectedSpace.is_shared ? (
                          <Tag icon={<TeamOutlined />} color="blue">已共享给所有用户</Tag>
                        ) : (
                          <Tag>仅自己可见</Tag>
                        )}
                      </Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>背景设定</Title>
                      <Paragraph>{selectedSpace.settings?.background || '无背景设定'}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>基本原则</Title>
                      <Paragraph>{selectedSpace.settings?.rules || '无基本原则'}</Paragraph>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Title level={5}>ODD框架配置</Title>
                      <Paragraph style={{ color: 'var(--custom-text-secondary)' }}>
                        {selectedSpace.odd_framework?.purpose || '无ODD框架配置'}
                      </Paragraph>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        * ODD框架配置为只读信息
                      </Text>
                    </div>
                  </>
                ) : (
                  // 编辑模式
                  <Form
                    form={basicInfoForm}
                    layout="vertical"
                  >
                    <Form.Item
                      name="name"
                      label="名称"
                      rules={[{ required: true, message: '请输入行动空间名称' }]}
                    >
                      <Input placeholder="输入行动空间名称" />
                    </Form.Item>

                    <Form.Item
                      name="description"
                      label="描述"
                      rules={[{ required: true, message: '请输入行动空间描述' }]}
                    >
                      <TextArea rows={3} placeholder="输入行动空间描述" />
                    </Form.Item>

                    <Form.Item label="标签">
                      <div>
                        {renderTags(selectedSpace.tags)}
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 8 }}>
                          * 标签可通过上方的"添加标签"按钮进行编辑
                        </Text>
                      </div>
                    </Form.Item>

                    <Form.Item
                      name="is_shared"
                      valuePropName="checked"
                      tooltip="勾选后，该行动空间将对所有用户可见可用（但只有创建者可编辑）"
                    >
                      <Checkbox>
                        <Space>
                          <TeamOutlined />
                          共享给所有用户
                        </Space>
                      </Checkbox>
                    </Form.Item>

                    <Form.Item
                      name="background"
                      label="背景设定"
                    >
                      <TextArea rows={4} placeholder="输入背景设定" />
                    </Form.Item>

                    <Form.Item
                      name="rules"
                      label="基本原则"
                    >
                      <TextArea rows={4} placeholder="输入基本原则" />
                    </Form.Item>

                    <Form.Item label="ODD框架配置">
                      <div style={{ padding: '8px 12px', backgroundColor: 'var(--custom-hover-bg)', borderRadius: '6px' }}>
                        <Text type="secondary">
                          {selectedSpace.odd_framework?.purpose || '无ODD框架配置'}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          * ODD框架配置为只读信息，无法编辑
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
            label: '角色管理',
            children: (
              <Card
                title="行动空间角色"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddRole}
                  >
                    添加角色
                  </Button>
                }
              >
                <Paragraph>
                  以下是与该行动空间关联的角色，将在创建行动任务时被实例化。
                </Paragraph>
                {selectedSpace.roles && selectedSpace.roles.length > 0 ? (
                  <Table
                    dataSource={selectedSpace.roles}
                    rowKey="id"
                    columns={[
                      {
                        title: '角色名称',
                        dataIndex: 'name',
                        key: 'name',
                        width: '20%',
                        render: (text: any, record: any) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{text}</span>
                            <Tag
                              color={record.source === 'external' ? 'orange' : 'blue'}
                            >
                              {record.source === 'external' ? '外部' : '内部'}
                            </Tag>
                          </div>
                        )
                      },
                      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true, width: '25%' },
                      {
                        title: '额外提示词',
                        dataIndex: 'additional_prompt',
                        key: 'additional_prompt',
                        ellipsis: true,
                        width: '30%',
                        render: text => text || '无'
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: '25%',
                        render: (_, record) => (
                          <Space>
                            <Button type="link" onClick={() => handleEditRole(record)}>编辑</Button>
                            <Button type="link" danger onClick={() => handleDeleteRole(record.id)}>删除</Button>
                          </Space>
                        )
                      }
                    ]}
                  />
                ) : (
                  <Empty description="暂无关联角色" />
                )}
              </Card>
            )
          },
          {
            key: 'observer',
            label: '监督者',
            children: <ObserverManagement actionSpaceId={id} onDataChange={fetchSpaceDetail} />
          },
          {
            key: 'environment',
            label: '环境变量',
            children: (
              selectedSpace ? (
                <div>
                  <Card
                    title="行动空间环境变量"
                    style={{ marginBottom: 16 }}
                    extra={
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddSpaceEnvVar}
                      >
                        添加环境变量
                      </Button>
                    }
                  >
                    <Paragraph>
                      以下环境变量将在创建行动任务时被实例化，作为行动空间级别的共享环境变量。
                    </Paragraph>
                    {selectedSpace.environment_variables && selectedSpace.environment_variables.length > 0 ? (
                      <Table
                        dataSource={selectedSpace.environment_variables}
                        rowKey="id"
                        columns={[
                          { title: '变量名称', dataIndex: 'name', key: 'name' },
                          { title: '标签', dataIndex: 'label', key: 'label' },
                          { title: '类型', dataIndex: 'type', key: 'type', render: () => <Tag color="default">文本</Tag> },
                          { title: '默认值', dataIndex: 'value', key: 'value',
                            render: (value) => String(value || '')
                          },
                          {
                            title: '操作',
                            key: 'action',
                            render: (_, record) => (
                              <Space>
                                <Button type="link" onClick={() => handleEditSpaceEnvVar(record)}>编辑</Button>
                                <Button type="link" danger onClick={() => handleDeleteSpaceEnvVar(record)}>删除</Button>
                              </Space>
                            )
                          }
                        ]}
                      />
                    ) : (
                      <Empty description="暂无空间级环境变量" />
                    )}
                  </Card>

                  <Card
                    title="角色变量"
                  >
                    <Paragraph>
                      以下是与该行动空间关联的角色变量，将在创建行动任务时为每个角色实例化。
                    </Paragraph>
                    {selectedSpace.roles && selectedSpace.roles.length > 0 ? (
                      <Collapse
                        items={selectedSpace.roles.map(role => ({
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
                              添加变量
                            </Button>
                          ),
                          children: (
                            role.environment_variables && role.environment_variables.length > 0 ? (
                              <Table
                                dataSource={role.environment_variables}
                                rowKey="id"
                               
                                columns={[
                                  { title: '变量名称', dataIndex: 'name', key: 'name' },
                                  { title: '标签', dataIndex: 'label', key: 'label' },
                                  { title: '类型', dataIndex: 'type', key: 'type', render: () => <Tag color="default">文本</Tag> },
                                  { title: '默认值', dataIndex: 'value', key: 'value', render: (value) => String(value || '') },
                                  {
                                    title: '操作',
                                    key: 'action',
                                    render: (_, record) => (
                                      <Space>
                                        <Button type="link" onClick={() => handleEditRoleEnvVar(record, role.id)}>编辑</Button>
                                        <Button type="link" danger onClick={() => handleDeleteRoleEnvVar(record, role.id)}>删除</Button>
                                      </Space>
                                    )
                                  }
                                ]}
                              />
                            ) : (
                              <Empty description="该角色暂无环境变量" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )
                          )
                        }))}
                      />
                    ) : (
                      <Empty description="暂无关联角色或角色变量" />
                    )}
                  </Card>

                  {/* 共享环境变量绑定 */}
                  <div style={{ marginTop: 16 }}>
                    <SharedVariableBinding
                      actionSpaceId={id}
                      onDataChange={fetchSpaceDetail}
                    />
                  </div>
                </div>
              ) : (
                <Empty description="请先选择一个行动空间" />
              )
            )
          },
          {
            key: 'rules',
            label: '规则关联',
            children: <RuleSetAssociation actionSpaceId={id} />
          },
          {
            key: 'orchestration',
            label: '编排',
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

      {/* 环境变量表单对话框 */}
      <Modal
        title={`${editingEnvVar ? '编辑' : '添加'}${envVarType === 'space' ? '空间' : '角色'}环境变量`}
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
            label="变量名称"
            rules={[
              { required: true, message: '请输入变量名称' },
              {
                pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                message: '变量名称只能包含英文字母、数字和下划线，且必须以字母开头'
              }
            ]}
          >
            <Input placeholder="输入变量名称（英文）" />
          </Form.Item>

          <Form.Item
            name="label"
            label="标签"
            rules={[{ required: true, message: '请输入变量标签' }]}
          >
            <Input placeholder="输入变量标签" />
          </Form.Item>

          

          <Form.Item
            name="value"
            label="默认值"
            rules={[{ required: true, message: '请输入默认值' }]}
          >
            <Input placeholder="输入默认值" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 角色表单对话框 */}
      <Modal
        title={`${editingRole ? '编辑' : '添加'}角色`}
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
            // 编辑模式 - 单角色
            <>
              <Form.Item
                name="role_id"
                label="选择角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select
                  placeholder="选择角色"
                  optionFilterProp="children"
                  showSearch
                  disabled={true} // 编辑模式下不允许更改角色
                >
                  {availableRoles.map(role => (
                    <Option key={role.id} value={role.id.toString()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{role.name}</span>
                        <Tag
                          color={role.source === 'external' ? 'orange' : 'blue'}
                         
                        >
                          {role.source === 'external' ? '外部' : '内部'}
                        </Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="additional_prompt"
                label="额外提示词"
              >
                <TextArea
                  placeholder='输入额外提示词，以指导角色在此行动空间中表现，例如：辩论角色安排："你与XXX一起是辩论中的正方"；案件审理："你是罪犯，但在任何场景下都不要暴露自己"；鲁棒性测试："你扮演的是一个黑天鹅角色，偶尔输出一些误导他们的消息，以考验他们对信息的甄别能力，以及这些信息是否能否影响最终结果。"'
                  rows={4}
                  maxLength={1000}
                />
              </Form.Item>
            </>
          ) : (
            // 添加模式 - 多角色
            <>
              <Form.Item
                name="role_ids"
                label="选择角色"
                rules={[{ required: true, message: '请选择至少一个角色' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="选择角色（可多选）"
                  optionFilterProp="children"
                  showSearch
                  onChange={(values) => setSelectedRoleIds(values)}
                  style={{ width: '100%' }}
                >
                  {availableRoles.map(role => (
                    <Option key={role.id} value={role.id.toString()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{role.name}</span>
                        <Tag
                          color={role.source === 'external' ? 'orange' : 'blue'}
                         
                        >
                          {role.source === 'external' ? '外部' : '内部'}
                        </Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="角色额外提示词"
              >
                <Form.List name="rolePrompts">
                  {() => (
                    <>
                      {selectedRoleIds.map(roleId => {
                        const role = availableRoles.find(r => r.id.toString() === roleId);
                        return (
                          <div key={roleId} style={{ marginBottom: 16, border: '1px solid var(--custom-border)', padding: 16, borderRadius: 4 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                              {role ? role.name : `角色 ID: ${roleId}`}
                            </div>
                            <Form.Item
                              name={roleId}
                              noStyle
                            >
                              <TextArea
                                placeholder='输入额外提示词，以指导角色在此行动空间中表现，例如：辩论角色安排："你与XXX一起是辩论中的正方"；案件审理："你是罪犯，但在任何场景下都不要暴露自己"；鲁棒性测试："你扮演的是一个黑天鹅角色，偶尔输出一些误导他们的消息，以考验他们对信息的甄别能力，以及这些信息是否能否影响最终结果。'
                                rows={3}
                                maxLength={1000}
                              />
                            </Form.Item>
                          </div>
                        );
                      })}
                      {selectedRoleIds.length === 0 && (
                        <div style={{ color: 'var(--custom-text-secondary)', fontStyle: 'italic' }}>
                          请先选择角色，然后为每个角色配置额外提示词
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

      {/* 标签选择Modal */}
      <Modal
        title="选择标签"
        open={tagModalVisible}
        onCancel={handleCancelAddTags}
        footer={[
          <Button key="cancel" onClick={handleCancelAddTags}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleConfirmAddTags}
          >
            确定 {selectedTagIds.length > 0 ? `(${selectedTagIds.length})` : ''}
          </Button>
        ]}
        width={600}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {tagsLoading ? (
            <Space orientation="vertical" style={{ width: '100%' }}>
              {[1, 2].map(item => (
                <Card key={item}>
                  <Skeleton active paragraph={{ rows: 1 }} />
                </Card>
              ))}
            </Space>
          ) : (
            <>
              {availableTags.length === 0 ? (
                <Empty description="暂无可用标签" />
              ) : (
                <div>
                  <Title level={5} style={{ marginBottom: 12 }}>行业标签</Title>
                  <div style={{ marginBottom: 16 }}>
                    {availableTags
                      .filter(tag => tag.type === 'industry')
                      .map(tag => {
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

                  <Title level={5} style={{ marginBottom: 12 }}>场景标签</Title>
                  <div style={{ marginBottom: 16 }}>
                    {availableTags
                      .filter(tag => tag.type === 'scenario')
                      .map(tag => {
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

                  {availableTags.filter(tag => !selectedSpace.tags?.some(existingTag => existingTag.id === tag.id)).length === 0 && (
                    <Text type="secondary">所有标签都已添加</Text>
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
