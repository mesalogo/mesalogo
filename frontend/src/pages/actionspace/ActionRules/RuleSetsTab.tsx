import React, { useState } from 'react';
import { App, Card, Button, Table, Space, Tooltip, Tag, Modal, List, Checkbox, Spin, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import RuleSetModal from './RuleSetModal';

const { Text } = Typography;

/**
 * 规则集管理 Tab
 */
const RuleSetsTab = ({ ruleSets, loading, onRefresh }: any) => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRuleSet, setEditingRuleSet] = useState(null);
  
  // 规则关联相关状态
  const [ruleAssociationModalVisible, setRuleAssociationModalVisible] = useState(false);
  const [currentRuleSet, setCurrentRuleSet] = useState(null);
  const [allRulesForAssociation, setAllRulesForAssociation] = useState([]);
  const [associatedRuleIds, setAssociatedRuleIds] = useState([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState([]);
  const [associationLoading, setAssociationLoading] = useState(false);
  const [associationSaving, setAssociationSaving] = useState(false);

  const handleCreate = () => {
    setEditingRuleSet(null);
    setIsModalVisible(true);
  };

  const handleEdit = (ruleSet) => {
    setCurrentRuleSet(ruleSet);
    setRuleAssociationModalVisible(true);
    fetchRulesForAssociation(ruleSet.id);
  };

  const handleDelete = async (id) => {
    modal.confirm({
      title: t('ruleSets.deleteConfirmTitle'),
      content: t('ruleSets.deleteConfirmContent'),
      okText: t('ruleSets.deleteConfirmOk'),
      cancelText: t('ruleSets.deleteConfirmCancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteRuleSet(id);
          message.success(t('ruleSets.deleteSuccess'));
          onRefresh(true);
        } catch (error) {
          console.error('Failed to delete rule set:', error);
          message.error(t('ruleSets.deleteFailed'));
        }
      }
    });
  };

  // 获取所有规则和当前规则集的关联关系
  const fetchRulesForAssociation = async (ruleSetId) => {
    setAssociationLoading(true);
    try {
      const allRules = await actionSpaceAPI.getAllRules();
      setAllRulesForAssociation(allRules);

      const ruleSetDetail = await actionSpaceAPI.getRuleSetDetail(ruleSetId);
      const associatedIds = ruleSetDetail.rules ? ruleSetDetail.rules.map(rule => rule.id) : [];
      setAssociatedRuleIds(associatedIds);
      setSelectedRuleIds([...associatedIds]);
    } catch (error) {
      console.error('Failed to fetch rule association data:', error);
      message.error(t('ruleSets.fetchAssociationFailed'));
    } finally {
      setAssociationLoading(false);
    }
  };

  const handleRuleSelectionChange = (ruleId, isSelected) => {
    if (isSelected) {
      setSelectedRuleIds(prev => [...prev, ruleId]);
    } else {
      setSelectedRuleIds(prev => prev.filter(id => id !== ruleId));
    }
  };

  const handleSaveRuleAssociation = async () => {
    if (!currentRuleSet) return;

    setAssociationSaving(true);
    try {
      const toAdd = selectedRuleIds.filter(id => !associatedRuleIds.includes(id));
      const toRemove = associatedRuleIds.filter(id => !selectedRuleIds.includes(id));

      for (const ruleId of toAdd) {
        await actionSpaceAPI.addRuleToRuleSet(currentRuleSet.id, ruleId);
      }

      for (const ruleId of toRemove) {
        await actionSpaceAPI.removeRuleFromRuleSet(currentRuleSet.id, ruleId);
      }

      setAssociatedRuleIds([...selectedRuleIds]);

      if (toAdd.length > 0 || toRemove.length > 0) {
        message.success(t('ruleSets.associationUpdateSuccess', { added: toAdd.length, removed: toRemove.length }));
      } else {
        message.info(t('ruleSets.noChangesToSave'));
      }

      handleCloseAssociationModal();
    } catch (error) {
      console.error('Failed to save rule association:', error);
      message.error(t('ruleSets.saveAssociationFailed'));
    } finally {
      setAssociationSaving(false);
    }
  };

  const handleCloseAssociationModal = () => {
    setRuleAssociationModalVisible(false);
    setCurrentRuleSet(null);
    setAllRulesForAssociation([]);
    setAssociatedRuleIds([]);
    setSelectedRuleIds([]);
    onRefresh(true);
  };

  const handleCancelAssociation = () => {
    setRuleAssociationModalVisible(false);
    setCurrentRuleSet(null);
    setAllRulesForAssociation([]);
    setAssociatedRuleIds([]);
    setSelectedRuleIds([]);
  };

  const columns = [
    {
      title: t('ruleSets.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      ellipsis: true,
    },
    {
      title: t('ruleSets.col.description'),
      dataIndex: 'description',
      key: 'description',
      width: 300,
      render: (description) => (
        <div style={{ maxHeight: '60px', overflow: 'hidden' }}>
          <Text style={{ fontSize: '12px', lineHeight: '1.4' }}>
            {description || t('ruleSets.noDescription')}
          </Text>
        </div>
      ),
    },
    {
      title: t('ruleSets.col.source'),
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        if (!created_by) {
          return (
            <Tooltip title={t('ruleSets.source.systemTooltip')}>
              <Tag icon={<InfoCircleOutlined />} color="blue">{t('ruleSets.source.system')}</Tag>
            </Tooltip>
          );
        }
        if (record.is_shared) {
          return (
            <Tooltip title={t('ruleSets.source.sharedTooltip')}>
              <Tag icon={<InfoCircleOutlined />} color="green">{t('ruleSets.source.shared')}</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={t('ruleSets.source.privateTooltip')}>
            <Tag icon={<InfoCircleOutlined />} color="orange">{t('ruleSets.source.private')}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('ruleSets.col.ruleCount'),
      key: 'rule_count',
      dataIndex: 'rule_count',
      width: 100,
      align: 'center' as const,
      render: (ruleCount) => (
        <Tag color="blue">
          {t('ruleSets.ruleCountUnit', { count: Number.isInteger(ruleCount) ? ruleCount : 0 })}
        </Tag>
      ),
      sorter: (a, b) => (a.rule_count || 0) - (b.rule_count || 0),
    },
    {
      title: t('ruleSets.col.relatedSpaces'),
      key: 'related_spaces',
      dataIndex: 'related_spaces',
      width: 200,
      render: (relatedSpaces) => (
        <>
          {Array.isArray(relatedSpaces) && relatedSpaces.length > 0 ? (
            relatedSpaces.map(space => (
              <Tag key={space.id} color="green" style={{ marginBottom: 2 }}>
                {space.name}
              </Tag>
            ))
          ) : (
            <Text type="secondary">{t('ruleSets.noRelatedSpaces')}</Text>
          )}
        </>
      ),
    },
    {
      title: t('ruleSets.col.actions'),
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('ruleSets.action.associateRules')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {!record.internal && (
            <Tooltip title={t('ruleSets.action.deleteRuleSet')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={t('ruleSets.cardTitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('ruleSets.createBtn')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={ruleSets}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => t('ruleSets.paginationTotal', { start: range[0], end: range[1], total })
          }}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 规则集创建/编辑 Modal */}
      <RuleSetModal
        visible={isModalVisible}
        ruleSet={editingRuleSet}
        onCancel={() => setIsModalVisible(false)}
        onSuccess={() => {
          setIsModalVisible(false);
          onRefresh(true);
        }}
      />

      {/* 规则关联 Modal */}
      <Modal
        title={t('ruleSets.associationModalTitle', { name: currentRuleSet?.name })}
        open={ruleAssociationModalVisible}
        onOk={handleSaveRuleAssociation}
        onCancel={handleCancelAssociation}
        confirmLoading={associationSaving}
        width={800}
        okText={t('ruleSets.save')}
        cancelText={t('ruleSets.cancel')}
      >
        <Spin spinning={associationLoading}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              {t('ruleSets.associationHint', { count: selectedRuleIds.length })}
            </Text>
          </div>
          <List
            bordered
            dataSource={allRulesForAssociation}
            renderItem={(rule) => {
              const isSelected = selectedRuleIds.includes(rule.id);
              return (
                <List.Item key={rule.id}>
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => handleRuleSelectionChange(rule.id, e.target.checked)}
                  >
                    <Space>
                      <Text strong>{rule.name}</Text>
                      <Tag color={rule.type === 'llm' ? 'green' : 'blue'}>
                        {rule.type === 'llm' ? t('ruleSets.ruleType.llm') : t('ruleSets.ruleType.logic')}
                      </Tag>
                    </Space>
                  </Checkbox>
                </List.Item>
              );
            }}
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          />
        </Spin>
      </Modal>
    </>
  );
};

export default RuleSetsTab;
