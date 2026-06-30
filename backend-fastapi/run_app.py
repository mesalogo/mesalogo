#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
多智能体行动任务系统启动脚本 (FastAPI)

用法：
    python run_app.py              # 开发模式，自动重载
    python run_app.py --prod       # 生产模式，4 workers
"""

import os
import sys

os.environ['PYTHONIOENCODING'] = 'utf-8'
os.environ['LC_ALL'] = 'en_US.UTF-8'
os.environ['LANG'] = 'en_US.UTF-8'

import uvicorn
from core.config import settings

if __name__ == '__main__':
    host = settings.HOST or '0.0.0.0'
    # 端口的唯一真相来源是 settings.PORT（已按 环境变量 > config.conf > 默认 解析）
    port = settings.PORT

    is_prod = '--prod' in sys.argv

    # WORKERS 可显式覆盖 worker 数。容器内设 WORKERS=1：使首启引导写配置后
    # os._exit 能直接终结主进程→容器退出→由 restart 策略拉起读新配置的新容器
    # （多 worker 时退出单个 worker 只会被 master 补一个，配置不刷新）。
    workers = int(os.environ.get('WORKERS', '4' if is_prod else '1'))

    print(f"启动 FastAPI 服务器于 http://{host}:{port}")
    print(f"模式: {'生产' if is_prod else '开发'} | workers={workers}")
    print(f"Swagger UI: http://{host}:{port}/docs")

    uvicorn.run(
        'main:app',
        host=host,
        port=port,
        reload=not is_prod,
        workers=workers,
        log_level=settings.LOG_LEVEL.lower() if not is_prod else 'info',
    )
