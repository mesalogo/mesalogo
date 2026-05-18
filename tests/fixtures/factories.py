"""
内存对象工厂。

约定见 tests/AGENTS.md §3:
- 函数前缀 make_
- 单测**不入库**,只构造内存对象
- 集成测试入库由 caller 显式: `db_session.add(make_agent())`

不要在这里依赖 SQLAlchemy session;依赖 session 的 helper 放
tests/integration/conftest.py 或更近的 conftest。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


# ═════ 简单的 dict-based factories ═════
# 不依赖 SQLAlchemy 模型,任何测试都能用。
# 集成测试若需要真 ORM 对象,可在自己的 conftest 里包一层:
#   def make_agent_orm(**kw): return Agent(**make_agent_dict(**kw))


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def make_agent(
    *,
    id: int = 1,
    name: str = "test-agent",
    action_space_id: int = 1,
    role_id: int | None = None,
    heartbeat_enabled: bool = False,
    heartbeat_interval_seconds: int | None = None,
    heartbeat_policy: str = "noop",
    **extra: Any,
) -> dict[str, Any]:
    return {
        "id": id,
        "name": name,
        "action_space_id": action_space_id,
        "role_id": role_id,
        "heartbeat_enabled": heartbeat_enabled,
        "heartbeat_interval_seconds": heartbeat_interval_seconds,
        "heartbeat_policy": heartbeat_policy,
        "heartbeat_last_tick_at": None,
        "heartbeat_next_tick_at": None,
        "heartbeat_state": "idle",
        "heartbeat_meta": {},
        "created_at": _now(),
        **extra,
    }


def make_action_space(
    *,
    id: int = 1,
    name: str = "test-space",
    status: str = "opened",
    **extra: Any,
) -> dict[str, Any]:
    return {
        "id": id,
        "name": name,
        "status": status,
        "created_at": _now(),
        **extra,
    }


def make_heartbeat_event(
    *,
    agent_id: int = 1,
    action_space_id: int = 1,
    policy: str = "noop",
    outcome: str = "noop",
    duration_ms: int = 0,
    output_summary: str | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "agent_id": agent_id,
        "action_space_id": action_space_id,
        "triggered_at": _now(),
        "duration_ms": duration_ms,
        "policy": policy,
        "outcome": outcome,
        "output_summary": output_summary,
        "meta": meta or {},
    }
