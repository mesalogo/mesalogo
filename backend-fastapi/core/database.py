"""
数据库管理

使用原生 SQLAlchemy（非 Flask-SQLAlchemy），提供：
1. Engine + SessionLocal 工厂
2. get_db() 依赖注入
3. 兼容层：让 app/extensions.py 的 db.session 依然可用
"""
import os
import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, scoped_session, declarative_base
from core.config import settings, BASE_DIR

logger = logging.getLogger(__name__)

# ─── 创建 Engine ───
_engine_kwargs = {
    'pool_pre_ping': True,
    'pool_recycle': settings.SQLALCHEMY_POOL_RECYCLE,
}

# SQLite 不支持连接池参数
if not settings.DATABASE_URI.startswith('sqlite'):
    _engine_kwargs.update({
        'pool_size': settings.SQLALCHEMY_POOL_SIZE,
        'max_overflow': settings.SQLALCHEMY_MAX_OVERFLOW,
        'pool_timeout': settings.SQLALCHEMY_POOL_TIMEOUT,
    })

engine = create_engine(settings.DATABASE_URI, **_engine_kwargs)

# ─── Session 工厂 ───
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# scoped_session：线程安全的 session（services 层通过 db.session 使用）
ScopedSession = scoped_session(SessionLocal)

# ─── Base（models.py 通过兼容层使用） ───
Base = declarative_base()


def get_db():
    """
    FastAPI 依赖注入：提供数据库 session

    用法：
        @router.get('/items')
        def list_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """
    Initialise the database on application startup.

    Order of operations (no silent fallbacks — any failure raises and
    aborts startup, see backend-fastapi/AGENTS.md §"No silent fallbacks"):

    1. Ensure import of every ORM model so SQLAlchemy metadata is
       complete before Alembic introspects it.
    2. Auto-migrate the schema to alembic head:
         - empty DB                       → ``alembic upgrade head`` (creates schema)
         - existing DB w/o ``alembic_version`` → ``alembic stamp head`` then upgrade head
         - existing DB managed by alembic → ``alembic upgrade head`` (no-op if current)
       In every case, ``alembic upgrade head`` is the final step, so a
       schema drift between code and DB will surface here as an exception.
    3. Seed initial data if required.
    4. Load ``system_settings`` rows into the in-memory ``settings`` singleton.

    Bypass (use **only** when an external operator manages migrations):
        export ABM_SKIP_DB_MIGRATE=1
    """
    # 1. SQLite data dir
    if settings.DATABASE_URI.startswith('sqlite'):
        data_dir = os.path.join(BASE_DIR, 'data')
        os.makedirs(data_dir, exist_ok=True)

    # 2. Trigger every ORM model so metadata is complete for Alembic
    import app.models  # noqa: F401

    # 3. Schema → head
    if os.environ.get('ABM_SKIP_DB_MIGRATE') == '1':
        logger.warning(
            "ABM_SKIP_DB_MIGRATE=1 — skipping automatic Alembic migration. "
            "The operator is expected to have run `alembic upgrade head` manually. "
            "If the schema is actually behind the code, ORM queries will fail at runtime."
        )
    else:
        _auto_migrate()

    inspector = inspect(engine)
    tables = inspector.get_table_names()
    logger.info(f"数据库表数量: {len(tables)} (含 alembic_version)")

    # 4. Seed + load system settings
    _seed_if_needed()
    _load_system_settings()


# ─── Alembic auto-migration ──────────────────────────────────────────────
# Why this lives in core/database.py instead of being a separate CLI step:
#   uvicorn dev/prod startup is the single ground-truth entry point for
#   "this version of the code is now running". Coupling migration to it
#   makes "running code" ⇔ "schema at code's expected head" a hard
#   invariant, instead of relying on humans to remember `alembic upgrade
#   head` before each deploy.
#
# No silent fallbacks: any failure of GET_LOCK, of Alembic itself, or of
# the introspection step is allowed to bubble up. Startup must die loud
# rather than serve traffic on a half-migrated DB.

_MIGRATION_LOCK_NAME = 'abm_alembic_upgrade'
_MIGRATION_LOCK_TIMEOUT_SECONDS = 60


def _auto_migrate() -> None:
    """Bring the DB schema to ``alembic head``.

    See decision matrix in :func:`init_database`. This function is
    safe to call from multiple workers concurrently because it serialises
    via a MySQL ``GET_LOCK`` named lock; for SQLite the lock is a no-op
    since SQLite already serialises writes at the file level.
    """
    from alembic.config import Config
    from alembic import command

    alembic_ini = os.path.join(BASE_DIR, 'alembic.ini')
    if not os.path.isfile(alembic_ini):
        raise RuntimeError(
            f"alembic.ini not found at {alembic_ini}; "
            "the project requires Alembic to manage schema. "
            "See backend-fastapi/alembic/README.md."
        )

    cfg = Config(alembic_ini)

    # Inspect before locking so a totally unreachable DB fails fast and
    # cleanly with a connection error, not a confusing GET_LOCK timeout.
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    has_alembic = 'alembic_version' in existing
    has_business_tables = bool(existing - {'alembic_version'})

    # alembic/env.py calls logging.config.fileConfig(), which by default runs
    # with disable_existing_loggers=True. That does two destructive things to
    # the app's logging set up in main.configure_logging():
    #   1. rebuilds the root logger's handlers from alembic.ini (drops our
    #      logs/app.log FileHandler), and
    #   2. sets `.disabled = True` on every already-existing logger
    #      ('main', 'app', 'app.services', ...), silently muting ALL app logs
    #      for the rest of the process lifetime.
    # Snapshot and restore the root handlers/level AND every logger's disabled
    # flag around the embedded upgrade so runtime logs keep reaching app.log.
    _root = logging.getLogger()
    _saved_handlers = list(_root.handlers)
    _saved_level = _root.level
    _saved_disabled = {
        name: lg.disabled
        for name, lg in logging.root.manager.loggerDict.items()
        if isinstance(lg, logging.Logger)
    }

    _acquire_migration_lock()
    try:
        if not has_business_tables:
            logger.info("Empty DB detected — running `alembic upgrade head`")
            command.upgrade(cfg, 'head')
        elif not has_alembic:
            # Legacy DB created by the old `create_all()` path before
            # Alembic was wired up. Adopt it as the baseline, then
            # upgrade in case the code's head is ahead.
            logger.warning(
                "Existing tables found but no alembic_version row — "
                "stamping as baseline then upgrading to head"
            )
            command.stamp(cfg, 'head')
            command.upgrade(cfg, 'head')
        else:
            logger.info("Running `alembic upgrade head` (no-op if already at head)")
            command.upgrade(cfg, 'head')
    finally:
        _release_migration_lock()
        _root.handlers = _saved_handlers
        _root.setLevel(_saved_level)
        for name, was_disabled in _saved_disabled.items():
            lg = logging.root.manager.loggerDict.get(name)
            if isinstance(lg, logging.Logger):
                lg.disabled = was_disabled


def _acquire_migration_lock() -> None:
    """Serialise concurrent startup workers via a MySQL named lock.

    No-op for SQLite (single-writer at file level) and for any other
    backend that doesn't expose ``GET_LOCK`` — in those cases the
    operator is responsible for ensuring only one process performs
    migrations at startup.
    """
    if not settings.DATABASE_URI.startswith('mysql'):
        return

    with engine.connect() as conn:
        got = conn.execute(
            text("SELECT GET_LOCK(:name, :timeout)"),
            {'name': _MIGRATION_LOCK_NAME, 'timeout': _MIGRATION_LOCK_TIMEOUT_SECONDS},
        ).scalar()
        if got != 1:
            # 0 = timeout, NULL = error
            raise RuntimeError(
                f"Could not acquire migration lock '{_MIGRATION_LOCK_NAME}' "
                f"within {_MIGRATION_LOCK_TIMEOUT_SECONDS}s. Another worker may "
                "be migrating, or a previous worker died holding the lock."
            )


def _release_migration_lock() -> None:
    if not settings.DATABASE_URI.startswith('mysql'):
        return
    with engine.connect() as conn:
        conn.execute(
            text("SELECT RELEASE_LOCK(:name)"),
            {'name': _MIGRATION_LOCK_NAME},
        )


def _seed_if_needed():
    """检查并初始化种子数据"""
    from app.models import Agent, Role, SystemSetting
    session = ScopedSession()
    try:
        agent_count = session.query(Agent).count()
        role_count = session.query(Role).count()
        settings_count = session.query(SystemSetting).count()

        logger.info(f"数据检查 - 智能体: {agent_count}, 角色: {role_count}, 系统设置: {settings_count}")

        if agent_count == 0 and role_count == 0:
            logger.info("数据库表为空，初始化种子数据...")
            from app.seed_data import seed_data
            seed_data()
            logger.info("种子数据初始化完成")
        else:
            logger.info("数据库已有数据，跳过种子数据初始化")
    except Exception as e:
        logger.error(f"种子数据初始化出错: {e}", exc_info=True)
    finally:
        ScopedSession.remove()


def _load_system_settings():
    """从数据库加载 SystemSetting 到 settings 单例"""
    from app.models import SystemSetting
    session = ScopedSession()
    try:
        all_settings = session.query(SystemSetting).all()
        for s in all_settings:
            config_key = s.key.upper()
            if s.value_type == 'boolean':
                config_value = s.value.lower() in ('true', '1', 'yes')
            elif s.value_type == 'number':
                try:
                    config_value = float(s.value) if '.' in s.value else int(s.value)
                except (ValueError, TypeError):
                    config_value = 0
            else:
                config_value = s.value
            settings[config_key] = config_value
        logger.info(f"从数据库加载了 {len(all_settings)} 个系统设置")
    except Exception as e:
        logger.error(f"加载系统设置出错: {e}", exc_info=True)
    finally:
        ScopedSession.remove()
