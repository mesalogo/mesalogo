import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Space, App,
  Popconfirm, Typography, Alert, Tag, Tooltip
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  ShareAltOutlined, LockOutlined, UnlockOutlined
} from '@ant-design/icons';
import sharedEnvironmentVariablesAPI from '../../../services/api/sharedEnvironmentVariables';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;
const { TextArea } = Input;

const SharedEnvironmentVariables = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingVariable, setEditingVariable] = useState(null);
  const [form] = Form.useForm();

  // 获取所有共享环境变量
  const fetchVariables = async () => {
    setLoading(true);
    try {
      const data = await sharedEnvironmentVariablesAPI.getAll();
      setVariables(data);
    } catch (error) {
      message.error(t('sharedEnvVar.msg.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVariables();
  }, []);

  // 创建新变量
  const handleCreateVariable = () => {
    setEditingVariable(null);
    form.resetFields();
    // 设置默认值：默认为读写权限（开关打开）
    form.setFieldsValue({
      is_readonly: true  // UI中true表示读写
    });
    setIsModalVisible(true);
  };

  // 编辑变量
  const handleEditVariable = (variable) => {
    setEditingVariable(variable);
    form.setFieldsValue({
      name: variable.name,
      label: variable.label,
      value: variable.value,
      description: variable.description,
      is_readonly: !variable.is_readonly  // 反转逻辑：数据库中的is_readonly转换为UI中的is_writable
    });
    setIsModalVisible(true);
  };

  // 删除变量
  const handleDeleteVariable = async (id) => {
    try {
      await sharedEnvironmentVariablesAPI.delete(id);
      message.success(t('sharedEnvVar.msg.deleteSuccess'));
      fetchVariables();
    } catch (error) {
      message.error(error.response?.data?.error || t('sharedEnvVar.msg.deleteFailed'));
    }
  };

  // 提交表单
  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const variableData = {
        name: values.name,
        label: values.label,
        value: values.value,
        description: values.description || '',
        is_readonly: !values.is_readonly,  // 反转逻辑：UI中的is_writable转换为数据库中的is_readonly
      };

      if (editingVariable) {
        await sharedEnvironmentVariablesAPI.update(editingVariable.id, variableData);
        message.success(t('sharedEnvVar.msg.updateSuccess'));
      } else {
        await sharedEnvironmentVariablesAPI.create(variableData);
        message.success(t('sharedEnvVar.msg.createSuccess'));
      }

      setIsModalVisible(false);
      fetchVariables();
    } catch (error) {
      message.error(error.response?.data?.error || t('sharedEnvVar.msg.opFailed'));
    }
  };

  // 取消模态框
  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  // table columns
  const columns = [
    {
      title: t('sharedEnvVar.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: t('sharedEnvVar.col.label'),
      dataIndex: 'label',
      key: 'label',
      width: 150
    },
    {
      title: t('sharedEnvVar.col.defaultValue'),
      dataIndex: 'value',
      key: 'value',
      width: 200,
      render: (text) => (
        <Text ellipsis style={{ maxWidth: 180 }}>
          {text}
        </Text>
      )
    },
    {
      title: t('sharedEnvVar.col.permission'),
      dataIndex: 'is_readonly',
      key: 'is_readonly',
      width: 80,
      render: (readonly) => (
        <Tag 
          icon={readonly ? <LockOutlined /> : <UnlockOutlined />}
          color={readonly ? 'red' : 'green'}
        >
          {readonly ? t('sharedEnvVar.readonly') : t('sharedEnvVar.readwrite')}
        </Tag>
      )
    },
    {
      title: t('sharedEnvVar.col.boundSpaces'),
      dataIndex: 'bound_spaces',
      key: 'bound_spaces',
      width: 200,
      render: (boundSpaces) => {
        if (!boundSpaces || boundSpaces.length === 0) {
          return <Text type="secondary">{t('sharedEnvVar.notBound')}</Text>;
        }

        if (boundSpaces.length <= 2) {
          return (
            <Space size={4} wrap>
              {boundSpaces.map(space => (
                <Tag key={space.id} color="blue" icon={<ShareAltOutlined />}>
                  {space.name}
                </Tag>
              ))}
            </Space>
          );
        } else {
          return (
            <Space size={4} wrap>
              {boundSpaces.slice(0, 2).map(space => (
                <Tag key={space.id} color="blue" icon={<ShareAltOutlined />}>
                  {space.name}
                </Tag>
              ))}
              <Tooltip
                title={
                  <div>
                    <div style={{ marginBottom: 4 }}>{t('sharedEnvVar.allBoundSpaces')}</div>
                    {boundSpaces.map(space => (
                      <div key={space.id}>• {space.name}</div>
                    ))}
                  </div>
                }
              >
                <Tag color="orange">
                  {t('sharedEnvVar.moreCount', { count: boundSpaces.length - 2 })}
                </Tag>
              </Tooltip>
            </Space>
          );
        }
      }
    },
    {
      title: t('sharedEnvVar.col.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text type="secondary">{text || t('sharedEnvVar.noDesc')}</Text>
        </Tooltip>
      )
    },
    {
      title: t('sharedEnvVar.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: t('sharedEnvVar.col.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditVariable(record)}
          />
          <Popconfirm
            title={t('sharedEnvVar.confirm.deleteTitle')}
            description={
              record.bound_spaces && record.bound_spaces.length > 0
                ? t('sharedEnvVar.confirm.deleteWithBindings', { count: record.bound_spaces.length, names: record.bound_spaces.map(s => s.name).join(t('sharedEnvVar.listSep')) })
                : t('sharedEnvVar.confirm.deleteDesc')
            }
            onConfirm={() => handleDeleteVariable(record.id)}
            okText={t('sharedEnvVar.confirm.ok')}
            cancelText={t('sharedEnvVar.confirm.cancel')}
            disabled={record.bound_spaces && record.bound_spaces.length > 0}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.bound_spaces && record.bound_spaces.length > 0}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('sharedEnvVar.pageDesc')}
        </Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>{t('sharedEnvVar.totalCount', { count: variables.length })}</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchVariables}>
            {t('sharedEnvVar.refresh')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateVariable}
          >
            {t('sharedEnvVar.createBtn')}
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={variables}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => t('sharedEnvVar.paginationRange', { from: range[0], to: range[1], total })
        }}
      />

      {/* add/edit modal */}
      <Modal
        title={editingVariable ? t('sharedEnvVar.editTitle') : t('sharedEnvVar.createTitle')}
        open={isModalVisible}
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
            name="name"
            label={t('sharedEnvVar.col.name')}
            rules={[
              { required: true, message: t('sharedEnvVar.form.nameReq') },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('sharedEnvVar.form.namePattern') }
            ]}
          >
            <Input 
              placeholder={t('sharedEnvVar.form.namePh')}
              disabled={!!editingVariable}
            />
          </Form.Item>

          <Form.Item
            name="label"
            label={t('sharedEnvVar.col.label')}
            rules={[{ required: true, message: t('sharedEnvVar.form.labelReq') }]}
          >
            <Input placeholder={t('sharedEnvVar.form.labelPh')} />
          </Form.Item>

          <Form.Item
            name="value"
            label={t('sharedEnvVar.col.defaultValue')}
            rules={[{ required: true, message: t('sharedEnvVar.form.valueReq') }]}
          >
            <TextArea 
              rows={3} 
              placeholder={t('sharedEnvVar.form.valuePh')}
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('sharedEnvVar.col.description')}
            extra={t('sharedEnvVar.form.descriptionExtra')}
          >
            <TextArea 
              rows={2} 
              placeholder={t('sharedEnvVar.form.descriptionPh')}
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="is_readonly"
            label={t('sharedEnvVar.form.permission')}
            valuePropName="checked"
            extra={t('sharedEnvVar.form.permissionExtra')}
          >
            <Switch
              checkedChildren={t('sharedEnvVar.readwrite')}
              unCheckedChildren={t('sharedEnvVar.readonly')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SharedEnvironmentVariables;
