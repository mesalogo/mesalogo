# 上下文菜单设计方案（Contextual Sidebar）

参考Notion、Figma等现代应用的导航模式，实现"全局抽屉 + 上下文侧边栏"的设计。

---

## 一、设计理念

### 核心思想
- **全局导航抽屉**：快速切换不同功能域（一级菜单）
- **上下文侧边栏**：只显示当前功能域的二级菜单
- **按需显示**：侧边栏默认隐藏，选择后才显示并常驻

### 用户体验
1. 初始状态：侧边栏隐藏，屏幕空间最大化
2. 点击左上角按钮：弹出抽屉，显示所有功能模块
3. 选择某个功能：侧边栏显示对应的子菜单，导航到页面
4. 持续使用：侧边栏保持显示，可在同一功能域内快速切换

---

## 二、交互流程

### 初始状态
```
┌─────────────────────────────────────────────────┐
│ [≡ 菜单]  MesaLogo    🔍 🔔 任务 语言 用户        │ ← Header
├─────────────────────────────────────────────────┤
│                                                 │
│              页面内容区域（全屏宽度）              │
│                                                 │
│              （左侧菜单隐藏）                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 点击左上角 [≡ 菜单] 按钮（多列布局）
```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡ 菜单]  MesaLogo    🔍 🔔 任务 语言 用户                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  🔍 搜索功能...                                    [ESC 关闭]   │      │
│  ├───────────────────────────────────────────────────────────────┤      │
│  │                                                               │      │
│  │  ┌──────────────┬──────────────┬──────────────┬─────────────┐│      │
│  │  │ 核心功能      │ 资源管理      │ 配置与运维    │ 快捷入口     ││      │
│  │  ├──────────────┼──────────────┼──────────────┼─────────────┤│      │
│  │  │              │              │              │             ││      │
│  │  │ 📊 工作台     │ 💾 知识库     │ ⚙️ 系统配置   │ ⭐ 收藏的功能││      │
│  │  │              │   • 知识库管理 │   • 基础配置  │  • 任务列表  ││      │
│  │  │ 🎯 任务管理   │   • 文档管理   │   • 模型配置  │  • 角色管理  ││      │
│  │  │   • 任务列表  │              │              │             ││      │
│  │  │   • 并行实验室 │ 🧠 记忆管理   │ 👤 用户管理   │ 🕐 最近访问  ││      │
│  │  │   • 工作空间  │   • 记忆列表   │   • 用户列表  │  • 监控面板  ││      │
│  │  │              │   • 记忆配置   │   • 角色权限  │  • 知识库    ││      │
│  │  │ 👥 智能体     │              │              │             ││      │
│  │  │   • 角色管理  │ 🔧 工具市场   │ 🔌 集成服务   │             ││      │
│  │  │   • 能力工具  │   • 工具列表   │   • MCP服务器 │             ││      │
│  │  │   • 知识库    │   • 能力配置   │   • 图增强    │             ││      │
│  │  │   • 记忆管理  │              │   • API集成   │             ││      │
│  │  │              │              │              │             ││      │
│  │  │ 🌐 行动空间   │              │ 📋 运行日志   │             ││      │
│  │  │   • 空间概览  │              │   • 系统日志  │             ││      │
│  │  │   • 联合空间  │              │   • 操作记录  │             ││      │
│  │  │   • 行动规则  │              │              │             ││      │
│  │  │   • 环境变量  │              │ ℹ️ 关于系统   │             ││      │
│  │  │   • 实体市场  │              │              │             ││      │
│  │  │              │              │              │             ││      │
│  │  │ 📈 运行监控   │              │              │             ││      │
│  │  │   • 监控面板  │              │              │             ││      │
│  │  │   • 执行记录  │              │              │             ││      │
│  │  │              │              │              │             ││      │
│  │  └──────────────┴──────────────┴──────────────┴─────────────┘│      │
│  │                                                               │      │
│  └───────────────────────────────────────────────────────────────┘      │
│           ↑ 抽屉宽度 900px，4列布局，半透明遮罩                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 用户点击 "🎯 任务管理" 的任意节点（比如"任务列表"）
```
┌─────────────────────────────────────────────────┐
│ [≡ 菜单]  MesaLogo    🔍 🔔 任务 语言 用户        │
├───────┬─────────────────────────────────────────┤
│       │                                         │
│ 🎯任务 │         任务列表页面内容                 │
│       │                                         │
│ 任务列表│                                         │ ← 当前选中
│ 并行实验│                                         │
│ 工作空间│                                         │
│       │                                         │
│       │                                         │
└───────┴─────────────────────────────────────────┘
   ↑ 左侧栏显示并常驻，宽度 200px
   ↑ 只显示"任务管理"的子菜单
```

### 切换到其他功能域（点击左上角菜单 → 选择"智能体"）
```
┌─────────────────────────────────────────────────┐
│ [≡ 菜单]  MesaLogo    🔍 🔔 任务 语言 用户        │
├───────┬─────────────────────────────────────────┤
│       │                                         │
│ 👥智能体│         角色管理页面内容                 │
│       │                                         │
│ 角色管理│                                         │ ← 当前选中
│ 能力工具│                                         │
│ 知识库  │                                         │
│ 记忆管理│                                         │
│       │                                         │
└───────┴─────────────────────────────────────────┘
   ↑ 侧边栏内容替换为"智能体"的子菜单
```

---

## 三、数据结构设计

```javascript
// 菜单配置
const menuConfig = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: '工作台',
    path: '/home',
    children: null  // 无子菜单，点击直接跳转
  },
  {
    key: 'tasks',
    icon: <ProjectOutlined />,
    label: '任务管理',
    path: null,  // 一级菜单无直接路径
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
    adminOnly: true,  // 权限控制
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
        adminOnly: false  // 所有人可见
      }
    ]
  }
];
```

---

## 四、组件设计

### 1. MainLayout 结构

```javascript
const MainLayout = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSection, setCurrentSection] = useState(null);  // 当前一级菜单
  
  return (
    <Layout>
      {/* 顶部导航 */}
      <Header>
        <Button icon={<MenuOutlined />} onClick={() => setDrawerVisible(true)} />
        <Logo />
        <RightActions />
      </Header>
      
      {/* 全局导航抽屉 */}
      <GlobalMenuDrawer 
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onSelect={(section) => {
          setCurrentSection(section);
          setDrawerVisible(false);
        }}
      />
      
      {/* 上下文侧边栏 */}
      {currentSection && (
        <ContextualSidebar 
          section={currentSection}
          onClose={() => setCurrentSection(null)}
        />
      )}
      
      {/* 主内容区 */}
      <Content style={{ marginLeft: currentSection ? 200 : 0 }}>
        {children}
      </Content>
    </Layout>
  );
};
```

### 2. GlobalMenuDrawer（全局抽屉 - 多列布局）

```javascript
const GlobalMenuDrawer = ({ visible, onClose, onSelect }) => {
  const [searchText, setSearchText] = useState('');
  
  // 菜单分组配置（多列布局）
  const menuColumns = [
    {
      title: '核心功能',
      sections: [
        menuConfig.find(m => m.key === 'dashboard'),
        menuConfig.find(m => m.key === 'tasks'),
        menuConfig.find(m => m.key === 'agents'),
        menuConfig.find(m => m.key === 'spaces'),
        menuConfig.find(m => m.key === 'monitoring')
      ]
    },
    {
      title: '资源管理',
      sections: [
        { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库', 
          children: [
            { key: 'knowledge-list', label: '知识库管理', path: '/roles/knowledges' },
            { key: 'knowledge-docs', label: '文档管理', path: '/roles/knowledges/docs' }
          ]
        },
        { key: 'memory-mgmt', icon: <CloudServerOutlined />, label: '记忆管理',
          children: [
            { key: 'memory-list', label: '记忆列表', path: '/memory' },
            { key: 'memory-config', label: '记忆配置', path: '/memory/config' }
          ]
        },
        { key: 'tools', icon: <ToolOutlined />, label: '工具市场',
          children: [
            { key: 'tools-list', label: '工具列表', path: '/roles/tools' },
            { key: 'tools-config', label: '能力配置', path: '/roles/tools/config' }
          ]
        }
      ]
    },
    {
      title: '配置与运维',
      sections: [
        menuConfig.find(m => m.key === 'settings')
      ]
    },
    {
      title: '快捷入口',
      sections: [
        {
          key: 'favorites',
          icon: <StarOutlined />,
          label: '收藏的功能',
          type: 'favorites',  // 特殊类型
          items: getFavorites()  // 从 localStorage 获取
        },
        {
          key: 'recent',
          icon: <ClockCircleOutlined />,
          label: '最近访问',
          type: 'recent',
          items: getRecentVisited()
        }
      ]
    }
  ];
  
  return (
    <Drawer
      placement="top"
      height="auto"
      visible={visible}
      onClose={onClose}
      closeIcon={null}
      bodyStyle={{ padding: 0 }}
      style={{ maxHeight: '80vh' }}
    >
      {/* 搜索栏 */}
      <div style={{
        padding: '20px 40px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索功能..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="large"
          suffix={
            <span style={{ color: '#8c8c8c', fontSize: '12px' }}>ESC 关闭</span>
          }
          autoFocus
        />
      </div>
      
      {/* 多列菜单网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '24px',
        padding: '24px 40px',
        maxHeight: 'calc(80vh - 100px)',
        overflow: 'auto'
      }}>
        {menuColumns.map((column, idx) => (
          <div key={idx} className="menu-column">
            {/* 列标题 */}
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#8c8c8c',
              textTransform: 'uppercase',
              marginBottom: '12px',
              letterSpacing: '0.5px'
            }}>
              {column.title}
            </div>
            
            {/* 列内容 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {column.sections.filter(Boolean).map(section => (
                <MenuColumn
                  key={section.key}
                  section={section}
                  onSelect={onSelect}
                  searchText={searchText}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
};
```

### 3. MenuColumn（多列布局的菜单项组件）

```javascript
const MenuColumn = ({ section, onSelect, searchText }) => {
  const navigate = useNavigate();
  
  // 如果没有子菜单，显示为单个按钮
  if (!section.children) {
    return (
      <div
        className="menu-section-item"
        onClick={() => {
          onSelect(section, { path: section.path });
        }}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          borderRadius: '6px',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <span style={{ fontSize: '18px', color: '#1677ff' }}>{section.icon}</span>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>{section.label}</span>
      </div>
    );
  }
  
  // 有子菜单，显示为一级标题 + 子菜单列表
  return (
    <div className="menu-section" style={{ marginBottom: '12px' }}>
      {/* 一级菜单标题（不可点击） */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '4px'
      }}>
        <span style={{ fontSize: '18px', color: '#1677ff' }}>{section.icon}</span>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#262626' }}>
          {section.label}
        </span>
      </div>
      
      {/* 二级菜单列表（始终显示） */}
      <div className="menu-section-children">
        {section.children.map(child => {
          // 搜索过滤
          if (searchText && !child.label.toLowerCase().includes(searchText.toLowerCase())) {
            return null;
          }
          
          return (
            <div
              key={child.key}
              className="menu-child-item"
              onClick={() => {
                onSelect(section, child);
              }}
              style={{
                padding: '6px 12px 6px 40px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#595959',
                borderRadius: '4px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f0f0';
                e.currentTarget.style.color = '#1677ff';
                e.currentTarget.style.paddingLeft = '44px';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#595959';
                e.currentTarget.style.paddingLeft = '40px';
              }}
            >
              <span style={{ fontSize: '12px', color: 'inherit' }}>•</span>
              <span>{child.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

### 4. ContextualSidebar（上下文侧边栏）

```javascript
const ContextualSidebar = ({ section, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 如果一级菜单没有子菜单，不显示侧边栏
  if (!section.children) return null;
  
  return (
    <Sider
      width={200}
      style={{
        position: 'fixed',
        left: 0,
        top: 64,  // Header高度
        height: 'calc(100vh - 64px)',
        background: '#fafafa',
        borderRight: '1px solid #f0f0f0',
        overflow: 'auto',
        zIndex: 10
      }}
    >
      {/* 侧边栏标题 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{section.icon}</span>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>{section.label}</span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </div>
      
      {/* 子菜单列表 */}
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{
          border: 'none',
          background: 'transparent',
          padding: '8px'
        }}
        items={section.children.map(child => ({
          key: child.path,
          icon: child.icon,
          label: child.label,
          onClick: () => navigate(child.path),
          style: {
            margin: '4px 0',
            borderRadius: '4px',
            height: '40px',
            lineHeight: '40px'
          }
        }))}
      />
    </Sider>
  );
};
```

---

## 五、样式细节

### 1. 左上角菜单按钮

```javascript
<Button
  type="text"
  icon={<MenuOutlined />}
  size="large"
  style={{
    width: '40px',
    height: '40px',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#262626'
  }}
  onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
  onMouseLeave={(e) => e.target.style.background = 'transparent'}
/>
```

### 2. 抽屉样式

```css
.global-menu-drawer .ant-drawer-body {
  padding: 0;
  background: #ffffff;
}

.menu-section-item:hover,
.menu-child-item:hover {
  background: #f5f5f5;
}

.menu-child-item::before {
  content: '•';
  margin-right: 8px;
  color: #d9d9d9;
}
```

### 3. 上下文侧边栏

```css
.contextual-sidebar .ant-menu-item-selected {
  background: #e6f4ff !important;
  color: #1677ff !important;
  border-left: 3px solid #1677ff;
}

.contextual-sidebar .ant-menu-item {
  padding-left: 20px !important;
}
```

### 4. 内容区域动画

```css
.main-content {
  margin-left: 0;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content.with-sidebar {
  margin-left: 200px;
}
```

---

## 六、状态管理

### localStorage 存储

```javascript
// 记住用户最后选择的一级菜单
const STORAGE_KEY = 'currentSection';

// 保存
const saveCurrentSection = (section) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(section));
};

// 读取
const loadCurrentSection = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
};

// 初始化时恢复状态
useEffect(() => {
  const section = loadCurrentSection();
  if (section) {
    setCurrentSection(section);
  }
}, []);
```

### 根据路由自动推断当前Section

```javascript
// 根据当前路由路径，推断应该显示哪个一级菜单
const inferSectionFromPath = (pathname) => {
  for (const section of menuConfig) {
    if (section.children) {
      const matched = section.children.find(child => 
        pathname.startsWith(child.path)
      );
      if (matched) return section;
    } else if (section.path === pathname) {
      return null;  // 无侧边栏
    }
  }
  return null;
};

// 路由变化时自动更新侧边栏
useEffect(() => {
  const section = inferSectionFromPath(location.pathname);
  setCurrentSection(section);
}, [location.pathname]);
```

---

## 七、响应式设计

### 移动端适配

```javascript
const isMobile = useMediaQuery({ maxWidth: 768 });

return (
  <>
    {/* 移动端：全屏抽屉 */}
    <Drawer
      placement="left"
      width={isMobile ? '100%' : 320}
      visible={drawerVisible}
      onClose={onClose}
    />
    
    {/* 移动端：侧边栏改为底部抽屉 */}
    {isMobile && currentSection ? (
      <Drawer
        placement="bottom"
        height="50%"
        visible={!!currentSection}
        onClose={() => setCurrentSection(null)}
      >
        {/* 子菜单 */}
      </Drawer>
    ) : (
      <ContextualSidebar section={currentSection} />
    )}
  </>
);
```

---

## 八、优势总结

### ✅ 相比传统侧边栏的优势

1. **空间利用率高**
   - 默认隐藏，内容区域更宽
   - 适合数据展示型应用

2. **上下文清晰**
   - 侧边栏只显示相关子菜单
   - 避免菜单混乱

3. **快速切换**
   - 抽屉中一目了然所有功能
   - 支持搜索快速定位

4. **现代化体验**
   - 符合Notion、Figma等现代应用的交互习惯
   - 动画流畅，视觉愉悦

### ✅ 相比完全隐藏侧边栏的优势

1. **保留导航便利性**
   - 进入某个功能后，侧边栏常驻
   - 在子功能间切换无需重新打开抽屉

2. **视觉连贯性**
   - 用户知道自己在哪个功能模块
   - 侧边栏标题提示当前上下文

---

## 九、实现优先级

### Phase 1：基础框架（2天）
- [ ] 重构 MainLayout 组件
- [ ] 实现 GlobalMenuDrawer 抽屉
- [ ] 实现 ContextualSidebar 侧边栏
- [ ] 状态管理和路由联动

### Phase 2：交互优化（1天）
- [ ] 添加动画过渡
- [ ] 实现搜索功能
- [ ] localStorage 状态持久化
- [ ] 响应式适配

### Phase 3：细节打磨（0.5天）
- [ ] 样式优化和统一
- [ ] 图标调整
- [ ] Hover/Active 效果
- [ ] 边缘情况处理

---

## 十、关键代码示例

### 完整的 MainLayout 逻辑

```javascript
import React, { useState, useEffect } from 'react';
import { Layout, Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import GlobalMenuDrawer from './GlobalMenuDrawer';
import ContextualSidebar from './ContextualSidebar';
import { menuConfig } from './menuConfig';

const { Header, Content } = Layout;
const STORAGE_KEY = 'currentSection';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSection, setCurrentSection] = useState(() => {
    // 初始化时从 localStorage 恢复
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
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        borderBottom: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setDrawerVisible(true)}
          style={{ fontSize: '18px' }}
        />
        <div style={{ fontSize: '18px', fontWeight: '600' }}>
          MesaLogo
        </div>
        {/* 其他Header内容 */}
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
        marginTop: 64,  // Header高度
        marginLeft: currentSection?.children ? 200 : 0,
        padding: '24px',
        transition: 'margin-left 0.3s',
        minHeight: 'calc(100vh - 64px)'
      }}>
        {children}
      </Content>
    </Layout>
  );
};

export default MainLayout;
```

---

需要我开始实现这个方案吗？
