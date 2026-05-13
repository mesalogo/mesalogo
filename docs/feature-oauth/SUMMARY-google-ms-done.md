# OAuth 社交登录实现总结

## 已完成功能

### 支持的 OAuth 提供商

| 提供商 | 状态 | 说明 |
|--------|------|------|
| Google | ✅ 已完成 | 标准 OAuth 2.0 + OpenID Connect |
| Microsoft | ✅ 已完成 | Azure AD / Microsoft Identity |

---

## 后端实现

### 1. OAuth Service (`backend/app/services/oauth_service.py`)

新增 `MicrosoftOAuthProvider` 类：

```python
class MicrosoftOAuthProvider(OAuthProvider):
    def __init__(self, client_id, client_secret, redirect_uri, tenant_id='common'):
        self.authorize_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize'
        self.token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
        self.userinfo_url = 'https://graph.microsoft.com/v1.0/me'
```

### 2. 配置项 (`backend/config.py`)

新增配置：
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID` (默认 `common`)

### 3. 路由 (`backend/app/api/routes/oauth.py`)

添加 Microsoft 图标映射：
```python
elif p == 'microsoft':
    info['name'] = 'Microsoft'
    info['icon'] = 'microsoft'
```

---

## 前端实现

### 1. 登录页图标 (`frontend/src/pages/login/Login.tsx`)

使用自定义 SVG 彩色图标：

```tsx
// 彩色 Google 图标
const GoogleColorIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92..."/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77..."/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s..."/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15..."/>
  </svg>
);

// 彩色 Microsoft 图标
const MicrosoftColorIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em">
    <path fill="#F25022" d="M1 1h10v10H1z"/>
    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
    <path fill="#FFB900" d="M13 13h10v10H13z"/>
  </svg>
);
```

### 2. OAuth 回调修复 (`frontend/src/pages/oauth/OAuthCallback.tsx`)

修复了 provider 硬编码为 `'google'` 的问题：

```tsx
// 登录时存储 provider
localStorage.setItem('oauth_provider', provider);

// 回调时读取 provider
const provider = localStorage.getItem('oauth_provider') || 'google';
localStorage.removeItem('oauth_provider');
```

### 3. 国际化 (`frontend/src/locales/`)

新增翻译：
- `en-US.ts`: `'login.oauth.microsoft': 'Sign in with Microsoft'`
- `zh-CN.ts`: `'login.oauth.microsoft': '使用 Microsoft 账户登录'`

---

## 配置说明

### config.conf 示例

```ini
# OAuth 配置
OAUTH_REDIRECT_URI = http://localhost:3000/oauth/callback

# Google
GOOGLE_CLIENT_ID = your-google-client-id
GOOGLE_CLIENT_SECRET = your-google-client-secret

# Microsoft
MICROSOFT_CLIENT_ID = your-azure-app-id
MICRT_SECRET = your-client-secret
MICROSOFT_TENANT_ID = common
```

### Microsoft Tenant ID 说明

| 值 | 说明 |
|----|------|
| `common` | 支持所有 Microsoft 账户（个人 + 工作/学校） |
| `organizations` | 仅工作/学校账户 |
| `consumers` | 仅个人 Microsoft 账户 |
| 具体租户 ID | 仅该组织的账户 |

---

## Microsoft Entra 配置要点

1. **平台类型**：必须选择 **Web** 平台（不是 SPA）
2. **重定向 URI**：添加 `http://localhost:3000/oauth/callback`
3. **客户端类型**：确保 **允许公共客户端流** 设置为 **否**
4. **API 权限**：需要 `openid`, `email`, `profile`, `User.Read`

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `AADSTS90023: Public clients can't send a client secret` | 应用配置为公共客户端 | 使用 Web 平台，禁用公共客户端流 |
| `invalid_request: redirect_uri not valid` | 重定向 URI 未注册 | 在 Entra 中添加正确的重定向 URI |

---

## 文件变更清单

### 后端
- `backend/app/services/oauth_service.py` - 新增 MicrosoftOAuthProvider
- `backend/app/api/routes/oauth.py` - 添加 Microsoft 图标映射
- `backend/config.py` - 新增 Microsoft 配置项
- `backend/config.conf` - 添加 Microsoft 配置示例

### 前端
- `frontend/src/pages/login/Login.tsx` - 添加彩色 OAuth 图标
- `frontend/src/pages/oauth/OAuthCallback.tsx` - 修复 provider 识别
- `frontend/src/locales/en-US.ts` - 添加 Microsoft 翻译
- `frontend/src/locales/zh-CN.ts` - 添加 Microsoft 翻译
