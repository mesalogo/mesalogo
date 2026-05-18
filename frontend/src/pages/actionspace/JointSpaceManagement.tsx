// JointSpaceManagement.tsx
// Manage joint relationships between action spaces. The previous version
// shipped a large block of Chinese-only mock data (supply-chain demo).
// That demo content was deleted on 2026-05-18; this component now only
// renders real backend data.

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card, Button, Table, Empty,
  Space, Modal, Form, Input, message,
  Typography, Tag, Select, Spin,
  Tooltip, Progress
} from 'antd';
import {
  PlusOutlined, ArrowRightOutlined, SwapOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { actionSpaceAPI } from '../../services/api/actionspace';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface JointRelation {
  id: string | number;
  name: string;
  source_id?: string | number;
  target_id?: string | number;
  source_name?: string;
  target_name?: string;
  type?: string;
  influence?: string;
  active?: boolean;
  confidence?: number;
  last_update?: string;
}

const JointSpaceManagement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [actionSpaces, setActionSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [jointRelationships, setJointRelationships] = useState<JointRelation[]>([]);
  const [jointLoading, setJointLoading] = useState(false);
  const [jointModalVisible, setJointModalVisible] = useState(false);
  const [jointForm] = Form.useForm();

  useEffect(() => {
    fetchActionSpaces();
    fetchJointRelationships();
  }, []);

  const fetchActionSpaces = async () => {
    setLoading(true);
    try {
      const spacesResponse = await actionSpaceAPI.getAll();
      setActionSpaces(spacesResponse);
    } catch (error) {
      console.error('fetch action spaces failed:', error);
      message.error(t('joint.fetchSpacesFailed'));
      setActionSpaces([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchJointRelationships = async () => {
    setJointLoading(true);
    try {
      const relationships = await actionSpaceAPI.getJointSpaces();
      setJointRelationships(relationships || []);
    } catch (error) {
      console.error('fetch joint relationships failed:', error);
      message.error(t('joint.fetchRelationsFailed'));
      setJointRelationships([]);
    } finally {
      setJointLoading(false);
    }
  };

  const handleCreateJointRelation = () => {
    jointForm.resetFields();
    setJointModalVisible(true);
  };

  const handleJointModalCancel = () => {
    setJointModalVisible(false);
  };

  const handleJointModalSubmit = async () => {
    try {
      const values = await jointForm.validateFields();
      setJointLoading(true);

      // Backend API is expected to persist the relation and return the
      // created object. Until the backend is wired, optimistically add
      // it to local state so the table updates.
      const sourceSpace = actionSpaces.find(space => space.id === values.source_id);
      const targetSpace = actionSpaces.find(space => space.id === values.target_id);

      const jointData: JointRelation = {
        id: `local-${Date.now()}`,
        name: values.name,
        source_id: values.source_id,
        target_id: values.target_id,
        type: values.type,
        influence: values.influence,
        active: true,
        confidence: 100,
        last_update: new Date().toISOString().split('T')[0],
        source_name: sourceSpace?.name,
        target_name: targetSpace?.name,
      };

      setJointRelationships(prev => [...prev, jointData]);
      message.success(t('joint.createSuccess'));
      setJointModalVisible(false);
    } catch (error) {
      console.error('create joint relationship failed:', error);
      message.error(t('joint.createFailed'));
    } finally {
      setJointLoading(false);
    }
  };

  const handleDeleteJointRelation = async (id: string | number) => {
    try {
      setJointRelationships(prev => prev.filter(relation => relation.id !== id));
      message.success(t('joint.deleteSuccess'));
    } catch (error) {
      console.error('delete joint relationship failed:', error);
      message.error(t('joint.deleteFailed'));
    }
  };

  const renderConfidence = (confidence?: number) => {
    if (confidence == null) return null;
    let color = 'green';
    if (confidence < 80) color = 'orange';
    if (confidence < 70) color = 'red';

    return (
      <Tooltip title={t('joint.confidenceTip', { value: confidence })}>
        <Progress
          percent={confidence}
          status="active"
          strokeColor={color}
          style={{ width: 120 }}
        />
      </Tooltip>
    );
  };

  // Map the relation type returned by the backend (already English or
  // already localised) to a tag colour. Falls back to "default" for
  // unknown values.
  const typeColor = (type?: string) => {
    if (!type) return 'default';
    const lower = type.toLowerCase();
    if (lower.includes('supply')) return 'blue';
    if (lower.includes('invest')) return 'green';
    if (lower.includes('regul')) return 'orange';
    if (lower.includes('comp')) return 'red';
    if (lower.includes('coop') || lower.includes('partner')) return 'purple';
    return 'default';
  };

  return (
    <div className="joint-space-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('joint.title')}</Title>
          <Text type="secondary">{t('joint.subtitle')}</Text>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        {jointLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spin>
              <div style={{ padding: '20px' }}>{t('joint.loading')}</div>
            </Spin>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Title level={5}>{t('joint.established')}</Title>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateJointRelation}>
                {t('joint.create')}
              </Button>
            </div>

            {jointRelationships.length > 0 ? (
              <Table
                dataSource={jointRelationships}
                rowKey="id"
                columns={[
                  {
                    title: t('joint.col.name'),
                    dataIndex: 'name',
                    key: 'name',
                    render: (text) => <a href="#joint">{text}</a>
                  },
                  {
                    title: t('joint.col.source'),
                    dataIndex: 'source_name',
                    key: 'source_name',
                    render: (text) => <Tag color="blue">{text}</Tag>
                  },
                  {
                    title: t('joint.col.connection'),
                    key: 'connection',
                    width: 80,
                    align: 'center' as const,
                    render: (_, record) => (
                      record.influence === '双向' || record.influence === 'bidirectional' ?
                        <SwapOutlined style={{ color: '#722ed1' }} /> :
                        <ArrowRightOutlined style={{ color: '#1677ff' }} />
                    )
                  },
                  {
                    title: t('joint.col.target'),
                    dataIndex: 'target_name',
                    key: 'target_name',
                    render: (text) => <Tag color="green">{text}</Tag>
                  },
                  {
                    title: t('joint.col.type'),
                    dataIndex: 'type',
                    key: 'type',
                    render: (type) => <Tag color={typeColor(type)}>{type}</Tag>
                  },
                  {
                    title: t('joint.col.confidence'),
                    dataIndex: 'confidence',
                    key: 'confidence',
                    render: renderConfidence
                  },
                  {
                    title: t('joint.col.status'),
                    dataIndex: 'active',
                    key: 'active',
                    render: (active) => active ?
                      <Tag color="success">{t('joint.status.active')}</Tag> :
                      <Tag color="default">{t('joint.status.inactive')}</Tag>
                  },
                  {
                    title: t('joint.col.lastUpdate'),
                    dataIndex: 'last_update',
                    key: 'last_update',
                  },
                  {
                    title: t('joint.col.actions'),
                    key: 'action',
                    render: (_, record) => (
                      <Space>
                        <Button type="link" icon={<BarChartOutlined />}>{t('joint.action.analyze')}</Button>
                        <Button type="link" danger onClick={() => handleDeleteJointRelation(record.id)}>{t('joint.action.delete')}</Button>
                      </Space>
                    )
                  }
                ]}
              />
            ) : (
              <Empty
                description={t('joint.empty')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </>
        )}
      </Card>

      {/* create joint relation modal */}
      <Modal
        title={t('joint.form.title')}
        open={jointModalVisible}
        onCancel={handleJointModalCancel}
        onOk={handleJointModalSubmit}
        confirmLoading={jointLoading}
        width={600}
      >
        <Form
          form={jointForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={t('joint.form.name')}
            rules={[{ required: true, message: t('joint.form.nameRequired') }]}
          >
            <Input placeholder={t('joint.form.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="source_id"
            label={t('joint.form.source')}
            rules={[{ required: true, message: t('joint.form.sourceRequired') }]}
          >
            <Select placeholder={t('joint.form.sourcePlaceholder')}>
              {actionSpaces.map(space => (
                <Select.Option key={space.id} value={space.id}>{space.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="target_id"
            label={t('joint.form.target')}
            rules={[{ required: true, message: t('joint.form.targetRequired') }]}
          >
            <Select placeholder={t('joint.form.targetPlaceholder')}>
              {actionSpaces.map(space => (
                <Select.Option key={space.id} value={space.id}>{space.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="type"
            label={t('joint.form.type')}
            rules={[{ required: true, message: t('joint.form.typeRequired') }]}
          >
            <Select placeholder={t('joint.form.typePlaceholder')}>
              <Select.Option value="supply_chain">{t('joint.type.supplyChain')}</Select.Option>
              <Select.Option value="investment">{t('joint.type.investment')}</Select.Option>
              <Select.Option value="regulatory">{t('joint.type.regulatory')}</Select.Option>
              <Select.Option value="competition">{t('joint.type.competition')}</Select.Option>
              <Select.Option value="cooperation">{t('joint.type.cooperation')}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="influence"
            label={t('joint.form.influence')}
            rules={[{ required: true, message: t('joint.form.influenceRequired') }]}
          >
            <Select placeholder={t('joint.form.influencePlaceholder')}>
              <Select.Option value="bidirectional">{t('joint.influence.bidirectional.long')}</Select.Option>
              <Select.Option value="unidirectional">{t('joint.influence.unidirectional.long')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default JointSpaceManagement;
