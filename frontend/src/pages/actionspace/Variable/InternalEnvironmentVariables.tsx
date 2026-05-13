import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Form, Input, Modal, Select, Space, Empty, Tag, message, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const InternalEnvironmentVariables = () => {
  const [variables, setVariables] = useState([]);
  const [actionSpaces, setActionSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingVariable, setEditingVariable] = useState(null);
  const [form] = Form.useForm();

  // 获取所有行动空间和其环境变量
  useEffect(() => {
    fetchAllVariables();
  }, []);

  const fetchAllVariables = async () => {
    setLoading(true);
    try {
      // 并行获取行动空间列表和内部环境变量
      const [spaces, internalVariables] = await Promise.all([
        actionSpaceAPI.getAll(),
        actionSpaceAPI.getAllEnvironmentVariables() // 这个方法现在专门返回内部环境变量数组
      ]);

      console.log('获取到的行动空间数据:', spaces);
      console.log('获取到的内部环境变量数据:', internalVariables);

      setActionSpaces(spaces);

      // 确保internalVariables是数组
      if (Array.isArray(internalVariables)) {
        setVariables(internalVariables);
      } else {
        console.warn('内部环境变量数据不是数组格式:', internalVariables);
        setVariables([]);
      }
    } catch (error) {
      console.error('获取内部环境变量失败:', error);
      message.error('获取内部环境变量失败');
      // 确保在错误情况下设置空数组
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
        // 更新现有变量
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
        message.success('内部环境变量更新成功');
      } else {
        // 创建新变量
        await actionSpaceAPI.createEnvironmentVariable(
          values.action_space_id,
          {
            name: values.name,
            label: values.label,
            description: values.description,
            value: values.value
          }
        );
        message.success('内部环境变量创建成功');
      }

      setIsModalVisible(false);
      setEditingVariable(null);
      fetchAllVariables(); // 重新获取数据
    } catch (error) {
      console.error('操作内部环境变量失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const handleDeleteVariable = async (variable) => {
    try {
      await actionSpaceAPI.deleteEnvironmentVariable(variable.action_space_id, variable.id);
      message.success('内部环境变量删除成功');
      fetchAllVariables(); // 重新获取数据
    } catch (error) {
      console.error('删除内部环境变量失败:', error);
      message.error('删除失败，请重试');
    }
  };

  const columns = [
    {
      title: '变量名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name) => <code>{name}</code>
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      width: 120,
    },
    {
      title: '所属行动空间',
      dataIndex: 'action_space_name',
      key: 'action_space_name',
      width: 140,
      render: (spaceName) => (
        <Tag color="blue">{spaceName}</Tag>
      )
    },
    {
      title: '默认值',
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: () => <Tag color="default">文本</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time) => time ? new Date(time).toLocaleDateString() : '-'
    },
    {
      title: '操作',
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
          内部环境变量可直接在行动空间页面中选择绑定，用于未来在行动任务中实例化
        </Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>共 {variables.length} 个内部环境变量</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAllVariables}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateVariable}
          >
            添加变量
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
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
        locale={{
          emptyText: variables.length === 0 && !loading ? (
            <Empty
              description="暂无内部环境变量"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : undefined
        }}
      />

      {/* 添加/编辑变量对话框 */}
      <Modal
        title={`${editingVariable ? '编辑' : '添加'}内部环境变量`}
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
            label="所属行动空间"
            rules={[{ required: true, message: '请选择行动空间' }]}
          >
            <Select placeholder="选择行动空间" disabled={!!editingVariable}>
              {actionSpaces.map(space => (
                <Option key={space.id} value={space.id}>
                  {space.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="变量名"
            rules={[
              { required: true, message: '请输入变量名' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '变量名必须以字母开头，只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="输入变量名，如: market_price" />
          </Form.Item>

          <Form.Item
            name="label"
            label="显示标签"
            rules={[{ required: true, message: '请输入显示标签' }]}
          >
            <Input placeholder="输入显示标签，如: 市场价格" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            extra="可选，描述该变量的用途和含义"
          >
            <TextArea rows={2} placeholder="描述该变量的用途和含义（可选）" />
          </Form.Item>

          <Form.Item
            name="value"
            label="默认值"
            rules={[{ required: true, message: '请输入默认值' }]}
          >
            <Input placeholder="输入默认值" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InternalEnvironmentVariables;
