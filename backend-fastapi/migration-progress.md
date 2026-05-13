# Flask → FastAPI 迁移进度

## 迁移策略

**核心原则**：保留 `app/models.py`（SQLAlchemy ORM）和 `app/services/`（业务逻辑层）不变，只改造：
1. 应用入口：`run_app.py` → `main.py`（uvicorn ASGI）
2. 配置系统：`config.py` → `core/config.py`（Settings 单例）
3. 数据库层：`extensions.py`（Flask-SQLAlchemy）→ 兼容层（原生 SQLAlchemy + scoped_session + Model.query）
4. 路由层：Flask Blueprint → FastAPI APIRouter（机械转换 + 自动转换脚本）
5. 中间件层：Flask before_request → FastAPI Middleware + Depends
6. SSE 流式：Flask Response(generate()) → FastAPI StreamingResponse

**关键映射表**：
| Flask | FastAPI |
|-------|---------|
| `Blueprint('name', __name__)` | `APIRouter(prefix=..., tags=[...])` |
| `@bp.route('/path', methods=['GET'])` | `@router.get('/path')` |
| `request.get_json()` | `await request.json()` |
| `request.args.get('key')` | `Query(default=...)` |
| `jsonify(data)` | 直接返回 dict |
| `jsonify(data), 404` | `raise HTTPException(404, detail=...)` |
| `current_app.config['KEY']` | `settings.get('KEY')` |
| `db.session` (Flask-SQLAlchemy) | `db.session`（通过兼容层保持不变） |
| `Model.query.filter_by(...)` | `Model.query.filter_by(...)`（通过 _QueryProperty 兼容） |
| `@login_required` 装饰器 | `Depends(get_current_user)` |
| `flask.g` | 去掉，直接传参 |
| `Response(generate(), mimetype='text/event-stream')` | `StreamingResponse(generate(), media_type='text/event-stream')` |

---

## Phase 0: 基础架构 ✅

- [x] `migration-progress.md` — 本文件
- [x] `requirements.txt` — FastAPI 依赖
- [x] `main.py` — uvicorn 启动入口 + 中间件 + 启动事件
- [x] `core/__init__.py`
- [x] `core/config.py` — Settings 单例配置（从 config.conf + 环境变量）
- [x] `core/database.py` — SQLAlchemy engine + SessionLocal + scoped_session + init_database()
- [x] `core/dependencies.py` — 公共依赖（get_current_user / get_admin_user / get_user_from_api_key）
- [x] `app/extensions.py` — _CompatDB 兼容层（db.Model / db.session / db.Column / Model.query）
- [x] `app/__init__.py` — 清空（不再有 create_app）
- [x] `config.py` — Flask Config 兼容代理

## Phase 1: 中间件 ✅

- [x] CORS — FastAPI 原生 CORSMiddleware
- [x] License 检查 — LicenseMiddleware（BaseHTTPMiddleware）
- [x] 安全头 — SecurityHeadersMiddleware
- [x] 请求日志 — RequestLogMiddleware

## Phase 2: 手动转换路由 ✅ (6个)

- [x] `health.py` — 1 route
- [x] `auth.py` — 5 routes (login/logout/validate/user/change-password)
- [x] `agents.py` — 7 routes
- [x] `messages.py` — 3 routes
- [x] `roles.py` — 13 routes
- [x] `settings.py` — 5 routes

## Phase 3: Worker 转换复杂路由 ✅ (3个)

- [x] `conversations.py` — 22 routes（含 SSE StreamingResponse）
- [x] `model_configs.py` — 17 routes（含 SSE 流式测试）
- [x] `rules.py` — 18 routes

## Phase 4-5: 批量自动转换 ✅ (38个单文件 + 3个包)

使用 `scripts/convert_routes.py` 自动转换脚本。

✅ 通过语法检查（51/53 文件）:
agent_variables, api_docs, auth, capabilities※, conversations, document_parser,
environment_variables, external_knowledge, external_variables, graph_enhancement,
graph_mcp, graph_visualization※, health, im_bot_config, im_webhook, image_upload※,
jobs, knowledge※, license, lightrag, logs, market, mcp_servers, memory_management,
messages, model_configs, monitoring, oauth, one_click_generation, onlyoffice,
openai_export※, parallel_experiments※, permissions, public_tasks, published_tasks,
roles, roles_ext, rules, settings, shared_environment_variables, skills※,
statistics, subscription, tool_schema_cache, tools※, users, vector_database※,
vnc, workspace

※ = 语法 OK 但运行时有 import 问题（需要小修）

❌ 需要手动修复（2个）:
- `action_tasks.py` — 多文件合并后的多行 import 断裂
- `action_spaces.py` — 同上

## Phase 6: 启动逻辑 ✅

- [x] 数据库初始化（建表 + 种子数据 + 系统设置加载）
- [x] HanLP 分词器初始化
- [x] 并行实验室事件总线
- [x] 后台任务管理器（job_manager）
- [x] 路由动态加载（跳过有错误的模块，不阻断启动）

## Phase 7: 验证 ✅

- [x] TestClient 测试：335 路由注册，核心端点全部 200
- [x] uvicorn 实际启动：成功监听 8081，curl 验证通过
  - `/api/health` → `{"status":"healthy"}`
  - `/api/agents` → 237,236 agents
  - `/api/model-configs` → 1 config
  - `/api/settings` → 50 keys
- [x] Swagger UI：`/docs` 可访问

---

## 剩余工作

### 高优先级
1. **修复 action_tasks.py / action_spaces.py** — 多行 import 合并问题
2. **修复运行时 import 错误** — capabilities/tools/skills 中残留的 Flask `bp` 引用
3. **修复 knowledge/openai_export/vector_database** — 包合并后缺少 `router` 导出

### 中优先级
4. **services 层中的 `flask.g` 使用** — 3 处需要替换为参数传递
5. **services 层中的 `current_app` 使用** — 替换为 settings 单例
6. **前端联调** — 切换前端 API 端口到 8081，验证完整功能

### 低优先级
7. 清理 `_flask_old` 和 `_flask_backup` 目录
8. 清理旧的 `.py.bak` 文件
9. 删除 `gunicorn.conf.py`（不再需要）
10. 添加 FastAPI 自动生成的 OpenAPI 文档完善

---

## 运行方式

```bash
# 开发环境
cd backend-fastapi
conda activate abm
uvicorn main:app --host 0.0.0.0 --port 8081 --reload

# 生产环境
uvicorn main:app --host 0.0.0.0 --port 8080 --workers 4

# Swagger UI
open http://localhost:8081/docs
```

## 架构说明

```
backend-fastapi/
├── main.py              # FastAPI 应用入口 + 中间件 + 启动事件
├── config.py            # Flask Config 兼容代理
├── config.conf          # 配置文件（共用）
├── core/
│   ├── config.py        # Settings 单例（Pydantic-free）
│   ├── database.py      # SQLAlchemy engine + session 管理
│   └── dependencies.py  # FastAPI DI（auth/admin/api_key）
├── app/
│   ├── __init__.py      # 空（不再有 create_app）
│   ├── extensions.py    # Flask-SQLAlchemy 兼容层（_CompatDB）
│   ├── models.py        # 【不变】SQLAlchemy ORM 模型
│   ├── services/        # 【不变】业务逻辑层
│   ├── api/
│   │   └── routes/      # FastAPI APIRouter 路由文件
│   ├── mcp_servers/     # 【不变】MCP 服务器
│   ├── seed_data/       # 【不变】种子数据
│   └── utils/           # 【不变】工具函数
├── scripts/
│   ├── convert_routes.py      # Flask→FastAPI 自动转换脚本
│   └── convert_remaining.py   # 批量转换驱动
└── migration-progress.md      # 本文件
```

## 注意事项

1. **models.py 不修改**：通过 `_CompatDB` + `_QueryProperty` 兼容层桥接
2. **services 层不修改**：services 内部仍然用 `db.session`、`Model.query`
3. **渐进迁移**：Flask (8080) 和 FastAPI (8081) 可并行运行，前端切换端口测试
4. **自动转换脚本**：`scripts/convert_routes.py` 处理了 ~80% 的机械转换，少量文件需手动修复
