# 统一表格视图标准

## 文档说明
本文档定义了系统前端所有表格视图的统一标准，确保用户体验的一致性。

## 设计原则

### 1. 固定列标准
- **首列固定**：首列（通常为名称列）必须 `fixed: 'left'`
- **操作列固定**：操作列（Actions）必须 `fixed: 'right'`
- **列宽设置**：
  - 首列固定宽度：180px
  - 操作列固定宽度：150px
  - 其他列根据内容设置合适宽度

### 2. 首列设计规范
**必需元素**：
- 图标 + 文本组合（使用 `Space` 组件）
- 文本加粗（使用 `<Text strong>`）
- 图标使用蓝色主题 `color: '#1677ff'`

**示例代码**：
```jsx
{
  title: '名称',
  dataIndex: 'name',
  key: 'name',
  width: 180,
  fixed: 'left',
  render: (text) => (
    <Space>
      <UserOutlined style={{ color: '#1677ff' }} />
      <Text strong>{text}</Text>
    </Space>
  ),
}
```

### 3. 操作列设计规范
**必需配置**：
- 列宽：`width: 150`
- 固定位置：`fixed: 'right'`
- 使用 `Space` 组件包裹多个操作按钮
- 按钮使用 `type="text"` 的文本按钮
- 提供 Tooltip 提示

**标准操作按钮**：
1. **编辑按钮**：
   - 图标：`<EditOutlined />`
   - 颜色：`style={{ color: '#1677ff' }}`
   - Tooltip：`"编辑XXX"`

2. **删除按钮**：
   - 图标：`<DeleteOutlined />`
   - 样式：`danger` 属性
   - Tooltip：`"删除XXX"`

3. **其他操作**：根据业务需要添加，保持风格一致

**示例代码**：
```jsx
{
  title: '操作',
  key: 'action',
  width: 150,
  fixed: 'right',
  render: (_, record) => (
    <Space size="small">
      <Tooltip title="编辑角色">
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => onEdit(record)}
          style={{ color: '#1677ff' }}
        />
      </Tooltip>
      <Tooltip title="删除角色">
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record)}
        />
      </Tooltip>
    </Space>
  ),
}
```

### 4. 表格容器标准
**Card 包装**：
```jsx
<Card
  variant="borderless"
  style={{
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
  }}
>
```

**Table 配置**：
```jsx
<Table
  columns={columns}
  dataSource={data}
  rowKey="id"
  loading={loading}
  scroll={{ x: 1510 }}  // 固定值 = 所有列宽之和，确保列宽真正固定
  pagination={{
    current: pagination.current,
    pageSize: pagination.pageSize,
    defaultPageSize: 10,
    pageSizeOptions: [10, 50, 100],
    showTotal: (total, range) => `共 ${total} 条，显示第 ${range[0]}-${range[1]} 条`,
    showSizeChanger: true,
    showQuickJumper: true,
    size: 'default',
    position: ['bottomRight'],
  }}
/>
```

**⚠️ 重要：关于 scroll.x 的设置**

Ant Design Table 的列宽行为：
- 使用 `scroll={{ x: 'max-content' }}` 时，如果表格总宽度小于容器宽度，列会**自动扩展**填充剩余空间
- 这导致即使设置了 `width`，列宽也可能会变化

**如何真正固定列宽**：

**方法 1：设置固定的 scroll.x 值（推荐）**
```jsx
// 1. 计算所有列的 width 总和
// 例如：180 + 100 + 120 + 260 + 150 + 150 + 200 + 200 + 150 = 1510

// 2. 将总和设置为 scroll.x 的值
<Table
  columns={columns}
  scroll={{ x: 1510 }}  // 使用固定值
/>
```

**方法 2：使用 'max-content'（自适应）**
```jsx
// 适合内容长度不确定的场景
// 缺点：列宽会根据容器自动调整
<Table
  columns={columns}
  scroll={{ x: 'max-content' }}
/>
```

**实践案例**：
```jsx
// RoleTable.js - 角色管理表格
const columns = [
  { title: '名称', width: 180, fixed: 'left' },
  { title: '类型', width: 100 },
  { title: '来源', width: 120 },
  { title: '使用的模型', width: 260 },
  { title: '系统提示词', width: 150 },  // 固定为 150px
  { title: '描述', width: 150 },         // 固定为 150px
  { title: '绑定能力', width: 200 },
  { title: '绑定知识库', width: 200 },
  { title: '操作', width: 150, fixed: 'right' },
];

// 总宽度 = 1510px
<Table
  columns={columns}
  scroll={{ x: 1510 }}  // 使用固定值确保列宽不变
/>
```

**为什么选择 150px？**
- 对于系统提示词和描述等长文本字段，150px 是一个合适的平衡点
- 太窄（如 100px）：内容几乎看不到
- 太宽（如 250px）：占用过多空间，影响其他列
- 150px + ellipsis + Tooltip：既节省空间，又能查看完整内容

### 5. 文本溢出处理
对于较长文本列：
```jsx
{
  title: '描述',
  dataIndex: 'description',
  key: 'description',
  width: 200,
  ellipsis: { showTitle: false },
  render: (description) => (
    <Tooltip placement="topLeft" title={description}>
      <div style={{ 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap' 
      }}>
        {description}
      </div>
    </Tooltip>
  ),
}
```

### 6. 列筛选功能规范

**设计原则**：
- 筛选项应从当前数据中**动态生成**，而不是写死
- 使用 `useMemo` 优化性能，避免每次渲染重新计算
- 筛选项的文本应使用用户友好的显示名称

**动态筛选示例**：
```jsx
// 在组件顶部，early return 之前定义（确保 hooks 调用顺序一致）
const roleFilters = useMemo(() => {
  const roleMap = new Map();
  users.forEach((user) => {
    const role = user.roles?.[0]?.user_role;
    if (role?.name) {
      roleMap.set(role.name, role.display_name || role.name);
    }
  });
  return Array.from(roleMap.entries()).map(([value, text]) => ({ text, value }));
}, [users]);

const statusFilters = useMemo(() => {
  const statuses = new Set(users.map((user) => user.is_active));
  return Array.from(statuses).map(value => ({
    text: value ? t('status.enabled') : t('status.disabled'),
    value
  }));
}, [users, t]);

const providerFilters = useMemo(() => {
  const providerMap = {
    local: 'Local',
    google: 'Google',
    // ... 其他映射
  };
  const providers = new Set(users.map((user) => user.provider || 'local'));
  return Array.from(providers).map(value => ({
    text: providerMap[value] || value,
    value
  }));
}, [users]);
```

**列定义中使用**：
```jsx
{
  title: '角色',
  dataIndex: 'roles',
  key: 'roles',
  width: 120,
  filters: roleFilters,  // 使用动态生成的筛选项
  onFilter: (value, record) => {
    const roleName = record.roles?.[0]?.user_role?.name;
    return roleName === value;
  },
  render: (roles) => { /* ... */ }
}
```

**注意事项**：
- `useMemo` 必须在组件的 early return 语句之前调用，否则会违反 React Hooks 规则
- 对于有映射关系的字段（如 provider），筛选项文本应使用友好名称
- 筛选是前端本地筛选，基于当前页面已加载的数据

### 7. Tag 颜色规范
**来源标签**（resource_source）：
- 系统资源：`<Tag icon={<GlobalOutlined />} color="blue">系统</Tag>`
- 共享资源：`<Tag icon={<TeamOutlined />} color="green">共享</Tag>`
- 私有资源：`<Tag icon={<LockOutlined />} color="orange">私有</Tag>`

**类型标签**：
- 使用 Ant Design 预定义颜色：blue, green, purple, cyan, orange, red 等
- 保持同一类别的标签颜色一致

### 8. 图标使用规范
**常用图标及其含义**：
- `UserOutlined / RobotOutlined`：用户/角色/智能体
- `EditOutlined`：编辑操作
- `DeleteOutlined`：删除操作
- `PlusOutlined`：创建/添加
- `GlobalOutlined`：全局/系统
- `TeamOutlined`：共享
- `LockOutlined`：私有
- `ToolOutlined`：工具/能力
- `ApiOutlined`：API相关

**图标颜色**：
- 主要操作/正常状态：`#1677ff`（蓝色）
- 次要操作：`#722ed1`（紫色）
- 危险操作：使用 `danger` 属性

## 现有页面分析

### 1. RoleTable.js（角色管理） ✅ 标准参考
**优点**：
- 首列和操作列正确固定
- 列宽设置合理
- 图标+文本组合标准
- Tooltip 提示完善

**关键代码片段**：
```jsx
columns = [
  {
    title: '名称',
    dataIndex: 'name',
    width: 180,
    fixed: 'left',
    render: (text) => (
      <Space>
        <UserOutlined style={{ color: '#1677ff' }} />
        <Text strong>{text}</Text>
      </Space>
    ),
  },
  // ... 其他列 ...
  {
    title: '操作',
    key: 'action',
    width: 150,
    fixed: 'right',
    render: (_, record) => (
      <Space size="small">
        <Tooltip title="编辑角色">
          <Button type="text" icon={<EditOutlined />} />
        </Tooltip>
        <Tooltip title="删除角色">
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Space>
    ),
  },
]
```

### 2. Agents.js（智能体管理） ✅ 标准参考
**优点**：
- 首列和操作列正确固定
- 与 RoleTable 保持一致的设计

**关键代码片段**：
```jsx
columns = [
  {
    title: '名称',
    dataIndex: 'name',
    width: 180,
    fixed: 'left',
    render: (text) => (
      <Space>
        <UserOutlined style={{ color: '#1677ff' }} />
        <Text strong>{text}</Text>
      </Space>
    ),
  },
  // ... 其他列 ...
  {
    title: '操作',
    key: 'action',
    width: 150,
    fixed: 'right',
    render: (_, record) => (
      <Space size="middle">
        <Tooltip title="编辑智能体">
          <Button type="text" icon={<EditOutlined />} />
        </Tooltip>
        <Tooltip title="删除智能体">
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Space>
    ),
  },
]
```

### 3. MCPServersPage.js（MCP 服务器管理） ⚠️ 部分符合
**现状**：
- 使用了可展开行（expandable）
- 表格较复杂，包含嵌套内容

**建议**：
- 确保操作列固定
- 如果有名称列，应该固定首列

### 4. ToolManagement.js（能力管理） ❌ 需要改进
**问题**：
- **首列未固定**：名称列应该设置 `fixed: 'left'`
- **操作列未固定**：操作列应该设置 `fixed: 'right'`
- 其他方面与标准基本一致

**需要修改的列**：
```jsx
// 当前代码
{
  title: '名称',
  dataIndex: 'name',
  key: 'name',
  render: (text, record) => (
    <Space>
      {/* ... icon ... */}
      <Text strong>{text}</Text>
    </Space>
  ),
}

// 应该改为
{
  title: '名称',
  dataIndex: 'name',
  key: 'name',
  width: 180,
  fixed: 'left',  // ← 添加固定
  render: (text, record) => (
    <Space>
      {/* ... icon ... */}
      <Text strong>{text}</Text>
    </Space>
  ),
}
```

```jsx
// 当前代码
{
  title: '操作',
  key: 'action',
  render: (_, record) => (
    <Space>
      <Button type="text" icon={<EditOutlined />} />
      <Button type="text" icon={<TeamOutlined />} />
      <Button type="text" danger icon={<DeleteOutlined />} />
    </Space>
  ),
}

// 应该改为
{
  title: '操作',
  key: 'action',
  width: 150,
  fixed: 'right',  // ← 添加固定
  render: (_, record) => (
    <Space size="small">
      <Tooltip title="编辑能力">
        <Button type="text" icon={<EditOutlined />} />
      </Tooltip>
      <Tooltip title="关联角色">
        <Button type="text" icon={<TeamOutlined />} />
      </Tooltip>
      <Tooltip title="删除能力">
        <Button type="text" danger icon={<DeleteOutlined />} />
      </Tooltip>
    </Space>
  ),
}
```

## 实施检查清单

### 表格列配置
- [ ] 首列设置 `fixed: 'left'` 和 `width: 180`
- [ ] 操作列设置 `fixed: 'right'` 和 `width: 150`
- [ ] 所有列都设置了合理的 `width` 值
- [ ] 首列使用图标+文本组合，文本加粗
- [ ] 操作按钮包裹在 Tooltip 中

### 表格容器
- [ ] 使用 Card 包裹表格
- [ ] Card 设置圆角和阴影样式
- [ ] Table 设置 `scroll={{ x: 'max-content' }}`

### 分页配置
- [ ] 分页位置在右下角 `position: ['bottomRight']`
- [ ] 显示总数 `showTotal`
- [ ] 可切换页大小 `showSizeChanger: true`
- [ ] 可快速跳转 `showQuickJumper: true`

### 视觉一致性
- [ ] 图标颜色统一使用 `#1677ff`
- [ ] Tag 颜色遵循规范
- [ ] 按钮样式统一使用 `type="text"`
- [ ] Space 组件统一使用 `size="small"` 或 `size="middle"`

## 下一步工作

1. ✅ 分析现有表格样式（已完成）
2. ✅ 创建统一标准文档（当前文档）
3. ⏳ 将标准应用到 ToolManagement 页面
4. ⏳ 逐步检查和更新其他页面
5. ⏳ 考虑创建可复用的 Table 组件

## 相关文件

- `/frontend/src/pages/roles/RoleTable.js` - 标准参考（角色管理）
- `/frontend/src/pages/Agents.js` - 标准参考（智能体管理）
- `/frontend/src/pages/roles/ToolManagement.js` - 待改进（能力管理）
- `/frontend/src/pages/settings/MCPServersPage.js` - 部分符合
- `/frontend/src/pages/actionspace/ObserverManagement.js` - 待检查

## 更新记录

- 2025-01-XX：创建文档，定义统一表格视图标准
- 分析了 RoleTable、Agents、MCPServersPage、ToolManagement 等页面
- 确定 ToolManagement 需要添加首列和操作列固定
- **2025-01-XX：添加列宽固定的最佳实践**
  - 记录了 `scroll={{ x: 固定值 }}` vs `scroll={{ x: 'max-content' }}` 的区别
  - 说明如何真正固定列宽（计算所有列宽总和，设置为 scroll.x）
  - 添加了 RoleTable.js 的实践案例
  - 解释了为什么选择 150px 作为长文本列的宽度
- **2026-01-01：修复固定列 z-index 覆盖 topbar 的问题**
  - 问题：表格固定列（`fixed: 'left'` / `fixed: 'right'`）滚动时会覆盖顶部导航栏
  - 原因：Ant Design Table 固定列默认 z-index 较高，超过了 topbar 的 z-index (950)
  - 解决方案：在 `App.css` 中添加全局样式限制固定列 z-index
  - 修复代码位置：`/frontend/src/App.css`
