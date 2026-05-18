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
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ExternalKnowledges = forwardRef(({ hideCreateButton = false }: { hideCreateButton?: boolean }, ref) => {
  const { t } = useTranslation();
  const [knowledges, setKnowledges] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState(null);
  const [testingKnowledge, setTestingKnowledge] = useState(null);

  // test-query state
  const [testQueryModalVisible, setTestQueryModalVisible] = useState(false);
  const [testQueryLoading, setTestQueryLoading] = useState(false);
  const [testQueryResults, setTestQueryResults] = useState(null);
  const [testQueryError, setTestQueryError] = useState(null);
  const [currentTestKnowledge, setCurrentTestKnowledge] = useState(null);

  const [form] = Form.useForm();
  const [testQueryForm] = Form.useForm();

  // show create/edit modal
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

  useImperativeHandle(ref, () => ({
    showModal
  }));

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
        message.error(response.message || t('extKB.msg.fetchListFailed'));
      }
    } catch (error) {
      message.error(t('extKB.msg.fetchListFailed'));
      console.error('fetch ext KB list failed:', error);
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
      console.error('fetch providers failed:', error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const submitData = {
        ...values,
        query_config: typeof values.query_config === 'string'
          ? JSON.parse(values.query_config)
          : values.query_config
      };

      if (editingKnowledge) {
        const response = await externalKnowledgeAPI.updateExternalKnowledge(editingKnowledge.id, submitData);
        if (response.success) {
          message.success(t('extKB.msg.updateSuccess'));
          fetchKnowledges();
          setModalVisible(false);
        } else {
          message.error(response.message || t('extKB.msg.updateFailed'));
        }
      } else {
        const response = await externalKnowledgeAPI.createExternalKnowledge(submitData);
        if (response.success) {
          message.success(t('extKB.msg.createSuccess'));
          fetchKnowledges();
          setModalVisible(false);
        } else {
          message.error(response.message || t('extKB.msg.createFailed'));
        }
      }
    } catch (error) {
      message.error(editingKnowledge ? t('extKB.msg.updateFailed') : t('extKB.msg.createFailed'));
      console.error('submit failed:', error);
    }
  };

  const showTestQueryModal = (knowledge) => {
    setCurrentTestKnowledge(knowledge);
    setTestQueryResults(null);
    setTestQueryError(null);
    setTestQueryModalVisible(true);
    testQueryForm.resetFields();
  };

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
        message.success(t('extKB.msg.querySuccess'));
      } else {
        setTestQueryError(response.message || response.error_message || t('extKB.msg.queryFailed'));
        message.error(response.message || response.error_message || t('extKB.msg.queryFailed'));
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || t('extKB.msg.queryRequestFailed');
      setTestQueryError(errorMsg);
      message.error(errorMsg);
      console.error('test query failed:', error);
    } finally {
      setTestQueryLoading(false);
    }
  };

  const handleDelete = async (knowledgeId) => {
    try {
      const response = await externalKnowledgeAPI.deleteExternalKnowledge(knowledgeId);
      if (response.success) {
        message.success(t('extKB.msg.deleteSuccess'));
        fetchKnowledges();
      } else {
        message.error(response.message || t('extKB.msg.deleteFailed'));
      }
    } catch (error) {
      message.error(t('extKB.msg.deleteFailed'));
      console.error('delete failed:', error);
    }
  };

  const showDetailDrawer = (knowledge) => {
    setSelectedKnowledge(knowledge);
    setDetailDrawerVisible(true);
  };

  const getProviderInfo = (providerId) => {
    return providers.find(p => p.id === providerId) || {};
  };

  const columns = [
    {
      title: t('extKB.col.name'),
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
      title: t('extKB.col.provider'),
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
      title: t('extKB.col.externalId'),
      dataIndex: 'external_kb_id',
      key: 'external_kb_id',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('extKB.col.roleCount'),
      dataIndex: 'role_count',
      key: 'role_count',
      width: 100,
      render: (count) => <Badge count={count} showZero color="green" />,
    },
    {
      title: t('extKB.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('extKB.col.action'),
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('extKB.action.detail')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => showDetailDrawer(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('extKB.action.testQuery')}>
            <Button
              type="text"
              icon={<SearchOutlined />}
              onClick={() => showTestQueryModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('extKB.action.edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Popconfirm
            title={t('extKB.confirm.deleteTitle')}
            description={t('extKB.confirm.deleteDesc')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('extKB.confirm.ok')}
            cancelText={t('extKB.confirm.cancel')}
          >
            <Tooltip title={t('extKB.action.delete')}>
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
            {t('extKB.addKB')}
          </Button>
        </div>
      )}

      {providers.length === 0 && (
        <Card style={{ marginBottom: 16, textAlign: 'center' }}>
          <Paragraph type="secondary">
            {t('extKB.noProvidersHint')}
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
            showTotal: (total) => t('extKB.paginationTotal', { total }),
          }}
        />
      )}

      {/* create/edit modal */}
      <Modal
        title={editingKnowledge ? t('extKB.editTitle') : t('extKB.addTitle')}
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
            label={t('extKB.field.kbName')}
            rules={[{ required: true, message: t('extKB.req.kbName') }]}
          >
            <Input placeholder={t('extKB.req.kbName')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('extKB.field.description')}
          >
            <TextArea rows={2} placeholder={t('extKB.ph.description')} />
          </Form.Item>

          <Form.Item
            name="provider_id"
            label={t('extKB.field.provider')}
            rules={[{ required: true, message: t('extKB.req.provider') }]}
          >
            <Select placeholder={t('extKB.req.provider')}>
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
            label={t('extKB.field.externalKbId')}
            rules={[{ required: true, message: t('extKB.req.externalKbId') }]}
          >
            <Input placeholder={t('extKB.ph.externalKbId')} />
          </Form.Item>

          <Form.Item
            name="query_config"
            label={t('extKB.field.queryConfig')}
            rules={[
              { required: true, message: t('extKB.req.queryConfig') },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    if (typeof value === 'string') {
                      JSON.parse(value);
                    }
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error(t('extKB.req.jsonValid')));
                  }
                }
              }
            ]}
            extra={t('extKB.extra.queryConfig')}
          >
            <TextArea
              rows={4}
              placeholder='{"top_k": 5, "similarity_threshold": 0.7, "vector_similarity_weight": 0.3, "keywords_similarity_weight": 0.7, "rerank": true}'
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                {t('extKB.confirm.cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {editingKnowledge ? t('extKB.update') : t('extKB.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* detail drawer */}
      <Drawer
        title={t('extKB.detail.title')}
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
              <Text strong>{t('extKB.detail.providerLabel')}</Text>
              <Space style={{ marginLeft: 8 }}>
                <ApiOutlined />
                <span>{selectedKnowledge.provider.name}</span>
                <Tag color="blue">{selectedKnowledge.provider.type.toUpperCase()}</Tag>
              </Space>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('extKB.detail.externalIdLabel')}</Text>
              <Text code style={{ marginLeft: 8 }}>{selectedKnowledge.external_kb_id}</Text>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('extKB.detail.roleCountLabel')}</Text>
              <Badge count={selectedKnowledge.role_count} showZero color="green" style={{ marginLeft: 8 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('extKB.detail.queryConfigLabel')}</Text>
              <div style={{ marginTop: 4, marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {t('extKB.detail.queryConfigHint')}
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
              <Text strong>{t('extKB.detail.createdAtLabel')}</Text>
              <Text style={{ marginLeft: 8 }}>
                {selectedKnowledge.created_at ? new Date(selectedKnowledge.created_at).toLocaleString() : '-'}
              </Text>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('extKB.detail.updatedAtLabel')}</Text>
              <Text style={{ marginLeft: 8 }}>
                {selectedKnowledge.updated_at ? new Date(selectedKnowledge.updated_at).toLocaleString() : '-'}
              </Text>
            </div>
          </div>
        )}
      </Drawer>

      {/* test-query modal */}
      <Modal
        title={
          <Space>
            <SearchOutlined />
            <span>{t('extKB.testModal.title')}</span>
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
            {t('extKB.testModal.hint')}
          </Text>
          {currentTestKnowledge?.query_config && (
            <div style={{ marginTop: 8, padding: 8, background: 'var(--custom-bg-layout)', borderRadius: 4 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('extKB.testModal.currentExtra')} {JSON.stringify(currentTestKnowledge.query_config)}
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
            label={t('extKB.testModal.queryLabel')}
            rules={[{ required: true, message: t('extKB.req.queryContent') }]}
            initialValue={t('extKB.testModal.defaultQuery')}
          >
            <Input.TextArea
              rows={3}
              placeholder={t('extKB.testModal.queryPh')}
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
              {t('extKB.execute')}
            </Button>
          </Form.Item>
        </Form>

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
            message={t('extKB.alert.queryFailed')}
            description={testQueryError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {testQueryResults && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('extKB.result.title')}</Text>
              <Tag color="green" style={{ marginLeft: 8 }}>
                {t('extKB.result.foundCount', { n: testQueryResults.total_count || 0 })}
              </Tag>
              <Tag color="blue" style={{ marginLeft: 4 }}>
                {t('extKB.result.timeMs', { ms: testQueryResults.query_time ? (testQueryResults.query_time * 1000).toFixed(0) : 0 })}
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
                          <Text strong>{t('extKB.result.score', { pct: (item.score * 100).toFixed(1) })}</Text>
                        </Space>
                      }
                      style={{ width: '100%' }}
                    >
                      <Paragraph
                        ellipsis={{ rows: 4, expandable: true, symbol: t('extKB.expand') }}
                        style={{ marginBottom: 8 }}
                      >
                        {item.content}
                      </Paragraph>

                      {item.metadata && (
                        <div style={{ marginTop: 8, padding: 8, background: 'var(--custom-hover-bg)', borderRadius: 4 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {t('extKB.result.metadata')} {JSON.stringify(item.metadata, null, 2)}
                          </Text>
                        </div>
                      )}
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Text type="secondary">{t('extKB.result.empty')}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
});

export default ExternalKnowledges;
