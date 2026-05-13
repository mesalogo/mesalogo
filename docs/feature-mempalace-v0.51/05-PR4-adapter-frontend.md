# 05 — PR4:旧系统适配 + 前端浏览树

> **状态**:未开工(依赖 P3 合并)
> **预估工作量**:5-6 天(因为加了 KG Timeline,见 D6.4)
> **建议分支名**:`feat/mempalace-v0.51-p4-adapter-frontend`
> **前端设计文档**:[`09-ui-design.md`](./09-ui-design.md)(P4 必读)

---

## 0. 这个 PR 想达到什么

让 v0.51 **真正替换** 旧记忆系统:
- 旧 `add_memory` / `search_memory_*` 工具继续可用(adapter 转发到新 API),不破坏既有 Agent 配置
- `memory_sync_service.py` 的同步阻塞 IO 全部清掉(对齐 backend-fastapi/AGENTS.md §3.1)
- `memory_capability_service.py` 解耦 Graphiti 开关(关 Graphiti ≠ 失忆)
- 前端有完整的 Wing/Hall/Room/Closet/Drawer/Diary 浏览树
- `/agents/{id}/memories` 切到新数据源
- Graphiti 服务降级为**可选**(图谱可视化时才开)

---

## 1. 范围

### 1.1 这个 PR 做(后端)

- ✅ 旧 MCP 工具 adapter:`add_memory` / `search_memory_nodes` / `search_memory_facts` / `get_episodes` 转发到 v2
- ✅ `memory_sync_service.py` 重写为 async,改调 `MemoryWriter`
- ✅ `memory_capability_service.py` 解耦 Graphiti
- ✅ `memory_partition_service.py` 的 TBD 用真实新数据填(graph 可视化能查到 wing/room 而不是 mock 节点)
- ✅ `tool_handler.py` 的 group_id 注入改为 wing_id 注入(并兼容旧 group_id 工具签名)
- ✅ `/agents/{id}/memories` 端点切换数据源
- ✅ Graphiti 适配器(可选启用,用于关系图可视化;不影响核心)

### 1.2 这个 PR 做(前端)

> ⚠ **完整 UI 设计参见 [`09-ui-design.md`](./09-ui-design.md)**。
> 本节只列范围,实现细节、布局、交互全部在 09 文档。

按 D6 决策,前端分 4 个 commit 实现:

- ✅ **C1 三栏主页骨架**(`09-ui-design §1`)
  - Wing 树(左)+ Room 详情(中,Closets/Drawers 双栏)+ 右抽屉默认隐藏
  - 路由 `/memory-palace`,数据接入 `/api/memory/v2/*`
  - KB Mounts 区分组,只读图标 📚
- ✅ **C2 Drawer 详情抽屉**(`09-ui-design §2`)
  - Antd Drawer 展示 verbatim content + entities + metadata
  - KG 状态徽标(✓/⚠/✗)+ 展开"为什么是这个状态"的解释
  - Action 按钮:Add Note / Forget / Pin Importance / View Source
  - 不允许编辑 content(verbatim 保护)
- ✅ **C3 对话浮层 + 表单 + 全局搜索**(`09-ui-design §3, §4, §6`)
  - 对话页顶部 `💭 N memories used` 始终显示(D6.3)
  - 右侧抽屉默认折叠,展开后只显示本对话相关记忆
  - ActionSpace 创建表单加 `wing_scope` + `reflection_mode` + `kb_mounts`(英文 + ⓘ tooltip)
  - 全局 ⌘K 搜索(`cmdk` 库)
- ✅ **C4 KG 视图 + Timeline**(`09-ui-design §5`,D6.2 + D6.4)
  - 独立菜单项 "Knowledge Graph"
  - 表格视图(Current Facts + Historical Facts)
  - **Timeline 时态可视化**(SVG 或 vis-timeline)
  - Find Contradictions + Export

### 1.3 这个 PR **不做**

- ❌ Graphiti 数据迁移(已确认不迁)
- ❌ AAAK 压缩
- ❌ 复杂的关系图可视化(@xyflow/react 大手术留给 v0.6)
- ❌ Diary 的反向 LLM 编辑功能(只读展示)
- ❌ 完整 i18n(按 D5,只做英文术语 + 中文 tooltip)
- ❌ 移动端精细适配(屏小自动隐藏右栏即可)

---

## 2. 后端:Adapter 设计

### 2.1 旧 MCP 工具签名兼容

旧工具调用形如:

```python
add_memory(name="...", episode_body="...", group_id="actionspace-123")
search_memory_nodes(query="...", group_ids=["actionspace-123"])
```

Adapter 实现:

```python
# app/mcp_servers/legacy_graphiti_adapter.py
@tool(name="add_memory")
async def add_memory_legacy(
    name: str, episode_body: str,
    group_id: str | None = None,
    **kwargs,
) -> dict:
    """旧版 Graphiti 兼容接口,内部转发到 MemoryPalace v2。"""
    # 1. group_id → wing_id(通过 partition_service 反向映射)
    wing_id = await wing_from_legacy_group_id(group_id)
    # 2. agent_id 从 conversation context 拿
    agent_id = current_agent_context().agent_id
    # 3. 转写 + 写入
    return await MemoryWriter().write_drawer(DrawerWritePayload(
        agent_id=agent_id,
        wing_id_override=wing_id,
        content=f"# {name}\n\n{episode_body}",
        source_kind="message",
    ))


@tool(name="search_memory_nodes")
async def search_memory_nodes_legacy(query: str, group_ids: list[str] | None = None, **_) -> list[dict]:
    """旧版 Graphiti 节点搜索 → 转发到 v2 recall。"""
    wing_id = await wing_from_legacy_group_id(group_ids[0]) if group_ids else None
    hits = await MemoryReader().recall(
        agent_id=current_agent_context().agent_id,
        query=query, scope="wing" if wing_id else "auto", k=10,
    )
    # 改写返回 schema 为旧格式(避免现有 prompt 解析失败)
    return [{"name": h.room_name, "summary": h.content[:200], "uuid": str(h.drawer_id)} for h in hits]


# 同理 search_memory_facts / get_episodes
```

> Adapter 是 **MCP server 注册层** 的事;不是 prompt 改写。Agent 看到的工具列表不变。

### 2.2 `memory_sync_service.py` 重写

老路径:`requests.post(graphiti_url + "/messages", json=...)`(同步)
新路径:

```python
# app/services/memory_sync_service.py(改写,不删文件,保持向下兼容)
class MemorySyncService:
    async def sync_conversation_round_async(
        self, conversation_id: int, agent_message_id: int,
        human_message_id: int | None = None,
    ):
        """对话轮次结束后调用。**不阻塞**主流程。"""
        from app.tasks.memory_palace_writes import schedule_drawer_write
        # 把消息封装成 DrawerWritePayload,直接走 MemoryPalace
        payloads = await self._build_payloads(conversation_id, agent_message_id, human_message_id)
        for p in payloads:
            await schedule_drawer_write(p)

    # 老接口保留但 deprecated,只有 graphiti_legacy_enabled=True 才走老分支
    async def sync_to_graphiti_legacy(...):
        # 这里也用 httpx.AsyncClient(把 requests + threading.Thread 全清掉)
        ...
```

### 2.3 `memory_capability_service.py` 解耦

```python
def is_memory_enabled(self) -> bool:
    """新版:看 MemoryPalace 配置,而不是 Graphiti。"""
    # 简单实现:任何 wing 存在就启用;或读 system_settings.mempalace_enabled
    return settings.MEMPALACE_ENABLED  # 默认 True
```

旧 `sync_memory_capability_with_graph_enhancement` 保留但不再调用(deprecated)。

### 2.4 `memory_partition_service.py` 的 TBD 填实

```python
def _list_graphiti_partitions(self):
    # 老:返回 mock 假节点
    # 新:从 memory_wing 真实数据返回
    wings = await db.fetch_all("SELECT id, name, scope_type, scope_id FROM memory_wing WHERE tenant_id=:t", ...)
    return [{"id": f"wing-{w.id}", "name": w.name, ...} for w in wings]

def get_partition_graph(self, partition_id, ...):
    # 老:模拟 5 个节点
    # 新:返回该 wing 的 room 数 / drawer 数 / closet 数 / tunnel 数
    ...
```

---

## 3. 前端:页面结构

### 3.1 路由 / 入口

```
/settings/memory-palace            (主入口)
/conversation/{cid}?memory=true    (对话页面右抽屉)
```

### 3.2 主页面布局

```
┌─────────────────────────────────────────────────────────────┐
│ MemoryPalace  [Search _________________________]  [Reflect▼]│
├─────────────────┬───────────────────────────────────────────┤
│ Wings           │  Wing: ProjectX / Hall: 数据库 / Room: 索引设计 │
│ ▶ ProjectX      │  ┌──────────────┬──────────────────────┐  │
│ ▶ ProjectY      │  │ Closet (3)   │ Drawer (12)          │  │
│   Halls         │  │ • 索引选型    │ • 用户原话:...        │  │
│   • 数据库      │  │ • 写放大问题  │ • 工具结果:...        │  │
│     Rooms       │  │ • B+树 vs LSM│ • 反思:...            │  │
│     - 索引设计 ⭐│  └──────────────┴──────────────────────┘  │
│   • API         │  Tunnels: → ProjectY/数据库决策             │
│ ▶ ProjectZ      │  Diaries: 4 条                              │
└─────────────────┴───────────────────────────────────────────┘
```

### 3.3 Drawer 详情面板

```
┌──────────────────────────────────────────────────────────────┐
│ Drawer #1234   ⚠ KG: stale (2026-01-15 之后此事实可能已变)    │
├──────────────────────────────────────────────────────────────┤
│ Content (verbatim, 不可编辑):                                 │
│   用户:我老婆叫张三                                           │
├──────────────────────────────────────────────────────────────┤
│ Entities: [张三, 用户A]                                        │
│ Importance: 0.62  ▮▮▮▮▮▮░░░░                                  │
│ Created: 2025-11-23 14:21  | Last recalled: 2026-04-20         │
│ Source: message #5678 in conversation #99                      │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 KG 状态徽标

| 状态 | 颜色 | 文案 |
|---|---|---|
| `ok` | 绿 | KG 一致 |
| `stale` | 黄 | 此事实可能已过期 |
| `contradicted` | 红 | 与最新 KG 矛盾 |
| `unknown` | 灰(不展示) | — |

### 3.5 ActionSpace 创建表单新增

```
[Wing 作用域]
  ( ) Space - 同空间 Agent 共享  (默认推荐)
  ( ) Role  - 同角色 Agent 共享
  ( ) Agent - 每个 Agent 独享
  ( ) Global - 整个租户共享
  ⚠ 创建后不可修改;如需切换请新建空间
```

### 3.6 Agent 编辑表单新增

```
[反思模式]
  ( ) per_task - 任务结束自动反思  (默认)
  ( ) manual   - 仅在显式触发时反思
  ( ) disabled - 不反思
```

---

## 4. 文件清单

### 4.1 后端新建/修改

```
backend-fastapi/app/
├── mcp_servers/
│   └── legacy_graphiti_adapter.py        # 新建
├── services/
│   ├── memory_sync_service.py            # 改写(async)
│   ├── memory_capability_service.py      # 改写(解耦)
│   ├── memory_partition_service.py       # TBD 填实
│   └── conversation/tool_handler.py      # group_id → wing_id
├── api/routes/
│   ├── agents.py                         # /memories 切数据源
│   └── memory_management.py              # 全部 async
└── tests/memory_palace/
    ├── test_legacy_adapter.py
    ├── test_memory_sync_service_async.py
    └── test_capability_decoupled.py
```

### 4.2 前端新建/修改

```
frontend/src/
├── pages/
│   └── memory-palace/
│       ├── index.tsx                     # 主页面
│       ├── components/
│       │   ├── WingTree.tsx
│       │   ├── ClosetList.tsx
│       │   ├── DrawerDetail.tsx
│       │   ├── DiaryList.tsx
│       │   ├── TunnelList.tsx
│       │   └── KGBadge.tsx
│       └── api.ts                        # /api/memory/v2 客户端
├── pages/
│   ├── actionspace/components/
│   │   └── WingScopeSelect.tsx           # 新增
│   ├── agent/components/
│   │   └── ReflectionModeSelect.tsx      # 新增
│   └── conversation/components/
│       └── MemoryDrawer.tsx              # 改写,从 graphiti list 切到 v2
└── ...
```

---

## 5. 验收标准

### 5.1 兼容性

- [ ] 所有现有 Agent 配置不修改,旧 `add_memory` 调用照样写入(经 adapter 落到 v2)
- [ ] 关闭 Graphiti(`graph_enhancement.enabled=false`)后:
  - Agent 仍有 memory 能力(没被剥)
  - `/agents/{id}/memories` 返回 v2 数据
  - 前端 MemoryPalace 页面正常工作
  - 关系图可视化菜单提示"需启用 Graphiti"(优雅降级)

### 5.2 阻塞 IO 清零

```bash
git grep -E "import requests|threading\." backend-fastapi/app/services/memory_*.py
# 应为空
```

### 5.3 端到端

- [ ] 对话产生消息 → 后台写 drawer → 在前端 MemoryPalace 能立即看到(SSE 推送)
- [ ] 在 ActionSpace 创建时选 wing_scope=agent → 该空间下每个 Agent 自动建独立 wing
- [ ] reflection_mode=manual 的 Agent 任务结束**不**触发反思
- [ ] reflect 工具调用后,Diary 列表多 1 条
- [ ] fact_check("用户老婆叫李四")当 KG 里是张三时,返回 `contradicted`
- [ ] create_tunnel 后,跨 wing recall 能命中

### 5.4 性能

- 对话路径不退化:SSE done 时间与 P3 相比 ±5%
- MemoryPalace 主页首屏加载 < 2s

---

## 6. 风险 & 防护

| 风险 | 防护 |
|---|---|
| Adapter 改变旧工具返回 schema → 前端解析崩 | 严格保持旧字段(name/uuid/summary),新增字段加在末尾 |
| memory_sync_service 改写后丢消息 | 双写过渡:`graphiti_legacy_enabled=true` 时新旧都写,观察 1 周再下线老路径 |
| 前端树太大渲染卡 | 虚拟滚动(@tanstack/react-virtual)+ 懒加载 room/drawer |
| Wing scope 改不了 → 用户后悔 | 提供"复制到新空间"工具(P5,不阻塞 P4) |
| Graphiti 关掉后 graph 可视化菜单仍出现 → 误导 | 菜单根据 `graph_enhancement.enabled` 动态显示;关闭时显示"需开启 Graphiti" |

---

## 7. 给 Reviewer 的检查清单

- [ ] §4 文件清单内,无外溢
- [ ] grep 检查阻塞 IO 已清零
- [ ] 旧 `add_memory` 工具回归测试通过(模拟 Agent 调用历史)
- [ ] Graphiti 开/关两种状态都跑过完整 E2E
- [ ] 前端 MemoryPalace 在 demo 数据上截图(贴 PR 描述)
- [ ] P1 + P2 + P3 测试全部仍绿

---

## 8. 完成 v0.51

P4 合并即 v0.51 终态。
此时:

- 完全独立于 Graphiti 的多层记忆系统
- 全 async,符合 5000 并发约束
- 4 张前置表 + 3 张后续表,Alembic 可双向迁移
- 前端有完整可视化
- 旧 Agent 配置 0 改动

**下一步**(v0.6+,不在本系列):
- 关系图可视化(@xyflow/react)
- AAAK 评估
- LLM rerank(可选,提升尾部召回)
- Wing 作用域跨空间复制工具
- 跨 tenant 知识共享(需法务审查)

---

_done._
