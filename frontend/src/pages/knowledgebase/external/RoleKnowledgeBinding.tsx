import React, { useState, useEffect } from 'react';
import {
  Card, Button, Space, Table, Typography, Modal, Form, Select,
  App, Badge, Popconfirm, List, Avatar, Input, Tag, Empty, Skeleton
} from 'antd';
import {
  UserOutlined, PlusOutlined, DeleteOutlined, LinkOutlined,
  DatabaseOutlined, ApiOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { externalKnowledgeAPI } from '../../../services/api';
import knowledgeAPI from '../../../services/api/knowledge';
import { roleAPI } from '../../../services/api/role';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const RoleKnowledgeBinding = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [roles, setRoles] = useState([]);
  const [actionSpaces, setActionSpaces] = useState([]);
  const [selectedActionSpace, setSelectedActionSpace] = useState(null);
  const [externalKnowledges, setExternalKnowledges] = useState([]);
  const [internalKnowledges, setInternalKnowledges] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleBindings, setRoleBindings] = useState([]);
  const [allRoleBindings, setAllRoleBindings] = useState({}); // 存储所有角色的绑定关系
  const [availableKnowledges, setAvailableKnowledges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false); // 角色列表加载状态
  const [bindingLoading, setBingingLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [roleSearchText, setRoleSearchText] = useState('');
  const [form] = Form.useForm();

  // 获取初始数据
  useEffect(() => {
    fetchActionSpaces();
    fetchRoles();
    fetchExternalKnowledges();
    fetchInternalKnowledges();
    fetchAllRoleBindings();
  }, []);

  // 当选择行动空间时，重新获取角色列表
  useEffect(() => {
    fetchRoles();
  }, [selectedActionSpace]);

  // 当选择角色时，获取该角色的绑定信息
  useEffect(() => {
    if (selectedRole) {
      fetchRoleBindings(selectedRole.id);
    }
  }, [selectedRole]);

  const fetchActionSpaces = async () => {
    try {
      const spaces = await actionSpaceAPI.getAll();
      setActionSpaces(spaces);
    } catch (error) {
      console.error('获取行动空间列表失败:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      // 根据选择的行动空间过滤角色
      const response = await externalKnowledgeAPI.getAllRoles(selectedActionSpace);
      // 兼容不同的响应格式
      const rolesList = response?.roles || response?.data || response || [];
      if (rolesList && Array.isArray(rolesList)) {
        setRoles(rolesList);
        // 默认选择第一个角色
        if (rolesList.length > 0) {
          setSelectedRole(rolesList[0]);
        } else {
          setSelectedRole(null);
        }
      } else {
        setRoles([]);
        setSelectedRole(null);
      }
    } catch (error) {
      message.error(t('rkBind.msg.fetchRolesFailed'));
      console.error('fetch roles failed:', error);
      setRoles([]);
      setSelectedRole(null);
    } finally {
      setRolesLoading(false);
    }
  };

  const fetchExternalKnowledges = async () => {
    try {
      const response = await externalKnowledgeAPI.getExternalKnowledges();
      // 兼容不同的响应格式
      const data = response?.success ? response.data : (response?.data || response || []);
      setExternalKnowledges(Array.isArray(data) ? data : []);
      console.log('外部知识库加载成功:', data.length);
    } catch (error) {
      console.error('获取外部知识库列表失败:', error);
      setExternalKnowledges([]);
    }
  };

  const fetchInternalKnowledges = async () => {
    try {
      const response = await knowledgeAPI.getAll();
      // 兼容不同的响应格式
      const data = response?.success ? response.data : (response?.data || response || []);
      setInternalKnowledges(Array.isArray(data) ? data : []);
      console.log('内部知识库加载成功:', data.length);
    } catch (error) {
      console.error('获取内部知识库列表失败:', error);
      setInternalKnowledges([]);
    }
  };

  const fetchAllRoleBindings = async () => {
    try {
      // 使用新的批量API一次性获取所有角色的绑定关系
      const response = await roleAPI.getAllRolesKnowledgeBindings();
      if (response.success && response.data) {
        // 转换数据格式以适配现有的UI逻辑
        const bindingsMap = {};

        Object.keys(response.data).forEach(roleId => {
          const roleData = response.data[roleId];
          bindingsMap[roleId] = roleData.bindings || [];
        });

        setAllRoleBindings(bindingsMap);
      }
    } catch (error) {
      console.error('获取所有角色绑定关系失败:', error);
      // 如果新API失败，回退到原有的循环调用方式
      try {
        const response = await externalKnowledgeAPI.getAllRoles();
        if (response && response.roles) {
          const bindingsMap = {};

          // 为每个角色获取其绑定关系
          for (const role of response.roles) {
            try {
              const bindingResponse = await externalKnowledgeAPI.getRoleExternalKnowledges(role.id);
              if (bindingResponse.success) {
                bindingsMap[role.id] = bindingResponse.data || [];
              } else {
                bindingsMap[role.id] = [];
              }
            } catch (error) {
              console.error(`获取角色 ${role.id} 的绑定关系失败:`, error);
              bindingsMap[role.id] = [];
            }
          }

          setAllRoleBindings(bindingsMap);
        }
      } catch (fallbackError) {
        console.error('回退方案也失败了:', fallbackError);
      }
    }
  };

  // 通用的数据处理函数，消除重复代码
  const processBindingsData = (externalResponse, internalResponse) => {
    const bindings = [];

    // 处理外部知识库绑定
    if (externalResponse.success && externalResponse.data) {
      const externalBindings = externalResponse.data.map(binding => ({
        ...binding,
        type: 'external',
        knowledge_type: 'external'
      }));
      bindings.push(...externalBindings);
    }

    // 处理内部知识库绑定
    if (internalResponse.success && internalResponse.data) {
      const internalBindings = internalResponse.data.map(binding => ({
        id: binding.id,
        type: 'internal',
        knowledge_type: 'internal',
        knowledge: {
          id: binding.id,
          name: binding.name,
          description: binding.description,
          type: binding.type,
          status: binding.status
        },
        provider: {
          id: 'internal',
          name: t('rkBind.internalKB'),
          type: 'INTERNAL'
        },
        created_at: binding.binding_created_at || binding.created_at
      }));
      bindings.push(...internalBindings);
    }

    return bindings;
  };

  const fetchRoleBindings = async (roleId) => {
    try {
      setLoading(true);
      
      // 添加最小显示时间，确保骨架屏可见
      const minDisplayTime = new Promise(resolve => setTimeout(resolve, 300));
      
      // 优先使用已经获取的批量数据
      if (allRoleBindings[roleId]) {
        // 等待最小显示时间
        await minDisplayTime;
        
        // 如果已经有批量数据，直接使用
        const bindings = allRoleBindings[roleId].map(binding => ({
          ...binding,
          // 确保数据格式一致
          knowledge_type: binding.type
        }));
        setRoleBindings(bindings);
        return;
      }

      // 如果没有批量数据，回退到单独获取
      const [externalResponse, internalResponse] = await Promise.all([
        externalKnowledgeAPI.getRoleExternalKnowledges(roleId),
        knowledgeAPI.getRoleKnowledges(roleId),
        minDisplayTime // 同时等待最小显示时间
      ]);

      const bindings = processBindingsData(externalResponse, internalResponse);
      setRoleBindings(bindings);
    } catch (error) {
      message.error(t('rkBind.msg.fetchBindingsFailed'));
      console.error('fetch role bindings failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // show add-binding modal
  const showBindingModal = async () => {
    if (!selectedRole) {
      message.warning(t('rkBind.msg.pickRoleFirst'));
      return;
    }

    if (loading) {
      message.warning(t('rkBind.msg.bindingDataLoading'));
      return;
    }

    try {
      const hide = message.loading(t('rkBind.msg.loadingAvailable'), 0);

      try {
        if (externalKnowledges.length === 0 && internalKnowledges.length === 0) {
          hide();
          message.warning(t('rkBind.msg.noKBYet'));
          return;
        }

        // 获取已绑定的知识库ID
        const boundExternalIds = roleBindings
          .filter(binding => binding.type === 'external' || binding.knowledge_type === 'external')
          .map(binding => binding.external_knowledge_id || binding.knowledge?.id);
        const boundInternalIds = roleBindings
          .filter(binding => binding.type === 'internal' || binding.knowledge_type === 'internal')
          .map(binding => binding.knowledge_id || binding.knowledge?.id || binding.id);

        console.log('已绑定的ID:', { boundExternalIds, boundInternalIds, roleBindings });

        // merge available internal and external KBs
        const availableExternal = externalKnowledges
          .filter(kb => !boundExternalIds.includes(kb.id))
          .map(kb => ({
            ...kb,
            type: 'external',
            display_name: t('rkBind.displayExternal', { name: kb.name, provider: kb.provider?.name || t('rkBind.unknownProvider') })
          }));

        const availableInternal = internalKnowledges
          .filter(kb => !boundInternalIds.includes(kb.id))
          .map(kb => ({
            ...kb,
            type: 'internal',
            display_name: t('rkBind.displayInternal', { name: kb.name })
          }));

        console.log('可用的知识库:', { availableExternal, availableInternal });

        const available = [...availableInternal, ...availableExternal];
        setAvailableKnowledges(available);

        hide();

        if (available.length === 0) {
          message.info(t('rkBind.msg.allBound', { total: externalKnowledges.length + internalKnowledges.length }));
          return;
        }

        form.resetFields();
        setModalVisible(true);
      } catch (error) {
        hide();
        throw error;
      }
    } catch (error) {
      message.error(t('rkBind.msg.fetchAvailableFailed'));
      console.error('fetch available knowledges failed:', error);
    }
  };

  // 处理绑定提交
  const handleBindingSubmit = async (values) => {
    setBingingLoading(true);
    try {
      // 解析选中的知识库ID（只分割第一个连字符）
      const firstDashIndex = values.knowledge_id.indexOf('-');
      const type = values.knowledge_id.substring(0, firstDashIndex);
      const id = values.knowledge_id.substring(firstDashIndex + 1);

      const selectedKnowledge = availableKnowledges.find(kb =>
        kb.type === type && kb.id.toString() === id
      );

      if (!selectedKnowledge) {
        message.error(t('rkBind.msg.kbNotFound'));
        console.error('parse failed:', { type, id, availableKnowledges });
        return;
      }

      let response;
      if (selectedKnowledge.type === 'external') {
        // 绑定外部知识库
        response = await externalKnowledgeAPI.bindRoleExternalKnowledge(
          selectedRole.id,
          selectedKnowledge.id,
          values.config || {}
        );
      } else {
        // 绑定内部知识库
        response = await knowledgeAPI.mountToRole(
          selectedRole.id,
          selectedKnowledge.id
        );
      }

      if (response.success) {
        message.success(t('rkBind.msg.bindSuccess'));
        updateRoleBindings(selectedRole.id);
        setModalVisible(false);
      } else {
        message.error(response.message || t('rkBind.msg.bindFailed'));
      }
    } catch (error) {
      message.error(t('rkBind.msg.bindFailed'));
      console.error('bind failed:', error);
    } finally {
      setBingingLoading(false);
    }
  };

  // 更新单个角色的绑定数据（避免重新获取所有数据）
  const updateRoleBindings = async (roleId) => {
    try {
      // 同时获取内部和外部知识库绑定
      const [externalResponse, internalResponse] = await Promise.all([
        externalKnowledgeAPI.getRoleExternalKnowledges(roleId),
        knowledgeAPI.getRoleKnowledges(roleId)
      ]);

      const bindings = processBindingsData(externalResponse, internalResponse);

      // 更新当前角色的绑定显示
      if (selectedRole && selectedRole.id === roleId) {
        setRoleBindings(bindings);
      }

      // 更新批量数据中的对应角色
      setAllRoleBindings(prev => ({
        ...prev,
        [roleId]: bindings
      }));

    } catch (error) {
      console.error('更新角色绑定数据失败:', error);
    }
  };

  // 解除绑定
  const handleUnbind = async (binding) => {
    try {
      let response;
      if (binding.type === 'external') {
        // 解绑外部知识库
        response = await externalKnowledgeAPI.unbindRoleExternalKnowledge(
          selectedRole.id,
          binding.external_knowledge_id
        );
      } else {
        // 解绑内部知识库
        response = await knowledgeAPI.unmountFromRole(
          selectedRole.id,
          binding.knowledge_id || binding.id
        );
      }

      if (response.success) {
        message.success(t('rkBind.msg.unbindSuccess'));
        updateRoleBindings(selectedRole.id);
      } else {
        message.error(response.message || t('rkBind.msg.unbindFailed'));
      }
    } catch (error) {
      message.error(t('rkBind.msg.unbindFailed'));
      console.error('unbind failed:', error);
    }
  };

  // 过滤并排序角色列表
  const filteredRoles = roles
    .filter(role => 
      role.name.toLowerCase().includes(roleSearchText.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(roleSearchText.toLowerCase()))
    )
    .sort((a, b) => {
      // 按绑定的知识库数量降序排序
      const aBindingCount = allRoleBindings[a.id] ? allRoleBindings[a.id].length : 0;
      const bBindingCount = allRoleBindings[b.id] ? allRoleBindings[b.id].length : 0;
      return bBindingCount - aBindingCount;
    });

  const bindingColumns = [
    {
      title: t('rkBind.col.kbName'),
      key: 'knowledge_name',
      render: (_, record) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1677ff' }} />
          <span>{record.knowledge?.name || record.name}</span>
        </Space>
      ),
    },
    {
      title: t('rkBind.col.type'),
      key: 'type',
      render: (_, record) => (
        <Tag color={record.type === 'external' ? 'blue' : 'green'}>
          {record.type === 'external' ? t('rkBind.typeExternal') : t('rkBind.typeInternal')}
        </Tag>
      ),
    },
    {
      title: t('rkBind.col.provider'),
      key: 'provider',
      render: (_, record) => (
        <Space>
          <ApiOutlined style={{ color: '#52c41a' }} />
          <span>{record.provider?.name || t('rkBind.internalKB')}</span>
        </Space>
      ),
    },
    {
      title: t('rkBind.col.boundAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('rkBind.col.action'),
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title={t('rkBind.confirm.unbindTitle')}
          description={t('rkBind.confirm.unbindDesc')}
          onConfirm={() => handleUnbind(record)}
          okText={t('rkBind.confirm.ok')}
          cancelText={t('rkBind.confirm.cancel')}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
          >
            {t('rkBind.unbind')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 240px)' }}>
      {/* left: role list */}
      <Card
        title={t('rkBind.roleListTitle')}
        style={{ width: '300px', height: '100%' }}
        styles={{ body: { padding: '12px', height: 'calc(100% - 57px)', overflow: 'auto' } }}
      >
        <Space orientation="vertical" style={{ width: '100%', marginBottom: '12px' }}>
          <Select
            placeholder={t('rkBind.pickActionSpace')}
            value={selectedActionSpace}
            onChange={setSelectedActionSpace}
            style={{ width: '100%' }}
            allowClear
            suffixIcon={<AppstoreOutlined />}
          >
            {actionSpaces.map(space => (
              <Option key={space.id} value={space.id}>
                {space.name}
              </Option>
            ))}
          </Select>
          <Input
            placeholder={t('rkBind.searchRole')}
            value={roleSearchText}
            onChange={(e) => setRoleSearchText(e.target.value)}
            allowClear
          />
        </Space>
        
        {rolesLoading ? (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {[1, 2, 3, 4, 5].map(item => (
              <Card key={item} style={{ marginBottom: 4 }}>
                <Skeleton active avatar paragraph={{ rows: 1 }} />
              </Card>
            ))}
          </Space>
        ) : (
          <List
            dataSource={filteredRoles}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('rkBind.emptyRoleData')}
                />
              )
            }}
            renderItem={(role) => (
              <List.Item
                onClick={() => setSelectedRole(role)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedRole?.id === role.id ? 'var(--tree-selected-bg)' : 'transparent',
                  borderRadius: '4px',
                  padding: '8px',
                  marginBottom: '4px'
                }}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={role.name}
                  description={
                    <div>
                      <Text type="secondary" ellipsis style={{ fontSize: '12px' }}>
                        {role.description || t('rkBind.noDesc')}
                      </Text>
                      <div style={{ marginTop: '4px' }}>
                        <Badge
                          count={allRoleBindings[role.id] ? allRoleBindings[role.id].length : 0}
                          showZero
                          color="blue"
                         
                        />
                        <Text type="secondary" style={{ fontSize: '11px', marginLeft: '4px' }}>
                          {t('rkBind.bindingsSuffix')}
                        </Text>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* right: binding mgmt */}
      <Card 
        title={
          <Space>
            <LinkOutlined />
            <span>{t('rkBind.bindingMgmtTitle')}</span>
            {selectedRole && (
              <Tag color="blue">{selectedRole.name}</Tag>
            )}
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showBindingModal}
            disabled={!selectedRole}
          >
            {t('rkBind.addBinding')}
          </Button>
        }
        style={{ flex: 1, height: '100%' }}
        styles={{ body: { height: 'calc(100% - 57px)', overflow: 'auto' } }}
      >
        {selectedRole ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Title level={5} style={{ margin: 0 }}>
                {t('rkBind.roleBindingsTitle', { name: selectedRole.name })}
              </Title>
              <Text type="secondary">
                {selectedRole.description || t('rkBind.noDesc')}
              </Text>
            </div>

            {loading ? (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {[1, 2, 3, 4].map(item => (
                  <Card key={item}>
                    <Skeleton active paragraph={{ rows: 2 }} />
                  </Card>
                ))}
              </Space>
            ) : (
              <Table
                columns={bindingColumns}
                dataSource={roleBindings}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showTotal: (total) => t('rkBind.paginationTotal', { total }),
                }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('rkBind.emptyBindings')}
                    />
                  )
                }}
              />
            )}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('rkBind.pickRoleFromLeft')}
          />
        )}
      </Card>

      {/* add-binding modal */}
      <Modal
        title={t('rkBind.modalTitle', { name: selectedRole?.name })}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleBindingSubmit}
        >
          <Form.Item
            name="knowledge_id"
            label={t('rkBind.pickKBLabel')}
            rules={[{ required: true, message: t('rkBind.pickKBReq') }]}
          >
            <Select placeholder={t('rkBind.pickKB')} showSearch>
              {availableKnowledges.map(kb => (
                <Option key={`${kb.type}-${kb.id}`} value={`${kb.type}-${kb.id}`}>
                  <Space>
                    <DatabaseOutlined />
                    <span>{kb.display_name}</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="config"
            label={t('rkBind.bindConfig')}
            help={t('rkBind.bindConfigHelp')}
          >
            <Input.TextArea 
              rows={3} 
              placeholder='{"priority": 1, "custom_params": {}}'
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                {t('rkBind.confirm.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={bindingLoading}>
                {t('rkBind.confirmBind')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleKnowledgeBinding;
