"""
Flask 配置兼容层

部分 service 代码可能 import Config，此文件提供兼容。
实际配置统一在 core/config.py 中管理。
"""
from core.config import settings, BASE_DIR

# ─── 兼容旧代码 from config import Config ───
class Config:
    """代理到 settings 单例"""
    def __getattr__(self, name):
        return getattr(settings, name, None)

    def get(self, key, default=None):
        return settings.get(key, default)

    def __getitem__(self, key):
        return settings[key]

    def __setitem__(self, key, value):
        settings[key] = value

    def __contains__(self, key):
        return key in settings

    # 静态属性（一些 service 直接访问 Config.XXX）
    SQLALCHEMY_DATABASE_URI = settings.DATABASE_URI
    SECRET_KEY = settings.SECRET_KEY
    DEBUG = settings.DEBUG
    LOG_LEVEL = settings.LOG_LEVEL
    KNOWLEDGEBASE_PATH = settings.KNOWLEDGEBASE_PATH
    UPLOAD_FOLDER = settings.UPLOAD_FOLDER
    MAX_CONTENT_LENGTH = settings.MAX_CONTENT_LENGTH
    FRONTEND_URL = settings.FRONTEND_URL
    API_BASE_URL = f"http://{settings.HOST}:{settings.PORT}"

# 一些旧代码用到的全局变量
BACKEND_URL = f"http://{settings.HOST}:{settings.PORT}"
FRONTEND_URL = settings.FRONTEND_URL
DEBUG_LLM_RESPONSE = settings.DEBUG_LLM_RESPONSE
LOG_LEVEL = settings.LOG_LEVEL
