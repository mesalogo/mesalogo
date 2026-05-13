import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Space, Tag, Modal, message, Typography, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, GlobalOutlined, TeamOutlined, LockOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import RuleEditModal from './RuleEditModal';

const { Text } = Typography;

/**
 * 规则列表管理 Tab
 */
const RulesListTab = ({ 
  allRules, 
  ruleSets,
  loading, 
  roles, 
  environmentVariables,
  onRefresh,
  onLoadRoles,
  onLoadEnvironmentVariables
}) => {
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // 当规则编辑弹窗显示时，加载角色和环境变量数据
  useEffect(() => {
    if (ruleModalVisible) {
      console.log('规则编辑弹窗显示，检查数据加载状态');
      
      // 如果角色数据为空，加载角色数据
      if (roles.length === 0 && onLoadRoles) {
        console.log('加载角色数据');
        onLoadRoles();
      }
      
      // 如果环境变量数据为空，加载环境变量数据
      if (environmentVariables.internal.length === 0 && 
          environmentVariables.external.length === 0 && 
          onLoadEnvironmentVariables) {
        console.log('加载环境变量数据');
        onLoadEnvironmentVariables();
      }
    }
  }, [ruleModalVisible, roles.length, environmentVariables.internal.length, environmentVariables.external.length, onLoadRoles, onLoadEnvironmentVariables]);

  const showAddRuleModal = () => {
    setEditingRule(null);
    setRuleModalVisible(true);
  };

  const showEditRuleModal = (rule) => {
    setEditingRule(rule);
    setRuleModalVisible(true);
  };

  const handleDeleteRule = async (ruleId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条规则吗？删除后无法恢复。',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteRule(ruleId, null);
          message.success('规则删除成功');
          onRefresh(true);
        } catch (error) {
          console.error('删除规则失败:', error);
          message.error('删除规则失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color={type === 'llm' ? 'green' : 'blue'}>
          {type === 'llm' ? '自然语言' : '逻辑规则'}
        </Tag>
      ),
      filters: [
        { text: '自然语言规则', value: 'llm' },
        { text: '逻辑规则', value: 'logic' },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        // 系统资源：created_by 为 null
        if (!created_by) {
          return (
            <Tooltip title="系统资源，所有用户可见可用">
              <Tag icon={<GlobalOutlined />} color="blue">系统</Tag>
            </Tooltip>
          );
        }

        // 用户共享资源：created_by 有值且 is_shared 为 true
        if (record.is_shared) {
          return (
            <Tooltip title="用户共享资源，所有用户可见可用">
              <Tag icon={<TeamOutlined />} color="green">共享</Tag>
            </Tooltip>
          );
        }

        // 私有资源：created_by 有值且 is_shared 为 false
        return (
          <Tooltip title="私有资源，仅创建者可见">
            <Tag icon={<LockOutlined />} color="orange">私有</Tag>
          </Tooltip>
        );
      },
      filters: [
        { text: '系统资源', value: 'system' },
        { text: '共享资源', value: 'shared' },
        { text: '私有资源', value: 'private' },
      ],
      onFilter: (value, record) => {
        if (value === 'system') return !record.created_by;
        if (value === 'shared') return record.created_by && record.is_shared;
        if (value === 'private') return record.created_by && !record.is_shared;
        return true;
      },
    },
    {
      title: '所属规则集',
      dataIndex: 'rule_sets',
      key: 'rule_sets',
      width: 150,
      render: (ruleSets) => (
        <>
          {ruleSets && ruleSets.length > 0 ? (
            ruleSets.map(rs => (
              <Tag key={rs.id} color="blue" style={{ marginBottom: 2 }}>
                {rs.name}
              </Tag>
            ))
          ) : (
            <Text type="secondary">未分配</Text>
          )}
        </>
      ),
      filters: ruleSets.map(rs => ({ text: rs.name, value: String(rs.id) })),
      onFilter: (value, record) => record.rule_sets?.some(rs => String(rs.id) === value),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: isActive => (
        <Tag color={isActive === false ? 'error' : 'success'}>
          {isActive === false ? '禁用' : '启用'}
        </Tag>
      ),
      filters: [
        { text: '已启用', value: true },
        { text: '已禁用', value: false },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: '规则内容',
      dataIndex: 'content',
      key: 'content',
      width: 300,
      render: (content, record) => (
        <div style={{ maxHeight: '60px', overflow: 'hidden' }}>
          <Text
            style={{
              fontSize: '12px',
              fontFamily: record.type === 'logic' ? 'monospace' : 'inherit',
              lineHeight: '1.4'
            }}
          >
            {content}
          </Text>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => showEditRuleModal(record)}
           
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRule(record.id)}
           
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title="规则列表"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showAddRuleModal}
            disabled={loading}
          >
            添加规则
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={allRules}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`
          }}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 规则编辑 Modal */}
      <RuleEditModal
        visible={ruleModalVisible}
        rule={editingRule}
        roles={roles}
        environmentVariables={environmentVariables}
        onCancel={() => {
          setRuleModalVisible(false);
          setEditingRule(null);
        }}
        onSuccess={() => {
          setRuleModalVisible(false);
          setEditingRule(null);
          onRefresh(true);
        }}
      />
    </>
  );
};

export default RulesListTab;
