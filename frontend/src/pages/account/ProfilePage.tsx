import { useState, useEffect, useRef } from 'react';
import { Card, Avatar, Descriptions, Space, Typography, Spin, Input, App, Button, Table, Modal, Popconfirm, Alert, Collapse } from 'antd';
import { UserOutlined, EditOutlined, CheckOutlined, CloseOutlined, LoadingOutlined, KeyOutlined, PlusOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../services/api/users';
import apiKeysAPI from '../../services/api/apiKeys';

const { Title, Text } = Typography;

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { user, refreshUser } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<any>(null);

  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || user.username || '');
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setDisplayName(user?.display_name || user?.username || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDisplayName(user?.display_name || user?.username || '');
    setIsEditing(false);
  };

  const handleSaveDisplayName = async () => {
    console.log('handleSaveDisplayName called, displayName:', displayName);
    if (!displayName.trim()) {
      message.warning(t('account.displayNameRequired'));
      return;
    }
    if (displayName === (user?.display_name || user?.username)) {
      console.log('displayName unchanged, skipping save');
      setIsEditing(false);
      return;
    }
    try {
      setSaving(true);
      console.log('Calling userAPI.updateProfile with:', { display_name: displayName.trim() });
      const result = await userAPI.updateProfile({ display_name: displayName.trim() });
      console.log('updateProfile result:', result);
      if (result.success) {
        message.success(t('account.profileUpdateSuccess'));
        await refreshUser?.();
        setIsEditing(false);
      } else {
        message.error(result.message || t('account.profileUpdateFailed'));
      }
    } catch (error: any) {
      console.error('updateProfile error:', error);
      message.error(error.response?.data?.message || t('account.profileUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveDisplayName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const loadApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const data = await apiKeysAPI.getKeys();
      setApiKeys(data.api_keys || []);
    } catch (e) {
      console.error('Failed to load API keys', e);
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      message.warning(t('account.apiKeys.nameRequired'));
      return;
    }
    setCreating(true);
    try {
      const data = await apiKeysAPI.createKey(newKeyName.trim());
      setNewlyCreatedKey(data.key);
      message.success(t('account.apiKeys.createSuccess'));
      setNewKeyName('');
      loadApiKeys();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await apiKeysAPI.deleteKey(id);
      message.success(t('account.apiKeys.deleteSuccess'));
      loadApiKeys();
    } catch (e) {
      message.error('Failed to delete API key');
    }
  };

  const apiKeyColumns = [
    { title: t('account.apiKeys.name'), dataIndex: 'name', key: 'name' },
    { title: t('account.apiKeys.prefix'), dataIndex: 'key_prefix', key: 'key_prefix', render: (v: string) => <Text code>{v}</Text> },
    { title: t('account.apiKeys.createdAt'), dataIndex: 'created_at', key: 'created_at', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: t('account.apiKeys.lastUsedAt'), dataIndex: 'last_used_at', key: 'last_used_at', render: (v: string) => v ? new Date(v).toLocaleString() : t('account.apiKeys.neverUsed') },
    {
      title: t('account.apiKeys.actions'), key: 'actions', width: 80,
      render: (_: any, record: any) => (
        <Popconfirm title={t('account.apiKeys.deleteConfirm')} onConfirm={() => handleDeleteKey(record.id)} okText={t('confirm')} cancelText={t('cancel')}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
          <Space>
            <UserOutlined />
            {t('account.profile')}
          </Space>
        </Title>
        <Text type="secondary">
          {t('account.profileSubtitle')}
        </Text>
      </div>

      {/* 用户信息卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" align="start">
          <Avatar 
            size={80} 
            icon={<UserOutlined />} 
            src={user?.avatar}
            style={{ backgroundColor: '#1677ff' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {isEditing ? (
              <Space>
                <Input
                  ref={inputRef}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ width: 200, fontSize: 18, fontWeight: 600 }}
                  disabled={saving}
                />
                {saving ? (
                  <LoadingOutlined style={{ color: '#1677ff' }} />
                ) : (
                  <>
                    <CheckOutlined 
                      onClick={handleSaveDisplayName}
                      style={{ color: '#52c41a', cursor: 'pointer', fontSize: 16 }}
                    />
                    <CloseOutlined 
                      onClick={handleCancelEdit}
                      style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 16 }}
                    />
                  </>
                )}
              </Space>
            ) : (
              <Space>
                <Title level={4} style={{ margin: 0 }}>{user?.display_name || user?.username}</Title>
                <EditOutlined 
                  onClick={handleStartEdit}
                  style={{ color: '#1677ff', cursor: 'pointer', fontSize: 14 }}
                />
              </Space>
            )}
            <Text type="secondary">{user?.email || '-'}</Text>
            <Space style={{ marginTop: 4 }}>
              <Text type="secondary">{t('account.userId')}:</Text>
              <Text copyable={{ text: user?.id }}>{user?.id?.substring(0, 8)}...</Text>
              <Text type="secondary" style={{ marginLeft: 16 }}>{t('account.role')}:</Text>
              <Text strong>{user?.is_admin ? t('account.admin') : t('account.user')}</Text>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 账户详情 */}
      <Card 
        title={
          <Space>
            <UserOutlined />
            {t('account.accountDetails')}
          </Space>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label={t('account.username')}>{user?.username}</Descriptions.Item>
          <Descriptions.Item label={t('account.email')}>{user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('account.role')}>
            {user?.is_admin ? t('account.admin') : t('account.user')}
          </Descriptions.Item>
          <Descriptions.Item label={t('account.createdAt')}>
            {user?.created_at ? new Date(user.created_at).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('account.userId')} span={2}>
            <Text copyable>{user?.id}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* API Keys */}
      <Card
        title={<Space><KeyOutlined />{t('account.apiKeys.title')}</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateModalOpen(true); setNewlyCreatedKey(null); }}>{t('account.apiKeys.create')}</Button>}
        style={{ marginTop: 24 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{t('account.apiKeys.subtitle')}</Text>
        <Collapse
          ghost
          onChange={(keys) => { if (keys.length > 0 && apiKeys.length === 0) loadApiKeys(); }}
          items={[{
            key: '1',
            label: <Text type="secondary">{t('account.apiKeys.usageHint')}</Text>,
            children: (
              <div>
                <Text code style={{ display: 'block', marginBottom: 4 }}>base_url: http://&lt;host&gt;:8080/api/openai-export/roles/v1</Text>
                <Text code style={{ display: 'block', marginBottom: 4 }}>base_url: http://&lt;host&gt;:8080/api/openai-export/agents/v1</Text>
                <Text code style={{ display: 'block' }}>base_url: http://&lt;host&gt;:8080/api/openai-export/action-tasks/v1</Text>
              </div>
            ),
          }]}
        />
        <Table
          columns={apiKeyColumns}
          dataSource={apiKeys}
          rowKey="id"
          loading={apiKeysLoading}
          pagination={false}
          size="small"
          style={{ marginTop: 16 }}
          locale={{ emptyText: t('account.apiKeys.noKeys') }}
          onRow={() => ({ onClick: () => { if (apiKeys.length === 0) loadApiKeys(); } })}
        />
      </Card>

      {/* Create Key Modal */}
      <Modal
        title={t('account.apiKeys.create')}
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); setNewlyCreatedKey(null); setNewKeyName(''); }}
        footer={newlyCreatedKey ? [
          <Button key="close" type="primary" onClick={() => { setCreateModalOpen(false); setNewlyCreatedKey(null); setNewKeyName(''); }}>
            {t('close')}
          </Button>
        ] : undefined}
        onOk={handleCreateKey}
        confirmLoading={creating}
        okText={t('create')}
        cancelText={t('cancel')}
      >
        {newlyCreatedKey ? (
          <div>
            <Alert type="warning" title={t('account.apiKeys.copyWarning')} style={{ marginBottom: 16 }} />
            <Input.TextArea
              value={newlyCreatedKey}
              readOnly
              autoSize
              style={{ fontFamily: 'monospace' }}
            />
            <Button
              icon={<CopyOutlined />}
              style={{ marginTop: 8 }}
              onClick={() => { navigator.clipboard.writeText(newlyCreatedKey); message.success(t('account.apiKeys.copySuccess')); }}
            >
              {t('account.apiKeys.copySuccess')}
            </Button>
          </div>
        ) : (
          <Input
            placeholder={t('account.apiKeys.namePlaceholder')}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onPressEnter={handleCreateKey}
          />
        )}
      </Modal>
    </div>
  );
};

export default ProfilePage;
