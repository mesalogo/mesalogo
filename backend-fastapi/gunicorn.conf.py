# -*- coding: utf-8 -*-
"""
Gunicorn 配置文件
使用方式: gunicorn -c gunicorn.conf.py run_app:app
"""

import os
import multiprocessing

# 基础配置
bind = os.environ.get('GUNICORN_BIND', '0.0.0.0:8080')

# Worker 数量
# 注意：如果使用 SQLite，建议设置为 1，避免并发写入问题
# 如果迁移到 PostgreSQL/MySQL，可以设置为 CPU*2+1
workers = int(os.environ.get('GUNICORN_WORKERS', 1))
threads = int(os.environ.get('GUNICORN_THREADS', 8))  # 单 worker 时用多线程处理并发

# Worker 类型
# - sync: 默认同步 worker
# - gthread: 多线程模式，兼容 asyncio（推荐）
# - eventlet: 支持长连接/SSE，但与 asyncio 不兼容
# - gevent: 类似 eventlet，也与 asyncio 不兼容
# 注意：由于代码中使用了 asyncio (model_client.py)，不能使用 eventlet/gevent
worker_class = os.environ.get('GUNICORN_WORKER_CLASS', 'gthread')

# 超时配置（秒）
timeout = int(os.environ.get('GUNICORN_TIMEOUT', 120))  # LLM 调用可能较慢
graceful_timeout = 30
keepalive = 5

# 请求配置
max_requests = 0  # 禁用自动重启（单 worker 模式下重启会导致服务中断）
max_requests_jitter = 0

# 日志配置
accesslog = os.environ.get('GUNICORN_ACCESS_LOG', 'logs/gunicorn_access.log')
errorlog = os.environ.get('GUNICORN_ERROR_LOG', 'logs/gunicorn_error.log')
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 进程名称
proc_name = 'abm-llm-backend'

# 预加载应用（可以减少内存使用，但更新代码需要完全重启）
preload_app = False

# 守护进程模式（生产环境用 systemd 管理时设为 False）
daemon = False

# 环境变量
raw_env = [
    'PYTHONIOENCODING=utf-8',
    'LC_ALL=en_US.UTF-8',
    'LANG=en_US.UTF-8',
]


def on_starting(server):
    """服务器启动前"""
    # 确保日志目录存在
    os.makedirs('logs', exist_ok=True)


def post_fork(server, worker):
    """Worker 进程 fork 后执行"""
    server.log.info(f"Worker spawned (pid: {worker.pid})")


def worker_exit(server, worker):
    """Worker 退出时执行"""
    server.log.info(f"Worker exited (pid: {worker.pid})")
