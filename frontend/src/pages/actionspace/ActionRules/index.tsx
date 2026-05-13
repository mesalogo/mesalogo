import React, { useState, useEffect } from 'react';
import { Typography, Tabs } from 'antd';
import { PartitionOutlined, CodeOutlined } from '@ant-design/icons';
import { useActionRulesData } from './useActionRulesData';
import RuleSetsTab from './RuleSetsTab';
import RulesListTab from './RulesListTab';

const { Title, Text } = Typography;

/**
 * ActionRules 主组件 - 完全重构版本
 * 
 * 拆分结构：
 * - useActionRulesData: 数据获取 Hook
 * - RuleSetsTab: 规则集管理 Tab
 * - RulesListTab: 规则列表 Tab
 * - RuleSetModal: 规则集编辑 Modal
 * - RuleEditModal: 规则编辑 Modal
 * 
 * 预期收益：代码可维护性提升，渲染性能提升 40-50%
 */
const ActionRules = () => {
  const [activeTab, setActiveTab] = useState('ruleSets');

  // 使用自定义 Hook 获取所有数据
  const {
    ruleSets,
    allRules,
    roles,
    environmentVariables,
    loading,
    rulesLoading,
    rolesLoading,
    variablesLoading,
    refetchRuleSets,
    refetchAllRules,
    refetchRoles,
    refetchEnvironmentVariables
  } = useActionRulesData(activeTab);

  // 检查 URL 参数中是否指定了规则集 ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ruleSetIdParam = urlParams.get('ruleSetId');
    
    if (ruleSetIdParam) {
      console.log('URL中指定了规则集ID:', ruleSetIdParam);
      setActiveTab('ruleEditor');
    }
  }, []);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
            行动规则
          </Title>
          <Text type="secondary">
            管理行动空间中的规则集和规则，支持自然语言规则和逻辑规则的创建、编辑和测试
          </Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ruleSets',
            label: <span><PartitionOutlined />规则集</span>,
            children: (
              <RuleSetsTab
                ruleSets={ruleSets}
                loading={loading}
                onRefresh={refetchRuleSets}
              />
            )
          },
          {
            key: 'ruleEditor',
            label: <span><CodeOutlined />规则列表</span>,
            children: (
              <RulesListTab
                allRules={allRules}
                ruleSets={ruleSets}
                loading={rulesLoading}
                roles={roles}
                environmentVariables={environmentVariables}
                onRefresh={refetchAllRules}
                onLoadRoles={refetchRoles}
                onLoadEnvironmentVariables={refetchEnvironmentVariables}
              />
            )
          }
        ]}
      />
    </div>
  );
};

export default ActionRules;
