#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ABM-LLM FastAPI 应用入口

替代 Flask 的 run_app.py + app/__init__.py create_app()

启动:
    uvicorn main:app --host 0.0.0.0 --port 19080 --reload
"""
import os
import sys
import logging

# ─── 环境编码 ───
os.environ['PYTHONIOENCODING'] = 'utf-8'
os.environ['LC_ALL'] = 'en_US.UTF-8'
os.environ['LANG'] = 'en_US.UTF-8'

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from core.config import settings

# ═══════════════════════════════════════════════════════
# 日志配置
# ═══════════════════════════════════════════════════════

def configure_logging():
    """配置应用的日志系统（替代 Flask 的 configure_logging）"""
    log_level_map = {
        'DEBUG': logging.DEBUG, 'INFO': logging.INFO,
        'WARNING': logging.WARNING, 'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL
    }
    log_level = log_level_map.get(settings.LOG_LEVEL, logging.INFO)

    logging.basicConfig(
        level=log_level,
        format='[%(levelname)s] %(asctime)s - %(name)s - %(message)s'
    )
    root = logging.getLogger()
    root.setLevel(log_level)
    logging.getLogger('app').setLevel(log_level)
    logging.getLogger('app.services').setLevel(log_level)
    logging.getLogger('app.api').setLevel(log_level)

    if log_level == logging.DEBUG:
        logging.getLogger('app.services.conversation').setLevel(logging.DEBUG)
        logging.getLogger('app.services.mcp_server_manager').setLevel(logging.DEBUG)

    # File handler — idempotent. Third-party libraries invoked during startup
    # (alembic's fileConfig, HanLP/TensorFlow) rebuild the root logger's
    # handlers and drop ours, which froze logs/app.log after startup. Drop any
    # stale app.log handler and reinstall a fresh one so this function can be
    # safely re-invoked (e.g. at the end of startup) to guarantee runtime logs
    # keep reaching the file.
    os.makedirs('logs', exist_ok=True)
    log_path = os.path.abspath('logs/app.log')
    for h in list(root.handlers):
        if isinstance(h, logging.FileHandler) and os.path.abspath(getattr(h, 'baseFilename', '')) == log_path:
            root.removeHandler(h)
            h.close()
    file_handler = logging.FileHandler('logs/app.log')
    file_handler.setFormatter(logging.Formatter(
        '[%(levelname)s] %(asctime)s - %(name)s - %(message)s'
    ))
    file_handler.setLevel(log_level)
    root.addHandler(file_handler)


configure_logging()
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════
# 中间件
# ═══════════════════════════════════════════════════════

class LicenseMiddleware(BaseHTTPMiddleware):
    """
    许可证检查中间件

    替代 Flask 的 register_license_middleware()
    """
    EXEMPT_PATHS = [
        '/api/license', '/api/auth/login', '/api/auth/logout',
        '/api/auth/validate', '/api/auth/user', '/api/health',
    ]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 跳过非 API、OPTIONS、豁免路径
        if (not path.startswith('/api/') or
            request.method == 'OPTIONS' or
            any(path.startswith(p) for p in self.EXEMPT_PATHS)):
            return await call_next(request)

        # 检查许可证
        try:
            from app.services.license_service import LicenseService
            license_service = LicenseService()
            license_data = license_service.get_current_license()
            if not license_data:
                logger.warning(f"访问 {path} 被拒绝：许可证无效或已过期")
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={
                        'status': 'error',
                        'message': '许可证无效或已过期，请激活系统',
                        'code': 'LICENSE_EXPIRED'
                    }
                )
        except Exception as e:
            logger.error(f"许可证检查异常: {e}")

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    安全头中间件

    替代 Flask 的 after_request 安全头
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith('/api/'):
            logger.debug(f"API访问: {request.method} {request.url.path}")
        return await call_next(request)


class DBSessionMiddleware(BaseHTTPMiddleware):
    """
    数据库 Session 清理中间件

    替代 Flask 的 @app.teardown_appcontext(lambda exc: db.session.remove())
    确保每个请求结束后 scoped_session 被正确清理，避免：
    1. 脏 session 跨请求传播（一个请求中的 rollback 状态污染后续请求）
    2. MySQL 乐观锁冲突后 session 无法恢复
    3. 连接池泄漏
    
    注意：
    - BaseHTTPMiddleware.dispatch 始终运行在 asyncio 事件循环线程上
    - sync def 路由被 Starlette 自动放到 AnyIO worker 线程（线程池）
    - 因此此 finally 清理的是事件循环线程的 scoped_session
    - 但后台 scheduler 也在事件循环线程上使用 scoped_session
    - 所以这里只做轻量清理（rollback 脏事务），不做 remove()
    - Worker 线程上的 session 由路由层的 try/except + rollback 处理
    """
    async def dispatch(self, request: Request, call_next):
        # 请求开始前：清理事件循环线程上的脏 session
        # 确保 LicenseMiddleware 和其他内层中间件看到干净的 session
        from core.database import ScopedSession
        try:
            ScopedSession().rollback()
        except Exception:
            pass
        
        try:
            response = await call_next(request)
            return response
        finally:
            # 请求结束后：再次清理（处理 async def 路由遗留的脏状态）
            try:
                ScopedSession().rollback()
            except Exception:
                pass


# ═══════════════════════════════════════════════════════
# 创建 FastAPI 应用
# ═══════════════════════════════════════════════════════

app = FastAPI(
    title='ABM-LLM API',
    version=settings.API_VERSION,
    description='多智能体行动任务系统 API',
    docs_url='/docs',      # Swagger UI（Flask 没有的福利）
    redoc_url='/redoc',
)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    expose_headers=["Content-Type", "Authorization"],
)

# ─── 自定义中间件（注意顺序：后注册的先执行） ───
# Setup 模式下数据库尚未配置，跳过依赖 DB 的中间件（License 会查 system_settings、
# DBSession 会操作 scoped_session），否则 /api/setup 请求会被许可证检查 403 拦截。
if settings.SETUP_MODE:
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLogMiddleware)
else:
    # 执行顺序：RequestLog → License → SecurityHeaders → DBSession(cleanup)
    # 注册顺序相反，最后注册的最先执行
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(LicenseMiddleware)
    app.add_middleware(RequestLogMiddleware)
    app.add_middleware(DBSessionMiddleware)  # 最后注册 = 最先执行(外层)，确保 finally 最后清理


# ═══════════════════════════════════════════════════════
# 全局异常处理
# ═══════════════════════════════════════════════════════

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """
    自定义 HTTPException 处理器
    
    解决 Flask→FastAPI 迁移的核心兼容性问题：
    
    Flask:   raise abort(400) 或 return jsonify({...}), 400
             → 前端收到: {"message": "...", "error": "..."}  (平铺)
    
    FastAPI: raise HTTPException(detail={...})
             → 默认前端收到: {"detail": {"message": "...", "error": "..."}}  (多包一层)
    
    前端代码直接访问 error.response.data.message / data.error / data.code，
    如果不拆包 detail，全部会是 undefined。
    
    此 handler 将 dict 类型的 detail 直接平铺到响应体，
    保持与 Flask 时代前端的完全兼容。
    """
    if isinstance(exc.detail, dict):
        # detail 是 dict → 直接作为响应体（平铺），兼容前端
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    # detail 是字符串或其他 → 保持 FastAPI 默认行为
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# ═══════════════════════════════════════════════════════
# 路由注册
# ═══════════════════════════════════════════════════════

from app.api.routes import api_router
app.include_router(api_router, prefix='/api')


# ═══════════════════════════════════════════════════════
# 启动事件（替代 Flask with app.app_context() 中的初始化）
# ═══════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("=" * 50)

    # ─── Setup 模式：尚未完成连接级配置，跳过一切依赖 DB 的初始化 ───
    # 此时只有 /api/setup 路由可用，前端据此显示首启引导。完成配置写入
    # config.conf 后，后端自重启，is_configured() 转真，走下面的正常流程。
    if settings.SETUP_MODE:
        logger.info("ABM-LLM 以 [Setup 模式] 启动 —— 等待首次初始化配置")
        logger.info("  未检测到 DATABASE_URI（环境变量或 config.conf）")
        logger.info("  仅挂载 /api/setup/* 路由；请通过前端引导完成配置")
        logger.info("=" * 50)
        return

    logger.info("ABM-LLM FastAPI 启动中...")
    logger.info(f"数据库: {settings.DATABASE_URI.split('@')[-1] if '@' in settings.DATABASE_URI else settings.DATABASE_URI}")
    logger.info(f"日志级别: {settings.LOG_LEVEL}")

    # 1. 初始化数据库（建表 + 种子数据 + 加载系统设置）
    from core.database import init_database
    init_database()

    # 1.5. 初始化 Redis 缓存（可选，失败自动降级为无缓存）
    try:
        from core.redis_client import init_redis
        r = init_redis()
        if r:
            logger.info("✓ Redis 缓存已连接")
        else:
            logger.info("Redis 未配置或连接失败，使用无缓存模式")
    except Exception as e:
        logger.warning(f"Redis 初始化异常: {e}")

    # 2. 初始化 OAuth 服务
    try:
        from app.services.oauth_service import OAuthService
        OAuthService.init_providers(settings)
        providers = OAuthService.get_available_providers()
        if providers:
            logger.info(f"✓ OAuth 提供商已初始化: {', '.join(providers)}")
        else:
            logger.info("OAuth: 无已启用的提供商")
    except Exception as e:
        logger.warning(f"OAuth 初始化失败: {e}")

    # 3. 初始化 HanLP（可选，后台异步预热）
    # hanlp.load() 会加载 TensorFlow 模型，耗时数十秒且是阻塞的同步调用；放在
    # startup 主协程里会拖慢/阻塞事件循环。此处仅作缓存预热（返回值不使用；实际
    # 分词器由 bm25_search_service 自行加载），因此改为后台 daemon 线程预热。
    # 另外 HanLP/TensorFlow 加载时会重置 root logger 的 handlers（清空 stdout 与
    # app.log handler），导致此后日志被静默；线程内加载完成后重建日志配置
    # （configure_logging 幂等），确保运行期日志继续落盘。
    def _warmup_hanlp():
        try:
            import hanlp
            hanlp.load(hanlp.pretrained.mtl.CLOSE_TOK_POS_NER_SRL_DEP_SDP_CON_ELECTRA_BASE_ZH)
            configure_logging()
            logger.info("✓ HanLP分词器初始化完成（后台预热）")
        except Exception as e:
            configure_logging()
            logger.warning(f"HanLP分词器初始化失败: {e}")

    import threading
    threading.Thread(target=_warmup_hanlp, name="hanlp-warmup", daemon=True).start()
    logger.info("HanLP分词器后台预热已启动")

    # 4. 初始化并行实验室事件总线
    try:
        from app.services.event_bus.core import experiment_bus
        experiment_bus.start_processing()
        logger.info("✓ 并行实验室事件总线已启动")
    except Exception as e:
        logger.warning(f"事件总线启动失败: {e}")

    # 5. 初始化后台任务管理器
    try:
        from app.services.job_queue import job_manager
        from app.services.job_queue.handlers import knowledge_job_handlers
        from app.services.job_queue.handlers import lightrag_job_handlers
        from app.services.job_queue.handlers.knowledge_pipeline_handler import handle_process_file_pipeline

        job_manager.init()
        job_manager.register_handler('kb:convert_file', knowledge_job_handlers.handle_convert_file)
        job_manager.register_handler('kb:chunk_file', knowledge_job_handlers.handle_chunk_file)
        job_manager.register_handler('kb:embed_file', knowledge_job_handlers.handle_embed_file)
        job_manager.register_handler('kb:vectorize_file', knowledge_job_handlers.handle_vectorize_file)
        job_manager.register_handler('kb:vectorize_batch', knowledge_job_handlers.handle_batch_vectorize)
        job_manager.register_handler('kb:process_file_pipeline', handle_process_file_pipeline)
        job_manager.register_handler('kb:lightrag_upload', lightrag_job_handlers.handle_lightrag_upload)
        job_manager.register_handler('kb:lightrag_batch_upload', lightrag_job_handlers.handle_lightrag_batch_upload)
        job_manager.register_handler('kb:lightrag_sync_all', lightrag_job_handlers.handle_lightrag_sync_all)
        logger.info("✓ 后台任务管理器已初始化")
    except Exception as e:
        logger.warning(f"后台任务管理器初始化失败: {e}")

    # 5.5. 启动流式连接管理器的周期性回收（清理超时连接 + 孤立中断标志墓碑）
    try:
        from app.services.conversation.connection_manager import connection_manager
        connection_manager.start_periodic_cleanup()
        logger.info("✓ 流式连接回收器已启动")
    except Exception as e:
        logger.warning(f"流式连接回收器启动失败: {e}")

    # 6. 打印已注册的路由
    logger.info("\n==== 已注册的 FastAPI 路由 ====")
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            logger.info(f"  {', '.join(route.methods)} {route.path}")
    logger.info("================================\n")

    # Startup imports (alembic fileConfig, HanLP/TensorFlow) may have rebuilt
    # the root logger and dropped our app.log FileHandler. Re-apply logging
    # config now, after all noisy initialization, so runtime request logs are
    # guaranteed to reach logs/app.log. configure_logging() is idempotent.
    configure_logging()

    logger.info(f"✓ FastAPI 启动完成，监听 {settings.HOST}:{settings.PORT}")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    logger.info("FastAPI 正在关闭...")
    # 停止流式连接回收器
    try:
        from app.services.conversation.connection_manager import connection_manager
        connection_manager.stop_periodic_cleanup()
    except Exception as e:
        logger.warning(f"流式连接回收器停止异常: {e}")
    # 清理 Redis 连接
    try:
        from core.redis_client import close_redis
        close_redis()
    except Exception as e:
        logger.warning(f"Redis 关闭异常: {e}")
    # 清理数据库连接池
    from core.database import engine
    engine.dispose()
    logger.info("数据库连接池已清理")

