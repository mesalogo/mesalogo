# 编排模式（Workflow Graph）设计方案 - MVP

## 概述

在**行动空间（ActionSpace）详情页**新增"编排"Tab，支持通过 ReactFlow 可视化定义智能体协作流程。

> **KISS 原则**：MVP 只实现最核心的 `start` → `agent` → `end` 线性流程，复杂节点（condition/parallel/loop）放到后续迭代。

## 核心功能

### 数据格式
- **JSON 配置** - 核心数据格式，存储在 `ActionSpace.settings.orchestration`（复用现有 settings 字段，无需数据库迁移）
- **ReactFlow 可视化** - 主要编辑方式

## 架构设计

```
┌─────────────────┐     ┌──────────────┐
│  ReactFlow      │ ←→  │    JSON      │
│  (可视化编辑)    │     │  (核心格式)   │
└─────────────────┘     └──────────────┘
                              ↓
                    ┌──────────────────┐
                    │  后端执行引擎     │
                    │  executor.py     │
                    │  (新增 orchestration 模式)
                    └──────────────────┘
```

## 数据模型

**复用现有 `ActionSpace.settings` 字段**，无需数据库迁移：

```python
# ActionSpace.settings 结构
{
    "background": "...",
    "rules": "...",
    # 新增编排配置
    "orchestration": {
        "enabled": true,
        "nodes": [...],      # 节点列表
        "edges": [...],      # 连线列表
        "reactflow": {...}   # ReactFlow 画布状态（位置等）
    }
}
```

## 节点类型

### MVP Phase 1（核心节点）

| 节点类型 | 说明 | 配置 | 图标 |
|---------|------|------|------|
| `start` | 开始节点 | `{}` | ▶️ |
| `end` | 结束节点 | `{"summary": true/false}` | ⏹️ |
| `agent` | 智能体执行 | `{"role_id": "xxx", "prompt": "..."}` | 🤖 |
| `task` | 任务/指令节点 | `{"instruction": "...", "output_var": "..."}` | 📋 |
| `knowledge` | 知识库查询 | `{"kb_id": "xxx", "query": "...", "top_k": 5}` | 📚 |
| `api` | API调用 | `{"method": "GET/POST", "url": "...", "headers": {}, "body": {}}` | 🔗 |
| `condition` | 条件判断 | `{"condition": "...", "condition_type": "contains/equals/expression"}` | ❓ |

### Phase 2（高级控制流节点）

| 节点类型 | 说明 | 配置 |
|---------|------|------|
| `parallel` | 并行执行 | `{"branches": ["node_id1", "node_id2"], "wait_all": true}` |
| `loop` | 循环执行 | `{"until": "...", "max_iterations": 10}` |
| `delay` | 延时等待 | `{"seconds": 5}` |
| `switch` | 多路分支 | `{"cases": [{"value": "...", "target": "node_id"}], "default": "node_id"}` |

### 节点详细说明

#### 1. `start` 开始节点
- 每个流程必须有且只有一个
- 可配置输入变量定义
- 只有一个输出连接点

#### 2. `end` 结束节点
- 每个流程必须有至少一个
- 可选触发总结
- 只有一个输入连接点

#### 3. `agent` 智能体节点
- 调用指定角色的智能体执行任务
- 支持提示词模板变量
- 输出存入 `{{node_id.output}}`

#### 4. `task` 任务节点
- 纯指令执行，不绑定特定智能体
- 由系统默认智能体执行
- 适合简单的数据处理、格式转换等

#### 5. `knowledge` 知识库节点
- 查询指定知识库
- 返回相关文档片段
- 可配置 top_k、相似度阈值等

#### 6. `api` API调用节点
- 调用外部 HTTP API
- 支持 GET/POST/PUT/DELETE
- 支持请求头、请求体配置
- 响应存入变量供后续节点使用

#### 7. `condition` 条件判断节点
- **两个输出连接点**：`true` 分支和 `false` 分支
- 支持多种条件类型：
  - `contains`: 包含判断，如 `{{prev_output}} contains '风险'`
  - `equals`: 相等判断，如 `{{task_var.status}} == 'approved'`
  - `expression`: 表达式判断，如 `{{task_var.score}} > 80`
  - `not_empty`: 非空判断
  - `regex`: 正则匹配
- 配置示例：
```json
{
  "condition": "{{prev_output}} contains '需要审核'",
  "condition_type": "contains",
  "true_label": "需要审核",
  "false_label": "直接通过"
}
```

## JSON Schema（简化版）

```json
{
  "enabled": true,
  "nodes": [
    {"id": "start-1", "type": "start", "position": {"x": 0, "y": 100}},
    {"id": "agent-1", "type": "agent", "position": {"x": 200, "y": 100}, "data": {"role_id": "xxx", "prompt": "分析数据"}},
    {"id": "agent-2", "type": "agent", "position": {"x": 400, "y": 100}, "data": {"role_id": "yyy", "pt": "审核结果"}},
    {"id": "end-1", "type": "end", "position": {"x": 600, "y": 100}, "data": {"summary": true}}
  ],
  "edges": [
    {"id": "e1", "source": "start-1", "target": "agent-1"},
    {"id": "e2", "source": "agent-1", "target": "agent-2"},
    {"id": "e3", "source": "agent-2", "target": "end-1"}
  ]
}
```

## 变量模板语法（MVP 简化）

| 语法 | 说明 |
|------|------|
| `{{task_var.xxx}}` | 任务环境变量（复用现有 ActionTaskEnvironmentVariable） |
| `{{prev_output}}` | 上一步智能体的输出 |

> 复杂变量语法（`{{step_N_output}}`、`{{input.xxx}}`）放 Phase 2

## 后端实现

### 1. 新增执行模式

在 `scheduler/task_adapter.py` 的 `_convert_config` 中新增：

```python
elif task_type == 'orchestration':
    trigger_type = "manual"
    execution_mode = "orchestration"
    execution_config = {
        "topic": config.get("topic", ""),
        "orchestration": config.get("orchestration", {}),
    }
```

### 2. 执行器（executor.py）

在 `execute_round` 中新增分支：

```python
async def execute_round(task: 'Task') -> None:
    mode = task.execution_mode
    
    if mode == "orchestration":
        await _execute_orchestration(task)
    elif mode == "sequential" or mode == "loop":
        await _execute_sequential(task)
    # ...
```

### 3. 编排执行函数

```python
async def _execute_orchestration(task: 'Task') -> None:
    """编排模式执行 - MVP 版本（线性流程）"""
    cfg = task.execution_config or {}
    orch = cfg.get('orchestration', {})
    nodes = orch.get('nodes', [])
    edges = orch.get('edges', [])
    
    # 构建执行顺序（拓扑排序，MVP 简化为线性）
    execution_order = _build_execution_order(nodes, edges)
    
    prev_output = ""
    step = 0
    for node in execution_order:
        if task.cancel_event and task.cancel_event.is_set():
            break
        
        node_type = node.get('type')
        if node_type == 'start':
            continue
        elif node_type == 'end':
            if node.get('data', {}).get('summary'):
                await execute_summarize_phase(task)
            break
        elif node_type == 'agent':
            step += 1
            _send_round_info(task, step, len([n for n in nodes if n['type'] == 'agent']))
            prev_output = await _execute_orchestration_agent_node(task, node, prev_output, step)


async def _execute_orchestration_agent_node(task: 'Task', node: dict, prev_output: str, step: int) -> str:
    """执行智能体节点"""
    data = node.get('data', {})
    role_id = data.get('role_id')
    prompt_template = data.get('prompt', '')
    
    # 渲染模板
    prompt = prompt_template.replace('{{prev_output}}', prev_output)
    prompt = _render_task_variables(task, prompt)
    
    # 查找对应的 Agent
    agent = await _find_agent_by_role(task, role_id)
    if not agent:
        logger.warning(f"Agent with role_id {role_id} not found")
        return prev_output
    
    # 发送 Agent 信息
    total_agents = len([n for n in task.execution_config.get('orchestration', {}).get('nodes', []) if n['type'] == 'agent'])
    _send_agent_info(task, agent, round_num=step, total_rounds=total_agents, response_order=step, total_agents=total_agents)
    
    # 复用现有的 _process_agent_response
    task.context["dynamic_prompt"] = f"<div style='color: #A0A0A0;'>@{agent['name']} {prompt}</div>\n"
    await _process_agent_response(task, agent)
    
    # 获取输出（从最新消息）
    return await _get_last_agent_output(task, agent['id'])


def _build_execution_order(nodes: list, edges: list) -> list:
    """构建执行顺序（MVP: 简单线性排序）"""
    start_node = next((n for n in nodes if n['type'] == 'start'), None)
    if not sta
        return nodes
    
    order = []
    current_id = start_node['id']
    visited = set()
    
    while current_id and current_id not in visited:
        visited.add(current_id)
        node = next((n for n in nodes if n['id'] == current_id), None)
        if node:
            order.append(node)
        edge = next((e for e in edges if e['source'] == current_id), None)
        current_id = edge['target'] if edge else None
    
    return order


async def _find_agent_by_role(task: 'Task', role_id: str) -> dict:
    """根据 role_id 查找 Agent"""
 = await _get_task_agents(task)
    flask_app = task.context.get('flask_app')
    
    def _query():
        from app.models import Agent
        for agent in agents:
            agent_obj = Agent.query.get(agent['id'])
            if agent_obj and agent_obj.role_id == role_id:
                return agent
        return None
    
    if flask_app:
        with flask_app.app_context():
            return _query()
    return None


def _render_task_variables(task: 'Task', template: str) -> str:
    """渲染任务变量"""
    import re
    flask_app = task.context.get('flask_app')
    
    def _query():        from app.models import ActionTaskEnvironmentVariable
        variables = ActionTaskEnvironmentVariable.query.filter_by(
            action_task_id=task.action_task_id
        ).all()
        result = template
        for var in variables:
            result = result.replace(f'{{{{task_var.{var.name}}}}}', str(var.value or ''))
        return result
    
    if flask_app:
        with flask_app.app_context():
            return _query()
    return template


async def _get_last_agent_output(task: 'Task', agent_id: str) -> str:
    """获取智能体最后一条消息"""
    flask_app = task.context.get('flask_app')
    
    def _query():
        from app.models import Message
        msg = Message.query.filter_by(
            conversation_id=task.conversation_id,
            agent_id=agent_id
        ).order_by(Message.created_at.desc()).first()
        return msg.content if msg else ""
    
    if flask_app:
        with flask_app.app_context():
            return _query()
    return ""
```

### 4. 自主任务启动时的模式判断

修改 `task_adapter.py` 的 `create_task_from_autonomous`：

```python
def create_task_from_autonomous(...):
    # 检查 ActionSpace 是否配置了编排
    action_space = ActionSpace.query.get(action_task.action_space_id)
    if action_space and action_space.settings and action_space.settings.get('orchestration', {}).get('enabled'):
        task_type = 'orchestration'
        config['orchestration'] = action_space.settings['orchestration']
    else:
        task_type = config.get('execution_mode', 'auto_conversation')
    # ...
```

### 5. API

复用现有 `action_space_service.py` 的 update 方法，无需新增 API：

```python
# 前端调用现有接口
PUT /api/action-spaces/{id}
Body: {
    "settings": {
        ...existing_settings,
        "orchestration": {...}
    }
}
```

## 前端实现

### 目录结构

```
frontend/src/pages/actionspace/orchestration/
├── OrchestrationTab.tsx         # Tab 容器
├── OrchestrationEditor.tsx      # ReactFlow 编辑器
├── nodes/
│   ├── StartNode.tsx
│   ├── EndNode.tsx
│   └── AgentNode.tsx
├── NodePalette.tsx              # 左侧节点面板
└── NodeConfigPanel.tsx          # 右侧配置面板
```

### UI 布局

```
┌─────────────────────────────────────────────────────────┐
│ [保存]                                                   │
├──────────┬────────────────────────────┬─────────────────┤
│ 节点面板  │      ReactFlow 画布        │   配置面板      │
│          │                            │                 │
│ [开始]   │   ┌───┐    ┌───┐    ┌───┐ │  选中节点配置   │
│ [智能体] │   │ S │───▶│ A │───▶│ E │ │                 │
│ [结束]   │   └───┘    └───┘    └───┘ │  - 角色选择     │
│          │                            │  - 提示词       │
└──────────┴────────────────────────────┴─────────────────┘
```

### 关键组件

**OrchestrationTab.tsx**（集成到 ActionSpaceDetail）：

```tsx
import React, { useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import OrchestrationEditor from './OrchestrationEditor';
import NodePalette from './NodePalette';
import NodeConfigPanel from './NodeConfigPanel';

const OrchestrationTab = ({ actionSpaceId, settings, roles, onSave }) => {
  const orchestration = settings?.orchestration || { enabled: false, nodes: [], edges: [] };
  const [nodes, setNodes] = useState(orchestration.nodes || []);
  const [edges, setEdges] = useState(orchestration.edges || []);
  const [selectedNode, setSelectedNode] = useState(null);
  
  const handleSave = async () => {
    try {
      await actionSpaceAPI.update(actionSpaceId, {
        settings: {
          ...settings,
          orchestration: { enabled: true, nodes, edges }
        }
      });
      message.success('编排配置已保存');
      onSave?.();
    } catch (error) {
      message.error('保存失败');
    }
  };
  
  const handleNodeUpdate = useCallback((nodeId, newData) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
  }, []);
  
  return (
    <div style={{ height: '600px' }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
      </div>
      <div style={{ display: 'flht: 'calc(100% - 48px)', gap: 16 }}>
        <NodePalette />
        <OrchestrationEditor 
          nodes={nodes} 
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          onNodeSelect={setSelectedNode}
        />
        <NodeConfigPanel 
          node={selectedNode}
          roles={roles}
          onUpdate={handleNodeUpdate}
        />
      </div>
    </div>
  );
};

export default OrchestrationTab;
```

**OrchestrationEditor.tsx**：

```tsx
import React, { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';
import AgentNode from './nodes/AgentNode';

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  agent: AgentNode,
};

const OrchestrationEditor = ({ nodes: initialNodes, edges: initialEdges, onNodesChange, onEdgesChange, onNodeSelect }) => {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  const handleNodesChange = useCallback((changes) => {
    onNodesChangeInternal(changes);
    onNodesChange?.(nodes);
  }, [onNodesChangeInternal, onNodesChange, nodes]);

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChangeInternal(changes);
    onEdgesChange?.(edges);
  }, [onEdgesChangeInternal, onEdgesChange, edges]);

  const onNodeClick = useCallback((event, node) => {
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  return (
    <div style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={edge   onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};

export default OrchestrationEditor;
```

**AgentNode.tsx**：

```tsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { UserOutlined } from '@ant-design/icons';

const AgentNode = ({ data, selected }) => {
  return (
    <div style={{
      padding: '10px 15px',
      borderRadius: 8,
      border: selected ? '2px solid #1677ff' : '1px solid #d9d9d9',
      background: '#fff',
      minWidth: 150,
    }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
        <UserOutlined style={{ marginRight: 4 }} />
        {data?.roleName || '选择角色'}
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        {data?.prompt?.substring(0, 30) || '配置提示词...'}
        {data?.prompt?.length > 30 ? '...' : ''}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export default AgentNode;
```

### 集成到 ActionSpaceDetail.tsx

在现有 Tabs 中新增
```tsx
{
  key: 'orchestration',
  label: '编排',
  children: (
    <OrchestrationTab
      actionSpaceId={id}
      settings={selectedSpace.settings}
      roles={selectedSpace.roles}
      onSave={fetchSpaceDetail}
    />
  )
}
```

## 实现计划（调整后）

### Phase 1: MVP（3-4天）

**后端（1.5天）**：
- [ ] `_execute_orchestration()` 函数
- [ ] `_execute_orchestration_agent_node()` 函数
- [ ] `_build_execution_order()` 拓扑排序
- [ ] `_find_agent_by_role()` / `_render_task_variables()` / `_get_last_agent_output()`
- [ ] 修改 `task_adapter.py` 支持 orchestration 模式

**前端（2天）**：
- [ ] OrchestrationTab 组件
- [ ] OrchestrationEditor（ReactFlow 基础）
- [ ] StartNode / EndNode / AgentNode
- [ ] NodePalette 节点面板
- [ ] NodeConfigPanel 配置面板
- [ ] 集成到 ActionSpaceDetail

### Phase 2: 增强（可选，3-4天）
- [ ] condition 条件节点
- [ ] parallel 并行节点
- [ ] 执行状态实时高亮
- [ ] 流程验证（连通性检查）
- [ ] 更丰富的变量模板

### Phase 3: 高级（可选）
- [ ] loop 循环节点
- [ ] JSON 代码编辑器
- [ ] 导入/导出
- [ ] 流程模板库

## 与现有功能集成

| 功能 | 集成方式 |
|------|---------|
| 角色管理 | AgentNode 只能选择 ActionSpace 已关联的角色 |
| 环境变量 | 通过 `{{task_var.xxx}}` 读取 ActionTaskEnvironmentVariable |
| 监督者 | 复用现有 supervisor_event_manager |
| SSE 消息 | 复用现有 `_send_agent_info`、`_send_round_info` |

## 错误处理

```python
async def _execute_orchestratiok') -> None:
    try:
        # ... 执行逻辑
    except Exception as e:
        logger.error(f"Orchestration execution error: {e}")
        await send_task_message(task, "system", f"编排执行出错: {str(e)}")
        task.cancel_event.set()
```

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 无限循环 | MVP 不支持 loop，Phase 2 加 max_iterations 限制 |
| 节点找不到角色 | 跳过该节点，记录警告日志，发送系统消息 |
| 空流程 | 前端校验至少有 start → end |
| ReactFlow 学习成本 | 项目已安装 @xyflow/react，参考官方示例 |
