# ODM 框架（Organization Design Model）功能规划

> **版本**: v2.1  
> **创建日期**: 2026-03-08  
> **最后更新**: 2026-03-09  
> **状态**: 规划中  
> **关联**: ODD框架、行动空间、调度器

---

## 1. 功能概述

### 1.1 背景与动机

ABM（Agent-Based Modeling）建模中，ODD 协议（Overview, Design concepts, Details）是描述模型的标准框架。其中 **Design Concepts** 部分涵盖了智能体的涌现、适应、交互、感知等多个设计维度。然而当前系统的 ODD 框架仅作为行动空间的**只读描述信息**，并未真正驱动智能体的组织和调度行为。

要做到 ABM-Agent 级别的标准产品，我们需要一个**可执行的组织设计层**——即 ODM 框架，将 ABM 建模中关于"智能体如何被组织、如何交互、如何调度"的理论，落地为可配置、可可视化、可执行的系统能力。

### 1.2 ODM 框架定义

**ODM 框架（Organization Design Model）** 是与 ODD 框架并列的组织设计层。

> **ODD 框架**回答"这个模型是什么"——模型概述、设计概念、细节  
> **ODM 框架**回答"这个组织如何运转"——结构、拓扑、调度、协作  
> 二者互补，共同构成行动空间的完整 ABM 定义。

ODM 框架包含四个核心维度：

| 维度 | 含义 | 核心问题 |
|------|------|---------|
| 组织架构（Organizational Structure） | 层级、权力、汇报关系 | 谁管谁？ |
| 交互拓扑（Interaction Topology） | 通信网络结构 | 谁能跟谁说话？ |
| 调度机制（Process Scheduling） | 行动顺序和时序 | 谁先行动？ |
| 协作模式（Collaboration Pattern） | 协同完成任务的范式 | 怎么合作？ |

**KISS 原则**：后端存储四个维度，但前端**不暴露四维度的复杂性**。用户选一个组织模型模板 → 四个维度自动预设好 → 只需绑定角色 → 启动。高级用户可展开折叠区微调。

### 1.3 核心价值

- 对标 ABM 建模标准，ODD + ODM 构成完整模型定义
- **一个选择，一张图，一个开关**——选模板、绑角色、启动，< 1 分钟上手
- 预设经典组织模型，降低配置门槛
- 高级用户可逐维度深度定制
- **两层开关**：行动空间级定义 + 行动任务级运行时启用/关闭

---

## 2. 四个维度（后端数据模型）

后端完整存储四个维度，保证 ABM 建模的完备性。

### 2.1 维度1：组织架构（Organizational Structure）

定义智能体之间的**层级关系、权力结构、汇报路径**。

#### 核心概念：节点是槽位，角色是棋子

**模板定义的是"位置"（槽位）**，不是固定绑定某个角色。用户选完模板后，把行动空间里的角色放进对应槽位：

- 一个节点可以放**多个角色**（如"六部-工部"放两个工程师）
- 一个角色可以**身兼多职**（如人少时一人绑中书省+尚书省）
- 未绑定角色的节点在运行时**被跳过**

```
模板提供：                         用户绑定：

┌──────────────┐                 ┌──────────────────┐
│  中书省      │                 │  中书省           │
│  决策制定    │   ← 绑定 →     │  [张参谋 ×]       │
│  (空槽位)    │                 │  [李策划 ×]       │
└──────────────┘                 │  [+ 添加角色 ▼]   │
                                 └──────────────────┘
```

#### OdmNode 数据结构

```json
{
  "id": "node-zhongshu",
  "label": "中书省",
  "function": "决策制定",
  "layer": "layer-1",
  "role_ids": [],
  "position": { "x": 200, "y": 150 },
  "style": { "color": "#1890ff", "icon": "📝" },
  "properties": {
    "can_initiate": true,
    "can_reject": false,
    "can_approve": false,
    "max_concurrent_tasks": 1
  }
}
```

> **`role_ids: []`** —— 模板初始为空数组，用户绑定后填入角色 UUID。

#### OdmEdge 数据结构

```json
{
  "id": "edge-1",
  "source": "node-zhongshu",
  "target": "node-menxia",
  "type": "approval",
  "label": "提交审核",
  "properties": {
    "can_reject": true,
    "reject_target": "node-zhongshu"
  }
}
```

#### 边类型

| type | 说明 | 行为 |
|------|------|------|
| `command` | 上级下达指令 | 上级→下级，单向 |
| `approval` | 提交审批 | 可通过/驳回 |
| `report` | 汇报结果 | 下级→上级，单向 |
| `dispatch` | 任务分发 | 一对多分发 |
| `check` | 制衡/监督 | 平级或跨级监督 |
| `collaborate` | 平级协作 | 双向平等 |

#### 层级

```json
{
  "id": "layer-0",
  "name": "决策层",
  "level": 0,
  "color": "#ff4d4f"
}
```

### 2.2 维度2：交互拓扑（Interaction Topology）

定义智能体之间的**通信连接结构**——谁能跟谁通信。

> 组织架构 = "谁管谁"（权力），交互拓扑 = "谁能跟谁说话"（通信）。

#### 可选项

| 模板 | 说明 | ABM 对应 |
|------|------|---------|
| 跟随组织架构 | 拓扑自动从架构边生成 | Derived |
| 全连接 | 任意两个Agent都能通信 | Complete graph |
| 星型 | 一个中心，其他只通过中心通信 | Star |
| 环形 | 只能与相邻节点通信 | Ring |
| 网格 | 二维网格，与上下左右邻居通信 | Grid |
| 小世界 | 大部分局部连接 + 少量远程连接 | Watts-Strogatz |
| 无标度 | 少数枢纽高连接，多数低连接 | Barabási-Albert |
| 自定义 | 用户自由定义 | Custom |

#### 数据模型

```json
{
  "type": "interaction_topology",
  "template": "follow_structure",
  "auto_from_structure": true,
  "connections": []
}
```

### 2.3 维度3：调度机制（Process Scheduling）

定义智能体的**行动顺序和时序规则**。对应 ODD 协议中的 Process Overview and Scheduling。

#### 可选项

| 模板 | 说明 | 映射现有功能 |
|------|------|------------|
| 顺序轮询 | A→B→C→A... | `sequential` |
| 随机顺序 | 每轮随机 | 新增 |
| 优先级驱动 | 高优先先行动 | 新增 |
| 动态指派 | 当前Agent决定下一个 | `dynamic` |
| 事件驱动 | 变量/条件触发 | `variable` 触发 |
| 定时触发 | 按时间间隔 | `time` 触发 |
| 并行同步 | 所有Agent同时行动 | 未来扩展 |

#### 数据模型

```json
{
  "type": "process_scheduling",
  "template": "dynamic_assignment",
  "config": {
    "max_rounds": 50,
    "timeout_minutes": 30
  }
}
```

### 2.4 维度4：协作模式（Collaboration Pattern）

定义智能体**协同完成任务的交互范式**。

#### 可选项

| 模板 | 说明 | 流转特点 |
|------|------|---------|
| 委托-汇报 | 上级委托，下级执行并汇报 | 上→下→上 |
| 辩论制 | 正反方交替论述反驳 | 正↔反交替 |
| 评审制 | 主持分配，评审独立评议 | 主持→评审→综合 |
| 头脑风暴 | 自由发言，延迟批判 | 无固定顺序 |
| 流水线 | A→B→C 线性传递 | 线性 |
| 共识构建 | 多轮讨论至共识 | 全体多轮 |
| 德尔菲法 | 多轮独立意见→汇总→再收集 | 独立→汇总→修正 |

#### 数据模型

```json
{
  "type": "collaboration_pattern",
  "template": "delegation_report",
  "config": {}
}
```

---

## 3. 组织模型模板（四维度组合预设）

**前端暴露给用户的不是四个独立维度，而是"组织模型模板"**——每个模板预设好四个维度的默认值：

| 组织模型 | 图标 | 组织架构 | 交互拓扑 | 调度机制 | 协作模式 |
|---------|------|---------|---------|---------|---------|
| 三省六部制 | 🏛️ | 三省六部 | 跟随架构 | 动态指派 | 委托-汇报 |
| 中国国务院 | 🇨🇳 | 国务院体制 | 跟随架构 | 优先级驱动 | 委托-汇报 |
| 美国三权分立 | 🇺🇸 | 三权分立 | 全连接 | 事件驱动 | 共识构建 |
| 现代公司 | 🏢 | 公司架构 | 跟随架构 | 优先级驱动 | 委托-汇报 |
| 辩论赛 | ⚔️ | 扁平 | 全连接 | 顺序轮询 | 辩论制 |
| 专家评审 | 📋 | 扁平 | 星型 | 顺序轮询 | 评审制 |
| 头脑风暴 | 💡 | 扁平 | 全连接 | 随机顺序 | 头脑风暴 |
| 研发流水线 | 🔧 | 扁平 | 环形 | 顺序轮询 | 流水线 |
| 自定义 | 🛠️ | 自定义 | 自定义 | 自定义 | 自定义 |

### 组织架构详细图（模板节点 = 空槽位）

#### 🏛️ 三省六部制

```
                  ┌────────────────┐
                  │ 皇帝           │  Layer 0: 决策层
                  │ (空槽位)       │
                  └───────┬────────┘
         ┌────────────────┼────────────────┐
   ┌─────┴──────┐  ┌─────┴──────┐  ┌──────┴─────┐
   │ 中书省     │  │ 门下省     │  │ 尚书省     │  Layer 1: 管理层
   │ 决策制定   │  │ 审核审查   │  │ 执行管理   │
   │ (空槽位)   │  │ (空槽位)   │  │ (空槽位)   │
   └────────────┘  └────────────┘  └──────┬─────┘
          提案 ──→ 审核 ──→ 分发 ─────────┘
   ┌──────────────────────────────────────────┐
   │ 吏部  户部  礼部  兵部  刑部  工部       │  Layer 2: 执行层
   │ (空)  (空)  (空)  (空)  (空)  (空)       │
   └──────────────────────────────────────────┘

用户绑定后：

                  ┌────────────────────┐
                  │ 皇帝               │
                  │ [监督者/观察者 ×]   │
                  └────────┬───────────┘
         ┌─────────────────┼─────────────────┐
   ┌─────┴──────┐   ┌─────┴──────┐   ┌──────┴─────┐
   │ 中书省     │   │ 门下省     │   │ 尚书省     │
   │ [张参谋 ×] │   │ [王审计 ×] │   │ [赵总管 ×] │
   │ [李策划 ×] │   │            │   │            │
   └────────────┘   └────────────┘   └──────┬─────┘
   ┌──────────────────────────────────────────┐
   │ [孙工 ×] [钱粮 ×] [周礼 ×]  ... (按需绑定) │
   └──────────────────────────────────────────┘
   
   未分配: [陈秘书] [吴助理]  ← 还没放进任何槽位
```

#### 🇨🇳 中国国务院体制

```
                  ┌──────────────┐
                  │ 总理 (空)    │  Layer 0
                  └──────┬───────┘
         ┌───────────────┼───────────────┐
   ┌─────┴─────┐  ┌─────┴─────┐  ┌──────┴────┐
   │ 副总理(空)│  │国务委员(空)│  │ 秘书长(空)│  Layer 1
   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
   ┌─────┴──────────────┴───────────────┴─────┐
   │  部委槽位 × N（用户可增减）               │  Layer 2
   └──────────────────┬───────────────────────┘
   ┌──────────────────┴───────────────────────┐
   │  地方执行槽位 × N                         │  Layer 3
   └──────────────────────────────────────────┘
```

#### 🇺🇸 美国三权分立

```
      ┌──────────┐    ┌──────────┐    ┌──────────┐
      │ 立法(空) │←check→│ 行政(空) │←check→│ 司法(空) │  Layer 0（平级）
      └────┬─────┘    └────┬─────┘    └────┬─────┘
           │               │               │
      ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
      │下属(空) │    │下属(空) │    │下属(空) │  Layer 1
      └─────────┘    └─────────┘    └─────────┘
```

---

## 4. 两层开关机制

### 4.1 设计态：行动空间级

在行动空间详情页 [ODM框架] 标签页中配置。

### 4.2 运行态：行动任务级

```json
// AutonomousTask.config
{
  "type": "autonomous_scheduling",
  "max_rounds": 50,
  "topic": "...",
  "odm_enabled": true
}
```

| 行动空间 ODM | 任务 odm_enabled | 效果 |
|:---:|:---:|------|
| 未配置 | - | 普通调度，无约束 |
| 已配置 | `true` | ✅ ODM 约束生效 |
| 已配置 | `false` | 普通调度，ODM 暂停 |

---

## 5. 前端设计（KISS）

### 5.1 设计原则

**一个选择，一张图，一个开关。**

- 90% 用户：选模板 → 绑角色 → 保存 → 启动（< 1 分钟）
- 10% 高级用户：展开折叠区微调四个维度

### 5.2 入口

行动空间详情页 Tabs 新增 **[ODM框架]**：

```
[基本信息] [角色管理] [环境变量] [规则关联] [ODM框架] [编排]
                                              ↑ 新增
```

### 5.3 ODM 标签页

```
┌──────────────────────────────────────────────────────────────────────┐
│ ODM框架                                        启用ODM [🔵 开]       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  选择组织模型:                                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 🏛️  │ │ 🇨🇳  │ │ 🇺🇸  │ │ 🏢  │ │ ⚔️  │ │ 📋  │ │ 🛠️  │   │
│  │三省  │ │国务院│ │三权  │ │公司  │ │辩论赛│ │专家  │ │自定义│   │
│  │六部  │ │      │ │分立  │ │      │ │      │ │评审  │ │      │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│  [✓ 已选]                                                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │               React Flow 图编辑器                               │  │
│  │                                                                │  │
│  │         ┌────────────────────┐                                 │  │
│  │         │ 🔴 皇帝            │                                 │  │
│  │         │ [监督者 ×]         │                                 │  │
│  │         │ [+ 添加角色 ▼]     │                                 │  │
│  │         └────────┬───────────┘                                 │  │
│  │       ┌──────────┼──────────┐                                  │  │
│  │ ┌─────┴──────┐ ┌┴─────────┐ ┌──────────┐                      │  │
│  │ │ 🔵 中书省  │ │ 🔵 门下省│ │ 🔵 尚书省│                      │  │
│  │ │ [张参谋 ×] │ │ [王审计×]│ │ [赵总管×]│                      │  │
│  │ │ [李策划 ×] │ │ [+添加 ▼]│ │ [+添加 ▼]│                      │  │
│  │ │ [+添加 ▼]  │ └──────────┘ └────┬─────┘                      │  │
│  │ └────────────┘              ┌────┴────┐                        │  │
│  │                    [🟢吏][🟢户][🟢礼][🟢兵][🟢刑][🟢工]       │  │
│  │                    [孙×] [钱×] [空]  [空]  [空]  [空]          │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  未分配的角色: [陈秘书] [吴助理]    ← 可拖拽到上方节点              │  │
│                                                                      │
│  ▶ 高级设置                                                          │
│  │  交互拓扑: [📎 跟随架构 ▼]                                       │
│  │  调度机制: [🧠 动态指派  ▼]                                       │
│  │  协作模式: [📊 委托-汇报 ▼]                                       │
│  └──────────────────────────────────────────────────────────────     │
│                                                                      │
│  [保存]                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.4 节点交互细节

**选中节点时**，在画布右侧或下方显示属性面板：

```
┌─ 节点属性: 中书省 ──────────────────────────┐
│                                              │
│  名称: [中书省          ]                    │
│  职能: [决策制定        ]                    │
│  层级: [🔵 管理层       ▼]                   │
│                                              │
│  已绑定角色:                                  │
│  ┌──────────────────────────────┐            │
│  │ 👤 张参谋  [× 移除]          │            │
│  │ 👤 李策划  [× 移除]          │            │
│  └──────────────────────────────┘            │
│  [+ 添加角色 ▼]                              │
│    ├ 陈秘书 (未分配)                          │
│    ├ 吴助理 (未分配)                          │
│    └ 赵总管 (已在: 尚书省) ← 可身兼多职       │
│                                              │
│  权限:                                        │
│  ☑ 可发起提案   ☐ 可审批   ☐ 可驳回          │
│                                              │
└──────────────────────────────────────────────┘
```

**选中边时**：

```
┌─ 边属性: 中书省 → 门下省 ─────────────────┐
│                                            │
│  类型: [approval 审批 ▼]                    │
│  标签: [提交审核       ]                    │
│  可驳回: [✓]    驳回目标: [中书省 ▼]        │
│                                            │
└────────────────────────────────────────────┘
```

### 5.5 运行时面板

```
┌───────────────────────────────────────────────┐
│  🚀 启动自主调度                               │
│                                               │
│  主题: [模拟开科举决策过程          ]          │
│  最大轮次: [50]     超时: [30] 分钟            │
│                                               │
│  ─────────────────────────────────────────    │
│  🏛️ ODM组织约束  [🔵 开]                      │
│  当前: 三省六部制                              │
│  (来自行动空间配置)                            │
│  ─────────────────────────────────────────    │
│                                               │
│                     [启动]                     │
└───────────────────────────────────────────────┘
```

### 5.6 用户操作路径

```
新手（90%）:
  [ODM标签页] → 点「三省六部」模板卡片 → 画布自动出现架构图
  → 节点上点 [+ 添加角色] 把角色放进去（或从底部拖拽）
  → [保存]
  → 行动任务启动面板：ODM开关已自动开启 → [启动]
  全程 < 1 分钟

高级用户（10%）:
  同上 + 展开「高级设置」→ 把交互拓扑从"跟随架构"改成"全连接"
  → [保存]

研究用户:
  选「🛠️ 自定义」→ 从空白画布开始画 → 四个维度都自己配
  → 另存为自定义模板
```

---

## 6. 后端设计

### 6.1 ODM 完整配置结构

存储在 `ActionSpace.settings.odm`：

```json
{
  "settings": {
    "odm": {
      "enabled": true,
      "version": "2.1",
      "model_template": "three_departments_six_ministries",

      "organizational_structure": {
        "layers": [
          { "id": "layer-0", "name": "决策层", "level": 0, "color": "#ff4d4f" },
          { "id": "layer-1", "name": "管理层", "level": 1, "color": "#1890ff" },
          { "id": "layer-2", "name": "执行层", "level": 2, "color": "#52c41a" }
        ],
        "nodes": [
          {
            "id": "node-emperor",
            "label": "皇帝",
            "function": "最高决策",
            "layer": "layer-0",
            "role_ids": [],
            "position": { "x": 400, "y": 50 },
            "style": { "color": "#ff4d4f", "icon": "👑" },
            "properties": { "can_initiate": true, "can_veto": true }
          },
          {
            "id": "node-zhongshu",
            "label": "中书省",
            "function": "决策制定",
            "layer": "layer-1",
            "role_ids": [],
            "position": { "x": 200, "y": 200 },
            "style": { "color": "#1890ff", "icon": "📝" },
            "properties": { "can_initiate": true }
          }
        ],
        "edges": [
          {
            "id": "edge-1",
            "source": "node-emperor",
            "target": "node-zhongshu",
            "type": "command",
            "label": "下达指令"
          },
          {
            "id": "edge-2",
            "source": "node-zhongshu",
            "target": "node-menxia",
            "type": "approval",
            "label": "提交审核",
            "properties": { "can_reject": true, "reject_target": "node-zhongshu" }
          }
        ]
      },

      "interaction_topology": {
        "template": "follow_structure",
        "auto_from_structure": true,
        "connections": []
      },

      "process_scheduling": {
        "template": "dynamic_assignment",
        "config": { "max_rounds": 50, "timeout_minutes": 30 }
      },

      "collaboration_pattern": {
        "template": "delegation_report",
        "config": {}
      }
    }
  }
}
```

### 6.2 服务架构

```
app/services/odm/
├── __init__.py
├── odm_service.py              # 主服务（CRUD、组合验证、角色绑定）
├── constraint_engine.py        # 约束引擎（多维度约束合并、nextAgent 验证）
├── prompt_injector.py          # Prompt 注入（生成 <organizationDesign> 段）
└── templates/
    ├── __init__.py
    ├── model_templates.py      # 组织模型模板（四维度组合预设）
    ├── structures.py           # 组织架构模板数据
    ├── topologies.py           # 交互拓扑模板数据
    ├── schedulings.py          # 调度机制模板数据
    └── collaborations.py       # 协作模式模板数据
```

### 6.3 核心服务接口

```python
class OdmService:
    """ODM 框架主服务"""

    # --- CRUD ---
    def get_config(action_space_id: str) -> dict
    def save_config(action_space_id: str, odm_config: dict) -> bool
    def clear_config(action_space_id: str) -> bool

    # --- 模板 ---
    def list_model_templates() -> list
        """列出组织模型模板（三省六部、辩论赛等四维度组合）"""
    def apply_model_template(action_space_id: str, template_id: str) -> dict
        """应用组织模型模板（四维度一次性预设）"""
    def save_custom_template(user_id: str, name: str, config: dict) -> dict

    # --- 角色绑定 ---
    def bind_roles(action_space_id: str, node_id: str, role_ids: list) -> bool
        """将角色绑定到组织节点槽位"""
    def unbind_role(action_space_id: str, node_id: str, role_id: str) -> bool
    def get_unbound_roles(action_space_id: str) -> list
        """获取未分配到任何节点的角色列表"""

    # --- 运行时约束 ---
    def get_allowed_targets(space_id: str, current_role_id: str) -> list
        """综合组织架构+交互拓扑，返回可指派的Agent列表"""
    def validate_next_agent(space_id: str, current_role_id: str, target_role_id: str) -> bool
    def get_prompt_context(space_id: str, current_role_id: str) -> str
        """生成注入到 system prompt 的 ODM 描述"""
```

### 6.4 API 端点

`app/api/routes/action_spaces/odm.py`：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/action-spaces/<id>/odm` | 获取 ODM 配置 |
| `PUT` | `/action-spaces/<id>/odm` | 保存 ODM 配置 |
| `DELETE` | `/action-spaces/<id>/odm` | 清除 ODM 配置 |
| `GET` | `/odm/templates` | 获取模板列表 |
| `POST` | `/action-spaces/<id>/odm/apply-template` | 应用模板 |
| `PUT` | `/action-spaces/<id>/odm/nodes/<node_id>/roles` | 绑定角色到节点 |
| `DELETE` | `/action-spaces/<id>/odm/nodes/<node_id>/roles/<role_id>` | 解绑角色 |
| `GET` | `/action-spaces/<id>/odm/unbound-roles` | 获取未分配角色 |
| `GET` | `/action-spaces/<id>/odm/allowed-targets/<role_id>` | 获取可交互列表 |
| `POST` | `/odm/templates/custom` | 保存自定义模板 |

### 6.5 Prompt 注入

当 ODM 启用时，注入 `<organizationDesign>` 段：

```xml
<organizationDesign>
## 组织模型：三省六部制

### 你在组织中的位置
- 你的节点：门下省
- 你的职能：审核审查
- 你的层级：管理层 (Level 1)

### 你的可交互对象
- 上游：中书省 [张参谋, 李策划] → 提交方案供你审核
- 下游（审核通过）：尚书省 [赵总管] → 分发执行
- 下游（审核驳回）：中书省 [张参谋, 李策划] → 退回修改
- 上级汇报：皇帝 [监督者] → 重大事项

### ⚠️ nextAgent 约束
你只能将 nextAgent 设置为以下之一：
- "张参谋" 或 "李策划"（驳回方案）
- "赵总管"（通过，分发执行）
- "监督者"（重大事项上报）
</organizationDesign>
```

> Prompt 中用的是**角色名**（而非节点名），因为 Agent 认识的是角色，不是组织槽位。

### 6.6 约束执行流程

```
Agent 设置 nextAgent="XX"
        │
        ▼
executor.py: is_odm_enabled(task)?
        │
    ┌───┴───┐
    │ false │ true
    ▼       ▼
  正常    1. 从 role_id 查找所属节点（可能多个）
  执行    2. 从节点的边查找可达的目标节点
          3. 从目标节点的 role_ids 展开为角色列表
          4. 检查交互拓扑是否允许
          5. target 在允许列表中？
               │
           ┌───┴───┐
           │ 是    │ 否
           ▼       ▼
         继续    自动修正为最近合法角色
         执行    + 记录修正日志
```

---

## 7. 现有代码修改点

| 文件 | 修改内容 |
|------|---------|
| `services/scheduler/executor.py` | `execute_dynamic_loop()` 增加 ODM 约束检查 |
| `services/conversation/prompt_builder.py` | 注入 `<organizationDesign>` prompt |
| `api/routes/action_spaces/__init__.py` | 注册 `odm_bp` Blueprint |
| `api/routes/conversations/autonomous.py` | 支持 `odm_enabled` 参数 |

---

## 8. 实现计划

### Phase 1: MVP —— 预计 3 周

**目标**: 选模板 → 绑角色 → Prompt 注入 → 约束 nextAgent

- [ ] 后端：ODM 数据模型、OdmService CRUD
- [ ] 后端：组织模型模板库（三省六部、国务院、三权分立、公司、辩论赛、评审、头脑风暴、流水线）
- [ ] 后端：角色绑定 API（bind/unbind/unbound）
- [ ] 后端：Prompt 注入（prompt_injector.py）
- [ ] 后端：约束引擎（constraint_engine.py）—— Phase 1 仅实现组织架构 + 跟随拓扑
- [ ] 后端：API 路由
- [ ] 前端：ODM 标签页（模板选择卡片 + React Flow 图编辑器 + 节点角色绑定 + 高级设置折叠区）
- [ ] 前端：行动任务启动面板 ODM 开关

### Phase 2: 全维度执行 + 监控 —— 预计 3 周

- [ ] 约束引擎：交互拓扑独立约束（非跟随架构时）
- [ ] 调度机制新增类型（优先级/随机/并行同步）
- [ ] 协作模式执行逻辑（辩论阶段机、德尔菲多轮等）
- [ ] 运行监控：当前节点高亮、流转路径可视化、日志
- [ ] 交互拓扑独立编辑器（高级设置展开时）

### Phase 3: 扩展 —— 预计 2 周

- [ ] 更多预设模板（矩阵组织、Scrum 团队、罗马军团等）
- [ ] 自定义模板导入/导出（JSON）
- [ ] 并行实验集成：不同 ODM 模板对比实验

---

## 9. 文件结构

```
backend/app/
├── api/routes/action_spaces/
│   ├── odm.py                          # [新增] ODM API 路由
│   └── __init__.py                     # [修改] 注册 odm_bp
├── api/routes/conversations/
│   └── autonomous.py                   # [修改] 支持 odm_enabled
├── services/
│   ├── odm/                            # [新增]
│   │   ├── __init__.py
│   │   ├── odm_service.py
│   │   ├── constraint_engine.py
│   │   ├── prompt_injector.py
│   │   └── templates/
│   │       ├── model_templates.py      # 组织模型模板（四维度组合）
│   │       ├── structures.py
│   │       ├── topologies.py
│   │       ├── schedulings.py
│   │       └── collaborations.py
│   ├── scheduler/
│   │   └── executor.py                 # [修改] ODM 约束
│   └── conversation/
│       └── prompt_builder.py           # [修改] 注入 ODM prompt

frontend/src/pages/actionspace/
├── ActionSpaceDetail.tsx                # [修改] 增加 ODM 标签
├── odm/                                # [新增]
│   ├── OdmTab.tsx                      # 主组件（模板选择 + 图 + 高级设置）
│   ├── OdmEditor.tsx                   # React Flow 图编辑器
│   ├── OdmTemplateSelector.tsx         # 模板卡片选择
│   ├── OdmNodeComponent.tsx            # 自定义节点（带角色绑定区域）
│   ├── OdmEdgeComponent.tsx            # 自定义边
│   ├── OdmNodeConfigPanel.tsx          # 节点/边属性面板
│   ├── OdmAdvancedSettings.tsx         # 高级设置折叠区
│   └── OdmRoleBindingBar.tsx           # 底部未分配角色栏
├── services/api/
│   └── odm.ts                          # [新增] ODM API

```

---

## 10. 技术风险

| 风险 | 应对 |
|------|------|
| 约束过严导致流转卡死 | 超时 fallback + 用户可运行时关闭 ODM |
| 节点未绑定角色 | 运行时跳过空节点，按边找下一个有角色的节点 |
| 一角色多节点时约束冲突 | 取并集：该角色拥有所有所属节点的权限 |
| 制衡型模板死循环 | 最大步数限制 + 循环检测 |
| 与编排功能定位重叠 | ODM = ABM 组织设计，编排 = 工作流自动化，明确分工 |

---

## 11. 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 前端交互 | **一层：选模板→绑角色→保存** | KISS，90%用户1分钟搞定 |
| 四维度 | **后端存储，前端折叠隐藏** | 保证 ABM 完备性，但不增加用户负担 |
| 节点与角色 | **节点=空槽位，角色=棋子** | 模板可复用，同一模板不同角色组合 |
| 多角色绑定 | **一节点多角色，一角色多节点** | 灵活适应不同规模的行动空间 |
| 模板粒度 | **组织模型模板 = 四维度组合预设** | 用户选一个就搞定，不用分别配四次 |
| 高级设置 | **折叠区，默认收起** | 不打扰新手，给高级用户控制权 |
| Prompt 注入用角色名 | **不用节点名** | Agent 认识角色名，不认识"中书省" |
