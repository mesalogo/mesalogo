import { useState, useEffect } from 'react';
import { Modal, Button, Alert, Descriptions, Spin, Space, Tag } from 'antd';
import { ExclamationCircleOutlined, GlobalOutlined, TeamOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { userAPI } from '../../../services/api/users';

const DeleteUserModal = ({ visible, user, onCancel, onConfirm }: any) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadDeletionPreview();
    }
  }, [visible, user]);

  const loadDeletionPreview = async () => {
    setLoading(true);
    try {
      const response: any = await userAPI.getDeletionPreview(user.id);
      if (response.success && response.data) {
        setPreview(response.data);
      } else {
        console.error('加载删除预览失败:', response.message);
      }
    } catch (error) {
      console.error('加载删除预览失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response: any = await userAPI.deleteUser(user.id);
      if (response.success && response.data) {
        onConfirm(response.data);
      } else {
        console.error('删除用户失败:', response.message);
      }
    } catch (error) {
      console.error('删除用户失败:', error);
    } finally {
      setDeleting(false);
    }
  };

  const renderResourceCount = (resource: any) => {
    if (!resource) return '0 个';
    
    const { count, private: privateCount, shared: sharedCount } = resource;
    
    if (count === 0) {
      return '0 个';
    }
    
    return (
      <Space>
        <span>{count} 个</span>
        {privateCount > 0 && (
          <Tag icon={<LockOutlined />} color="orange">
            私有: {privateCount}
          </Tag>
        )}
        {sharedCount > 0 && (
          <Tag icon={<TeamOutlined />} color="green">
            共享: {sharedCount}
          </Tag>
        )}
      </Space>
    );
  };

  const hasSharedResources = () => {
    if (!preview || !preview.resources) return false;
    
    return Object.values(preview.resources).some((resource: any) => resource.shared > 0);
  };

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          <span>{t('userManagement.confirmDeleteTitle')}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('cancel')}
        </Button>,
        <Button
          key="delete"
          type="primary"
          danger
          loading={deleting}
          onClick={handleDelete}
          disabled={loading}
        >
          {t('userManagement.confirmDelete')}
        </Button>,
      ]}
      width={700}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip={t('loading')} />
        </div>
      ) : preview ? (
        <>
          <Alert
            message={t('userManagement.deleteWarningTitle')}
            description={t('userManagement.deleteWarningDesc')}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Descriptions 
            title={t('userManagement.userInfo')} 
            bordered 
           
            column={1}
          >
            <Descriptions.Item label={t('userManagement.columns.username')}>
              {preview.user.username}
            </Descriptions.Item>
            <Descriptions.Item label={t('userManagement.columns.email')}>
              {preview.user.email || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('userManagement.columns.roles')}>
              {preview.user.is_admin ? (
                <Tag color="red">{t('userManagement.admin')}</Tag>
              ) : (
                <Tag color="blue">{t('userManagement.regularUser')}</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions
            title={
              <Space>
                <span>{t('userManagement.resourcesToDelete')}</span>
                <Tag color="red">{t('userManagement.totalResources', { count: preview.total_resources })}</Tag>
              </Space>
            }
            bordered
           
            column={1}
            style={{ marginTop: 16 }}
          >
            <Descriptions.Item label={t('resources.roles')}>
              {renderResourceCount(preview.resources.roles)}
            </Descriptions.Item>
            <Descriptions.Item label={t('resources.knowledges')}>
              {renderResourceCount(preview.resources.knowledges)}
            </Descriptions.Item>
            <Descriptions.Item label={t('resources.capabilities')}>
              {renderResourceCount(preview.resources.capabilities)}
            </Descriptions.Item>
            <Descriptions.Item label={t('resources.actionSpaces')}>
              {renderResourceCount(preview.resources.action_spaces)}
            </Descriptions.Item>
            <Descriptions.Item label={t('resources.ruleSets')}>
              {renderResourceCount(preview.resources.rule_sets)}
            </Descriptions.Item>
            <Descriptions.Item label={t('resources.actionTasks')}>
              {renderResourceCount(preview.resources.action_tasks)}
            </Descriptions.Item>
          </Descriptions>

          {hasSharedResources() && (
            <Alert
              message={t('userManagement.sharedResourcesWarningTitle')}
              description={t('userManagement.sharedResourcesWarningDesc')}
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          {preview.total_resources === 0 && (
            <Alert
              message={t('userManagement.noResourcesInfo')}
              description={t('userManagement.noResourcesDesc')}
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </>
      ) : null}
    </Modal>
  );
};

export default DeleteUserModal;

