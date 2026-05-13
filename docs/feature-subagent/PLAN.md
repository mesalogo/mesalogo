# SubAgent 功能规划 — Agent 主动调用 Agent 并行协作

> **版本**: v1.0  
> **创建日期**: 2026-03-10  
> **状态**: 规划中  
> **关联**: 行动任务（ActionTask）、调度器（TaskScheduler）、MCP 工具、会话系统

---

## 1. 功能概述

### 1.1 背景与动机

当前系统中智能体（Agent）的协作模式有以下几种：

| 现有模式 | 说明 | 局限性 |
|---------|------|--------|
| 顺序轮询（sequential） | A→B→C→A 固定顺序发言 | 无法按需动态调用 |
| 自主调度（dynamic） | Agent 通过设置 `nextAgent` 变量指定下一个 | 串行传递，一次只能指定一个 |
| 编排模式（orchestration） | 预定义的 ReactFlow 流程图 | 流程固定，Agent 无法自主决策调谁 |
| 并行模式（parallel） | `asyncio.gather` 同时执行所有 Agent | 无差别全员并行，非按需调用 |

**缺失的核心能力：** Agent 在执行过程中，根据当前任务需要，**主动发起**对其他 Agent 的调用（类似函数调用），获取返回结果后继续自己的推理流程。

**类比**：就像 Factory 的 `Task` 工具能 spawn 一个 subagent 做子任务并拿回结果，我们需要让 ABM-LLM 中的 Agent 也拥有这种能力。

### 1.2 核心价值

- **按需调用**：Agent A 只在需要时才调用 Agent B，而非固定流程
- **并行执行**：一个 Agent 可同时调用多个 SubAgent 并行工作
- **结果回传**：SubAgent 的结果作为工具调用结果返回给调用者
- **嵌套可能**：SubAgent 也可以调用 SubSubAgent（受深度限制）
- **与 ODM 框架集成**：调用目标受组织约束，只能调用架构允许的 Agent

### 1.3 用户场景

**场景1：研究协作**
> 张参谋（战略角色）在分析问题时，发现需要经济数据和技术评估：
> - 主动调用 `钱粮`（经济角色）查询经济数据
> - 同时调用 `孙工`（技术角色）做技术可行性评估
> - 两个 SubAgent 并行执行，结果汇总后继续推理

**场景2：审批流程**
> 门下省（审核角色）收到中书省的提案：
> - 调用 `刑部` SubAgent 做法律合规性检查
> - 调用 `户部` SubAgent 做预算可行性评估
> - 根据两者的返回结果决定 approve/reject

**场景3：信息收集**
> 项目经理需要各部门进度：
> - 并行调用 `前端工程师`、`后端工程师`、`测试工程师` 三个 SubAgent
> - 每个 SubAgent 基于自己的知识和上下文返回进度报告
> - 项目经理汇总后输出总报告

---

## 2. 技术设计

### 2.1 整体架构

```
                    Agent A（调用方）
                         │
                    ┌────┴────┐
                    │ LLM 推理 │
                    └────┬────┘
                         │ tool_call: invoke_agent / invoke_agents
                         ▼
                ┌──────────────────┐
                │  SubAgent MCP    │  ← 新增 MCP 服务器
                │  Tool Handler    │
                └────────┬─────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ SubAgent  │  │ SubAgent  │  │ SubAgent  │
    │ (Agent B) │  │ (Agent C) │  │ (Agent D) │
    │ 独立会话  │  │ 独立会话  │  │ 独立会话  │
    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
          │              │              │
          ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ LLM 响应  │  │ LLM 响应  │  │ LLM 响应  │
    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                ┌──────────────────┐
                │  结果聚合        │
                │  返回给 Agent A  │
                └──────────────────┘
                         │
                         ▼
                    Agent A 继续推理
```

### 2.2 MCP 工具定义

新增 `subagent_server.py`，提供 3 个工具：

#### 2.2.1 `invoke_agent` — 调用单个 Agent

```json
{
  "name": "invoke_agent",
  "description": "调用行动任务中的另一个智能体执行子任务。SubAgent 会基于自己的角色、知识和系统提示，独立处理你给出的任务描述，并返回结果。适用于需要特定角色的专业判断或信息时使用。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task_id": {
        "type": "string",
        "description": "当前行动任务ID"
      },
      "target_agent_name": {
        "type": "string",
        "description": "要调用的目标智能体名称（从参与者列表中选择）"
      },
      "task_description": {
        "type": "string",
        "description": "给目标智能体的任务描述，说明你需要它做什么"
      },
      "context": {
        "type": "string",
        "description": "可选的上下文信息，帮助目标智能体理解背景"
      },
      "max_tokens": {
        "type": "integer",
        "description": "SubAgent 响应的最大 token 数（默认2048）",
        "default": 2048
      }
    },
    "required": ["task_id", "target_agent_name", "task_description"]
  },
  "annotations": {
    "title": "调用智能体",
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": false,
    "openWorldHint": false
  }
}
```

#### 2.2.2 `invoke_agents` — 并行调用多个 Agent

```json
{
  "name": "invoke_agents",
  "description": "并行调用多个智能体执行子任务。所有被调用的智能体将同时独立执行，结果汇总后一起返回。适用于需要多个不同角色同时提供输入的场景。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task_id": {
        "type": "string",
        "description": "当前行动任务ID"
      },
      "invocations": {
        "type": "array",
        "description": "调用列表",
        "items": {
          "type": "object",
          "properties": {
            "target_agent_name": {
              "type": "string",
              "description": "目标智能体名称"
            },
            "task_description": {
              "type": "string",
              "description": "给该智能体的任务描述"
            },
            "context": {
              "type": "string",
              "description": "可选上下文"
            }
          },
          "required": ["target_agent_name", "task_description"]
        },
        "maxItems": 5
      },
      "max_tokens_per_agent": {
        "type": "integer",
        "description": "每个 SubAgent 响应的最大 token 数（默认2048）",
        "default": 2048
      }
    },
    "required": ["task_id", "invocations"]
  },
  "annotations": {
    "title": "并行调用多个智能体",
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": false,
    "openWorldHint": false
  }
}
```

#### 2.2.3 `list_available_agents` — 查看可调用的 Agent 列表

```json
{
  "name": "list_available_agents",
  "description": "列出当前行动任务中所有可以被调用的智能体。返回每个智能体的名称、角色和能力描述。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task_id": {
        "type": "string",
        "description": "当前行动任务ID"
      }
    },
    "required": ["task_id"]
  },
  "annotations": {
    "title": "列出可调用智能体",
    "readOnlyHint": true,
    "openWorldHint": false
  }
}
```

### 2.3 SubAgent 执行引擎

#### 2.3.1 核心流程

```python
class SubAgentExecutor:
    """
    SubAgent 执行引擎
    
    在调用方 Agent 的工具调用中，创建独立的 LLM 请求，
    使用目标 Agent 的 system_prompt、角色、知识和工具，
    执行给定的任务并返回结果。
    """
    
    MAX_NESTING_DEPTH = 3        # 最大嵌套深度
    MAX_PARALLEL_INVOCATIONS = 5 # 单次最大并行调用数
    DEFAULT_TIMEOUT = 120        # 默认超时（秒）
    
    @staticmethod
    async def invoke_single(
        task_id: str,
        caller_agent_id: str,
        target_agent_name: str,
        task_description: str,
        context: str = None,
        conversation_id: str = None,
        nesting_depth: int = 0,
        max_tokens: int = 2048
    ) -> dict:
        """
        调用单个 SubAgent
        
        Returns:
            {
                "agent_name": str,
                "agent_role": str,
                "response": str,
                "status": "success" | "error",
                "token_usage": { "prompt": int, "completion": int },
                "elapsed_seconds": float
            }
        """
        
    @staticmethod
    async def invoke_parallel(
        task_id: str,
        caller_agent_id: str,
        invocations: list,
        conversation_id: str = None,
        nesting_depth: int = 0,
        max_tokens_per_agent: int = 2048
    ) -> dict:
        """
        并行调用多个 SubAgent
        
        Returns:
            {
                "results": [
                    { "agent_name": str, "response": str, "status": str, ... },
                    ...
                ],
                "total_elapsed_seconds": float
            }
        """
```

#### 2.3.2 SubAgent 调用内部流程

```
invoke_agent("钱粮", "请评估本项目预算可行性", context="项目预算500万")
    │
    ▼
1. 验证调用权限
   - 检查调用者和目标在同一个 ActionTask 中
   - 检查嵌套深度 < MAX_NESTING_DEPTH
   - (如果 ODM 启用) 检查组织约束
    │
    ▼
2. 准备 SubAgent 上下文
   - 获取目标 Agent 的 role.system_prompt
   - 注入 SubAgent 专属提示词：
     "<subAgentContext>
      你被 {caller_name} 调用来完成以下子任务。
      请专注回答该任务，不要偏离主题。
      任务描述：{task_description}
      背景信息：{context}
      </subAgentContext>"
   - 加载目标 Agent 的 MCP 工具（除了 invoke_agent，防止无限递归）
     或：保留 invoke_agent 但递增 nesting_depth
    │
    ▼
3. 调用 LLM
   - 使用目标 Agent 配置的模型
   - 带上 system_prompt + subAgentContext + 任务知识
   - 支持工具调用（SubAgent 可以用自己的 MCP 工具）
   - 限制 max_tokens
    │
    ▼
4. 记录消息（可选，取决于配置）
   - 在主会话中记录一条系统消息：
     "[SubAgent 调用] {caller} → {target}: {task_description}"
   - SubAgent 的详细对话记录到子会话或消息元数据
    │
    ▼
5. 返回结果
   - 提取 SubAgent 最终回复内容
   - 作为 tool_result 返回给调用方的 LLM
   - 调用方继续推理
```

#### 2.3.3 SubAgent 上下文构建

SubAgent 不共享调用者的完整会话历史，而是获得：

1. **自身角色的 system_prompt** — 保持角色一致性
2. **SubAgent 任务提示** — 明确任务范围
3. **调用者提供的 context** — 必要背景信息
4. **任务级环境变量** — 共享的 ActionTask 变量（只读）
5. **自身的知识库** — RAG 检索结果

```xml
<!-- SubAgent 收到的消息结构 -->
<system>
  {target_agent.role.system_prompt}  <!-- 自身角色提示 -->
  
  <subAgentContext>
    你被智能体「{caller_name}」（角色：{caller_role}）调用来执行一个子任务。
    
    ## 子任务
    {task_description}
    
    ## 背景信息
    {context}
    
    ## 任务变量
    {环境变量列表}
    
    ## 要求
    - 请专注于上述子任务，给出完整的回答
    - 不要偏离任务范围
    - 如果需要更多信息，请在回复中说明
  </subAgentContext>
</system>
```

### 2.4 消息记录策略

SubAgent 的消息记录有两种策略：

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| **内联记录** | SubAgent 消息作为主会话消息的元数据附件 | 默认模式，简单直观 |
| **子会话记录** | 创建子 Conversation 记录 SubAgent 完整对话 | 深度分析、审计需要 |

**默认采用内联记录**：

```python
# 主会话中记录的消息格式
Message(
    conversation_id=main_conversation_id,
    role="system",
    content=f"[SubAgent] {caller_name} 调用了 {target_name}: {task_description[:100]}...",
    meta={
        "type": "subagent_invocation",
        "caller_agent_id": caller_agent_id,
        "target_agent_id": target_agent_id,
        "task_description": task_description,
        "response_summary": response[:500],
        "full_response": response,  # 完整响应
        "token_usage": token_usage,
        "elapsed_seconds": elapsed,
        "nesting_depth": nesting_depth
    }
)
```

### 2.5 安全与限制

| 限制项 | 默认值 | 说明 |
|--------|--------|------|
| 最大嵌套深度 | 3 | SubAgent 调用 SubAgent 的最大层数 |
| 单次最大并行数 | 5 | `invoke_agents` 一次最多调用 5 个 |
| SubAgent 超时 | 120s | 单个 SubAgent 执行超时 |
| SubAgent max_tokens | 2048 | 单个 SubAgent 回复 token 限制 |
| 调用频率限制 | 10次/分钟/Agent | 防止 Agent 过度调用 |
| 递归保护 | A→B→A 检测 | 防止循环调用 |

### 2.6 Prompt 注入

当行动任务中启用 SubAgent 功能时，在所有 Agent 的 system_prompt 中注入：

```xml
<subAgentCapability>
## 调用其他智能体

你可以在需要时调用行动任务中的其他智能体协助你完成任务。

### 可调用的智能体
{agent_list_with_roles_and_descriptions}

### 使用方法
- `invoke_agent`: 调用单个智能体，获取专业意见或执行特定任务
- `invoke_agents`: 同时调用多个智能体并行工作
- `list_available_agents`: 查看可调用的智能体列表

### 使用建议
- 当你需要其他角色的专业知识或判断时使用
- 给出清晰的任务描述和必要的背景信息
- SubAgent 会基于自己的角色独立回答，结果作为工具返回值供你使用
- 你可以同时调用多个智能体并行获取信息，提高效率
</subAgentCapability>
```

### 2.7 与 ODM 框架集成

当 ODM 框架启用时，SubAgent 调用受组织约束：

```python
def validate_subagent_invocation(task_id, caller_agent_id, target_agent_name, odm_config):
    """
    ODM 约束验证：
    1. 从 caller_agent 的 role_id 查找所属 ODM 节点
    2. 从节点的边查找可达的目标节点（含 command/dispatch/collaborate 类型边）
    3. 检查目标 Agent 是否在可达节点的 role_ids 中
    4. 返回是否允许调用
    """
    # 如果 ODM 未启用，默认允许所有调用
    if not odm_config or not odm_config.get('enabled'):
        return True, None
    
    allowed_targets = OdmService.get_allowed_targets(
        space_id=action_space_id,
        current_role_id=caller_role_id
    )
    
    if target_agent_name not in [a.name for a in allowed_targets]:
        return False, f"ODM 约束：你的组织位置不允许直接调用 {target_agent_name}"
    
    return True, None
```

---

## 3. 与现有系统的集成点

### 3.1 调度器集成

SubAgent 调用**不走 TaskScheduler**，而是在**工具调用层**直接处理：

```
现有流程:
  LLM → tool_call(set_task_var) → MCP Handler → 返回结果 → LLM 继续

SubAgent 流程:
  LLM → tool_call(invoke_agent) → SubAgent MCP Handler → 
    → SubAgent LLM 调用 → 返回结果 → 
  LLM 继续（主 Agent）
```

**原因**：SubAgent 是同步工具调用的一部分，不需要独立的任务生命周期管理。调度器处理的是独立运行的自主任务，而 SubAgent 是嵌入式的子任务。

### 3.2 MCP 工具注册

在 `MCPServerManager` 中注册新的 SubAgent 工具：

```python
# app/mcp_servers/subagent_server.py
SUBAGENT_TOOLS = [
    invoke_agent_tool_def,
    invoke_agents_tool_def,
    list_available_agents_tool_def,
]

def get_tools() -> List[Dict]:
    return SUBAGENT_TOOLS

def handle_request(request_data: Dict) -> Dict:
    # 路由到对应的处理函数
    ...
```

### 3.3 ConversationService 集成

复用 `_process_single_agent_response` 的核心逻辑，但做简化：

```python
# SubAgent 调用不需要：
# - SSE 流式输出（结果直接返回给调用方）
# - 消息格式化和前端推送
# - 自主任务记录

# SubAgent 调用需要：
# - 独立的 system_prompt 构建
# - 独立的 LLM 请求（使用目标 Agent 的模型配置）
# - MCP 工具支持（SubAgent 可以使用工具）
# - 独立的 token 计量
```

### 3.4 前端展示

#### 消息展示

SubAgent 调用在会话中显示为特殊的消息卡片：

```
┌─────────────────────────────────────────────────────────────┐
│ 🔗 SubAgent 调用                                            │
│                                                             │
│ 张参谋 → [钱粮, 孙工]                                       │
│ 任务: 评估项目预算可行性 / 技术可行性评估                     │
│                                                             │
│ ┌─ 钱粮 的回复 ──────────────────────┐                      │
│ │ 经过评估，500万预算基本可行...     │ ⏱ 8.3s  📊 1.2k tok │
│ └────────────────────────────────────┘                      │
│ ┌─ 孙工 的回复 ──────────────────────┐                      │
│ │ 技术方案可行，建议使用方案B...     │ ⏱ 6.1s  📊 0.9k tok │
│ └────────────────────────────────────┘                      │
│                                                             │
│ 耗时: 8.5s (并行)  总 Token: 2.1k                           │
└─────────────────────────────────────────────────────────────┘
```

#### 启动配置

在自主任务启动面板增加 SubAgent 开关：

```
┌─────────────────────────────────────────────┐
│  🚀 启动自主调度                             │
│                                             │
│  主题: [...]                                │
│  最大轮次: [50]                              │
│                                             │
│  ──────────────────────────────────────     │
│  🤖 SubAgent 调用  [🔵 开]                   │
│  允许智能体主动调用其他智能体协作             │
│                                             │
│  ▶ SubAgent 高级设置                         │
│  │ 最大嵌套深度: [3]                         │
│  │ 最大并行调用: [5]                         │
│  │ SubAgent 超时: [120] 秒                   │
│  └──────────────────────────────────────    │
│                                             │
│                    [启动]                    │
└─────────────────────────────────────────────┘
```

---

## 4. 实现计划

### Phase 1: MVP — 预计 2 周

**目标**: `invoke_agent` 基础功能可用

- [ ] 后端：`app/mcp_servers/subagent_server.py` — MCP 工具定义和请求处理
- [ ] 后端：`app/services/subagent/executor.py` — SubAgent 执行引擎
- [ ] 后端：`app/services/subagent/context_builder.py` — SubAgent 上下文构建
- [ ] 后端：`app/services/subagent/security.py` — 安全检查（嵌套深度、频率限制、循环检测）
- [ ] 后端：在 `MCPServerManager` 中注册 SubAgent 工具
- [ ] 后端：SubAgent 消息记录（内联模式）
- [ ] 后端：Prompt 注入（`<subAgentCapability>` 段）
- [ ] 前端：SubAgent 消息卡片组件
- [ ] 前端：自主任务启动面板 SubAgent 开关

### Phase 2: 并行 + ODM 集成 — 预计 2 周

- [ ] `invoke_agents` 并行调用实现（`asyncio.gather`）
- [ ] ODM 约束集成 — 调用目标验证
- [ ] SubAgent 嵌套支持（SubAgent 可调用 SubSubAgent）
- [ ] Token 用量统计和展示
- [ ] 子会话记录模式（可选）

### Phase 3: 增强 — 预计 1 周

- [ ] SubAgent 调用历史面板
- [ ] 调用关系可视化（调用图）
- [ ] 性能优化（结果缓存、同质请求合并）
- [ ] SubAgent 配置模板（预设常用调用模式）

---

## 5. 文件结构

```
backend/app/
├── mcp_servers/
│   └── subagent_server.py              # [新增] SubAgent MCP 工具服务器
├── services/
│   └── subagent/                       # [新增]
│       ├── __init__.py
│       ├── executor.py                 # SubAgent 执行引擎
│       ├── context_builder.py          # 上下文构建（prompt 组装）
│       └── security.py                 # 安全检查与限制
├── services/conversation/
│   └── prompt_builder.py              # [修改] 注入 <subAgentCapability>
└── __init__.py                        # [修改] 注册 SubAgent MCP

frontend/src/
├── pages/actiontask/components/
│   ├── SubAgentMessageCard.tsx         # [新增] SubAgent 调用消息卡片
│   └── AutonomousTaskModal.tsx         # [修改] 增加 SubAgent 开关
├── components/chat/
│   └── MessageItem.tsx                 # [修改] 渲染 SubAgent 消息类型
```

---

## 6. 对比分析

### 6.1 与现有 `dynamic` 模式的区别

| 维度 | dynamic（自主调度） | SubAgent |
|------|---------------------|----------|
| 触发方式 | 设置 `nextAgent` 变量 | 工具调用 `invoke_agent` |
| 执行方式 | 串行传递，调用者结束后目标开始 | 嵌入式，调用者等待结果后继续 |
| 结果回传 | 无直接回传，通过共享变量间接传递 | 直接作为工具结果返回 |
| 并行能力 | 一次只能指定一个 | `invoke_agents` 支持并行多个 |
| 上下文 | 共享完整会话历史 | 独立上下文，只有任务描述 |
| 控制流 | 调用者交出控制权 | 调用者保持控制权 |

### 6.2 与编排模式的区别

| 维度 | 编排模式 | SubAgent |
|------|---------|----------|
| 定义时机 | 预先定义流程图 | 运行时 Agent 自主决策 |
| 灵活性 | 固定流程 | 完全动态 |
| 可预测性 | 高（流程确定） | 低（Agent 自主决策） |
| 适用场景 | 标准化流程 | 开放探索式任务 |

### 6.3 兼容性

SubAgent 功能与现有所有执行模式兼容：

- ✅ `sequential` — Agent 在轮到自己时可以调用 SubAgent
- ✅ `dynamic` — Agent 可以调用 SubAgent 再设置 nextAgent
- ✅ `orchestration` — 编排节点中的 Agent 可以调用 SubAgent
- ✅ `loop` — 每轮都可以使用 SubAgent
- ✅ 手动对话 — 用户对话中 Agent 也可以调用 SubAgent

---

## 7. 技术风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 无限递归 | Agent A→B→A→B... | 嵌套深度限制 + 循环检测 |
| Token 爆炸 | 嵌套调用导致 token 大量消耗 | 每层限制 max_tokens + 总量预算 |
| 延迟累积 | 嵌套调用延迟叠加 | 并行化 + 超时控制 |
| 模型不可靠 | LLM 输出不稳定导致错误调用 | 参数验证 + 错误重试 + 友好报错 |
| 上下文污染 | SubAgent 结果影响主会话方向 | SubAgent 独立上下文 + 结果摘要 |

---

## 8. 设计决策总结

| 决策 | 选择 | 原因 |
|------|------|------|
| 实现层级 | MCP 工具（非调度器任务） | SubAgent 是同步子任务，不需要独立生命周期 |
| 上下文策略 | 独立上下文 | 防止上下文污染，保持角色纯粹 |
| 消息记录 | 内联元数据（默认） | 简单，不增加会话数量 |
| 并行方式 | asyncio.gather | 复用现有异步框架，实现简单 |
| 嵌套控制 | 深度限制 + 循环检测 | 安全优先 |
| ODM 集成 | 可选约束 | 保持灵活性，ODM 不强制 |
