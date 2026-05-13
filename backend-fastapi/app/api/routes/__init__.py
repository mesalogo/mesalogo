"""
FastAPI 路由注册中心

将所有 APIRouter 注册到一个总路由器，再由 main.py include
"""
import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

# ─── 总路由器（prefix=/api） ───
api_router = APIRouter()

# ─── Phase 2: 手动转换的简单路由 ───
from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.agents import router as agents_router
from app.api.routes.messages import router as messages_router
from app.api.routes.roles import router as roles_router
from app.api.routes.settings import router as settings_router

api_router.include_router(health_router, tags=['健康检查'])
api_router.include_router(auth_router, prefix='/auth', tags=['认证'])
api_router.include_router(agents_router, prefix='/agents', tags=['智能体'])
api_router.include_router(messages_router, prefix='/messages', tags=['消息'])
api_router.include_router(roles_router, tags=['角色'])
api_router.include_router(settings_router, prefix='/settings', tags=['系统设置'])

# ─── Phase 3: worker 转换的复杂路由 ───
from app.api.routes.conversations import router as conversations_router
from app.api.routes.model_configs import router as model_configs_router
from app.api.routes.rules import router as rules_router

api_router.include_router(conversations_router, tags=['会话'])
api_router.include_router(model_configs_router, tags=['模型配置'])
api_router.include_router(rules_router, tags=['规则'])

# ─── Phase 5: 批量自动转换的路由 ───
# 每个路由文件内已包含完整路径前缀（如 /agent-variables/...）

_auto_routes = {
    'agent_variables': '智能体变量',
    'api_docs': 'API文档',
    'capabilities': '能力管理',
    'document_parser': '文档解析',
    'environment_variables': '环境变量',
    'external_knowledge': '外部知识库',
    'external_variables': '外部变量',
    'graph_enhancement': '图谱增强',
    'graph_mcp': '图谱MCP',
    'graph_visualization': '图谱可视化',
    'im_bot_config': 'IM机器人配置',
    'im_webhook': 'IM Webhook',
    'image_upload': '图片上传',
    'jobs': '后台任务',
    'knowledge': '知识库',
    'license': '许可证',
    'lightrag': 'LightRAG',
    'logs': '日志',
    'market': '应用市场',
    'mcp_servers': 'MCP服务器',
    'memory_management': '记忆管理',
    'monitoring': '行动监控',
    'oauth': 'OAuth认证',
    'one_click_generation': '一键创建',
    'onlyoffice': 'OnlyOffice',
    'openai_export': 'OpenAI导出',
    'parallel_experiments': '并行实验',
    'permissions': '权限管理',
    'public_tasks': '公开任务',
    'published_tasks': '发布任务',
    'roles_ext': '角色扩展',
    'shared_environment_variables': '共享环境变量',
    'skills': '技能管理',
    'statistics': '统计',
    'subscription': '订阅管理',
    'tool_schema_cache': '工具模式缓存',
    'tools': '工具管理',
    'users': '用户管理',
    'vector_database': '向量数据库',
    'vnc': 'VNC代理',
    'workspace': '工作空间',
}

for module_name, tag in _auto_routes.items():
    try:
        mod = __import__(f'app.api.routes.{module_name}', fromlist=['router'])
        api_router.include_router(mod.router, tags=[tag])
    except Exception as e:
        logger.warning(f"跳过路由 {module_name}: {e}")

# ─── action_tasks / action_spaces（语法已修复） ───
from app.api.routes.action_tasks import router as action_tasks_router
from app.api.routes.action_spaces import router as action_spaces_router
api_router.include_router(action_tasks_router, tags=['行动任务'])
api_router.include_router(action_spaces_router, tags=['行动空间'])
