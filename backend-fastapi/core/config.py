"""
FastAPI 配置管理

从 config.conf 和环境变量加载配置，替代 Flask Config 类
"""
import os
import configparser
from typing import Optional

# ─── 项目根目录 ───
BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

# ─── 读取 config.conf ───
_config_parser = configparser.ConfigParser()
_config_path = os.path.join(BASE_DIR, 'config.conf')
if os.path.exists(_config_path):
    _config_parser.read(_config_path, encoding='utf-8')


def _get(key: str, default: str = '', value_type: str = 'string'):
    """从 config.conf [BACKEND_CONFIG] 读取值"""
    if 'BACKEND_CONFIG' in _config_parser:
        value = _config_parser['BACKEND_CONFIG'].get(key, default)
        if value_type == 'bool':
            return value.lower() in ('true', 't', 'yes', 'y', '1')
        if value_type == 'int':
            try:
                return int(value)
            except (ValueError, TypeError):
                return int(default) if default else 0
        return value
    return default


class Settings:
    """
    全局配置对象（单例）

    优先级：环境变量 > config.conf > 默认值
    直接使用类属性，不需要 Pydantic BaseSettings（减少依赖）
    """

    # ─── 基础 ───
    DEBUG: bool = _get('DEBUG', 'False', 'bool')
    SECRET_KEY: str = os.environ.get('SECRET_KEY') or _get('SECRET_KEY', 'dev-key-please-change-in-production')
    LICENSE_SECRET_KEY: str = os.environ.get('LICENSE_SECRET_KEY') or _get('LICENSE_SECRET_KEY', 'license-key-for-development-only')
    LOG_LEVEL: str = os.environ.get('LOG_LEVEL') or _get('LOG_LEVEL', 'INFO').upper()
    DEBUG_LLM_RESPONSE: bool = _get('DEBUG_LLM_RESPONSE', 'False', 'bool')

    # ─── 数据库 ───
    _db_uri_conf = _get('DATABASE_URI', '')
    DATABASE_URI: str = os.environ.get('DATABASE_URI') or (_db_uri_conf if _db_uri_conf else f'sqlite:///{os.path.join(BASE_DIR, "data", "app.db")}')

    # ─── Redis ───
    REDIS_URL: str = os.environ.get('REDIS_URL') or _get('REDIS_URL', '')

    SQLALCHEMY_POOL_SIZE: int = 30
    SQLALCHEMY_MAX_OVERFLOW: int = 70
    SQLALCHEMY_POOL_TIMEOUT: int = 60
    SQLALCHEMY_POOL_RECYCLE: int = 1800

    # ─── 服务器 ───
    HOST: str = _get('HOST', '0.0.0.0')
    PORT: int = int(os.environ.get('PORT', _get('PORT', '8080', 'int') or 8080))

    # ─── API ───
    API_VERSION: str = '1.0'
    API_PREFIX: str = '/api'

    # ─── 前端 ───
    FRONTEND_URL: str = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

    # ─── 上传 ───
    UPLOAD_FOLDER: str = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH: int = _get('MAX_CONTENT_LENGTH', '1073741824', 'int')

    # ─── 知识库 ───
    KNOWLEDGEBASE_PATH: str = os.path.join(BASE_DIR, 'knowledgebase')

    # ─── 会话 ───
    PERMANENT_SESSION_LIFETIME: int = _get('PERMANENT_SESSION_LIFETIME', '3600', 'int')

    # ─── OAuth ───
    GOOGLE_OAUTH_ENABLED: bool = (
        os.environ.get('GOOGLE_OAUTH_ENABLED', '').lower() in ('true', '1', 'yes')
        if os.environ.get('GOOGLE_OAUTH_ENABLED')
        else _get('GOOGLE_OAUTH_ENABLED', 'False', 'bool')
    )
    GOOGLE_CLIENT_ID: str = os.environ.get('GOOGLE_CLIENT_ID') or _get('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET: str = os.environ.get('GOOGLE_CLIENT_SECRET') or _get('GOOGLE_CLIENT_SECRET', '')

    MICROSOFT_OAUTH_ENABLED: bool = (
        os.environ.get('MICROSOFT_OAUTH_ENABLED', '').lower() in ('true', '1', 'yes')
        if os.environ.get('MICROSOFT_OAUTH_ENABLED')
        else _get('MICROSOFT_OAUTH_ENABLED', 'False', 'bool')
    )
    MICROSOFT_CLIENT_ID: str = os.environ.get('MICROSOFT_CLIENT_ID') or _get('MICROSOFT_CLIENT_ID', '')
    MICROSOFT_CLIENT_SECRET: str = os.environ.get('MICROSOFT_CLIENT_SECRET') or _get('MICROSOFT_CLIENT_SECRET', '')
    MICROSOFT_TENANT_ID: str = os.environ.get('MICROSOFT_TENANT_ID') or _get('MICROSOFT_TENANT_ID', 'common')

    OAUTH_REDIRECT_URI: str = os.environ.get('OAUTH_REDIRECT_URI') or _get('OAUTH_REDIRECT_URI', 'http://localhost:5173/oauth/callback')
    OAUTH_DESKTOP_REDIRECT_URI: str = os.environ.get('OAUTH_DESKTOP_REDIRECT_URI') or _get('OAUTH_DESKTOP_REDIRECT_URI', 'http://localhost:8080/api/oauth/callback/desktop')
    OAUTH_DESKTOP_SCHEME: str = os.environ.get('OAUTH_DESKTOP_SCHEME') or _get('OAUTH_DESKTOP_SCHEME', 'mesalogo')

    # ─── Generic OIDC ───
    OIDC_ENABLED: bool = (
        os.environ.get('OIDC_ENABLED', '').lower() in ('true', '1', 'yes')
        if os.environ.get('OIDC_ENABLED')
        else _get('OIDC_ENABLED', 'False', 'bool')
    )
    OIDC_PROVIDER_NAME: str = os.environ.get('OIDC_PROVIDER_NAME') or _get('OIDC_PROVIDER_NAME', 'oidc')
    OIDC_CLIENT_ID: str = os.environ.get('OIDC_CLIENT_ID') or _get('OIDC_CLIENT_ID', '')
    OIDC_CLIENT_SECRET: str = os.environ.get('OIDC_CLIENT_SECRET') or _get('OIDC_CLIENT_SECRET', '')
    OIDC_AUTHORIZE_URL: str = os.environ.get('OIDC_AUTHORIZE_URL') or _get('OIDC_AUTHORIZE_URL', '')
    OIDC_TOKEN_URL: str = os.environ.get('OIDC_TOKEN_URL') or _get('OIDC_TOKEN_URL', '')
    OIDC_USERINFO_URL: str = os.environ.get('OIDC_USERINFO_URL') or _get('OIDC_USERINFO_URL', '')
    OIDC_SCOPE: str = os.environ.get('OIDC_SCOPE') or _get('OIDC_SCOPE', 'openid email profile')
    OIDC_USER_ID_FIELD: str = os.environ.get('OIDC_USER_ID_FIELD') or _get('OIDC_USER_ID_FIELD', 'sub')
    OIDC_EMAIL_FIELD: str = os.environ.get('OIDC_EMAIL_FIELD') or _get('OIDC_EMAIL_FIELD', 'email')
    OIDC_NAME_FIELD: str = os.environ.get('OIDC_NAME_FIELD') or _get('OIDC_NAME_FIELD', 'name')
    OIDC_AVATAR_FIELD: str = os.environ.get('OIDC_AVATAR_FIELD') or _get('OIDC_AVATAR_FIELD', 'picture')

    # ─── Generic OAuth2 ───
    OAUTH2_ENABLED: bool = (
        os.environ.get('OAUTH2_ENABLED', '').lower() in ('true', '1', 'yes')
        if os.environ.get('OAUTH2_ENABLED')
        else _get('OAUTH2_ENABLED', 'False', 'bool')
    )
    OAUTH2_PROVIDER_NAME: str = os.environ.get('OAUTH2_PROVIDER_NAME') or _get('OAUTH2_PROVIDER_NAME', 'oauth2')
    OAUTH2_CLIENT_ID: str = os.environ.get('OAUTH2_CLIENT_ID') or _get('OAUTH2_CLIENT_ID', '')
    OAUTH2_CLIENT_SECRET: str = os.environ.get('OAUTH2_CLIENT_SECRET') or _get('OAUTH2_CLIENT_SECRET', '')
    OAUTH2_AUTHORIZE_URL: str = os.environ.get('OAUTH2_AUTHORIZE_URL') or _get('OAUTH2_AUTHORIZE_URL', '')
    OAUTH2_TOKEN_URL: str = os.environ.get('OAUTH2_TOKEN_URL') or _get('OAUTH2_TOKEN_URL', '')
    OAUTH2_USERINFO_URL: str = os.environ.get('OAUTH2_USERINFO_URL') or _get('OAUTH2_USERINFO_URL', '')
    OAUTH2_SCOPE: str = os.environ.get('OAUTH2_SCOPE') or _get('OAUTH2_SCOPE', '')
    OAUTH2_USER_ID_FIELD: str = os.environ.get('OAUTH2_USER_ID_FIELD') or _get('OAUTH2_USER_ID_FIELD', 'id')
    OAUTH2_EMAIL_FIELD: str = os.environ.get('OAUTH2_EMAIL_FIELD') or _get('OAUTH2_EMAIL_FIELD', 'email')
    OAUTH2_NAME_FIELD: str = os.environ.get('OAUTH2_NAME_FIELD') or _get('OAUTH2_NAME_FIELD', 'name')
    OAUTH2_AVATAR_FIELD: str = os.environ.get('OAUTH2_AVATAR_FIELD') or _get('OAUTH2_AVATAR_FIELD', 'avatar_url')

    # ─── 动态设置存储（从数据库加载的 SystemSettings） ───
    _dynamic: dict = {}

    def get(self, key: str, default=None):
        """兼容 Flask app.config.get() 风格"""
        # 优先动态设置 → 类属性 → 默认值
        upper_key = key.upper()
        if upper_key in self._dynamic:
            return self._dynamic[upper_key]
        return getattr(self, upper_key, default)

    def __getitem__(self, key: str):
        """兼容 app.config['KEY'] 风格"""
        val = self.get(key)
        if val is None:
            raise KeyError(key)
        return val

    def __setitem__(self, key: str, value):
        """兼容 app.config['KEY'] = value"""
        self._dynamic[key.upper()] = value

    def __contains__(self, key: str):
        upper_key = key.upper()
        return upper_key in self._dynamic or hasattr(self, upper_key)


# ─── 全局单例 ───
settings = Settings()
