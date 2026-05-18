import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Table, Button, Space, Modal, Form, Input, Tag, Tooltip, App, Switch, Divider, Checkbox, Skeleton, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined, ShareAltOutlined, GlobalOutlined, TeamOutlined, LockOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import knowledgeAPI from '../../services/api/knowledge';
import KnowledgeDetailModal from './KnowledgeDetailModal';
import TestSearchModal from './components/TestSearchModal';
import KnowledgeFormModal from './components/KnowledgeFormModal';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;

const KnowledgeList = forwardRef(({ onViewDocuments, hideCreateButton = false }: { onViewDocuments: any, hideCreateButton?: boolean }, ref) => {
  const { t } = useTranslation();
  const { modal, message } = App.useApp();
  const [knowledges, setKnowledges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(null);
  const [testQueryModalVisible, setTestQueryModalVisible] = useState(false);
  const [testQueryKnowledgeId, setTestQueryKnowledgeId] = useState(null);
  const [testQueryKnowledgeName, setTestQueryKnowledgeName] = useState('');
  const [testQuerySearchOptions, setTestQuerySearchOptions] = useState({});

  // 获取知识库列表
  const fetchKnowledges = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.getAll();

      if (response && response.success) {
        setKnowledges(response.data);
      } else {
        message.error(response?.message || t('kbList.msg.fetchFailed'));
      }
    } catch (error) {
      console.error('fetch KB list failed:', error);
      message.error(t('kbList.msg.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledges();
  }, []);

  // 处理创建/编辑知识库
  const handleSubmit = async (values) => {
    try {
      // 如果启用了图谱增强，自动设置 kb_type 为 lightrag
      if (!editingId && values.settings?.graph_enhancement?.enabled) {
        values.kb_type = 'lightrag';
        // 设置默认的 LightRAG 配置
        values.lightrag_config = {
          chunk_size: 1200,
          chunk_overlap: 100,
          summary_language: 'Chinese',
          default_query_mode: 'mix',
          enable_mode_selection: true,
          top_k: 10,
        };
      }
      
      if (editingId) {
        const response = await knowledgeAPI.update(editingId, values);
        if (response.success) {
          message.success(t('kbList.msg.updateSuccess'));
          fetchKnowledges();
        } else {
          message.error(response.message || t('kbList.msg.updateFailed'));
        }
      } else {
        const response = await knowledgeAPI.create(values);
        if (response.success) {
          message.success(t('kbList.msg.createSuccess'));
          fetchKnowledges();
        } else {
          if (response.status === 403 && response.quota) {
            message.error(t('kbList.msg.quotaExceeded', { detail: response.message || t('kbList.msg.kbQuotaReached') }));
          } else {
            message.error(response.message || t('kbList.msg.createFailed'));
          }
        }
      }
      setModalVisible(false);
      form.resetFields();
      setEditingId(null);
    } catch (error: any) {
      console.error('KB op failed:', error);
      if (error.response?.status === 403 && error.response?.data?.quota) {
        message.error(t('kbList.msg.quotaExceeded', { detail: error.response.data.message || t('kbList.msg.kbQuotaReached') }));
      } else {
        message.error(editingId ? t('kbList.msg.updateFailed') : t('kbList.msg.createFailed'));
      }
    }
  };



  // delete KB
  const handleDelete = (id) => {
    modal.confirm({
      title: t('kbList.confirm.deleteTitle'),
      content: t('kbList.confirm.deleteContent'),
      okText: t('kbList.confirm.ok'),
      cancelText: t('kbList.confirm.cancel'),
      onOk: async () => {
        try {
          const response = await knowledgeAPI.delete(id);
          if (response.success) {
            message.success(t('kbList.msg.deleteSuccess'));
            fetchKnowledges();
          } else {
            message.error(response.message || t('kbList.msg.deleteFailed'));
          }
        } catch (error) {
          console.error('delete KB failed:', error);
          message.error(t('kbList.msg.deleteFailed'));
        }
      }
    });
  };

  // 打开创建模态框
  const showCreateModal = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    showCreateModal
  }));

  // 打开编辑模态框
  const showEditModal = (record) => {
    setEditingId(record.id);
    // 设置表单值，包括嵌套的settings字段
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      is_shared: record.is_shared || false,
      settings: {
        graph_enhancement: {
          enabled: record.settings?.graph_enhancement?.enabled || false
        }
      }
    });
    setModalVisible(true);
  };
  // 处理查看知识库详情（打开Modal）
  const handleViewDetails = (record) => {
    setSelectedKnowledgeId(record.id);
    setDetailModalVisible(true);
  };

  // 关闭详情Modal后的处理
  const handleDetailModalClose = () => {
    setDetailModalVisible(false);
    setSelectedKnowledgeId(null);
    fetchKnowledges(); // 刷新列表数据
  };

  // 处理测试查询
  const handleOpenTestQuery = (record) => {
    setTestQueryKnowledgeId(record.id);
    setTestQueryKnowledgeName(record.name);
    
    // 获取知识库的检索配置
    const settings = record.settings || {};
    const retrieval = settings.retrieval || {};
    setTestQuerySearchOptions({
      top_k: retrieval.top_k || 5,
      score_threshold: retrieval.score_threshold !== undefined ? retrieval.score_threshold : 0.0
    });
    
    setTestQueryModalVisible(true);
  };

  const columns = [
    {
      title: t('kbList.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left' as const,
      render: (text, record) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1677ff' }} />
          <button
            onClick={() => handleViewDetails(record)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#1677ff',
              textDecoration: 'underline',
              cursor: 'pointer',
              font: 'inherit'
            }}
          >
            {text}
          </button>
        </Space>
      ),
    },
    {
      title: t('kbList.col.description'),
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('kbList.col.type'),
      dataIndex: 'kb_type',
      key: 'kb_type',
      width: 120,
      render: (kb_type) => {
        if (kb_type === 'lightrag') {
          return (
            <Tooltip title={t('kbList.tip.lightrag')}>
              <Tag color="purple">LightRAG</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={t('kbList.tip.vector')}>
            <Tag color="blue">Vector</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('kbList.col.source'),
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        if (!created_by) {
          return (
            <Tooltip title={t('kbList.tip.system')}>
              <Tag icon={<GlobalOutlined />} color="blue">
                {t('kbList.source.system')}
              </Tag>
            </Tooltip>
          );
        }
        if (record.is_shared) {
          return (
            <Tooltip title={t('kbList.tip.shared')}>
              <Tag icon={<TeamOutlined />} color="green">
                {t('kbList.source.shared')}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={t('kbList.tip.private')}>
            <Tag icon={<LockOutlined />} color="orange">
              {t('kbList.source.private')}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('kbList.col.graphEnhance'),
      key: 'graph_enhancement',
      width: 100,
      render: (_, record) => {
        const enabled = record.settings?.graph_enhancement?.enabled;
        return enabled ? (
          <Tag color="green" icon={<ShareAltOutlined />}>
            {t('kbList.graph.enabled')}
          </Tag>
        ) : (
          <Tag color="default">
            {t('kbList.graph.disabled')}
          </Tag>
        );
      },
    },
    {
      title: t('kbList.col.docCount'),
      dataIndex: 'document_count',
      key: 'document_count',
      width: 100,
    },
    {
      title: t('kbList.col.size'),
      dataIndex: 'size',
      key: 'size',
      width: 120,
    },
    {
      title: t('kbList.col.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: t('kbList.col.action'),
      key: 'action',
      width: 250,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('kbList.action.view')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('kbList.action.testQuery')}>
            <Button
              type="text"
              icon={<SearchOutlined />}
              onClick={() => handleOpenTestQuery(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('kbList.action.edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('kbList.action.delete')}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {!hideCreateButton && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
          >
            {t('kbList.create')}
          </Button>
        </div>
      )}

      {loading ? (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {[1, 2, 3, 4, 5, 6].map(item => (
            <Card key={item}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </Space>
      ) : (
        <Table
          columns={columns}
          dataSource={knowledges}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => t('kbList.paginationTotal', { total }),
          }}
        />
      )}

      <Modal
        title={editingId ? t('kbList.edit') : t('kbList.create')}
        open={modalVisible}
        onOk={form.submit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label={t('kbList.form.name')}
            rules={[{ required: true, message: t('kbList.form.nameReq') }]}
          >
            <Input placeholder={t('kbList.form.namePh')} />
          </Form.Item>
          <Form.Item
            name="description"
            label={t('kbList.form.description')}
          >
            <TextArea rows={4} placeholder={t('kbList.form.descriptionPh')} />
          </Form.Item>

          <Form.Item
            name="is_shared"
            valuePropName="checked"
            tooltip={t('kbList.form.sharedTooltip')}
          >
            <Checkbox>
              <Space>
                <TeamOutlined />
                {t('kbList.form.shared')}
              </Space>
            </Checkbox>
          </Form.Item>

          <Divider />

          <Form.Item
            name={['settings', 'graph_enhancement', 'enabled']}
            label={
              <Space>
                <ShareAltOutlined />
                {t('kbList.col.graphEnhance')}
              </Space>
            }
            tooltip={t('retrievalSettings.graphEnhanceTooltip')}
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t('retrievalSettings.enabled')}
              unCheckedChildren={t('retrievalSettings.disabled')}
            />
          </Form.Item>

        </Form>
      </Modal>

      {/* 知识库详情Modal */}
      <KnowledgeDetailModal
        visible={detailModalVisible}
        knowledgeId={selectedKnowledgeId}
        onClose={handleDetailModalClose}
      />

      {/* 测试查询对话框 */}
      <TestSearchModal
        visible={testQueryModalVisible}
        onClose={() => setTestQueryModalVisible(false)}
        knowledgeId={testQueryKnowledgeId}
        knowledgeName={testQueryKnowledgeName}
        searchOptions={testQuerySearchOptions}
      />
    </div>
  );
});

export default KnowledgeList;
