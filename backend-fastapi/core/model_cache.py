"""
业务实体缓存层（精简版）

只缓存真正高频的热路径，遵循 KISS 原则：
1. 会话消息列表 — summary_service 读消息避免 MySQL 1020 冲突（核心收益）
2. 会话智能体关系 — smart_dispatch 每条消息必查（26 万行表）
3. 智能体 / 角色 — smart_dispatch 构建 prompt 时查
4. 智能分发描述 — 避免重复拼接 agent 描述字符串

所有函数在 Redis 不可用时自动 fallback 到 DB 查询，不影响业务逻辑。
不缓存低频/小表（ModelConfig 16行、SystemSetting 37行、Capability 9行等）。
"""
import logging
from typing import Optional

from core.cache import (
    cached_query, cache_set, cache_get, invalidate_keys,
    cache_list_rpush, cache_list_range, cache_list_len,
)

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════
# Key 前缀 + TTL
# ═══════════════════════════════════════════════════════

_KEY_AGENT = "agent:{}"               # smart_dispatch 热路径
_KEY_ROLE = "role:{}"                 # smart_dispatch 热路径
_KEY_CONV_AGENTS = "conv_agents:{}"   # smart_dispatch 每条消息查
_KEY_CONV_AGENTS_DESC = "conv:{}:agents_desc"  # smart_dispatch 描述缓存
_KEY_CONV_MSGS = "conv:{}:msgs"       # summary_service 核心缓存
_KEY_CONV_COUNT = "conv:{}:count"     # 消息计数

_TTL_AGENT = 120           # 2 min
_TTL_ROLE = 300            # 5 min
_TTL_CONV_AGENTS = 60      # 1 min
_TTL_AGENTS_DESC = 120     # 2 min
_TTL_CONV_MSGS = 1800      # 30 min
_TTL_CONV_COUNT = 60       # 1 min


# ═══════════════════════════════════════════════════════
# ORM → dict 序列化（只保留被使用的 3 个）
# ═══════════════════════════════════════════════════════

def _agent_to_dict(agent) -> dict:
    return {
        'id': str(agent.id) if agent.id else None,
        'name': agent.name,
        'description': getattr(agent, 'description', None),
        'avatar': getattr(agent, 'avatar', None),
        'role_id': agent.role_id,
        'type': getattr(agent, 'type', None),
        'is_observer': getattr(agent, 'is_observer', False),
        'settings': getattr(agent, 'settings', None),
    }


def _role_to_dict(role) -> dict:
    return {
        'id': role.id,
        'name': role.name,
        'description': getattr(role, 'description', None),
        'system_prompt': getattr(role, 'system_prompt', None),
        'model': getattr(role, 'model', None),
        'source': getattr(role, 'source', None),
        'temperature': getattr(role, 'temperature', None),
        'top_p': getattr(role, 'top_p', None),
        'frequency_penalty': getattr(role, 'frequency_penalty', None),
        'presence_penalty': getattr(role, 'presence_penalty', None),
        'settings': getattr(role, 'settings', None),
    }


def _message_to_dict(msg) -> dict:
    return {
        'id': msg.id,
        'role': msg.role,
        'content': msg.content,
        'thinking': getattr(msg, 'thinking', None),
        'agent_id': str(msg.agent_id) if msg.agent_id else None,
        'user_id': msg.user_id,
        'conversation_id': msg.conversation_id,
        'action_task_id': msg.action_task_id,
        'source': getattr(msg, 'source', None),
        'meta': getattr(msg, 'meta', None),
        'created_at': msg.created_at.isoformat() if msg.created_at else None,
    }


# ═══════════════════════════════════════════════════════
# ① 智能体 / 角色（smart_dispatch 热路径）
# ═══════════════════════════════════════════════════════

def get_agent_cached(agent_id) -> Optional[dict]:
    """缓存版 Agent.query.get(id)，smart_dispatch 每条消息查 2-3 次"""
    if not agent_id:
        return None

    def loader():
        from app.models import Agent
        agent = Agent.query.get(agent_id)
        return _agent_to_dict(agent) if agent else None

    return cached_query(_KEY_AGENT.format(agent_id), _TTL_AGENT, loader)


def get_role_cached(role_id) -> Optional[dict]:
    """缓存版 Role.query.get(id)，smart_dispatch 构建 prompt 时查"""
    if not role_id:
        return None

    def loader():
        from app.models import Role
        role = Role.query.get(role_id)
        return _role_to_dict(role) if role else None

    return cached_query(_KEY_ROLE.format(role_id), _TTL_ROLE, loader)


def invalidate_agent(agent_id):
    """智能体更新/删除后调用"""
    invalidate_keys(_KEY_AGENT.format(agent_id))


def invalidate_role(role_id):
    """角色更新/删除后调用"""
    invalidate_keys(_KEY_ROLE.format(role_id))


# ═══════════════════════════════════════════════════════
# ② 会话智能体关系（smart_dispatch 每条消息查，26 万行表）
# ═══════════════════════════════════════════════════════

def get_conversation_agents_cached(conversation_id) -> Optional[list]:
    """缓存版 ConversationAgent.query.filter_by(conversation_id=...)"""
    if not conversation_id:
        return None

    def loader():
        from app.models import ConversationAgent
        relations = ConversationAgent.query.filter_by(conversation_id=conversation_id).all()
        return [
            {
                'id': r.id,
                'agent_id': str(r.agent_id) if r.agent_id else None,
                'conversation_id': str(r.conversation_id) if r.conversation_id else None,
                'is_default': getattr(r, 'is_default', False),
            }
            for r in relations
        ]

    return cached_query(_KEY_CONV_AGENTS.format(conversation_id), _TTL_CONV_AGENTS, loader)


def invalidate_conversation_agents(conversation_id):
    """会话智能体关系变更后调用"""
    invalidate_keys(
        _KEY_CONV_AGENTS.format(conversation_id),
        _KEY_CONV_AGENTS_DESC.format(conversation_id),
    )


# ═══════════════════════════════════════════════════════
# ③ 智能分发描述缓存
# ═══════════════════════════════════════════════════════

def get_agents_description_cached(conversation_id: int) -> Optional[str]:
    """获取缓存的智能体描述字符串（用于 smart_dispatch prompt）"""
    return cache_get(_KEY_CONV_AGENTS_DESC.format(conversation_id))


def set_agents_description_cached(conversation_id: int, description: str):
    """缓存智能体描述字符串"""
    cache_set(_KEY_CONV_AGENTS_DESC.format(conversation_id), description, _TTL_AGENTS_DESC)


# ═══════════════════════════════════════════════════════
# ④ 会话消息缓存（核心收益：解决 summary_service MySQL 1020）
# ═══════════════════════════════════════════════════════

def cache_message(msg_or_dict, conversation_id: int = None):
    """
    将消息追加到 Redis 会话消息列表

    写入 conv:{cid}:msgs (List RPUSH)，不再写单条 msg:{id}（没有读取方）。
    """
    if hasattr(msg_or_dict, 'id'):
        msg_dict = _message_to_dict(msg_or_dict)
        conv_id = msg_or_dict.conversation_id
    else:
        msg_dict = msg_or_dict
        conv_id = conversation_id or msg_dict.get('conversation_id')

    if not msg_dict or not msg_dict.get('id') or not conv_id:
        return

    # 追加到会话消息列表
    cache_list_rpush(_KEY_CONV_MSGS.format(conv_id), msg_dict, _TTL_CONV_MSGS)
    # 失效计数缓存
    invalidate_keys(_KEY_CONV_COUNT.format(conv_id))


def get_conversation_messages_cached(
    conversation_id: int,
    roles: list = None,
    limit: int = 0,
    order_desc: bool = False,
) -> Optional[list]:
    """
    优先从 Redis List 读取会话消息，未命中则 fallback 到 DB 并回填。

    这是引入 Redis 的核心收益点：summary_service 在后台线程读消息时，
    避免与主线程的 MySQL session 发生 REPEATABLE READ 冲突（Error 1020）。
    """
    cache_key = _KEY_CONV_MSGS.format(conversation_id)
    cached_msgs = cache_list_range(cache_key)

    if cached_msgs:
        if roles:
            cached_msgs = [m for m in cached_msgs if m.get('role') in roles]
        if order_desc:
            cached_msgs = list(reversed(cached_msgs))
        if limit > 0:
            cached_msgs = cached_msgs[:limit]
        return cached_msgs

    # Redis 未命中 → DB 加载并回填
    from app.models import Message

    query = Message.query.filter(Message.conversation_id == conversation_id)
    if roles:
        query = query.filter(Message.role.in_(roles))
    query = query.order_by(Message.created_at.asc())
    db_messages = query.all()

    if not db_messages:
        return []

    msg_dicts = [_message_to_dict(m) for m in db_messages]

    # 回填 Redis
    from core.redis_client import get_redis
    r = get_redis()
    if r:
        try:
            from core.cache import _serialize
            pipe = r.pipeline()
            pipe.delete(cache_key)
            for md in msg_dicts:
                pipe.rpush(cache_key, _serialize(md))
            pipe.expire(cache_key, _TTL_CONV_MSGS)
            pipe.execute()
        except Exception as e:
            logger.debug(f"Redis 回填 conv messages 失败: {e}")

    result = msg_dicts
    if order_desc:
        result = list(reversed(result))
    if limit > 0:
        result = result[:limit]
    return result


def get_conversation_message_count(conversation_id: int) -> int:
    """获取会话消息数量，优先从 Redis List 长度获取"""
    list_len = cache_list_len(_KEY_CONV_MSGS.format(conversation_id))
    if list_len is not None and list_len > 0:
        return list_len

    from app.models import Message
    return Message.query.filter_by(conversation_id=conversation_id).count()


def invalidate_conversation_messages(conversation_id: int):
    """会话消息变更（如删除会话）后调用"""
    invalidate_keys(
        _KEY_CONV_MSGS.format(conversation_id),
        _KEY_CONV_COUNT.format(conversation_id),
    )
