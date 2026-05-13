# 自主调度模式（Autonomous Scheduling）重构计划

## 问题背景

### 当前设计的问题

1. **轮次概念与自主调度冲突**
   - 当前 scheduler.py 的主循环基于"轮次"（round）概念
   - 每次循环执行 `execute_round`，然后增加 `current_round`
   - 但自主调度模式下，每个智能体的执行应该是独立的"步骤"，而不是"轮次"

2. **调度逻辑混乱**
   - `_execute_dynamic` 在第一轮执行完后，调度器就增加了轮数
   - 然后下一次循环时，才去检查 nextAgent
   - 导致"轮数"和"步骤"的概念混淆

3. **日志证据**
   ```
   [DEBUG] 23:34:39 - Task state persisted: ..., round=1
   [DEBUG] 23:34:48 - Task state persisted: ..., round=2  # 智能体还没执行就增加了轮数
   [INFO] 23:34:48 - Task stopped by user: ..., rounds: 2
   ```

### 根本原因

scheduler.py 的设计是为 sequential 模式优化的：
- 一轮 = 所有智能体按顺序执行一遍
- 适合固定顺序的多智能体协作

但 dynamic 模式的语义不同：
- 一步 = 一个智能体执行一次
- 下一个智能体由 nextAgent 变量决定
- 没有固定的"轮次"概念

## 解决方案：KISS 原则

### 核心思想

**在 executor 中实现完整的自主调度循环**，让 scheduler 只调用一次 `execute_round`。

这是最简单的方案，因为：
1. 不需要修改 scheduler 的核心逻辑
2. 只需要修改 `_execute_dynamic` 函数
3. 对其他执行模式（sequential, loop, parallel）没有影响

### 设计方案

```
scheduler._run_task()
    │
    ├── 对于 sequential/loop 模式：
    │   └── while 循环，每轮执行所有智能体
    │
    └── 对于 dynamic 模式：
        └── 只调用一次 execute_round
            └── _execute_dynamic 内部实现完整循环：
                ├── 步骤1：执行第一个智能体
                ├── 检查 nextAgent
                ├── 步骤2：执行 nextAgent 指定的智能体
                ├── 检查 nextAgent
                ├── ...
                └── 直到 nextAgent 为空或达到最大步骤数
```

### 具体修改

#### 1. 修改 scheduler.py 的 `_run_task` 方法

```python
async def _run_task(self, task: Task):
    # ... 初始化代码 ...
    
    try:
        # ... 计划阶段 ...
        
        # 对于 dynamic 模式，只执行一次（内部有自己的循环）
        if task.execution_mode == "dynamic":
            _send_round_info(task, 1, max_rounds)
            await self._execute_with_timeout_and_retry(task)
            # dynamic 模式的 current_round 由 executor 内部管理
        else:
            # 其他模式保持原有逻辑
            while not task.cancel_event.is_set():
                # ... 原有的轮次循环逻辑 ...
        
        # ... 总结阶段和结束处理 ...
```

#### 2. 修改 executor.py 的 `_execute_dynamic` 函数

```python
async def _execute_dynamic(task: 'Task') -> None:
    """
    动态Agent选择执行（autonomous_scheduling）
    
    在一次调用中完成整个自主调度流程：
    - 执行第一个智能体
    - 检查 nextAgent，执行下一个
    - 重复直到 nextAgent 为空或达到最大步骤数
    """
    from .triggers import wait_for_next_agent_variable
    
    cfg = task.execution_config or {}
    max_steps = cfg.get('max_rounds', 50)  # 重命名为 max_steps 更准确
    topic = cfg.get('topic', '')
    enable_planning = cfg.get('enable_planning', False)
    
    agents = await _get_task_agents(task)
    if not agents:
        logger.warning(f"Task {task.id} has no agents for dynamic execution")
        return
    
    # 步骤计数器
    step = 0
    
    # 第一步：执行第一个智能体
    agent = agents[0]
    next_todo = topic or '请基于各自角色和知识，进行自主调度协作'
    
    while not task.cancel_event.is_set() and step < max_steps:
        step += 1
        task.current_round = step  # 更新步骤数（用于显示和记录）
        
        # 发送步骤信息
        _send_round_info(task, step, max_steps)
        _send_agent_info(task, agent, round_num=step, total_rounds=max_steps,
                        response_order=1, total_agents=len(agents))
        
        # 构建提示
        if step == 1:
            prompt = f"""你正在开始这个协作任务。{' 请参考共享工作区中的计划。' if enable_planning else ''}

任务主题：{topic}

请完成你的任务部分。

⚠️ **重要提醒**：完成任务后，你**必须**使用 `set_task_var` 工具设置以下两个变量：
1. `nextAgent` - 下一个行动的智能体名称（从参与者列表中选择，或设为空字符串""结束任务）
2. `nextAgentTODO` - 给下一个智能体的任务说明

如果不设置这些变量，任务将自动停止。"""
        else:
            prompt = f"""上一个智能体给你分配了以下任务：{next_todo}

任务主题：{topic}

请完成分配给你的任务。

⚠️ **重要提醒**：完成任务后，你**必须**使用 `set_task_var` 工具设置以下两个变量：
1. `nextAgent` - 下一个行动的智能体名称（从参与者列表中选择，或设为空字符串""结束任务）
2. `nextAgentTODO` - 给下一个智能体的任务说明

如果不设置这些变量，任务将自动停止。"""
        
        # 执行智能体
        task.context["dynamic_prompt"] = prompt
        await _process_agent_response(task, agent)
        
        # 检查是否被取消
        if task.cancel_event.is_set():
            break
        
        # 等待并检查 nextAgent
        next_info = await wait_for_next_agent_variable(task)
        
        if next_info.get("should_stop", False):
            logger.info(f"Task {task.id} stopping at step {step}: nextAgent not set or empty")
            task.context["stop_reason"] = "next_agent_not_set"
            await send_task_message(task, "system", 
                "未指定下一个智能体，任务已停止。（提示：智能体应使用 set_task_var 工具设置 nextAgent 变量）")
            task.cancel_event.set()
            break
        
        # 查找下一个智能体
        next_agent = await _find_agent_by_name(task, next_info["next_agent"])
        if not next_agent:
            logger.warning(f"Task {task.id} agent not found: {next_info['next_agent']}")
            task.context["stop_reason"] = "agent_not_found"
            await send_task_message(task, "system", f"找不到智能体 '{next_info['next_agent']}'，任务已停止。")
            task.cancel_event.set()
            break
        
        # 准备下一步
        agent = next_agent
        next_todo = next_info.get("next_todo", "继续执行任务")
        
        # 清除变量，准备下一步检测
        await _clear_next_agent_variable(task)
    
    # 检查是否达到最大步骤数
    if step >= max_steps and not task.cancel_event.is_set():
        logger.info(f"Task {task.id} reached max steps: {max_steps}")
        task.context["stop_reason"] = "max_steps"
        await send_task_message(task, "system", f"已达到最大步骤数 {max_steps}，任务停止。")
```

#### 3. 修改 scheduler.py 的 `_should_stop` 方法

对于 dynamic 模式，不需要在 scheduler 层面检查停止条件，因为 executor 内部已经处理了。

```python
def _should_stop(self, task: Task) -> bool:
    """根据 execution_config 判断是否停止"""
    # dynamic 模式的停止逻辑在 executor 内部处理
    if task.execution_mode == "dynamic":
        return True  # 总是返回 True，因为 executor 只调用一次
    
    # 其他模式保持原有逻辑
    cfg = task.execution_config or {}
    # ...
```

### 优点

1. **KISS 原则**：最小化修改，只改动必要的代码
2. **向后兼容**：不影响其他执行模式（sequential, loop, parallel）
3. **语义清晰**：dynamic 模式的"步骤"概念在 executor 内部完整实现
4. **易于理解**：一个函数完成整个自主调度流程

### 实施步骤

1. [ ] 修改 `executor.py` 的 `_execute_dynamic` 函数
2. [ ] 修改 `scheduler.py` 的 `_run_task` 方法，对 dynamic 模式特殊处理
3. [ ] 修改 `scheduler.py` 的 `_should_stop` 方法
4. [ ] 添加 `max_steps` 的 stop_reason 处理
5. [ ] 测试自主调度模式
6. [ ] 验证其他模式不受影响

### 测试场景

1. **正常流程**：智能体正确设置 nextAgent，任务按预期流转
2. **未设置 nextAgent**：智能体未设置 nextAgent，任务在超时后停止
3. **设置空 nextAgent**：智能体设置 nextAgent=""，任务正常结束
4. **找不到智能体**：nextAgent 指定的智能体不存在，任务停止
5. **达到最大步骤数**：任务在达到 max_steps 后停止
6. **用户手动停止**：用户在任务执行过程中停止任务

## 前端修改

### 需要修改的文件

`frontend/src/pages/actiontask/components/AutonomousTaskModal.tsx`

### 概念说明

**最大步骤数 = 智能体发言次数上限**

在自主调度模式下：
- 每次一个智能体发言 = 1 步
- 发言完成后，该智能体设置 `nextAgent` 指定下一个发言的智能体
- 如此循环，直到任务结束

**举例**（最大步骤数=50）：
```
步骤1: 智能体A发言 → 设置 nextAgent="B"
步骤2: 智能体B发言 → 设置 nextAgent="A"
步骤3: 智能体A发言 → 设置 nextAgent="C"
...
步骤50: 达到上限，任务自动停止
```

**任务结束条件**：
1. 智能体设置 `nextAgent=""` 主动结束
2. 智能体未设置 `nextAgent`（超时后自动停止）
3. 达到最大步骤数（安全限制）
4. 达到超时时间

### 当前问题

自主调度模式的设置界面中，"最大轮数"的标签和描述不准确：

```tsx
<Form.Item
  name="maxRounds"
  label="最大轮数"  // 应该改为"最大发言次数"
  initialValue={50}
  tooltip="防止无限循环的安全限制"  // 描述不够清晰
>
```

### 修改内容

1. **将"最大轮数"改为"最大步骤数"**
   - 因为自主调度模式下，每个智能体执行一次算一步，不是传统的"轮次"概念

2. **更新描述和提示**
   - 更清晰地说明"步骤"的含义
   - 说明 nextAgent 的作用

3. **具体修改**

```tsx
// 修改前
<Form.Item
  name="maxRounds"
  label="最大轮数"
  initialValue={50}
  rules={[
    { required: true, message: '请输入最大轮数' },
    {
      validator: (_, value) => {
        if (value === undefined || value === null) return Promise.resolve();
        if (value >= 1 && value <= 100) return Promise.resolve();
        return Promise.reject(new Error('最大轮数必须在1-100之间'));
      }
    }
  ]}
  tooltip="防止无限循环的安全限制"
>
  <Space.Compact style={{ width: '100%' }}>
    <InputNumber
      min={1}
      max={100}
      style={{ width: '100%' }}
    />
    <Button disabled style={{ pointerEvents: 'none' }}>轮</Button>
  </Space.Compact>
</Form.Item>

// 修改后
<Form.Item
  name="maxRounds"
  label="最大步骤数"
  initialValue={50}
  rules={[
    { required: true, message: '请输入最大步骤数' },
    {
      validator: (_, value) => {
        if (value === undefined || value === null) return Promise.resolve();
        if (value >= 1 && value <= 100) return Promise.resolve();
        return Promise.reject(new Error('最大步骤数必须在1-100之间'));
      }
    }
  ]}
  tooltip="每个智能体执行一次算一步，达到最大步骤数后任务自动停止"
>
  <Space.Compact style={{ width: '100%' }}>
    <InputNumber
      min={1}
      max={100}
      style={{ width: '100%' }}
    />
    <Button disabled style={{ pointerEvents: 'none' }}>步</Button>
  </Space.Compact>
</Form.Item>
```

4. **更新说明文字**

```tsx
// 修改前
<p style={{ marginBottom: '16px' }}>智能体通过更新nextAgent和nextAgentTODO变量来自主决定下一个发言者</p>

// 修改后
<p style={{ marginBottom: '16px' }}>
  智能体通过设置 <code>nextAgent</code> 和 <code>nextAgentTODO</code> 变量来决定下一个执行的智能体。
  每个智能体执行一次算一步，任务在以下情况停止：
  <ul style={{ marginTop: '8px', marginBottom: 0 }}>
    <li>智能体设置 <code>nextAgent=""</code>（空字符串）</li>
    <li>智能体未设置 <code>nextAgent</code>（超时后自动停止）</li>
    <li>达到最大步骤数</li>
    <li>达到超时时间</li>
  </ul>
</p>
```

## 相关文件

### 后端
- `backend/app/services/scheduler/scheduler.py` - 任务调度器
- `backend/app/services/scheduler/executor.py` - 执行器
- `backend/app/services/scheduler/triggers.py` - 触发器（wait_for_next_agent_variable）
- `backend/app/services/conversation/prompt_builder.py` - 系统提示词构建

### 前端
- `frontend/src/pages/actiontask/components/AutonomousTaskModal.tsx` - 自主任务配置模态框

## 智能体视角的优化建议

基于对系统现有功能的调研，以下是经过验证的优化建议：

### 系统已有功能（无需重复实现）

通过调研 `prompt_builder.py` 和 `executor.py`，发现系统已经具备以下功能：

1. **参与者列表**：系统提示词中已包含 `Current Space Participant Role List`，列出所有参与者及其角色
2. **自主调度说明**：`<autonomousScheduling>` 部分已说明 nextAgent 和 nextAgentTODO 的使用方法
3. **工作区协作**：`<agentWorkspace>` 部分已包含工作区结构、访问控制和使用说明
4. **对话历史上下文**：`other_agents_context` 参数可传递其他智能体的历史消息
5. **角色定义**：`<roleDefinition>` 部分已包含智能体名称、角色和 ID
6. **环境变量感知**：具有 `environment_sensing` 能力的角色可以看到任务环境变量

### 需要优化的地方

#### 1. executor.py 中的提示词缺少步骤进度信息

**现状**：当前 `_execute_dynamic` 中的提示词只告诉智能体任务主题和上一个智能体分配的任务，但没有告诉：
- 当前是第几步
- 最多还能执行多少步

**优化建议**：在 executor.py 的提示词中添加步骤进度

```python
# 在 _execute_dynamic 中
prompt = f"""上一个智能体给你分配了以下任务：{next_todo}

任务主题：{topic}

📊 **任务进度**：当前第 {step} 步（最多 {max_steps} 步）

请完成分配给你的任务。
...
"""
```

#### 2. 任务结束指引不够明确

**现状**：系统提示词中说明了"Set to empty string "" to end the task"，但没有说明什么情况下应该结束任务。

**优化建议**：在 `prompt_builder.py` 的 `<autonomousScheduling>` 部分添加任务结束指引

```python
"""
### When to End the Task
Set nextAgent to "" (empty string) when:
- The task objective has been fully achieved
- All necessary reviews/evaluations are complete
- A consensus or final decision has been reached
- No further agent participation is needed
"""
```

#### 3. 错误恢复机制

**现状**：如果智能体设置了错误的 nextAgent（如拼写错误），任务会直接停止，错误消息只显示"找不到智能体 'xxx'，任务已停止"。

**优化建议**：在 `_execute_dynamic` 中提供更友好的错误提示

```python
if not next_agent:
    agents = await _get_task_agents(task)
    agent_names = [a["name"] for a in agents]
    await send_task_message(task, "system", 
        f"找不到智能体 '{next_info['next_agent']}'。可选的智能体有：{', '.join(agent_names)}")
```

#### 4. 调度历史追踪（可选）

**现状**：智能体可以通过 `other_agents_context` 看到其他智能体的对话历史，但没有结构化的调度历史。

**优化建议**：在 `task.context` 中维护调度历史，并在提示词中展示（可选功能，根据需要实现）

### 实施优先级

1. **高优先级**（直接影响任务成功率）：
   - 在 executor.py 提示词中添加步骤进度信息
   - 在 prompt_builder.py 中添加任务结束指引

2. **中优先级**（提升用户体验）：
   - 改进错误提示，列出可选智能体

3. **低优先级**（锦上添花）：
   - 调度历史追踪

---

## 已完成的修改（2025-12-23）

### 1. 修复 nextAgent 变量清空时机问题 ✅

**问题**：之前的代码在每轮结束后立即清空 nextAgent 变量，导致下一轮检测不到。

**修改文件**：`backend/app/services/scheduler/executor.py`

**修改内容**：
- 第一轮开始时：清空可能存在的旧变量
- 后续轮次：在成功读取并找到智能体后再清空变量
- 智能体响应后：不再清空变量

```python
if task.current_round == 0:
    # 第一轮：先清空可能存在的旧变量
    await _clear_next_agent_variable(task)
    agent = agents[0]
else:
    # 后续轮次：等待并读取 nextAgent
    next_info = await wait_for_next_agent_variable(task)
    # ...找到智能体后...
    # 成功读取并找到智能体后，清空变量，准备下一轮检测
    await _clear_next_agent_variable(task)
```

### 2. 修改前端 Modal 的标签和说明 ✅

**修改文件**：`frontend/src/pages/actiontask/components/AutonomousTaskModal.tsx`

**修改内容**：
- "最大轮数" → "最大发言次数"
- 单位 "轮" → "次"
- 添加了详细的任务停止条件说明

### 3. 修改自主调度模式的提示词 ✅

**修改文件**：`backend/app/services/scheduler/executor.py`

**修改内容**：
- `_send_agent_info` 函数添加了 `is_dynamic_mode` 参数
- 自主调度模式下显示"智能体 xxx 开始执行"而不是"轮到智能体 xxx 发言"

### 4. 任务结束时清理 nextAgent 变量 ✅

**修改文件**：`backend/app/services/scheduler/scheduler.py`

**修改内容**：
- 在 `_run_task` 方法的 `finally` 块中添加了对 dynamic 模式的变量清理调用
- 新增 `_cleanup_dynamic_variables` 方法

```python
async def _cleanup_dynamic_variables(self, task: Task):
    """
    清理自主调度模式的变量（nextAgent, nextAgentTODO）
    在任务结束时调用，确保下次启动任务时不会受到旧变量的影响
    """
```

### 5. 修复任务停止消息问题 ✅

**修改文件**：`backend/app/services/scheduler/scheduler.py`

**修改内容**：
- 根据 `stop_reason` 发送不同的停止消息
- `next_agent_not_set`：不重复发送消息（executor 已发送）
- `agent_not_found`：不重复发送消息（executor 已发送）
- `conditions_met`：发送"停止条件已满足，任务完成"
- `max_runtime`：发送"已达到最大运行时间，任务停止"
- 其他：发送"任务被用户停止"

### 变量清理时机总结

| 时机 | 操作 | 说明 |
|------|------|------|
| 任务开始时（第一轮） | 清空 | 清空可能存在的旧变量 |
| 成功读取后 | 清空 | 在成功读取并找到智能体后清空，准备下一轮检测 |
| 任务结束时 | 清空 | 无论任务是正常完成、被停止还是失败，都会清理变量 |

### 待完成的优化（可选）

- [x] 在提示词中添加步骤进度信息
- [x] 改进错误提示，列出可选智能体
- [ ] 在 prompt_builder.py 中添加任务结束指引
- [ ] 调度历史追踪

---

## 重构完成（2025-12-23 - KISS 方案实施）

### 核心改动：将完整循环移入 executor

按照 PLAN.md 中描述的 KISS 方案，完成了以下重构：

#### 1. scheduler.py 的 `_run_task` 方法

**修改内容**：对 dynamic 模式特殊处理，只调用一次 `execute_dynamic_loop`

```python
# 对于 dynamic 模式，只调用一次 execute_round（内部有完整循环）
if task.execution_mode == "dynamic":
    from .executor import execute_dynamic_loop
    await execute_dynamic_loop(task, max_rounds, max_runtime)
else:
    # 其他模式保持原有的轮次循环逻辑
    while not task.cancel_event.is_set():
        # ... 原有逻辑 ...
```

#### 2. executor.py 新增 `execute_dynamic_loop` 函数

**功能**：在一次调用中完成整个自主调度流程

```python
async def execute_dynamic_loop(task: 'Task', max_steps: int, max_runtime: int) -> None:
    """
    自主调度模式的完整执行循环（autonomous_scheduling）
    
    在一次调用中完成整个自主调度流程：
    - 执行第一个智能体
    - 检查 nextAgent，执行下一个
    - 重复直到 nextAgent 为空或达到最大步骤数
    """
```

**内部循环逻辑**：
1. 清空旧变量
2. 执行第一个智能体
3. while 循环：
   - 检查暂停/取消/超时
   - 发送步骤信息
   - 构建提示（包含步骤进度）
   - 执行智能体
   - 持久化状态
   - 等待 nextAgent 变量
   - 查找下一个智能体（找不到时列出可选智能体）
   - 清空变量，准备下一步
4. 检查是否达到最大步骤数

#### 3. 提示词优化

**添加步骤进度信息**：
```
📊 **任务进度**：当前第 {step} 步（最多 {max_steps} 步）
```

**改进错误提示**：
```python
await send_task_message(task, "system", 
    f"找不到智能体 '{next_info['next_agent']}'，任务已停止。可选的智能体有：{', '.join(agent_names)}")
```

#### 4. 保留兼容性

`_execute_dynamic` 函数保留，内部调用 `execute_dynamic_loop`，确保通过 `execute_round` 调用时仍能正常工作。

### 与之前增量修复的区别

| 方面 | 之前（增量修复） | 现在（KISS 方案） |
|------|-----------------|------------------|
| scheduler 对 dynamic 的处理 | 与其他模式相同，循环调用 | 只调用一次 execute_dynamic_loop |
| executor 的循环 | 每次只执行一个智能体 | 内部有完整 while 循环 |
| 步骤计数管理 | scheduler 管理 | executor 内部管理 |
| 停止条件检查 | scheduler 的 _should_stop | executor 内部处理 |
- [ ] 调度历史追踪
