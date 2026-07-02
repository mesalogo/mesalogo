import React, { useState, useEffect } from 'react';
import {
  Card, Button, Table, Space, Modal,
  message, Typography, Tag, Collapse,
  Spin, Empty, Tooltip
} from 'antd';
import {
  PlusOutlined, DeleteOutlined,
  ExpandAltOutlined, LinkOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../services/api/actionspace';
import api from '../../services/api/axios';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * 行动空间规则关联组件
 * 用于管理行动空间与规则集的关联关系
 */
const RuleSetAssociation = ({ actionSpaceId }: any) => {
  const { t } = useTranslation();
  const [ruleSets, setRuleSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRuleSets, setExpandedRuleSets] = useState({});
  const [rulesData, setRulesData] = useState({}); // 存储每个规则集下的规则
  const [rulesLoading, setRulesLoading] = useState({}); // 存储每个规则集规则的加载状态
  const [associateModalVisible, setAssociateModalVisible] = useState(false);
  const [availableRuleSets, setAvailableRuleSets] = useState([]);

  // 获取行动空间关联的规则集
  const fetchRuleSets = async () => {
    if (!actionSpaceId) return;

    setLoading(true);
    try {
      const data = await actionSpaceAPI.getRuleSetsStats(actionSpaceId);
      setRuleSets(data || []);
    } catch (error) {
      console.error('Failed to fetch rule sets:', error);
      message.error(t('ruleSetAssoc.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 获取可关联的规则集
  const fetchAvailableRuleSets = async () => {
    try {
      const allRuleSets = await actionSpaceAPI.getRuleSetsStats(null);
      // 过滤掉已经关联到当前行动空间的规则集
      const currentRuleSetIds = ruleSets.map(rs => rs.id);
      const available = allRuleSets.filter(rs => !currentRuleSetIds.includes(rs.id));
      setAvailableRuleSets(available);
    } catch (error) {
      console.error('Failed to fetch associable rule sets:', error);
      message.error(t('ruleSetAssoc.fetchAvailableFailed'));
    }
  };

  // 获取规则集的规则列表
  const fetchRuleSetRules = async (ruleSetId) => {
    if (!actionSpaceId || !ruleSetId) return;

    setRulesLoading(prev => ({ ...prev, [ruleSetId]: true }));
    try {
      const rules = await actionSpaceAPI.getRuleSetRules(actionSpaceId, ruleSetId);
      setRulesData(prev => ({ ...prev, [ruleSetId]: rules }));
    } catch (error) {
      console.error(`Failed to fetch rules for rule set ${ruleSetId}:`, error);
      message.error(t('ruleSetAssoc.fetchRulesFailed'));
    } finally {
      setRulesLoading(prev => ({ ...prev, [ruleSetId]: false }));
    }
  };

  // 关联规则集
  const handleAssociateRuleSet = async (ruleSetId) => {
    try {
      // 发送关联请求
      await api.post(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}/associate`);
      message.success(t('ruleSetAssoc.associateSuccess'));
      setAssociateModalVisible(false);
      fetchRuleSets(); // 刷新规则集列表
    } catch (error) {
      console.error('Failed to associate rule set:', error);
      message.error(t('ruleSetAssoc.associateFailed'));
    }
  };

  // 解除规则集关联
  const handleDisassociateRuleSet = async (ruleSetId) => {
    Modal.confirm({
      title: t('ruleSetAssoc.disassociateConfirmTitle'),
      content: t('ruleSetAssoc.disassociateConfirmContent'),
      onOk: async () => {
        try {
          // 发送解除关联请求
          await api.delete(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}`);
          message.success(t('ruleSetAssoc.disassociateSuccess'));
          fetchRuleSets(); // 刷新规则集列表
        } catch (error) {
          console.error('Failed to unassociate rule set:', error);
          message.error(t('ruleSetAssoc.disassociateFailed'));
        }
      }
    });
  };

  // 展开/折叠规则集
  const toggleRuleSetExpand = (ruleSetId) => {
    const newExpandedState = { ...expandedRuleSets };
    newExpandedState[ruleSetId] = !newExpandedState[ruleSetId];
    setExpandedRuleSets(newExpandedState);

    // 如果展开且没有加载过规则，则加载规则
    if (newExpandedState[ruleSetId] && !rulesData[ruleSetId]) {
      fetchRuleSetRules(ruleSetId);
    }
  };

  // 显示关联规则集对话框
  const showAssociateModal = () => {
    setAssociateModalVisible(true);
    fetchAvailableRuleSets();
  };

  // 初始加载
  useEffect(() => {
    if (actionSpaceId) {
      fetchRuleSets();
    }
  }, [actionSpaceId]);

  // 渲染规则列表
  const renderRulesList = (ruleSetId) => {
    const rules = rulesData[ruleSetId] || [];
    const isLoading = rulesLoading[ruleSetId];

    if (isLoading) {
      return (
        <Spin spinning={true}>
          <div style={{ padding: '20px', textAlign: 'center' }}>{t('ruleSetAssoc.loadingRules')}</div>
        </Spin>
      );
    }

    if (rules.length === 0) {
      return <Empty description={t('ruleSetAssoc.noRules')} />;
    }

    const columns = [
      {
        title: t('ruleSetAssoc.col.ruleName'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('ruleSetAssoc.col.type'),
        dataIndex: 'type',
        key: 'type',
        render: (type) => (
          <Tag color={type === 'llm' ? 'green' : 'blue'}>
            {type === 'llm' ? t('ruleSetAssoc.ruleType.llm') : t('ruleSetAssoc.ruleType.logic')}
          </Tag>
        )
      },
      {
        title: t('ruleSetAssoc.col.description'),
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
      },
      {
        title: t('ruleSetAssoc.col.priority'),
        dataIndex: 'priority',
        key: 'priority',
      }
    ];

    return (
      <Table
        columns={columns}
        dataSource={rules}
        rowKey="id"
        pagination={false}
       
      />
    );
  };

  // 渲染关联规则集列表
  const renderAssociateRuleSetList = () => {
    const columns = [
      {
        title: t('ruleSetAssoc.col.ruleSetName'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('ruleSetAssoc.col.description'),
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
      },
      {
        title: t('ruleSetAssoc.col.ruleCount'),
        dataIndex: 'rule_count',
        key: 'rule_count',
      },
      {
        title: t('ruleSetAssoc.col.actions'),
        key: 'action',
        render: (_, record) => (
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => handleAssociateRuleSet(record.id)}
          >
            {t('ruleSetAssoc.action.associate')}
          </Button>
        )
      }
    ];

    return (
      <Table
        columns={columns}
        dataSource={availableRuleSets}
        rowKey="id"
        pagination={{ pageSize: 5 }}
      />
    );
  };

  return (
    <Card
      title={t('ruleSetAssoc.cardTitle')}
      extra={
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={showAssociateModal}
        >
          {t('ruleSetAssoc.associateRuleSet')}
        </Button>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin spinning={true}>
            <div style={{ padding: '50px', textAlign: 'center' }}>{t('ruleSetAssoc.loadingRuleSets')}</div>
          </Spin>
        </div>
      ) : ruleSets.length === 0 ? (
        <Empty description={t('ruleSetAssoc.noAssociatedRuleSets')} />
      ) : (
        ruleSets.map(ruleSet => (
          <Card
            key={ruleSet.id}
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Button
                  type="text"
                  icon={<PlusOutlined rotate={expandedRuleSets[ruleSet.id] ? 45 : 0} />}
                  onClick={() => toggleRuleSetExpand(ruleSet.id)}
                />
                <span style={{ marginLeft: 8 }}>{ruleSet.name}</span>
              </div>
            }
            extra={
              <Tooltip title={t('ruleSetAssoc.action.unassociate')}>
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDisassociateRuleSet(ruleSet.id)}
                />
              </Tooltip>
            }
            style={{ marginBottom: 16 }}
          >
            <Paragraph ellipsis={{ rows: 2 }}>{ruleSet.description}</Paragraph>
            <div>
              <Text>{t('ruleSetAssoc.ruleCountLabel')}</Text>
              <Text strong>{ruleSet.rule_count || 0}</Text>
            </div>

            {expandedRuleSets[ruleSet.id] && (
              <div style={{ marginTop: 16 }}>
                {renderRulesList(ruleSet.id)}
              </div>
            )}
          </Card>
        ))
      )}

      {/* 关联规则集对话框 */}
      <Modal
        title={t('ruleSetAssoc.associateModalTitle')}
        open={associateModalVisible}
        onCancel={() => setAssociateModalVisible(false)}
        footer={null}
        width={700}
      >
        {renderAssociateRuleSetList()}
      </Modal>
    </Card>
  );
};

export default RuleSetAssociation;