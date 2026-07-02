# [2026-07] 启动迁移后全进程日志被静默

> 来源:排查"容器里 `logs/app.log` 只写到启动早期就冻结,运行期日志（含 ERROR）完全丢失"时发现。
> 状态:🟢 Fixed

## 发生了什么

用户反馈"检查日志看不到报错"。表象是 `abm-docker/volumes/backend-logs/app.log`（bind-mount，等同容器内 `/app/logs/app.log`）
在每次启动后**冻结在 `事件总线开始处理事件` 这一行**，之后再无任何日志；`docker logs` 里同样从该点起
不再有业务日志、甚至没有 uvicorn 的 access log。但服务功能完全正常（`/api/model-configs` 返回 200）。
也就是说:服务在跑，日志系统却"死"了——最危险的一类问题（出事时无迹可查）。

## 根因

应用启动链:`startup_event` → `init_database()` → `core/database.py::_auto_migrate()` →
`alembic command.upgrade()` → `alembic/env.py` 的这两行:

```python
if config.config_file_name is not None:
    fileConfig(config.config_file_name)     # ← 元凶
```

`logging.config.fileConfig()` 默认 `disable_existing_loggers=True`。它做了两件破坏性的事:

1. 按 `alembic.ini` 的 `[loggers]/[handlers]` **重建 root logger 的 handlers**，丢弃了
   `main.configure_logging()` 挂上的 `FileHandler('logs/app.log')`。
2. 把当时**所有已存在的 logger**（`main`、`app`、`app.services`…）的 `.disabled` 置为 `True`，
   于是这些 logger 此后**永久静默**——handler 还在、`stream` 没关、`logging.disable` level 为 0，
   但每个 logger 自身 `disabled=True`，`isEnabledFor(INFO)` 返回 False，日志不输出。

第 2 点是主凶，也是最难查的:所有"看起来正常"的检查（handlers 在、level 对、disable=0、stream 未关）
都通过，但日志就是不出来。只有直接对比 logger 的 `.disabled` 标志才能看穿。

一次性验证（在容器内复刻）:

```python
from logging.config import fileConfig
logging.getLogger('main').disabled   # False
fileConfig('/app/alembic.ini')
logging.getLogger('main').disabled   # True   ← 确认
```

## 为什么 Agent / 我们没早发现

- [x] `app.log` 停在的那一行来自后台线程（`experiment_bus._process_events` 抢在 disable 生效前打的），
      造成"日志停在事件总线那一步"的**误导性定位**，让人以为是事件总线/HanLP 阻塞。
- [x] 服务返回 200 与日志静默**同时存在**，直觉上矛盾，容易误判为"日志没坏、只是没报错"。
- [x] AGENTS.md 只在 §4「No silent fallbacks」讲了 alembic `fileConfig` 会重建 handler（handlers 层面），
      **没提 `disable_existing_loggers=True` 会 disable 掉现有 logger**（logger 层面）。
- [x] 没有测试断言"startup（含迁移）之后 `logging.getLogger('app').disabled is False`"。
- [x] HanLP/TensorFlow 加载时的 blink 进度条（`^[[5m`）进一步干扰，误导为"HanLP 阻塞 startup"。

## 怎么改掉(已做)

代码修复:`backend-fastapi/core/database.py::_auto_migrate()`。在迁移窗口前后快照并恢复:
- root logger 的 `handlers` 与 `level`；
- **每个已存在 logger 的 `.disabled` 标志**（真凶）。

```python
_saved_disabled = {
    name: lg.disabled
    for name, lg in logging.root.manager.loggerDict.items()
    if isinstance(lg, logging.Logger)
}
# ... command.upgrade(cfg, 'head') ...
finally:
    _root.handlers = _saved_handlers
    _root.setLevel(_saved_level)
    for name, was_disabled in _saved_disabled.items():
        lg = logging.root.manager.loggerDict.get(name)
        if isinstance(lg, logging.Logger):
            lg.disabled = was_disabled
```

不改 `alembic.ini` / `alembic/env.py`（保持独立 `alembic` CLI 的行为不变）。

加固（顺带）:
- `main.configure_logging()` 改为**幂等**（移除并 close 旧的 app.log FileHandler 再重挂），可安全重复调用。
- HanLP 预热改为**后台 daemon 线程**，不阻塞 startup 事件循环（其返回值本就不被使用，真正的分词器由
  `bm25_search_service` 自行加载）。

文档修复:本文件 + AGENTS.md（见下）。

## 怎么防止再犯(长期)

- [ ] 加测试 `tests/integration/db/test_migration_logging.py`:执行一次 `_auto_migrate()`（或 startup），
      断言 `logging.getLogger('app').disabled is False` 且 root 仍持有指向 `logs/app.log` 的 FileHandler。
- [ ] 任何新引入的 `logging.config.fileConfig(...)` / `dictConfig(...)` 调用，必须显式传
      `disable_existing_loggers=False`，除非有意重置全局日志。
- [x] `backend-fastapi/AGENTS.md` §4 追加一行提示（fileConfig 既换 handler 也会 disable 现有 logger）。

## 延伸阅读

- Python 文档:`logging.config.fileConfig(disable_existing_loggers=True)` 语义
- 姊妹坑:同类"启动期第三方库重置 root logging"（HanLP/TensorFlow）
- 相关修复文件:`backend-fastapi/core/database.py`、`backend-fastapi/main.py`
