# 实体应用市场 - 产品需求与技术方案

## 1. 产品需求文档（PRD）

### 1.1 功能概述
在现有的行动空间中新增一个名为"实体应用市场"的一级菜单，为用户提供各种实体操作插件的统一入口和管理平台。

### 1.2 核心需求

#### 1.2.1 菜单结构
- **位置**：作为行动空间的一级菜单项
- **名称**：实体应用市场
- **展示方式**：右侧tab页面形式

#### 1.2.2 应用插件类型
- **代码管理**：集成vscode server，提供在线代码编辑能力
- **NetLogo建模**：提供ABM（Agent-Based Modeling）建模工具，基于NetLogo引擎
- **扩展性**：支持后续添加更多实体操作插件

### 1.3 用户体验设计

#### 1.3.1 导航体验
- 用户点击"实体应用市场"菜单项
- 右侧展开对应的tab页面
- 显示可用的应用插件列表

#### 1.3.2 应用展示
- **卡片式布局**：每个应用以卡片形式展示
- **应用信息**：包含应用名称、描述、图标
- **快速启动**：点击即可启动对应的应用/工具

#### 1.3.3 应用管理
- **分类展示**：可按功能类型分类（开发工具、建模工具等）
- **搜索功能**：支持应用名称搜索
- **收藏功能**：用户可收藏常用应用

### 1.4 初期应用规划

#### 1.4.1 代码管理（vscode server）
- 提供在线代码编辑环境
- 支持多种编程语言
- 集成版本控制功能

#### 1.4.2 NetLogo建模工具
- ABM建模平台，基于NetLogo引擎
- 可视化建模界面
- 模型参数配置
- 仿真结果展示

## 2. 技术方案

### 2.1 整体架构设计

#### 2.1.1 系统架构
```
行动空间
├── 现有菜单项
├── 实体应用市场 (新增)
│   ├── 应用列表组件
│   ├── 应用详情组件
│   ├── 应用启动器
│   └── 应用管理器
└── 其他功能模块
```

#### 2.1.2 技术栈
- **前端框架**：基于现有技术栈（React/Vue）
- **状态管理**：集成现有状态管理方案
- **路由管理**：扩展现有路由配置
- **UI组件库**：复用现有组件库

### 2.2 核心模块设计

#### 2.2.1 应用注册系统
```typescript
interface AppPlugin {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  type: 'iframe' | 'component' | 'external';
  config: {
    url?: string;
    component?: React.ComponentType;
    permissions?: string[];
  };
  metadata: {
    version: string;
    author: string;
    tags: string[];
  };
}
```

#### 2.2.2 应用管理器
```typescript
class AppManager {
  private apps: Map<string, AppPlugin> = new Map();
  
  registerApp(app: AppPlugin): void;
  unregisterApp(appId: string): void;
  getApp(appId: string): AppPlugin | undefined;
  getAppsByCategory(category: string): AppPlugin[];
  searchApps(query: string): AppPlugin[];
}
```

#### 2.2.3 应用启动器
```typescript
class AppLauncher {
  launchApp(appId: string, container: HTMLElement): Promise<void>;
  closeApp(appId: string): void;
  getRunningApps(): string[];
}
```

### 2.3 前端实现方案

#### 2.3.1 菜单集成
1. **路由配置**：在现有路由中添加 `/action-space/market` 路由
2. **菜单项添加**：在行动空间菜单配置中添加"实体应用市场"项
3. **权限控制**：集成现有权限系统

#### 2.3.2 页面组件结构
```
MarketPage/
├── index.tsx                 # 主页面组件
├── components/
│   ├── AppCard.tsx          # 应用卡片组件
│   ├── AppList.tsx          # 应用列表组件
│   ├── AppDetail.tsx        # 应用详情组件
│   ├── AppLauncher.tsx      # 应用启动组件
│   └── SearchBar.tsx        # 搜索栏组件
├── hooks/
│   ├── useAppManager.ts     # 应用管理Hook
│   └── useAppLauncher.ts    # 应用启动Hook
└── types/
    └── app.types.ts         # 类型定义
```

#### 2.3.3 状态管理
```typescript
interface MarketState {
  apps: AppPlugin[];
  categories: string[];
  runningApps: string[];
  favorites: string[];
  searchQuery: string;
  selectedCategory: string;
}
```

### 2.4 应用集成方案

#### 2.4.1 VSCode Server集成
```typescript
const vscodeApp: AppPlugin = {
  id: 'vscode-server',
  name: '代码管理',
  description: '在线代码编辑器，支持多种编程语言',
  icon: '/icons/vscode.svg',
  category: '开发工具',
  type: 'iframe',
  config: {
    url: '/vscode',
    permissions: ['code.read', 'code.write']
  }
};
```

#### 2.4.2 NetLogo建模工具集成
```typescript
const netlogoApp: AppPlugin = {
  id: 'netlogo-modeling',
  name: 'NetLogo建模',
  description: 'ABM建模平台，基于NetLogo引擎的智能体建模工具，支持复杂系统仿真',
  icon: '/icons/netlogo.svg',
  category: '建模工具',
  type: 'component',
  config: {
    component: NetLogoModelingComponent,
    permissions: ['model.create', 'model.simulate']
  }
};
```

### 2.5 后端支持

#### 2.5.1 应用配置API
```typescript
// GET /api/market/apps - 获取应用列表
// POST /api/market/apps - 注册新应用
// PUT /api/market/apps/:id - 更新应用信息
// DELETE /api/market/apps/:id - 删除应用
```

#### 2.5.2 用户偏好API
```typescript
// GET /api/market/favorites - 获取收藏应用
// POST /api/market/favorites - 添加收藏
// DELETE /api/market/favorites/:id - 取消收藏
```

### 2.6 安全考虑

#### 2.6.1 权限控制
- 应用级别权限验证
- 用户角色权限检查
- API访问权限控制

#### 2.6.2 安全隔离
- iframe沙箱机制
- CSP内容安全策略
- 跨域请求限制

### 2.7 扩展性设计

#### 2.7.1 插件热加载
- 支持运行时动态加载应用
- 配置文件热更新
- 应用版本管理

#### 2.7.2 主题适配
- 统一主题变量
- 应用样式继承
- 暗色/亮色模式支持

## 3. 实施计划

### 3.1 第一阶段：基础框架
- [ ] 菜单项集成
- [ ] 基础页面组件
- [ ] 应用注册系统
- [ ] 应用管理器

### 3.2 第二阶段：应用集成
- [ ] VSCode Server集成
- [ ] NetLogo建模工具集成
- [ ] 应用启动器实现

### 3.3 第三阶段：功能完善
- [ ] 搜索功能
- [ ] 收藏功能
- [ ] 权限控制
- [ ] 性能优化

### 3.4 第四阶段：扩展优化
- [ ] 插件热加载
- [ ] 主题适配
- [ ] 用户体验优化
- [ ] 文档完善

## 4. 风险评估

### 4.1 技术风险
- 现有系统集成复杂度
- 应用间资源冲突
- 性能影响评估

### 4.2 用户体验风险
- 学习成本
- 界面一致性
- 响应速度

### 4.3 安全风险
- 第三方应用安全性
- 权限控制完整性
- 数据隔离安全性

## 5. 成功指标

### 5.1 功能指标
- 应用加载成功率 > 99%
- 页面响应时间 < 2s
- 应用启动时间 < 5s

### 5.2 用户指标
- 用户使用率 > 60%
- 用户满意度 > 4.0/5.0
- 应用平均使用时长 > 10min
