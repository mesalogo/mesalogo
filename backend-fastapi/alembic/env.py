"""
Alembic environment.

We override Alembic's stock template in three places:

1. `sys.path` is patched so that `import app.*` / `import core.*` works
   when alembic is invoked from any directory.
2. The DB URL comes from `core.config.settings.DATABASE_URI` (which reads
   `config.conf` / env), NOT from `alembic.ini`. This keeps real
   credentials out of git.
3. `target_metadata` points at `app.extensions.db.Model.metadata`, the
   actual Declarative Base used by every ORM model in this project.
"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ─── 1. sys.path ───
# alembic/env.py lives at <repo>/backend-fastapi/alembic/env.py
# We want <repo>/backend-fastapi/ on sys.path so `app.*` / `core.*` import works.
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

# ─── 2. DB URL from settings ───
from core.config import settings  # noqa: E402

# ─── 3. Trigger ORM registration ───
# Import the compat-db FIRST (creates the declarative_base + metadata),
# then app.models which registers every Table on that metadata.
from app.extensions import db  # noqa: E402,F401
import app.models  # noqa: E402,F401

# Standard alembic boilerplate from here ─────────────────────────────────────
config = context.config

# Inject the real URL. Escape `%` so configparser doesn't try to interpolate.
_db_url = settings.DATABASE_URI
config.set_main_option("sqlalchemy.url", _db_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = db.Model.metadata


def run_migrations_offline() -> None:
    """Generate SQL migration scripts without connecting to the database."""
    context.configure(
        url=_db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
