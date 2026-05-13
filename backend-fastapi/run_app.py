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
    port = int(os.environ.get('PORT', settings.PORT or 8080))

    is_prod = '--prod' in sys.argv

    print(f"启动 FastAPI 服务器于 http://{host}:{port}")
    print(f"模式: {'生产' if is_prod else '开发'}")
    print(f"Swagger UI: http://{host}:{port}/docs")

    uvicorn.run(
        'main:app',
        host=host,
        port=port,
        reload=not is_prod,
        workers=4 if is_prod else 1,
        log_level=settings.LOG_LEVEL.lower() if not is_prod else 'info',
    )
