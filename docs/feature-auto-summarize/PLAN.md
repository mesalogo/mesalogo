# 自动总结上下文功能计划

## 1. 需求概述

在系统设置中，"上下文消息数量"设置后面添加一个开关"自动总结上下文"。当消息数超过设定的上下文数量时，自动触发总结功能，将总结插入到当前会话中作为系统消息。

## 2. 功能设计

### 2.1 触发时机
- **Agent 输出完成后**触发检查
- 检查当前会话消息数是否超过 `max_conversation_history_length`

### 2.2 总结范围
- 只总结最近 `max_conversation_history_length` 条消息
- **滚动总结效果**：上一次的总结（作为系统消息）也在这个范围内
- 新总结 = 总结(上次总结 + 新消息)
- 形成递进式的"滚动摘要"，信息不断压缩但保留关键内容

### 2.3 总结处理
- 不清理旧消息
- 总结作为**系统消息**插入到会话中
- 使用**默认文本生成模型**进行总结

### 2.4 前端交互
- 总结进行中时显示提示（如"正在总结上下文..."）
- 总结进行中时**禁止用户输入**
- 总结完成后恢复正常状态

## 3. 实现流程

```
Agent输出完成 
    ↓
后端检查: 消息数 > max_conversation_history_length && auto_summarize_context 开启
    ↓
返回标志: need_summarize: true
    ↓
前端收到标志 → 显示"正在总结上下文..." → 禁止输入
    ↓
前端调用总结API: POST /conversations/{id}/summarize-context
    ↓
后端执行:
  1. 获取最近 N 条消息（N = max_conversation_history_length）
  2. 调用 SummaryService 生成总结
  3. 将总结作为系统消息插入会话
  4. 返回成功
    ↓
前端收到响应 → 隐藏提示 → 恢复输入
```

## 4. 数据结构

### 4.1 新增系统设置字段
```python
# SystemSetting
auto_summarize_context: bool = False  # 是否开启自动总结上下文
```

### 4.2 流式响应新增字段
```json
{
  "type": "done",
  "need_summarize": true  // 新增：是否需要触发总结
}
```

### 4.3 总结消息格式
```python
Message(
    role='system',
    content='[上下文总结]\n\n{总结内容}',
    conversation_id=conversation_id,
    meta={
        'type': 'context_summary',
        'summarized_at': timestamp,
        'message_count': N  # 总结了多少条消息
    }
)
```

## 5. 修改文件清单

### 5.1 前端

| 文件 | 修改内容 |
|------|----------|
| `frontend/src/pages/settings/GeneralSettingsPage/tabs/ConversationSettings.tsx` | 添加"自动总结上下文"开关 |
| `frontend/src/locales/zh-CN.ts` | 添加中文翻译 |
| `frontend/src/locales/en-US.ts` | 添加英文翻译 |
| `frontend/src/services/api/conversation.ts` | 添加总结API调用方法 |
| `frontend/src/pages/actiontask/components/ActionTaskConversation/ActionTaskConversation.tsx` | 处理总结标志、显示提示、禁止输入 |

### 5.2 后端

| 文件 | 修改内容 |
|------|----------|
| `backend/app/services/conversation/stream_handler.py` | 在流式响应完成时检查并返回 `need_summarize` 标志 |
| `backend/app/api/routes/conversations/__init__.py` | 添加总结API端点 |
| `backend/app/services/summary_service.py` | 添加 `summarize_context` 方法（总结上下文消息） |

## 6. 详细实现

### 6.1 前端设置页面

在 `ConversationSettings.tsx` 的 `max_conversation_history_length` 字段后添加：

```tsx
<Form.Item
  name="auto_summarize_context"
  label={renderLabel(
    <FileTextOutlined />,
    t('settings.autoSummarizeContext'),
    t('settings.autoSummarizeContext.tooltip')
  )}
  valuePropName="checked"
  style={{ marginBottom: '16px' }}
>
  <Switch />
</Form.Item>
```

### 6.2 国际化文本

```typescript
// zh-CN.ts
'settings.autoSummarizeContext': '自动总结上下文',
'settings.autoSummarizeContext.tooltip': '启用后，当消息数量超过上下文历史消息长度时，将自动总结历史消息并插入会话中，保持上下文连贯性',
'conversation.summarizing': '正在总结上下文...',
'conversation.summarizeSuccess': '上下文总结完成',
'conversation.summarizeFailed': '上下文总结失败',

// en-US.ts
'settings.autoSummarizeContext': 'Auto Summarize Context',
'settings.autoSummarizeContext.tooltip': 'When enabled, if message count exceeds context history length, the system will automatically summarize history messages and insert into conversation to maintain context continuity',
'conversation.summarizing': 'Summarizing context...',
'conversation.summarizeSuccess': 'Context summarized',
'conversation.summarizeFailed': 'Context summarization failed',
```

### 6.3 后端流式响应检查

在 `stream_handler.py` 的流式响应完成处理中添加：

```python
def check_need_summarize(conversation_id: str) -> bool:
    """检查是否需要触发上下文总结"""
    from app.models import SystemSetting, Message
    
    # 检查是否开启自动总结
    auto_summarize = SystemSetting.get('auto_summarize_context', False)
    if not auto_summarize:
        return False
    
    # 获取上下文消息数量限制
    max_history = SystemSetting.get('max_conversation_history_length', 10)
    if max_history == 0:  # 0表示不限制
        return False
    
    # 统计当前会话消息数
    message_count = Message.query.filter(
        Message.conversation_id == conversation_id,
        Message.role.in_(['agent', 'human'])
    ).count()
    
    return message_count > max_history
```

### 6.4 总结API端点

```python
@conversations_bp.route('/<string:conversation_id>/summarize-context', methods=['POST'])
def summarize_context(conversation_id):
    """总结当前会话的上下文消息"""
    try:
        from app.services.summary_service import SummaryService
        
        result = SummaryService.summarize_context(conversation_id)
        
        return jsonify({
            'success': True,
            'message_id': result['message_id'],
            'summary_length': len(result['summary'])
        })
    except Exception as e:
        logger.error(f"总结上下文失败: {str(e)}")
        return jsonify({'error': str(e)}), 500
```

### 6.5 SummaryService 新增方法

```python
@staticmethod
def summarize_context(conversation_id: str) -> dict:
    """
    总结会话的上下文消息
    
    Args:
        conversation_id: 会话ID
        
    Returns:
        dict: {'message_id': id, 'summary': content}
    """
    from app.models import SystemSetting, Conversation, Message, db
    
    # 获取上下文消息数量限制
    max_history = SystemSetting.get('max_conversation_history_length', 10)
    
    # 获取最近的N条消息
    messages = Message.query.filter(
        Message.conversation_id == conversation_id,
        Message.role.in_(['agent', 'human', 'system'])
    ).order_by(Message.created_at.desc()).limit(max_history).all()
    
    messages.reverse()  # 恢复时间顺序
    
    # 生成总结
    summary = SummaryService._generate_context_summary(messages)
    
    # 插入系统消息
    summary_message = Message(
        role='system',
        content=f'[上下文总结]\n\n{summary}',
        conversation_id=conversation_id,
        meta={
            'type': 'context_summary',
            'summarized_at': datetime.utcnow().isoformat(),
            'message_count': len(messages)
        }
    )
    db.session.add(summary_message)
    db.session.commit()
    
    return {
        'message_id': summary_message.id,
        'summary': summary
    }
```

### 6.6 前端对话组件处理

```typescript
// 在流式响应完成的回调中
const handleStreamComplete = (data: any) => {
  // ... 现有逻辑
  
  // 检查是否需要总结
  if (data.need_summarize) {
    setSummarizing(true);
    setInputDisabled(true);
    
    conversationAPI.summarizeContext(conversationId)
      .then(() => {
        message.success(t('conversation.summarizeSuccess'));
        // 刷新消息列表以显示总结消息
        refreshMessages();
      })
      .catch((err) => {
        message.error(t('conversation.summarizeFailed'));
      })
      .finally(() => {
        setSummarizing(false);
        setInputDisabled(false);
      });
  }
};
```

## 7. 测试场景

1. **基本功能测试**
   - 开启自动总结，设置上下文长度为5
   - 发送6条以上消息，验证是否自动触发总结
   - 验证总结消息是否正确插入

2. **滚动总结测试**
   - 继续发送消息，验证新总结是否包含上次总结的内容
   - 验证信息是否正确压缩

3. **前端交互测试**
   - 验证总结时是否显示提示
   - 验证总结时输入框是否被禁用
   - 验证总结完成后是否恢复正常

4. **边界情况测试**
   - 上下文长度设为0（不限制）时不触发总结
   - 关闭自动总结开关时不触发
   - 消息数刚好等于限制时不触发（只有超过才触发）

## 8. 注意事项

1. **性能考虑**：总结操作是异步的，不阻塞主流程
2. **错误处理**：总结失败不影响正常对话，只显示错误提示
3. **消息类型**：总结消息的 `meta.type` 为 `context_summary`，便于前端特殊展示
4. **模型选择**：使用系统默认文本生成模型，与现有总结功能保持一致
