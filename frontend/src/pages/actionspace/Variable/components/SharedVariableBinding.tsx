import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Select, Space, App,
  Popconfirm, Typography, Tag, Empty, Tooltip
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ShareAltOutlined,
  LockOutlined, UnlockOutlined, ReloadOutlined
} from '@ant-design/icons';
import sharedEnvironmentVariablesAPI from '../../../../services/api/sharedEnvironmentVariables';

const { Text } = Typography;
const { Option } = Select;

const SharedVariableBinding = ({ actionSpaceId, onDataChange }: any) => {
  const { message } = App.useApp();
  const [boundVariables, setBoundVariables] = useState([]);
  const [availableVariables, setAvailableVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isBindModalVisible, setIsBindModalVisible] = useState(false);
  const [selectedVariableId, setSelectedVariableId] = useState(null);

  // 获取绑定的共享变量
  const fetchBoundVariables = async () => {
    if (!actionSpaceId) return;
    
    setLoading(true);
    try {
      const data = await sharedEnvironmentVariablesAPI.getActionSpaceBindings(actionSpaceId);
      setBoundVariables(data);
    } catch (error) {
      message.error('获取绑定的共享变量失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取可用的共享变量
  const fetchAvailableVariables = async () => {
    try {
      const allVariables = await sharedEnvironmentVariablesAPI.getAll();
      const boundIds = boundVariables.map(v => v.variable_id);
      const available = allVariables.filter(v => !boundIds.includes(v.id));
      setAvailableVariables(available);
    } catch (error) {
      message.error('获取可用共享变量失败');
    }
  };

  useEffect(() => {
    fetchBoundVariables();
  }, [actionSpaceId]);

  useEffect(() => {
    if (isBindModalVisible) {
      fetchAvailableVariables();
    }
  }, [isBindModalVisible, boundVariables]);

  // 绑定共享变量
  const handleBindVariable = async () => {
    if (!selectedVariableId) {
      message.error('请选择要绑定的共享变量');
      return;
    }

    try {
      await sharedEnvironmentVariablesAPI.bindToActionSpace(actionSpaceId, selectedVariableId);
      message.success('共享变量绑定成功');
      setIsBindModalVisible(false);
      setSelectedVariableId(null);
      fetchBoundVariables();
      if (onDataChange) onDataChange();
    } catch (error) {
      message.error(error.response?.data?.error || '绑定失败');
    }
  };

  // 解除绑定
  const handleUnbindVariable = async (variableId) => {
    try {
      await sharedEnvironmentVariablesAPI.unbindFromActionSpace(actionSpaceId, variableId);
      message.success('解除绑定成功');
      fetchBoundVariables();
      if (onDataChange) onDataChange();
    } catch (error) {
      message.error(error.response?.data?.error || '解除绑定失败');
    }
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
      title: '绑定时间',
      dataIndex: 'bound_at',
      key: 'bound_at',
      width: 150,
      render: (text) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right' as const,
      render: (_, record) => (
        <Popconfirm
          title="确定解除绑定吗？"
          description="解除绑定后，该共享变量将不再在此行动空间的任务中实例化"
          onConfirm={() => handleUnbindVariable(record.variable_id)}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type="text"
           
            danger
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      )
    }
  ];

  return (
    <Card
      title={
        <Space>
          <ShareAltOutlined />
          共享环境变量绑定
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchBoundVariables}
           
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsBindModalVisible(true)}
           
          >
            绑定共享变量
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          绑定的共享环境变量将在创建行动任务时自动实例化为任务环境变量
        </Text>
      </div>

      {boundVariables.length > 0 ? (
        <Table
          columns={columns}
          dataSource={boundVariables}
          rowKey="binding_id"
          loading={loading}
          pagination={false}
         
          scroll={{ x: 800 }}
        />
      ) : (
        <Empty 
          description="暂无绑定的共享环境变量" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      {/* 绑定共享变量对话框 */}
      <Modal
        title="绑定共享环境变量"
        visible={isBindModalVisible}
        onCancel={() => {
          setIsBindModalVisible(false);
          setSelectedVariableId(null);
        }}
        onOk={handleBindVariable}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            选择要绑定到此行动空间的共享环境变量
          </Text>
        </div>
        
        <Select
          style={{ width: '100%' }}
          placeholder="选择共享环境变量"
          value={selectedVariableId}
          onChange={setSelectedVariableId}
          showSearch
          optionFilterProp="children"
        >
          {availableVariables.map(variable => (
            <Option key={variable.id} value={variable.id}>
              <Space>
                <Text code>{variable.name}</Text>
                <Text>{variable.label}</Text>
                <Tag 
                 
                  color={variable.is_readonly ? 'red' : 'green'}
                >
                  {variable.is_readonly ? '只读' : '读写'}
                </Tag>
              </Space>
            </Option>
          ))}
        </Select>

        {availableVariables.length === 0 && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              暂无可绑定的共享环境变量，请先创建共享环境变量
            </Text>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default SharedVariableBinding;
