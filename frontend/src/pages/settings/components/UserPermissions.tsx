import { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Tabs,
  Card,
  Checkbox,
  Row,
  Col,
  Radio,
  App
} from 'antd';
import {
  SafetyCertificateOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import api from '../../../services/api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { canEditUserRole } from '../../../constants/permissions';

const { Text } = Typography;

const UserPermissions = ({ visible, user, onCancel }: any) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const { user: currentUser } = useAuth();

  // 检查是否可以编辑用户角色
  const canEditRole = user ? canEditUserRole(currentUser, user) : false;
  const [userPermissions, setUserPermissions] = useState([]);
  const [allPermissions, setAllPermissions] = useState({});
  const [activeTab, setActiveTab] = useState('roles');

  useEffect(() => {
    if (visible && user) {
      fetchUserData();
      fetchAllRoles();
      fetchAllPermissions();
    }
  }, [visible, user]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // 获取用户角色
      const rolesResponse = await api.get(`/users/${user.id}/roles`);
      setUserRoles(rolesResponse.data.roles || []);

      // 获取用户权限
      const permissionsResponse = await api.get(`/users/${user.id}/permissions`);
      setUserPermissions(permissionsResponse.data.permissions || []);
    } catch (error) {
      console.error('获取用户数据失败:', error);
      message.error('获取用户数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRoles = async () => {
    try {
      const response = await api.get('/user-roles');
      setAllRoles(response.data.user_roles || []);
    } catch (error) {
      console.error('获取用户角色列表失败:', error);
    }
  };

  const fetchAllPermissions = async () => {
    try {
      const response = await api.get('/user-permissions');
      setAllPermissions(response.data.permissions || {});
    } catch (error) {
      console.error('获取用户权限列表失败:', error);
    }
  };

  const handleAssignRole = async (roleId) => {
    try {
      // 单选模式：先移除现有角色，再分配新角色
      if (userRoles.length > 0) {
        // 移除现有角色
        for (const userRole of userRoles) {
          await api.delete(`/users/${user.id}/roles/${userRole.user_role_id}`);
        }
      }

      // 分配新角色
      await api.post(`/users/${user.id}/roles`, { user_role_id: roleId });
      message.success('角色分配成功');
      fetchUserData();
    } catch (error) {
      console.error('分配角色失败:', error);
      message.error(error.response?.data?.error || '分配角色失败');
    }
  };



  const userRoleIds = userRoles.map(ur => ur.user_role_id);

  const rolesColumns = [
    {
      title: '角色名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text, record) => (
        <Space>
          <SafetyCertificateOutlined />
          <span>{text}</span>
          {record.is_system && <Tag color="blue">系统</Tag>}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '选择',
      key: 'actions',
      render: (_, record) => {
        const hasRole = userRoleIds.includes(record.id);
        return (
          <Radio
            checked={hasRole}
            onChange={() => {
              if (!hasRole && canEditRole) {
                handleAssignRole(record.id);
              }
            }}
            disabled={!canEditRole || (record.name === 'super_admin' && user.username === 'admin' && hasRole)}
          >
            {hasRole ? '已选择' : '选择'}
          </Radio>
        );
      }
    }
  ];

  const renderPermissionsByCategory = () => {
    const categoryNames = {
      'menu': '菜单权限',
      'feature': '功能权限',
      'data': '数据权限'
    };

    return Object.entries(allPermissions).map(([category, permissions]: [string, any]) => (
      <Card
        key={category}
        title={categoryNames[category] || category}
       
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 8]}>
          {(permissions as any).map((permission: any) => {
            const hasPermission = userPermissions.includes(permission.name);
            return (
              <Col span={8} key={permission.id}>
                <Checkbox
                  checked={hasPermission}
                  disabled={true} // 权限通过角色管理，不直接分配
                >
                  <Space>
                    <Text>{permission.display_name}</Text>
                    {hasPermission && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  </Space>
                </Checkbox>
              </Col>
            );
          })}
        </Row>
      </Card>
    ));
  };

  const tabItems = [
    {
      key: 'roles',
      label: (
        <Space>
          <SafetyCertificateOutlined />
          角色管理
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              为用户选择一个角色来管理权限。每个用户只能拥有一个角色，用户将获得所选角色的所有权限。
              {!canEditRole && (
                <div style={{ marginTop: 8, color: '#fa8c16' }}>
                  ⚠️ 超级管理员不能修改自己的角色，防止误操作。
                </div>
              )}
            </Text>
          </div>
          <Table
            columns={rolesColumns}
            dataSource={allRoles}
            rowKey="id"
            loading={loading}
            pagination={false}
           
          />
        </div>
      )
    },
    {
      key: 'permissions',
      label: (
        <Space>
          <SettingOutlined />
          权限详情
        </Space>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              显示用户通过角色获得的所有权限。权限不能直接分配，需要通过角色管理。
            </Text>
          </div>
          {renderPermissionsByCategory()}
        </div>
      )
    }
  ];

  return (
    <Modal
      title={
        <div>
          <UserOutlined style={{ marginRight: 8 }} />
          用户权限管理 - {user?.display_name || user?.username}
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>
      ]}
      width={800}
      destroyOnHidden
    >
      {user && (
        <div>
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--md-code-bg)', borderRadius: 6 }}>
            <Space>
              <UserOutlined />
              <Text strong>用户：{user.username}</Text>
              <Text type="secondary">({user.display_name || user.username})</Text>
              {user.is_admin && <Tag color="red">超级管理员</Tag>}
            </Space>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </div>
      )}
    </Modal>
  );
};

export default UserPermissions;
