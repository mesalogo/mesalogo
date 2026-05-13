# docs/agents — 给 AI Agent 看的工作手册

这里的文档**不是给人看的设计方案**(那些在 `docs/feature-*/`),
而是**给 AI 编码代理(Claude / Codex / Droid / Cursor)在写代码时按需检索的"操作手册"**。

这是 Harness Engineering(驾驭工程)的"**按需检索上下文**"层。

## 为什么不把它们都写进 AGENTS.md?

因为上下文是稀缺资源。1000 页说明书会把任务、代码、文档挤出上下文窗口。
正确做法是:
- **AGENTS.md 小而稳定**(仓库根 + 每个子目录各一份)
- **docs/agents/ 深而分散**(专题手册,用到才读)

---

## 目录

### 操作手册(how-to)

| 文件 | 何时读 |
|---|---|
| `mcp-tool-writing.md` | 新增 / 修改 MCP 工具时 |
| `subagent-patterns.md` | 用 `invoke_agent` / `invoke_agents`,或写被它们调用的工具时 |
| `parallel-execution.md` | 触碰 `asyncio.gather`、SSE 流、并行任务时 |
| `database-changes.md` | 改 `app/models.py` 或写 Alembic 迁移时 |
| `supervisor-rules.md` | 改 `supervisor_*.py`、`rule_sandbox.py` 时 |
| `sse-streaming.md` | 写/改 SSE 路由时 |

> 列表中的文件可能尚未创建。**尚未创建 = 历史上没翻过足够严重的车**。
> 如果你正要做其中一类工作且文件不存在,先创建一个占位,把你做决策的思路沉淀下来,这就是活文档。

### 翻车档案(failures/)

每一个文件对应一次真实发生过的 Agent / 人类翻车。
目的不是追责,是**让下一个 Agent 读到之后不重犯**。

写作模板见 `failures/_TEMPLATE.md`。

---

## 工作流

```
发生一次 Agent 翻车
      │
      ▼
  写 failures/YYYY-MM-<slug>.md   ← 详细复盘
      │
      ▼
  抽取 1-2 行最关键的教训
      │
      ▼
  回写到 AGENTS.md 或对应 how-to  ← 保持顶层文件短小
```

这就是 Mitchell Hashimoto 说的"每一行 AGENTS.md 都是活的反馈循环"。
