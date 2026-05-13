"""
Flask-SQLAlchemy 兼容层

让 models.py 的 `from app.extensions import db` 和 `db.Model`、`db.session` 继续工作，
无需修改任何现有的 model / service 代码。

原理：
- db.Model → 提供 declarative base（带 metadata）
- db.session → 代理到 scoped_session
- db.Column / db.String / ... → 直接暴露 SQLAlchemy 类型
- db.relationship / db.backref → 直接暴露 ORM 工具
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    ForeignKey, JSON, Float, Table, UniqueConstraint, Index, Enum,
    LargeBinary, Numeric, SmallInteger, BigInteger, Date, Time,
    Interval, event
)
from sqlalchemy.orm import relationship, backref, declarative_base, scoped_session, sessionmaker
from sqlalchemy.dialects.mysql import LONGTEXT


class _QueryProperty:
    """
    模拟 Flask-SQLAlchemy 的 Model.query 属性

    让 User.query.filter_by(...) 这样的代码继续工作
    """
    def __get__(self, obj, cls):
        from core.database import ScopedSession
        return ScopedSession.query(cls)


class _CompatDB:
    """
    模拟 Flask-SQLAlchemy 的 db 对象

    支持的接口：
    - db.Model（declarative base + query 属性）
    - db.session（scoped session）
    - db.Column / db.String / ... （列类型快捷方式）
    - db.relationship / db.backref （ORM 关系工具）
    - db.create_all() / db.drop_all()
    """

    def __init__(self):
        self._base = declarative_base()
        # 给 base 加上 query 属性，让 Model.query 可用
        self._base.query = _QueryProperty()
        self._engine = None
        self._scoped_session = None

    @property
    def Model(self):
        return self._base

    @property
    def session(self):
        if self._scoped_session is None:
            from core.database import engine, ScopedSession
            self._engine = engine
            self._scoped_session = ScopedSession
        return self._scoped_session

    def create_all(self, bind=None):
        """创建所有表"""
        _engine = bind or self._engine
        if _engine is None:
            from core.database import engine
            _engine = engine
        self._base.metadata.create_all(bind=_engine)

    def drop_all(self, bind=None):
        """删除所有表"""
        _engine = bind or self._engine
        if _engine is None:
            from core.database import engine
            _engine = engine
        self._base.metadata.drop_all(bind=_engine)

    def init_app(self, app):
        """Flask 兼容：忽略 init_app 调用"""
        pass

    # ─── SQLAlchemy 列类型 ───
    Column = Column
    Integer = Integer
    SmallInteger = SmallInteger
    BigInteger = BigInteger
    String = String
    Text = Text
    DateTime = DateTime
    Date = Date
    Time = Time
    Boolean = Boolean
    ForeignKey = ForeignKey
    JSON = JSON
    Float = Float
    Numeric = Numeric
    LargeBinary = LargeBinary
    Enum = Enum
    Interval = Interval
    Table = Table
    UniqueConstraint = UniqueConstraint
    Index = Index
    LONGTEXT = LONGTEXT

    # ─── ORM 工具 ───
    relationship = staticmethod(relationship)
    backref = staticmethod(backref)

    # ─── 事件 ───
    event = event


# ─── 全局单例 ───
db = _CompatDB()
