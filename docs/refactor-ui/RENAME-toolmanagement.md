# ToolManagement 页面重命名方案

> 目标: 准确反映页面实际功能，区分"能力"与"工具"概念

---

## 📊 当前页面实际内容

### 当前显示内容

**唯一的UI界面**：
```
页面标题：能力与工具 (toolManagement.title)
主按钮：新建能力
主卡片：能力列表表格
  - 能力统计（基础、高级、监督、执行、专业）
  - 能力表格（CRUD操作）
  - 关联角色按钮
  - 关联工具按钮（通过TreeSelect选择MCP服务器工具）
```

**3个Modal**：
1. 能力编辑Modal - 包含工具关联TreeSelect
2. 角色关联Modal - 选择角色
3. 工具关联Modal - 专门的TreeSelect用于管理工具

### 当前代码包含但UI未显示的内容

**工具管理代码（已实现但未使用）**：
- `fetchTools()` - 获取自定义工具列表
- `handleSubmitTool()` - 创建/编辑工具
- `showCreateToolModal()` - 显示工具Modal
- `modalVisible` - 工具Modal状态
- `toolPagination` - 工具分页状态

**说明**: 这些函数存在但页面上没有对应的UI（没有工具表格）

### MCP服务器与工具部分

**MCP服务器管理**（代码实现，在工具关联中使用）：
- `fetchMcpServers()` - 获取MCP服务器列表
- `fetchServerTools()` - 获取服务器工具列表
- `startServer()` / `stopServer()` - 启动/停止服务器
- `convertToTreeData()` - 将服务器和工具转换为树形结构

**在哪里使用**：
- 能力编辑Modal的"关联工具"字段
- 工具关联Modal（专门用于管理能力与工具关联）
- TreeSelect显示：`服务器名称 > 工具列表`

---

## 🎯 概念澄清

### 能力 (Capability)
**定义**: 角色的功能权限，定义角色"能做什么"
- 例如: `function_calling`, `tool_use`, `code_execution`
- 包含: 名称、描述、类型、安全级别
- 关联: 可以关联多个工具，可以分配给多个角色

### 工具 (Tool)
**定义**: 具体的可执行功能，提供API或函数调用
- 分类:
  1. **MCP服务器工具**: 来自MCP（Model Context Protocol）服务器
  2. **自定义工具**: 用户自定义的工具（代码已实现，UI未实现）

### 关系链
```
角色 (Role)
  ↓ 被分配
能力 (Capability)
  ↓ 关联
工具 (Tool)
  ├── MCP服务器工具 (当前页面管理)
  └── 自定义工具 (代码存在，UI缺失)
```

---

## 📝 重命名方案

### 方案 1: 保持现状，内部优化（推荐）

**文件名**: 保持 `ToolManagement.js`（路由和导入已使用）

**页面标题**: 保持"能力与工具"

**内部结构优化**：
```jsx
<Tabs>
  <TabPane tab="能力管理" key="capabilities">
    {/* 当前的能力表格 */}
  </TabPane>
  
  <TabPane tab="MCP服务器" key="mcp-servers">
    {/* MCP服务器列表和管理 */}
    {/* 服务器启动/停止 */}
    {/* 服务器工具查看 */}
  </TabPane>
  
  <TabPane tab="自定义工具" key="custom-tools">
    {/* 自定义工具CRUD（新增UI） */}
  </TabPane>
</Tabs>
```

**优点**：
- 不需要修改路由和导入
- 清晰区分三个管理模块
- 可以逐步完善工具管理UI

**改动点**：
- 添加Tabs组件
- 补充MCP服务器管理UI
- 补充自定义工具管理UI

---

### 方案 2: 重命名为CapabilityManagement（不推荐）

**文件名**: `CapabilityManagement.js`

**路由**: `/roles/capabilities`

**页面标题**: "能力管理"

**缺点**：
- 需要修改路由（App.js）
- 需要修改导航菜单（MainLayout.js）
- 需要修改翻译文件（zh-CN.js, en-US.js）
- 丢失了"工具"相关的概念
- 与现有翻译键不符（toolManagement.*）

---

### 方案 3: 完全重构为三个独立页面（不推荐）

拆分为：
1. `/roles/capabilities` - 能力管理
2. `/roles/mcp-servers` - MCP服务器管理
3. `/roles/custom-tools` - 自定义工具管理

**缺点**：
- 改动太大
- 破坏现有架构
- 增加导航复杂度

---

## ✅ 推荐方案：方案1 - 保持现状，内部优化

### 实施步骤

#### Step 1: 添加Tabs结构

```jsx
import { Tabs } from 'antd';

const ToolManagement = () => {
  const [activeTab, setActiveTab] = useState('capabilities');
  
  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={4}>{t('toolManagement.title')}</Title>
        <Text type="secondary">{t('toolManagement.subtitle')}</Text>
      </div>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'capabilities',
            label: '能力管理',
            children: (
              {/* 当前的能力表格内容 */}
            )
          },
          {
            key: 'mcp-servers',
            label: 'MCP服务器',
            children: (
              {/* MCP服务器管理UI（新增） */}
            )
          },
          {
            key: 'custom-tools',
            label: '自定义工具',
            children: (
              {/* 自定义工具管理UI（新增） */}
            )
          }
        ]}
      />
    </div>
  );
};
```

#### Step 2: 实现MCP服务器Tab（新增）

**内容**：
- MCP服务器列表表格
- 启动/停止按钮
- 查看服务器工具列表
- 关联能力管理

```jsx
// MCP服务器表格
const mcpServerColumns = [
  { title: '服务器ID', dataIndex: 'id' },
  { title: '状态', dataIndex: 'status', render: (status) => <Tag color={status === 'running' ? 'success' : 'default'}>{status}</Tag> },
  { title: '工具数量', render: (_, record) => serverTools[record.id]?.length || 0 },
  { title: '关联能力', dataIndex: 'required_capabilities', render: (caps) => caps.map(c => <Tag key={c}>{c}</Tag>) },
  {
    title: '操作',
    render: (_, record) => (
      <Space>
        <Button onClick={() => startServer(record.id)}>启动</Button>
        <Button onClick={() => stopServer(record.id)}>停止</Button>
        <Button onClick={() => showAssignCapabilityModal(record)}>关联能力</Button>
      </Space>
    )
  }
];
```

#### Step 3: 实现自定义工具Tab（新增）

**内容**：
- 自定义工具列表表格
- 创建/编辑/删除工具
- 工具配置管理

```jsx
// 自定义工具表格
const customToolColumns = [
  { title: '名称', dataIndex: 'name' },
  { title: '类型', dataIndex: 'type' },
  { title: '描述', dataIndex: 'description' },
  { title: '状态', dataIndex: 'status' },
  {
    title: '操作',
    render: (_, record) => (
      <Space>
        <Button icon={<EditOutlined />} onClick={() => showEditToolModal(record)}>编辑</Button>
        <Button icon={<DeleteOutlined />} onClick={() => handleDeleteTool(record.id)}>删除</Button>
      </Space>
    )
  }
];
```

---

## 🎨 UI布局建议

### 当前布局（单一表格）
```
┌─────────────────────────────────────┐
│ 能力与工具                      [新建能力] │
├─────────────────────────────────────┤
│ 能力统计标签                          │
│ ┌─────────────────────────────────┐ │
│ │ 能力表格                         │ │
│ │ [编辑] [关联角色] [删除]           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 优化后布局（Tabs区分）
```
┌─────────────────────────────────────┐
│ 能力与工具                             │
├─────────────────────────────────────┤
│ [能力管理] [MCP服务器] [自定义工具]      │
├─────────────────────────────────────┤
│                                     │
│ Tab 1: 能力管理                      │
│ ┌─────────────────────────────────┐ │
│ │ 能力统计 + 能力表格      [新建能力] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Tab 2: MCP服务器                     │
│ ┌─────────────────────────────────┐ │
│ │ 服务器列表         [刷新] [添加]   │ │
│ │ [启动] [停止] [查看工具]           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Tab 3: 自定义工具                     │
│ ┌─────────────────────────────────┐ │
│ │ 工具列表            [新建工具]     │ │
│ │ [编辑] [删除] [测试]              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 🔄 翻译键建议

### 新增翻译键（补充）

```javascript
// zh-CN.js
'toolManagement.tabs.capabilities': '能力管理',
'toolManagement.tabs.mcpServers': 'MCP服务器',
'toolManagement.tabs.customTools': '自定义工具',

'toolManagement.mcpServers.title': 'MCP服务器列表',
'toolManagement.mcpServers.start': '启动',
'toolManagement.mcpServers.stop': '停止',
'toolManagement.mcpServers.viewTools': '查看工具',
'toolManagement.mcpServers.assignCapabilities': '关联能力',

'toolManagement.customTools.title': '自定义工具列表',
'toolManagement.customTools.create': '新建工具',
'toolManagement.customTools.edit': '编辑工具',
'toolManagement.customTools.delete': '删除工具',
```

---

## 📊 数据流梳理

### 能力管理（当前已实现）
```
用户操作 → 能力CRUD → 更新capabilities状态 → 表格重新渲染
       ↓
   关联工具Modal → TreeSelect选择MCP工具 → 更新capabilityToolsMap
       ↓
   关联角色Modal → Select选择角色 → 更新roleCapabilityMap
```

### MCP服务器管理（需补充UI）
```
fetchMcpServers() → 获取服务器列表 → mcpServers状态
       ↓
fetchServerTools(serverId) → 获取工具列表 → serverTools状态
       ↓
startServer() / stopServer() → 控制服务器 → 刷新列表
```

### 自定义工具管理（需补充UI）
```
fetchTools() → 获取工具列表 → tools状态
       ↓
handleSubmitTool() → 创建/编辑 → 刷新列表
       ↓
handleDeleteTool() → 删除工具 → 刷新列表
```

---

## ✅ 总结

**推荐方案**: **方案1 - 保持现状，内部优化**

**核心改动**：
1. 添加Tabs组件区分三个功能模块
2. 补充MCP服务器管理UI
3. 补充自定义工具管理UI
4. 保持文件名、路由、翻译键不变

**优点**：
- ✅ 最小化改动
- ✅ 清晰区分功能
- ✅ 保持向后兼容
- ✅ 逐步完善功能

**工作量**：
- 主要是UI补充，核心逻辑已存在
- 预计2-3天完成（包括测试）

---

**下一步**: 如果同意方案1，我们可以开始实施。是否需要我先创建带Tabs的原型代码？
