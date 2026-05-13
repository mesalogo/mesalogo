import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Card, Button, Space, Table, Tag, Typography, Modal, Form, Input, Select,
  message, Badge, Popconfirm, Tooltip, Switch, Drawer, Skeleton, Alert, List
} from 'antd';
import {
  DatabaseOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SyncOutlined, EyeOutlined, ApiOutlined, SettingOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SearchOutlined
} from '@ant-design/icons';
import { externalKnowledgeAPI } from '../../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ExternalKnowledges = forwardRef(({ hideCreateButton = false }: { hideCreateButton?: boolean }, ref) => {
  const [knowledges, setKnowledges] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState(null);
  const [testingKnowledge, setTestingKnowledge] = useState(null);

  // 测试查询相关状态
  const [testQueryModalVisible, setTestQueryModalVisible] = useState(false);
  const [testQueryLoading, setTestQueryLoading] = useState(false);
  const [testQueryResults, setTestQueryResults] = useState(null);
  const [testQueryError, setTestQueryError] = useState(null);
  const [currentTestKnowledge, setCurrentTestKnowledge] = useState(null);

  const [form] = Form.useForm();
  const [testQueryForm] = Form.useForm();

  // 显示创建/编辑模态框
  const showModal = (knowledge = null) => {
    setEditingKnowledge(knowledge);
    if (knowledge) {
      form.setFieldsValue({
        name: knowledge.name,
        description: knowledge.description,
        provider_id: knowledge.provider.id,
        external_kb_id: knowledge.external_kb_id,
        query_config: typeof knowledge.query_config === 'object'
          ? JSON.stringify(knowledge.query_config, null, 2)
          : knowledge.query_config
      });
    } else {
      form.resetFields();
      // 设置默认额外参数 - 只包含基本必需参数
      form.setFieldsValue({
        query_config: JSON.stringify({
          search_method: "semantic_search",
          reranking_enable: false,
          top_k: 5,
          score_threshold_enabled: false
        }, null, 2)
      });
    }
    setModalVisible(true);
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    showModal
  }));

  // 获取数据
  useEffect(() => {
    fetchKnowledges();
    fetchProviders();
  }, []);

  const fetchKnowledges = async () => {
    setLoading(true);
    try {
      const response = await externalKnowledgeAPI.getExternalKnowledges();
      if (response.success) {
        setKnowledges(response.data);
      } else {
        message.error(response.message || '获取外部知识库列表失败');
      }
    } catch (error) {
      message.error('获取外部知识库列表失败');
      console.error('获取外部知识库列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await externalKnowledgeAPI.getProviders();
      if (response.success) {
        setProviders(response.data);
      }
    } catch (error) {
      console.error('获取提供商列表失败:', error);
    }
  };

  // 处理表单提交
  const handleSubmit = async (values) => {
    try {
      // 处理查询配置
      const submitData = {
        ...values,
        query_config: typeof values.query_config === 'string' 
          ? JSON.parse(values.query_config) 
          : values.query_config
      };

      if (editingKnowledge) {
        // 更新外部知识库
        const response = await externalKnowledgeAPI.updateExternalKnowledge(editingKnowledge.id, submitData);
        if (response.success) {
          message.success('外部知识库更新成功');
          fetchKnowledges();
          setModalVisible(false);
        } else {
          message.error(response.message || '更新失败');
        }
      } else {
        // 创建外部知识库
        const response = await externalKnowledgeAPI.createExternalKnowledge(submitData);
        if (response.success) {
          message.success('外部知识库创建成功');
          fetchKnowledges();
          setModalVisible(false);
        } else {
          message.error(response.message || '创建失败');
        }
      }
    } catch (error) {
      message.error(editingKnowledge ? '更新失败' : '创建失败');
      console.error('提交失败:', error);
    }
  };

  // 显示测试查询模态框
  const showTestQueryModal = (knowledge) => {
    setCurrentTestKnowledge(knowledge);
    setTestQueryResults(null);
    setTestQueryError(null);
    setTestQueryModalVisible(true);
    testQueryForm.resetFields();
  };

  // 执行测试查询
  const handleTestQuery = async (values) => {
    if (!currentTestKnowledge) return;

    setTestQueryLoading(true);
    setTestQueryResults(null);
    setTestQueryError(null);

    try {
      const response = await externalKnowledgeAPI.testExternalKnowledgeQuery(
        currentTestKnowledge.id,
        values.query
      );

      if (response.success) {
        setTestQueryResults(response);
        message.success('查询执行成功');
      } else {
        setTestQueryError(response.message || response.error_message || '查询失败');
        message.error(response.message || response.error_message || '查询失败');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || '查询请求失败';
      setTestQueryError(errorMsg);
      message.error(errorMsg);
      console.error('查询测试失败:', error);
    } finally {
      setTestQueryLoading(false);
    }
  };

  // 删除外部知识库
  const handleDelete = async (knowledgeId) => {
    try {
      const response = await externalKnowledgeAPI.deleteExternalKnowledge(knowledgeId);
      if (response.success) {
        message.success('外部知识库删除成功');
        fetchKnowledges();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
      console.error('删除失败:', error);
    }
  };

  // 显示详情抽屉
  const showDetailDrawer = (knowledge) => {
    setSelectedKnowledge(knowledge);
    setDetailDrawerVisible(true);
  };

  // 获取提供商信息
  const getProviderInfo = (providerId) => {
    return providers.find(p => p.id === providerId) || {};
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left' as const,
      render: (text, record) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1677ff' }} />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '提供商',
      key: 'provider',
      width: 200,
      render: (_, record) => (
        <Space>
          <ApiOutlined style={{ color: '#52c41a' }} />
          <span>{record.provider.name}</span>
          <Tag color="blue">{record.provider.type.toUpperCase()}</Tag>
        </Space>
      ),
    },
    {
      title: '外部ID',
      dataIndex: 'external_kb_id',
      key: 'external_kb_id',
      width: 200,
      ellipsis: true,
    },
    {
      title: '角色关联',
      dataIndex: 'role_count',
      key: 'role_count',
      width: 100,
      render: (count) => <Badge count={count} showZero color="green" />,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => showDetailDrawer(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="测试查询">
            <Button
              type="text"
              icon={<SearchOutlined />}
              onClick={() => showTestQueryModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个外部知识库吗？"
            description="删除后将无法恢复，且会影响相关的角色绑定。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
               
              />
            </Tooltip>
          </Popconfirm>
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
            onClick={() => showModal()}
            disabled={providers.length === 0}
          >
            添加知识库
          </Button>
        </div>
      )}

      {providers.length === 0 && (
        <Card style={{ marginBottom: 16, textAlign: 'center' }}>
          <Paragraph type="secondary">
            还没有配置外部知识库提供商，请先到"提供商管理"页面添加提供商。
          </Paragraph>
        </Card>
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
            showTotal: (total) => `共 ${total} 个外部知识库`,
          }}
        />
      )}

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingKnowledge ? '编辑外部知识库' : '添加外部知识库'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="请输入知识库名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={2} placeholder="请输入知识库描述" />
          </Form.Item>

          <Form.Item
            name="provider_id"
            label="选择提供商"
            rules={[{ required: true, message: '请选择提供商' }]}
          >
            <Select placeholder="请选择提供商">
              {providers.map(provider => (
                <Option key={provider.id} value={provider.id}>
                  <Space>
                    <ApiOutlined />
                    <span>{provider.name}</span>
                    <Tag>{provider.type.toUpperCase()}</Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="external_kb_id"
            label="外部知识库ID"
            rules={[{ required: true, message: '请输入外部知识库ID' }]}
          >
            <Input placeholder="请输入在提供商系统中的知识库ID" />
          </Form.Item>

          <Form.Item
            name="query_config"
            label="额外参数 (JSON格式)"
            rules={[
              { required: true, message: '请输入额外参数配置' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    if (typeof value === 'string') {
                      JSON.parse(value);
                    }
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('请输入有效的JSON格式'));
                  }
                }
              }
            ]}
            extra="这些参数将在每次查询时作为额外参数发送给知识库API，可以动态调整查询行为"
          >
            <TextArea
              rows={4}
              placeholder='{"top_k": 5, "similarity_threshold": 0.7, "vector_similarity_weight": 0.3, "keywords_similarity_weight": 0.7, "rerank": true}'
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingKnowledge ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="外部知识库详情"
        placement="right"
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        size="default"
      >
        {selectedKnowledge && (
          <div>
            <Title level={5}>{selectedKnowledge.name}</Title>
            <Paragraph type="secondary">{selectedKnowledge.description}</Paragraph>
            
            <div style={{ marginBottom: 16 }}>
              <Text strong>提供商：</Text>
              <Space style={{ marginLeft: 8 }}>
                <ApiOutlined />
                <span>{selectedKnowledge.provider.name}</span>
                <Tag color="blue">{selectedKnowledge.provider.type.toUpperCase()}</Tag>
              </Space>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>外部ID：</Text>
              <Text code style={{ marginLeft: 8 }}>{selectedKnowledge.external_kb_id}</Text>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>角色关联数：</Text>
              <Badge count={selectedKnowledge.role_count} showZero color="green" style={{ marginLeft: 8 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>额外参数：</Text>
              <div style={{ marginTop: 4, marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  查询时动态添加的参数配置
                </Text>
              </div>
              <pre style={{
                background: 'var(--custom-hover-bg)',
                padding: 12,
                borderRadius: 4,
                marginTop: 8,
                fontSize: '12px'
              }}>
                {JSON.stringify(selectedKnowledge.query_config, null, 2)}
              </pre>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>创建时间：</Text>
              <Text style={{ marginLeft: 8 }}>
                {selectedKnowledge.created_at ? new Date(selectedKnowledge.created_at).toLocaleString() : '-'}
              </Text>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>更新时间：</Text>
              <Text style={{ marginLeft: 8 }}>
                {selectedKnowledge.updated_at ? new Date(selectedKnowledge.updated_at).toLocaleString() : '-'}
              </Text>
            </div>
          </div>
        )}
      </Drawer>

      {/* 测试查询模态框 */}
      <Modal
        title={
          <Space>
            <SearchOutlined />
            <span>测试知识库查询</span>
            {currentTestKnowledge && (
              <Tag color="blue">{currentTestKnowledge.name}</Tag>
            )}
          </Space>
        }
        open={testQueryModalVisible}
        onCancel={() => setTestQueryModalVisible(false)}
        footer={null}
        width={800}
        destroyOnHidden={true}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            在这里测试知识库的查询功能，将使用知识库配置的额外参数
          </Text>
          {currentTestKnowledge?.query_config && (
            <div style={{ marginTop: 8, padding: 8, background: 'var(--custom-bg-layout)', borderRadius: 4 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                当前额外参数: {JSON.stringify(currentTestKnowledge.query_config)}
              </Text>
            </div>
          )}
        </div>

        <Form
          form={testQueryForm}
          layout="vertical"
          onFinish={handleTestQuery}
        >
          <Form.Item
            name="query"
            label="查询内容"
            rules={[{ required: true, message: '请输入查询内容' }]}
            initialValue="什么是人工智能？"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入要查询的内容，例如：什么是人工智能？"
              disabled={testQueryLoading}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={testQueryLoading}
              icon={<SearchOutlined />}
            >
              执行查询
            </Button>
          </Form.Item>
        </Form>

        {/* 查询结果显示 */}
        {testQueryLoading && (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {[1, 2, 3].map(item => (
              <Card key={item}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            ))}
          </Space>
        )}

        {testQueryError && (
          <Alert
            message="查询失败"
            description={testQueryError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {testQueryResults && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>查询结果</Text>
              <Tag color="green" style={{ marginLeft: 8 }}>
                找到 {testQueryResults.total_count || 0} 个结果
              </Tag>
              <Tag color="blue" style={{ marginLeft: 4 }}>
                耗时 {testQueryResults.query_time ? (testQueryResults.query_time * 1000).toFixed(0) : 0}ms
              </Tag>
            </div>

            {testQueryResults.results && testQueryResults.results.length > 0 ? (
              <List
                dataSource={testQueryResults.results}
                renderItem={(item: any, index) => (
                  <List.Item>
                    <Card
                     
                      title={
                        <Space>
                          <Badge count={index + 1} style={{ backgroundColor: '#1677ff' }} />
                          <Text strong>相似度: {(item.score * 100).toFixed(1)}%</Text>
                        </Space>
                      }
                      style={{ width: '100%' }}
                    >
                      <Paragraph
                        ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}
                        style={{ marginBottom: 8 }}
                      >
                        {item.content}
                      </Paragraph>

                      {item.metadata && (
                        <div style={{ marginTop: 8, padding: 8, background: 'var(--custom-hover-bg)', borderRadius: 4 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            元数据: {JSON.stringify(item.metadata, null, 2)}
                          </Text>
                        </div>
                      )}
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Text type="secondary">没有找到相关结果</Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
});

export default ExternalKnowledges;
