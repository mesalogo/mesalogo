# Heartbeat — 安全停机语义

> 配套主文档: [`PLAN.md`](./PLAN.md)
>
> **本文档存在的原因**: TODO.md 已经记录过"自主任务停不下来"翻车
> ([`#BUG`](../../TODO.md))。Heartbeat 是更长周期、更宽边界的驱动体,
> **更容易**重复同一个 Bug。**所以这块要事先写清楚停机语义,不是事后补救。**

---

## 1. 停机的三个层次

| 层次 | 触发 | 影响 | 语义 |
|---|---|---|---|
| L1 单 agent 停 | `PUT /api/agents/{id}/heartbeat` 设 `enabled=false`,或 agent 被删除 | 该 agent 不再被 enqueue | 平滑;已 dispatch 的 tick 跑完 |
| L2 整个空间停 | `ActionSpace.close()` 或 UI 上"暂停心跳" | 该空间所有 agent 立刻从 Registry 剔除 | 平滑;已 dispatch 的 tick 跑完 |
| L3 服务停机 | `lifespan` shutdown / 进程 SIGTERM | 整个 HeartbeatService 关 | 优雅停机,等待 `drain_timeout_seconds` 后强杀 |

---

## 2. L1 — 单 agent 停

### 2.1 API 路径

```
PUT /api/agents/{id}/heartbeat
Body: {"enabled": false}
```

### 2.2 后端流程

1. HTTP handler 更新 DB: `Agent.heartbeat_enabled = False`,
   `Agent.heartbeat_state = 'idle'`,清空 `next_tick_at`。
2. 同步调 `HeartbeatService.deregister_agent(agent_id)`。
3. `AgentRegistry` 从内存索引里删掉该 agent。
4. **如果该 agent 当前正在 worker 里跑**(`heartbeat_state='running'`):
   - 不打断当前 tick——让它正常跑完。
   - tick 完成时 `PolicyExecutor` 检查 `agent.heartbeat_enabled` 仍为 `False`,
     **不**调度下一次 tick。
5. SSE 推一条 `heartbeat.disabled` 通知前端。

### 2.3 测试要求

- `test_disable_agent_stops_future_ticks` — 关掉后 5 秒内不应该再有 tick。
- `test_disable_during_running_tick_completes_gracefully` — 跑到一半关,
  当前 tick 正常完成,下一次不再来。

---

## 3. L2 — 整个空间停 ⭐ 最常用

### 3.1 触发场景

- 用户手动关 ActionSpace。
- UI 上"暂停所有心跳"按钮。
- 行动空间被删除(CASCADE)。

### 3.2 后端流程

```python
# app/services/heartbeat/service.py
async def deregister_space(self, action_space_id: int) -> None:
    """
    立即剔除该空间所有 agent 的 next_tick。
    已 dispatch 但还没跑完的 tick 允许跑完(原子保证 outcome 写入)。
    """
    agents = self.registry.list_agents_in_space(action_space_id)
    self.registry.remove_space(action_space_id)
    # DB 侧批量更新
    async with get_session() as s:
        await s.execute(
            update(Agent)
            .where(Agent.action_space_id == action_space_id)
            .values(heartbeat_state='paused', heartbeat_next_tick_at=None)
        )
        await s.commit()
    logger.info("Heartbeat: space %d deregistered, %d agents removed",
                action_space_id, len(agents))
```

### 3.3 关键不变式

- `deregister_space()` **同步返回**前,内存 Registry 必须已经不含该空间。
  否则 TickClock 下一秒还会把这些 agent 重新入队 → BUG。
- DB 写库放在 `deregister_space()` 内部完成,**不能**让 caller(比如
  ActionSpace.close 的 handler)分两步做——分两步就有竞态窗口。

### 3.4 测试要求(必写)

```python
# tests/services/heartbeat/test_e2e_space_close_stops_heartbeat.py
async def test_close_space_immediately_stops_all_ticks():
    space = await create_space_with_heartbeating_agents(n=5, interval_sec=1)
    await asyncio.sleep(2)
    assert count_events(space) >= 5  # 至少跳过几次

    await close_action_space(space.id)
    events_before = count_events(space)

    await asyncio.sleep(3)
    events_after = count_events(space)
    # 允许当时正在跑的 tick 完成(最多 5 个),不允许有新 tick
    assert events_after - events_before <= 5
```

---

## 4. L3 — 服务停机

### 4.1 触发

- `lifespan` shutdown 钩子。
- 进程收到 SIGTERM / SIGINT。
- Docker 容器停止。

### 4.2 后端流程

```python
# app/services/heartbeat/service.py
async def stop(self, drain_timeout_seconds: float = 30.0) -> None:
    """
    1. 停 TickClock(不再产生新 tick)。
    2. 等待 DispatchQueue 排空 或 drain 超时。
    3. 取消所有 worker 任务。
    4. 当前正在跑的 tick 被 task.cancel() —— 策略要响应 CancelledError。
    """
    self.clock.stop()
    try:
        await asyncio.wait_for(self.queue.join(), timeout=drain_timeout_seconds)
    except asyncio.TimeoutError:
        logger.warning("Heartbeat: drain timeout, forcing worker cancellation")
    for w in self.workers:
        w.cancel()
    await asyncio.gather(*self.workers, return_exceptions=True)
```

### 4.3 策略响应 CancelledError 的契约

```python
class MyPolicy:
    async def execute(self, ctx):
        try:
            result = await self._do_work(ctx)
        except asyncio.CancelledError:
            # 必须把"被取消"作为正常 outcome 之一,而不是吞掉异常
            logger.info("Policy %s cancelled mid-execution", self.name)
            raise   # 一定要 raise,让 worker 知道
        return result
```

### 4.4 测试要求

- `test_shutdown_drains_queue` — drain_timeout 内队列能排空。
- `test_shutdown_cancels_long_running_tick` — 长跑的 tick 被取消,不留僵尸。

---

## 5. 反模式 (做了就触发"自主任务停不下来"翻车)

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| 在 handler 里只更新 DB,不调 `deregister_*` | TickClock 还能从 stale memory 读到 agent,继续跳 | DB + Registry 必须同步原子更新 |
| 用 `self.running = False` 让 worker 自己退出 | worker 没法立即响应,等下次 loop 才退 | 用 `task.cancel()` |
| 策略里 `try/except CancelledError: pass` | shutdown 永远等不到 worker 退出 | `except CancelledError: raise` |
| 心跳事件用主 conversation SSE 流推 | 一个对话关了流,所有 heartbeat 都歇菜 | 单独的 `heartbeat.tick` SSE 通道 |
| 在 `lifespan` startup 里同步 `await heartbeat.start()` 跑很久 | 应用启动卡死 | startup 只 `create_task(heartbeat.start())`,fire-and-forget |

---

## 6. Observability — 看到它真的停了

每次 deregister 写一条 `AgentHeartbeatEvent`,`outcome='deregistered'`,
`meta={reason: "space_closed" / "agent_disabled" / "shutdown"}`。

UI 上"心跳概览"页面要能筛出最近的 deregister 事件,
便于人工确认"心跳确实停了"。

---

## 7. 何时回到本文档

- 实现 P1 骨架时:照 §3 写 `deregister_space` + 测试。
- 实现 P2 策略时:照 §4.3 给每个策略加 CancelledError 处理。
- 排查"心跳停不下来"事故时:从 §5 反模式表往下查。

---

_last review: 2026-05-13(spec 阶段)_
