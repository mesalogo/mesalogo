import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Form, Input, Modal, Select, Space, Empty, Tag, App, Switch, InputNumber, Alert, Tooltip, Collapse } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined, ApiOutlined, SettingOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ExternalEnvironmentVariables = () => {
  const { message } = App.useApp();
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingVariable, setEditingVariable] = useState(null);
  const [form] = Form.useForm();

  // 获取外部环境变量数据
  useEffect(() => {
    fetchExternalVariables();
  }, []);

  const fetchExternalVariables = async () => {
    setLoading(true);
    try {
      // 获取真实的外部环境变量数据
      const variables = await actionSpaceAPI.getAllExternalVariables();
      setVariables(variables);
    } catch (error) {
      console.error('获取外部环境变量失败:', error);
      message.error('获取外部环境变量失败');
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
      api_url: variable.api_url,
      api_method: variable.api_method,
      api_headers: variable.api_headers,
      data_path: variable.data_path,
      data_type: variable.data_type,
      timeout: variable.timeout,
      sync_interval: variable.sync_interval,
      sync_enabled: variable.sync_enabled
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

      const variableData = {
        name: values.name,
        label: values.label,
        description: values.description,
        api_url: values.api_url,
        api_method: values.api_method,
        api_headers: values.api_headers,
        data_path: values.data_path,
        data_type: values.data_type,
        timeout: values.timeout,
        sync_interval: values.sync_interval,
        sync_enabled: values.sync_enabled
      };

      if (editingVariable) {
        // 更新现有变量
        await actionSpaceAPI.updateExternalVariable(editingVariable.id, variableData);
        message.success('外部环境变量更新成功');
      } else {
        // 添加新变量
        await actionSpaceAPI.createExternalVariable(variableData);
        message.success('外部环境变量创建成功');
      }

      setIsModalVisible(false);
      setEditingVariable(null);
      fetchExternalVariables(); // 重新获取数据
    } catch (error) {
      console.error('操作外部环境变量失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const handleDeleteVariable = async (id) => {
    try {
      await actionSpaceAPI.deleteExternalVariable(id);
      message.success('外部环境变量删除成功');
      fetchExternalVariables(); // 重新获取数据
    } catch (error) {
      console.error('删除外部环境变量失败:', error);
      message.error('删除失败，请重试');
    }
  };

  const handleToggleSync = async (id, enabled) => {
    try {
      const variable = variables.find(v => v.id === id);
      if (!variable) return;

      await actionSpaceAPI.updateExternalVariable(id, {
        ...variable,
        sync_enabled: enabled
      });

      message.success(`同步已${enabled ? '启用' : '禁用'}`);
      fetchExternalVariables(); // 重新获取数据
    } catch (error) {
      console.error('更新同步状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const handleManualSync = async (id) => {
    message.loading('正在同步数据...', 0);

    try {
      const result = await actionSpaceAPI.syncExternalVariable(id);
      message.destroy();
      message.success('数据同步成功');
      fetchExternalVariables(); // 重新获取数据
    } catch (error) {
      message.destroy();
      console.error('同步外部环境变量失败:', error);
      message.error('数据同步失败');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'green';
      case 'error': return 'red';
      case 'inactive': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '正常';
      case 'error': return '错误';
      case 'inactive': return '未激活';
      default: return '未知';
    }
  };

  const formatInterval = (seconds) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    return `${Math.floor(seconds / 3600)}小时`;
  };

  const columns = [
    {
      title: '变量名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name) => <code>{name}</code>
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      width: 100,
    },
    {
      title: 'API地址',
      dataIndex: 'api_url',
      key: 'api_url',
      width: 200,
      ellipsis: true,
      render: (url) => (
        <Tooltip title={url}>
          <Text type="secondary">{url}</Text>
        </Tooltip>
      )
    },
    {
      title: '同步间隔',
      dataIndex: 'sync_interval',
      key: 'sync_interval',
      width: 80,
      render: (interval) => formatInterval(interval)
    },
    {
      title: '最后同步',
      dataIndex: 'last_sync',
      key: 'last_sync',
      width: 120,
      render: (time) => time ? <Text type="secondary">{new Date(time).toLocaleDateString()}</Text> : '-'
    },
    {
      title: '当前值',
      dataIndex: 'value',
      key: 'value',
      width: 120,
      ellipsis: true,
      render: (value) => value ? (
        <Tooltip title={value}>
          <Text>{value.length > 15 ? `${value.substring(0, 15)}...` : value}</Text>
        </Tooltip>
      ) : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: '同步',
      dataIndex: 'sync_enabled',
      key: 'sync_enabled',
      width: 60,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleSync(record.id, checked)}
         
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<SyncOutlined />}
            onClick={() => handleManualSync(record.id)}
            disabled={!record.sync_enabled}
           
            title="手动同步"
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditVariable(record)}
           
            title="编辑"
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteVariable(record.id)}
           
            title="删除"
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          配置外部API接口，系统将根据设定的同步间隔自动获取最新数据
        </Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>共 {variables.length} 个外部环境变量</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateVariable}
        >
          添加外部变量
        </Button>
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

      {/* 添加/编辑外部变量对话框 */}
      <Modal
        title={`${editingVariable ? '编辑' : '添加'}外部环境变量`}
        open={isModalVisible}
        onCancel={handleModalCancel}
        onOk={handleModalSubmit}
        width={800}
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
            extra="可选，描述该变量的用途和数据来源"
          >
            <TextArea rows={2} placeholder="描述该变量的用途和数据来源（可选）" />
          </Form.Item>

          <Form.Item
            name="api_url"
            label="API地址"
            rules={[
              { required: true, message: '请输入API地址' },
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="https://api.example.com/data" />
          </Form.Item>

          <Form.Item
            name="api_method"
            label="请求方法"
            rules={[{ required: true, message: '请选择请求方法' }]}
            initialValue="GET"
          >
            <Select>
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="api_headers"
            label="请求头"
            extra="JSON格式的请求头，如认证信息等"
          >
            <TextArea
              rows={3}
              placeholder='{"Authorization": "Bearer your_token", "Content-Type": "application/json"}'
            />
          </Form.Item>

          <Form.Item
            name="data_path"
            label="数据路径"
            extra="可选，从API响应中提取数据的JSON路径。如不填写则返回完整响应内容"
          >
            <Input placeholder="data.price（可选，留空则返回完整响应）" />
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: 'help',
                label: <Text type="secondary">数据路径配置说明</Text>,
                style: { marginBottom: 16 },
                children: (
                  <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                    <p><strong>数据路径语法：</strong></p>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li><code>留空</code> - 返回完整的API响应内容</li>
                      <li><code>data.price</code> - 获取 data 对象中的 price 字段</li>
                      <li><code>rates.USD_CNY</code> - 获取 rates 对象中的 USD_CNY 字段</li>
                      <li><code>items[0].value</code> - 获取 items 数组第一个元素的 value 字段</li>
                      <li><code>response.data.list[0].temperature</code> - 多层嵌套路径</li>
                    </ul>
                    <p style={{ marginTop: 8 }}><strong>示例API响应：</strong></p>
                    <pre style={{ background: 'var(--custom-hover-bg)', padding: 8, fontSize: '11px', margin: 0 }}>
{`{
  "data": {
    "price": 1250.50,
    "currency": "USD"
  },
  "rates": {
    "USD_CNY": 7.2345
  },
  "items": [
    {"value": 100, "name": "item1"}
  ]
}`}
                    </pre>
                  </div>
                )
              }
            ]}
          />

          <Form.Item
            name="data_type"
            label="数据类型"
            rules={[{ required: true, message: '请选择数据类型' }]}
            initialValue="string"
          >
            <Select>
              <Option value="string">字符串</Option>
              <Option value="number">数字</Option>
              <Option value="boolean">布尔值</Option>
              <Option value="object">对象</Option>
              <Option value="array">数组</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="timeout"
            label="请求超时（秒）"
            rules={[
              { required: true, message: '请输入请求超时时间' },
              { type: 'number', min: 1, max: 300, message: '超时时间应在1-300秒之间' }
            ]}
            initialValue={10}
            extra="API请求的超时时间，建议设置为10-30秒"
          >
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber
                min={1}
                max={300}
                style={{ width: '100%' }}
                placeholder="10"
              />
              <Input style={{ width: 'auto', pointerEvents: 'none' }} disabled value="秒" />
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="sync_interval"
            label="同步间隔（秒）"
            rules={[
              { required: true, message: '请输入同步间隔' },
              { type: 'number', min: 30, message: '同步间隔不能少于30秒' }
            ]}
            initialValue={300}
          >
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber
                min={30}
                max={86400}
                style={{ width: '100%' }}
                placeholder="300"
              />
              <Input style={{ width: 'auto', pointerEvents: 'none' }} disabled value="秒" />
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="sync_enabled"
            label="启用同步"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExternalEnvironmentVariables;
