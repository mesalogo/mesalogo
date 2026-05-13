"""
通用缓存工具层

基于 Redis 的缓存原语，支持：
- cached_query(key, ttl, loader) — read-through 缓存
- cache_get / cache_set — 直接读写
- invalidate_keys — 按 key 精确失效
- cache_list_* — Redis List 操作（消息列表）

所有操作在 Redis 不可用时自动降级（静默跳过），不影响业务逻辑。
"""
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ─── 序列化：优先 orjson（快 3-5x），fallback 到标准 json ───
try:
    import orjson

    def _serialize(obj: Any) -> str:
        return orjson.dumps(obj).decode('utf-8')

    def _deserialize(raw: str) -> Any:
        return orjson.loads(raw)

except ImportError:
    import json

    def _serialize(obj: Any) -> str:
        return json.dumps(obj, ensure_ascii=False, default=str)

    def _deserialize(raw: str) -> Any:
        return json.loads(raw)


# ═══════════════════════════════════════════════════════
# 基础读写
# ═══════════════════════════════════════════════════════

def cached_query(key: str, ttl: int, loader: Callable[[], Any]) -> Any:
    """
    Read-through 缓存：Redis 命中直接返回，未命中调 loader() 并回填。
    Redis 不可用时直接调用 loader()。
    """
    from core.redis_client import get_redis

    r = get_redis()
    if r:
        try:
            raw = r.get(key)
            if raw is not None:
                return _deserialize(raw)
        except Exception as e:
            logger.debug(f"Redis GET {key} 失败: {e}")

    result = loader()

    if r and result is not None:
        try:
            r.setex(key, ttl, _serialize(result))
        except Exception as e:
            logger.debug(f"Redis SETEX {key} 失败: {e}")

    return result


def cache_get(key: str) -> Optional[Any]:
    """直接读取缓存，未命中或 Redis 不可用返回 None"""
    from core.redis_client import get_redis

    r = get_redis()
    if not r:
        return None
    try:
        raw = r.get(key)
        return _deserialize(raw) if raw is not None else None
    except Exception as e:
        logger.debug(f"Redis GET {key} 失败: {e}")
        return None


def cache_set(key: str, value: Any, ttl: int = 300):
    """直接写入缓存（默认 TTL 5 分钟）"""
    from core.redis_client import get_redis

    r = get_redis()
    if not r:
        return
    try:
        r.setex(key, ttl, _serialize(value))
    except Exception as e:
        logger.debug(f"Redis SETEX {key} 失败: {e}")


def invalidate_keys(*keys: str):
    """精确删除指定的缓存键"""
    from core.redis_client import get_redis

    r = get_redis()
    if not r or not keys:
        return
    try:
        r.delete(*keys)
    except Exception as e:
        logger.debug(f"Redis DELETE {keys} 失败: {e}")


# ═══════════════════════════════════════════════════════
# Redis List 操作（用于会话消息列表）
# ═══════════════════════════════════════════════════════

def cache_list_rpush(key: str, value: Any, ttl: int = 1800):
    """向 Redis List 尾部追加元素"""
    from core.redis_client import get_redis

    r = get_redis()
    if not r:
        return
    try:
        r.rpush(key, _serialize(value))
        r.expire(key, ttl)
    except Exception as e:
        logger.debug(f"Redis RPUSH {key} 失败: {e}")


def cache_list_range(key: str, start: int = 0, end: int = -1) -> list:
    """读取 Redis List 指定范围，返回反序列化后的列表"""
    from core.redis_client import get_redis

    r = get_redis()
    if not r:
        return []
    try:
        raw_list = r.lrange(key, start, end)
        return [_deserialize(item) for item in raw_list]
    except Exception as e:
        logger.debug(f"Redis LRANGE {key} 失败: {e}")
        return []


def cache_list_len(key: str) -> Optional[int]:
    """获取 Redis List 长度"""
    from core.redis_client import get_redis

    r = get_redis()
    if not r:
        return None
    try:
        return r.llen(key)
    except Exception as e:
        logger.debug(f"Redis LLEN {key} 失败: {e}")
        return None
