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

const { Option } = Select;
const { TextArea } = Input;

const AgentVariables = ({ agentId }) => {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentVariable, setCurrentVariable] = useState(null);
  const [variableHistory, setVariableHistory] = useState([]);
  const [form] = Form.useForm();
  const [isEditing, setIsEditing] = useState(false);

  // 获取代理变量
  const fetchVariables = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      const response = await api.get(`/agents/${agentId}/variables`);
      setVariables(response.data.variables || []);
    } catch (error) {
      console.error('获取代理变量失败:', error);
      message.error('获取代理变量失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取变量历史
  const fetchVariableHistory = async (name) => {
    if (!agentId || !name) return;

    try {
      const response = await api.get(`/agents/${agentId}/variables/${name}/history`);
      setVariableHistory(response.data.history || []);
    } catch (error) {
      console.error('获取变量历史失败:', error);
      message.error('获取变量历史失败');
    }
  };

  // 创建变量
  const createVariable = async (values) => {
    try {
      await api.post(`/agents/${agentId}/variables`, values);
      message.success('变量创建成功');
      setModalVisible(false);
      fetchVariables();
    } catch (error) {
      console.error('创建变量失败:', error);
      message.error(`创建变量失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 更新变量
  const updateVariable = async (name, values) => {
    try {
      await api.put(`/agents/${agentId}/variables/${name}`, values);
      message.success('变量更新成功');
      setModalVisible(false);
      fetchVariables();
    } catch (error) {
      console.error('更新变量失败:', error);
      message.error(`更新变量失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 删除变量
  const deleteVariable = async (name) => {
    try {
      await api.delete(`/agents/${agentId}/variables/${name}`);
      message.success('变量删除成功');
      fetchVariables();
    } catch (error) {
      console.error('删除变量失败:', error);
      message.error(`删除变量失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 初始化获取变量
  useEffect(() => {
    if (agentId) {
      fetchVariables();
    }
  }, [agentId]);

  // 打开创建模态框
  const handleCreate = () => {
    setIsEditing(false);
    setCurrentVariable(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑模态框
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

  // 查看历史记录
  const handleViewHistory = (variable) => {
    setCurrentVariable(variable);
    fetchVariableHistory(variable.name);
    setHistoryModalVisible(true);
  };

  // 确认删除
  const handleDelete = (name) => {
    deleteVariable(name);
  };

  // 模态框提交
  const handleModalSubmit = () => {
    form.validateFields().then(values => {
      if (isEditing && currentVariable) {
        updateVariable(currentVariable.name, { value: values.value });
      } else {
        // 只发送必要的字段，类型固定为text
        const submitData = {
          name: values.name,
          value: values.value,
          type: 'text',
          is_public: values.is_public
        };
        createVariable(submitData);
      }
    }).catch(info => {
      console.log('表单验证失败:', info);
    });
  };

  // 表格列配置
  const columns = [
    {
      title: '变量名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color="default">
          文本
        </Tag>
      )
    },
    {
      title: '值',
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
      title: '公开性',
      dataIndex: 'is_public',
      key: 'is_public',
      render: (isPublic) => (
        <Tag color={isPublic ? 'green' : 'red'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
           
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
           
            icon={<LineChartOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
          <Popconfirm
            title="确定删除此变量?"
            onConfirm={() => handleDelete(record.name)}
            okText="是"
            cancelText="否"
          >
            <Button
              type="text"
              danger
             
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="代理变量"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            添加变量
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
          <Empty description="暂无变量数据" />
        )}
      </Card>

      {/* 创建/编辑变量模态框 */}
      <Modal
        title={isEditing ? '编辑变量' : '创建变量'}
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
            label="变量名"
            rules={[
              { required: true, message: '请输入变量名' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '变量名必须以字母开头，只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="输入变量名" disabled={isEditing} />
          </Form.Item>

          <Form.Item
            name="type"
            label="变量类型"
            initialValue="text"
          >
            <Input value="文本" disabled />
          </Form.Item>

          <Form.Item
            name="value"
            label="变量值"
            rules={[{ required: true, message: '请输入变量值' }]}
          >
            <TextArea rows={3} placeholder="输入文本值" />
          </Form.Item>

          <Form.Item
            name="is_public"
            label="是否公开"
            valuePropName="checked"
            initialValue={true}
            tooltip="公开变量可被其他代理查看，私有变量仅自身可见"
          >
            <Switch checkedChildren="公开" unCheckedChildren="私有" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 变量历史记录模态框 */}
      <Modal
        title={`变量历史记录: ${currentVariable?.name}`}
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            关闭
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
                title: '时间',
                dataIndex: 'timestamp',
                key: 'timestamp',
              },
              {
                title: '值',
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
          <Empty description="暂无历史记录" />
        )}
      </Modal>
    </div>
  );
};

export default AgentVariables;