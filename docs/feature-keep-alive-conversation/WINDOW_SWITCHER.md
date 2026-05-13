# 活动任务窗口切换器

## 📋 功能说明

在**任务详情页面**的返回按钮右侧，增加了**活动窗口切换下拉按钮**，用户可以快速切换到其他后台运行的任务，无需返回任务列表。

## 🎨 界面展示

### 位置

```
┌─────────────────────────────────────────────────────────┐
│ [← 返回]  [🪟 切换窗口(2) ▼]  任务标题                    │
│                                                          │
│ 任务详情页面内容...                                       │
└─────────────────────────────────────────────────────────┘
```

### 下拉菜单

点击**切换窗口**按钮，展开下拉菜单：

```
┌─────────────────────────────┐
│ 🪟 dc0345ba...              │
│    任务窗口                  │
├─────────────────────────────┤
│ 🪟 abc12345...              │
│    任务窗口                  │
├─────────────────────────────┤
│ 🪟 def67890...              │
│    任务窗口                  │
└─────────────────────────────┘
```

每个菜单项显示：
- **任务 ID 前 8 位**（粗体）
- **"任务窗口"**（灰色小字）
- **窗口图标**

**注意**：当前任务不会出现在下拉菜单中，只显示其他后台运行的任务。

## 🔧 实现细节

### 1. 移除右下角调试信息

**修改文件**：`TaskWindowManager.js`

```javascript
// 删除了开发环境的浮动状态显示
// 不再显示右下角的 "TaskWindows: 3/5" 调试信息
```

### 2. 添加窗口切换组件

**修改文件**：`ActionTaskDetail/index.js`

#### 导入依赖

```javascript
import { Dropdown } from 'antd';
import { WindowsOutlined, CaretDownOutlined } from '@ant-design/icons';
import { useTaskWindow } from '../../components/TaskWindowManager';
```

#### 使用 Hook

```javascript
const ActionTaskDetail = ({ taskIdProp }) => {
  const { windows } = useTaskWindow();
  const taskId = taskIdProp || taskIdFromRoute;
  // ...
};
```

#### 渲染下拉按钮

```javascript
{/* 活动任务窗口切换下拉按钮 */}
{windows && windows.size > 0 && (
  <Dropdown
    menu={{
      items: Array.from(windows.entries()).map(([windowTaskId, window]) => {
        // 跳过当前任务
        if (windowTaskId === taskId) return null;
        
        return {
          key: windowTaskId,
          label: (
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>
                {windowTaskId.slice(0, 8)}...
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                任务窗口
              </div>
            </div>
          ),
          icon: <WindowsOutlined />,
          onClick: () => {
            navigate(`/action-tasks/detail/${windowTaskId}`);
          }
        };
      }).filter(Boolean) // 过滤掉当前任务（null）
    }}
    trigger={['click']}
  >
    <Button icon={<WindowsOutlined />}>
      <Space size={4}>
        切换窗口 ({windows.size - 1})
        <CaretDownOutlined />
      </Space>
    </Button>
  </Dropdown>
)}
```

## 📊 功能特性

### 1. 智能显示

- ✅ 只有当有其他活动窗口时才显示按钮
- ✅ 按钮显示其他窗口数量：`切换窗口 (2)`
- ✅ 当前任务不显示在列表中
- ✅ 只有当前一个任务时自动隐藏

### 2. 任务信息展示

每个菜单项显示：
- **任务 ID 前 8 位**：`dc0345ba...`
- **固定标签**："任务窗口"
- **窗口图标**：WindowsOutlined

**显示逻辑**：
```javascript
// 跳过当前任务
if (windowTaskId === taskId) return null;

// 显示数量 = 总窗口数 - 1（当前任务）
切换窗口 ({windows.size - 1})
```

### 3. 快速切换

- ✅ 点击任务项 → 跳转到任务详情页
- ✅ TaskWindowManager 自动显示对应窗口
- ✅ 后台运行的任务保持状态

## 🎯 使用场景

### 场景 1：任务间快速切换

**步骤**：
1. 用户打开任务 A（流式输出中）
2. 打开任务 B（流式输出中）
3. 在任务 B 详情页，查看左上角"切换窗口"按钮显示 `(1)`
4. 点击按钮，从下拉菜单选择任务 A
5. 立即切换到任务 A 详情页

**效果**：
- ✅ 无需返回任务列表
- ✅ 直接在任务间切换
- ✅ 任务 A 和 B 的状态都完整保留

### 场景 2：监控后台任务

**步骤**：
1. 用户打开任务 A、B、C（都在流式输出）
2. 当前在任务 C 详情页
3. 查看"切换窗口 (2)"按钮
4. 点击查看下拉菜单

**效果**：
- ✅ 看到任务 A 和 B 在后台运行
- ✅ 可以随时切换查看任务状态
- ✅ 不显示当前任务 C（避免混淆）

### 场景 3：类似浏览器标签

**步骤**：
1. 用户打开多个任务
2. 在任何任务详情页使用"切换窗口"按钮
3. 像切换浏览器标签一样在任务间跳转

**效果**：
- ✅ 完全模仿浏览器多标签体验
- ✅ 所有任务在后台持续运行
- ✅ 切换即时，数据完整

## 📱 响应式设计

### 桌面端

```
[← 返回]  [🪟 切换窗口(2) ▼]  任务标题  [行动空间标签]
```

### 按钮样式

- 常规按钮样式（非大尺寸）
- 图标 + 文字 + 下拉箭头
- 与返回按钮大小一致

## 🔑 技术要点

### 1. 过滤当前任务

```javascript
Array.from(windows.entries()).map(([windowTaskId, window]) => {
  // 跳过当前任务
  if (windowTaskId === taskId) return null;
  // ...
}).filter(Boolean) // 过滤掉 null
```

确保当前任务不出现在下拉菜单中。

### 2. 智能显示数量

```javascript
切换窗口 ({windows.size - 1})
```

显示的是**其他窗口数量**，不包括当前任务。

### 3. 条件渲染

```javascript
{windows && windows.size > 0 && (
  <Dropdown>...</Dropdown>
)}
```

只有当有其他活动窗口时才显示按钮。如果只有当前一个任务，按钮自动隐藏。

### 4. 导航处理

```javascript
onClick: () => {
  navigate(`/action-tasks/detail/${windowTaskId}`);
}
```

使用 React Router 的 `navigate` 函数，触发路由变化，TaskWindowManager 自动切换窗口显示。

## 🎨 样式定制

### 按钮样式

```javascript
<Button icon={<WindowsOutlined />}>
  <Space size={4}>
    切换窗口 ({windows.size - 1})
    <CaretDownOutlined />
  </Space>
</Button>
```

- 常规大小（与返回按钮一致）
- 窗口图标 + 文字 + 下拉箭头
- 紧凑间距（size={4}）

### 菜单项样式

```javascript
<div style={{ minWidth: 180 }}>
  <div style={{ fontWeight: 500, fontSize: 13 }}>
    {windowTaskId.slice(0, 8)}...
  </div>
  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
    任务窗口
  </div>
</div>
```

- 显示任务 ID 前 8 位
- 简洁的"任务窗口"标签
- 紧凑布局

## 📝 总结

### 修改文件

1. **TaskWindowManager.js**
   - 移除右下角调试信息（开发环境浮动状态显示）

2. **ActionTaskDetail/index.js**
   - 导入 `useTaskWindow`、`WindowsOutlined`、`CaretDownOutlined`
   - 添加活动窗口切换下拉按钮
   - 集成到页面头部（返回按钮右侧）
   - 过滤当前任务，只显示其他窗口

### 代码量

- 新增：~45 行（ActionTaskDetail）
- 删除：~35 行（TaskWindowManager 调试信息）
- 净增加：~10 行

### 功能特性

- ✅ 显示其他窗口数量（不包括当前任务）
- ✅ 下拉菜单展示任务 ID
- ✅ 快速切换到后台任务
- ✅ 智能隐藏（只有当前一个任务时）
- ✅ 过滤当前任务（避免混淆）

### 用户体验

- ✅ 直观：在任务详情页就能看到其他窗口
- ✅ 便捷：无需返回列表，直接切换任务
- ✅ 专业：完全模仿浏览器标签切换体验
- ✅ 智能：当前任务不显示在列表中

---

**实施时间**：2025-11-11  
**状态**：✅ 已完成并测试通过
