import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Card,
  Checkbox,
  Row,
  Col,
  Modal,
  Form,
  Input,
  App,
  Tooltip,
  Popconfirm
} from 'antd';
import {
  SafetyCertificateOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api/axios';

const { Text } = Typography;
const { TextArea } = Input;

const UserRoleManagement = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any>({});
  const [allPermissionsList, setAllPermissionsList] = useState<any[]>([]);
  
  const [roleFormVisible, setRoleFormVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleForm] = Form.useForm();
  
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/user-roles');
      setRoles(response.data.user_roles || []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      message.error(t('userRoleManagement.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  const fetchAllPermissions = useCallback(async () => {
    try {
      const response = await api.get('/user-permissions');
      setAllPermissions(response.data.permissions || {});
      setAllPermissionsList(response.data.all_permissions || []);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchAllPermissions();
  }, [fetchRoles, fetchAllPermissions]);

  const handleCreateRole = () => {
    setEditingRole(null);
    roleForm.resetFields();
    setRoleFormVisible(true);
  };

  const handleEditRole = (role: any) => {
    setEditingRole(role);
    roleForm.setFieldsValue({
      name: role.name,
      display_name: role.display_name,
      description: role.description
    });
    setRoleFormVisible(true);
  };

  const handleDeleteRole = async (role: any) => {
    try {
      await api.delete('/user-roles/' + role.id);
      message.success(t('userRoleManagement.deleteSuccess'));
      fetchRoles();
    } catch (error: any) {
      console.error('Failed to delete role:', error);
      message.error(error.response?.data?.error || t('userRoleManagement.deleteFailed'));
    }
  };

  const handleRoleFormSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      
      if (editingRole) {
        await api.put('/user-roles/' + editingRole.id, values);
        message.success(t('userRoleManagement.updateSuccess'));
      } else {
        await api.post('/user-roles', values);
        message.success(t('userRoleManagement.createSuccess'));
      }
      
      setRoleFormVisible(false);
      setEditingRole(null);
      roleForm.resetFields();
      fetchRoles();
    } catch (error: any) {
      console.error('Failed to save role:', error);
      message.error(error.response?.data?.error || t('userRoleManagement.saveFailed'));
    }
  };

  const handleManagePermissions = async (role: any) => {
    setSelectedRole(role);
    try {
      const response = await api.get('/user-roles/' + role.id + '/permissions');
      const permNames = (response.data.permissions || []).map((p: any) => p.name);
      setRolePermissions(permNames);
      setPermissionModalVisible(true);
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
      message.error(t('userRoleManagement.fetchPermissionsFailed'));
    }
  };

  const handlePermissionChange = (permissionName: string, checked: boolean) => {
    if (checked) {
      setRolePermissions([...rolePermissions, permissionName]);
    } else {
      setRolePermissions(rolePermissions.filter(p => p !== permissionName));
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    
    setSavingPermissions(true);
    try {
      const permissionIds = allPermissionsList
        .filter((p: any) => rolePermissions.includes(p.name))
        .map((p: any) => p.id);
      
      await api.post('/user-roles/' + selectedRole.id + '/permissions', {
        permission_ids: permissionIds
      });
      
      message.success(t('userRoleManagement.savePermissionsSuccess'));
      setPermissionModalVisible(false);
      setSelectedRole(null);
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      message.error(error.response?.data?.error || t('userRoleManagement.savePermissionsFailed'));
    } finally {
      setSavingPermissions(false);
    }
  };

  const categoryNames: Record<string, string> = {
    'menu': t('userRoleManagement.permissionCategory.menu'),
    'feature': t('userRoleManagement.permissionCategory.feature'),
    'data': t('userRoleManagement.permissionCategory.data')
  };

  const columns = [
    {
      title: t('userRoleManagement.columns.name'),
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text: string, record: any) => (
        <Space>
          <SafetyCertificateOutlined />
          <span>{text}</span>
          {record.is_system && <Tag color="blue">{t('userRoleManagement.systemRole')}</Tag>}
        </Space>
      )
    },
    {
      title: t('userRoleManagement.columns.code'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Tag>{text}</Tag>
    },
    {
      title: t('userRoleManagement.columns.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: t('userRoleManagement.columns.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? t('status.enabled') : t('status.disabled')}
        </Tag>
      )
    },
    {
      title: t('userRoleManagement.columns.actions'),
      key: 'actions',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title={t('userRoleManagement.managePermissions')}>
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => handleManagePermissions(record)}
              disabled={record.is_system}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditRole(record)}
              disabled={record.is_system}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Popconfirm
            title={t('userRoleManagement.confirmDelete')}
            onConfirm={() => handleDeleteRole(record)}
            disabled={record.is_system}
          >
            <Tooltip title={record.is_system ? t('userRoleManagement.systemRoleNotDeletable') : t('delete')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={record.is_system}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">
          {t('userRoleManagement.description')}
        </Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchRoles}
            loading={loading}
          >
            {t('refresh')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateRole}
          >
            {t('userRoleManagement.createRole')}
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingRole ? t('userRoleManagement.editRole') : t('userRoleManagement.createRole')}
        open={roleFormVisible}
        onOk={handleRoleFormSubmit}
        onCancel={() => {
          setRoleFormVisible(false);
          setEditingRole(null);
          roleForm.resetFields();
        }}
        destroyOnClose
      >
        <Form
          form={roleForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={t('userRoleManagement.form.name')}
            rules={[
              { required: true, message: t('userRoleManagement.form.nameRequired') },
              { pattern: /^[a-z_]+$/, message: t('userRoleManagement.form.namePattern') }
            ]}
          >
            <Input 
              placeholder={t('userRoleManagement.form.namePlaceholder')} 
              disabled={!!editingRole}
            />
          </Form.Item>
          <Form.Item
            name="display_name"
            label={t('userRoleManagement.form.displayName')}
            rules={[{ required: true, message: t('userRoleManagement.form.displayNameRequired') }]}
          >
            <Input placeholder={t('userRoleManagement.form.displayNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="description"
            label={t('userRoleManagement.form.description')}
          >
            <TextArea rows={3} placeholder={t('userRoleManagement.form.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <SettingOutlined />
            {t('userRoleManagement.permissionsTitle', { role: selectedRole?.display_name })}
          </Space>
        }
        open={permissionModalVisible}
        onOk={handleSavePermissions}
        onCancel={() => {
          setPermissionModalVisible(false);
          setSelectedRole(null);
        }}
        width={800}
        confirmLoading={savingPermissions}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            {t('userRoleManagement.permissionsDescription')}
          </Text>
        </div>
        
        {Object.entries(allPermissions).map(([category, permissions]: [string, any]) => (
          <Card
            key={category}
            title={categoryNames[category] || category}
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 8]}>
              {(permissions as any[]).map((permission: any) => (
                <Col span={8} key={permission.id}>
                  <Checkbox
                    checked={rolePermissions.includes(permission.name)}
                    onChange={(e) => handlePermissionChange(permission.name, e.target.checked)}
                  >
                    {permission.display_name}
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Card>
        ))}
      </Modal>
    </div>
  );
};

export default UserRoleManagement;
