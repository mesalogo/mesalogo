# AGENTS.md — abm-llm-v2 驾驭工程入口

> 本文件是 **AI 编码代理(Claude / Codex / Droid / Cursor …)进入本仓库时看到的第一份指南**。
> 它不是给人读的 README,是给 Agent 读的"入职手册"。
>
> 原则(参考 Mitchell Hashimoto / OpenAI Harness Engineering 实践):
> 1. **保持小而稳定**。过长的指令会挤掉任务空间,陈旧规则比无规则更有害。
> 2. **每一条规则都对应一次历史翻车**。见 `docs/agents/failures/`。
> 3. **按需检索,不要 one-shot**。遇到专门场景,先读对应 `docs/agents/*.md` 再动手。
> 4. **遇到错误,先回读本文件和对应 failure note,再尝试修复**。

---

## 1. 这是什么项目(一句话)

**abm-llm-v2** 是一个多智能体 LLM 仿真平台(Agent-Based Modeling + LLM),核心能力:
- 多 Agent 协作 / 并行执行 / 编排(Workflow Graph)
- MCP 工具生态 + SubAgent 嵌套调用
- 知识库(LightRAG / Milvus / BM25)+ 记忆分区
- 与 ABM 框架(NetLogo / Mesa)双向通信

> 你不是在写一个"聊天机器人",你是在改一个**能跑仿真实验、让 Agent 相互调用、产生可观测副作用的系统**。任何动作都可能影响正在运行的实验、任务、智能体。**默认保守。**

### 1.1 分支模型(必读)

本仓库有两个对外远端,**含义完全不同,提交前必须看清你在哪个分支**:

| 本地分支 | 对应远端 | 公开性 | 用途 |
|---|---|---|---|
| `public` | `mesalogo` → `git@github.com:mesalogo/mesalogo.git` (远端分支名 `main`) | ⭐ **公开开源版本** | GitHub 上的 MesaLogo 开源发布分支 |
| 其他分支(如 `0.14`, `250504-agentcolor` 等) | `origin` → 内部 git 服务器(详见 `git remote -v`) | 🔒 内部私有 | 内部开发 / 实验性 / 客户专供 |

**红线**:
- `public` 分支 = **github.com/mesalogo/mesalogo 的开源版本**。任何 push 到 `public` 的内容都会公开。
- ❌ **禁止把内部代码、密钥、内部部署配置、客户专属代码合并进 `public`**。
- ❌ **禁止在不确认分支的情况下做 `git push`**。push 前先 `git status -b` 看清当前分支与 upstream。
- 提交到 `public` 前,默认让用户 review `git diff` 与 `git status`(参见 §7"不自动 push")。

---

## 2. 仓库地形图(只列你 90% 时间会碰的)

```
abm-llm-v2/
├── backend-fastapi/          ← ⭐ 主后端(FastAPI + SQLAlchemy + Redis)
│   ├── main.py               启动入口
│   ├── app/services/         ⭐ 业务核心,改动前先读 backend-fastapi/AGENTS.md
│   │   ├── subagent/         SubAgent 执行引擎(已有)
│   │   ├── scheduler/        自主任务调度(已有)
│   │   ├── conversation/     对话服务
│   │   ├── supervisor_*.py   监督者/规则/沙箱(= Harness 约束层,谨慎改!)
│   │   ├── mcp_server_manager.py   MCP 工具注册(7.3 万行,小心)
│   │   └── parallel_experiment_service.py  并行实验(7.5 万行,小心)
│   └── app/models.py         ⚠️ 9 万行,加字段前先读 migration-progress.md
│
├── frontend/                 React 19 + Ant Design 6 + @xyflow/react
│   └── src/                  改前读 frontend/AGENTS.md(若存在)
│
├── abm-docker/               docker-compose 多服务编排(redis/milvus/neo4j…)
├── backend-deprecated/       ❌ 旧 Flask 代码,不要读、不要改、不要参考
├── third_party/              ❌ 第三方 submodule,不要改
├── docs/                     设计文档(按需读)
│   ├── feature-*/PLAN.md     各功能方案
│   └── agents/               ⭐ 给 Agent 看的工作手册(按需检索)
│       ├── mcp-tool-writing.md
│       ├── subagent-patterns.md
│       ├── parallel-execution.md
│       ├── database-changes.md
│       └── failures/         历史翻车案例(改代码前扫一眼标题)
└── TODO.md                   当前产品 roadmap(改前读相关条目)
```

---

## 3. 硬约束(违反即必须停下问用户)

这些不是建议,是**红线**。任何 Agent 动作之前先自检。

### 3.1 目录红线
- ❌ **不要修改 `backend-deprecated/`**。该目录是旧 Flask 代码,已废弃,仅留历史参考。
- ❌ **不要修改 `third_party/`** 下任何内容。它们是 git submodule。
- ❌ **不要在 `backend-fastapi/knowledgebase/`、`logs/`、`.pnpm-store/` 下提交文件**。
- ❌ **不要修改 `.factory/artifacts/`**(这是工具系统目录)。
- ❌ **不要把内部资料推送到 `public` 分支 / `mesalogo` 远端**(= GitHub 开源版本,见 §1.1)。任何涉及内部 IP、密钥、私有部署、客户定制的内容必须留在 `origin` 的内部分支上。
- ❌ **推送到 `public` / `mesalogo` 前必须跑 secret-scan**。最低门槛是 `git diff origin/main...HEAD | grep -iE "(api[_-]?key|secret|token|password|client_secret|sk-[a-z0-9])"`,推荐安装 `gitleaks` 做 pre-push 钩子。**已经出过事**:见 `docs/agents/failures/2026-05-13-public-branch-secret-leak.md`。

### 3.2 代码红线
- ❌ **禁止 `print()`**。统一用 `logger`(参考 TODO.md"已完成 > print → logger 迁移")。
- ❌ **禁止在 async 路径上做阻塞 IO**(requests.get / time.sleep / 大文件同步读写)。
  项目正在向 5000 并发演进,一个阻塞调用会拖垮整个 event loop。用 `httpx.AsyncClient` / `asyncio.to_thread`。
- ❌ **禁止直接读写 `models.py` 里的表字段做迁移**。写 Alembic 迁移文件,放进 `backend-fastapi/migrations/`。
- ❌ **禁止修改 `supervisor_*.py` 和 `rule_sandbox.py` 的放行语义**(= Harness 约束层,改错一条会让某个实验允许做非法操作)。必须动时先读 `docs/agents/supervisor-rules.md`(若不存在,先创建并写明背景)。

### 3.3 Agent 行为红线(针对你自己)
- ❌ **不要 one-shot**。遇到"顺手改一下别的"的冲动时,停下来,把该项写入 TODO 或 failure note。
- ❌ **不要过早宣布胜利**。跑通单元测试 ≠ 功能完成;curl 通了 ≠ 前端可用。参考 `docs/agents/failures/2025-*-premature-victory.md`(如存在)。
- ❌ **不要假定"测试通过就安全"**。测试是自己写的,测试写错了它当然通过。修 Bug 时先写一个能复现 Bug 的测试并确认它**失败**,再修。
- ❌ **不要复制 `backend-deprecated/` 里的模式**。它是 Flask/sync,本项目是 FastAPI/async。

---

## 4. 开工前必做的"上游检索"

在动手写/改任何代码前,按需读对应文档(都是 `docs/agents/` 下的):

| 你要做的事 | 必读文档 |
|---|---|
| 新增 MCP 工具 | `docs/agents/mcp-tool-writing.md` |
| 改 SubAgent / invoke_agent* | `docs/agents/subagent-patterns.md` + `docs/feature-subagent/PLAN.md` |
| 改并行任务 / asyncio.gather | `docs/agents/parallel-execution.md` + `TODO.md#真正的并行智能体执行` |
| 加表字段 / 改 schema | `docs/agents/database-changes.md` + `backend-fastapi/migration-progress.md` |
| 改 Supervisor / 规则沙箱 | `docs/agents/supervisor-rules.md` |
| 改 LightRAG / 向量库 | `docs/feature-knowledge-base/lightrag-PLAN.md` |
| 改编排 / Workflow Graph | `docs/feature-workflow-graph/PLAN.md` |
| 部署 / Docker / 性能 | `abm-docker/README.md` + `docs/feature-parallellab/PLAN-5000-concurrency.md` |

找不到对应文档 → **创建它**(即使只写一句"占位"),然后把本次的决策写进去。这是 Harness 的"活文档"原则。

---

## 5. 典型失败模式速查(一分钟回顾)

这几个模式**在本仓库的 TODO.md 里已经真实发生过**,不要重犯:

1. **自主任务停不下来**(见 `TODO.md#BUG`):停止信号需要同时清理 Redis 队列 + scheduler.triggers + SSE 流。单独 kill 任一会留僵尸任务。
2. **Error 400 后无法中止**(同上):HTTP 错误必须把异常**反向传播到 SSE `done` 事件**,前端才能退出 spinner。只 log 不 emit = 用户界面卡死。
3. **并行 Agent 输出交错**:当前 `asyncio.gather` 共享同一个 SSE 流,多 Agent 输出会乱序。若需新功能必须并行,用独立 queue(见 TODO #7)。
4. **上下文爆炸**:summary 服务必须去掉 tool_call 参数再进下一轮(见 TODO.md"已完成 > 总结上下文消息优化")。新功能不要重新引入原始 tool_call。
5. **跨行动空间调用未声明**:SubAgent 跨 space 必须 `cross_space=True` 显式声明,否则被 supervisor 拦截。错误信息看起来是"工具不可用",真实原因在这里。
6. **public 分支首次 push 即泄密**(`docs/agents/failures/2026-05-13-public-branch-secret-leak.md`):没有 secret-scan 就 `git push mesalogo public:main`,把 `backend-deprecated/config.conf` 的 OAuth secret、MySQL 凭证、`docker-compose.galapagos.yml` 里的 `PLAY_HTTP_SECRET_KEY` 等真实凭证发到了 GitHub。后续轮换密钥是不可替代的兜底。

每新增一个翻车 → 写一篇 `docs/agents/failures/YYYY-MM-短描述.md`,然后回这里的列表里加一行。

---

## 6. 运行与验证(最小骨架)

```bash
# 后端(开发)
cd backend-fastapi
uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# 后端(生产)
./backend-fastapi/start_prod.sh   # gunicorn + uvicorn workers

# 前端
cd frontend && pnpm dev

# Docker 全栈
cd abm-docker && make up
```

**改完代码必须做到**(否则不要宣布完成):
1. `python3 -c "import main"` 能 import(没有语法 / 导入错误)。
2. 相关路由 `curl http://localhost:8080/<endpoint>` 返回预期 JSON(不是 200 空响应)。
3. 前端相关页面能真实点进去、看到数据流动(不是"页面不崩溃"就行)。
4. 相关已有测试 `pytest backend-fastapi/tests/...` 通过;若改了有业务逻辑的代码还没测试,**先补一个能复现原问题的测试**。
5. 改了 models.py → 生成 Alembic 迁移并本地跑通 upgrade/downgrade。

---

## 7. 输出风格约定

- **语言**:注释 / commit message / 文档用中文(项目主语言)。代码标识符、log 消息用英文。
- **Commit 格式**:参考最近 5 条 `git log --oneline`(例:`fix: 新增 GET /agents/{id}/memories 端点解决前端 404 错误`)。
- **不在 commit 里加广告**:不要加 "Co-authored-by: Claude/Codex/...";不要加 "Generated with ..."。
- **不自动 push**。提交前一律让用户看 `git diff` 和 `git status`。

---

## 8. 当 AGENTS.md 本身需要更新

如果你遇到了一个**不在本文件里覆盖** 的翻车 → 那正是驾驭工程要抓的"环境漏洞"。流程:
1. 在 `docs/agents/failures/` 写一篇复盘。
2. 把最关键的一两行**加回到本文件的第 3 / 5 节**(保持本文件小)。
3. 告诉用户:"本次的根因应当沉淀进 AGENTS.md,我已补充,请 review。"

---

_last human review: 2026-04-19_
_driver: Harness Engineering, Mitchell Hashimoto 2026-02 + OpenAI 百万行报告_
