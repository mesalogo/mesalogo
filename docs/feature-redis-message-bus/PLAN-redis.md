# 基于 Redis 的 SSE 断线续传与回放方案（适用于行动任务详情与聊天窗口）

## 背景与问题
- 行动任务详情：当前使用纯 SSE 实现，用户离开页面再回来，仍可看到持续的流式输出（具备“续流/回放”效果）。
- 聊天窗口：同样为纯 SSE，但用户退出后再回来，历史的流式输出不可见（缺少“断线续传/回放”能力）。

问题本质：SSE 的传输是“只推不存”，一旦连接断开，未被前端缓存的流式片段就丢失；需要一个服务端的“可回放缓冲区”。

## 目标
1. 断线续传：用户离开再回来或网络抖动重连时，从上次进度继续推送。
2. 可回放：新连接可按需回放一段历史流，直至追上实时流。
3. 去重一致：重复连接不重复渲染，跨端/多标签页一致。
4. 取消一致：与现有“基于 UUID 的流取消”和“流管理器”对齐（参见 docs/PLAN-simple-uuid-stream-cancel.md、docs/PLAN-stream-manager.md）。
5. 低侵入：尽量保持 SSE 协议与前端事件处理不变，渐进式接入。
6. 成本可控：可配置留存窗口和 GC 机制，避免 Redis 膨胀。

### 前端用户体验目标（UX 概览）
- 无感断线续传：重连/返回页面自动从断点回放，追上后无缝切换到实时输出
- 完整可回放：新设备/新标签页默认从开头回放（replay=full），直到追上实时
- 幂等去重：按事件 id 渲染，跨标签/多端一致，不重复显示
- 完成/取消一致：命中 done/cancel 控制事件即收尾；重连不越过取消点
- 多智能体清晰：展示“当前 speaking 的 Agent”与各 Agent 完成/错误状态
- 健壮重连：指数退避 + 心跳；404/410/503 友好提示与建议
- 最小改动：沿用现有流解析；在读取循环中落盘 last_id 并在重连请求中自动携带
（详见下文“前端改造要点/职责小结/验收标准”获取实施细节与用例）

## 技术选型
- Redis Streams（推荐）：天然支持顺序、消费位点、按 ID 回放与阻塞读取（XREAD BLOCK），最契合“回放 + 追尾”需求。
- Pub/Sub（可选）：仅用于实时广播，但不可回放，不满足断线续传需求。

结论：采用 “Redis Streams 持久通道 + 原有 SSE 实时通道（由后端统一）” 的双通道思路，但对前端暴露仍是一条 SSE 流。

### KISS 选择与约束（落地偏好）
- 后端栈：采用 Python 路线；你已安装 python-redis（redis-py），无需 Node 路线。
- 默认策略：`SSE_STREAM_TRIM_STRATEGY=MAXLEN`，`SSE_STREAM_TRIM_MAXLEN=20000`，`SSE_XREAD_BLOCK_MS=15000`。
- 单流规则：同一 `task_id+conversation_id` 同一时刻仅 1 个 running 流；新流启动时覆盖“当前流映射”。
- 发现与状态：Redis 仅维护“当前流映射 + 历史索引 + 流状态”三类最小键，足以判断“是否在流/是否可回放”，保持实现简单。


## 核心思路（双通道 + 光标）
- 持久通道：
  - 服务器在将 chunk 写入 SSE 的同时，XADD 到 Redis Stream：`sse:stream:{stream_id}`。
  - 每条记录包含最小必要字段：`type`、`content`、`seq`、`ts`、`meta` 等。
- 光标/位点：
  - 客户端使用 SSE 的 `id:` 机制或查询参数 `last_id` 通报上次消费到的 Redis Stream ID。
  - 服务器先用 `XREAD COUNT N FROM last_id` 回放未消费的历史，再 `XREAD BLOCK` 跟随实时。
- 实时输出：
  - 服务器将回放和实时的每条记录，都以 SSE 事件形式输出，并把 SSE 的 `id:` 设置为 Redis 的 entry-id，浏览器可自动携带 `Last-Event-ID` 断点续传。

## Key 设计
- `sse:stream:{stream_id}`  [Stream]
  - 流式内容的持久队列，单 Producer（服务器），多 Consumer（多个浏览器标签页/设备）。
- `sse:status:{stream_id}`  [Hash]

  - 索引与当前映射（KISS 新增）：
    - `sse:current:{task_id}:{conversation_id}`  [String]
      - 当前正在输出的 `stream_id`；新流启动时 `SET` 覆盖；流结束/取消时 `DEL`（或设置短 TTL，如 10min）
    - `sse:streams:{task_id}:{conversation_id}`  [ZSet]
      - 历史流索引：member=`stream_id`，score=`created_at_ms`；用于“流发现/最近流”查询（保留最近 N 条或整体 TTL）
    - `sse:status:{stream_id}`  [Hash 扩展]
      - 增补字段：`task_id`、`conversation_id`、`active_agent_id`、`last_entry_id`

  - `status`（running|done|cancelled|error）、`created_at`、`closed_at`、`model`、`reason` 等。
- `sse:last_ack:{stream_id}:{client_id}`  [String]
  - 记录某客户端最后消费到的 entry-id（可选，更多用于服务端统计/诊断，不强依赖）。
- 过期与回收：
  - 对 `sse:stream:{stream_id}` 使用 `XTRIM` 策略：`MAXLEN ~ 20000` 或 `MINID ts-30m`。
  - `sse:status:*` 设置 TTL（如 24h），回放完成/完成后延迟清理。

## 事件数据结构（Redis Stream fields）
- `type`: text|tool|control|error|done
- `content`: 具体文本/结构化片段（JSON 字符串）
- `seq`: 递增序号（用于幂等/去重）
- `ts`: 服务器时间戳
- `meta`: 可选（agentId、role、delta/append 等）

示例（字段层面，非严格 JSON Schema）：
- `{"type":"text","content":"你好","seq":12,"ts":...}`
- `{"type":"control","content":"[DONE]","seq":9999}`

## 服务端改造要点
1. 统一写入适配器 StreamWriter
   - 将当前写向 SSE 的路径抽象为 `StreamWriter`，在 `write(chunk)` 时同步 `XADD` 到 `sse:stream:{stream_id}`。
   - 结束时写入 `type=done` 的终止事件，并更新 `sse:status:{stream_id}=done`。

2. SSE 拉流端点增强（向后兼容）

5. 活动 Agent 状态输出（KISS 必选）
   - 当某 Agent 开始输出/切换到该 Agent 时：
     - 更新 `sse:status:{stream_id}.active_agent_id=<agentId>`；
     - 追加控制事件：`type=control, content="AGENT_START", meta.agentId=<id>`；
   - 当该 Agent 完成/错误时：
     - 更新 `sse:status:{stream_id}`（如 `status=done/error`，可附 `finished_at`）；
     - 追加控制事件：`AGENT_DONE/AGENT_ERROR`；
   - SSE 响应需向前端“立即告知当前 streaming agent”：
     - 返回响应头 `X-Active-Agent-Id: <agentId>`（推荐，首屏即用）；或
     - 在首条事件的 `meta.activeAgentId` 提供（备选）。

   - 请求：`GET /api/stream/{stream_id}?last_id=<redis-entry-id>&client_id=<uuid>`
     - 默认：从开头回放（replay=full，即 `last_id=0-0`）；若显式提供 `last_id` 则从该位点回放。
     - 同时支持浏览器自动携带的 `Last-Event-ID`（等同于 `last_id`）；如 `last_id` 已被 XTRIM 剪裁，返回 410 并从“最早可用位点”开始的建议。
   - 回放：`XREAD COUNT <batch> STREAMS sse:stream:{stream_id} <last_id>`，依序输出到 SSE，`id:` 设为该 entry-id。
   - 追尾：`XREAD BLOCK <timeout> STREAMS sse:stream:{stream_id} $` 循环阻塞读取，继续以 SSE 输出。
   - 结束：读取到 `type=done` 或 `status=cancelled/error` 则发送最终事件并 `eventSource.close()`。

3. 取消与状态一致性
   - 取消 API（已存在）执行时：
     - 更新 `sse:status:{stream_id}=cancelled`，并向 Stream 追加 `type=control, content="CANCELLED"`。
     - 生成侧检测状态后及时中止（与 docs/PLAN-stream-manager.md 一致）。

4. 幂等与去重
   - SSE 事件的 `id` 使用 Redis entry-id，浏览器端天然幂等；
   - 同一 entry-id 的事件多次到达时，前端按 `id` 去重，不重复渲染。



### 多智能体编排与前端“当前回复 Agent”状态（Redis 补充）

为满足“上一个 Agent 结束后自动轮到下一个 Agent 输出”与“前端可感知当前正在回复的 Agent”的需求，在保持现有 Streams 回放能力的基础上，新增以下轻量的编排与状态键位。

- 目标
  - 严格顺序：同一会话/流中任一时刻仅一个 Agent 处于 running。
  - 可恢复：重连或服务重启后，能从 Redis 恢复“当前 Agent/队列/已完成”状态。
  - UI 直读：前端既可从 SSE 事件实时感知，也可通过回放/状态端点复原“谁在说”。

- Key 设计（新增）
  - `sse:agents:queue:{stream_id}`  [List]
    - 记录待执行的 agentId 顺序（初始化时按编排推入）。
  - `sse:agent:state:{stream_id}:{agent_id}`  [Hash]
    - `status`（queued|running|done|error|cancelled）、`started_at`、`finished_at`、`tokens_out`、`reason` 等。
  - `sse:active_agent:{stream_id}`  [String]
    - 当前正在输出的 agentId。可配合 `PX` 设租约 TTL，用作“活跃租约”。
  - `sse:active_agent:hb:{stream_id}`  [String]
    - 心跳时间戳（ms）。生成侧定期刷新，便于 Watchdog 判定卡死/掉线。
  - `sse:orchestrator:lock:{stream_id}`  [Lock]
    - 分布式互斥锁（Redlock/SET NX PX），保证“切换到下一个 Agent”的原子性。
  - `sse:status:{stream_id}`  [Hash 扩展]
    - 追加字段：`active_agent_id`、`agent_index`、`agent_total`，便于前端首屏/重连时一次性展示整体进度。

- 事件扩展（仍写入 Redis Stream，并随 SSE 透传）
  - `type=control, content="AGENT_START"`，`meta.agentId=<id>`
  - `type=control, content="AGENT_DONE"`，`meta.agentId=<id>`
  - `type=control, content="AGENT_ERROR"`，`meta.agentId=<id>, meta.error=...`
  - 可选：`type=control, content="AGENT_SWITCH"`，`meta.fromAgentId`、`meta.toAgentId`
  - 说明：前端既可以仅依赖这些控制事件来展示“当前 speaking 的 Agent”，也可以在首次进入页面时从 `sse:status:{...}` 读取 `active_agent_id` 作为首屏状态。

- 编排流程（顺序保障）
  1) 初始化：将将要参与的 Agent 依次 `RPUSH sse:agents:queue:{stream_id}`，并将各自 `status=queued`。
  2) 启动/切换（Orchestrator 进程或后台协程）：
     - 获取 `sse:orchestrator:lock:{stream_id}`；若 `sse:active_agent:{stream_id}` 为空，则 `LPOP` 队列得到下一个 `agentId`；
     - `SET sse:active_agent:{stream_id}=agentId PX=<lease_ms>`，`HSET sse:agent:state:{...} status=running started_at=...`；
     - 追加控制事件：`AGENT_START(meta.agentId)` 到 `sse:stream:{stream_id}`；释放锁。
  3) 生成侧（Worker）：
     - 输出文本/工具事件时给 `meta.agentId` 赋值，定期刷新 `sse:active_agent:hb:{...}=now_ms` 与 `tokens_out`；
     - 正常结束时：写入 `AGENT_DONE`，更新 `status=done finished_at=...`；
       - 触发 Orchestrator 切到下一个（通过监听控制事件或回调）。
     - 失败/中断时：写入 `AGENT_ERROR`，更新 `status=error` 并同样触发切换。
  4) 切换到下一个：
     - Orchestrator 监听 `sse:stream:{stream_id}` 中的 `AGENT_DONE/ERROR/CANCELLED` 控制事件或被生成侧显式唤起；
     - 取得锁后清理/续租 `sse:active_agent:{...}`，若队列尚有成员则按 2) 步骤启动下一个；否则写 `type=done` 并收尾。
  5) 崩溃恢复：Watchdog 周期性检查
     - 若 `sse:active_agent:hb:{...}` 超过阈值未刷新或租约过期，视为卡死；将该 agent 标记 `error` 并触发切换。

- 前端状态读取（UI）
  - 实时：通过 SSE 控制事件 `AGENT_START/AGENT_DONE/AGENT_ERROR` 更新“当前正在回复的 Agent”与“完成徽标”。
  - 首屏/重连：后端可在首条事件的 `meta` 或响应头追加 `activeAgentId/agentIndex/agentTotal`（来自 `sse:status:{...}`），便于 UI 即刻渲染正确状态；随后继续回放与追尾，保持强一致。

- 并发与幂等
  - 串行保障依赖 `sse:orchestrator:lock:{stream_id}` 与“单写多读”模式；
  - 控制事件天然幂等（由 Redis entry-id 去重），重复到达不影响 UI。

- 清理策略
  - 会话完成后：删除 `sse:active_agent:{...}` 与心跳键；`sse:agent:state:{...}` 与 `sse:status:{...}` 设置 TTL（如 24h）；队列键清理。

- 伪代码（片段，仅示意）

```python
# 启动下一个 Agent（持锁）
with redlock(f"sse:orchestrator:lock:{stream_id}"):
    if not redis.get(f"sse:active_agent:{stream_id}"):
        agent_id = redis.lpop(f"sse:agents:queue:{stream_id}")
        if agent_id:
            redis.set(f"sse:active_agent:{stream_id}", agent_id, px=30000)
            redis.hset(f"sse:agent:state:{stream_id}:{agent_id}", mapping={"status":"running","started_at":now_ms})
            xadd_control(stream_id, "AGENT_START", meta={"agentId": agent_id})
        else:
            xadd_control(stream_id, "DONE")
```

## 资源与 GC 策略
- 推荐：时间基（30 分钟）或数量基（2 万条）二选一或组合，使用 `XTRIM MINID` 更稳定；
- 对于长对话/长任务，建议分段流（每轮/每 agent 一条子流），降低单 Stream 体积；
- 后台定时任务清理 `status/ack` 等散列 Key。

## 安全与多租户
- Key 前缀增加 tenant 隔离：`{tenant}:sse:stream:{stream_id}`；
- SSE 端点校验用户是否具备读取该 `stream_id` 的权限；
- 限流：每用户/会话的并发 SSE 连接数限制。


### 跨设备/跨用户访问与权限
- 可见性规则：是否可见取决于“用户对所属资源（task_id/conversation_id）的访问权限”，而非浏览器本地缓存。只要具备读取该任务/会话的权限，即可在任意设备/浏览器重放与追尾同一 stream。
- 发现能力：新增“流发现”接口（见下文 routes 计划），允许客户端在没有本地 `streamId` 的情况下，按 task_id+conversation_id 列出最近的流（含状态 running/done、时间戳），选择其一进行回放。
- 位点缺失时的行为：
  - 本版本强制使用 `replay=full` 从开头（`0-0`）回放，以保证“当前 streaming agent”状态与未离开页面一致；后续如需优化再引入快照/增量方案。
  - 若历史已被 XTRIM 剪裁，提示用户并允许从“最早可用位点”开始回放。
- 权限控制：
  - SSE 回放端点与“流发现”端点均基于后端现有 RBAC/资源校验：必须验证调用者对 task_id/conversation_id 的读取权限；即使知道 `streamId`，无权限也不可访问。
  - 多租户环境下继续使用 `{tenant}:` 前缀隔离；审计日志记录跨设备/跨用户回放行为。
- 更高权限用户：如具备访问该任务/会话的更高权限，也可通过“流发现”+回放端点查看对应流（受保留窗口与 GC 影响）。

- 管理员快速附着：行动任务详情页默认自动附着到“当前 running 的流”（若存在），并提供“流发现”下拉以切换其他流；若不存在 running，则提示“最近一次 done”并允许回放。

## 监控与可观测
- 指标：`stream_bytes_written`、`stream_replay_count`、`avg_replay_lag_ms`、`cancelled_streams`；
- 日志：首次连接/重连、回放耗时、GC 剪裁量、取消触发来源（前端/后端）。

## 与其他实现的对比
- Redis List + BRPOP：不支持从中间位点回放；
- 仅内存队列：断开即丢；
- WebSocket：可做，但需要更复杂的断点和会话管理；SSE + Redis Streams 已能满足当前需求且改造最小。


## 实施计划（可执行清单，KISS）

说明：本节为新版、可执行的实施清单，优先于下文旧版“里程碑/精简版”描述。

阶段总览
- P0 基础与健康检查（~0.5 天）
- P1 双写与状态（~1 天）
- P2 回放/追尾与发现端点（~1 天）
- P3 取消一致性与收尾（~0.5 天）
- P4 监控/GC（可后置）

P0 基础与健康检查
- 配置与依赖
  - 环境变量：REDIS_URL、SSE_STREAM_TRIM_STRATEGY(默认 MAXLEN)、SSE_STREAM_TRIM_MAXLEN(默认 20000)、SSE_XREAD_BLOCK_MS(默认 15000)
  - 依赖：redis-py 已安装（python-redis）
- 文件与实现
  - backend/app/services/infra/redis_client.py：
    - get_redis(): 惰性单例
    - assert_ready(): 启动或首次使用 PING；失败时相关端点返回 503（不做降级）
- 验收
  - Redis 不可用 → /stream 与发现端点返回 503

- 单元测试脚本（本阶段）
  - tests/backend/test_redis_client.py：
    - test_assert_ready_ok：mock Redis PING 成功，端点不返回 503
    - test_assert_ready_fail：模拟连接异常，端点返回 503
  - tests/backend/test_config_defaults.py（可选）：
    - test_env_defaults：缺省环境变量时采用默认值


P1 双写与状态（含“当前 streaming agent”）
- Redis Keys（KISS）
  - sse:stream:{stream_id} [Stream]：事件
  - sse:status:{stream_id} [Hash]：status、created_at、closed_at、active_agent_id、task_id、conversation_id、last_entry_id
  - sse:current:{task_id}:{conversation_id} [String]：当前 running 的 stream_id（running 时 SET；done/cancel 时 DEL 或短 TTL）
  - sse:streams:{task_id}:{conversation_id} [ZSet]：历史流索引（member=stream_id，score=created_at_ms）
- 后端改造
  - backend/app/services/conversation/redis_stream.py：
    - stream_key(...)、class RedisStreamAppender.append/mark_done/mark_control、XTRIM（默认 MAXLEN ~ 20000）
  - backend/app/services/conversation/stream_handler.py：
    - 每次向前端写 SSE 前先 XADD，得到 entry-id，并把 SSE 事件 id 设为该 entry-id

- 单元测试脚本（本阶段）
  - tests/backend/test_redis_stream_appender.py：
    - test_append_sets_sse_id_equals_entry_id：XADD 返回的 entry-id 用作 SSE 事件 id
    - test_mark_control_agent_start_updates_active_agent：AGENT_START 更新 active_agent_id
    - test_mark_done_updates_status_and_clears_current：DONE 更新 status 并清理 sse:current
    - test_xtrim_enforced_maxlen：达到上限后触发 XTRIM
  - tests/backend/test_stream_handler_headers.py：
    - test_response_headers_include_stream_and_active_agent：连接建立返回 X-Stream-Id 与 X-Active-Agent-Id

    - 在代理切换/开始时：写控制事件 AGENT_START(meta.agentId)，更新 sse:status.active_agent_id
    - 在取消/错误/完成时：写 CANCELLED/ERROR/DONE 控制或终止事件，更新 status，并清理 sse:current
    - 维护索引：新流启动 SET sse:current、ZADD sse:streams；完成/取消时 DEL sse:current
    - 响应头：在连接建立时返回 X-Stream-Id、X-Active-Agent-Id（若有）
- 验收
  - SSE 事件携带 id=redis entry-id；响应头包含 X-Stream-Id、X-Active-Agent-Id
  - active_agent_id 能随切换正确更新；索引键更新正确

P2 回放/追尾与发现端点（默认 replay=full）

- 只读回放生成器
  - backend/app/services/conversation/sse_replay.py：sse_replay_and_tail(...)
    - last_id 默认为 0-0（replay=full）→ XREAD 批量回放 → XREAD BLOCK 追尾
    - 读到 done/cancel/error 控制事件即收尾；周期心跳注释行 : ping
    - 连接建立时设置响应头 X-Stream-Id 与 X-Active-Agent-Id
- 路由与协议
  - GET /api/action-tasks/{taskId}/conversations/{conversationId}/stream
    - 参数：last_id（可选）、replay=full|latest（默认 full）
    - 410 Gone：last_id 被剪裁；建议从最早可用位点重试
  - GET /api/action-tasks/{taskId}/conversations/{conversationId}/stream/current
    - 返回：{ streamId, status, createdAt, closedAt, activeAgentId, lastEntryId }
  - GET /api/action-tasks/{taskId}/conversations/{conversationId}/streams?limit=10
    - 返回：最近 N 条历史流（来自 ZSET 索引）
- 前端约定（最小改造）
  - 重连默认使用 replay=full，从 0-0 回放后追尾；首屏用 X-Active-Agent-Id 设置“当前 agent”
- 验收

- 前端改造清单（ActionTaskDetail 页面）
  - 页面挂载：
    - 调用 GET /stream/current 获取 { streamId, activeAgentId, ... }，立刻设置“当前 agent”
    - 打开 EventSource 到 /stream?replay=full（等价 last_id=0-0），开始回放→追尾
  - 事件处理：
    - 使用 event.lastEventId 去重；可选将 lastEventId 持久到 sessionStorage（key=taskId+conversationId）
    - 识别控制事件：AGENT_START/AGENT_DONE/DONE/CANCELLED → 更新当前 agent/完成状态/终止
  - 首屏/头信息：
    - 若响应头含 X-Active-Agent-Id，用其作为首屏“当前 agent”
  - 断开/卸载：
    - 卸载时关闭 EventSource；异常断开采用指数退避重连（设最大重试次数与提示）
  - 多标签一致（可选）：
    - 默认按 lastEventId 去重足够；如需跨标签同步，可用 BroadcastChannel 共享“当前 agent”与 last_id

  - 断线回来后 UI 立即展示正确的“当前 streaming agent”，随后历史补齐无闪烁

- 单元测试脚本（本阶段）
  - tests/backend/test_sse_replay.py：
    - test_full_replay_then_tail_emits_in_order：从 0-0 回放后追尾，事件顺序与 id 正确
    - test_last_id_trimmed_returns_410：last_id 被剪裁时返回 410
    - test_headers_on_connect_include_active_agent：连接返回 X-Active-Agent-Id
  - tests/backend/test_stream_discovery_endpoints.py：
    - test_get_current_returns_status_and_active_agent：/stream/current 返回正确信息
    - test_list_streams_returns_recent：/streams 返回最近 N 条





P3 取消一致性与收尾
- 取消 API 触发时：
  - 追加 `type=control, content="CANCELLED"` 到 sse:stream
  - 更新 sse:status.status=cancelled；DEL sse:current
- 回放端：命中 CANCELLED/DONE/ERROR 即终止
- 验收：取消后无新事件；新连接仅回放至取消点并收尾


- 单元测试脚本（本阶段）
  - tests/backend/test_cancel_consistency.py：
    - test_cancel_appends_control_and_stops_tail：CANCELLED 控制事件导致回放端收尾
    - test_new_connection_replays_until_cancel_then_ends：新连接回放至取消点并终止

P4 监控/GC（可后置）

- 单元测试脚本（本阶段）
  - tests/backend/test_monitoring_gc.py：
    - test_metrics_counters_increment：基础指标计数增长
    - test_trim_strategy_switch_to_minid：切换到 MINID 策略时生效
    - test_ttl_cleanup_of_status_and_index：状态与索引 TTL 清理

- 指标：stream_bytes_written、stream_replay_count、avg_replay_lag_ms、cancelled_streams


- XTRIM 策略支持切换 MINID ts-30m；必要时分段流；定时清理散列/索引 TTL

## 集成/契约测试计划（全局）
- 单测：tests/backend/test_sse_replay.py
  - 写入两条 → 回放 → 追尾写一条 → DONE → 断言顺序、id、一致性
- 集成/契约用例：
  - 用例1：开始流→断网/关标签 10s→恢复，默认从 0-0 回放并追尾
  - 用例2：多标签页同时订阅，同一 entry-id 不重复渲染
  - 用例3：取消后回放命中 CANCELLED 并收尾；无新事件
  - 用例4：Redis 故障返回 503；恢复后回放恢复
  - 用例5：用户离开期间 agent 切换，返回页面即刻显示正确 activeAgentId，随后历史补齐


## 关键伪代码片段（仅演示，细节以实际代码为准）

后端写入与回放（Python 风格示意）：

```python
# 写入（发送到 SSE 的同时 XADD）
redis_id = redis.xadd(f"sse:stream:{stream_id}", {
  'type': evt.type, 'content': evt.content, 'seq': seq, 'ts': now_ms
})
# SSE 事件头部写入 id，支持浏览器 Last-Event-ID
sse.write(event_id=redis_id, event=evt.type, data=evt.content)
```

```python
# 回放 + 追尾
last_id = req.headers.get('Last-Event-ID') or req.query.get('last_id', '0-0')
# 回放历史
for entry_id, fields in xread(stream_key, last_id, count=1000):
    sse.write(event_id=entry_id, event=fields['type'], data=fields['content'])
# 追尾阻塞读取
while running:
    entries = xread_block(stream_key, '$', block=15000)
    ...
```

## 风险与缓解
- Redis 内存膨胀：严格的 `XTRIM` 与 TTL；按会话/轮次分流；
- 超长输出：分段落、分 agent 子流，或定期“快照化”（合并片段，减少历史回放量）；
- 前端多端并发：以 `id` 去重；必要时对 `client_id` 做限流；
## 附录：本地接入与修改详细方案（Redis 6379/无认证）

为与你当前本地环境对齐（Redis 已在 6379 端口、无认证），采用“最小可行改造 + 渐进增强”的方式落地：

### 一、环境与配置（必选依赖，KISS：无降级）
- 新增环境变量（示例值）：
  - `REDIS_URL=redis://127.0.0.1:6379/0`

  - `SSE_STREAM_TRIM_STRATEGY=MAXLEN`（或 `MINID`）
  - `SSE_STREAM_TRIM_MAXLEN=20000`（当策略为 MAXLEN 时生效）
  - `SSE_STREAM_TRIM_MINUTES=30`（当策略为 MINID 时生效）
  - `SSE_XREAD_BLOCK_MS=15000`


### 二、分阶段实施
- Phase 0：基础连接验证（0.5 天）
  1) 后端启动或首次使用前执行 PING 健康检查；
  2) 若 Redis 不可用，则相关 SSE/回放端点返回 503（不做降级）。

- Phase 1：写入路径接入 Redis Streams（1 天）
  1) 在现有 SSE 输出路径外侧抽象 `StreamWriter`/`RedisStreamAppender`：
     - 每写出一个 SSE 事件，同时 `XADD sse:stream:{stream_id}`；
     - 事件字段至少包含：`type`、`content`、`ts`（可选 `seq`）。
  2) 结束时写入 `type=done` 事件；取消时写入 `type=control, content="CANCELLED"`（见 Phase 3）。
  3) 按配置执行 `XTRIM`，先用 `MAXLEN ~ 20000` 简单策略。

- Phase 2：SSE 端点支持“回放 + 追尾”（1 天）
  1) 端点形态保持不变，新增支持：
     - 读取请求头 `Last-Event-ID` 或查询参数 `last_id`；
     - 若存在则先 `XREAD COUNT N FROM last_id` 回放，再 `XREAD BLOCK` 追尾；
     - SSE 事件的 `id:` 设置为 Redis entry-id（浏览器自动断点续传）。
  2) Redis 不可用时，端点返回 503 Service Unavailable（不做降级）。

- Phase 3：取消与状态一致性（0.5 天）
  1) 取消 API 被调用时：
     - 立即向 `sse:stream:{stream_id}` 追加 `type=control, content="CANCELLED"`；
     - 可选：`HSET sse:status:{stream_id} status=cancelled`。
  2) 生成侧收到取消信号后中止底层 LLM（与现有取消机制保持一致，不在此重复实现）。

- Phase 4：监控与 GC 优化（0.5 天，可并行/后置）
  1) 暴露基础指标：回放命中次数、平均回放时延、取消次数、剪裁量等；
  2) 需要更稳健时，切到 `XTRIM MINID ts-30m`；长会话可“分段流”。

- Phase 5：前端最小改动（可选，0.5 天）
  1) 保持 EventSource 逻辑不变，默认利用浏览器 `Last-Event-ID`；
  2) 可选：在 `onmessage` 中同步 `event.lastEventId` 到 `sessionStorage`，跨路由/刷新仍能携带位点；
  3) 对 `id` 去重（通常浏览器端已天然幂等，若有本地缓存/多端合并再做显式去重）。

### 三、依赖与安装（Python，KISS）
- 依赖：`redis>=5`（redis-py，已安装）。
- 本方案不再新增运行时依赖；如需，仅通过项目包管理器补充开发依赖（测试/类型）。

### 四、关键接口与改造点（不绑定具体文件名，按职责划分）
- 流写入适配器（新增）：
  - 责任：把“写 SSE”拓展为“双写 SSE + XADD”。
  - 输入：`stream_id`、事件对象（type/content/ts...）。
  - 输出：返回 Redis entry-id（用于设置 SSE `id:`）。
- SSE 拉流端点（增强）：
  - 读取 `Last-Event-ID/last_id`；回放（XREAD FROM last_id）+ 追尾（XREAD BLOCK）。
  - 结束/取消控制事件透传到前端，及时收尾。
- 取消 API（沿用）：

  - 保持现有取消逻辑；额外向 Redis Streams 追加 `CANCELLED` 控制事件。

### 五、验收标准（针对你本地 6379 环境）
- 断开再连：关闭标签页或断网 10s 后恢复，回到原会话能从断点继续；
- 多标签一致：同时打开 2 个标签页，历史和实时片段均不重复渲染；
- 取消一致：点击“停止”，新连接不再回放之后的片段，并能看到取消控制事件；

- 资源可控：`XTRIM` 生效，Stream 长度保持在合理上限内。
- 重连后 agent 变更准确：用户离开期间若已切换到新 Agent，重新进入对话后，前端应能立即显示“当前 streaming agent”（来源于响应头 X-Active-Agent-Id 或 /stream/current），随后回放补全历史，无闪烁/错乱。




