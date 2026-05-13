# 09 — UI 设计

> 本文是 MemoryPalace v0.51 前端设计的完整说明。
> 阅读对象:开始动手做前端的开发者(P4 阶段)。
> 配套阅读:`05-PR4-adapter-frontend.md`(P4 PR 的范围与验收)。

---

## 0. 设计目标

让**三类用户**都能用对:

| 用户 | 诉求 | 答复 |
|---|---|---|
| **使用者**(对话中) | "Agent 是不是记住了我说过的话?" | 对话浮层 + 记忆指示器 |
| **管理者**(日常) | "我的项目里 Agent 学到了什么?有没有错的?" | 主页三栏 + KG 视图 |
| **运维者**(排错时) | "为什么 Agent 没召回这条?" | KG Timeline + 详情面板 |

→ **三个入口、三层深度**:浮层(轻) / 主页(中) / KG 视图(深)。

---

## 1. 主页面布局(三栏)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  Memory Palace · ProjectX                              [⌕ Search...    ⌘K] ║
╠════════════════════╦═════════════════════════════════════════════════════════╣
║                    ║                                                         ║
║  WINGS (3)         ║   📍 ProjectX  ›  Database  ›  Index Design             ║
║  ▾ ProjectX  ⭐    ║  ┌────────────────────────────────────────────────────┐ ║
║    └ Database      ║  │ Room: Index Design                                │ ║
║      ▸ Index Design║  │ 12 drawers · 3 closets · last visited 2h ago     │ ║
║      ▸ Migration   ║  │                                                  │ ║
║    └ Customer Pref ║  │ ┌─[CLOSETS]──────┐  ┌─[DRAWERS]────────────────┐│ ║
║      ▸ Coffee      ║  │ │• B-tree vs LSM │  │ #1234  💬 user msg       ││ ║
║      ▸ Schedule    ║  │ │  → drawer 1234 │  │   "我们应该用 B+ 树..."   ││ ║
║                    ║  │ │  → drawer 1241 │  │   ⚠ KG: stale            ││ ║
║  ▸ ProjectY        ║  │ │                │  │   ★★★★☆  3天前            ││ ║
║                    ║  │ │• Write amp     │  │ ─────────────────────── ││ ║
║  ▸ Customer Service║  │ │  → drawer 1238 │  │ #1241  💡 reflection      ││ ║
║                    ║  │ │                │  │   "结论:LSM 适合..."      ││ ║
║                    ║  │ │• Index size    │  │   ✓ KG: ok                ││ ║
║  ─────────         ║  │ │  → drawer 1245 │  │   ★★★★★  反思条目          ││ ║
║  KB MOUNTS (2)     ║  │ └────────────────┘  └──────────────────────────┘│ ║
║  📚 产品手册       ║  │                                                  │ ║
║  📚 法规文档       ║  │ ┌─[TUNNELS]─────────────────────────────────────┐│ ║
║                    ║  │ │ → ProjectY · Database (passive, 同名)          ││ ║
║  ─────────         ║  │ │ → ProjectZ · API Decisions (active, by Agent3)││ ║
║  ACTIONS           ║  │ └────────────────────────────────────────────────┘│ ║
║  + Reflect Now     ║  └────────────────────────────────────────────────────┘ ║
║  ⚙ Wing Settings   ║                                                         ║
╚════════════════════╩═════════════════════════════════════════════════════════╝
```

### 1.1 左栏:Wing 导航树

| 元素 | 说明 |
|---|---|
| Wing 名称 | 主标识 |
| Scope 徽标 | `[Space]` `[Role]` `[Agent]` `[Global]` 用不同颜色 |
| ⭐ 标记 | 当前 ActionSpace 对应的 Wing |
| 展开/折叠 | Hall 和 Room 是 ▾ ▸ 树形 |
| KB Mounts 区 | 单独分组,只读图标 📚 |
| Actions 区 | 全局操作:Reflect / Wing Settings |

**用 Antd Tree 实现**,可拖拽(P4 不做,留给 v0.6)。

### 1.2 中栏:Room 详情(主工作区)

#### 1.2.1 顶部面包屑
```
📍 ProjectX  ›  Database  ›  Index Design
```
可点击跳转任意上层。

#### 1.2.2 Room 元信息行
```
12 drawers · 3 closets · last visited 2h ago
```

#### 1.2.3 双栏:Closets (1/3) | Drawers (2/3)

**Closets 列**(粗检索引):
- 每行 = 一个 closet line:`topic | entities | → drawer_ids`
- 点击 closet line → 中栏右侧 Drawer 列表自动过滤到对应 drawer_ids
- 让用户**直观看到"Closet 是 Drawer 的目录页"**

**Drawers 列**(原文):
- 每条 drawer 显示:
  - 类型图标(💬/🔧/📝/💡/📚)
  - 一句话预览(content 前 60 字符)
  - KG 状态徽标(✓/⚠/✗,unknown 不显示)
  - 重要度 ★★★★☆(基于 importance 字段)
  - 时间("3 天前"友好显示)
- 点击 → 弹出 Drawer 详情 Drawer(见 §2)

#### 1.2.4 底部:Tunnels 列表

```
[TUNNELS]
→ ProjectY · Database (passive, 同名)
→ ProjectZ · API Decisions (active, by Agent3)
```

- `passive`:系统自动发现的同名 Room
- `active`:Agent 显式 create_tunnel 创建
- 点击 → 跳转到目标 Room

### 1.3 右栏:**默认隐藏**,可手动展开

P4 阶段右栏其实不需要——所有内容已经在中栏底部。
**保留位置**给 v0.6+(可能放 Diary 时间线、当前 recall 上下文等)。

---

## 2. Drawer 详情 Drawer(详情抽屉,Antd Drawer)

```
╔══════════════════════════════════════════════════════════════════════╗
║  Drawer #1234                                            [Edit] [×] ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  💬 message · created 3 days ago · last recalled 2h ago              ║
║                                                                      ║
║  ┌─[CONTENT]──────────────────── verbatim, read-only ────────────┐  ║
║  │                                                                │  ║
║  │  我老婆叫李四,生日是 1990 年 5 月 12 日。                       │  ║
║  │                                                                │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  ⚠ KG STATUS: stale  (点击查看原因 ▾)                                ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │ 此 Drawer 中 "用户 → 配偶 → 李四" 这条事实已于 2026-08-15 失效  │  ║
║  │ 当前 current 三元组:用户 → 前配偶 → 李四 (since 2026-08-15)    │  ║
║  │ 来源:Drawer #2891 (reflection)                                 │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  ─── METADATA ──────────────────────────────────────────────────     ║
║                                                                      ║
║  Wing       │ ProjectX (space)                                       ║
║  Room       │ Customer Profile / 用户A                               ║
║  Importance │ ●●●●○  0.62                                            ║
║  Decay      │ active  (next decay job: in 4h)                        ║
║  Recall ×   │ 7 times (last: 2h ago by Agent3)                       ║
║  Entities   │ [李四] [用户A] [生日]                                  ║
║  Source     │ message #5678 in conversation #99                      ║
║                                                                      ║
║  ─── ACTIONS ───────────────────────────────────────────────────     ║
║                                                                      ║
║  [📝 Add Note]  [🚫 Forget]  [⚓ Pin Importance]  [🔗 View Source]   ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.1 关键设计:解释"为什么"

**不只是显示 stale,而是展开后告诉用户为什么 stale**——这是建立信任的关键:

```
"用户 → 配偶 → 李四" 已于 2026-08-15 失效
当前 current 三元组:用户 → 前配偶 → 李四 (since 2026-08-15)
来源:Drawer #2891 (reflection)
```

用户从"红黄标看到害怕"变成"原来系统识别到了改变",立刻放心。

### 2.2 不允许编辑 content

按 D0 决策,**Drawer.content 是 verbatim 不可改的**。
要"修正"只能:
- `📝 Add Note`:加一条新的 note 类型 drawer 关联到这条
- `⚓ Pin Importance`:锁定 importance(不参与 decay)
- `🚫 Forget`:软删除(进 archived;hard delete 需 supervisor)

### 2.3 Action 权限

| 按钮 | 用户 | Supervisor |
|---|---|---|
| 📝 Add Note | ✓ | ✓ |
| 🚫 Forget(soft) | ✓ | ✓ |
| 🚫 Hard Delete | ✗ | ✓ |
| ⚓ Pin Importance | ✓ | ✓ |
| 🔗 View Source | ✓ | ✓ |
| Edit content | ✗ | ✗(谁都不能) |

---

## 3. 对话页面的"记忆指示器" + 浮层

使用者最常见的场景。

```
╔══════════════════════════════════════════════════════════════════════════╗
║  Conversation · ProjectX · Agent3       💭 3 memories used  [📚 Open...] ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                       ┃ Memory Drawer    ║
║  User: 用户A 上次问的咖啡问题怎么样了?                ┃ ─────────────── ║
║                                                       ┃                  ║
║  Agent: [💭 recalling memories...]                    ┃ Recently used:   ║
║                                                       ┃ • #1234 用户A 喜 ║
║  Agent: 上次他说想试试拿铁,我推荐了几款。             ┃   欢拿铁(💬 5d) ║
║                                                       ┃ • #2891 反思:用 ║
║  User: 那他喜欢拿铁吗?                                ┃   户A 偏好稳定  ║
║                                                       ┃   (💡 3d)       ║
║  Agent: [💭 recalling...] 是的,根据 3 天前他自        ┃ • #3041 KB:拿铁 ║
║  己说的"我喜欢拿铁,不加糖",还有反思条目里关于他      ┃   = espresso... ║
║  饮品偏好稳定的总结。                                 ┃   (📚 KB)       ║
║                                                       ┃                  ║
║  ────────────────────────────────                     ┃ [+ Recall...]    ║
║  [输入消息...]                              [Send]    ┃ [+ Remember...]  ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 3.1 顶部"记忆指示器"

```
💭 3 memories used
```

**始终显示当前对话已用的记忆数**(已锁定决策 D6)。

- 数字 = 整个对话累计 recall 命中数 + remember 写入数
- 点击 → 高亮右侧抽屉里对应的记忆条目
- 0 时也显示 "💭 0 memories",不隐藏(让用户知道功能存在)

### 3.2 右侧抽屉(默认折叠,可一键展开)

- 默认折叠,不抢对话空间
- 点击 [📚 Open...] 展开,宽度可拖动
- 抽屉内容**只显示本对话相关**的记忆:
  - 这一轮被 recall 的(标 "used in this turn")
  - 这一轮被 remember 的(标 "saved in this turn")
  - 历史本对话用过的(折叠区,展开看)
- 不显示无关记忆 → 不会信息过载

### 3.3 抽屉底部快捷操作

| 按钮 | 作用 |
|---|---|
| [+ Recall...] | 弹出搜索框,手动 recall(把结果塞进当前 prompt) |
| [+ Remember...] | 弹出输入框,手动 remember(显式记一条) |

让用户**对记忆有掌控感**——不只是"系统决定记什么",还能主动指挥。

---

## 4. ActionSpace 创建表单(Wing 配置)

第一次接触 MemoryPalace 的地方,**0 学习成本是关键**。

```
╔════════════════════════════════════════════════════════════╗
║  Create Action Space                                       ║
╠════════════════════════════════════════════════════════════╣
║  Name        [ProjectX_____________________]               ║
║  Description [...                          ]               ║
║                                                            ║
║  ── Memory ────────────────────────────────────────        ║
║                                                            ║
║  Wing Scope ⓘ                                              ║
║  这个空间内的 Agent 怎么共享记忆?                          ║
║                                                            ║
║  ◉ Space    │ 同空间所有 Agent 共享一座 Wing  (推荐)       ║
║  ○ Role     │ 同角色共享(如"客服"角色统一记忆)            ║
║  ○ Agent    │ 每个 Agent 独享(强隔离)                     ║
║  ○ Global   │ 整个租户共享(适合通用助手)                  ║
║                                                            ║
║  ⚠ 创建后不可修改(避免数据迁移)。如需切换请新建空间。     ║
║                                                            ║
║  Reflection ⓘ                                              ║
║  Agent 在任务结束时是否自动反思?                           ║
║  ◉ Per task   ○ Manual only   ○ Disabled                   ║
║                                                            ║
║  KB Mounts ⓘ (Optional)                                    ║
║  挂载哪些知识库到这座 Wing?(只读)                         ║
║  □ 产品手册                                                ║
║  □ 法规文档                                                ║
║  □ 内部 wiki                                               ║
║                                                            ║
║                              [Cancel]  [Create]            ║
╚════════════════════════════════════════════════════════════╝
```

### 4.1 英文术语 + 中文 tooltip(D5 决策的体现)

每个英文术语后带 ⓘ,hover 弹中文一句话解释:

```
Wing Scope ⓘ
─────────────────────────
"Wing" 是一座独立的记忆"院子"。
作用域决定了谁共享这座院子。
```

```
Reflection ⓘ
─────────────────────────
任务结束时让 Agent 自动总结经验,
产出反思条目存入记忆。会消耗 LLM token。
```

---

## 5. Knowledge Graph 视图(独立菜单)

**KG 视图作为独立菜单项**(已锁定决策 D6),管理者一眼能看到。

### 5.1 入口

```
左侧主菜单:
  📁 Action Spaces
  💬 Conversations
  📚 Knowledge Bases
  🧠 Memory Palace
  ➕ Knowledge Graph    ← 单独菜单项
  ⚙ Settings
```

### 5.2 表格视图(默认)

```
╔══════════════════════════════════════════════════════════════════╗
║  Knowledge Graph · ProjectX                                      ║
╠══════════════════════════════════════════════════════════════════╣
║  ⌕ Subject [用户A_______________________]   [search]             ║
║  Filter: ◉ All  ○ Current only  ○ Stale only                     ║
║                                                                  ║
║  Subject: 用户A                                                  ║
║                                                                  ║
║  ── Current Facts (current=true) ────────────────────────────    ║
║                                                                  ║
║  predicate    object        valid_from    source                 ║
║  ─────────    ────────      ──────────    ───────────────       ║
║  前配偶       李四          2026-08-15    drawer #2891 (refl.)  ║
║  生日         1990-05-12    2026-04-20    drawer #1234 (msg)    ║
║  喜欢饮品     拿铁          2026-04-15    drawer #1108 (msg)    ║
║  健康标签     糖尿病        2025-11-23    drawer #0871 (msg)    ║
║                                                                  ║
║  ── Historical Facts (current=false) ───────────────────────     ║
║                                                                  ║
║  predicate    object        valid_from    valid_to    source     ║
║  ─────────    ────────      ──────────    ─────────   ────────  ║
║  配偶         李四          2024-03-01    2026-08-15  drawer 871 ║
║  喜欢饮品     美式          2024-05      2026-04-15  drawer 109 ║
║                                                                  ║
║  [📊 Timeline View]  [🔍 Find Contradictions]  [📥 Export]       ║
╚══════════════════════════════════════════════════════════════════╝
```

### 5.3 ⭐ Timeline View(P4 实现,锁定决策 D6)

点 [📊 Timeline View] 切换为时间轴可视化:

```
用户A 的事实时间轴
═════════════════════════════════════════════════════════════
2024  ────●─────────────────●──────────────────────────────
       配偶=李四          喜欢饮品=美式
                                      ↓
2025  ──────────●──────────────────────────────────────────
              健康标签=糖尿病
                                                  ↓
2026  ─────────────────●───────────●───────●─────────────●
                    喜欢饮品改为   生日=    配偶变前       现在
                    拿铁         1990-05-12 配偶
═════════════════════════════════════════════════════════════
                                                  ↑ today
```

**这是"时态 KG"的视觉招牌**——让用户直观看到"事实是会变的"。

技术选型:**SVG 自实现** 或 `vis-timeline` 库(<100KB,轻量)。
P4 阶段实现,作为 demo 时的杀手锏。

### 5.4 Find Contradictions

点 [🔍 Find Contradictions] 列出当前所有 stale / contradicted 的 drawer,
让管理者批量审查 / 修正。

### 5.5 Export

点 [📥 Export] 导出当前 subject 的所有事实为 JSON / CSV,
便于做客户报告或外部分析。

---

## 6. 全局搜索(`⌘K / Ctrl+K`)

```
╔══════════════════════════════════════════════════════════════════╗
║  ⌕  search...                                            [esc]   ║
║  ─────────────────────────────────────────────────────────────   ║
║                                                                  ║
║  📁 Wings                                                        ║
║    ProjectX (space)                                              ║
║    ProjectY (space)                                              ║
║                                                                  ║
║  🏠 Rooms                                                        ║
║    Index Design (in ProjectX/Database)                           ║
║                                                                  ║
║  📑 Drawers                                                      ║
║    "我们应该用 B+ 树..."  (3d ago)                               ║
║    "结论:LSM 适合..."     (3d ago, reflection)                   ║
║                                                                  ║
║  ⚡ Actions                                                       ║
║    > Remember new fact...                                        ║
║    > Reflect on current task                                     ║
║    > Create tunnel...                                            ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

- 顶部 ⌘K 唤起
- 搜 Drawer 内容(走 recall API,带 hybrid)
- 跳到 Wing / Room
- 命令式操作(`> remember`, `> reflect`, `> create tunnel`)

技术选型:**`cmdk` 库**(轻量,React 友好)。

---

## 7. 颜色 / 视觉语言(全局一致)

### 7.1 颜色表

| 颜色 | 含义 | 例 |
|---|---|---|
| 🟢 绿 | KG ok / active / 主对话 | KG 徽标 ✓ |
| 🟡 黄 | KG stale / fading / 警告 | KG 徽标 ⚠ |
| 🔴 红 | KG contradicted / 错误 / forget | KG 徽标 ✗ |
| 🔵 蓝 | KB document / 只读 | KB Wing 标 |
| 🟣 紫 | reflection / Diary | 反思条目 |
| ⚫ 灰 | archived / unknown | 已归档 |

### 7.2 类型图标

| 图标 | 类型 |
|---|---|
| 💬 | message |
| 🔧 | tool_result |
| 📝 | note |
| 💡 | reflection |
| 📚 | document(KB) |

### 7.3 重要度(★)

```
★★★★★  importance >= 0.9
★★★★☆  importance >= 0.7
★★★☆☆  importance >= 0.5  (默认)
★★☆☆☆  importance >= 0.3
★☆☆☆☆  importance < 0.3
```

不显示具体数字(避免数字焦虑),hover 才显示 0.62 这种。

---

## 8. 全局原则(贯穿所有页面)

### 8.1 不打扰

- 默认 KG 状态只在 hover 或详情显示
- 默认 importance 用 ★ 不用数字
- 默认右抽屉折叠
- 复杂功能放二级菜单

**让"小白用户" = "随便用,啥都不用配"**。

### 8.2 失败优雅降级

| 情况 | 表现 |
|---|---|
| Milvus 挂了 | "向量检索暂不可用,使用 BM25 fallback" 横幅 + 仍能搜 |
| KG 服务挂了 | KG 徽标全显示灰色 unknown,不影响主功能 |
| LightRAG/KB 挂了 | KB 区域显示离线图标,主 Wing 正常 |
| 没有任何 Drawer | 不是空白,显示引导卡片 "调用一次 remember 试试" |

### 8.3 移动端策略

**桌面优先,移动端只保留**:
- 对话页面的"记忆指示器" + 简化抽屉
- 全局搜索

主页面三栏不强行做响应式(屏小自动隐藏右栏)。

### 8.4 国际化

按 D5 决策:**英文术语,中文 tooltip**。
不做完整 i18n(避免双倍工作量)。

---

## 9. 技术栈(对齐项目已有)

| 组件 | 用啥 |
|---|---|
| 整体 | React 19 + Antd 6(已有) |
| Wing 树 | `Antd Tree` |
| 主页 Drawer 列表 | `Antd List` + `@tanstack/react-virtual`(虚拟滚动) |
| Drawer 详情 | `Antd Drawer`(抽屉组件,与术语 Drawer 同名,代码命名注意区分:`DrawerPanel` vs `MemoryDrawer`) |
| Timeline | `vis-timeline` 或 SVG 自实现 |
| 全局搜索 | `cmdk` |
| KG 关系图(可选) | `@xyflow/react`(已有) |
| 状态管理 | 现有项目已用的(zustand/redux 看实际) |

**新增依赖估算**:`cmdk`(~30KB)+ `vis-timeline`(~80KB),共 ~110KB。可接受。

---

## 10. P4 PR 实施分阶段

P4 阶段建议分 4 个 commit(同 PR 内),每个独立可 review:

| Commit | 内容 | 工时估算 |
|---|---|---|
| **C1** 三栏主页骨架 | Wing 树 + Room 详情 + 路由 + 数据接入 | 1.5 天 |
| **C2** Drawer 详情面板 | 详情抽屉 + KG 状态展开 + Action 按钮 | 1 天 |
| **C3** 对话浮层 + 表单 | 记忆指示器 + 右抽屉 + ActionSpace 表单 + 全局搜索 | 1.5 天 |
| **C4** KG 视图 + Timeline | 独立菜单 + 表格 + Timeline + Export | 1.5 天 |

合计:**5.5 天**(对齐 `05-PR4-adapter-frontend.md` 的"3-5 天"估算,稍超是因为加了 Timeline)。

---

## 11. 验收标准(给 reviewer 用)

- [ ] 三栏主页:Wing 树切换流畅,Room 详情数据正确
- [ ] Drawer 详情:KG 状态展开能解释清楚 stale/contradicted 原因
- [ ] 对话浮层:`💭 N memories used` 实时更新,点击展开抽屉无卡顿
- [ ] ActionSpace 表单:每个英文术语都有 ⓘ tooltip
- [ ] KG 视图:能切换表格/Timeline,Timeline 视觉可读
- [ ] 全局搜索:`⌘K` 能 0.5 秒内打开,搜 Drawer 走 recall API
- [ ] Antd 主题与项目其他页面一致,无突兀
- [ ] 移动端不崩(自动隐藏右栏即可,不必精细适配)
- [ ] Graphiti 关闭时 UI 仍正常(不抛错,不显示假数据)

---

_本文档随 P4 实施过程更新。完成后写一份 `docs/agents/failures/2026-MM-mempalace-ui-XXX.md` 复盘任何 UI 翻车。_
