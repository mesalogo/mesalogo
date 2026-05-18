"""
Sanity 测试 - 验证测试 harness 本身是好的。

存在意义:
- 一份"最小可运行"的样例,新人/AI agent 改 fixture 不小心打坏时这个先红。
- 验证 anyio backend 钉死 asyncio。
- 验证 mock_llm fixture 真能 inject。
- 验证 factory 默认值合理。

测试这份测试通过,说明 conftest / pytest.ini / fixtures 都没坏。
"""
from __future__ import annotations

import pytest

from tests.fixtures.factories import (
    make_action_space,
    make_agent,
    make_heartbeat_event,
)
from tests.fixtures.mocks.llm import MockLLM


# ─── 1. anyio backend ───

def test_anyio_backend_is_asyncio(anyio_backend):
    assert anyio_backend == "asyncio"


# ─── 2. async fixture 工作正常 ───

async def test_async_test_runs():
    """如果这条红了,说明 pytest-anyio 没装或 anyio_mode 没生效。"""
    import asyncio
    await asyncio.sleep(0)
    assert True


# ─── 3. mock_llm fixture ───

async def test_mock_llm_returns_preset_reply(mock_llm: MockLLM):
    mock_llm.reply_with("hello")
    out = await mock_llm.chat([{"role": "user", "content": "hi"}])
    assert out == "hello"


async def test_mock_llm_records_call_history(mock_llm: MockLLM):
    mock_llm.reply_with("ok")
    await mock_llm.chat([{"role": "user", "content": "ping"}], temperature=0.7)
    assert mock_llm.call_count == 1
    assert mock_llm.calls[0].messages[-1]["content"] == "ping"
    assert mock_llm.calls[0].kwargs == {"temperature": 0.7}


async def test_mock_llm_falls_back_to_default(mock_llm: MockLLM):
    mock_llm.set_default("DEFAULT")
    out = await mock_llm.chat([{"role": "user", "content": "x"}])
    assert out == "DEFAULT"


async def test_mock_llm_stream_yields_chunks(mock_llm: MockLLM):
    mock_llm.reply_with("abc")
    chunks = []
    async for c in mock_llm.stream([{"role": "user", "content": "x"}]):
        chunks.append(c)
    assert "".join(chunks) == "abc"


# ─── 4. factories ───

def test_make_agent_defaults_are_heartbeat_off():
    agent = make_agent()
    assert agent["heartbeat_enabled"] is False
    assert agent["heartbeat_state"] == "idle"
    assert agent["heartbeat_policy"] == "noop"


def test_make_agent_accepts_overrides():
    agent = make_agent(
        id=42,
        name="alice",
        heartbeat_enabled=True,
        heartbeat_interval_seconds=30,
        heartbeat_policy="reflect",
    )
    assert agent["id"] == 42
    assert agent["name"] == "alice"
    assert agent["heartbeat_enabled"] is True
    assert agent["heartbeat_interval_seconds"] == 30
    assert agent["heartbeat_policy"] == "reflect"


def test_make_action_space_default_status_opened():
    space = make_action_space()
    assert space["status"] == "opened"


def test_make_heartbeat_event_minimal_fields_present():
    ev = make_heartbeat_event(outcome="reflected", output_summary="hi")
    assert ev["outcome"] == "reflected"
    assert ev["output_summary"] == "hi"
    assert ev["meta"] == {}
    assert ev["triggered_at"] is not None


# ─── 5. layer marker 自动注入 ───

def test_this_file_was_marked_unit_by_layer_conftest(request):
    """unit/conftest.py 的 pytest_collection_modifyitems 应自动给我们打上 unit marker。"""
    markers = {m.name for m in request.node.iter_markers()}
    assert "unit" in markers
