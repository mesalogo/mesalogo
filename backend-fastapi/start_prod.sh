#!/bin/bash
# 生产环境启动脚本

set -e

cd "$(dirname "$0")"

# 默认配置（可通过环境变量覆盖）
export GUNICORN_BIND="${GUNICORN_BIND:-0.0.0.0:8080}"
# 注意：使用 SQLite 时建议 workers=1，避免并发写入问题
# 如果迁移到 PostgreSQL/MySQL，可以增加 workers 数量
export GUNICORN_WORKERS="${GUNICORN_WORKERS:-1}"
export GUNICORN_THREADS="${GUNICORN_THREADS:-8}"
# 使用 gthread 而非 eventlet，因为代码中使用了 asyncio
export GUNICORN_WORKER_CLASS="${GUNICORN_WORKER_CLASS:-gthread}"
export GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-120}"
export GUNICORN_LOG_LEVEL="${GUNICORN_LOG_LEVEL:-info}"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"

# 确保日志目录存在
mkdir -p logs

echo "=========================================="
echo "启动 ABM-LLM 后端服务"
echo "绑定地址: $GUNICORN_BIND"
echo "Worker 数量: $GUNICORN_WORKERS"
echo "线程数: $GUNICORN_THREADS"
echo "Worker 类型: $GUNICORN_WORKER_CLASS"
echo "超时时间: ${GUNICORN_TIMEOUT}s"
echo "=========================================="

# 启动 Gunicorn
exec gunicorn -c gunicorn.conf.py run_app:app
