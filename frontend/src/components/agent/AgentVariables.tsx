import React, { useState, useEffect } from 'react';
import {
  Table, Tag, Button, Space, Modal, Form,
  Input, Select, Switch, Popconfirm, Card,
  message, Spin, Empty, Tooltip
} from 'antd';
import {
  PlusOutlined, LineChartOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined
} from '@ant-design/icons';
import api from '../../services/api/axios';
import { useTranslation } from 'react-i18next';

const { Option } = Select;
const { TextArea } = Input;

const AgentVariables = ({ agentId }) => {
  const { t } = useTranslation();
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentVariable, setCurrentVariable] = useState(null);
  const [variableHistory, setVariableHistory] = useState([]);
  const [form] = Form.useForm();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch agent variables
  const fetchVariables = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      const response = await api.get(`/agents/${agentId}/variables`);
      setVariables(response.data.variables || []);
    } catch (error) {
      console.error('fetch agent variables failed:', error);
      message.error(t('agentVariables.msg.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch variable history
  const fetchVariableHistory = async (name) => {
    if (!agentId || !name) return;

    try {
      const response = await api.get(`/agents/${agentId}/variables/${name}/history`);
      setVariableHistory(response.data.history || []);
    } catch (error) {
      console.error('fetch variable history failed:', error);
      message.error(t('agentVariables.msg.fetchHistoryFailed'));
    }
  };

  // Create variable
  const createVariable = async (values) => {
    try {
      await api.post(`/agents/${agentId}/variables`, values);
      message.success(t('agentVariables.msg.createSuccess'));
      setModalVisible(false);
      fetchVariables();
    } catch (error) {
      console.error('create variable failed:', error);
      message.error(t('agentVariables.msg.createFailedWithDetail', { detail: error.response?.data?.error || error.message }));
    }
  };

  // Update variable
  const updateVariable = async (name, values) => {
    try {
      await api.put(`/agents/${agentId}/variables/${name}`, values);
      message.success(t('agentVariables.msg.updateSuccess'));
      setModalVisible(false);
      fetchVariables();
    } catch (error) {
      console.error('update variable failed:', error);
      message.error(t('agentVariables.msg.updateFailedWithDetail', { detail: error.response?.data?.error || error.message }));
    }
  };

  // Delete variable
  const deleteVariable = async (name) => {
    try {
      await api.delete(`/agents/${agentId}/variables/${name}`);
      message.success(t('agentVariables.msg.deleteSuccess'));
      fetchVariables();
    } catch (error) {
      console.error('delete variable failed:', error);
      message.error(t('agentVariables.msg.deleteFailedWithDetail', { detail: error.response?.data?.error || error.message }));
    }
  };

  // Initial fetch
  useEffect(() => {
    if (agentId) {
      fetchVariables();
    }
  }, [agentId]);

  // Open create modal
  const handleCreate = () => {
    setIsEditing(false);
    setCurrentVariable(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Open edit modal
  const handleEdit = (variable) => {
    setIsEditing(true);
    setCurrentVariable(variable);
    form.setFieldsValue({
      name: variable.name,
      type: variable.type,
      value: variable.value,
      is_public: variable.is_public
    });
    setModalVisible(true);
  };

  // View history
  const handleViewHistory = (variable) => {
    setCurrentVariable(variable);
    fetchVariableHistory(variable.name);
    setHistoryModalVisible(true);
  };

  // Confirm delete
  const handleDelete = (name) => {
    deleteVariable(name);
  };

  // Submit modal
  const handleModalSubmit = () => {
    form.validateFields().then(values => {
      if (isEditing && currentVariable) {
        updateVariable(currentVariable.name, { value: values.value });
      } else {
        // Only submit required fields; type is fixed to text
        const submitData = {
          name: values.name,
          value: values.value,
          type: 'text',
          is_public: values.is_public
        };
        createVariable(submitData);
      }
    }).catch(info => {
      console.log('form validation failed:', info);
    });
  };

  // Table columns
  const columns = [
    {
      title: t('agentVariables.col.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('agentVariables.col.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color="default">
          {t('agentVariables.type.text')}
        </Tag>
      )
    },
    {
      title: t('agentVariables.col.value'),
      dataIndex: 'value',
      key: 'value',
      render: (value) => {
        const displayValue = String(value || '');
        return (
          <Tooltip title={displayValue}>
            <span style={{ cursor: 'pointer' }}>{displayValue}</span>
          </Tooltip>
        );
      }
    },
    {
      title: t('agentVariables.col.visibility'),
      dataIndex: 'is_public',
      key: 'is_public',
      render: (isPublic) => (
        <Tag color={isPublic ? 'green' : 'red'}>
          {isPublic ? t('agentVariables.public') : t('agentVariables.private')}
        </Tag>
      )
    },
    {
      title: t('agentVariables.col.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: t('agentVariables.col.action'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
           
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('agentVariables.edit')}
          </Button>
          <Button
            type="text"
           
            icon={<LineChartOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            {t('agentVariables.history')}
          </Button>
          <Popconfirm
            title={t('agentVariables.confirmDelete')}
            onConfirm={() => handleDelete(record.name)}
            okText={t('agentVariables.yes')}
            cancelText={t('agentVariables.no')}
          >
            <Button
              type="text"
              danger
             
              icon={<DeleteOutlined />}
            >
              {t('agentVariables.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={t('agentVariables.title')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {t('agentVariables.add')}
          </Button>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : variables.length > 0 ? (
          <Table
            dataSource={variables}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        ) : (
          <Empty description={t('agentVariables.empty')} />
        )}
      </Card>

      {/* create/edit modal */}
      <Modal
        title={isEditing ? t('agentVariables.editTitle') : t('agentVariables.createTitle')}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalSubmit}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={t('agentVariables.col.name')}
            rules={[
              { required: true, message: t('agentVariables.form.nameReq') },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('agentVariables.form.namePattern') }
            ]}
          >
            <Input placeholder={t('agentVariables.form.namePh')} disabled={isEditing} />
          </Form.Item>

          <Form.Item
            name="type"
            label={t('agentVariables.form.type')}
            initialValue="text"
          >
            <Input value={t('agentVariables.type.text')} disabled />
          </Form.Item>

          <Form.Item
            name="value"
            label={t('agentVariables.form.value')}
            rules={[{ required: true, message: t('agentVariables.form.valueReq') }]}
          >
            <TextArea rows={3} placeholder={t('agentVariables.form.valuePh')} />
          </Form.Item>

          <Form.Item
            name="is_public"
            label={t('agentVariables.form.isPublic')}
            valuePropName="checked"
            initialValue={true}
            tooltip={t('agentVariables.form.isPublicTooltip')}
          >
            <Switch checkedChildren={t('agentVariables.public')} unCheckedChildren={t('agentVariables.private')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* history modal */}
      <Modal
        title={t('agentVariables.historyTitle', { name: currentVariable?.name })}
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            {t('agentVariables.close')}
          </Button>
        ]}
        width={700}
      >
        {variableHistory.length > 0 ? (
          <Table
            dataSource={variableHistory.map((item, index) => ({
              ...item,
              key: index,
              timestamp: new Date(item.timestamp).toLocaleString()
            }))}
            columns={[
              {
                title: t('agentVariables.col.time'),
                dataIndex: 'timestamp',
                key: 'timestamp',
              },
              {
                title: t('agentVariables.col.value'),
                dataIndex: 'value',
                key: 'value',
                render: (value) => {
                  return String(value || '');
                }
              }
            ]}
            pagination={false}
          />
        ) : (
          <Empty description={t('agentVariables.emptyHistory')} />
        )}
      </Modal>
    </div>
  );
};

export default AgentVariables;