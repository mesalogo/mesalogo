"""
事件类型定义模块（尚未完成）

定义系统中的所有事件类型常量，包括会话、消息、智能体、工具调用、自动讨论和流式处理相关事件
"""

# 会话相关事件
CONVERSATION_CREATED = 'conversation.created'
CONVERSATION_UPDATED = 'conversation.updated'
CONVERSATION_DELETED = 'conversation.deleted'

# 消息相关事件
MESSAGE_RECEIVED = 'message.received'
MESSAGE_PROCESSED = 'message.processed'
MESSAGE_SENT = 'message.sent'
MESSAGE_ERROR = 'message.error'

# 智能体相关事件
AGENT_THINKING = 'agent.thinking'
AGENT_RESPONDING = 'agent.responding'
AGENT_RESPONSE_COMPLETE = 'agent.response_complete'
AGENT_ERROR = 'agent.error'

# 工具调用相关事件
TOOL_CALL_DETECTED = 'tool.call_detected'
TOOL_CALL_EXECUTED = 'tool.call_executed'
TOOL_CALL_ERROR = 'tool.call_error'

# 自动讨论相关事件
AUTO_DISCUSSION_STARTED = 'auto_discussion.started'
AUTO_DISCUSSION_ROUND_STARTED = 'auto_discussion.round_started'
AUTO_DISCUSSION_ROUND_COMPLETED = 'auto_discussion.round_completed'
AUTO_DISCUSSION_COMPLETED = 'auto_discussion.completed'
AUTO_DISCUSSION_ERROR = 'auto_discussion.error'

# 流式处理相关事件
STREAM_STARTED = 'stream.started'
STREAM_CHUNK_RECEIVED = 'stream.chunk_received'
STREAM_COMPLETED = 'stream.completed'
STREAM_ERROR = 'stream.error'
STREAM_INTERRUPTED = 'stream.interrupted'
