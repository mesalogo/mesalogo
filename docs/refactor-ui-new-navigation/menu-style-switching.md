# 菜单样式切换实现方案

## 一、设计目标

保留现有菜单样式，新增多列菜单样式，用户可自由切换。

### 两种菜单样式对比

| 特性 | 经典样式（现有） | 现代样式（新增） |
|------|----------------|----------------|
| 布局 | 左侧固定菜单栏 | 顶部抽屉 + 上下文侧边栏 |
| 菜单结构 | 多层折叠 | 多列平铺 |
| 初始状态 | 侧边栏常驻 | 侧边栏隐藏 |
| 空间利用 | 中等 | 高 |
| 导航方式 | 点击展开/收起 | 点击抽屉选择 |
| 适合场景 | 传统用户习惯 | 现代化体验 |

---

## 二、架构设计

### 1. 文件结构

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── MainLayout.js                    # 现有的经典布局（保持不变）
│   │   ├── ModernLayout/                    # 新增：现代布局
│   │   │   ├── index.js                     # 主组件
│   │   │   ├── GlobalMenuDrawer.js          # 全局菜单抽屉
│   │   │   ├── ContextualSidebar.js         # 上下文侧边栏
│   │   │   ├── MenuColumn.js                # 菜单列组件
│   │   │   ├── ShortcutColumn.js            # 快捷入口列
│   │   │   └── styles.module.css            # 样式文件
│   │   ├── LayoutWrapper.js                 # 新增：布局切换包装器
│   │   └── LayoutSwitcher.js                # 新增：样式切换器组件
│   └── ...
├── contexts/
│   └── LayoutContext.js                     # 新增：布局上下文
├── constants/
│   └── menuConfig.js                        # 新增：统一的菜单配置
└── ...
```

### 2. 组件层次

```
App.js
  └── LayoutWrapper                          # 布局切换包装器
       ├── MainLayout (经典样式)
       │    └── LayoutSwitcher               # 切换按钮
       └── ModernLayout (现代样式)
            ├── GlobalMenuDrawer
            ├── ContextualSidebar
            └── LayoutSwitcher
```

---

## 三、实现方案

### 1. 菜单配置统一

创建 `frontend/src/constants/menuConfig.js`，供两种布局共享：

```javascript
// menuConfig.js
import { 
  DashboardOutlined, 
  ProjectOutlined, 
  RobotOutlined,
  GlobalOutlined,
  MonitorOutlined,
  SettingOutlined,
  // ... 其他图标
} from '@ant-design/icons';

export const menuConfig = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: '工作台',
    path: '/home',
    children: null
  },
  {
    key: 'tasks',
    icon: <ProjectOutlined />,
    label: '任务管理',
    path: null,
    children: [
      {
        key: 'tasks-list',
        label: '任务列表',
        path: '/action-tasks/overview',
        icon: <OrderedListOutlined />
      },
      {
        key: 'tasks-parallel',
        label: '并行实验室',
        path: '/action-tasks/parallel-lab',
        icon: <ExperimentOutlined />
      },
      {
        key: 'tasks-workspace',
        label: '工作空间',
        path: '/workspace/browser',
        icon: <FolderOutlined />
      }
    ]
  },
  {
    key: 'agents',
    icon: <RobotOutlined />,
    label: '智能体',
    path: null,
    children: [
      {
        key: 'agents-roles',
        label: '角色管理',
        path: '/roles/management',
        icon: <UserOutlined />
      },
      {
        key: 'agents-tools',
        label: '能力工具',
        path: '/roles/tools',
        icon: <ToolOutlined />
      },
      {
        key: 'agents-knowledge',
        label: '知识库',
        path: '/roles/knowledges',
        icon: <DatabaseOutlined />
      },
      {
        key: 'agents-memory',
        label: '记忆管理',
        path: '/memory',
        icon: <PartitionOutlined />
      }
    ]
  },
  {
    key: 'spaces',
    icon: <GlobalOutlined />,
    label: '行动空间',
    path: null,
    children: [
      {
        key: 'spaces-overview',
        label: '空间概览',
        path: '/action-spaces/overview',
        icon: <AppstoreOutlined />
      },
      {
        key: 'spaces-joint',
        label: '联合空间',
        path: '/action-spaces/joint',
        icon: <LinkOutlined />
      },
      {
        key: 'spaces-rules',
        label: '行动规则',
        path: '/action-spaces/rules',
        icon: <ApartmentOutlined />
      },
      {
        key: 'spaces-env',
        label: '环境变量',
        path: '/action-spaces/environment',
        icon: <EnvironmentOutlined />
      },
      {
        key: 'spaces-market',
        label: '实体市场',
        path: '/action-spaces/market',
        icon: <ShopOutlined />
      }
    ]
  },
  {
    key: 'monitoring',
    icon: <MonitorOutlined />,
    label: '运行监控',
    path: null,
    children: [
      {
        key: 'monitoring-dashboard',
        label: '监控面板',
        path: '/action-spaces/monitoring',
        icon: <BarChartOutlined />
      }
    ]
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '系统设置',
    path: null,
    adminOnly: true,
    children: [
      {
        key: 'settings-general',
        label: '基础配置',
        path: '/settings/general',
        icon: <SafetyCertificateOutlined />
      },
      {
        key: 'settings-model',
        label: '模型配置',
        path: '/settings/model-configs',
        icon: <ApiOutlined />
      },
      {
        key: 'settings-users',
        label: '用户管理',
        path: '/settings/users',
        icon: <UserOutlined />
      },
      {
        key: 'settings-mcp',
        label: 'MCP服务器',
        path: '/mcp-servers',
        icon: <ControlOutlined />
      },
      {
        key: 'settings-graph',
        label: '图增强',
        path: '/settings/graph-enhancement',
        icon: <ShareAltOutlined />
      },
      {
        key: 'settings-logs',
        label: '运行日志',
        path: '/settings/logs',
        icon: <CodeOutlined />
      },
      {
        key: 'settings-about',
        label: '关于系统',
        path: '/settings/about',
        icon: <InfoCircleOutlined />,
        adminOnly: false
      }
    ]
  }
];

// 导出多列布局配置
export const multiColumnConfig = [
  {
    title: '核心功能',
    sections: ['dashboard', 'tasks', 'agents', 'spaces', 'monitoring']
  },
  {
    title: '资源管理',
    sections: [
      {
        key: 'knowledge',
        icon: <DatabaseOutlined />,
        label: '知识库',
        children: [
          { key: 'knowledge-list', label: '知识库管理', path: '/roles/knowledges' }
        ]
      },
      {
        key: 'memory',
        icon: <CloudServerOutlined />,
        label: '记忆管理',
        children: [
          { key: 'memory-list', label: '记忆列表', path: '/memory' }
        ]
      },
      {
        key: 'tools',
        icon: <ToolOutlined />,
        label: '工具市场',
        children: [
          { key: 'tools-list', label: '工具列表', path: '/roles/tools' }
        ]
      }
    ]
  },
  {
    title: '配置与运维',
    sections: ['settings']
  },
  {
    title: '快捷入口',
    type: 'shortcuts'
  }
];
```

---

### 2. 布局上下文

创建 `frontend/src/contexts/LayoutContext.js`：

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';

const LayoutContext = createContext();

export const LAYOUT_TYPES = {
  CLASSIC: 'classic',   // 经典样式（现有）
  MODERN: 'modern'      // 现代样式（新增）
};

const STORAGE_KEY = 'layout_preference';

export const LayoutProvider = ({ children }) => {
  const [layoutType, setLayoutType] = useState(() => {
    // 从 localStorage 读取用户偏好
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || LAYOUT_TYPES.CLASSIC; // 默认使用经典样式
  });

  // 切换布局样式
  const switchLayout = (type) => {
    setLayoutType(type);
    localStorage.setItem(STORAGE_KEY, type);
  };

  // 切换到另一种样式
  const toggleLayout = () => {
    const newType = layoutType === LAYOUT_TYPES.CLASSIC 
      ? LAYOUT_TYPES.MODERN 
      : LAYOUT_TYPES.CLASSIC;
    switchLayout(newType);
  };

  return (
    <LayoutContext.Provider 
      value={{ 
        layoutType, 
        switchLayout, 
        toggleLayout,
        isClassic: layoutType === LAYOUT_TYPES.CLASSIC,
        isModern: layoutType === LAYOUT_TYPES.MODERN
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
};
```

---

### 3. 布局包装器

创建 `frontend/src/components/layout/LayoutWrapper.js`：

```javascript
import React from 'react';
import { useLayout } from '../../contexts/LayoutContext';
import MainLayout from './MainLayout';              // 经典布局
import ModernLayout from './ModernLayout';          // 现代布局

const LayoutWrapper = ({ children }) => {
  const { layoutType, LAYOUT_TYPES } = useLayout();

  // 根据用户选择的样式渲染对应的布局
  if (layoutType === LAYOUT_TYPES.MODERN) {
    return <ModernLayout>{children}</ModernLayout>;
  }

  // 默认使用经典布局
  return <MainLayout>{children}</MainLayout>;
};

export default LayoutWrapper;
```

---

### 4. 样式切换器组件

创建 `frontend/src/components/layout/LayoutSwitcher.js`：

```javascript
import React from 'react';
import { Button, Tooltip, Dropdown } from 'antd';
import { 
  LayoutOutlined, 
  MenuOutlined,
  AppstoreOutlined,
  CheckOutlined 
} from '@ant-design/icons';
import { useLayout, LAYOUT_TYPES } from '../../contexts/LayoutContext';

const LayoutSwitcher = ({ placement = 'header' }) => {
  const { layoutType, switchLayout } = useLayout();

  const menuItems = [
    {
      key: LAYOUT_TYPES.CLASSIC,
      icon: <MenuOutlined />,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '160px' }}>
          <span>经典样式</span>
          {layoutType === LAYOUT_TYPES.CLASSIC && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => switchLayout(LAYOUT_TYPES.CLASSIC)
    },
    {
      key: LAYOUT_TYPES.MODERN,
      icon: <AppstoreOutlined />,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '160px' }}>
          <span>现代样式</span>
          {layoutType === LAYOUT_TYPES.MODERN && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => switchLayout(LAYOUT_TYPES.MODERN)
    }
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Tooltip title="切换菜单样式" placement="bottom">
        <Button
          type="text"
          icon={<LayoutOutlined />}
          style={{ fontSize: '16px' }}
        />
      </Tooltip>
    </Dropdown>
  );
};

export default LayoutSwitcher;
```

---

### 5. 修改 App.js

```javascript
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LayoutProvider } from './contexts/LayoutContext';
import LayoutWrapper from './components/layout/LayoutWrapper';
import { AuthProvider } from './contexts/AuthContext';
// ... 其他导入

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LayoutProvider>                    {/* 新增：布局上下文 */}
          <LayoutWrapper>                   {/* 新增：布局包装器 */}
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/home" element={<Home />} />
              {/* ... 其他路由 */}
            </Routes>
          </LayoutWrapper>
        </LayoutProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

---

### 6. 在 Header 中添加切换按钮

修改现有的 `MainLayout.js` 和新的 `ModernLayout/index.js`：

```javascript
// MainLayout.js - 在 Header 右侧添加
import LayoutSwitcher from './LayoutSwitcher';

// 在 Header 的右侧区域添加
<Space>
  <JobCenterButton />
  <LanguageSwitcher />
  <LayoutSwitcher />              {/* 新增：样式切换按钮 */}
  <Dropdown menu={userMenuItems}>
    <Avatar />
  </Dropdown>
</Space>
```

---

## 四、现代布局实现

### 1. ModernLayout/index.js

```javascript
import React, { useState, useEffect } from 'react';
import { Layout, Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import GlobalMenuDrawer from './GlobalMenuDrawer';
import ContextualSidebar from './ContextualSidebar';
import LayoutSwitcher from '../LayoutSwitcher';
import { menuConfig } from '../../../constants/menuConfig';
import './styles.css';

const { Header, Content } = Layout;
const STORAGE_KEY = 'modern_layout_current_section';

const ModernLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSection, setCurrentSection] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  
  // 根据路由推断当前Section
  const inferSectionFromPath = (pathname) => {
    for (const section of menuConfig) {
      if (section.children) {
        const matched = section.children.find(child => 
          pathname.startsWith(child.path)
        );
        if (matched) return section;
      }
    }
    return null;
  };
  
  // 路由变化时更新侧边栏
  useEffect(() => {
    const section = inferSectionFromPath(location.pathname);
    if (section) {
      setCurrentSection(section);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(section));
    }
  }, [location.pathname]);
  
  // 处理菜单选择
  const handleMenuSelect = (section, item) => {
    setCurrentSection(section);
    setDrawerVisible(false);
    if (item.path) {
      navigate(item.path);
    }
  };
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Header */}
      <Header style={{
        position: 'fixed',
        zIndex: 1000,
        width: '100%',
        height: '56px',
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        borderBottom: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        {/* 左侧：菜单按钮 + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerVisible(true)}
            style={{ fontSize: '18px' }}
          />
          <div style={{ fontSize: '18px', fontWeight: '600', cursor: 'pointer' }}
               onClick={() => navigate('/home')}>
            MesaLogo
          </div>
        </div>
        
        {/* 右侧：操作按钮 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <JobCenterButton />
          <LanguageSwitcher />
          <LayoutSwitcher />
          <UserMenu />
        </div>
      </Header>
      
      {/* 全局导航抽屉 */}
      <GlobalMenuDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onSelect={handleMenuSelect}
      />
      
      {/* 上下文侧边栏 */}
      {currentSection && (
        <ContextualSidebar
          section={currentSection}
          onClose={() => {
            setCurrentSection(null);
            localStorage.removeItem(STORAGE_KEY);
          }}
        />
      )}
      
      {/* 主内容区 */}
      <Content style={{
        marginTop: 56,
        marginLeft: currentSection?.children ? 200 : 0,
        padding: '24px',
        transition: 'margin-left 0.3s ease',
        minHeight: 'calc(100vh - 56px)'
      }}>
        {children}
      </Content>
    </Layout>
  );
};

export default ModernLayout;
```

---

## 五、切换按钮位置选项

### 方案1：Header 右侧（推荐）

```
┌────────────────────────────────────────────────────┐
│ [≡] Logo    🔍       🔔 任务  语言 [⚡样式] 👤用户    │
└────────────────────────────────────────────────────┘
                                      ↑
                                  切换按钮
```

**优点**：位置固定，容易找到

### 方案2：用户菜单内

```
点击用户头像 →
  ├─ 修改密码
  ├─ 切换菜单样式  →  • 经典样式 ✓
  │                  • 现代样式
  └─ 退出登录
```

**优点**：不占用 Header 空间

### 方案3：设置页面

在 `/settings/general` 页面添加菜单样式配置项

**优点**：统一在设置中管理

### 推荐组合

- **主要位置**：Header 右侧（方便快速切换）
- **次要位置**：设置页面（系统化配置）

---

## 六、迁移策略

### Phase 1：准备工作（0.5天）
- [x] 创建 `menuConfig.js` 统一菜单配置
- [x] 创建 `LayoutContext.js` 布局上下文
- [x] 创建 `LayoutWrapper.js` 包装器
- [x] 创建 `LayoutSwitcher.js` 切换器

### Phase 2：现代布局开发（2天）
- [ ] 创建 `ModernLayout` 目录结构
- [ ] 实现 `GlobalMenuDrawer` 多列抽屉
- [ ] 实现 `ContextualSidebar` 上下文侧边栏
- [ ] 实现搜索、收藏、最近访问功能

### Phase 3：集成测试（0.5天）
- [ ] 在 App.js 中集成
- [ ] 测试两种样式切换
- [ ] 测试路由跳转
- [ ] 测试权限控制

### Phase 4：样式优化（0.5天）
- [ ] 调整动画效果
- [ ] 响应式适配
- [ ] 细节打磨

---

## 七、数据迁移

### 从现有 MainLayout 提取配置

```javascript
// 现有 MainLayout.js 中的 menuItems
const menuItems = [
  {
    key: 'action-tasks',
    icon: <DashboardOutlined />,
    label: <span>{t('menu.actionCenter')}</span>,
    children: [...]
  },
  // ...
];

// 转换为统一配置
const menuConfig = menuItems.map(item => ({
  key: item.key,
  icon: item.icon,
  label: item.label.props.children, // 提取文本
  children: item.children?.map(child => ({
    key: child.key,
    label: child.label.props.children,
    path: child.label.props.to,
    icon: child.icon
  }))
}));
```

---

## 八、用户体验优化

### 1. 首次引导

用户第一次访问时，显示提示：

```javascript
const FirstTimeGuide = () => {
  const [visible, setVisible] = useState(() => {
    return !localStorage.getItem('layout_guide_shown');
  });
  
  const handleClose = () => {
    setVisible(false);
    localStorage.setItem('layout_guide_shown', 'true');
  };
  
  return (
    <Modal
      visible={visible}
      onCancel={handleClose}
      footer={null}
    >
      <div>
        <h3>🎉 新功能：菜单样式切换</h3>
        <p>我们提供了两种菜单样式供您选择：</p>
        <ul>
          <li><b>经典样式</b>：传统的侧边栏菜单</li>
          <li><b>现代样式</b>：多列抽屉菜单，节省空间</li>
        </ul>
        <p>点击右上角 <LayoutOutlined /> 图标即可切换</p>
        <Button type="primary" onClick={handleClose}>我知道了</Button>
      </div>
    </Modal>
  );
};
```

### 2. 动画过渡

切换样式时添加过渡动画：

```css
.layout-transition-enter {
  opacity: 0;
  transform: translateY(20px);
}

.layout-transition-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s ease-out;
}

.layout-transition-exit {
  opacity: 1;
}

.layout-transition-exit-active {
  opacity: 0;
  transition: all 0.2s ease-in;
}
```

### 3. 快捷键切换

```javascript
useEffect(() => {
  const handleKeyPress = (e) => {
    // Ctrl/Cmd + Shift + L 切换布局
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      toggleLayout();
    }
  };
  
  document.addEventListener('keydown', handleKeyPress);
  return () => document.removeEventListener('keydown', handleKeyPress);
}, [toggleLayout]);
```

---

## 九、测试清单

### 功能测试
- [ ] 切换到现代样式，刷新页面后保持
- [ ] 切换到经典样式，刷新页面后保持
- [ ] 两种样式下路由跳转正常
- [ ] 两种样式下权限控制正常
- [ ] 多列抽屉搜索功能正常
- [ ] 收藏和最近访问功能正常

### 兼容性测试
- [ ] Chrome 浏览器
- [ ] Safari 浏览器
- [ ] Firefox 浏览器
- [ ] Edge 浏览器
- [ ] 移动端响应式

### 性能测试
- [ ] 切换样式无卡顿
- [ ] 首屏加载时间无明显增加
- [ ] localStorage 读写正常

---

## 十、回滚方案

如果新样式有问题，可以快速回滚：

### 1. 临时禁用

在 `LayoutWrapper.js` 中强制使用经典样式：

```javascript
const LayoutWrapper = ({ children }) => {
  // const { layoutType } = useLayout();
  
  // 临时强制使用经典样式
  return <MainLayout>{children}</MainLayout>;
};
```

### 2. 完全移除

删除以下文件即可：
- `ModernLayout/` 目录
- `LayoutContext.js`
- `LayoutWrapper.js`
- `LayoutSwitcher.js`

App.js 恢复使用 `<MainLayout>` 直接包裹。

---

## 十一、未来扩展

### 更多样式选项

可以继续添加第三种、第四种样式：

```javascript
export const LAYOUT_TYPES = {
  CLASSIC: 'classic',
  MODERN: 'modern',
  COMPACT: 'compact',     // 紧凑样式
  FULLSCREEN: 'fullscreen' // 全屏样式
};
```

### 自定义主题

结合 Ant Design 主题定制，每种布局可以有不同的配色：

```javascript
const themeConfig = {
  classic: { primaryColor: '#1677ff' },
  modern: { primaryColor: '#52c41a' },
  compact: { primaryColor: '#722ed1' }
};
```

---

需要我开始实现这个方案吗？
