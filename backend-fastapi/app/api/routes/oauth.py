"""
OAuth API路由

处理 OAuth 社交登录相关的API请求
"""
import logging
import jwt
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from core.config import settings
from core.dependencies import get_current_user
from app.models import User, OAuthAccount, db
from app.services.oauth_service import OAuthService

logger = logging.getLogger(__name__)

router = APIRouter()


def _html_response(html_content: str) -> HTMLResponse:
    """返回 HTML 响应（替代 Flask 的 return html, 200, {'Content-Type': 'text/html'}）"""
    return HTMLResponse(content=html_content, status_code=200)


def _desktop_redirect_html(redirect_url: str, title: str = '登录成功', message: str = '正在返回应用...') -> str:
    """生成桌面应用重定向 HTML"""
    return f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }}
        .container {{ text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; margin-bottom: 16px; }}
        p {{ color: #666; }}
        a {{ color: #1890ff; text-decoration: none; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{title}</h1>
        <p>{message}</p>
        <p>如果没有自动跳转，请 <a href="{redirect_url}">点击这里</a></p>
    </div>
    <script>
        window.location.href = "{redirect_url}";
    </script>
</body>
</html>'''


def _desktop_error_html(error_url: str, message: str = '认证失败，正在返回应用...') -> str:
    """生成桌面应用错误 HTML"""
    return f'<html><body><script>window.location.href = "{error_url}";</script><p>{message}</p></body></html>'


@router.get('/oauth/providers')
def get_providers():
    """获取可用的 OAuth 提供商列表"""
    providers = OAuthService.get_available_providers()
    provider_info = []
    for p in providers:
        info = {
            'id': p,
            'name': p.capitalize(),
            'enabled': True
        }
        if p == 'google':
            info['name'] = 'Google'
            info['icon'] = 'google'
        elif p == 'microsoft':
            info['name'] = 'Microsoft'
            info['icon'] = 'microsoft'
        elif p == 'apple':
            info['name'] = 'Apple'
            info['icon'] = 'apple'
        elif p == 'aws_cognito':
            info['name'] = 'AWS Cognito'
            info['icon'] = 'cloud'
        provider_info.append(info)
    
    return {
        'status': 'success',
        'providers': provider_info
    }


@router.get('/oauth/{provider}/authorize')
def oauth_authorize(provider: str, request: Request):
    """获取 OAuth 授权 URL"""
    try:
        oauth_provider = OAuthService.get_provider(provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'status': 'error', 'message': str(e)})
    
    # 检查是否是桌面应用请求
    is_desktop = request.query_params.get('is_desktop', 'false').lower() == 'true'
    
    if is_desktop:
        # 桌面应用使用后端回调地址
        redirect_uri = settings.get('OAUTH_DESKTOP_REDIRECT_URI', 'http://localhost:8080/api/oauth/callback/desktop')
    else:
        # Web 应用使用前端传递的地址
        redirect_uri = request.query_params.get('redirect_uri', '/')
    
    state = OAuthService.generate_state(provider, redirect_uri, is_desktop=is_desktop)
    auth_url = oauth_provider.get_authorization_url(state, redirect_uri=redirect_uri)
    
    return {
        'status': 'success',
        'auth_url': auth_url
    }


@router.api_route('/oauth/{provider}/callback', methods=['GET', 'POST'])
async def oauth_callback(provider: str, request: Request):
    """OAuth 回调处理（支持 GET 和 POST）"""
    if request.method == 'POST':
        data = await request.json() or {}
        code = data.get('code')
        state = data.get('state')
        error = data.get('error')
    else:
        code = request.query_params.get('code')
        state = request.query_params.get('state')
        error = request.query_params.get('error')
    
    if error:
        raise HTTPException(status_code=400, detail={'status': 'error', 'message': error})
    
    if not code or not state:
        raise HTTPException(status_code=400, detail={'status': 'error', 'message': 'Missing code or state'})
    
    state_data = OAuthService.validate_state(state)
    if not state_data:
        raise HTTPException(status_code=400, detail={'status': 'error', 'message': 'Invalid or expired state'})
    
    # 获取存储的 redirect_uri，用于 token 交换
    stored_redirect_uri = state_data.get('redirect_uri', '/')
    is_desktop = state_data.get('is_desktop', False)
    desktop_scheme = settings.get('OAUTH_DESKTOP_SCHEME', 'mesalogo')
    
    try:
        oauth_provider = OAuthService.get_provider(provider)
        token = oauth_provider.fetch_token(code, redirect_uri=stored_redirect_uri)
        user_info = oauth_provider.get_user_info(token)
        user, is_new = find_or_create_oauth_user(user_info)
        jwt_token = generate_jwt_token(user)
        
        # 桌面应用：返回 HTML 页面，自动重定向到 mesalogo://
        if is_desktop:
            redirect_url = f"{desktop_scheme}://oauth/callback?token={jwt_token}&is_new_user={str(is_new).lower()}"
            return _html_response(_desktop_redirect_html(redirect_url))
        
        # Web 应用：返回 JSON
        from app.services.user_permission_service import UserPermissionService
        user_roles = UserPermissionService.get_user_roles(user)
        
        return {
            'status': 'success',
            'token': jwt_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_admin': user.is_admin,
                'is_active': user.is_active,
                'display_name': user.display_name,
                'roles': user_roles
            },
            'is_new_user': is_new
        }
        
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        if is_desktop:
            error_url = f"{desktop_scheme}://oauth/callback?error=authentication_failed"
            return _html_response(_desktop_error_html(error_url))
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': 'OAuth authentication failed'})


@router.get('/oauth/callback/desktop')
def oauth_callback_desktop(request: Request):
    """桌面应用 OAuth 回调处理（通用入口）"""
    code = request.query_params.get('code')
    state = request.query_params.get('state')
    error = request.query_params.get('error')
    desktop_scheme = settings.get('OAUTH_DESKTOP_SCHEME', 'mesalogo')
    
    if error:
        error_url = f"{desktop_scheme}://oauth/callback?error={error}"
        return _html_response(_desktop_error_html(error_url))
    
    if not code or not state:
        error_url = f"{desktop_scheme}://oauth/callback?error=missing_code_or_state"
        return _html_response(_desktop_error_html(error_url, '参数缺失，正在返回应用...'))
    
    state_data = OAuthService.validate_state(state)
    if not state_data:
        error_url = f"{desktop_scheme}://oauth/callback?error=invalid_state"
        return _html_response(_desktop_error_html(error_url, '状态无效，正在返回应用...'))
    
    provider = state_data.get('provider')
    stored_redirect_uri = state_data.get('redirect_uri', '/')
    
    try:
        oauth_provider = OAuthService.get_provider(provider)
        token = oauth_provider.fetch_token(code, redirect_uri=stored_redirect_uri)
        user_info = oauth_provider.get_user_info(token)
        user, is_new = find_or_create_oauth_user(user_info)
        jwt_token = generate_jwt_token(user)
        
        redirect_url = f"{desktop_scheme}://oauth/callback?token={jwt_token}&is_new_user={str(is_new).lower()}"
        return _html_response(_desktop_redirect_html(redirect_url))
        
    except Exception as e:
        logger.error(f"OAuth desktop callback error: {e}")
        error_url = f"{desktop_scheme}://oauth/callback?error=authentication_failed"
        return _html_response(_desktop_error_html(error_url))


@router.get('/oauth/accounts')
def get_linked_accounts(current_user=Depends(get_current_user)):
    """获取当前用户已绑定的 OAuth 账户"""
    accounts = OAuthAccount.query.filter_by(user_id=current_user.id).all()
    return {
        'status': 'success',
        'accounts': [acc.to_dict() for acc in accounts]
    }


@router.delete('/oauth/{provider}/unlink')
def unlink_account(provider: str, current_user=Depends(get_current_user)):
    """解绑 OAuth 账户"""
    account = OAuthAccount.query.filter_by(user_id=current_user.id, provider=provider).first()
    if not account:
        raise HTTPException(status_code=404, detail={'status': 'error', 'message': f'未找到 {provider} 账户绑定'})
    
    if not current_user.password_hash:
        other_accounts = OAuthAccount.query.filter(
            OAuthAccount.user_id == current_user.id,
            OAuthAccount.provider != provider
        ).count()
        if other_accounts == 0:
            raise HTTPException(status_code=400, detail={
                'status': 'error',
                'message': '无法解绑唯一的登录方式，请先设置密码'
            })
    
    db.session.delete(account)
    db.session.commit()
    
    return {
        'status': 'success',
        'message': f'已解绑 {provider} 账户'
    }


def find_or_create_oauth_user(user_info: dict) -> tuple:
    """查找或创建 OAuth 用户"""
    from app.models import UserRole, UserRoleAssignment
    
    provider = user_info['provider']
    provider_user_id = user_info['provider_user_id']
    
    oauth_account = OAuthAccount.query.filter_by(
        provider=provider,
        provider_user_id=provider_user_id
    ).first()
    
    if oauth_account:
        oauth_account.avatar_url = user_info.get('avatar_url')
        oauth_account.email = user_info.get('email')
        db.session.commit()
        return oauth_account.user, False
    
    email = user_info.get('email')
    user = User.query.filter_by(email=email).first() if email else None
    
    is_new = False
    if not user:
        username = generate_unique_username(user_info)
        user = User(
            username=username,
            email=email,
            is_active=True,
            is_admin=False,
            profile={
                'display_name': user_info.get('name', username),
                'avatar_url': user_info.get('avatar_url')
            }
        )
        db.session.add(user)
        db.session.flush()
        is_new = True
        
        # 为新用户分配默认的普通用户角色
        regular_role = UserRole.query.filter_by(name='regular_user').first()
        if regular_role:
            role_assignment = UserRoleAssignment(
                user_id=user.id,
                user_role_id=regular_role.id
            )
            db.session.add(role_assignment)
        
        # 为新用户分配默认订阅计划
        from app.services.subscription_service import SubscriptionService
        SubscriptionService.assign_default_plan(user.id)
    
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


def generate_jwt_token(user: User) -> str:
    """生成 JWT 令牌"""
    token_expiry = datetime.datetime.utcnow() + datetime.timedelta(days=1)
    token_payload = {
        'user_id': user.id,
        'username': user.username,
        'exp': token_expiry
    }
    token = jwt.encode(
        token_payload,
        settings['SECRET_KEY'],
        algorithm='HS256'
    )
    return token
