# 时间触发模式实现计划

## 概述

本文档详细描述了时间触发模式（Time Trigger Mode）的实现计划。时间触发模式是多智能体行动任务系统中的一种自主行动模式，允许智能体按照预设的时间间隔自动执行行动，直到达到停止条件为止。

## 现状分析

### 已实现的模式
1. **讨论模式** (`discussion`) - ✅ 完全实现
   - 智能体按轮次进行讨论
   - 支持流式输出和总结功能
   - 实现文件：`app/services/conversation/auto_conversation.py`

2. **变量停止模式** (`conditional_stop`) - ✅ 完全实现
   - 基于变量条件的持续行动
   - 支持复杂条件判断和流式输出
   - 实现文件：`app/services/conversation/variable_stop_conversation.py`

### 待实现的模式
3. **时间触发模式** (`time_trigger`) - ⚠️ 前端完整，后端待实现
4. **变量触发模式** (`variable_trigger`) - ⚠️ 前端完整，后端待实现

## 时间触发模式需求分析

### 功能特性
根据前端配置界面分析，时间触发模式需要支持以下功能：

1. **时间间隔设置**
   - 范围：1-1440分钟
   - 前端字段：`timeInterval`
   - 用途：定义触发执行的时间间隔

2. **执行次数限制**
   - 范围：0表示无限制，>0表示最大执行次数
   - 前端字段：`maxExecutions`
   - 用途：控制总执行次数

3. **触发行动类型**
   - `single_round`：单轮行动（每次触发所有智能体轮流发言一次）
   - `discussion`：多轮讨论（每次触发执行指定轮数的完整讨论）
   - 前端字段：`triggerAction`

4. **讨论轮数**（当触发行动为discussion时）
   - 范围：1-10轮
   - 前端字段：`triggerRounds`
   - 用途：定义每次触发时的讨论轮数

5. **总时长限制**（可选）
   - 范围：1-10080分钟（1周）
   - 前端字段：`enableTimeLimit` + `totalTimeLimit`
   - 用途：限制任务的总运行时间

### 技术要求
1. **定时器管理**：使用Python的`threading.Timer`实现定时触发
2. **任务状态跟踪**：全局字典管理活动任务状态
3. **并发安全**：确保多线程环境下的数据一致性
4. **流式输出**：支持实时状态更新和消息推送
5. **优雅停止**：支持手动停止和资源清理
6. **数据库集成**：使用`AutonomousTask`和`AutonomousTaskExecution`模型
7. **智能体中断机制**：当新触发发生时，自动中断未完成的智能体执行

### 前端数据格式

根据现有实现分析，前端发送给后端的数据格式应该保持一致：

```javascript
// 前端发送的discussionOptions对象格式
const discussionOptions = {
  // 基础参数（所有模式共用）
  rounds: 1,                    // 讨论轮数（时间触发模式中被禁用）
  topic: '',                    // 讨论主题
  summarize: true,              // 是否总结（仅讨论模式）
  summarizerAgentId: null,      // 总结智能体ID（仅讨论模式）
  speakingMode: 'sequential',   // 智能体行动方式
  enablePlanning: false,        // 是否启用计划功能
  plannerAgentId: null,         // 计划智能体ID

  // 模式标识
  isInfinite: false,            // 是否为变量停止模式
  isTimeTrigger: true,          // 是否为时间触发模式
  isVariableTrigger: false,     // 是否为变量触发模式

  // 时间触发模式专用参数
  timeInterval: 30,             // 时间间隔（分钟）
  maxExecutions: 0,             // 最大执行次数（0表示无限制）
  triggerAction: 'single_round', // 触发行动类型：'single_round' | 'discussion'
  triggerRounds: 2,             // 每次触发的讨论轮数（当triggerAction为discussion时）
  enableTimeLimit: false,       // 是否启用总时长限制
  totalTimeLimit: 1440,         // 总时长限制（分钟）

  // 变量停止模式参数（参考）
  stopConditions: [],           // 停止条件数组
  conditionLogic: 'and',        // 条件逻辑
  maxRuntime: 0                 // 最大运行时间
}
```

### 后端参数处理

后端需要从前端数据中提取时间触发模式的配置：

```python
# 在conversations.py中的处理逻辑
data = request.get_json()

# 判断任务类型
is_time_trigger = data.get('isTimeTrigger', False)

if is_time_trigger:
    # 提取时间触发模式配置
    config = {
        'timeInterval': data.get('timeInterval', 30),
        'maxExecutions': data.get('maxExecutions', 0),
        'triggerAction': data.get('triggerAction', 'single_round'),
        'triggerRounds': data.get('triggerRounds', 2),
        'enableTimeLimit': data.get('enableTimeLimit', False),
        'totalTimeLimit': data.get('totalTimeLimit', 1440),
        'topic': data.get('topic', '请基于各自角色和知识，持续进行行动'),
        'speakingMode': data.get('speakingMode', 'sequential'),
        'enablePlanning': data.get('enablePlanning', False),
        'plannerAgentId': data.get('plannerAgentId')
    }
```

## 架构设计

### 核心模块结构
```
app/services/conversation/
├── time_trigger_conversation.py    # 新增：时间触发核心逻辑
├── auto_conversation.py           # 参考：讨论模式实现
├── variable_stop_conversation.py  # 参考：变量停止模式实现
└── ...
```

### 主要函数设计
1. **`start_time_trigger_conversation()`** - 启动时间触发会话
2. **`stop_time_trigger_conversation()`** - 停止时间触发会话
3. **`_start_time_trigger_impl()`** - 时间触发实现方法
4. **`_execute_time_trigger_loop()`** - 执行时间触发循环
5. **`_schedule_next_execution()`** - 调度下次执行
6. **`_check_execution_limits()`** - 检查执行限制
7. **`_interrupt_running_agents()`** - 中断正在执行的智能体
8. **`_track_agent_execution()`** - 跟踪智能体执行状态

### 数据结构设计
```python
# 全局任务跟踪字典 - 修改为按 task_id 进行并发控制
_active_time_trigger_tasks = {
    "task_id": {  # 键格式从 "task_id:conversation_id" 改为 "task_id"
        'task_id': int,
        'conversation_id': int,
        'config': dict,
        'streaming': bool,
        'result_queue': queue.Queue,
        'start_time': datetime,
        'execution_count': int,
        'timer': threading.Timer,
        'status': str,  # 'running', 'stopped'
        'current_execution': dict,  # 当前执行状态
        'agent_threads': dict  # 智能体执行线程跟踪
    }
}

# 智能体执行状态跟踪 - 保持原格式，因为需要区分不同智能体
_agent_execution_status = {
    "task_id:conversation_id:agent_id": {
        'thread': threading.Thread,
        'start_time': datetime,
        'status': str,  # 'running', 'completed', 'interrupted'
        'interrupt_flag': threading.Event
    }
}
```

## 实现计划

### 第一阶段：核心服务模块
**目标**：创建`time_trigger_conversation.py`模块
**任务**：
- [ ] 创建基础模块结构
- [ ] 实现启动和停止函数接口
- [ ] 实现配置参数解析和验证
- [ ] 实现基础的定时器管理

### 第二阶段：任务管理机制
**目标**：实现定时器管理和任务调度
**任务**：
- [ ] 实现定时器创建和销毁
- [ ] 实现执行计数和限制检查
- [ ] 实现总时长限制检查（分钟单位）
- [ ] 实现任务状态管理
- [ ] 实现智能体执行状态跟踪
- [ ] 实现智能体中断机制

### 第三阶段：前端配置更新
**目标**：更新前端配置以匹配后端实现
**任务**：
- [ ] 修改总时长限制单位从小时改为分钟
- [ ] 更新默认值和范围限制（1-10080分钟）
- [ ] 更新表单验证规则
- [ ] 更新界面显示文本

### 第四阶段：API路由集成
**目标**：在`conversations.py`中集成时间触发模式
**任务**：
- [ ] 替换现有的"暂未实现"提示
- [ ] 添加时间触发模式的参数处理
- [ ] 集成流式和非流式响应处理
- [ ] 添加错误处理和验证

### 第五阶段：停止机制实现
**目标**：实现优雅停止和资源清理
**任务**：
- [ ] 实现定时器清理机制
- [ ] 实现任务状态更新
- [ ] 集成到停止API路由中
- [ ] 添加异常处理
- [ ] 实现智能体中断清理

### 第六阶段：数据库状态管理
**目标**：完善数据库记录和状态跟踪
**任务**：
- [ ] 创建`AutonomousTask`记录
- [ ] 管理`AutonomousTaskExecution`执行历史
- [ ] 实现状态同步机制
- [ ] 添加执行结果记录
- [ ] 记录中断事件

### 第七阶段：流式输出支持
**目标**：支持实时状态更新和消息推送
**任务**：
- [ ] 实现流式消息推送
- [ ] 添加执行状态通知
- [ ] 实现错误消息推送
- [ ] 添加中断通知
- [ ] 优化用户体验

### 第八阶段：测试和验证
**目标**：确保功能完整性和稳定性
**任务**：
- [ ] 单元测试编写
- [ ] 集成测试验证
- [ ] 边界条件测试
- [ ] 中断机制测试
- [ ] 性能和稳定性测试

## 智能体中断机制详细设计

### 中断触发条件
1. **定时触发到达**：当下一个定时触发时间到达时
2. **手动停止**：用户手动停止任务时
3. **达到限制**：达到执行次数或时间限制时

### 中断实现策略
1. **优雅中断**：使用`threading.Event`标志位，而非强制终止线程
2. **超时处理**：等待智能体响应中断信号，超时后强制清理
3. **状态保存**：中断前保存当前执行状态和进度
4. **资源清理**：清理未完成的请求和临时资源

### 中断流程
```python
def _interrupt_current_execution(task_key):
    """中断当前执行的智能体"""
    task_info = _active_time_trigger_tasks.get(task_key)
    if not task_info:
        return

    # 1. 设置中断标志
    for agent_key, thread_info in task_info['agent_threads'].items():
        if thread_info['status'] == 'running':
            thread_info['interrupt_flag'].set()

    # 2. 等待线程结束（最多5秒）
    for agent_key, thread_info in task_info['agent_threads'].items():
        if thread_info['thread'].is_alive():
            thread_info['thread'].join(timeout=5)
            if thread_info['thread'].is_alive():
                logger.warning(f"智能体线程未能及时响应中断: {agent_key}")

    # 3. 清理状态
    task_info['agent_threads'] = {}

    # 4. 发送中断通知
    if task_info['streaming'] and task_info['result_queue']:
        _send_stream_message(task_info['result_queue'], 'interruption', {
            'message': '上一轮执行被中断，开始新的触发执行',
            'timestamp': datetime.now().isoformat()
        })
```

### 智能体响应中断
智能体执行过程中需要定期检查中断标志：
```python
def _execute_agent_with_interrupt(agent_id, interrupt_flag, ...):
    """带中断检查的智能体执行"""
    try:
        # 在关键点检查中断标志
        if interrupt_flag.is_set():
            return {'status': 'interrupted', 'message': '执行被中断'}

        # 执行智能体逻辑...

        # 再次检查中断标志
        if interrupt_flag.is_set():
            return {'status': 'interrupted', 'message': '执行被中断'}

        return {'status': 'completed', 'result': result}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}
```

## 技术实现细节

### 定时器管理策略
```python
import threading
import time

def _schedule_next_execution(task_key, interval_minutes):
    """调度下次执行"""
    interval_seconds = interval_minutes * 60
    timer = threading.Timer(interval_seconds, _execute_trigger_action, args=[task_key])
    timer.daemon = True
    timer.start()
    return timer
```

### 执行限制检查
```python
def _check_execution_limits(task_info, config):
    """检查是否达到执行限制"""
    # 检查执行次数限制
    max_executions = config.get('maxExecutions', 0)
    if max_executions > 0 and task_info['execution_count'] >= max_executions:
        return False, 'reached_max_executions'

    # 检查总时长限制（分钟单位）
    if config.get('enableTimeLimit', False):
        total_limit_minutes = config.get('totalTimeLimit', 1440)  # 默认1440分钟（24小时）
        elapsed_minutes = (datetime.now() - task_info['start_time']).total_seconds() / 60
        if elapsed_minutes >= total_limit_minutes:
            return False, 'reached_time_limit'

    return True, None
```

### 智能体中断机制
```python
def _interrupt_running_agents(task_key):
    """中断正在执行的智能体"""
    if task_key in _active_time_trigger_tasks:
        task_info = _active_time_trigger_tasks[task_key]
        agent_threads = task_info.get('agent_threads', {})

        for agent_key, thread_info in agent_threads.items():
            if thread_info['status'] == 'running':
                # 设置中断标志
                thread_info['interrupt_flag'].set()
                # 等待线程结束（最多等待5秒）
                if thread_info['thread'].is_alive():
                    thread_info['thread'].join(timeout=5)
                thread_info['status'] = 'interrupted'

        # 清空当前执行状态
        task_info['agent_threads'] = {}

def _track_agent_execution(task_key, agent_id, thread, interrupt_flag):
    """跟踪智能体执行状态"""
    if task_key in _active_time_trigger_tasks:
        task_info = _active_time_trigger_tasks[task_key]
        agent_key = f"{task_key}:{agent_id}"

        task_info['agent_threads'][agent_key] = {
            'thread': thread,
            'start_time': datetime.now(),
            'status': 'running',
            'interrupt_flag': interrupt_flag
        }
```

### 消息发送标准化
时间触发模式必须使用标准消息格式化函数，确保与其他自主任务保持一致：

```python
def _send_trigger_notification(task_key, execution_count):
    """发送触发通知 - 使用标准消息格式"""
    if task_key in _active_time_trigger_tasks:
        task_info = _active_time_trigger_tasks[task_key]
        result_queue = task_info.get('result_queue')

        if result_queue:
            from app.services.conversation.message_formater import format_system_message, serialize_message
            from app.utils.datetime_utils import get_current_time_with_timezone

            # 创建系统消息对象
            system_msg = Message(
                conversation_id=task_info['conversation_id'],
                action_task_id=task_info['task_id'],
                content=f"提示：时间触发任务第 {execution_count} 次执行开始",
                role="system",
                created_at=get_current_time_with_timezone()
            )
            db.session.add(system_msg)
            db.session.commit()

            # 使用标准格式化函数发送消息
            formatted_msg = format_system_message(
                message_id=str(system_msg.id),
                content=system_msg.content,
                created_at=system_msg.created_at.isoformat()
            )
            result_queue.put(serialize_message(formatted_msg))

def _send_agent_info(result_queue, agent_info, round_info):
    """发送智能体信息 - 使用标准格式"""
    from app.services.conversation.message_formater import format_agent_info, serialize_message

    formatted_msg = format_agent_info(
        turn_prompt=f"轮到智能体 {agent_info['name']} 发言",
        agent_id=str(agent_info['id']),
        agent_name=agent_info['name'],
        round_num=round_info.get('current', 1),
        total_rounds=999,  # 时间触发模式使用999表示无限轮次
        response_order=round_info.get('order', 1),
        total_agents=round_info.get('total_agents', 1)
    )
    result_queue.put(serialize_message(formatted_msg))

def _send_completion_message(result_queue, message, message_ids):
    """发送完成消息 - 使用标准格式"""
    from app.services.conversation.message_formater import format_all_agents_done, serialize_message

    formatted_msg = format_all_agents_done(
        message=message,
        message_ids=message_ids
    )
    result_queue.put(serialize_message(formatted_msg))
```

### 流式输出集成
```python
def _send_stream_message(result_queue, message_type, content):
    """发送流式消息 - 使用标准消息格式化函数"""
    if result_queue:
        from app.services.conversation.message_formater import (
            format_system_message, format_agent_info, format_connection_status,
            format_all_agents_done, serialize_message
        )

        # 根据消息类型使用相应的格式化函数
        if message_type == 'system':
            formatted_msg = format_system_message(
                message_id=str(content.get('id', '')),
                content=content.get('content', ''),
                created_at=content.get('created_at', datetime.now().isoformat())
            )
        elif message_type == 'agent_info':
            formatted_msg = format_agent_info(**content)
        elif message_type == 'connection_status':
            formatted_msg = format_connection_status(**content)
        elif message_type == 'all_done':
            formatted_msg = format_all_agents_done(**content)
        else:
            # 兜底格式，但应避免使用
            formatted_msg = {'content': content, 'meta': {'type': message_type}}

        result_queue.put(serialize_message(formatted_msg))
```

## 风险评估和缓解策略

### 潜在风险
1. **内存泄漏**：长时间运行的定时器可能导致内存泄漏
2. **并发冲突**：多个定时器同时执行可能导致数据冲突
3. **异常处理**：定时器执行过程中的异常可能导致任务卡死
4. **资源清理**：应用重启时未清理的定时器可能导致问题
5. **智能体中断**：强制中断智能体可能导致数据不一致
6. **线程管理**：大量智能体线程可能导致系统资源耗尽

### 缓解策略
1. **定时器生命周期管理**：确保定时器在任务结束时被正确清理
2. **线程安全**：使用锁机制保护共享数据
3. **异常捕获**：在关键位置添加try-catch块
4. **健康检查**：定期检查任务状态和清理僵尸任务
5. **优雅中断**：使用中断标志而非强制终止线程
6. **资源限制**：限制同时运行的智能体线程数量
7. **状态恢复**：中断后的状态清理和恢复机制

## 成功标准

### 功能完整性
- [ ] 支持所有前端配置参数
- [ ] 正确执行单轮和多轮行动
- [ ] 准确执行时间间隔和次数限制
- [ ] 支持流式和非流式输出

### 稳定性要求
- [ ] 长时间运行无内存泄漏
- [ ] 并发执行无数据冲突
- [ ] 异常情况下优雅降级
- [ ] 支持热重启和恢复

### 性能指标
- [ ] 定时器精度误差 < 5秒
- [ ] 内存使用增长 < 10MB/小时
- [ ] CPU使用率 < 5%（空闲时）
- [ ] 响应时间 < 2秒
- [ ] 智能体中断响应时间 < 5秒
- [ ] 并发智能体数量 < 50个

## 与现有实现的兼容性

### API路由兼容性
时间触发模式将复用现有的自主讨论API路由：
- **路由**: `/api/action-tasks/<task_id>/conversations/<conversation_id>/auto-discussion`
- **方法**: POST
- **流式支持**: 通过`?stream=1`参数启用
- **数据格式**: 与现有discussionOptions格式完全兼容

### 数据库模型兼容性
使用现有的数据库模型，无需修改表结构：
- **AutonomousTask**: `type='time_trigger'`, `config`存储时间触发配置
- **AutonomousTaskExecution**: 记录每次触发的执行历史
- **Message**: 存储触发产生的消息

### 前端组件兼容性
- **AutonomousTaskModal**: 已有时间触发模式的UI配置
- **AutonomousTaskCard**: 支持显示时间触发任务状态
- **ActionTaskConversation**: 复用现有的流式响应处理逻辑

### 流式输出兼容性
时间触发模式的流式输出格式与现有实现保持一致，使用标准消息格式化函数：

```javascript
// 系统消息格式（使用format_system_message）
{
  "content": null,
  "meta": {
    "message": {
      "id": "123",
      "content": "提示：时间触发任务开始执行...",
      "role": "system",
      "created_at": "2025-07-02T10:30:00Z"
    }
  }
}

// 智能体信息格式（使用format_agent_info）
{
  "content": null,
  "meta": {
    "type": "agentInfo",
    "turnPrompt": "轮到智能体 Agent1 发言",
    "agentId": "1",
    "agentName": "Agent1",
    "round": 1,
    "totalRounds": 999,
    "responseOrder": 1,
    "totalAgents": 3
  }
}

// 连接状态格式（使用format_connection_status）
{
  "content": null,
  "meta": {
    "connectionStatus": "connecting|connected|done|agentDone",
    "message": "状态描述信息"
  }
}

// 完成消息格式（使用format_all_agents_done）
{
  "content": null,
  "meta": {
    "connectionStatus": "done",
    "message": "时间触发任务已完成",
    "messageIds": [123, 124, 125]
  }
}

// 中断通知格式（使用format_system_message）
{
  "content": null,
  "meta": {
    "message": {
      "id": "126",
      "content": "提示：上一轮执行被中断，开始新的触发执行",
      "role": "system",
      "created_at": "2025-07-02T10:30:00Z"
    }
  }
}
```

## 重要注意事项

### 消息格式一致性要求

**⚠️ 重要：时间触发模式的消息发送格式必须与其他自主任务保持完全一致**

#### 必须使用的标准格式化函数
- `format_system_message()` - 用于系统通知消息
- `format_agent_info()` - 用于智能体信息通知
- `format_connection_status()` - 用于连接状态更新
- `format_all_agents_done()` - 用于任务完成通知
- `serialize_message()` - 用于消息序列化

#### 禁止的做法
```python
# ❌ 错误：自定义消息格式
result_queue.put(json.dumps({
    'type': 'custom_message',
    'content': 'some content',
    'timestamp': datetime.now().isoformat()
}))

# ❌ 错误：直接构建消息结构
result_queue.put(json.dumps({
    'message': {
        'id': 123,
        'content': 'content',
        'role': 'system'
    }
}))
```

#### 正确的做法
```python
# ✅ 正确：使用标准格式化函数
from app.services.conversation.message_formater import format_system_message, serialize_message

formatted_msg = format_system_message(
    message_id=str(msg.id),
    content=msg.content,
    created_at=msg.created_at.isoformat()
)
result_queue.put(serialize_message(formatted_msg))
```

#### 参考实现
- **auto_conversation.py**: 讨论模式的消息格式实现
- **variable_stop_conversation.py**: 变量停止模式的消息格式实现
- **message_formater.py**: 所有标准格式化函数的定义

## 后续扩展

### 可能的增强功能
1. **动态调整**：运行时修改时间间隔和限制
2. **条件触发**：结合变量条件的复合触发
3. **负载均衡**：多实例环境下的任务分配
4. **监控告警**：任务异常时的通知机制

### 与其他模式的集成
1. **混合模式**：时间触发 + 变量停止
2. **级联触发**：一个任务触发另一个任务
3. **智能调度**：基于系统负载的动态调度

---

**文档版本**：v1.1
**创建日期**：2025-07-02
**最后更新**：2025-07-07
**更新内容**：更正消息发送格式，确保与其他自主任务保持一致
**负责人**：开发团队
