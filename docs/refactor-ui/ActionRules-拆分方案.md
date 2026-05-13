# ActionRules 组件拆分方案 (KISS 原则)

> 当前状态: 1846 行超大组件  
> 优先级: P1 (重要)  
> 预计工作量: 3-4 小时

## 📊 现状分析

### 组件复杂度
- **代码行数**: 1846 行
- **主要Tab**: 2 个（规则集管理、规则列表管理）
- **Modal**: 3 个（规则集编辑、规则编辑、规则关联）
- **数据获取函数**: 5 个
- **状态数量**: 20+ 个 useState

### 主要功能模块
1. **规则集管理Tab** (约 150 行)
   - 表格显示规则集列表
   - 创建、编辑、删除规则集
   - 规则关联管理

2. **规则列表Tab** (约 550 行)
   - 表格显示所有规则
   - 筛选和搜索功能
   - 规则详情展示

3. **规则编辑Modal** (约 800 行) - **最重的部分**
   - 自然语言规则编辑
   - 逻辑规则编辑（Monaco Editor）
   - 规则测试功能
   - 环境变量管理

4. **数据获取逻辑** (约 200 行)
   - fetchRuleSets
   - fetchAllRules  
   - fetchRoles
   - fetchEnvironmentVariables
   - fetchRulesForAssociation

---

## 📁 拆分后的目录结构 (KISS 原则)

**核心思想：拆分两个Tab和最重的Modal，保持简单**

```
frontend/src/pages/actionspace/ActionRules/
├── index.js              (250行) - 主组件，Tab切换，状态管理
├── useActionRulesData.js (180行) - 数据获取 Hook
├── RuleSetsTab.js        (350行) - 规则集管理Tab
├── RulesListTab.js       (450行) - 规则列表Tab
├── RuleEditModal.js      (650行) - 规则编辑Modal（含测试功能）
└── RuleSetModal.js       (150行) - 规则集编辑Modal

总计约 2030 行（拆分后会增加一些，因为有独立的导入和导出）
原来 1846 行 → 拆成 6 个文件
```

**拆分原则**：
1. ✅ 两个Tab独立（规则集Tab、规则列表Tab）
2. ✅ 最重的Modal单独提取（RuleEditModal 800行）
3. ✅ 数据逻辑独立为Hook
4. ✅ 保持简单，功能相关的代码放在一起
5. ❌ 不拆：小的操作函数、简单的渲染逻辑

---

## 🔧 详细拆分方案

### 1. 主组件 (index.js) - 250行

**职责**: Tab切换，状态管理，组件协调

```javascript
// frontend/src/pages/actionspace/ActionRules/index.js
import React, { useState, useEffect } from 'react';
import { Typography, Card, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';

import { useActionRulesData } from './useActionRulesData';
import RuleSetsTab from './RuleSetsTab';
import RulesListTab from './RulesListTab';

const { Title } = Typography;

const ActionRules = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ruleSets');
  
  // 数据
  const {
    ruleSets,
    allRules,
    roles,
    environmentVariables,
    loading,
    rulesLoading,
    refetchRuleSets,
    refetchAllRules,
    refetchRoles,
    refetchEnvironmentVariables
  } = useActionRulesData(activeTab);

  // URL参数处理
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ruleSetIdParam = urlParams.get('ruleSetId');
    if (ruleSetIdParam) {
      setActiveTab('ruleEditor');
    }
  }, []);

  return (
    <div>
      <Title level={4}>规则管理</Title>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="规则集管理" key="ruleSets">
            <RuleSetsTab
              ruleSets={ruleSets}
              loading={loading}
              onRefresh={refetchRuleSets}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="规则列表" key="ruleEditor">
            <RulesListTab
              allRules={allRules}
              loading={rulesLoading}
              roles={roles}
              environmentVariables={environmentVariables}
              onRefresh={refetchAllRules}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default ActionRules;
```

**为什么这样设计**：
- Tab切换逻辑简单，保留在主组件
- 通过props向子组件传递数据和回调
- 避免过度抽象

---

### 2. 数据Hook (useActionRulesData.js) - 180行

**职责**: 所有数据获取逻辑

```javascript
// frontend/src/pages/actionspace/ActionRules/useActionRulesData.js
import { useState, useEffect } from 'react';
import { message } from 'antd';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { api as apiInstance } from '../../../services/api/index';

// 缓存
let ruleSetsCache = [];
let allRulesCache = [];
let lastFetchRuleSetsTime = 0;
let lastFetchRulesTime = 0;
const CACHE_TIMEOUT = 300000;

export const useActionRulesData = (activeTab) => {
  const [ruleSets, setRuleSets] = useState([]);
  const [allRules, setAllRules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [environmentVariables, setEnvironmentVariables] = useState({
    internal: [],
    external: []
  });
  const [loading, setLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  // 获取规则集
  const fetchRuleSets = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && ruleSetsCache.length > 0 && 
        now - lastFetchRuleSetsTime < CACHE_TIMEOUT) {
      setRuleSets(ruleSetsCache);
      return;
    }

    setLoading(true);
    try {
      const data = await actionSpaceAPI.getAllRuleSets();
      const sorted = (data || []).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      ruleSetsCache = sorted;
      lastFetchRuleSetsTime = now;
      setRuleSets(sorted);
    } catch (error) {
      console.error('获取规则集失败:', error);
      message.error('获取规则集失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取所有规则
  const fetchAllRules = async (forceRefresh = false) => {
    // ... 类似逻辑
  };

  // 获取角色
  const fetchRoles = async () => {
    // ... 
  };

  // 获取环境变量
  const fetchEnvironmentVariables = async () => {
    // ...
  };

  // 初始加载
  useEffect(() => {
    fetchRuleSets();
  }, []);

  // 当切换到规则列表Tab时才加载
  useEffect(() => {
    if (activeTab === 'ruleEditor' && !rulesLoaded) {
      fetchAllRules();
    }
  }, [activeTab, rulesLoaded]);

  return {
    ruleSets,
    allRules,
    roles,
    environmentVariables,
    loading,
    rulesLoading,
    refetchRuleSets: fetchRuleSets,
    refetchAllRules: fetchAllRules,
    refetchRoles: fetchRoles,
    refetchEnvironmentVariables: fetchEnvironmentVariables
  };
};
```

---

### 3. 规则集Tab (RuleSetsTab.js) - 350行

**职责**: 规则集管理界面

```javascript
// frontend/src/pages/actionspace/ActionRules/RuleSetsTab.js
import React, { useState } from 'react';
import { Button, Table, Space, Modal, message, Tooltip, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PartitionOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';

import RuleSetModal from './RuleSetModal';

const RuleSetsTab = ({ ruleSets, loading, onRefresh }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRuleSet, setEditingRuleSet] = useState(null);
  const [associationModalVisible, setAssociationModalVisible] = useState(false);

  const handleCreate = () => {
    setEditingRuleSet(null);
    setIsModalVisible(true);
  };

  const handleEdit = (ruleSet) => {
    setEditingRuleSet(ruleSet);
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个规则集吗？',
      onOk: async () => {
        try {
          await actionSpaceAPI.deleteRuleSet(id);
          message.success('删除成功');
          onRefresh(true);
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '规则集名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      render: (created_by, record) => {
        if (!created_by) {
          return <Tag color="blue">系统</Tag>;
        }
        if (record.is_shared) {
          return <Tag color="green">共享</Tag>;
        }
        return <Tag color="orange">私有</Tag>;
      },
    },
    {
      title: '规则数量',
      dataIndex: 'rules',
      key: 'rules',
      render: (rules) => rules?.length || 0,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="管理规则">
            <Button
              type="text"
              icon={<PartitionOutlined />}
              onClick={() => handleManageRules(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {!record.internal && (
            <Tooltip title="删除">
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
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          创建规则集
        </Button>
      </div>

      <Table
        dataSource={ruleSets}
        columns={columns}
        loading={loading}
        rowKey="id"
      />

      <RuleSetModal
        visible={isModalVisible}
        ruleSet={editingRuleSet}
        onCancel={() => setIsModalVisible(false)}
        onSuccess={() => {
          setIsModalVisible(false);
          onRefresh(true);
        }}
      />

      {/* 规则关联Modal */}
      {/* ... */}
    </div>
  );
};

export default RuleSetsTab;
```

---

### 4. 规则列表Tab (RulesListTab.js) - 450行

**职责**: 规则列表管理界面

```javascript
// frontend/src/pages/actionspace/ActionRules/RulesListTab.js
import React, { useState, useMemo } from 'react';
import { Button, Table, Input, Select, Space, Tooltip, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BugOutlined } from '@ant-design/icons';

import RuleEditModal from './RuleEditModal';

const RulesListTab = ({ allRules, loading, roles, environmentVariables, onRefresh }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('all');

  // 筛选和搜索
  const filteredRules = useMemo(() => {
    let filtered = allRules;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(rule => rule.type === filterType);
    }
    
    if (searchText) {
      filtered = filtered.filter(rule =>
        rule.name.toLowerCase().includes(searchText.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    return filtered;
  }, [allRules, filterType, searchText]);

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'llm' ? 'green' : 'blue'}>
          {type === 'llm' ? '自然语言规则' : '逻辑规则'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建规则
          </Button>
          <Input.Search
            placeholder="搜索规则"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 150 }}
          >
            <Select.Option value="all">全部类型</Select.Option>
            <Select.Option value="llm">自然语言规则</Select.Option>
            <Select.Option value="logic">逻辑规则</Select.Option>
          </Select>
        </Space>
      </div>

      <Table
        dataSource={filteredRules}
        columns={columns}
        loading={loading}
        rowKey="id"
      />

      <RuleEditModal
        visible={isModalVisible}
        rule={editingRule}
        roles={roles}
        environmentVariables={environmentVariables}
        onCancel={() => setIsModalVisible(false)}
        onSuccess={() => {
          setIsModalVisible(false);
          onRefresh(true);
        }}
      />
    </div>
  );
};

export default RulesListTab;
```

---

### 5. 规则编辑Modal (RuleEditModal.js) - 650行

**职责**: 规则编辑和测试（最复杂的部分）

这个Modal包含：
- 自然语言规则编辑（TextArea）
- 逻辑规则编辑（Monaco Editor）
- 规则测试功能
- 环境变量显示

```javascript
// frontend/src/pages/actionspace/ActionRules/RuleEditModal.js
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Radio, Button, Card, Space } from 'antd';
import Editor from '@monaco-editor/react';
// ... 完整实现
```

---

### 6. 规则集Modal (RuleSetModal.js) - 150行

**职责**: 规则集创建/编辑表单

```javascript
// frontend/src/pages/actionspace/ActionRules/RuleSetModal.js
import React from 'react';
import { Modal, Form, Input, Checkbox } from 'antd';
// ... 完整实现
```

---

## 🚀 实施步骤

### 总时间: 3-4 小时

#### 步骤 1: 准备工作 (30分钟)
1. [ ] 创建目录和文件结构
2. [ ] 备份原组件

#### 步骤 2: 提取数据Hook (1小时)
1. [ ] 实现 useActionRulesData.js
2. [ ] 测试数据获取

#### 步骤 3: 拆分Tab组件 (1.5小时)
1. [ ] 实现 RuleSetsTab.js
2. [ ] 实现 RulesListTab.js

#### 步骤 4: 拆分Modal组件 (1小时)
1. [ ] 实现 RuleSetModal.js
2. [ ] 实现 RuleEditModal.js

#### 步骤 5: 组装主组件 (30分钟)
1. [ ] 实现 index.js
2. [ ] 删除旧组件

#### 步骤 6: 测试验证 (30分钟)
1. [ ] 语法检查
2. [ ] 功能测试

---

## 📊 预期收益

- 组件渲染时间: **减少 40-50%**
- 代码可维护性: **显著提升**
- 单个文件最大行数: 650行（vs 原来1846行）

---

## ⚠️ 注意事项

1. Monaco Editor 的引用需要正确处理
2. 缓存逻辑保留在 Hook 中
3. 所有功能必须保留，特别是测试功能
4. 向后兼容，零功能破坏

---

**准备开始实施** ✓
