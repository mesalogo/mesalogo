import React, { useState, useEffect } from 'react';
import { App, Card, Button, Table, Space, Tag, Modal, Typography, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, GlobalOutlined, TeamOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // 当规则编辑弹窗显示时，加载角色和环境变量数据
  useEffect(() => {
    if (ruleModalVisible) {
      console.log('Rule edit modal shown, checking data load state');
      
      // 如果角色数据为空，加载角色数据
      if (roles.length === 0 && onLoadRoles) {
        console.log('Loading role data');
        onLoadRoles();
      }
      
      // 如果环境变量数据为空，加载环境变量数据
      if (environmentVariables.internal.length === 0 && 
          environmentVariables.external.length === 0 && 
          onLoadEnvironmentVariables) {
        console.log('Loading environment variable data');
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
    modal.confirm({
      title: t('rulesList.deleteConfirmTitle'),
      content: t('rulesList.deleteConfirmContent'),
      okText: t('rulesList.deleteConfirmOk'),
      cancelText: t('rulesList.deleteConfirmCancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteRule(ruleId, null);
          message.success(t('rulesList.deleteSuccess'));
          onRefresh(true);
        } catch (error) {
          console.error('Failed to delete rule:', error);
          message.error(t('rulesList.deleteFailed'));
        }
      }
    });
  };

  const columns = [
    {
      title: t('rulesList.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      ellipsis: true,
    },
    {
      title: t('rulesList.col.type'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color={type === 'llm' ? 'green' : 'blue'}>
          {type === 'llm' ? t('ruleSets.ruleType.llm') : t('ruleSets.ruleType.logic')}
        </Tag>
      ),
      filters: [
        { text: t('rulesList.filter.llm'), value: 'llm' },
        { text: t('rulesList.filter.logic'), value: 'logic' },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: t('rulesList.col.source'),
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        // 系统资源：created_by 为 null
        if (!created_by) {
          return (
            <Tooltip title={t('ruleSets.source.systemTooltip')}>
              <Tag icon={<GlobalOutlined />} color="blue">{t('ruleSets.source.system')}</Tag>
            </Tooltip>
          );
        }

        // 用户共享资源：created_by 有值且 is_shared 为 true
        if (record.is_shared) {
          return (
            <Tooltip title={t('ruleSets.source.sharedTooltip')}>
              <Tag icon={<TeamOutlined />} color="green">{t('ruleSets.source.shared')}</Tag>
            </Tooltip>
          );
        }

        // 私有资源：created_by 有值且 is_shared 为 false
        return (
          <Tooltip title={t('ruleSets.source.privateTooltip')}>
            <Tag icon={<LockOutlined />} color="orange">{t('ruleSets.source.private')}</Tag>
          </Tooltip>
        );
      },
      filters: [
        { text: t('rulesList.filter.system'), value: 'system' },
        { text: t('rulesList.filter.shared'), value: 'shared' },
        { text: t('rulesList.filter.private'), value: 'private' },
      ],
      onFilter: (value, record) => {
        if (value === 'system') return !record.created_by;
        if (value === 'shared') return record.created_by && record.is_shared;
        if (value === 'private') return record.created_by && !record.is_shared;
        return true;
      },
    },
    {
      title: t('rulesList.col.ruleSets'),
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
            <Text type="secondary">{t('rulesList.unassigned')}</Text>
          )}
        </>
      ),
      filters: ruleSets.map(rs => ({ text: rs.name, value: String(rs.id) })),
      onFilter: (value, record) => record.rule_sets?.some(rs => String(rs.id) === value),
    },
    {
      title: t('rulesList.col.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: isActive => (
        <Tag color={isActive === false ? 'error' : 'success'}>
          {isActive === false ? t('rulesList.status.disabled') : t('rulesList.status.enabled')}
        </Tag>
      ),
      filters: [
        { text: t('rulesList.filter.enabled'), value: true },
        { text: t('rulesList.filter.disabled'), value: false },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: t('rulesList.col.content'),
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
      title: t('rulesList.col.actions'),
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
        title={t('rulesList.cardTitle')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showAddRuleModal}
            disabled={loading}
          >
            {t('rulesList.addRule')}
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
            showTotal: (total, range) => t('rulesList.paginationTotal', { start: range[0], end: range[1], total })
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
