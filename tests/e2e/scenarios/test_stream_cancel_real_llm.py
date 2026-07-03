"""E2E: real-LLM streaming cancellation (真实 LLM 流式取消).

Drives ModelClient.send_request against a REAL model and verifies the two
cancel paths documented in docs/agents/stream-cancel-architecture.md:

  1. connection_manager hard cancel (cancel_request -> force_close_connection)
  2. queue cancel signal ({'type': 'cancel'} on callback.result_queue,
     detected by the non-destructive scan in check_for_cancel_signal)

plus a control run (no cancel -> full completion).

Marked `external`: requires real network + a model config with a live api_key.
Model credentials are read from the model_configs table of the local docker
MariaDB. Skips cleanly when the DB or model config is unavailable.

Run:
    SMOKE_DB_PASSWORD=... pytest tests/e2e/scenarios/test_stream_cancel_real_llm.py -m external
    (SMOKE_DB_PASSWORD defaults to MARIADB_ROOT_PASSWORD from abm-docker/.env)

Threading note: send_request is a synchronous facade over a worker-thread
event loop (see stream-cancel-architecture.md §2), so these tests exercise it
from plain threads with Event-based waits, not from the anyio loop.
"""

from __future__ import annotations

import os
import queue
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

pytestmark = [pytest.mark.external]

MODEL_NAME = os.environ.get("SMOKE_MODEL_NAME", "qwen-turbo")

_LONG_PROMPT = (
    "请用中文写一篇不少于3000字的、非常详细的关于蚂蚁群体协作行为的科普长文，"
    "分至少10个小节，每节都要有小标题和充分展开的内容。不要提前结束。"
)


def _db_password() -> str | None:
    pw = os.environ.get("SMOKE_DB_PASSWORD")
    if pw:
        return pw
    env_file = Path(__file__).resolve().parents[3] / "abm-docker" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("MARIADB_ROOT_PASSWORD="):
                return line.split("=", 1)[1].strip()
    return None


@pytest.fixture(scope="module", autouse=True)
def _no_socks_proxy():
    # httpx without the socksio extra raises on ALL_PROXY=socks5://...;
    # the plain HTTP(S)_PROXY vars keep working for the real API call.
    saved = {}
    for key in ("ALL_PROXY", "all_proxy"):
        if key in os.environ:
            saved[key] = os.environ.pop(key)
    yield
    os.environ.update(saved)


@pytest.fixture(scope="module")
def model_config():
    pymysql = pytest.importorskip("pymysql")
    pw = _db_password()
    if not pw:
        pytest.skip("no DB password (SMOKE_DB_PASSWORD / abm-docker/.env)")
    try:
        conn = pymysql.connect(
            host=os.environ.get("SMOKE_DB_HOST", "127.0.0.1"),
            port=int(os.environ.get("SMOKE_DB_PORT", "16011")),
            user="root",
            password=pw,
            database=os.environ.get("SMOKE_DB_NAME", "abm"),
            connect_timeout=5,
        )
    except Exception as e:
        pytest.skip(f"MariaDB unreachable: {e}")
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT base_url, api_key, model_id, provider, format_compatibility "
                "FROM model_configs WHERE name=%s",
                (MODEL_NAME,),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        pytest.skip(f"model config not found: {MODEL_NAME}")
    return SimpleNamespace(
        base_url=row[0],
        api_key=row[1],
        model_id=row[2],
        provider=row[3],
        format_compatibility=row[4],
        custom_headers=None,
        custom_body=None,
        modalities=[],
        additional_params=None,
    )


class _StreamRun:
    """One send_request run in a worker thread with chunk timeline capture."""

    def __init__(self, model_config, task_id: int, conversation_id: int, agent_id: str,
                 prompt: str = _LONG_PROMPT, min_chunks: int = 5):
        self.model_config = model_config
        self.task_id = task_id
        self.conversation_id = conversation_id
        self.agent_id = agent_id
        self.prompt = prompt
        self.min_chunks = min_chunks
        self.chunks: list[tuple[float, str]] = []
        self.enough_chunks = threading.Event()
        self.result: str | None = None
        self.exc: Exception | None = None
        self.result_queue: queue.Queue = queue.Queue()
        self.thread: threading.Thread | None = None
        self.finished_at = 0.0

    def make_callback(self):
        def cb(content, meta=None):
            if content:
                self.chunks.append((time.monotonic(), content))
                if len(self.chunks) >= self.min_chunks:
                    self.enough_chunks.set()

        cb.result_queue = self.result_queue
        return cb

    def start(self):
        from app.services.conversation.model_client import ModelClient

        cb = self.make_callback()

        def run():
            client = ModelClient()
            try:
                self.result = client.send_request(
                    model_config=self.model_config,
                    messages=[{"role": "user", "content": self.prompt}],
                    is_stream=True,
                    callback=cb,
                    agent_info={"id": self.agent_id, "name": "e2e", "role_name": "e2e"},
                    task_id=self.task_id,
                    conversation_id=self.conversation_id,
                )
            except Exception as e:  # noqa: BLE001 - harness records any failure
                self.exc = e
            finally:
                self.finished_at = time.monotonic()

        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def content(self) -> str:
        return "".join(c for _, c in self.chunks)

    def chunks_after(self, t: float) -> int:
        return sum(1 for ts, _ in self.chunks if ts > t)


def test_control_stream_completes(model_config):
    # Control: without cancel, a short request streams to completion.
    run = _StreamRun(model_config, 990003, 990003, "e2e-ctl",
                     prompt="用一句话介绍蚂蚁。", min_chunks=1)
    run.start()
    run.thread.join(timeout=90)

    assert not run.thread.is_alive(), "control run did not finish within 90s"
    assert run.exc is None, f"control run raised: {run.exc}"
    assert run.result and not run.result.startswith("Error:")
    assert run.content(), "no streamed chunks received"


def test_hard_cancel_stops_stream_fast(model_config):
    # Cancel via connection_manager mid-stream; stream must stop within 5s
    # and no chunks may keep arriving afterwards.
    from app.services.conversation.model_client import cancel_request

    run = _StreamRun(model_config, 990001, 990001, "e2e-hard")
    run.start()

    assert run.enough_chunks.wait(timeout=90), "stream never produced enough chunks"

    cancel_at = time.monotonic()
    cancel_request(run.task_id, run.conversation_id, run.agent_id)

    run.thread.join(timeout=10)
    assert not run.thread.is_alive(), "worker thread still alive 10s after cancel (zombie)"

    stop_latency = run.finished_at - cancel_at
    assert stop_latency <= 5.0, f"stop latency too high: {stop_latency:.2f}s"
    assert run.chunks_after(cancel_at + 3.0) == 0, "chunks still arriving >3s after cancel"
    assert run.exc is None, f"cancel surfaced as exception: {run.exc}"


def test_queue_cancel_signal_stops_stream(model_config):
    # Cancel via {'type':'cancel'} queue signal placed BEHIND a pending data
    # message: the non-destructive scan must find it, stop the stream, and
    # leave the queue order intact for the SSE consumer.
    run = _StreamRun(model_config, 990002, 990002, "e2e-queue")
    run.start()

    assert run.enough_chunks.wait(timeout=90), "stream never produced enough chunks"

    run.result_queue.put("pending-data-msg")
    run.result_queue.put({"type": "cancel", "agent_id": run.agent_id})
    cancel_at = time.monotonic()

    run.thread.join(timeout=15)
    assert not run.thread.is_alive(), "worker thread still alive 15s after cancel (zombie)"

    stop_latency = run.finished_at - cancel_at
    assert stop_latency <= 8.0, f"stop latency too high: {stop_latency:.2f}s"
    # non-destructive scan: pending data message still first, cancel still queued
    assert run.result_queue.get_nowait() == "pending-data-msg"
    assert run.result_queue.get_nowait() == {"type": "cancel", "agent_id": run.agent_id}
