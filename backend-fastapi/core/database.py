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
    初始化数据库：创建表 + 种子数据

    在应用启动时调用（替代 Flask 的 with app.app_context(): db.create_all()）
    """
    from app.extensions import db as flask_compat_db

    # 确保 data 目录存在（SQLite 场景）
    if settings.DATABASE_URI.startswith('sqlite'):
        data_dir = os.path.join(BASE_DIR, 'data')
        os.makedirs(data_dir, exist_ok=True)

    # 导入所有模型，确保 metadata 注册完整
    from app.models import Agent, Role, SystemSetting
    from app.models import ActionSpace, ActionSpaceEnvironmentVariable, RoleVariable, ExternalEnvironmentVariable

    # 创建所有表
    flask_compat_db.Model.metadata.create_all(bind=engine)

    # 验证
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    logger.info(f"数据库表创建成功: {tables}")

    # 初始化种子数据
    _seed_if_needed()

    # 加载系统设置到 settings 单例
    _load_system_settings()


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
