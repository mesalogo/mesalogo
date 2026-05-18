import React, { useState, useEffect } from 'react';
import { Table, Button, Space, App, Tag, Upload, Alert } from 'antd';
import { DeleteOutlined, ReloadOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, InfoCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../../../services/api/knowledge';

interface LightRAGDocumentManagerProps {
  knowledgeId: string;
  workspace?: string;
}

const LightRAGDocumentManager: React.FC<LightRAGDocumentManagerProps> = ({
  knowledgeId,
}) => {
  const { t } = useTranslation('knowledgebase');
  const { message, modal } = App.useApp();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeId]);

  // Fetch document list
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.lightrag.getDocuments(knowledgeId);
      if (response.success) {
        // Ensure data is an array
        const docs = response.data?.documents || response.data || [];
        setDocuments(Array.isArray(docs) ? docs : []);
      } else {
        message.error(response.message || t('lightragDoc.fetchFailed'));
        setDocuments([]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch document list:', error);
      message.error(t('lightragDoc.fetchFailed'));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleUpload = async (file: any) => {
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await knowledgeAPI.uploadFile(knowledgeId, formData);
      
      if (response.success) {
        message.success(t('lightragDoc.uploadSuccess', { name: file.name }));

        // Refresh document list after a short delay
        setTimeout(() => {
          fetchDocuments();
        }, 2000);

        return true;
      } else {
        message.error(response.message || t('lightragDoc.uploadFailed'));
        return false;
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Upload failed:', error);
      message.error(t('lightragDoc.uploadFailed'));
      return false;
    } finally {
      setUploading(false);
    }
  };

  // Handle document deletion
  const handleDelete = (record: any) => {
    modal.confirm({
      title: t('lightragDoc.confirmDeleteTitle'),
      content: t('lightragDoc.confirmDeleteContent', { name: record.name }),
      okText: t('lightragDoc.confirmOk'),
      cancelText: t('lightragDoc.confirmCancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await knowledgeAPI.lightrag.deleteDocument(knowledgeId, record.id);
          if (response.success) {
            message.success(t('lightragDoc.deleteSuccess'));
            fetchDocuments();
          } else {
            message.error(response.message || t('lightragDoc.deleteFailed'));
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Delete failed:', error);
          message.error(t('lightragDoc.deleteFailed'));
        }
      }
    });
  };

  // Sync all documents
  const handleSyncAll = async () => {
    modal.confirm({
      title: t('lightragDoc.confirmSyncTitle'),
      content: t('lightragDoc.confirmSyncContent'),
      okText: t('lightragDoc.confirmOk'),
      cancelText: t('lightragDoc.confirmCancel'),
      onOk: async () => {
        try {
          const response = await knowledgeAPI.lightrag.syncAll(knowledgeId);
          if (response.success) {
            message.success(t('lightragDoc.syncQueued'));
            setTimeout(() => {
              fetchDocuments();
            }, 2000);
          } else {
            message.error(response.message || t('lightragDoc.syncFailed'));
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Sync failed:', error);
          message.error(t('lightragDoc.syncFailed'));
        }
      }
    });
  };

  // Render sync status tag
  const renderSyncStatus = (record: any) => {
    if (record.lightrag_synced) {
      return <Tag icon={<CheckCircleOutlined />} color="success">{t('lightragDoc.sync.synced')}</Tag>;
    }
    if (record.lightrag_sync_job_id) {
      return <Tag icon={<ClockCircleOutlined />} color="processing">{t('lightragDoc.sync.syncing')}</Tag>;
    }
    return <Tag icon={<CloseCircleOutlined />} color="default">{t('lightragDoc.sync.notSynced')}</Tag>;
  };

  // Render LightRAG processing status tag.
  // LightRAG API states: PENDING, PROCESSING, PREPROCESSED, PROCESSED, FAILED.
  const renderLightRAGStatus = (record: any) => {
    const status = record.lightrag_status || 'UNKNOWN';
    switch (status) {
      case 'PROCESSED':
        return <Tag color="success">{t('lightragDoc.status.processed')}</Tag>;
      case 'PREPROCESSED':
        return <Tag color="cyan">{t('lightragDoc.status.preprocessed')}</Tag>;
      case 'PROCESSING':
        return <Tag color="processing">{t('lightragDoc.status.processing')}</Tag>;
      case 'PENDING':
        return <Tag color="default">{t('lightragDoc.status.pending')}</Tag>;
      case 'FAILED':
        return <Tag color="error">{t('lightragDoc.status.failed')}</Tag>;
      case 'UNKNOWN':
        return <Tag color="warning">{t('lightragDoc.status.unknown')}</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const columns = [
    {
      title: t('lightragDoc.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 300,
      ellipsis: true,
    },
    {
      title: t('lightragDoc.col.syncStatus'),
      key: 'sync_status',
      width: 120,
      render: (_: any, record: any) => renderSyncStatus(record),
    },
    {
      title: t('lightragDoc.col.lightragStatus'),
      key: 'lightrag_status',
      width: 120,
      render: (_: any, record: any) => renderLightRAGStatus(record),
    },
    {
      title: t('lightragDoc.col.workspace'),
      dataIndex: 'lightrag_workspace',
      key: 'lightrag_workspace',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('lightragDoc.col.uploadedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('lightragDoc.col.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            {t('lightragDoc.action.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message={t('lightragDoc.alertTitle')}
        description={t('lightragDoc.alertDesc')}
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Space style={{ marginBottom: 16 }}>
        <Upload
          beforeUpload={(file) => {
            handleUpload(file);
            return false; // Prevent auto-upload
          }}
          showUploadList={false}
          multiple
        >
          <Button
            icon={<UploadOutlined />}
            type="primary"
            loading={uploading}
          >
            {t('lightragDoc.upload')}
          </Button>
        </Upload>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchDocuments}
          loading={loading}
        >
          {t('lightragDoc.refresh')}
        </Button>
        <Button
          icon={<SyncOutlined />}
          onClick={handleSyncAll}
        >
          {t('lightragDoc.syncAll')}
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={documents}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => t('lightragDoc.pagination.total', { total }),
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};

export default LightRAGDocumentManager;
