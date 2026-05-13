import React, { useState, useEffect } from 'react';
import { Table, Button, Space, App, Typography, Tag, Upload, Alert } from 'antd';
import { DeleteOutlined, ReloadOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, InfoCircleOutlined, UploadOutlined } from '@ant-design/icons';
import knowledgeAPI from '../../../services/api/knowledge';

const { Title, Text } = Typography;

interface LightRAGDocumentManagerProps {
  knowledgeId: string;
  workspace?: string;
}

const LightRAGDocumentManager: React.FC<LightRAGDocumentManagerProps> = ({ 
  knowledgeId,
  workspace 
}) => {
  const { message, modal } = App.useApp();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [knowledgeId]);

  // 获取文档列表
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.lightrag.getDocuments(knowledgeId);
      if (response.success) {
        // 确保 data 是数组
        const docs = response.data?.documents || response.data || [];
        setDocuments(Array.isArray(docs) ? docs : []);
      } else {
        message.error(response.message || '获取文档列表失败');
        setDocuments([]);
      }
    } catch (error) {
      console.error('获取文档列表失败:', error);
      message.error('获取文档列表失败');
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
        message.success(`文件 "${file.name}" 上传成功，正在处理...`);
        
        // 延迟刷新文档列表
        setTimeout(() => {
          fetchDocuments();
        }, 2000);
        
        return true;
      } else {
        message.error(response.message || '上传失败');
        return false;
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      message.error('上传失败');
      return false;
    } finally {
      setUploading(false);
    }
  };

  // 处理删除文档
  const handleDelete = (record: any) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除文档 "${record.name}" 吗？删除后无法恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await knowledgeAPI.lightrag.deleteDocument(knowledgeId, record.id);
          if (response.success) {
            message.success('文档删除成功');
            fetchDocuments();
          } else {
            message.error(response.message || '删除失败');
          }
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  // 同步所有文档
  const handleSyncAll = async () => {
    modal.confirm({
      title: '同步所有文档',
      content: '确定要将所有文档同步到 LightRAG 吗？这可能需要一些时间。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await knowledgeAPI.lightrag.syncAll(knowledgeId);
          if (response.success) {
            message.success('同步任务已提交');
            setTimeout(() => {
              fetchDocuments();
            }, 2000);
          } else {
            message.error(response.message || '同步失败');
          }
        } catch (error) {
          console.error('同步失败:', error);
          message.error('同步失败');
        }
      }
    });
  };

  // 渲染同步状态
  const renderSyncStatus = (record: any) => {
    if (record.lightrag_synced) {
      return <Tag icon={<CheckCircleOutlined />} color="success">已同步</Tag>;
    }
    
    if (record.lightrag_sync_job_id) {
      return <Tag icon={<ClockCircleOutlined />} color="processing">同步中</Tag>;
    }
    
    return <Tag icon={<CloseCircleOutlined />} color="default">未同步</Tag>;
  };

  // 渲染 LightRAG 处理状态
  // LightRAG API 返回的状态: PENDING, PROCESSING, PREPROCESSED, PROCESSED, FAILED
  const renderLightRAGStatus = (record: any) => {
    const status = record.lightrag_status || 'UNKNOWN';
    
    switch (status) {
      case 'PROCESSED':
        return <Tag color="success">已完成</Tag>;
      case 'PREPROCESSED':
        return <Tag color="cyan">预处理完成</Tag>;
      case 'PROCESSING':
        return <Tag color="processing">处理中</Tag>;
      case 'PENDING':
        return <Tag color="default">等待中</Tag>;
      case 'FAILED':
        return <Tag color="error">失败</Tag>;
      case 'UNKNOWN':
        return <Tag color="warning">未知</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      ellipsis: true,
    },
    {
      title: '同步状态',
      key: 'sync_status',
      width: 120,
      render: (_: any, record: any) => renderSyncStatus(record),
    },
    {
      title: 'LightRAG 状态',
      key: 'lightrag_status',
      width: 120,
      render: (_: any, record: any) => renderLightRAGStatus(record),
    },
    {
      title: 'Workspace',
      dataIndex: 'lightrag_workspace',
      key: 'lightrag_workspace',
      width: 200,
      ellipsis: true,
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
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
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="LightRAG 文档管理"
        description="上传的文档将自动提交到 LightRAG 进行知识图谱构建，支持多种查询模式（local/global/hybrid/mix）。"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Space style={{ marginBottom: 16 }}>
        <Upload
          beforeUpload={(file) => {
            handleUpload(file);
            return false; // 阻止自动上传
          }}
          showUploadList={false}
          multiple
        >
          <Button
            icon={<UploadOutlined />}
            type="primary"
            loading={uploading}
          >
            上传文档
          </Button>
        </Upload>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchDocuments}
          loading={loading}
        >
          刷新列表
        </Button>
        <Button
          icon={<SyncOutlined />}
          onClick={handleSyncAll}
        >
          同步所有文档
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
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};

export default LightRAGDocumentManager;
