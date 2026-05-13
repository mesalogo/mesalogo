# 任务中心集成指南

## 一、组件说明

### 1. TaskCenterButton
右上角的任务中心入口按钮，带运行中任务数量徽章。

**功能特性：**
- ✅ 显示运行中任务数量徽章
- ✅ 自动 5 秒刷新徽章数字
- ✅ 点击打开任务中心 Modal
- ✅ 图标按钮样式（UnorderedListOutlined）

### 2. TaskCenterModal
任务中心主界面，显示所有任务列表。

**功能特性：**
- ✅ 显示任务统计（总数、等待、运行、完成、失败）
- ✅ 任务列表（表格形式）
- ✅ 过滤器（按类型、状态）
- ✅ 实时进度条
- ✅ 自动 5 秒刷新
- ✅ 查看任务详情
- ✅ 取消运行中任务
- ✅ 分页显示

---

## 二、快速集成

### 方式1：集成到主布局（推荐）

找到你的主布局文件（通常是 `MainLayout.js` 或 `Header.js`），添加任务中心按钮：

```javascript
// 导入
import { TaskCenterButton } from '@/components/Tasks';

// 在 Header 右侧区域添加
const Header = () => {
  return (
    <div className="header">
      {/* 其他导航按钮 */}
      
      {/* 右侧区域 */}
      <div className="header-right">
        {/* 任务中心按钮 */}
        <TaskCenterButton />
        
        {/* 用户菜单等其他按钮 */}
        <UserMenu />
      </div>
    </div>
  );
};
```

### 方式2：作为独立页面

```javascript
import React from 'react';
import { TaskCenterModal } from '@/components/Tasks';

const TaskCenterPage = () => {
  return (
    <div style={{ padding: 24 }}>
      <TaskCenterModal visible={true} onClose={() => history.back()} />
    </div>
  );
};

export default TaskCenterPage;
```

---

## 三、Ant Design Layout 集成示例

### 完整示例（包含任务中心按钮）

```javascript
import React from 'react';
import { Layout, Menu, Avatar, Dropdown } from 'antd';
import {
  HomeOutlined,
  DatabaseOutlined,
  SettingOutlined,
  UserOutlined
} from '@ant-design/icons';
import { TaskCenterButton } from '@/components/Tasks';

const { Header, Sider, Content } = Layout;

const MainLayout = ({ children }) => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider width={200}>
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#fff',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          系统名称
        </div>
        
        <Menu
          mode="inline"
          defaultSelectedKeys={['home']}
          items={[
            { key: 'home', icon: <HomeOutlined />, label: '首页' },
            { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库' },
            { key: 'settings', icon: <SettingOutlined />, label: '设置' }
          ]}
        />
      </Sider>

      <Layout>
        {/* 顶部导航 */}
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <div>
            {/* 左侧：面包屑或标题 */}
            <h2>页面标题</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* 任务中心按钮 */}
            <TaskCenterButton />

            {/* 用户下拉菜单 */}
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', label: '个人信息' },
                  { key: 'logout', label: '退出登录' }
                ]
              }}
            >
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            </Dropdown>
          </div>
        </Header>

        {/* 内容区域 */}
        <Content style={{ margin: 24 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
```

---

## 四、样式定制

### 自定义按钮样式

```javascript
<TaskCenterButton 
  style={{ 
    marginRight: 16,
    // 自定义样式
  }}
/>
```

### 自定义 Modal 宽度

修改 `TaskCenterModal.js` 中的 width：

```javascript
<Modal
  width={1200}  // 默认 1000
  // ...
/>
```

---

## 五、功能说明

### 1. 任务统计栏
显示实时任务统计：
- 总任务数
- 等待中（黄色）
- 运行中（蓝色）
- 已完成（绿色）
- 失败（红色）

### 2. 过滤器
支持按以下条件过滤：
- **任务类型**：
  - 文件向量化
  - 批量向量化
  - 文档分段
  - 变量同步
- **状态**：
  - 等待中
  - 运行中
  - 已完成
  - 失败

### 3. 任务列表
显示字段：
- 任务类型（中文名称）
- 状态（带图标的 Tag）
- 进度（进度条，0-100%）
- 消息（当前状态描述）
- 创建时间（格式：MM-DD HH:mm）
- 操作按钮：
  - 详情：打开任务详情弹窗
  - 取消：取消运行中的任务

### 4. 自动刷新
- 徽章数字：每 5 秒刷新
- 任务列表：打开 Modal 时每 5 秒刷新
- 关闭 Modal 后停止刷新

### 5. 分页
- 默认每页 10 条
- 支持切换每页显示数量
- 显示总数

---

## 六、配置选项

### TaskCenterButton Props

```javascript
// 当前版本无 props，完全自包含
<TaskCenterButton />
```

### TaskCenterModal Props

```javascript
<TaskCenterModal
  visible={boolean}     // 是否显示
  onClose={function}    // 关闭回调
/>
```

---

## 七、使用场景

### 场景1：用户提交向量化任务后
1. 用户点击"向量化"按钮
2. 任务提交成功
3. 右上角徽章数字 +1（显示运行中任务）
4. 用户可以点击徽章查看任务进度

### 场景2：批量操作
1. 用户批量提交 10 个文件的向量化任务
2. 徽章显示 10
3. 打开任务中心，看到 10 个任务的实时进度
4. 任务逐个完成，徽章数字递减

### 场景3：多端同步
1. 用户在页面 A 提交任务
2. 切换到页面 B
3. 任务中心徽章仍显示正确的运行中数量
4. 打开任务中心，看到所有任务（包括页面 A 提交的）

---

## 八、API 依赖

TaskCenterButton 和 TaskCenterModal 依赖以下 API：

1. **GET /api/tasks/stats**
   - 获取任务统计
   - 用于徽章数字

2. **GET /api/tasks**
   - 获取任务列表
   - 支持过滤和分页

3. **GET /api/tasks/{task_id}**
   - 查询单个任务详情
   - 详情弹窗使用

4. **POST /api/tasks/{task_id}/cancel**
   - 取消任务
   - 取消按钮使用

---

## 九、常见问题

### Q1: 徽章数字不更新？
**A:** 检查是否有错误：
```javascript
// 打开浏览器控制台，查看是否有 API 调用失败
console.error('获取任务统计失败:', error);
```

### Q2: 任务列表是空的？
**A:** 检查：
1. 是否有提交任务？
2. 用户权限是否正确？
3. API 是否返回数据？

### Q3: 如何自定义任务类型名称？
**A:** 修改 `TaskCenterModal.js` 中的 `TASK_TYPE_NAMES`：
```javascript
const TASK_TYPE_NAMES = {
  'kb:vectorize_file': '文件向量化',
  'kb:vectorize_batch': '批量向量化',
  // 添加更多映射
  'custom:task_type': '自定义任务名称',
};
```

### Q4: 如何修改刷新间隔？
**A:** 修改组件中的 `setInterval` 参数：
```javascript
// TaskCenterButton.js
const interval = setInterval(fetchRunningCount, 3000); // 改为 3 秒

// TaskCenterModal.js
const interval = setInterval(() => {
  fetchTasks();
  fetchStats();
}, 3000); // 改为 3 秒
```

---

## 十、完整效果预览

```
┌─────────────────────────────────────────────────┐
│  Logo         页面标题                 🔔(2)  👤 │  ← Header
└─────────────────────────────────────────────────┘
                                         ↑
                                   TaskCenterButton
                                   (显示 2 个运行中任务)
                    
点击后弹出 ↓

┌───────────────────────────────────────────────────────┐
│ 任务中心                                         ✕    │
├───────────────────────────────────────────────────────┤
│ 总任务: 50  等待: 1  运行中: 2  已完成: 45  失败: 2  │
├───────────────────────────────────────────────────────┤
│ [任务类型 ▼]  [状态 ▼]  [刷新]                       │
├───────────────────────────────────────────────────────┤
│ 任务类型    状态      进度        消息         操作   │
│ 文件向量化  运行中 ▓▓▓▓░░ 65%  向量化中... [详情] [取消] │
│ 批量向量化  等待中 ░░░░░░  0%  等待执行     [详情]      │
│ 文件向量化  已完成 ▓▓▓▓▓▓100%  完成        [详情]      │
└───────────────────────────────────────────────────────┘
                      ← 1  2  3  4  5 →
```

---

**任务中心组件完成！** 🎉

下一步：
1. 在主布局中添加 TaskCenterButton
2. 测试功能
3. 根据需要调整样式

有问题随时问！
