# [YYYY-MM] 简短描述(不超过 8 个字)

> 文件名格式:`YYYY-MM-短slug.md`,例:`2025-11-task-no-stop.md`

## 发生了什么

一两句话。用户视角:看到了什么错误、什么现象?

## 根因

技术视角:为什么会这样?落到具体模块 / 文件 / 行号。

## 为什么 Agent / 我们没早发现

这一段最重要,是 Harness 要填的洞。典型答案:
- [ ] AGENTS.md / 对应 how-to 没写过这个约束
- [ ] 没有对应的 Linter / CI 检查
- [ ] 测试覆盖不到这个路径
- [ ] Supervisor 规则允许了这个操作
- [ ] 错误信息不 Agent-friendly,读不懂
- [ ] 上下文里没有相关文档,Agent 看不到历史

## 怎么改掉(已做)

- 代码修复:xxx PR / commit
- 文档修复(关键!):在 `AGENTS.md` / `docs/agents/xxx.md` 加了什么规则

## 怎么防止再犯(长期)

- [ ] 加一条 Linter 规则:`...`
- [ ] 加一个测试:`tests/...`
- [ ] 加一条 Supervisor 规则:`...`
- [ ] AGENTS.md 第 X 节加了一行:`...`

## 延伸阅读

- 对应 TODO.md 条目
- 相关 feature PLAN
- 外部参考(Harness / Anthropic / OpenAI 原文)
