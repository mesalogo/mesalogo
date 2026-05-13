import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Table, Button, Space, Modal, Form, Input, Tag, Tooltip, App, Switch, Divider, Checkbox, Skeleton, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined, ShareAltOutlined, GlobalOutlined, TeamOutlined, LockOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import knowledgeAPI from '../../services/api/knowledge';
import KnowledgeDetailModal from './KnowledgeDetailModal';
import TestSearchModal from './components/TestSearchModal';
import KnowledgeFormModal from './components/KnowledgeFormModal';

const { TextArea } = Input;

const KnowledgeList = forwardRef(({ onViewDocuments, hideCreateButton = false }: { onViewDocuments: any, hideCreateButton?: boolean }, ref) => {
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
        message.error(response?.message || '获取知识库列表失败');
      }
    } catch (error) {
      console.error('获取知识库列表失败:', error);
      message.error('获取知识库列表失败');
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
        // 更新知识库
        const response = await knowledgeAPI.update(editingId, values);
        if (response.success) {
          message.success('知识库更新成功');
          fetchKnowledges(); // 重新获取列表
        } else {
          message.error(response.message || '更新知识库失败');
        }
      } else {
        // 创建知识库
        const response = await knowledgeAPI.create(values);
        if (response.success) {
          message.success('知识库创建成功');
          fetchKnowledges(); // 重新获取列表
        } else {
          // 检查是否是配额超限错误
          if (response.status === 403 && response.quota) {
            message.error(`配额超限：${response.message || '您的计划已达到知识库数量上限'}`);
          } else {
            message.error(response.message || '创建知识库失败');
          }
        }
      }
      setModalVisible(false);
      form.resetFields();
      setEditingId(null);
    } catch (error: any) {
      console.error('操作知识库失败:', error);
      // 检查是否是配额超限错误
      if (error.response?.status === 403 && error.response?.data?.quota) {
        message.error(`配额超限：${error.response.data.message || '您的计划已达到知识库数量上限'}`);
      } else {
        message.error(editingId ? '更新知识库失败' : '创建知识库失败');
      }
    }
  };



  // 处理删除知识库
  const handleDelete = (id) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这个知识库吗？删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await knowledgeAPI.delete(id);
          if (response.success) {
            message.success('知识库删除成功');
            fetchKnowledges(); // 重新获取列表
          } else {
            message.error(response.message || '删除知识库失败');
          }
        } catch (error) {
          console.error('删除知识库失败:', error);
          message.error('删除知识库失败');
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
      title: '名称',
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
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'kb_type',
      key: 'kb_type',
      width: 120,
      render: (kb_type) => {
        if (kb_type === 'lightrag') {
          return (
            <Tooltip title="LightRAG 知识图谱增强检索">
              <Tag color="purple">LightRAG</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="传统向量检索">
            <Tag color="blue">Vector</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        // 系统资源：created_by 为 null
        if (!created_by) {
          return (
            <Tooltip title="系统资源，所有用户可见可用">
              <Tag icon={<GlobalOutlined />} color="blue">
                系统
              </Tag>
            </Tooltip>
          );
        }

        // 用户共享资源：created_by 有值且 is_shared 为 true
        if (record.is_shared) {
          return (
            <Tooltip title="用户共享资源，所有用户可见可用">
              <Tag icon={<TeamOutlined />} color="green">
                共享
              </Tag>
            </Tooltip>
          );
        }

        // 私有资源：created_by 有值且 is_shared 为 false
        return (
          <Tooltip title="私有资源，仅创建者可见">
            <Tag icon={<LockOutlined />} color="orange">
              私有
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '图谱增强',
      key: 'graph_enhancement',
      width: 100,
      render: (_, record) => {
        const enabled = record.settings?.graph_enhancement?.enabled;
        return enabled ? (
          <Tag color="green" icon={<ShareAltOutlined />}>
            已启用
          </Tag>
        ) : (
          <Tag color="default">
            未启用
          </Tag>
        );
      },
    },
    {
      title: '文档数',
      dataIndex: 'document_count',
      key: 'document_count',
      width: 100,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="测试查询">
            <Button
              type="text"
              icon={<SearchOutlined />}
              onClick={() => handleOpenTestQuery(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="编辑知识库">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="删除知识库">
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
            新建知识库
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
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      )}

      <Modal
        title={editingId ? '编辑知识库' : '新建知识库'}
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
            label="名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="请输入知识库名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={4} placeholder="请输入知识库描述（可选）" />
          </Form.Item>

          <Form.Item
            name="is_shared"
            valuePropName="checked"
            tooltip="勾选后，该知识库将对所有用户可见可用（但只有创建者可编辑）"
          >
            <Checkbox>
              <Space>
                <TeamOutlined />
                共享给所有用户
              </Space>
            </Checkbox>
          </Form.Item>

          <Divider />

          <Form.Item
            name={['settings', 'graph_enhancement', 'enabled']}
            label={
              <Space>
                <ShareAltOutlined />
                图谱增强
              </Space>
            }
            tooltip="启用图谱增强可以通过知识图谱技术提升检索准确性和上下文理解能力"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="启用"
              unCheckedChildren="禁用"
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
