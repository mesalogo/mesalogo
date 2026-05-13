# [2025-XX] 并行智能体输出在同一 SSE 流里交错混乱

> 来源:`TODO.md` > "7. 真正的并行智能体执行" 段中对现状的描述
> 状态:🟡 已识别 / 未修复(属设计级限制,而非 bug)

## 发生了什么

`parallel` 执行模式用 `asyncio.gather(*[agent.run() for agent in agents])`,
所有 Agent 的 token 写入**同一个** result_queue,经由**同一条** SSE 流到前端。

结果:
- 前端看到的是"A 吐一段 → B 吐一段 → A 又吐一段",按时间穿插
- 无法区分哪段属于哪个 Agent,UI 只能塞进一个消息气泡
- Agent A 的工具调用参数可能被 Agent B 的 token 打断,JSON 解析失败
- 上下文隔离失效:summary 把全部 token 喂给下一轮,Agent A 看到了 B 的思考过程

## 根因

这**不是 Bug,是设计缺失**。当初为了"并行"简单实现,复用了 serial 模式的输出通路。
Harness Engineering 语境里,这违反了:

> **独立 Agent 必须有独立上下文**。共享上下文 = 共享思考 = 不是真正的并行。

## 为什么 Agent / 我们没早发现

- [x] "并行 = asyncio.gather" 是一个自然的 mental model,但只解决了 CPU/IO 层的并行,没解决"观测层"的并行
- [x] 单 Agent 测试全部通过,没有多 Agent 并行的 E2E 测试
- [x] 前端是单消息视图,视觉上能渲染出东西 → 容易被误认为"功能正常"

## 正确架构(待实施,TODO #7)

```
Orchestrator (主流程)
   ├── 为每个 Agent 分配独立 asyncio.Queue
   ├── 为每个 Agent 分配独立 SSE 子通道(conversation_id + agent_id 作 key)
   ├── asyncio.gather(*[worker(agent, queue[agent.id]) for agent in agents])
   └── 汇总阶段:把每个 queue 的 final summary 合并写入主 conversation

Frontend
   ├── 主 SSE 监听 orchestrator 元数据事件(start/agent_done/all_done)
   ├── 每个 agent_id 开一个子 EventSource (或用 event type 区分)
   └── UI:多列 / 标签页 / 并排气泡
```

## 怎么防止再犯

- [ ] 在 `docs/agents/parallel-execution.md` 明确写:"永远不要让两个 Agent 共享 result_queue"
- [ ] `backend-fastapi/AGENTS.md` 第 3.2 节可加一条:"touching parallel_experiment_service.py 前读 failures/2025-XX-parallel-sse-interleave.md"
- [ ] 加一个 Linter:若发现 `asyncio.gather` 后的结果被写入同一个 SSE queue 报警

## 延伸阅读

- `TODO.md` > "7. 真正的并行智能体执行"(含方案代码)
- OpenAI 2026-02 百万行报告中的 Orchestrator/Worker 模式
- Anthropic "long-running agents" "parallel execution" 章节
