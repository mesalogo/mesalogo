# OAuth 社交登录集成方案

## 概述

为平台添加 OAuth 2.0 / OpenID Connect 社交登录支持，允许用户通过 Google、Apple、AWS Cognito 等第三方身份提供商登录。OAuth 登录的用户默认为普通用户角色。

## 目标

- 支持 Google 账户登录
- 支持 Apple 账户登录  
- 支持 AWS Cognito 账户登录（可扩展支持企业 SAML/OIDC）
- OAuth 用户自动创建为普通用户（非管理员）
- 与现有用户名/密码登录共存

## 当前认证架构

### 后端
- `backend/app/api/routes/auth.py` - 登录/登出 API
- `backend/app/middleware/auth_middleware.py` - JWT 验证中间件
- 使用 PyJWT 生成/验证 token
- User 模型包含 `username`, `password_hash`, `email`, `is_admin`, `profile` 字段

### 前端
- `frontend/src/services/api/auth.ts` - 认证 API 服务
- Token 存储在 localStorage

---

## 技术方案

### 方案选择：后端 OAuth 流程

采用**授权码模式 (Authorization Code Flow)**，后端处理 token 交换，更安全。

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐
│ Browser │────>│ Frontend│────>│   Backend    │────>│ Provider│
│         │     │         │     │              │     │(Google) │
└─────────┘     └─────────┘     └──────────────┘     └─────────┘
     │               │                 │                   │
     │  1. 点击登录   │                 │                   │
     │──────────────>│                 │                   │
     │               │  2. 获取授权URL  │                   │
     │               │────────────────>│                   │
     │               │  3. 返回URL      │                   │
     │               │<────────────────│                   │
     │  4. 重定向到Provider             │                   │
     │<──────────────│                 │                   │
     │               │                 │                   │
     │  5. 用户授权   │                 │                   │
     │─────────────────────────────────────────────────────>│
     │  6. 回调+code  │                 │                   │
     │<─────────────────────────────────────────────────────│
     │               │  7. code换token │                   │
     │               │────────────────>│                   │
     │               │                 │  8. 验证code       │
     │               │                 │──────────────────>│
     │               │                 │  9. 返回token      │
     │               │                 │<──────────────────│
     │               │                 │ 10. 获取用户信息   │
     │               │                 │──────────────────>│
     │               │                 │ 11. 返回用户信息   │
     │               │                 │<──────────────────│
     │               │ 12. 创建/更新用户│                   │
     │               │     生成JWT     │                   │
     │               │<────────────────│                   │
     │ 13. 返回JWT   │                 │                   │
     │<──────────────│                 │                   │
```

---

## 数据库设计

### 新增表：`oauth_accounts`（精简版）

用于关联用户与 OAuth 提供商账户（支持一个用户绑定多个 OAuth 账户）。

**设计原则：KISS - 只保留必要字段**

```python
class OAuthAccount(BaseMixin, db.Model):
    """OAuth 账户关联表（精简版）"""
    __tablename__ = 'oauth_accounts'
    
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    provider = Column(String(50), nullable=False)  # google, apple, aws_cognito
    provider_user_id = Column(String(255), nullable=False)  # 提供商的用户ID
    email = Column(String(255))  # OAuth 提供的邮箱
    avatar_url = Column(String(500))  # 头像URL
    
    # 关联
    user = relationship("User", backref="oauth_accounts")
    
    # 唯一约束：同一提供商的用户ID只能绑定一次
    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='uq_oauth_provider_user'),
    )
```

**为什么只保留 5 个字段：**
- `user_id` - 关联用户（必须）
- `provider` - 区分登录来源（必须）
- `provider_user_id` - OAuth 提供商的唯一标识（必须）
- `email` - 记录 OAuth 邮箱，方便排查问题
- `avatar_url` - 直接使用 OAuth 头像，用户无需再上传

**删除的字段：**
- ~~name~~ - User.profile.display_name 已有
- ~~access_token~~ - 登录完成后不需要
- ~~refresh_token~~ - 登录完成后不需要
- ~~token_expires_at~~ - 登录完成后不需要
- ~~raw_data~~ - 调试用，生产环境不需要

### 权限模型

OAuth 用户使用现有权限系统，无需额外设计：

```
OAuth 用户登录
    ↓
创建 User 记录 (is_admin=False)
    ↓
权限判断直接使用 is_admin 字段：
  - is_admin=True  → 超级管理员，拥有所有权限
  - is_admin=False → 普通用户，只能操作自己的资源
```

---

## API 设计

### 新增 OAuth 路由

```python
# backend/app/api/routes/oauth.py

# 1. 获取 OAuth 授权 URL
GET /api/oauth/{provider}/authorize
# 参数: redirect_uri (可选)
# 返回: { "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..." }

# 2. OAuth 回调处理
GET /api/oauth/{provider}/callback
# 参数: code, state
# 返回: { "token": "jwt...", "user": {...}, "is_new_user": true/false }

# 3. 绑定 OAuth 账户到现有用户
POST /api/oauth/{provider}/link
# 需要认证
# 参数: code
# 返回: { "success": true, "provider": "google" }

# 4. 解绑 OAuth 账户
DELETE /api/oauth/{provider}/unlink
# 需要认证
# 返回: { "success": true }

# 5. 获取已绑定的 OAuth 账户列表
GET /api/oauth/accounts
# 需要认证
# 返回: { "accounts": [{ "provider": "google", "email": "..." }] }
```

### Provider 支持

| Provider | OAuth 类型 | 用户信息端点 | 备注 |
|----------|-----------|-------------|------|
| GoogleOAuth 2.0 + OIDC | `https://www.googleapis.com/oauth2/v3/userinfo` | 最常用 |
| Apple | OAuth 2.0 + OIDC | ID Token 解析 | 需要 Apple Developer 账户 |
| AWS Cognito | OAuth 2.0 + OIDC | Cognito User Pool | 支持企业 SSO |

---

## 后端实现

### 1. 依赖添加

```txt
# backend/requirements.txt
authlib>=1.3.0          # OAuth 客户端库
httpx>=0.25.0           # 异步 HTTP 客户端
python-jose[cryptography]>=3.3.0  # JWT 验证（支持 RS256）
```

### 2. 配置文件

```python
# backend/app/config.py 或环境变量

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')

# Apple OAuth
APPLE_CLIENT_ID = os.getenv('APPLE_CLIENT_ID')  # Service ID
APPLE_TEAM_ID = os.getenv('APPLE_TEAM_ID')
APPLE_KEY_ID = os.getenv('APPLE_KEY_ID')
APPLE_PRIVATE_KEY = os.getenv('APPLE_PRIVATE_KEY')  # .p8 文件内容

# AWS Cognito
AWS_COGNITO_DOMAIN = os.getenv('AWS_COGNITO_DOMAIN')  # xxx.auth.region.amazoncognito.com
AWS_COGNITO_CLIENT_ID = os.getenv('AWS_COGNITO_CLIENT_ID')
AWS_COGNITO_CLIENT_SECRET = os.getenv('AWS_COGNITO_CLIENT_SECRET')
AWS_COGNITO_REGION = os.getenv('AWS_COGNITO_REGION', 'us-east-1')
AWS_COGNITO_USER_POOL_ID = os.getenv('AWS_COGNITO_USER_POOL_ID')

# OAuth 通用配置
OAUTH_REDIRECT_URI = os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:3000/oauth/callback')
```

### 3. OAuth 服务类

```python
# backend/app/services/oauth_service.py

from authlib.integrations.requests_client import OAuth2Session
from abc import ABC, abstractmethod

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
        pasGoogleOAuthProvider(OAuthProvider):
    """Google OAuth 实现"""
    
    AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
    TOKEN_URL = 'https://oauth2.googleapis.com/token'
    USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        
    def get_authorization_url(self, state: str) -> str:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri,
            scope='openid email profile'
        )
        url, _ = session.create_authorization_url(
            self.AUTHORIZE_URL,
            state=state
        )
        return url
    
    def fetch_token(self, code: str) -> dict:
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri
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
            'email_verified': data.get('email_verified', False),
            'raw_data': data
        }

class AppleOAuthProvider(OAuthProvider):
    """Apple OAuth 实现"""
    # Apple 需要特殊处理：client_secret 是动态生成的 JWT
    pass

class CognitoOAuthProvider(OAuthProvider):
    """AWS Cognito OAuth 实现"""
 ass

class OAuthService:
    """OAuth 服务管理类"""
    
    providers: dict[str, OAuthProvider] = {}
    
    @classmethod
    def register_provider(cls, name: str, provider: OAuthProvider):
        cls.providers[name] = provider
    
    @classmethod
    def get_provider(cls, name: str) -> OAuthProvider:
        if name not in cls.providers:
            raise ValueError(f"Unknown OAuth provider: {name}")
        return cls.providers[name]
    
    @classmethod
    def init_providers(cls, app):
        """初始化所有配置的 OAuth 提供商"""
        config = app.config
        redirect_uri = config.get('OAUTH_REDIRECT_URI')
        
        # Google
        if config.get('GOOGLE_CLIENT_ID'):
            cls.register_provider('google', GoogleOAuthProvider(
                client_id=config['GOOGLE_CLIENT_ID'],
                client_secret=config['GOOGLE_CLIENT_SECRET'],
                redirect_uri=redirect_uri
            ))
        
        # Apple
        if config.get('APPLE_CLIENT_ID'):
            cls.register_provider('apple', AppleOAuthProvider(...))
        
        # AWS Cognito
        if config.get('AWS_COGNITO_CLIENT_ID'):
            cls.register_provider('aws_cognito', CognitoOAuthProvider(...))
```

### 4. OAuth 路由实现

```python
# backend/app/api/routes/oauth.py

from flask import Blueprint, request, jsonify, current_app, redirect
from app.services.oauth_service import OAuthService
from app.models import User, OAuthAccount, db
import secrets
import jwt

oauth_bp = Blueprint('oauth_api', __name__)

# 存储 state（生产环境应使用 Redis）
oauth_states = {}

@oauth_bp.route('/oauth/<provider>/authorize', methods=['GET'])
def oauth_authorize(provider: str):
    """获取 OAuth 授权 URL"""
    try:
        oauth_provider = OAuthService.get_provider(provider)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    
    # 生成 state 防止 CSRF
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        'provider': provider,
        'redirect_uri': request.args.get('redirect_uri', '/')
    }
    
    auth_url = oauth_provider.get_authorization_url(state)
    return jsonify({'auth_url': auth_url})

@oauth_bp.route('/oauth/<provider>/callback', methods=['GET'])
def oauth_callback(provider: str):
    """OAuth 回调处理"""
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')if error:
        return jsonifyerror': error}), 400
    
    # 验证 state
    if state not in oauth_states:
        return jsonify({'error': 'Invalid state'}), 400
    
    state_data = oauth_states.pop(state)
    
    try:
        oauth_provider = OAuthService.get_provider(provider)
        
        # 交换 token
        token = oauth_provider.fetch_token(code)
        
        # 获取用户信息
        user_info = oauth_provider.get_user_info(token)
        
        # 查找或创建用户
        user, is_new = find_or_create_oauth_user(user_info)
        
        # 生成 JWT
        jwt_token = generate_jwt_token(user)
        
        # 返回结果（可以重定向到前端）
        return jsonify({
            'status': 'success',
            'token': jwt_token,
            'user': user.to_dict(),
            'is_new_user': is_new
        })
        
    except Exception as e:
        current_app.logger.error(f"OAuth callback error: {e}")
        return jsonify({'error': 'OAuth authentication failed'}), 500

def find_or_create_oauth_user(user_info: dict) -> tuple[User, bool]:
    """查找或创建 OAuth 用户（精简版）"""
    provider = user_info['provider']
    provider_user_id = user_info['provider_user_id']
    
    # 1. 查找已绑定的 OAuth 账户
    oauth_account = OAuthAccount.query.filter_by(
        provider=provider,
        provider_user_id=provider_user_id
    ).first()
    
    if oauth_account:
        # 更新头像（可能会变）
        oauth_account.avatar_url = user_info.get('avatar_url')
        db.session.commit()
        return oauth_account.user, False
    
    # 2. 通过邮箱查找现有用户（可选绑定）
    email = user_info.get('email')
    user = User.query.filter_by(email=email).first() if email else None
    
    is_new = False
    if not user:
        # 3. 创建新用户
        username = generate_unique_username(user_info)
        user = User(
            username=username,
            email=email,
            is_active=True,
            is_admin=False,  # OAuth 用户默认非管理员
            profile={
                'display_name': user_info.get('name', username),
                'avatar_url': user_info.get('avatar_url')
            }
        )
        db.session.add(user)
        is_new = True
    
    # 4. 创建 OAuth 账户关联
    oauth_account = OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        email=email,
        avatar_url=user_info.get('avatar_url')
    )
    db.session.add(oauth_account)
    db.session.commit()
    
    return user, is_new

def generate_unique_username(user_info: dict) -> str:
    """生成唯一用户名"""
    base_name = user_info.get('name', '').replace(' ', '_').lower()
    if not base_name:
        base_name = user_info.get('email', '').split('@')[0]
    if not base_name:
        base_name = 'user'
    
    username = base_name
    counter = 1
    while User.query.filter_by(username=username).first():
        username = f"{base_name}_{counter}"
        counter += 1
    
    return username
```

---

## 前端实现

### 1. OAuth 服务

```typescript
// frontend/src/services/api/oauth.ts

import api from './axios';

export interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export const oauthAPI = {
  /**
   * 获取可用的 OAuth 提供商列表
   */
  getProviders: async (): Promise<OAuthProvider[]> => {
    const response = await api.get('/oauth/providers');
    return response.data.providers;
  },

  /**
   * 获取 OAuth 授权 URL
   */
  getAuthorizationUrl: async (provider: string): Promise<string> => {
    const response = await api.get(`/oauth/${provider}/authorize`, {
      params: {
        redirect_uri: `${window.location.origin}/oauth/callback`
      }
    });
    return response.data.auth_url;
  },

  /**
   * 处理 OAuth 回调
   */
  handleCallback: async (provider: string, code: string, state: string) => {
    const response = await api.get(`/oauth/${provider}/callback`, {
      params: { code, state }
    });
    return response },

  /**
   * 获取已绑定的 OAuth 账户
   */
  getLinkedAccounts: async () => {
    const response = await api.get('/oauth/accounts');
    return response.data.accounts;
  },

  /**
   * 解绑 OAuth 账户
   */
  unlinkAccount: async (provider: string) => {
    const response = await api.delete(`/oauth/${provider}/unlink`);
    return response.data;
  }
};
```

### 2. 登录页面组件

```tsx
// frontend/src/pages/login/OAuthButtons.tsx

import React from 'react';
import { Button, Space, Divider } from 'antd';
import { GoogleOutlined, AppleOutlined, CloudOutlined } from '@ant-design/icons';
import { oauthAPI } from '@/services/api/oauth';

const OAuthButtons: React.FC = () => {
  const handleOAuthLogin = async (provider: string) => {
    try {
      const authUrl = await oauthAPI.getAuthorizationUrl(provider);
      // 重定向到 OAuth 提供商
      window.location.href = authUrl;
    } catch (error) {
      console.error('OAuth login error:', error);
    }
  };

  return (
    <>
      <Divider>或使用以下方式登录</Divider>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button
          icon={<Gutlined />}
          onClick={() => handleOAuthLogin('google')}
          block
        >
          使用 Google 账户登录
        </Button>
        <Button
          icon={<AppleOutlined />}
          onClick={() => handleOAuthLogin('apple')}
          block
        >
          使用 Apple 账户登录
        </Button>
        <Button
          icon={<CloudOutlined />}
          onClick={() => handleOAuthLogin('aws_cognito')}
          block
        >
          使用 AWS 账户登录
        </Button>
      </Space>
    </>
  );
};

export default OAuthButtons;
```

### 3. OAuth 回调页面

```tsx
// frontend/src/pages/oauth/OAuthCallback.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result } from 'antd';
import { oauthAPI } from '@/services/api/oauth';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      
      // 从 URL path 获取 provider
      const pathParts = window.location.pathname.split('/');
      const provider = pathParts[pathParts.indexOf('oauth') + 1] || 'google';

      if (errorParam) {
        setError(errorParam);
        return;
      }

      if (!code || !state) {
        setError('Missing authorization code');
        return;
      }

      try {
        const result = await oauthAPI.handleCallback(provider, code, state);
        
        if (result.status === 'success') {
          // 保存 token
          localStorage.setItem('authToken', result.token);
          
          // 跳转到首页
          navigate('/', { replace: true });
        } else {
          setError(result.message || 'Authentication failed');
        }
      } catch (err) {
        setError('OAuth authentication failed');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <Result
        status="error"
        title="登录失败"
        subTitle={error}
        extra={
          <Button type="primary" onClick={() => navigate('/login')}>
            返回登录
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '100px' }}>
      <Spin size="large" />
      <p>正在处理登录...</p>
    </div>
  );
};

export default OAuthCallback;
```

---

## 安全考虑

### 1. CSRF 防护
- 使用 `state` 参数验证请求来源
- state 存储在内存中，设置 5 分钟过期

### 2. Token 安全
- 不存储 OAuth access_token/refresh_token（登录完成后不需要）
- 使用 HTTPS 传输所有认证数据

### 3. 账户绑定
- 通过邮箱匹配现有用户时自动绑定
- 如需更严格控制，可要求用户确认

---

## 配置示例

### Google Cloud Console 配置

1. 创建 OAuth 2.0 客户端 ID
2. 配置授权重定向 URI：
   - 开发环境：`http://localhost:3000/oauth/callback`
   - 生产环境：`https://your-domain.com/oauth/callback`
3. 启用 Google+ API 或 People API

### Apple Developer 配置

1. 创建 App ID 并启用 Sign in with Apple
2. 创建 Services ID
3. 配置 Return URLs
4. 创建 Key 并下载 .p8 文件

### AWS Cognito 配置

1. 创建 User Pool
2. 配置 App Client
3. 配置域名（Cognito 域名或自定义域名）
4. 配置回调 URL

---

## 实现步骤

### Phase 1: 基础架构 (2天)
- [ ] 添加 `oauth_accounts` 数据库表（5个字段）
- [ ] 创建 OAuth 服务基类和 Google 实现
- [ ] 实现 OAuth 路由 (authorize, callback)
- [ ] 前端登录页添加 OAuth 按钮

### Phase 2: 完善功能 (1-2天)
- [ ] 实现 Apple OAuth（可选）
- [ ] 实现 AWS Cognito OAuth（可选）
- [ ] 账户绑定/解绑功能
- [ ] 用户设置页显示已绑定账户

### Phase 3: 测试部署 (1天)
- [ ] 集成测试
- [ ] 生产环境配置

---

## 环境变量模板

```bash
# .env.example

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple OAuth
APPLE_CLIENT_ID=com.your-app.service
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# AWS Cognito
AWS_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
AWS_COGNITO_CLIENTr-cognito-client-id
AWS_COGNITO_CLIENT_SECRET=your-cognito-client-secret
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX

# OAuth 通用
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
```

---

## 桌面应用 OAuth 登录问题

### 问题描述

桌面应用（Electron）使用 OAuth 登录时存在回调地址问题：

1. **网页应用**：OAuth 回调到 `http://localhost:3000/oauth/callback` 可以正常工作
2. **桌面应用**：Electron 内嵌页面运行在随机端口（如 `http://127.0.0.1:54321`），OAuth 提供商无法回调到这个地址

### 技术限制

- **Google/Microsoft OAuth 不支持自定义协议**：`mesalogo://` 不能作为 redirect_uri
- **Google 不允许私有 IP**：`http://10.x.x.x:8080` 会报错 "device_id and device_name are required for private IP"
- **桌面应用端口随机**：每次启动端口不同，无法预先在 OAuth 控制台注册

### 可行方案对比

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A. 后端回调 + 重定向** | OAuth 回调到后端，后端重定向到 `mesalogo://` | 统一处理，安全 | 需要后端可访问（localhost 或公网域名） |
| **B. 固定端口本地服务** | 桌面应用启动固定端口（如 17890）接收回调 | 不依赖后端 | 需要在 OAuth 控制台注册额外地址，端口可能冲突 |
| **B2. 动态端口本地服务** | 桌面应用使用当前随机端口接收回调 | 不依赖后端，无端口冲突 | 需要 Google 支持 loopback IP 特例 |
| **C. 前端网页中转** | 依赖 `localhost:3000` 前端服务运行 | 简单 | 打包后的桌面应用无法使用 |

### 方案 B2：动态端口本地服务（推荐用于桌面应用）

Google OAuth 对 loopback IP（`localhost` / `127.0.0.1`）有特殊处理：
- **允许任意端口**，不需要预先在控制台注册具体端口
- 参考：[Google OAuth for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)

**流程：**

```
桌面应用启动，Express 服务运行在随机端口（如 54321）
    ↓
用户点击 OAuth 登录
    ↓
前端获取当前端口，构建 redirect_uri = http://localhost:54321/oauth/callback
    ↓
请求后端获取授权 URL，传递动态 redirect_uri
    ↓
后端用动态地址生成 Google 授权 URL
    ↓
系统浏览器打开 Google 认证
    ↓
Google 回调到 http://localhost:54321/oauth/callback
    ↓
桌面应用的 Express 服务接收回调
    ↓
Express 服务将 code 发送给主进程（通过 IPC 或内部 API）
    ↓
前端用 code 调用后端换取 token
    ↓
登录完成
```

**Google OAuth 控制台配置：**

```
# 只需注册 loopback 地址（不带端口）
http://localhost
http://127.0.0.1
```

**实现要点：**

1. **桌面应用 Express 服务添加回调路由**：
```javascript
// desktop-app/main.js
server.get('/oauth/callback', (req, res) => {
  const { code, state, error } = req.query;
  // 通知主窗口处理回调
  mainWindow.webContents.send('oauth-callback-received', { code, state, error });
  // 返回一个关闭页面的 HTML
  res.send('<html><body><script>window.close()</script>正在完成登录...</body></html>');
});
```

2. **前端动态获取当前端口**：
```typescript
// 在 Electron 环境中获取当前服务端口
const currentPort = window.location.port;
const redirectUri = `http://localhost:${currentPort}/oauth/callback`;
```

3. **后端支持动态 redirect_uri**：
```python
# 后端需要验证 redirect_uri 是 localhost 或 127.0.0.1
# 然后用这个动态地址生成授权 URL
```

**优点：**
- 不依赖后端地址配置
- 无端口冲突问题
- 符合 Google 官方推荐的桌面应用 OAuth 方案

**注意事项：**
- Microsoft OAuth 也支持类似的 loopback 特例
- 需要确保后端正确验证 redirect_uri 的合法性（防止开放重定向攻击）

### 方案 B2 实现总结（已完成）

**修改的文件：**

1. **桌面应用 `desktop-app/main.js`**：
   - 移除了 `mesalogo://` 自定义协议相关代码
   - 在 Express 服务中添加了 `/oauth/callback` 路由，直接接收 OAuth 回调
   - 回调页面通过 `postMessage` 或 URL 重定向将 code 传递给前端处理

2. **桌面应用 `desktop-app/preload.js`**：
   - 移除了 `onOAuthCallback` 和 `removeOAuthCallback` 方法
   - 保留了 `openExternal` 用于打开外部链接

3. **前端 `frontend/src/services/api/oauth.ts`**：
   - 移除了桌面应用特殊逻辑（`isElectron`、`openOAuthInBrowser`）
   - `getAuthorizationUrl` 使用 `window.location.origin` 动态获取当前端口

4. **前端 `frontend/src/pages/login/Login.tsx`**：
   - 移除了桌面应用特殊的 OAuth 回调监听
   - 移除了 `isElectron` 和 `oauth_from_desktop` 相关逻辑
   - OAuth 登录统一使用 `window.location.href` 跳转

5. **前端 `frontend/src/pages/oauth/OAuthCallback.tsx`**：
   - 移除了 `oauth_from_desktop` 和 `mesalogo://` 重定向逻辑

6. **前端 `frontend/src/services/config/electronConfig.ts`**：
   - 移除了 OAuth 相关的类型定义（`onOAuthCallback`、`removeOAuthCallback`）

**统一流程（网页和桌面应用相同）：**
```
用户点击 OAuth 登录
    ↓
前端获取授权 URL
  - redirect_uri = window.location.origin + '/oauth/callback'
  - 例如：http://localhost:54321/oauth/callback（桌面应用随机端口）
  - 例如：http://localhost:3000/oauth/callback（网页开发环境）
    ↓
浏览器跳转到 Google/Microsoft 认证页面
    ↓
用户完成认证
    ↓
OAuth 提供商回调到 redirect_uri
    ↓
前端 /oauth/callback 页面接收 code 和 state
    ↓
前端调用后端 API 用 code 换取 JWT token
    ↓
保存 token，跳转到首页，登录完成
```

**Google OAuth 控制台最终配置：**
```
授权的重定向 URI：
- http://localhost
- http://127.0.0.1
```

注意：Google 对 loopback 地址（localhost/127.0.0.1）允许任意端口，无需逐个注册。

### Microsoft OAuth 的特殊限制

**重要发现：Microsoft Azure AD 不像 Google 那样自动允许任意端口。**

**Microsoft 的限制：**
1. 必须精确匹配注册的 redirect_uri（包括端口）
2. 不会自动忽略端口号
3. 需要为每个可能的端口单独注册

**Microsoft Azure AD 配置选项：**

**选项 1：使用 "Mobile and desktop applications" 平台**
1. Azure Portal → 应用注册 → 身份验证 → 添加平台
2. 选择 **"Mobile and desktop applications"**
3. 勾选 `http://localhost` 或添加自定义 URI

**选项 2：使用固定端口（推荐用于桌面应用）**
- 桌面应用使用固定端口（如 17890）接收 OAuth 回调
- Azure 中注册：`http://localhost:17890/oauth/callback`
- 避免端口冲突需要选择一个不常用的端口

**选项 3：仅支持 Google OAuth**
- 桌面应用暂时只支持 Google OAuth（支持动态端口）
- Microsoft OAuth 仅在网页应用中可用

**当前状态：**
- Google OAuth：桌面应用和网页应用均支持（动态端口）
- Microsoft OAuth：网页应用支持，桌面应用需要额外配置（固定端口或 Mobile platform）

**待办事项：**
- [ ] 决定 Microsoft OAuth 桌面应用的实现方案
- [ ] 如选择固定端口方案，修改桌面应用使用固定端口
- [ ] 更新 Azure AD 应用注册配置

### 推荐方案：A. 后端回调 + 重定向

```
桌面应用点击 OAuth 登录
    ↓
请求后端获取授权 URL（带 is_desktop=true）
    ↓
后端生成 Google 授权 URL，redirect_uri = 后端地址
    ↓
系统浏览器打开 Google 认证
    ↓
Google 回调到后端 http://localhost:8080/api/oauth/callback
    ↓
后端处理认证，生成 JWT token
    ↓
后端检测 is_desktop=true，重定向到 mesalogo://oauth/callback?token=xxx
    ↓
系统打开桌面应用，传递 token
    ↓
桌面应用保存 token，完成登录
```

### Google OAuth 控制台配置

需要在 Google Cloud Console 添加以下授权重定向 URI：

```
http://localhost:3000/oauth/callback      # 前端开发环境
http://localhost:8080/api/oauth/callback  # 后端本地环境
https://your-domain.com/api/oauth/callback # 生产环境（公网域名）
```

### 后端配置

```ini
# config.conf
# 开发环境（后端在本地）
OAUTH_REDIRECT_URI = http://localhost:8080/api/oauth/callback

# 生产环境（后端有公网域名）
OAUTH_REDIRECT_URI = https://api.your-domain.com/api/oauth/callback
```

### 注意事项

1. **后端必须可访问**：用户浏览器能访问到后端地址
2. **localhost vs 公网**：
   - 开发环境：后端在本地，使用 `localhost:8080`
   - 生产环境：后端需要公网域名或用户本地部署
3. **自定义协议注册**：桌面应用需要注册 `mesalogo://` 协议处理器

---

## 参考资料

- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [Sign in with Apple 文档](https://developer.apple.com/sign-in-with-apple/)
- [AWS Cognito 开发者指南](https://docs.aws.amazon.com/cognito/latest/developerguide/)
- [Authlib 文档](https://docs.authlib.org/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
