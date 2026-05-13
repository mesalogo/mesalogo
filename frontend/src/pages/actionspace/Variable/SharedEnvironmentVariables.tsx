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

const { Text, Title } = Typography;
const { TextArea } = Input;

const SharedEnvironmentVariables = () => {
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
      message.error('获取共享环境变量失败');
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
      message.success('共享环境变量删除成功');
      fetchVariables();
    } catch (error) {
      message.error(error.response?.data?.error || '删除失败');
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
        message.success('共享环境变量更新成功');
      } else {
        await sharedEnvironmentVariablesAPI.create(variableData);
        message.success('共享环境变量创建成功');
      }

      setIsModalVisible(false);
      fetchVariables();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  // 取消模态框
  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  // 表格列定义
  const columns = [
    {
      title: '变量名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: '显示标签',
      dataIndex: 'label',
      key: 'label',
      width: 150
    },
    {
      title: '默认值',
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
      title: '权限',
      dataIndex: 'is_readonly',
      key: 'is_readonly',
      width: 80,
      render: (readonly) => (
        <Tag 
          icon={readonly ? <LockOutlined /> : <UnlockOutlined />}
          color={readonly ? 'red' : 'green'}
        >
          {readonly ? '只读' : '读写'}
        </Tag>
      )
    },
    {
      title: '绑定空间',
      dataIndex: 'bound_spaces',
      key: 'bound_spaces',
      width: 200,
      render: (boundSpaces) => {
        if (!boundSpaces || boundSpaces.length === 0) {
          return <Text type="secondary">未绑定</Text>;
        }

        if (boundSpaces.length <= 2) {
          // 如果绑定空间数量少，直接显示所有空间名称
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
          // 如果绑定空间较多，显示前两个和数量
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
                    <div style={{ marginBottom: 4 }}>所有绑定空间：</div>
                    {boundSpaces.map(space => (
                      <div key={space.id}>• {space.name}</div>
                    ))}
                  </div>
                }
              >
                <Tag color="orange">
                  +{boundSpaces.length - 2}个
                </Tag>
              </Tooltip>
            </Space>
          );
        }
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text type="secondary">{text || '无描述'}</Text>
        </Tooltip>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: '操作',
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
            title="确定删除这个共享环境变量吗？"
            description={
              record.bound_spaces && record.bound_spaces.length > 0
                ? `该变量已被 ${record.bound_spaces.length} 个行动空间绑定（${record.bound_spaces.map(s => s.name).join('、')}），删除后将影响这些空间`
                : '删除后无法恢复'
            }
            onConfirm={() => handleDeleteVariable(record.id)}
            okText="确定"
            cancelText="取消"
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
          管理可在多个行动空间中共享的环境变量，提高变量复用性和一致性
        </Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>共 {variables.length} 个共享环境变量</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchVariables}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateVariable}
          >
            创建共享变量
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
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
      />

      {/* 添加/编辑共享变量对话框 */}
      <Modal
        title={`${editingVariable ? '编辑' : '创建'}共享环境变量`}
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
            label="变量名"
            rules={[
              { required: true, message: '请输入变量名' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '变量名必须以字母开头，只能包含字母、数字和下划线' }
            ]}
          >
            <Input 
              placeholder="输入变量名，如: shared_config" 
              disabled={!!editingVariable}
            />
          </Form.Item>

          <Form.Item
            name="label"
            label="显示标签"
            rules={[{ required: true, message: '请输入显示标签' }]}
          >
            <Input placeholder="输入显示标签，如: 共享配置" />
          </Form.Item>

          <Form.Item
            name="value"
            label="默认值"
            rules={[{ required: true, message: '请输入默认值' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="输入默认值"
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            extra="可选，描述该变量的用途和使用场景"
          >
            <TextArea 
              rows={2} 
              placeholder="描述该变量的用途和使用场景（可选）"
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="is_readonly"
            label="权限设置"
            valuePropName="checked"
            extra="只读变量在任务中不能被修改，适用于配置类变量"
          >
            <Switch
              checkedChildren="读写"
              unCheckedChildren="只读"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SharedEnvironmentVariables;
