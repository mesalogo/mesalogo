import React, { useState } from 'react';
import { Card, Button, Table, Space, Tooltip, Tag, Modal, List, Checkbox, Spin, message, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import RuleSetModal from './RuleSetModal';

const { Text } = Typography;

/**
 * 规则集管理 Tab
 */
const RuleSetsTab = ({ ruleSets, loading, onRefresh }: any) => {
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
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个规则集吗？删除后无法恢复。',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteRuleSet(id);
          message.success('规则集删除成功');
          onRefresh(true);
        } catch (error) {
          console.error('删除规则集失败:', error);
          message.error('删除规则集失败');
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
      console.error('获取规则关联数据失败:', error);
      message.error('获取规则关联数据失败');
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
        message.success(`规则关联更新成功：新增 ${toAdd.length} 条，移除 ${toRemove.length} 条`);
      } else {
        message.info('没有变更需要保存');
      }

      handleCloseAssociationModal();
    } catch (error) {
      console.error('保存规则关联失败:', error);
      message.error('保存规则关联失败');
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
      title: '规则集名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      render: (description) => (
        <div style={{ maxHeight: '60px', overflow: 'hidden' }}>
          <Text style={{ fontSize: '12px', lineHeight: '1.4' }}>
            {description || '暂无描述'}
          </Text>
        </div>
      ),
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => {
        if (!created_by) {
          return (
            <Tooltip title="系统资源，所有用户可见可用">
              <Tag icon={<InfoCircleOutlined />} color="blue">系统</Tag>
            </Tooltip>
          );
        }
        if (record.is_shared) {
          return (
            <Tooltip title="用户共享资源，所有用户可见可用">
              <Tag icon={<InfoCircleOutlined />} color="green">共享</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="私有资源，仅创建者可见">
            <Tag icon={<InfoCircleOutlined />} color="orange">私有</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '规则数量',
      key: 'rule_count',
      dataIndex: 'rule_count',
      width: 100,
      align: 'center' as const,
      render: (ruleCount) => (
        <Tag color="blue">
          {Number.isInteger(ruleCount) ? ruleCount : 0} 条
        </Tag>
      ),
      sorter: (a, b) => (a.rule_count || 0) - (b.rule_count || 0),
    },
    {
      title: '关联行动空间',
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
            <Text type="secondary">未关联</Text>
          )}
        </>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Tooltip title="关联规则">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
             
            />
          </Tooltip>
          {!record.internal && (
            <Tooltip title="删除规则集">
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
        title="规则集管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建规则集
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
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`
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
        title={`编辑规则集"${currentRuleSet?.name}"的规则关联`}
        open={ruleAssociationModalVisible}
        onOk={handleSaveRuleAssociation}
        onCancel={handleCancelAssociation}
        confirmLoading={associationSaving}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Spin spinning={associationLoading}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              选择需要关联到此规则集的规则（共 {selectedRuleIds.length} 条规则已选择）
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
                        {rule.type === 'llm' ? '自然语言' : '逻辑规则'}
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
