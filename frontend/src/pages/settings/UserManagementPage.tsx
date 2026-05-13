import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Tag,
  message,
  Typography,
  Tabs,
  Tooltip,
  Badge,
  Spin
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  StopOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import UserForm from './components/UserForm';
import PasswordResetModal from './components/PasswordResetModal';
import ExternalUserSystems from './components/ExternalUserSystems';
import UserPermissions from './components/UserPermissions';
import DeleteUserModal from './components/DeleteUserModal';
import UserRoleManagement from './components/UserRoleManagement';
import { userAPI } from '../../services/api/users';

const { Title, Text } = Typography;
const { Search } = Input;

const UserManagementPage = () => {
  const { t } = useTranslation();
  const { user: currentUser, hasAdminPermission, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [searchText, setSearchText] = useState('');
  const [userFormVisible, setUserFormVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordResetVisible, setPasswordResetVisible] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [permissionsVisible, setPermissionsVisible] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [deleteUserVisible, setDeleteUserVisible] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [activeTab, setActiveTab] = useState('internal');

  // 获取用户列表
  const fetchUsers = useCallback(async (page = 1, pageSize = 20, search = '') => {
    setLoading(true);
    try {
      const response = await userAPI.getUsers({
        page,
        per_page: pageSize,
        search
      });
      
      if (response.success && (response as any).data) {
        setUsers((response as any).data.users);
        setPagination({
          current: (response as any).data.current_page,
          pageSize: (response as any).data.per_page,
          total: (response as any).data.total
        });
      } else {
        message.error(response.message || t('userManagement.fetchFailed'));
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error(t('userManagement.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // 只有在认证完成且有管理员权限时才获取用户列表
    if (!authLoading && hasAdminPermission()) {
      fetchUsers();
    }
  }, [authLoading, hasAdminPermission, fetchUsers]);

  // 动态生成筛选项 (必须在 early return 之前)
  const roleFilters = useMemo(() => {
    const roleMap = new Map();
    users.forEach((user: any) => {
      const role = user.roles?.[0]?.user_role;
      if (role?.name) {
        roleMap.set(role.name, role.display_name || role.name);
      }
    });
    return Array.from(roleMap.entries()).map(([value, text]) => ({ text, value }));
  }, [users]);

  const statusFilters = useMemo(() => {
    const statuses = new Set(users.map((user: any) => user.is_active));
    return Array.from(statuses).map(value => ({
      text: value ? t('status.enabled') : t('status.disabled'),
      value
    }));
  }, [users, t]);

  const providerFilters = useMemo(() => {
    const providerMap = {
      local: 'Local',
      google: 'Google',
      apple: 'Apple',
      microsoft: 'Microsoft',
      aws_cognito: 'AWS Cognito'
    };
    const providers = new Set(users.map((user: any) => user.provider || 'local'));
    return Array.from(providers).map(value => ({
      text: providerMap[value] || value,
      value
    }));
  }, [users]);

  // 如果认证信息还在加载中，显示loading
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <Spin size="large" tip={t('loading')} />
      </div>
    );
  }

  // 检查管理员权限
  if (!hasAdminPermission()) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={3}>{t('userManagement.noPermission')}</Title>
        <Text type="secondary">{t('userManagement.noPermissionDesc')}</Text>
      </div>
    );
  }

  // 搜索用户
  const handleSearch = (value) => {
    setSearchText(value);
    fetchUsers(1, pagination.pageSize, value);
  };

  // 刷新列表
  const handleRefresh = () => {
    fetchUsers(pagination.current, pagination.pageSize, searchText);
  };

  // 创建用户
  const handleCreateUser = () => {
    setEditingUser(null);
    setUserFormVisible(true);
  };

  // 编辑用户
  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserFormVisible(true);
  };

  // 显示删除用户确认对话框
  const handleShowDeleteUser = (user) => {
    setDeletingUser(user);
    setDeleteUserVisible(true);
  };

  // 确认删除用户
  const handleConfirmDeleteUser = (data) => {
    setDeleteUserVisible(false);
    setDeletingUser(null);

    // 显示删除成功消息
    if (data && data.deleted_resources) {
      message.success(
        t('userManagement.deleteSuccessWithResources', {
          count: data.deleted_resources.total
        })
      );
    } else {
      message.success(t('userManagement.deleteSuccess'));
    }

    // 刷新列表
    handleRefresh();
  };

  // 取消删除用户
  const handleCancelDeleteUser = () => {
    setDeleteUserVisible(false);
    setDeletingUser(null);
  };

  // 切换用户状态
  const handleToggleUserStatus = async (user) => {
    try {
      const response = await userAPI.toggleUserStatus(user.id, {
        is_active: !user.is_active
      });
      if (response.success) {
        message.success(user.is_active ? t('userManagement.disableSuccess') : t('userManagement.enableSuccess'));
        handleRefresh();
      } else {
        message.error(response.message || t('userManagement.actionFailed'));
      }
    } catch (error) {
      console.error('切换用户状态失败:', error);
      message.error(t('userManagement.actionFailed'));
    }
  };

  // 重置密码
  const handleResetPassword = (user) => {
    setResetPasswordUser(user);
    setPasswordResetVisible(true);
  };

  const handleManagePermissions = (user) => {
    setPermissionsUser(user);
    setPermissionsVisible(true);
  };

  // 用户表单提交成功
  const handleUserFormSuccess = () => {
    setUserFormVisible(false);
    setEditingUser(null);
    handleRefresh();
  };

  // 密码重置成功
  const handlePasswordResetSuccess = () => {
    setPasswordResetVisible(false);
    setResetPasswordUser(null);
  };

  // 表格分页变化
  const handleTableChange = (paginationInfo) => {
    fetchUsers(paginationInfo.current, paginationInfo.pageSize, searchText);
  };

  // 表格列定义
  const columns = [
    {
      title: t('userManagement.columns.username'),
      dataIndex: 'username',
      key: 'username',
      width: 150,
      fixed: 'left' as const,
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: t('userManagement.columns.displayName'),
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150
    },
    {
      title: t('userManagement.columns.email'),
      dataIndex: 'email',
      key: 'email',
      width: 200
    },
    {
      title: t('userManagement.columns.roles'),
      dataIndex: 'roles',
      key: 'roles',
      width: 120,
      filters: roleFilters,
      onFilter: (value, record) => {
        const roleName = record.roles?.[0]?.user_role?.name;
        return roleName === value;
      },
      render: (roles, record) => {
        if (!roles || roles.length === 0) {
          return <Tag color="default">{t('userManagement.noRoles')}</Tag>;
        }

        // 获取角色信息
        const role = roles[0];
        const roleName = role.user_role?.name;
        const roleDisplayName = role.user_role?.display_name || role.user_role?.name || t('userManagement.unknownRole');

        // 根据角色类型设置不同的颜色
        let color = 'blue';
        if (roleName === 'super_admin') {
          color = 'red';
        } else if (roleName === 'viewer') {
          color = 'default';
        } else if (roleName === 'regular_user') {
          color = 'green';
        }

        return <Tag color={color}>{roleDisplayName}</Tag>;
      }
    },
    {
      title: t('userManagement.columns.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      filters: statusFilters,
      onFilter: (value, record) => record.is_active === value,
      render: (isActive) => (
        <Badge
          status={isActive ? 'success' : 'error'}
          text={isActive ? t('status.enabled') : t('status.disabled')}
        />
      )
    },
    {
      title: t('userManagement.columns.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: t('userManagement.columns.provider'),
      dataIndex: 'provider',
      key: 'provider',
      width: 100,
      filters: providerFilters,
      onFilter: (value, record) => (record.provider || 'local') === value,
      render: (provider) => {
        const providerMap = {
          local: { text: 'Local', color: 'default' },
          google: { text: 'Google', color: 'blue' },
          apple: { text: 'Apple', color: 'default' },
          microsoft: { text: 'Microsoft', color: 'cyan' },
          aws_cognito: { text: 'AWS Cognito', color: 'orange' }
        };
        const config = providerMap[provider] || { text: provider || 'Local', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: t('userManagement.columns.actions'),
      key: 'actions',
      width: 250,
      fixed: 'right' as const,
      render: (_, record) => {
        const isRootUser = record.username === 'admin';
        const isCurrentUser = record.id === currentUser?.id;

        return (
          <Space>
            <Tooltip title={t('userManagement.editUser')}>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEditUser(record)}
                style={{ color: '#1677ff' }}
              />
            </Tooltip>
            <Tooltip title={t('userManagement.resetPassword')}>
              <Button
                type="text"
                icon={<LockOutlined />}
                onClick={() => handleResetPassword(record)}
                style={{ color: '#1677ff' }}
              />
            </Tooltip>
            <Tooltip title={t('userManagement.permissions')}>
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => handleManagePermissions(record)}
                style={{ color: '#1677ff' }}
              />
            </Tooltip>
            <Tooltip title={
              isRootUser
                ? t('userManagement.rootUserStatusImmutable')
                : (record.is_active ? t('userManagement.disableUser') : t('userManagement.enableUser'))
            }>
              <Button
                type="text"
                icon={record.is_active ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={() => handleToggleUserStatus(record)}
                disabled={isCurrentUser || isRootUser}
                danger={record.is_active}
                style={record.is_active ? undefined : { color: '#1677ff' }}
              />
            </Tooltip>
            <Tooltip title={
              isRootUser
                ? t('userManagement.rootUserNotDeletable')
                : t('userManagement.deleteUser')
            }>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={isCurrentUser || isRootUser}
                onClick={() => handleShowDeleteUser(record)}
              />
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  // 标签页配置
  const tabItems = [
    {
      key: 'internal',
      label: (
        <Space>
          <UserOutlined />
          {t('userManagement.userList')}
        </Space>
      ),
      children: (
        <div>
          {/* 操作栏 */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Search
                placeholder={t('userManagement.searchPlaceholder')}
                allowClear
                style={{ width: 300 }}
                onSearch={handleSearch}
                enterButton={<SearchOutlined />}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                {t('refresh')}
              </Button>
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateUser}
            >
              {t('userManagement.createUser')}
            </Button>
          </div>

          {/* 用户表格 */}
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => t('table.pagination.rangeTotal', { start: range[0], end: range[1], total })
            }}
            onChange={handleTableChange}
          />
        </div>
      )
    },
    {
      key: 'external',
      label: (
        <Space>
          <TeamOutlined />
          {t('userManagement.externalSystems')}
        </Space>
      ),
      children: <ExternalUserSystems />
    },
    {
      key: 'roles',
      label: (
        <Space>
          <SafetyCertificateOutlined />
          {t('userManagement.roleDefinition')}
        </Space>
      ),
      children: <UserRoleManagement />
    }
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
          <Space>
            <SettingOutlined />
            {t('userManagement.title')}
          </Space>
        </Title>
        <Text type="secondary">
          {t('userManagement.subtitle')}
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />

      {/* 用户表单弹窗 */}
      <UserForm
        visible={userFormVisible}
        user={editingUser}
        onCancel={() => {
          setUserFormVisible(false);
          setEditingUser(null);
        }}
        onSuccess={handleUserFormSuccess}
      />

      {/* 密码重置弹窗 */}
      <PasswordResetModal
        visible={passwordResetVisible}
        user={resetPasswordUser}
        onCancel={() => {
          setPasswordResetVisible(false);
          setResetPasswordUser(null);
        }}
        onSuccess={handlePasswordResetSuccess}
      />

      {/* 权限管理弹窗 */}
      <UserPermissions
        visible={permissionsVisible}
        user={permissionsUser}
        onCancel={() => {
          setPermissionsVisible(false);
          setPermissionsUser(null);
        }}
      />

      {/* 删除用户确认弹窗 */}
      <DeleteUserModal
        visible={deleteUserVisible}
        user={deletingUser}
        onCancel={handleCancelDeleteUser}
        onConfirm={handleConfirmDeleteUser}
      />
    </div>
  );
};

export default UserManagementPage;
