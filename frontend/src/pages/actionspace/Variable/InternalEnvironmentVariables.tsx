import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Form, Input, Modal, Select, Space, Empty, Tag, message, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const InternalEnvironmentVariables = () => {
  const { t } = useTranslation();
  const [variables, setVariables] = useState([]);
  const [actionSpaces, setActionSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingVariable, setEditingVariable] = useState(null);
  const [form] = Form.useForm();

  // Fetch all action spaces and env variables
  useEffect(() => {
    fetchAllVariables();
  }, []);

  const fetchAllVariables = async () => {
    setLoading(true);
    try {
      // Fetch action spaces and internal env variables in parallel
      const [spaces, internalVariables] = await Promise.all([
        actionSpaceAPI.getAll(),
        actionSpaceAPI.getAllEnvironmentVariables()
      ]);

      console.log('fetched action spaces:', spaces);
      console.log('fetched internal env variables:', internalVariables);

      setActionSpaces(spaces);

      if (Array.isArray(internalVariables)) {
        setVariables(internalVariables);
      } else {
        console.warn('internal env variables are not an array:', internalVariables);
        setVariables([]);
      }
    } catch (error) {
      console.error('fetch internal env variables failed:', error);
      message.error(t('internalEnvVar.msg.fetchFailed'));
      setVariables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariable = () => {
    setEditingVariable(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditVariable = (variable) => {
    setEditingVariable(variable);
    form.setFieldsValue({
      name: variable.name,
      label: variable.label,
      description: variable.description,
      value: variable.value,
      action_space_id: variable.action_space_id
    });
    setIsModalVisible(true);
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingVariable(null);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingVariable) {
        await actionSpaceAPI.updateEnvironmentVariable(
          values.action_space_id,
          editingVariable.id,
          {
            name: values.name,
            label: values.label,
            description: values.description,
            value: values.value
          }
        );
        message.success(t('internalEnvVar.msg.updateSuccess'));
      } else {
        await actionSpaceAPI.createEnvironmentVariable(
          values.action_space_id,
          {
            name: values.name,
            label: values.label,
            description: values.description,
            value: values.value
          }
        );
        message.success(t('internalEnvVar.msg.createSuccess'));
      }

      setIsModalVisible(false);
      setEditingVariable(null);
      fetchAllVariables();
    } catch (error) {
      console.error('operate internal env variable failed:', error);
      message.error(t('internalEnvVar.msg.opFailed'));
    }
  };

  const handleDeleteVariable = async (variable) => {
    try {
      await actionSpaceAPI.deleteEnvironmentVariable(variable.action_space_id, variable.id);
      message.success(t('internalEnvVar.msg.deleteSuccess'));
      fetchAllVariables();
    } catch (error) {
      console.error('delete internal env variable failed:', error);
      message.error(t('internalEnvVar.msg.deleteFailed'));
    }
  };

  const columns = [
    {
      title: t('internalEnvVar.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name) => <code>{name}</code>
    },
    {
      title: t('internalEnvVar.col.label'),
      dataIndex: 'label',
      key: 'label',
      width: 120,
    },
    {
      title: t('internalEnvVar.col.actionSpace'),
      dataIndex: 'action_space_name',
      key: 'action_space_name',
      width: 140,
      render: (spaceName) => (
        <Tag color="blue">{spaceName}</Tag>
      )
    },
    {
      title: t('internalEnvVar.col.defaultValue'),
      dataIndex: 'value',
      key: 'value',
      width: 150,
      ellipsis: true,
      render: (value) => value ? (
        <Tooltip title={value}>
          <Text>{value.length > 15 ? `${value.substring(0, 15)}...` : value}</Text>
        </Tooltip>
      ) : '-'
    },
    {
      title: t('internalEnvVar.col.type'),
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: () => <Tag color="default">{t('internalEnvVar.type.text')}</Tag>
    },
    {
      title: t('internalEnvVar.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time) => time ? new Date(time).toLocaleDateString() : '-'
    },
    {
      title: t('internalEnvVar.col.action'),
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditVariable(record)}
           
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteVariable(record)}
           
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('internalEnvVar.desc')}
        </Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>{t('internalEnvVar.total', { count: variables.length })}</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAllVariables}>
            {t('internalEnvVar.refresh')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateVariable}
          >
            {t('internalEnvVar.add')}
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={variables}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => t('internalEnvVar.paginationRange', { from: range[0], to: range[1], total })
        }}
        locale={{
          emptyText: variables.length === 0 && !loading ? (
            <Empty
              description={t('internalEnvVar.empty')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : undefined
        }}
      />

      {/* add/edit modal */}
      <Modal
        title={editingVariable ? t('internalEnvVar.editTitle') : t('internalEnvVar.addTitle')}
        visible={isModalVisible}
        onCancel={handleModalCancel}
        onOk={handleModalSubmit}
        width={600}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="action_space_id"
            label={t('internalEnvVar.col.actionSpace')}
            rules={[{ required: true, message: t('internalEnvVar.form.actionSpaceReq') }]}
          >
            <Select placeholder={t('internalEnvVar.form.actionSpacePh')} disabled={!!editingVariable}>
              {actionSpaces.map(space => (
                <Option key={space.id} value={space.id}>
                  {space.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label={t('internalEnvVar.col.name')}
            rules={[
              { required: true, message: t('internalEnvVar.form.nameReq') },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('internalEnvVar.form.namePattern') }
            ]}
          >
            <Input placeholder={t('internalEnvVar.form.namePh')} />
          </Form.Item>

          <Form.Item
            name="label"
            label={t('internalEnvVar.form.displayLabel')}
            rules={[{ required: true, message: t('internalEnvVar.form.labelReq') }]}
          >
            <Input placeholder={t('internalEnvVar.form.labelPh')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('internalEnvVar.col.description')}
            extra={t('internalEnvVar.form.descriptionExtra')}
          >
            <TextArea rows={2} placeholder={t('internalEnvVar.form.descriptionPh')} />
          </Form.Item>

          <Form.Item
            name="value"
            label={t('internalEnvVar.col.defaultValue')}
            rules={[{ required: true, message: t('internalEnvVar.form.valueReq') }]}
          >
            <Input placeholder={t('internalEnvVar.form.valuePh')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InternalEnvironmentVariables;
