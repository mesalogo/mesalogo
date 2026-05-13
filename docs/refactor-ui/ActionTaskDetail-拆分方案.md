# ActionTaskDetail 组件拆分方案（平衡方案）

> 当前状态: 1454 行  
> 已有子组件: 11个  
> 优先级: P1 (重要)  
> 重构策略: **平衡重构** - 控制代码增长，单文件最大500行

**目标约束：**
- 代码总量增长 ≤ 15%（~1670行）
- 文件数量：6-8个
- 单文件最大：500行

## 📊 现状分析

### 组件复杂度
- **代码行数**: 1454 行 ⚠️ 超大型组件
- **State 数量**: 17 个 useState
- **业务方法**: 15+ 个
- **已有子组件**: 11个（部分已经很好）
- **主要职责**: 任务详情页面的协调、数据管理、UI渲染

### 已有的良好拆分 ✅
✅ ActionTaskConversation - 对话组件（已重构）  
✅ ActionTaskEnvironment - 环境变量组件  
✅ ActionTaskRules - 规则组件  
✅ ActionTaskSupervisor - 监督组件  
✅ ActionTaskWorkspace - 工作空间组件  
✅ AutonomousTaskCard - 自主任务卡片  
✅ TaskAppTools - 任务应用工具  
✅ ExportModal - 导出Modal  
✅ PublishModal - 发布Modal  
✅ AppTabManager - 应用Tab管理器  
✅ AppRenderer - 应用渲染器

### 需要优化的部分 ⚠️
1. ❌ **主组件过大**：1454 行，难以维护
2. ❌ **渲染逻辑复杂**：特别是右侧Tab内容（500+行）
3. ❌ **数据逻辑混杂**：数据获取、状态管理分散
4. ❌ **Loading渲染冗长**：200行骨架屏在主组件中
5. ❌ **业务逻辑分散**：15+个方法在主组件中
6. ❌ **侧边栏逻辑复杂**：拖拽调整、Tab管理
7. ❌ **17个State**：状态管理混乱

---

## 📁 优化后的目录结构（深度重构）

**核心思想：职责分离 + 模块化 + 可复用**

```
frontend/src/pages/actiontask/ActionTaskDetail/
├── index.js                          (350行) ⬅️ 主协调器，大幅精简
│
├── hooks/                            📁 数据和业务逻辑 Hooks
│   ├── useTaskData.js                (200行) - 任务数据获取、轮询更新
│   ├── useVariablesRefresh.js        (150行) - 变量刷新和比较
│   ├── useTaskActions.js             (200行) - 业务方法集合
│   └── useSidebarLayout.js           (180行) - 侧边栏拖拽和布局
│
├── components/                       📁 UI 组件
│   ├── TaskHeader.js                 (200行) - 页面头部（标题、按钮、状态）
│   ├── TaskMainArea.js               (150行) - 左侧主内容区
│   ├── TaskSidebar.js                (250行) - 右侧侧边栏容器和Tab切换
│   ├── LoadingSkeleton.js            (250行) - Loading骨架屏
│   │
│   └── tabs/                         📁 侧边栏Tab内容组件
│       ├── InfoTab.js                (250行) - 任务信息Tab
│       ├── MonitorTab.js             (350行) - 监控Tab（智能体、变量）
│       ├── MemoryTab.js              (50行)  - 工作空间Tab（引用已有组件）
│       ├── AuditTab.js               (50行)  - 审计Tab（引用已有组件）
│       └── AppsTab.js                (50行)  - 应用管理Tab（引用已有组件）
│
└── utils/                            📁 工具函数
    └── tabConfig.js                  (100行) - Tab配置生成

原来 1454 行 → 拆成 15 个文件（~2700行）
单文件最大 350 行（主组件）


```
**为什么这样设计**：
- ✅ 参考 ActionTaskConversation 的成功经验
- ✅ 职责清晰分离：数据层、业务层、展示层
- ✅ 组件粒度适中：单文件 50-350 行
- ✅ 高复用性：Hooks 可独立使用和测试
- ✅ 易于维护：修改某个功能只需关注对应文件

---

## 🔧 详细拆分方案

### 1. Hooks层 - 数据和业务逻辑

#### 1.1 useTaskData.js (200行)

**职责**: 任务数据获取、消息获取、轮询更新

**导出内容**:
```javascript
export default function useTaskData(taskId) {
  return {
    // 数据状态
    task,
    messages,
    loading,
    refreshKey,
    
    // 数据操作
    setTask,
    setMessages,
    fetchTaskData,
    refreshTaskMessages
  };
}
```

**功能点**:
- ✅ 任务详情获取
- ✅ 对话消息获取
- ✅ 轮询更新（运行中任务）
- ✅ 刷新方法

---

#### 1.2 useVariablesRefresh.js (150行)

**职责**: 环境变量和智能体变量的刷新逻辑

**导出内容**:
```javascript
export default function useVariablesRefresh(task) {
  return {
    variablesRefreshKey,
    previousVariables,
    setPreviousVariables,
    refreshVariables
  };
}
```

**功能点**:
- ✅ 批量获取环境变量和智能体变量
- ✅ 变量值比较（标记新增和变化）
- ✅ 变量闪烁效果触发
- ✅ 1秒后移除闪烁标记

---

#### 1.3 useTaskActions.js (200行)

**职责**: 业务方法集合

**导出内容**:
```javascript
export default function useTaskActions({
  task,
  navigate,
  conversationRef,
  fetchTaskData,
  setMessages,
  setActiveConversationId
}) {
  return {
    handleBack,
    handleTerminateTask,
    handleMessagesUpdated,
    handleRefreshTaskMessages,
    handleSupervisorIntervention,
    handleAgentRespondingChange,
    handleUserMessageSent
  };
}
```

**业务方法**:
- `handleBack()` - 返回列表页
- `handleTerminateTask()` - 终止任务
- `handleMessagesUpdated(messages)` - 消息更新回调
- `handleRefreshTaskMessages()` - 刷新任务和消息
- `handleSupervisorIntervention(data)` - 监督者干预
- `handleAgentRespondingChange(isResponding, agentId)` - 智能体响应状态变化

---

#### 1.4 useSidebarLayout.js (180行)

**职责**: 侧边栏拖拽和布局管理

**导出内容**:
```javascript
export default function useSidebarLayout() {
  return {
    // 布局状态
    sidebarVisible,
    setSidebarVisible,
    leftColSpan,
    rightColSpan,
    isDragging,
    dragHandleRef,
    
    // 布局操作
    handleDragStart,
    toggleSidebar
  };
}
```

**功能点**:
- ✅ 侧边栏显示/隐藏
- ✅ 拖拽调整宽度
- ✅ 布局比例计算（16:8 → 20:4 等）
- ✅ 拖拽状态管理

---

### 2. Components层 - UI组件

#### 2.1 TaskHeader.js (200行)

**职责**: 页面头部（标题、按钮、状态）

**Props**:
```javascript
{
  task,
  onBack,
  onTerminate,
  onExport,
  onPublish,
  t
}
```

**渲染内容**:
- 返回按钮
- 任务标题
- 行动空间标签
- 状态徽章（active/completed/failed等）
- 导出按钮
- 发布按钮（如果支持）
- 终止按钮（运行中任务）

---

#### 2.2 TaskMainArea.js (150行)

**职责**: 左侧主内容区

**Props**:
```javascript
{
  task,
  messages,
  setMessages,
  conversationRef,
  onMessagesUpdated,
  onAgentRespondingChange,
  onUserMessageSent,
  onRefreshAutonomousTaskCard,
  refreshKey,
  sidebarVisible,
  onToggleSidebar,
  t
}
```

**渲染内容**:
- 交互记录标题
- 切换侧边栏按钮
- ActionTaskConversation 组件（已重构）

---

#### 2.3 TaskSidebar.js (250行)

**职责**: 右侧侧边栏容器和Tab切换

**Props**:
```javascript
{
  task,
  messages,
  activeTab,
  onTabChange,
  rightColSpan,
  isDragging,
  dragHandleRef,
  variablesRefreshKey,
  respondingAgentId,
  onRefreshVariables,
  appTabManager,
  t
}
```

**渲染内容**:
- Tabs 容器
- Tab切换逻辑
- 动态Tab内容渲染
- 拖拽手柄

---

#### 2.4 LoadingSkeleton.js (250行)

**职责**: Loading骨架屏

**Props**:
```javascript
{
  onBack,
  onExport,
  t
}
```

**渲染内容**:
- 页面头部骨架
- 加载指示器（居中）
- 半透明页面框架

---

### 3. Tabs层 - 侧边栏Tab内容组件

#### 3.1 InfoTab.js (250行)

**职责**: 任务信息Tab

**Props**:
```javascript
{
  task,
  messages,
  t
}
```

**渲染内容**:
- 统计概览卡片（消息数、智能体数）
- 任务详情卡片（ID、行动空间、描述、时间）

---

#### 3.2 MonitorTab.js (350行)

**职责**: 监控Tab（智能体、变量）

**Props**:
```javascript
{
  task,
  messages,
  variablesRefreshKey,
  respondingAgentId,
  onRefreshVariables,
  t
}
```

**渲染内容**:
- 参与智能体列表卡片
  - 智能体头像、名称、角色
  - 消息数、规则触发数、工具调用数
  - 智能体变量表格
- 监督者智能体列表卡片
- 环境变量刷新按钮

---

#### 3.3 MemoryTab.js (50行)

**职责**: 工作空间Tab

**Props**:
```javascript
{
  task,
  refreshKey
}
```

**渲染内容**:
- 引用 `ActionTaskWorkspace` 组件

---

#### 3.4 AuditTab.js (50行)

**职责**: 审计Tab

**Props**:
```javascript
{
  task,
  conversationRef,
  onIntervention
}
```

**渲染内容**:
- 引用 `ActionTaskSupervisor` 组件

---

#### 3.5 AppsTab.js (50行)

**职责**: 应用管理Tab

**Props**:
```javascript
{
  task,
  appTabManager,
  onAppLaunched
}
```

**渲染内容**:
- 引用 `TaskAppTools` 组件

---

### 4. Utils层 - 工具函数

#### 4.1 tabConfig.js (100行)

**职责**: Tab配置生成

```javascript
// frontend/src/pages/actiontask/ActionTaskDetail/useVariablesRefresh.js
import { useState, useCallback } from 'react';
import { actionTaskAPI } from '../../../services/api/actionTask';

export const useVariablesRefresh = (task) => {
  const [variablesRefreshKey, setVariablesRefreshKey] = useState(0);
  const [previousVariables, setPreviousVariables] = useState({
    environment: [],
    agent: {}
  });

  const refreshVariables = useCallback(async () => {
    if (!task || !task.id) return;

    try {
      // 保存当前变量状态用于比较
      const currentEnvVars = task.environment_variables || [];
      const currentAgentVars = task.agent_variables || [];

      // 构建当前变量的映射
      const currentEnvVarsMap = {};
      currentEnvVars.forEach(v => {
        currentEnvVarsMap[v.name] = v.value;
      });

      const currentAgentVarsMap = {};
      currentAgentVars.forEach(v => {
        if (!currentAgentVarsMap[v.agent_id]) {
          currentAgentVarsMap[v.agent_id] = {};
        }
        currentAgentVarsMap[v.agent_id][v.name] = v.value;
      });

      // 使用批量API一次获取所有变量
      const batchVariables = await actionTaskAPI.getBatchVariables(task.id);

      // 标记变化的环境变量
      const markedEnvVars = batchVariables.environmentVariables.map(v => {
        const isNewVar = currentEnvVarsMap[v.name] === undefined;
        const valueChanged = !isNewVar && String(currentEnvVarsMap[v.name]) !== String(v.value);
        return {
          ...v,
          _hasChanged: isNewVar || valueChanged,
          _isNew: isNewVar
        };
      });

      // 标记变化的智能体变量
      const markedAgentVars = batchVariables.agentVariables.map(v => {
        const agentVars = currentAgentVarsMap[v.agent_id] || {};
        const isNewVar = agentVars[v.name] === undefined;
        const valueChanged = !isNewVar && String(agentVars[v.name]) !== String(v.value);
        return {
          ...v,
          _hasChanged: isNewVar || valueChanged,
          _isNew: isNewVar
        };
      });

      // 更新任务对象
      task.environment_variables = markedEnvVars;
      task.agent_variables = markedAgentVars;

      // 触发UI更新
      setVariablesRefreshKey(prev => prev + 1);

      // 移除变化标记（延迟执行）
      setTimeout(() => {
        if (task.environment_variables) {
          task.environment_variables = task.environment_variables.map(v => ({
            ...v,
            _hasChanged: false,
            _isNew: false
          }));
        }
        if (task.agent_variables) {
          task.agent_variables = task.agent_variables.map(v => ({
            ...v,
            _hasChanged: false,
            _isNew: false
          }));
        }
        setVariablesRefreshKey(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('刷新变量失败:', error);
    }
  }, [task]);

  return {
    variablesRefreshKey,
    previousVariables,
    setPreviousVariables,
    refreshVariables
  };
};
```

---

### 3. Loading骨架组件 (LoadingSkeleton.js) - 250行

**职责**: Loading状态的skeleton UI渲染

```javascript
// frontend/src/pages/actiontask/ActionTaskDetail/LoadingSkeleton.js
import React from 'react';
import { Card, Button, Space, Typography, Tag, Badge, Row, Col, Tabs, Spin } from 'antd';
import { LeftOutlined, ExportOutlined, GlobalOutlined, InfoCircleOutlined, MessageOutlined, MenuFoldOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

/**
 * 任务详情页面的 Loading 骨架屏
 */
const LoadingSkeleton = ({ onBack, onExport }) => {
  const { t } = useTranslation();

  return (
    <div className="action-task-detail-page">
      {/* 页面头部 */}
      <div className="page-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={onBack} disabled={true}>
            {t('actionTaskDetail.backToList')}
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            {t('actionTaskDetail.loading')}
          </Title>
          <Space size="small">
            <Tag color="blue" icon={<GlobalOutlined />}>
              {t('actionTaskDetail.status.loading')}
            </Tag>
            <Badge status="processing" text={t('actionTaskDetail.status.loading')} />
          </Space>
        </Space>
        <Space>
          <Button icon={<ExportOutlined />} onClick={onExport}>
            {t('actionTaskDetail.exportData')}
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ position: 'relative' }}>
          {/* 加载指示器 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Spin size="large" />
            <div style={{ color: '#1677ff', fontSize: '14px' }}>
              {t('actionTaskDetail.loadingDetail')}
            </div>
          </div>

          {/* 页面框架 - 半透明 */}
          <div style={{ opacity: 0.3 }}>
            <Row gutter={16} style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
              <Col span={16} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <MessageOutlined style={{ marginRight: 8 }} />
                    <Text strong style={{ fontSize: '16px' }}>任务交互记录</Text>
                  </div>
                  <Button type="text" icon={<MenuFoldOutlined />} disabled={true}>
                    隐藏侧边栏
                  </Button>
                </div>
                <div style={{ height: 'calc(100% - 40px)' }}>
                  <div className="tab-content-container" style={{ height: '100%' }}>
                    {/* 交互记录框架 */}
                  </div>
                </div>
              </Col>

              <Col span={8} style={{ height: '100%', borderLeft: '1px solid #f0f0f0' }}>
                <Tabs
                  defaultActiveKey="info"
                  size="small"
                  items={[
                    {
                      key: 'info',
                      label: <span><InfoCircleOutlined />{t('actionTaskDetail.taskInfo')}</span>,
                      children: <div />
                    }
                  ]}
                />
              </Col>
            </Row>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LoadingSkeleton;
```

---

### 4. 主组件 (index.js) - 700行

**职责**: 组件协调、Tab管理、渲染逻辑

```javascript
// frontend/src/pages/actiontask/ActionTaskDetail/index.js
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// ...其他导入

import { useTaskData } from './useTaskData';
import { useVariablesRefresh } from './useVariablesRefresh';
import LoadingSkeleton from './LoadingSkeleton';

const ActionTaskDetail = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();

  // 使用自定义Hooks
  const {
    task,
    messages,
    loading,
    refreshKey,
    setMessages,
    refreshTaskMessages,
    fetchTaskData
  } = useTaskData(taskId);

  const {
    variablesRefreshKey,
    previousVariables,
    setPreviousVariables,
    refreshVariables
  } = useVariablesRefresh(task);

  // 其他状态和逻辑...

  const handleBack = () => navigate('/action-tasks');

  // Loading状态
  if (loading) {
    return (
      <LoadingSkeleton
        onBack={handleBack}
        onExport={() => setExportModalVisible(true)}
      />
    );
  }

  // 正常渲染
  return (
    <div className="action-task-detail-page">
      {/* 主要渲染逻辑保持不变 */}
      {/* ... */}
    </div>
  );
};

export default ActionTaskDetail;
```

---

## 🚀 实施步骤

### 总时间: 2-3 小时

#### 步骤 1: 准备工作 (20分钟)
1. [ ] 创建目录 `ActionTaskDetail/`
2. [ ] 备份原组件

#### 步骤 2: 提取数据Hooks (1小时)
1. [ ] 实现 useTaskData.js
2. [ ] 实现 useVariablesRefresh.js

#### 步骤 3: 提取Loading组件 (40分钟)
1. [ ] 实现 LoadingSkeleton.js

#### 步骤 4: 重构主组件 (1小时)
1. [ ] 更新 index.js，使用新的Hooks
2. [ ] 移除原组件
3. [ ] 测试所有功能

---

## 📊 预期收益

- 代码可维护性: **显著提升**
- 主组件复杂度: **从1454行降至700行**
- 数据逻辑: **完全解耦，可复用**
- 向后兼容: **100%**

---

## ⚠️ 注意事项

1. 保持所有已有子组件不变
2. useTaskData Hook 需要处理轮询逻辑
3. useVariablesRefresh 需要保留变量比较逻辑
4. LoadingSkeleton 需要与原样式一致

---

**准备开始实施** ✓
