"""
首启引导（Setup）服务

仅在 Setup 模式下被调用，负责：
1. 实测数据库 / Redis 连接（不持久化）。
2. 把用户填写的连接级配置原子写入 config.conf。
3. 调度后端自重启，让新配置生效。

设计约定：前端拼好完整的 SQLAlchemy DATABASE_URI（含驱动，如
``mysql+pymysql://user:pass@host:3306/db?charset=utf8mb4``）传入，后端只测试
与保存，不关心字段拼装，保持契约通用。
"""
import os
import sys
import secrets
import logging
import threading
import configparser

from core.config import _config_path, BASE_DIR

logger = logging.getLogger(__name__)


def test_db(database_uri: str) -> dict:
    """实测数据库连接。返回 {ok: bool, error?: str}。不持久化。"""
    if not database_uri or not database_uri.strip():
        return {'ok': False, 'error': '连接串为空'}
    from sqlalchemy import create_engine, text
    engine = None
    try:
        engine = create_engine(database_uri, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': f'{type(e).__name__}: {e}'}
    finally:
        if engine is not None:
            engine.dispose()


def test_redis(redis_url: str) -> dict:
    """实测 Redis 连接。返回 {ok: bool, error?: str}。不持久化。"""
    if not redis_url or not redis_url.strip():
        return {'ok': False, 'error': '连接串为空'}
    import redis
    client = None
    try:
        client = redis.from_url(redis_url, socket_connect_timeout=3, socket_timeout=2)
        client.ping()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': f'{type(e).__name__}: {e}'}
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def write_config(payload: dict) -> dict:
    """
    把连接级配置写入 config.conf 的 [BACKEND_CONFIG] 段（原子替换）。

    payload 接受的键：database_uri（必填）、redis_url、host、port。
    若现有配置缺 SECRET_KEY / LICENSE_SECRET_KEY，则生成强随机值写入，
    避免新部署沿用默认开发密钥。

    返回 {ok: bool, error?: str}。
    """
    database_uri = (payload.get('database_uri') or '').strip()
    if not database_uri:
        return {'ok': False, 'error': 'database_uri 不能为空'}

    parser = configparser.ConfigParser()
    # 保留键名大小写（默认 optionxform 会转小写），与 config.conf.example
    # 的 DATABASE_URI 等大写风格保持一致。读取侧大小写不敏感，故只影响美观与一致性。
    parser.optionxform = str
    # 保留 config.conf 中可能已存在的其它键
    if os.path.exists(_config_path):
        parser.read(_config_path, encoding='utf-8')
    if 'BACKEND_CONFIG' not in parser:
        parser['BACKEND_CONFIG'] = {}
    section = parser['BACKEND_CONFIG']

    section['DATABASE_URI'] = database_uri
    if payload.get('redis_url') is not None:
        section['REDIS_URL'] = str(payload.get('redis_url') or '').strip()
    if payload.get('host'):
        section['HOST'] = str(payload['host']).strip()
    if payload.get('port'):
        section['PORT'] = str(payload['port']).strip()

    # 首次写入时补强随机密钥
    for key in ('SECRET_KEY', 'LICENSE_SECRET_KEY'):
        if not section.get(key, '').strip():
            section[key] = secrets.token_urlsafe(48)

    # 原子写：先写临时文件再 os.replace，避免半截配置
    tmp_path = _config_path + '.tmp'
    try:
        with open(tmp_path, 'w', encoding='utf-8') as f:
            parser.write(f)
        os.replace(tmp_path, _config_path)
        logger.info(f"首启配置已写入: {_config_path}")
        return {'ok': True}
    except Exception as e:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        return {'ok': False, 'error': f'写入失败: {type(e).__name__}: {e}'}


def schedule_restart(delay: float = 1.0):
    """
    延迟后用 os.execv 自重启进程，让新写入的 config.conf 生效。

    延迟是为了让 /api/setup/save 的 HTTP 响应先返回前端。开发模式
    （run_app.py / uvicorn reload）下可靠；生产 gunicorn 需配合
    systemd / supervisor 的自动拉起，详见 README。
    """
    def _restart():
        logger.info("首启配置完成，正在重启后端以应用新配置...")
        try:
            # sys.orig_argv 完整保留原始解释器参数（含 `-m uvicorn` 等），
            # 对 `python run_app.py` 和 `python -m uvicorn main:app` 两种入口
            # 都能正确重建命令；直接用 sys.argv 会丢失 `-m` 上下文导致重启崩溃。
            argv = getattr(sys, 'orig_argv', None) or ([sys.executable] + sys.argv)
            os.execv(sys.executable, [sys.executable] + argv[1:])
        except Exception as e:
            logger.error(f"自重启失败，请手动重启后端: {e}")

    threading.Timer(delay, _restart).start()
