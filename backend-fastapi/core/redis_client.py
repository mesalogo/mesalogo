"""
Redis 连接管理

提供全局 Redis 客户端，支持优雅降级：
- Redis 可用 → 正常缓存
- Redis 不可用 → get_redis() 返回 None，所有缓存操作跳过，直接走 DB

连接配置来自 config.conf 或环境变量 REDIS_URL
"""
import logging
import redis

logger = logging.getLogger(__name__)

_redis_client: redis.Redis | None = None
_redis_unavailable: bool = False  # 标记 Redis 不可用，避免反复重连


def init_redis() -> redis.Redis | None:
    """
    初始化 Redis 连接（应用启动时调用）

    Returns:
        redis.Redis 实例，或 None（未配置/连接失败）
    """
    global _redis_client, _redis_unavailable
    from core.config import settings

    url = settings.get('REDIS_URL', '')
    if not url:
        logger.info("Redis: 未配置 REDIS_URL，使用无缓存模式")
        _redis_unavailable = True
        return None

    try:
        _redis_client = redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=2,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        _redis_client.ping()
        info = _redis_client.info('server')
        version = info.get('redis_version', 'unknown')
        logger.info(f"✓ Redis 已连接: {url} (v{version})")
        _redis_unavailable = False
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis 连接失败，降级为无缓存模式: {e}")
        _redis_client = None
        _redis_unavailable = True
        return None


def get_redis() -> redis.Redis | None:
    """
    获取 Redis 客户端

    Returns:
        redis.Redis 实例，或 None（未配置/连接失败）

    用法:
        r = get_redis()
        if r:
            r.set('key', 'value', ex=60)
    """
    if _redis_unavailable:
        return None
    return _redis_client


def close_redis():
    """关闭 Redis 连接（应用关闭时调用）"""
    global _redis_client, _redis_unavailable
    if _redis_client:
        try:
            _redis_client.close()
            logger.info("Redis 连接已关闭")
        except Exception as e:
            logger.warning(f"Redis 关闭异常: {e}")
        finally:
            _redis_client = None
            _redis_unavailable = True
