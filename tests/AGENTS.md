# /tests/AGENTS.md — 这里**不是**真测试目录

> 如果你是 AI agent 进入了这个目录,**先停下**。

## 这里是什么

历史 scratchpad。100+ 个 debug 脚本、一次性验证代码、curl-replay。
**整个目录在根 `.gitignore` 里**(`tests/*` 规则),除了**这份 AGENTS.md**
(`!tests/AGENTS.md` 例外)以外**全部 untracked**。

进入这里看到的所有 `*.py` / `*.sh` / `*.json` / `*.html` / `*.md`
都是开发者本地考古产物,**不会**进 git、**不会**进 CI、**不应**被
现在的代码依赖。它们大多是 Flask 时代的写法,对当前 FastAPI/async
代码库**没有**参考价值,还会误导。

## 你想做什么

| 意图 | 去哪 |
|---|---|
| 写 / 改一个测试 | `backend-fastapi/tests/`(读那里的 `AGENTS.md`) |
| 找历史上某个 API 怎么调的参考 | grep 这里,只读,**不要复制** |
| 加一个 debug 脚本 | 放在自己的本地工作区,不要污染这里 |
| 清理这个目录 | **不要主动清**。根 AGENTS.md §3.3 红线: 不删未跟踪文件 |

## 红线

1. ❌ **不要在这里加新测试**。新测试一律去 `backend-fastapi/tests/<layer>/`。
2. ❌ **不要把这里的代码当模板抄到 `backend-fastapi/tests/`**。
   Flask 写法在 FastAPI 体系下根本跑不了。
3. ❌ **不要 `git add -f`** 任何文件进来。`tests/*` gitignore 是有意为之。
4. ❌ **不要修改本文件以外的东西**,除非用户明确点名要清这个目录。

## 历史背景

这个目录积累于 2025-05 ~ 2025-09 期间项目从 Flask 迁移到 FastAPI 之前。
当时还没有正式测试体系,开发者把所有 debug 脚本都堆在这里。
迁移完成后(2025-10+)正式测试目录迁到 `backend-fastapi/tests/`,
这里就被冻结了。

参见根 `/AGENTS.md` §2 仓库地形图、`backend-fastapi/tests/AGENTS.md`。

---

_last review: 2026-05-13_
