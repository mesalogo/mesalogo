# [2025-11] 普通自主任务没能停止

> 来源:`TODO.md` > `## BUG` > "普通自主任务没能停止"
> 状态:🔴 Open(本文为骨架,待具体修复时补全根因)

## 发生了什么

用户在前端点击"停止"后,自主任务仍然继续产出消息 / 调用工具 / 写 DB。
从日志看,scheduler 层收到了停止指令,但 executor 层的 asyncio.Task 未被取消。

## 疑似根因(待确认)

`backend-fastapi/app/services/scheduler/executor.py`(4.8 万行)中:

1. 任务由多个组件协作:scheduler 调度 → executor 运行 → conversation SSE 输出 → Redis 队列缓存。
2. 停止信号如果只向**其中一个**组件发送,其他组件继续跑:
   - kill scheduler → executor 的那个协程还在 yield
   - kill SSE → Redis 队列里已投递的消息还在被消费
   - 清 Redis → conversation_service 已经把 LLM 请求发出去了,LLM 仍然流式返回
3. 没有一个"统一的 cancellation token"在所有层都能读到。

## 为什么 Agent / 我们没早发现

- [x] 没有端到端的"按停止按钮应立即收敛"测试
- [x] 错误现象是"任务还在跑",不是报错,log 里看不出来
- [x] AGENTS.md / subagent / scheduler 手册中没有强调"停止信号必须多层传播"

## 怎么改掉(待做)

建议方案(Harness 原则:思考与执行分离):

```python
# 每个任务有一个全局 CancelToken,写入 Redis
# scheduler / executor / conversation / subagent 在关键 await 点都要 check
if await cancel_token.is_cancelled():
    raise asyncio.CancelledError("user stopped")
```

对应:
- `app/services/scheduler/executor.py` 的主循环检查 token
- `app/services/subagent/executor.py` 每轮 LLM 调用前检查
- `app/services/conversation/` SSE 生成器 `finally` 里清缓存

## 怎么防止再犯

- [ ] 加端到端测试:`tests/e2e/test_task_cancellation.py`,发起任务 → 2 秒后停止 → 断言所有副作用停止(SSE 关闭、Redis 队列空、DB 无新写入)
- [ ] `docs/agents/subagent-patterns.md` 加一节"取消语义"
- [ ] `backend-fastapi/AGENTS.md` 第 3 节加一条:"所有长循环必须检查 CancelToken"

## 延伸阅读

- Anthropic "long-running agents" 文章里的取消/恢复模式
- `TODO.md` > BUG 段
