"""
OAuth 服务模块

提供 OAuth 2.0 社交登录支持
"""
from abc import ABC, abstractmethod
from authlib.integrations.requests_client import OAuth2Session
import secrets
import logging

logger = logging.getLogger(__name__)

class OAuthProvider(ABC):
    """OAuth 提供商基类"""
    
    @abstractmethod
    def get_authorization_url(self, state: str) -> str:
        pass
    
    @abstractmethod
    def fetch_token(self, code: str) -> dict:
        pass
    
    @abstractmethod
    def get_user_info(self, token: dict) -> dict:
        """返回标准化的用户信息"""
        pass

class GoogleOAuthProvider(OAuthProvider):
    """Google OAuth 实现"""
    
    AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
    TOKEN_URL = 'https://oauth2.googleapis.com/token'
    USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        
    def get_authorization_url(self, state: str, redirect_uri: str = None) -> str:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=redirect_uri or self.redirect_uri,
            scope='openid email profile'
        )
        url, _ = session.create_authorization_url(
            self.AUTHORIZE_URL,
            state=state
        )
        return url
    
    def fetch_token(self, code: str, redirect_uri: str = None) -> dict:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=redirect_uri or self.redirect_uri
        )
        token = session.fetch_token(
            self.TOKEN_URL,
            code=code,
            client_secret=self.client_secret
        )
        return token
    
    def get_user_info(self, token: dict) -> dict:
        session = OAuth2Session(self.client_id, token=token)
        resp = session.get(self.USERINFO_URL)
        data = resp.json()
        return {
            'provider': 'google',
            'provider_user_id': data['sub'],
            'email': data.get('email'),
            'name': data.get('name'),
            'avatar_url': data.get('picture'),
            'email_verified': data.get('email_verified', False)
        }

class MicrosoftOAuthProvider(OAuthProvider):
    """Microsoft OAuth 实现 (Azure AD / Microsoft Identity)"""
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, tenant_id: str = 'common'):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.tenant_id = tenant_id
        self.authorize_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize'
        self.token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
        self.userinfo_url = 'https://graph.microsoft.com/v1.0/me'
        
    def get_authorization_url(self, state: str, redirect_uri: str = None) -> str:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=redirect_uri or self.redirect_uri,
            scope='openid email profile User.Read'
        )
        url, _ = session.create_authorization_url(
            self.authorize_url,
            state=state
        )
        return url
    
    def fetch_token(self, code: str, redirect_uri: str = None) -> dict:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=redirect_uri or self.redirect_uri
        )
        token = session.fetch_token(
            self.token_url,
            code=code,
            client_secret=self.client_secret
        )
        return token
    
    def get_user_info(self, token: dict) -> dict:
        session = OAuth2Session(self.client_id, token=token)
        resp = session.get(self.userinfo_url)
        data = resp.json()
        return {
            'provider': 'microsoft',
            'provider_user_id': data.get('id'),
            'email': data.get('mail') or data.get('userPrincipalName'),
            'name': data.get('displayName'),
            'avatar_url': None,
            'email_verified': True
        }

class GenericOIDCProvider(OAuthProvider):
    """通用 OpenID Connect 提供商实现"""
    
    def __init__(self, provider_name: str, client_id: str, client_secret: str, redirect_uri: str,
                 authorize_url: str, token_url: str, userinfo_url: str,
                 scope: str = 'openid email profile',
                 user_id_field: str = 'sub', email_field: str = 'email',
                 name_field: str = 'name', avatar_field: str = 'picture'):
        self.provider_name = provider_name
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.authorize_url = authorize_url
        self.token_url = token_url
        self.userinfo_url = userinfo_url
        self.scope = scope
        self.user_id_field = user_id_field
        self.email_field = email_field
        self.name_field = name_field
        self.avatar_field = avatar_field
        
    def get_authorization_url(self, state: str) -> str:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri,
            scope=self.scope
        )
        url, _ = session.create_authorization_url(
            self.authorize_url,
            state=state
        )
        return url
    
    def fetch_token(self, code: str) -> dict:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri
        )
        token = session.fetch_token(
            self.token_url,
            code=code,
            client_secret=self.client_secret
        )
        return token
    
    def get_user_info(self, token: dict) -> dict:
        session = OAuth2Session(self.client_id, token=token)
        resp = session.get(self.userinfo_url)
        data = resp.json()
        return {
            'provider': self.provider_name,
            'provider_user_id': str(data.get(self.user_id_field, '')),
            'email': data.get(self.email_field),
            'name': data.get(self.name_field),
            'avatar_url': data.get(self.avatar_field),
            'email_verified': data.get('email_verified', False)
        }

class GenericOAuth2Provider(OAuthProvider):
    """通用 OAuth 2.0 提供商实现（非 OIDC 标准）"""
    
    def __init__(self, provider_name: str, client_id: str, client_secret: str, redirect_uri: str,
                 authorize_url: str, token_url: str, userinfo_url: str,
                 scope: str = '',
                 user_id_field: str = 'id', email_field: str = 'email',
                 name_field: str = 'name', avatar_field: str = 'avatar_url'):
        self.provider_name = provider_name
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.authorize_url = authorize_url
        self.token_url = token_url
        self.userinfo_url = userinfo_url
        self.scope = scope
        self.user_id_field = user_id_field
        self.email_field = email_field
        self.name_field = name_field
        self.avatar_field = avatar_field
        
    def get_authorization_url(self, state: str) -> str:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri,
            scope=self.scope if self.scope else None
        )
        url, _ = session.create_authorization_url(
            self.authorize_url,
            state=state
        )
        return url
    
    def fetch_token(self, code: str) -> dict:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri
        )
        token = session.fetch_token(
            self.token_url,
            code=code,
            client_secret=self.client_secret
        )
        return token
    
    def get_user_info(self, token: dict) -> dict:
        session = OAuth2Session(self.client_id, token=token)
        resp = session.get(self.userinfo_url)
        data = resp.json()
        return {
            'provider': self.provider_name,
            'provider_user_id': str(data.get(self.user_id_field, '')),
            'email': data.get(self.email_field),
            'name': data.get(self.name_field),
            'avatar_url': data.get(self.avatar_field),
            'email_verified': True
        }

class OAuthService:
    """OAuth 服务管理类"""
    
    providers: dict[str, OAuthProvider] = {}
    oauth_states: dict[str, dict] = {}  # 存储 state（生产环境应使用 Redis）
    
    @classmethod
    def register_provider(cls, name: str, provider: OAuthProvider):
        cls.providers[name] = provider
    
    @classmethod
    def get_provider(cls, name: str) -> OAuthProvider:
        if name not in cls.providers:
            raise ValueError(f"Unknown OAuth provider: {name}")
        return cls.providers[name]
    
    @classmethod
    def get_available_providers(cls) -> list[str]:
        """获取已配置的提供商列表"""
        return list(cls.providers.keys())
    
    @classmethod
    def generate_state(cls, provider: str, redirect_uri: str = '/', is_desktop: bool = False) -> str:
        """生成并存储 state"""
        state = secrets.token_urlsafe(32)
        cls.oauth_states[state] = {
            'provider': provider,
            'redirect_uri': redirect_uri,
            'is_desktop': is_desktop
        }
        return state
    
    @classmethod
    def validate_state(cls, state: str) -> dict | None:
        """验证并消费 state"""
        return cls.oauth_states.pop(state, None)
    
    @classmethod
    def init_providers(cls, config=None):
        """初始化所有配置的 OAuth 提供商
        
        Args:
            config: 配置对象，支持 .get(key, default) 方法。
                    可以是 Flask app.config 或 FastAPI Settings 实例。
                    如果不传则自动使用 core.config.settings。
        """
        if config is None:
            from core.config import settings
            config = settings
        # 兼容 Flask app 对象（传了 app 而非 app.config 的情况）
        if hasattr(config, 'config') and not callable(getattr(config, 'get', None)):
            config = config.config
        
        redirect_uri = config.get('OAUTH_REDIRECT_URI', 'http://localhost:5173/oauth/callback')
        
        # Google
        google_enabled = config.get('GOOGLE_OAUTH_ENABLED', False)
        google_client_id = config.get('GOOGLE_CLIENT_ID')
        google_client_secret = config.get('GOOGLE_CLIENT_SECRET')
        if google_enabled and google_client_id and google_client_secret:
            cls.register_provider('google', GoogleOAuthProvider(
                client_id=google_client_id,
                client_secret=google_client_secret,
                redirect_uri=redirect_uri
            ))
            logger.info("Google OAuth provider initialized")
        elif not google_enabled:
            logger.info("Google OAuth provider disabled")
        
        # Microsoft
        microsoft_enabled = config.get('MICROSOFT_OAUTH_ENABLED', False)
        microsoft_client_id = config.get('MICROSOFT_CLIENT_ID')
        microsoft_client_secret = config.get('MICROSOFT_CLIENT_SECRET')
        if microsoft_enabled and microsoft_client_id and microsoft_client_secret:
            microsoft_tenant_id = config.get('MICROSOFT_TENANT_ID', 'common')
            cls.register_provider('microsoft', MicrosoftOAuthProvider(
                client_id=microsoft_client_id,
                client_secret=microsoft_client_secret,
                redirect_uri=redirect_uri,
                tenant_id=microsoft_tenant_id
            ))
            logger.info("Microsoft OAuth provider initialized")
        elif not microsoft_enabled:
            logger.info("Microsoft OAuth provider disabled")
        
        # Generic OIDC
        oidc_enabled = config.get('OIDC_ENABLED', False)
        oidc_client_id = config.get('OIDC_CLIENT_ID')
        oidc_client_secret = config.get('OIDC_CLIENT_SECRET')
        if oidc_enabled and oidc_client_id and oidc_client_secret:
            oidc_name = config.get('OIDC_PROVIDER_NAME', 'oidc')
            cls.register_provider(oidc_name, GenericOIDCProvider(
                provider_name=oidc_name,
                client_id=oidc_client_id,
                client_secret=oidc_client_secret,
                redirect_uri=redirect_uri,
                authorize_url=config.get('OIDC_AUTHORIZE_URL', ''),
                token_url=config.get('OIDC_TOKEN_URL', ''),
                userinfo_url=config.get('OIDC_USERINFO_URL', ''),
                scope=config.get('OIDC_SCOPE', 'openid email profile'),
                user_id_field=config.get('OIDC_USER_ID_FIELD', 'sub'),
                email_field=config.get('OIDC_EMAIL_FIELD', 'email'),
                name_field=config.get('OIDC_NAME_FIELD', 'name'),
                avatar_field=config.get('OIDC_AVATAR_FIELD', 'picture')
            ))
            logger.info(f"Generic OIDC provider '{oidc_name}' initialized")
        elif not oidc_enabled:
            logger.info("Generic OIDC provider disabled")
        
        # Generic OAuth 2.0
        oauth2_enabled = config.get('OAUTH2_ENABLED', False)
        oauth2_client_id = config.get('OAUTH2_CLIENT_ID')
        oauth2_client_secret = config.get('OAUTH2_CLIENT_SECRET')
        if oauth2_enabled and oauth2_client_id and oauth2_client_secret:
            oauth2_name = config.get('OAUTH2_PROVIDER_NAME', 'oauth2')
            cls.register_provider(oauth2_name, GenericOAuth2Provider(
                provider_name=oauth2_name,
                client_id=oauth2_client_id,
                client_secret=oauth2_client_secret,
                redirect_uri=redirect_uri,
                authorize_url=config.get('OAUTH2_AUTHORIZE_URL', ''),
                token_url=config.get('OAUTH2_TOKEN_URL', ''),
                userinfo_url=config.get('OAUTH2_USERINFO_URL', ''),
                scope=config.get('OAUTH2_SCOPE', ''),
                user_id_field=config.get('OAUTH2_USER_ID_FIELD', 'id'),
                email_field=config.get('OAUTH2_EMAIL_FIELD', 'email'),
                name_field=config.get('OAUTH2_NAME_FIELD', 'name'),
                avatar_field=config.get('OAUTH2_AVATAR_FIELD', 'avatar_url')
            ))
            logger.info(f"Generic OAuth2 provider '{oauth2_name}' initialized")
        elif not oauth2_enabled:
            logger.info("Generic OAuth2 provider disabled")
