# tests/_archive/AGENTS.md

> ❌ **不要在这个目录里做任何事**。只读。

## 这是什么

旧 Flask 时代留下的测试代码,从 `backend-deprecated/` 时代复制过来的,
**在当前 FastAPI/async 代码库下根本跑不起来**:
- 用 `from app import create_app` / `app.test_client()` / `with app.app_context()`(Flask API)
- 没有 `async def`,假设全链路是 sync
- 直接 import 已经不存在的 `app.services.subscription_service` 等模块

## 为什么留着

1. 历史检索:某个 API 当年怎么测的、参数怎么传的。
2. 翻新参考:有时业务逻辑还在,挪去 `tests/<layer>/` 重写。
3. 法证:看出"测试体系是从这里被遗弃 → 重建"的迁移轨迹。

## 红线

- ❌ 不要新增任何文件
- ❌ 不要修改这里的代码
- ❌ 不要在 PR 描述里说"我从 _archive 复制了一份"——一律视作重写
- ❌ 不要让 pytest 收集这里(`pytest.ini` 的 `norecursedirs` 已包含 `_archive`)

## 想做什么 → 去哪

| 意图 | 去哪 |
|---|---|
| 写新测试 | `backend-fastapi/tests/<unit|integration|e2e|contract>/` |
| 找参考 | grep 这里,只读 |
| 清掉这个目录 | 不要主动清。需用户明确点名 |

参见 `backend-fastapi/tests/AGENTS.md`。

---

_archived: 2026-05-13_
