# 外部用户系统集成方案

## 概述

整合外部用户认证系统，支持 OAuth 2.0 社交登录和企业级 SSO。

## 优先级排序（KISS 原则）

| 优先级 | 系统 | 复杂度 | 价值 | 建议 |
|--------|------|--------|------|------|
| P0 | OAuth 2.0 (Google/Apple) | 低 | 高 | **先做** |
| P1 | AWS Cognito | 中 | 高 | 企业客户需要时做 |
| P2 | LDAP/AD | 高 | 中 | 企业私有化部署时做 |
| P3 | SAML 2.0 | 高 | 低 | 大企业需要时做 |

**建议：先只做 OAuth 2.0，其他按需实现。**

---

## Phase 1: OAuth 2.0 社交登录（优先实现）

详见 [PLAN.md](./PLAN.md)

### 支持的提供商

| 提供商 | 状态 | 说明 |
|--------|------|------|
| Google | 待实现 | 最常用 |
| Apple | 待实现 | iOS 用户需要 |
| AWS Cognito | 待实现 | 企业 SSO 入口 |

### 数据模型

```python
class OAuthAccount(BaseMixin, db.Model):
    __tablename__ = 'oauth_accounts'
    
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    provider = Column(String(50), nullable=False)  # google, apple, cognito
    provider_user_id = Column(String(255), nullable=False)
    email = Column(String(255))
    avatar_url = Column(String(500))
    
    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='uq_oauth_provider_user'),
    )
```

### 前端改动

1. **登录页** - 添加 OAuth 登录按钮
2. **用户设置页** - 显示已绑定的 OAuth 账户，支持绑定/解绑
3. **用户管理页** - 显示用户的登录方式（密码/OAuth）

---

## Phase 2: AWS Cognito 企业 SSO（按需实现）

### 使用场景

- 企业客户已有 Cognito User Pool
- 需要对接企业 SAML/OIDC IdP（通过 Cognito 代理）

### 实现方式

Cognito 本质上也是 OAuth 2.0，复用 Phase 1 的代码：

```python
class CognitoOAuthProvider(OAuthProvider):
    def __init__(self, domain: str, client_id: str, client_secret: str, redirect_uri: str):
        self.authorize_url = f"https://{domain}/oauth2/authorize"
        self.token_url = f"https://{domain}/oauth2/token"
        self.userinfo_url = f"https://{domain}/oauth2/userInfo"
        # ... 其他配置
```

---

## Phase 3: LDAP/AD（私有化部署时实现）

### 使用场景

- 企业私有化部署
- 需要对接企业 Active Directory

### 技术方案

```python
# 使用 python-ldap 库
import ldap

class LDAPAuthProvider:
    def __init__(self, server: str, base_dn: str, bind_dn: str, bind_password: str):
        self.server = server
        self.base_dn = base_dn
        # ...
    
    def authenticate(self, username: str, password: str) -> dict:
        """LDAP 认证"""
        conn = ldap.initialize(self.server)
        user_dn = f"uid={username},{self.base_dn}"
        conn.simple_bind_s(user_dn, password)
        # 获取用户信息
        result = conn.search_s(user_dn, ldap.SCOPE_BASE)
        return self._parse_user_info(result)
```

### 数据模型扩展

```python
# User 表添加字段
class UseaseMixin, db.Model):
    # ... 现有字段
    auth_source = Column(String(50), default='local')  # local, oauth, ldap
    external_id = Column(String(255))  # LDAP DN 或其他外部 ID
```

---

## Phase 4: SAML 2.0（大企业需要时实现）

### 使用场景

- 大型企业要求 SAML SSO
- 需要对接 Okta、Azure AD 等 IdP

### 技术方案

```python
# 使用 python3-saml 库
from onelogin.saml2.auth import OneLogin_Saml2_Auth

class SAMLAuthProvider:
    def __init__(self, settings: dict):
        self.settings = settings
    
    def get_login_url(self, request) -> str:
        auth = OneLogin_Saml2_Auth(request, self.settings)
        return auth.login()
    
    def process_response(self, request) -> dict:
        auth = OneLogin_Saml2_Auth(request, self.settings)
        auth.process_response()
        return {
            'name_id': auth.get_nameid(),
            'attributes': auth.get_attributes()
        }
```

---

## 前端用户管理页改动

### ExternalUserSystems.tsx 更新

```tsx
const externalSystems = [
  {
    id: 'oauth2',
    name: 'OAuth 2.0 (Google/Apple)',
    status: 'active',  // 改为 active
    // ...
  },
  {
    id: 'cognito',
    name: 'AWS Cognito',
    status: 'planned',
  / ...
  },
  // ...
];
```

### 新增：OAuth 配置管理界面

管理员可以配置 OAuth 提供商：

```tsx
// OAuthProviderConfig.tsx
interface OAuthProviderConfig {
  provider: 'google' | 'apple' | 'cognito';
  enabled: boolean;
  client_id: string;
  client_secret: string;  // 加密存储
  // cognito 特有
  domain?: string;
  user_pool_id?: string;
}
```

---

## 实现计划

### 第一阶段（1-2周）
- [x] OAuth PLAN 设计完成
- [ ] 实现 `oauth_accounts` 表
- [ ] 实现 Google OAuth 登录
- [ ] 前端登录页添加 OAuth 按钮
- [ ] 用户设置页显示已绑定账户

### 第二阶段（按需）
- [ ] 实现 Apple OAuth
- [ ] 实现 AWS Cognito OAuth
- [ ] 管理员 OAuth 配置界面

### 第三阶段（私有化部署时）
- [ ] LDAP/AD 集成
- [ ] SAML 2.0 集成

---

## 权限模型

所有外部用户统一使用现有权限系统：

```
外部用户登录
    ↓
创建/关联 User 记录 (is_admin=False)
    ↓
权限判断使用 is_admin 字段：
  - is_admin=True  → 超级管理员
  - is_admin=False → 普通用户
```

管理员可以手动将外部用户提升为管理员。

---

## 安全考虑

1. **OAuth state 参数** - 防止 CSRF 攻击
2. **HTTPS** - 所有认证流量必须加密
3. **Token 不存储** - OAuth access_token 用完即弃
4. **邮箱验证** - 可选要求 OAuth 邮箱已验证
