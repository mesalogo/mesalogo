# UI视图切换器标准化文档

## 概述

本文档记录平台中所有视图切换按钮的实现方式，并定义标准化的实现方案，以保持UI一致性和用户体验。

## 标准实现方案

### 推荐方案：Ant Design Segmented 组件

**参考实现：** `frontend/src/pages/actiontask/parallellab/ExecutionMonitoring.js`

```jsx
import { Segmented } from 'antd';
import { BranchesOutlined, TableOutlined } from '@ant-design/icons';

const [viewMode, setViewMode] = useState('timeline');

<Segmented
  value={viewMode}
  onChange={setViewMode}
  options={[
    {
      label: '时间线视图',
      value: 'timeline',
      icon: <BranchesOutlined />
    },
    {
      label: '表格视图',
      value: 'table',
      icon: <TableOutlined />
    }
  ]}
/>
```

**优点：**
- 🎨 现代化设计，符合Ant Design 5规范
- 🔄 平滑的切换动画
- 📱 响应式布局友好
- ♿ 内置无障碍支持
- 🎯 清晰的视觉反馈（滑动高亮条）

---

## 平台现有实现盘点

### 1. ✅ 标准实现（推荐）

#### 1.1 并行实验室 - 执行监控
**文件：** `frontend/src/pages/actiontask/parallellab/ExecutionMonitoring.js`

**实现方式：** Ant Design `Segmented` 组件

**视图类型：**
- 时间线视图 (`timeline`) - 图标：`BranchesOutlined`
- 表格视图 (`table`) - 图标：`TableOutlined`

**位置：** Card标题栏右侧

**代码：**
```jsx
<Segmented
  value={viewMode}
  onChange={setViewMode}
  options={[
    { label: '时间线视图', value: 'timeline', icon: <BranchesOutlined /> },
    { label: '表格视图', value: 'table', icon: <TableOutlined /> }
  ]}
/>
```

---

### 2. ⚠️ 待升级实现

#### 2.1 行动任务概览
**文件：** `frontend/src/pages/actiontask/ActionTaskOverview.js`

**实现方式：** `Space.Compact` + `Button` 组合

**视图类型：**
- 卡片视图 (`card`) - 图标：`AppstoreOutlined`
- 表格视图 (`table`) - 图标：`OrderedListOutlined`

**位置：** Tabs的`tabBarExtraContent`

**代码：**
```jsx
<Space.Compact>
  <Button
    type={viewMode === 'card' ? 'primary' : 'default'}
    icon={<AppstoreOutlined />}
    onClick={() => setViewMode('card')}
    style={{ borderRadius: '6px 0 0 6px', fontSize: '14px', height: '32px', minWidth: '40px' }}
    title={t('taskCard.cardView')}
  />
  <Button
    type={viewMode === 'table' ? 'primary' : 'default'}
    icon={<OrderedListOutlined />}
    onClick={() => setViewMode('table')}
    style={{ borderRadius: '0 6px 6px 0', fontSize: '14px', height: '32px', minWidth: '40px' }}
    title={t('taskCard.tableView')}
  />
</Space.Compact>
```

**升级建议：** 
- 替换为`Segmented`组件
- 简化代码，移除手动样式设置
- 提升视觉一致性

---

#### 2.2 行动空间概览
**文件：** `frontend/src/pages/actionspace/ActionSpaceOverview/index.js`

**实现方式：** `Space.Compact` + `Button` 组合

**视图类型：**
- 卡片视图 (`card`) - 图标：`AppstoreOutlined`
- 表格视图 (`table`) - 图标：`OrderedListOutlined`

**位置：** 页面右上角

**代码：**
```jsx
<Space.Compact>
  <Button
    type={viewMode === 'card' ? 'primary' : 'default'}
    icon={<AppstoreOutlined />}
    onClick={() => setViewMode('card')}
    style={{ borderRadius: '6px 0 0 6px', fontSize: '14px', height: '32px', minWidth: '40px' }}
    title="卡片视图"
  />
  <Button
    type={viewMode === 'table' ? 'primary' : 'default'}
    icon={<OrderedListOutlined />}
    onClick={() => setViewMode('table')}
    style={{ borderRadius: '0 6px 6px 0', fontSize: '14px', height: '32px', minWidth: '40px' }}
    title="表格视图"
  />
</Space.Compact>
```

**升级建议：** 同上

---

#### 2.3 模型配置页面
**文件：** `frontend/src/pages/settings/ModelConfigsPage/ModelListView.js`

**实现方式：** `Space.Compact` + `Button` 组合

**视图类型：**
- 卡片视图 (`card`) - 图标：`AppstoreOutlined`
- 表格视图 (`table`) - 图标：`OrderedListOutlined`

**位置：** 页面右上角工具栏

**代码：**
```jsx
<Space.Compact>
  <Button
    type={viewMode === 'card' ? 'primary' : 'default'}
    icon={<AppstoreOutlined />}
    onClick={() => setViewMode('card')}
    style={{ borderRadius: '6px 0 0 6px', height: '32px', minWidth: '40px' }}
    title={t('modelConfig.view.card')}
  />
  <Button
    type={viewMode === 'table' ? 'primary' : 'default'}
    icon={<OrderedListOutlined />}
    onClick={() => setViewMode('table')}
    style={{ borderRadius: '0 6px 6px 0', height: '32px', minWidth: '40px' }}
    title={t('modelConfig.view.table')}
  />
</Space.Compact>
```

**升级建议：** 同上

---

#### 2.4 行动任务工作空间
**文件：** `frontend/src/pages/actiontask/components/ActionTaskWorkspace.js`

**实现方式：** `Radio.Group` 组合

**视图类型：**
- 任务视图 (`task`)
- 根目录视图 (`root`)

**代码：**
```jsx
const [viewMode, setViewMode] = useState('task');

<Radio.Group value={viewMode} onChange={handleViewModeChange}>
  <Radio.Button value="task">任务工作空间</Radio.Button>
  <Radio.Button value="root">根目录浏览</Radio.Button>
</Radio.Group>
```

**升级建议：** 
- 替换为`Segmented`组件
- 添加图标（如`FolderOutlined`、`FileOutlined`）

---

#### 2.5 知识库文档管理器（Markdown视图）
**文件：** `frontend/src/pages/knowledgebase/DocumentManager.js`

**实现方式：** `Radio` 组件

**视图类型：**
- 渲染视图 (`rendered`)
- 源码视图 (`source`)

**代码：**
```jsx
const [markdownViewMode, setMarkdownViewMode] = useState('rendered');

<Radio.Group 
  value={markdownViewMode} 
  onChange={(e) => setMarkdownViewMode(e.target.value)}
>
  <Radio.Button value="rendered">
    <PreviewOutlined /> 渲染视图
  </Radio.Button>
  <Radio.Button value="source">
    <FileTextOutlined /> 源码
  </Radio.Button>
</Radio.Group>
```

**升级建议：** 
- 替换为`Segmented`组件
- 保持图标和文字的组合显示

---

## 升级优先级

### 高优先级（用户高频使用）
1. ✅ **行动任务概览** - 主要功能入口
2. ✅ **行动空间概览** - 主要功能入口
3. **模型配置页面** - 设置相关

### 中优先级
4. **行动任务工作空间** - 特殊场景
5. **知识库文档管理器** - 编辑场景

---

## 实施计划

### 第一阶段：标准化核心页面
- [ ] 升级行动任务概览视图切换器
- [ ] 升级行动空间概览视图切换器
- [ ] 升级模型配置页面视图切换器

### 第二阶段：优化特殊场景
- [ ] 升级行动任务工作空间视图切换器
- [ ] 升级知识库文档管理器Markdown视图切换器

### 第三阶段：文档和规范
- [ ] 更新组件库文档
- [ ] 创建视图切换器使用指南
- [ ] 代码审查规范中增加视图切换器检查项

---

## 标准模板代码

### 基础两选项切换器
```jsx
import { Segmented } from 'antd';
import { AppstoreOutlined, OrderedListOutlined } from '@ant-design/icons';

const [viewMode, setViewMode] = useState('card');

<Segmented
  value={viewMode}
  onChange={setViewMode}
  options={[
    {
      label: '卡片视图',
      value: 'card',
      icon: <AppstoreOutlined />
    },
    {
      label: '列表视图',
      value: 'list',
      icon: <OrderedListOutlined />
    }
  ]}
/>
```

### 多选项切换器
```jsx
<Segmented
  value={viewMode}
  onChange={setViewMode}
  options={[
    { label: '卡片', value: 'card', icon: <AppstoreOutlined /> },
    { label: '列表', value: 'list', icon: <OrderedListOutlined /> },
    { label: '表格', value: 'table', icon: <TableOutlined /> }
  ]}
/>
```

### 仅图标切换器（紧凑场景）
```jsx
<Segmented
  value={viewMode}
  onChange={setViewMode}
  options={[
    { value: 'card', icon: <AppstoreOutlined /> },
    { value: 'table', icon: <OrderedListOutlined /> }
  ]}
/>
```

---

## 设计规范

### 图标选择建议
| 视图类型 | 推荐图标 | 备选图标 |
|---------|---------|---------|
| 卡片视图 | `AppstoreOutlined` | `BorderOutlined` |
| 列表视图 | `OrderedListOutlined` | `UnorderedListOutlined` |
| 表格视图 | `TableOutlined` | `BarsOutlined` |
| 时间线视图 | `BranchesOutlined` | `ClockCircleOutlined` |
| 网格视图 | `BorderOutlined` | `LayoutOutlined` |

### 位置建议
- **页面级切换器：** 放在页面右上角，与搜索、筛选等工具按钮并列
- **组件级切换器：** 放在Card的`title`或`extra`属性中
- **Tab级切换器：** 放在Tabs的`tabBarExtraContent`中

### 样式建议
- 使用默认尺寸，避免自定义高度
- 图标和文字都显示时，优先使用文字标签
- 移动端考虑只显示图标

---

## 相关资源

- [Ant Design Segmented 组件文档](https://ant.design/components/segmented-cn)
- [Ant Design Icon 图标库](https://ant.design/components/icon-cn)

---

**文档版本：** v1.0  
**最后更新：** 2025-11-14  
**维护者：** 开发团队
