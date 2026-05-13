# 基于HTTP协议的简化流式响应取消方案

## 背景与问题

在现有的流式响应实现中，我们已经实现了基本的流式输出和任务跟踪，但还存在以下问题：

1. 当用户点击"停止"按钮时，前端和后端API虽然响应了取消命令，但实际上LLM仍然继续生成内容
2. 无法真正中断底层LLM请求，导致资源浪费和用户体验问题
3. 在多智能体对话中，无法平滑切换到下一个智能体的响应流

## 设计思路

本方案采用简化但有效的流管理策略，核心思想是：
1. 充分利用HTTP协议的连接机制：当客户端断开连接时，服务器自然停止数据传输
2. 扩展现有的流任务管理结构，增加更多元数据和状态跟踪
3. 提供适度的流控制API，满足多智能体场景的需求
4. 优先确保用户体验流畅，其次考虑服务器资源优化

## 实现方案

### 1. 扩展流任务数据结构

```python
_active_streaming_tasks = {
    f"{task_id}:{conversation_id}": {
        'queue': queue_obj,           # 响应内容队列
        'start_time': timestamp,      # 开始时间
        'agent_id': agent_id,         # 智能体ID
        'status': "running",          # 状态: running, cancelled, completed
        'client_connected': True      # 客户端连接状态
    }
}
```

### 2. 注册流任务

```python
def register_streaming_task(task_id, conversation_id, agent_id, result_queue):
    """注册流式任务以便后续管理"""
    task_key = f"{task_id}:{conversation_id}"
    _active_streaming_tasks[task_key] = {
        'queue': result_queue,
        'start_time': time.time(),
        'agent_id': agent_id,
        'status': "running",
        'client_connected': True
    }
    logger.info(f"已注册流式任务: {task_key}")
    return task_key
```

### 3. 取消任务API

```python
def cancel_streaming_task(task_id, conversation_id, agent_id=None):
    """取消指定条件的流式任务
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        agent_id: 智能体ID (可选，如果指定则只取消该智能体的流)
        
    Returns:
        int: 取消的流数量
    """
    cancelled_count = 0
    
    # 找出符合条件的任务
    tasks_to_cancel = []
    for task_key, task_data in _active_streaming_tasks.items():
        key_task_id, key_conv_id = task_key.split(":")
        
        if (int(key_task_id) == task_id and 
            int(key_conv_id) == conversation_id and
            (agent_id is None or task_data.get('agent_id') == agent_id)):
            tasks_to_cancel.append(task_key)
    
    # 执行取消
    for task_key in tasks_to_cancel:
        try:
            queue_obj = _active_streaming_tasks[task_key]['queue']
            # 发送取消信号
            queue_obj.put({
                "type": "cancel",
                "message": "用户取消了流式输出"
            })
            
            # 更新状态
            _active_streaming_tasks[task_key]['status'] = "cancelled"
            _active_streaming_tasks[task_key]['client_connected'] = False
            cancelled_count += 1
            
            logger.info(f"已标记任务为已取消: {task_key}")
        except Exception as e:
            logger.error(f"取消流式任务出错: {str(e)}")
    
    return cancelled_count
```

### 4. 结束时的任务清理

```python
def mark_streaming_task_completed(task_id, conversation_id, agent_id=None):
    """标记流式任务已完成并准备清理
    
    在流处理完成时调用此函数，而不是立即删除任务
    """
    task_key = f"{task_id}:{conversation_id}"
    if task_key in _active_streaming_tasks:
        _active_streaming_tasks[task_key]['status'] = "completed"
        logger.info(f"已标记任务为已完成: {task_key}")
        
        # 设置定时清理
        # 保留完成的任务一段时间以便查询状态
        _schedule_task_cleanup(task_key, delay=300)  # 5分钟后清理
```

### 5. 智能体切换功能

```python
def switch_to_next_agent(task_id, conversation_id, current_agent_id, next_agent_id):
    """在取消当前智能体后切换到下一个智能体
    
    先取消当前智能体的流，然后为下一个智能体准备开始信号
    """
    # 取消当前智能体的流
    cancel_streaming_task(task_id, conversation_id, current_agent_id)
    
    # 查找要切换到的会话队列
    task_key = f"{task_id}:{conversation_id}"
    if task_key in _active_streaming_tasks:
        queue_obj = _active_streaming_tasks[task_key]['queue']
        
        # 发送智能体切换信号
        queue_obj.put({
            "type": "agentSwitch",
            "currentAgentId": current_agent_id,
            "nextAgentId": next_agent_id,
            "message": "切换到下一个智能体"
        })
        
        return True
    
    return False
```

### 6. 前端取消API实现

```python
@app.route('/api/cancel-stream/<int:task_id>/<int:conversation_id>', methods=['POST'])
def cancel_stream(task_id, conversation_id):
    """API端点：取消流式响应"""
    agent_id = request.json.get('agentId')
    cancelled = cancel_streaming_task(task_id, conversation_id, agent_id)
    
    # 前端收到响应后断开SSE连接
    return jsonify({
        "status": "success", 
        "message": f"已取消 {cancelled} 个流式响应",
        "cancelled_count": cancelled
    })
```

### 7. SSE连接断开处理

```python
def handle_client_disconnect():
    """
    监听客户端断开SSE连接的事件
    此函数在Flask的teardown_request或相关钩子中调用
    """
    # 获取当前请求相关的任务
    task_id = g.get('current_task_id')
    conversation_id = g.get('current_conversation_id')
    
    if task_id and conversation_id:
        task_key = f"{task_id}:{conversation_id}"
        if task_key in _active_streaming_tasks:
            _active_streaming_tasks[task_key]['client_connected'] = False
            logger.info(f"检测到客户端断开连接: {task_key}")
```

## 前端交互流程

1. 前端发起流式请求，建立SSE连接
2. 用户点击"停止"按钮时，前端执行两步操作：
   - 调用`/api/cancel-stream`API发送取消指令
   - 主动关闭SSE连接（`eventSource.close()`）
3. 后端接收到取消指令，在队列中发送取消信号
4. 前端关闭连接，服务器检测到断开事件，停止后续数据传输
5. 对于处于中间状态的数据（已生成但未发送），将被丢弃

## 多智能体场景处理

在多智能体场景下，我们需要一个平滑的切换机制：

1. 当前智能体响应被取消后，后端通过队列发送`agentSwitch`信号
2. 前端接收到信号，显示过渡UI（如"正在切换到下一个智能体..."）
3. 前端不断开SSE连接，而是等待下一个智能体的响应
4. 后端为下一个智能体创建新的生成任务，但复用相同的响应队列
5. 新的内容开始流式传输，前端无缝过渡到下一个智能体的响应

## 优点分析

1. **简单易实现**：利用HTTP协议特性，不需要复杂的底层取消机制
2. **高效可靠**：客户端断开连接是最直接的取消方式，HTTP服务器会自动处理资源清理
3. **功能实用**：提供足够的API支持多智能体场景和状态跟踪
4. **符合现有架构**：基于当前代码架构扩展，无需大改
5. **用户体验优先**：确保取消按钮点击后的即时响应，改善用户体验

## 未来扩展可能

如果未来需要更深度的LLM生成过程控制，可以考虑：

1. 为特定LLM供应商实现定制的取消机制（如OpenAI API的特定取消功能）
2. 增加模型级别的资源监控和强制终止机制
3. 实现基于时间的自动取消策略，避免长时间运行的生成任务

## 总结

这个简化的流取消方案在保持实现简单的同时提供了必要的功能，特别适合当前项目阶段。它充分利用了HTTP协议的内置机制，减少了复杂度，同时通过队列消息确保了前后端的协调。

与更复杂的流管理方案相比，这个方案更容易实现和维护，同时能满足大多数用户需求，尤其是在改善用户体验方面。 