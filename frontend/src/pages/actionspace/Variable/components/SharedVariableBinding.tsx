import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Select, Space, App,
  Popconfirm, Typography, Tag, Empty, Tooltip
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ShareAltOutlined,
  LockOutlined, UnlockOutlined, ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import sharedEnvironmentVariablesAPI from '../../../../services/api/sharedEnvironmentVariables';

const { Text } = Typography;
const { Option } = Select;

const SharedVariableBinding = ({ actionSpaceId, onDataChange }: any) => {
  const { t } = useTranslation();
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
      message.error(t('sharedVarBinding.fetchBoundFailed'));
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
      message.error(t('sharedVarBinding.fetchAvailableFailed'));
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
      message.error(t('sharedVarBinding.selectVariableRequired'));
      return;
    }

    try {
      await sharedEnvironmentVariablesAPI.bindToActionSpace(actionSpaceId, selectedVariableId);
      message.success(t('sharedVarBinding.bindSuccess'));
      setIsBindModalVisible(false);
      setSelectedVariableId(null);
      fetchBoundVariables();
      if (onDataChange) onDataChange();
    } catch (error) {
      message.error(error.response?.data?.error || t('sharedVarBinding.bindFailed'));
    }
  };

  // 解除绑定
  const handleUnbindVariable = async (variableId) => {
    try {
      await sharedEnvironmentVariablesAPI.unbindFromActionSpace(actionSpaceId, variableId);
      message.success(t('sharedVarBinding.unbindSuccess'));
      fetchBoundVariables();
      if (onDataChange) onDataChange();
    } catch (error) {
      message.error(error.response?.data?.error || t('sharedVarBinding.unbindFailed'));
    }
  };

  // 表格列定义
  const columns = [
    {
      title: t('sharedVarBinding.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: t('sharedVarBinding.col.label'),
      dataIndex: 'label',
      key: 'label',
      width: 150
    },
    {
      title: t('sharedVarBinding.col.value'),
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
      title: t('sharedVarBinding.col.permission'),
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
      title: t('sharedVarBinding.col.description'),
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
      title: t('sharedVarBinding.col.boundAt'),
      dataIndex: 'bound_at',
      key: 'bound_at',
      width: 150,
      render: (text) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: t('sharedVarBinding.col.actions'),
      key: 'actions',
      width: 80,
      fixed: 'right' as const,
      render: (_, record) => (
        <Popconfirm
          title={t('sharedVarBinding.unbindConfirmTitle')}
          description={t('sharedVarBinding.unbindConfirmDesc')}
          onConfirm={() => handleUnbindVariable(record.variable_id)}
          okText={t('sharedVarBinding.unbindConfirmOk')}
          cancelText={t('sharedVarBinding.unbindConfirmCancel')}
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
          {t('sharedVarBinding.cardTitle')}
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchBoundVariables}
          >
            {t('sharedVarBinding.refresh')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsBindModalVisible(true)}
          >
            {t('sharedVarBinding.bindVariable')}
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('sharedVarBinding.introText')}
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
          description={t('sharedVarBinding.emptyBound')} 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      {/* 绑定共享变量对话框 */}
      <Modal
        title={t('sharedVarBinding.modalTitle')}
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
            {t('sharedVarBinding.modalHint')}
          </Text>
        </div>
        
        <Select
          style={{ width: '100%' }}
          placeholder={t('sharedVarBinding.selectPlaceholder')}
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
                  {variable.is_readonly ? t('sharedEnvVar.readonly') : t('sharedEnvVar.readwrite')}
                </Tag>
              </Space>
            </Option>
          ))}
        </Select>

        {availableVariables.length === 0 && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              {t('sharedVarBinding.emptyAvailable')}
            </Text>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default SharedVariableBinding;
