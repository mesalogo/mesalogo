# 多列菜单详细设计补充

## 一、多列布局优势

### ✅ 相比单列的优势
1. **一屏展示更多内容**：减少滚动，提升浏览效率
2. **视觉分组更清晰**：通过列标题明确功能分类
3. **空间利用率高**：宽屏显示更充分
4. **更快找到目标**：类似报纸/杂志的扫描式阅读

### 📐 布局规划

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      搜索栏
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────┬──────────┬──────────┬──────────┐
│  核心功能  │  资源管理  │  配置运维  │  快捷入口  │ ← 列标题
├──────────┼──────────┼──────────┼──────────┤
│          │          │          │          │
│ 5个一级  │ 3个一级  │ 1个一级  │ 2个特殊  │
│ 菜单     │ 菜单     │ 菜单     │ 区域     │
│          │          │          │          │
│ 15个二级 │ 6个二级  │ 7个二级  │ 收藏+    │
│ 菜单     │ 菜单     │ 菜单     │ 最近访问  │
│          │          │          │          │
└──────────┴──────────┴──────────┴──────────┘
  25% 宽    25% 宽     25% 宽     25% 宽
```

---

## 二、响应式布局

### 1. 不同屏幕宽度的列数

```javascript
const getColumnCount = () => {
  const width = window.innerWidth;
  if (width >= 1400) return 4;      // 大屏：4列
  if (width >= 1024) return 3;      // 中屏：3列（去掉"快捷入口"）
  if (width >= 768) return 2;       // 平板：2列（核心+配置）
  return 1;                         // 手机：1列（回到传统抽屉）
};

// 动态调整
<div style={{
  display: 'grid',
  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
  gap: '24px'
}}>
```

### 2. 移动端优化

```javascript
// 小屏幕回退到传统抽屉模式
const isMobile = useMediaQuery({ maxWidth: 768 });

return isMobile ? (
  <Drawer placement="left" width={320}>
    {/* 传统单列菜单 */}
  </Drawer>
) : (
  <Drawer placement="top" height="auto">
    {/* 多列网格菜单 */}
  </Drawer>
);
```

---

## 三、搜索功能优化

### 1. 实时搜索

```javascript
const [searchText, setSearchText] = useState('');

// 搜索逻辑：匹配一级、二级菜单
const filterMenus = (sections, searchText) => {
  if (!searchText) return sections;
  
  return sections.map(section => {
    // 一级菜单匹配
    if (section.label.toLowerCase().includes(searchText.toLowerCase())) {
      return section;
    }
    
    // 二级菜单匹配
    if (section.children) {
      const matchedChildren = section.children.filter(child =>
        child.label.toLowerCase().includes(searchText.toLowerCase())
      );
      
      if (matchedChildren.length > 0) {
        return { ...section, children: matchedChildren };
      }
    }
    
    return null;
  }).filter(Boolean);
};
```

### 2. 搜索高亮

```javascript
const HighlightText = ({ text, highlight }) => {
  if (!highlight) return <span>{text}</span>;
  
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} style={{ background: '#fff566', fontWeight: '600' }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

// 使用
<span>{child.label}</span>
// 改为
<HighlightText text={child.label} highlight={searchText} />
```

### 3. 搜索快捷键

```javascript
// 支持 ESC 关闭
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  if (visible) {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }
}, [visible, onClose]);

// 支持 Enter 跳转到第一个结果
const handleSearchEnter = (e) => {
  if (e.key === 'Enter') {
    const firstResult = getFirstSearchResult();
    if (firstResult) {
      onSelect(firstResult.section, firstResult.child);
    }
  }
};
```

---

## 四、快捷入口（第4列）

### 1. 收藏功能

```javascript
// localStorage 存储收藏
const FAVORITES_KEY = 'menu_favorites';

const getFavorites = () => {
  const stored = localStorage.getItem(FAVORITES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const addToFavorites = (menuItem) => {
  const favorites = getFavorites();
  if (!favorites.find(f => f.key === menuItem.key)) {
    favorites.push({
      key: menuItem.key,
      label: menuItem.label,
      path: menuItem.path,
      icon: menuItem.icon
    });
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }
};

const removeFromFavorites = (key) => {
  const favorites = getFavorites().filter(f => f.key !== key);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
};

// 菜单项右键或长按显示"添加到收藏"
<div
  onContextMenu={(e) => {
    e.preventDefault();
    showContextMenu(e, [
      { label: '添加到收藏', onClick: () => addToFavorites(menuItem) }
    ]);
  }}
>
```

### 2. 最近访问

```javascript
// localStorage 存储最近访问
const RECENT_KEY = 'menu_recent_visited';
const MAX_RECENT = 5;

const getRecentVisited = () => {
  const stored = localStorage.getItem(RECENT_KEY);
  return stored ? JSON.parse(stored) : [];
};

const addToRecent = (menuItem) => {
  let recent = getRecentVisited();
  
  // 去重
  recent = recent.filter(r => r.path !== menuItem.path);
  
  // 添加到开头
  recent.unshift({
    key: menuItem.key,
    label: menuItem.label,
    path: menuItem.path,
    icon: menuItem.icon,
    timestamp: Date.now()
  });
  
  // 限制数量
  recent = recent.slice(0, MAX_RECENT);
  
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
};

// 每次导航时记录
const handleMenuSelect = (section, item) => {
  if (item.path) {
    addToRecent(item);
    navigate(item.path);
  }
};
```

### 3. 快捷入口UI

```javascript
// 第4列特殊渲染
const ShortcutColumn = () => {
  const favorites = getFavorites();
  const recent = getRecentVisited();
  
  return (
    <div className="menu-column">
      <div className="column-title">快捷入口</div>
      
      {/* 收藏的功能 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <StarOutlined style={{ color: '#faad14' }} />
          <span>收藏的功能</span>
        </div>
        
        {favorites.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#8c8c8c', padding: '8px 12px' }}>
            右键菜单添加收藏
          </div>
        ) : (
          favorites.map(item => (
            <div
              key={item.key}
              className="menu-child-item"
              onClick={() => navigate(item.path)}
              style={{ padding: '6px 12px' }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <CloseOutlined 
                style={{ marginLeft: 'auto', fontSize: '10px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromFavorites(item.key);
                }}
              />
            </div>
          ))
        )}
      </div>
      
      {/* 最近访问 */}
      <div>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ClockCircleOutlined style={{ color: '#1677ff' }} />
          <span>最近访问</span>
        </div>
        
        {recent.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#8c8c8c', padding: '8px 12px' }}>
            暂无访问记录
          </div>
        ) : (
          recent.map(item => (
            <div
              key={item.key}
              className="menu-child-item"
              onClick={() => navigate(item.path)}
              style={{ 
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <span style={{ 
                marginLeft: 'auto', 
                fontSize: '10px', 
                color: '#8c8c8c' 
              }}>
                {formatTimeAgo(item.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 时间格式化
const formatTimeAgo = (timestamp) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};
```

---

## 五、样式细节

### 1. 列间分隔线

```css
.menu-column:not(:last-child) {
  border-right: 1px solid #f0f0f0;
  padding-right: 24px;
}

.menu-column:not(:first-child) {
  padding-left: 24px;
}
```

### 2. Hover 效果

```css
.menu-child-item {
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-child-item:hover {
  background: #f0f0f0;
  color: #1677ff;
  padding-left: 44px !important;
}

.menu-child-item:hover::before {
  content: '→';
  position: absolute;
  left: 20px;
  color: #1677ff;
  font-weight: bold;
}
```

### 3. 空状态

```javascript
// 搜索无结果
{filteredColumns.every(col => col.sections.length === 0) && (
  <div style={{
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    color: '#8c8c8c'
  }}>
    <SearchOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
    <div style={{ fontSize: '16px', marginBottom: '8px' }}>
      未找到匹配的功能
    </div>
    <div style={{ fontSize: '14px' }}>
      尝试使用其他关键词搜索
    </div>
  </div>
)}
```

---

## 六、动画效果

### 1. 抽屉弹出动画

```css
@keyframes slideDown {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.global-menu-drawer .ant-drawer-content {
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 2. 菜单项渐显

```css
.menu-column {
  animation: fadeIn 0.4s ease-out;
  animation-fill-mode: both;
}

.menu-column:nth-child(1) { animation-delay: 0.05s; }
.menu-column:nth-child(2) { animation-delay: 0.1s; }
.menu-column:nth-child(3) { animation-delay: 0.15s; }
.menu-column:nth-child(4) { animation-delay: 0.2s; }

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3. 搜索结果过渡

```css
.menu-section-children {
  transition: max-height 0.3s ease-out, opacity 0.2s ease-out;
  overflow: hidden;
}

.menu-section-children.hidden {
  max-height: 0;
  opacity: 0;
}
```

---

## 七、可访问性（Accessibility）

### 1. 键盘导航

```javascript
const [focusedIndex, setFocusedIndex] = useState(0);

const handleKeyDown = (e) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, menuItems.length - 1));
      break;
    
    case 'ArrowUp':
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
      break;
    
    case 'ArrowRight':
      // 移动到下一列
      break;
    
    case 'ArrowLeft':
      // 移动到上一列
      break;
    
    case 'Enter':
      // 选择当前焦点项
      handleSelect(menuItems[focusedIndex]);
      break;
  }
};
```

### 2. ARIA 属性

```jsx
<div
  role="navigation"
  aria-label="主菜单"
  className="global-menu"
>
  <input
    role="searchbox"
    aria-label="搜索功能"
    placeholder="搜索功能..."
  />
  
  <div role="menu">
    {menuColumns.map(column => (
      <div key={column.title} role="group" aria-label={column.title}>
        {column.sections.map(section => (
          <div
            role="menuitem"
            aria-label={section.label}
            tabIndex={0}
            onClick={() => handleSelect(section)}
          >
            {section.label}
          </div>
        ))}
      </div>
    ))}
  </div>
</div>
```

---

## 八、性能优化

### 1. 虚拟滚动（如果菜单项很多）

```javascript
import { FixedSizeList } from 'react-window';

// 仅在某列菜单项超过20个时使用
{column.sections.length > 20 ? (
  <FixedSizeList
    height={500}
    itemCount={column.sections.length}
    itemSize={40}
  >
    {({ index, style }) => (
      <div style={style}>
        <MenuColumn section={column.sections[index]} />
      </div>
    )}
  </FixedSizeList>
) : (
  column.sections.map(section => <MenuColumn section={section} />)
)}
```

### 2. 懒加载

```javascript
// 抽屉打开时才渲染内容
const GlobalMenuDrawer = ({ visible, onClose }) => {
  const [shouldRender, setShouldRender] = useState(false);
  
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    }
  }, [visible]);
  
  if (!shouldRender) return null;
  
  return (
    <Drawer visible={visible} onClose={onClose}>
      {/* 菜单内容 */}
    </Drawer>
  );
};
```

### 3. Memo 优化

```javascript
const MenuColumn = React.memo(({ section, onSelect, searchText }) => {
  // ... 组件实现
}, (prevProps, nextProps) => {
  return (
    prevProps.section.key === nextProps.section.key &&
    prevProps.searchText === nextProps.searchText
  );
});
```

---

## 九、实现 Checklist

### Phase 1: 基础多列布局 ✅
- [x] 4列网格布局
- [x] 列标题设计
- [x] 一级、二级菜单渲染
- [x] Drawer 从顶部弹出

### Phase 2: 交互功能 ⏳
- [ ] 搜索功能
- [ ] 搜索高亮
- [ ] ESC 关闭
- [ ] 点击选择跳转

### Phase 3: 快捷入口 ⏳
- [ ] 收藏功能
- [ ] 最近访问
- [ ] localStorage 持久化

### Phase 4: 样式优化 ⏳
- [ ] Hover 动画
- [ ] 列间分隔线
- [ ] 空状态设计
- [ ] 抽屉弹出动画

### Phase 5: 响应式 ⏳
- [ ] 大屏4列
- [ ] 中屏3列
- [ ] 平板2列
- [ ] 手机单列

### Phase 6: 可访问性 ⏳
- [ ] 键盘导航
- [ ] ARIA 属性
- [ ] 焦点管理

---

## 十、与单列对比

| 特性 | 单列抽屉 | 多列抽屉 |
|------|---------|---------|
| 宽度 | 320px | 900-1200px |
| 滚动 | 需要大量滚动 | 基本一屏展示 |
| 查找 | 逐个展开 | 一目了然 |
| 分组 | 折叠式 | 列式分组 |
| 空间利用 | 低 | 高 |
| 移动端 | 友好 | 需适配 |
| 视觉清晰度 | 中 | 高 |

**推荐**：桌面端使用多列，移动端回退到单列。
