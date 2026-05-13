"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: subscription.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: subscription.py
# ============================================================

"""
订阅管理API路由
"""
from app.models import SubscriptionPlan, UserSubscription, StripeConfig, PaymentRecord
from app.extensions import db
from app.services.subscription_service import SubscriptionService
from datetime import datetime, timedelta
from sqlalchemy import func



# ==================== 用户接口 ====================

@router.get('/subscription/current')
def get_current_subscription(current_user=Depends(get_current_user)):
    """获取当前用户订阅"""
    subscription = SubscriptionService.get_current_subscription(current_user.id)
    plan = SubscriptionService.get_user_plan(current_user.id)
    
    return {
        'subscription': subscription.to_dict() if subscription else None,
        'plan': plan.to_dict() if plan else None
    }


@router.get('/subscription/plans')
def get_available_plans():
    """获取可用计划列表（仅公开计划）"""
    plans = SubscriptionPlan.query.filter_by(is_active=True, is_public=True).order_by(SubscriptionPlan.sort_order).all()
    return {
        'plans': [p.to_dict() for p in plans]
    }


@router.get('/subscription/usage')
def get_usage(current_user=Depends(get_current_user)):
    """获取当前用量"""
    usage = SubscriptionService.get_usage_with_limits(current_user.id)
    return {
        'usage': usage
    }


@router.post('/subscription/check-quota')
async def check_quota(request: Request, current_user=Depends(get_current_user)):
    """检查配额"""
    data = await request.json() or {}
    
    resource_type = data.get('resource_type')
    increment = data.get('increment', 1)
    
    if not resource_type:
        raise HTTPException(status_code=400, detail={'error': 'resource_type is required'})
    
    result = SubscriptionService.check_quota(current_user.id, resource_type, increment)
    return result


# ==================== 管理员接口 ====================

@router.get('/admin/subscription-plans')
def admin_get_plans():
    """管理员获取所有计划"""
    plans = SubscriptionPlan.query.order_by(SubscriptionPlan.sort_order).all()
    return {
        'plans': [p.to_dict() for p in plans]
    }


@router.post('/admin/subscription-plans')
async def admin_create_plan(request: Request):
    """创建计划"""
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})
    
    name = data.get('name', '').strip()
    display_name = data.get('display_name', '').strip()
    
    if not name or not display_name:
        raise HTTPException(status_code=400, detail={'error': 'name和display_name不能为空'})
    
    if SubscriptionPlan.query.filter_by(name=name).first():
        raise HTTPException(status_code=400, detail={'error': '计划名称已存在'})
    
    plan = SubscriptionPlan(
        name=name,
        display_name=display_name,
        description=data.get('description', ''),
        badge_color=data.get('badge_color', '#666666'),
        price_monthly=data.get('price_monthly', 0),
        price_yearly=data.get('price_yearly', 0),
        currency=data.get('currency', 'CNY'),
        limits=data.get('limits', {}),
        features=data.get('features', {}),
        sort_order=data.get('sort_order', 0),
        is_active=data.get('is_active', True),
        is_default=data.get('is_default', False),
        is_public=data.get('is_public', True)
    )
    
    # 如果设为默认，取消其他默认
    if plan.is_default:
        SubscriptionPlan.query.filter_by(is_default=True).update({'is_default': False})
    
    db.session.add(plan)
    db.session.commit()
    
    return JSONResponse(content={
        'message': '计划创建成功',
        'plan': plan.to_dict()
    }, status_code=201)


@router.put('/admin/subscription-plans/{plan_id}')
async def admin_update_plan(plan_id, request: Request):
    """更新计划"""
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail={'error': '计划不存在'})
    
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})
    
    if 'display_name' in data:
        plan.display_name = data['display_name']
    if 'description' in data:
        plan.description = data['description']
    if 'badge_color' in data:
        plan.badge_color = data['badge_color']
    if 'price_monthly' in data:
        plan.price_monthly = data['price_monthly']
    if 'price_yearly' in data:
        plan.price_yearly = data['price_yearly']
    if 'limits' in data:
        plan.limits = data['limits']
    if 'features' in data:
        plan.features = data['features']
    if 'sort_order' in data:
        plan.sort_order = data['sort_order']
    if 'is_active' in data:
        plan.is_active = data['is_active']
    if 'is_default' in data:
        if data['is_default']:
            SubscriptionPlan.query.filter_by(is_default=True).update({'is_default': False})
        plan.is_default = data['is_default']
    if 'is_public' in data:
        plan.is_public = data['is_public']
    
    db.session.commit()
    
    return {
        'message': '计划更新成功',
        'plan': plan.to_dict()
    }


@router.delete('/admin/subscription-plans/{plan_id}')
def admin_delete_plan(plan_id):
    """删除计划"""
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail={'error': '计划不存在'})
    
    # 检查是否有用户使用此计划
    active_subs = UserSubscription.query.filter_by(plan_id=plan_id, is_current=True).count()
    if active_subs > 0:
        raise HTTPException(status_code=400, detail={'error': f'有 {active_subs} 个用户正在使用此计划，无法删除'})
    
    db.session.delete(plan)
    db.session.commit()
    
    return {'message': '计划删除成功'}


@router.get('/admin/users/{user_id}/subscription')
def admin_get_user_subscription(user_id):
    """获取用户订阅详情"""
    subscription = SubscriptionService.get_current_subscription(user_id)
    plan = SubscriptionService.get_user_plan(user_id)
    usage = SubscriptionService.get_usage_with_limits(user_id)
    
    # 获取订阅历史
    history = UserSubscription.query.filter_by(user_id=user_id).order_by(UserSubscription.created_at.desc()).all()
    
    return {
        'subscription': subscription.to_dict() if subscription else None,
        'plan': plan.to_dict() if plan else None,
        'usage': usage,
        'history': [h.to_dict() for h in history]
    }


@router.put('/admin/users/{user_id}/subscription')
async def admin_update_user_subscription(user_id, request: Request, current_user=Depends(get_current_user)):
    """设置用户订阅"""
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})
    
    plan_id = data.get('plan_id')
    if not plan_id:
        raise HTTPException(status_code=400, detail={'error': 'plan_id不能为空'})
    
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail={'error': '计划不存在'})
    
    expires_at = None
    if data.get('expires_at'):
        expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
    
    subscription = SubscriptionService.update_subscription(
        user_id=user_id,
        plan_id=plan_id,
        expires_at=expires_at,
        source='admin_assign',
        created_by=current_user.id,
        notes=data.get('notes')
    )
    
    return {
        'message': '订阅更新成功',
        'subscription': subscription.to_dict()
    }


@router.post('/admin/users/{user_id}/subscription/extend')
async def admin_extend_subscription(user_id, request: Request):
    """延长用户订阅"""
    data = await request.json() or {}
    
    days = data.get('days', 30)
    
    subscription = SubscriptionService.get_current_subscription(user_id)
    if not subscription:
        raise HTTPException(status_code=400, detail={'error': '用户没有订阅'})
    
    # 计算新的过期时间
    base_time = subscription.expires_at or datetime.utcnow()
    new_expires_at = base_time + timedelta(days=days)
    
    subscription.expires_at = new_expires_at
    subscription.notes = f"{subscription.notes or ''}\n[{datetime.utcnow().strftime('%Y-%m-%d')}] 管理员延长{days}天".strip()
    
    db.session.commit()
    
    return {
        'message': f'订阅已延长{days}天',
        'subscription': subscription.to_dict()
    }


# ==================== 用户支付历史 ====================

@router.get('/subscription/payments')
def get_user_payments(request: Request, current_user=Depends(get_current_user)):
    """获取当前用户的支付历史"""
    page = int(request.query_params.get('page', 1))
    per_page = int(request.query_params.get('per_page', 10))
    
    query = PaymentRecord.query.filter_by(user_id=current_user.id).order_by(PaymentRecord.created_at.desc())
    
    # 手动分页（替代 Flask-SQLAlchemy 的 paginate）
    total = query.count()
    pages = (total + per_page - 1) // per_page
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        'payments': [p.to_dict() for p in items],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': pages
    }


@router.get('/subscription/payments/{payment_id}')
def get_user_payment_detail(payment_id, current_user=Depends(get_current_user)):
    """获取支付详情（仅限自己的记录）"""
    payment = PaymentRecord.query.filter_by(id=payment_id, user_id=current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail={'error': '支付记录不存在'})
    
    return {
        'payment': payment.to_dict()
    }


# ==================== 管理员 Stripe 配置 ====================

@router.get('/admin/stripe/config')
def admin_get_stripe_config(request: Request):
    """获取 Stripe 配置"""
    unmask = request.query_params.get('unmask', 'false').lower() == 'true'
    
    config = StripeConfig.query.first()
    if not config:
        return {
            'config': {
                'enabled': False,
                'mode': 'test',
                'publishable_key': None,
                'secret_key': None,
                'webhook_secret': None,
                'webhook_url': None
            }
        }
    
    return {
        'config': config.to_dict(mask_secrets=not unmask)
    }


@router.put('/admin/stripe/config')
async def admin_update_stripe_config(request: Request):
    """更新 Stripe 配置"""
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})
    
    config = StripeConfig.query.first()
    if not config:
        config = StripeConfig()
        db.session.add(config)
    
    if 'enabled' in data:
        config.enabled = data['enabled']
    if 'mode' in data:
        config.mode = data['mode']
    if 'publishable_key' in data:
        config.publishable_key = data['publishable_key']
    if 'secret_key' in data and data['secret_key']:
        # 只有非脱敏值才更新
        if not data['secret_key'].endswith('****'):
            config.secret_key_encrypted = data['secret_key']
    if 'webhook_secret' in data and data['webhook_secret']:
        if not data['webhook_secret'].endswith('****'):
            config.webhook_secret_encrypted = data['webhook_secret']
    if 'webhook_url' in data:
        config.webhook_url = data['webhook_url'] or None
    
    db.session.commit()
    
    return {
        'message': 'Stripe 配置已更新',
        'config': config.to_dict(mask_secrets=False)
    }


@router.post('/admin/stripe/test')
def admin_test_stripe_connection():
    """测试 Stripe 连接"""
    config = StripeConfig.query.first()
    if not config or not config.secret_key_encrypted:
        return {
            'success': False,
            'message': '请先配置 Stripe Secret Key'
        }
    
    try:
        import stripe
        stripe.api_key = config.secret_key_encrypted
        
        # 尝试获取账户信息来验证连接
        account = stripe.Account.retrieve()
        
        return {
            'success': True,
            'message': '连接成功',
            'account': {
                'id': account.id,
                'business_profile': account.business_profile,
                'country': account.country
            }
        }
    except ImportError:
        return {
            'success': False,
            'message': 'Stripe SDK 未安装，请运行 pip install stripe'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'连接失败: {str(e)}'
        }


# ==================== 管理员支付历史 ====================

@router.get('/admin/payments')
def admin_get_payments(request: Request):
    """获取所有支付记录（管理员）"""
    page = int(request.query_params.get('page', 1))
    per_page = int(request.query_params.get('per_page', 10))
    status = request.query_params.get('status')
    payment_type = request.query_params.get('type')
    user_search = request.query_params.get('search')
    
    # 先标记超时的 pending 记录
    timeout_threshold = datetime.utcnow() - timedelta(hours=1)
    timeout_records = PaymentRecord.query.filter(
        PaymentRecord.status == 'pending',
        PaymentRecord.created_at < timeout_threshold
    ).all()
    
    for record in timeout_records:
        record.status = 'timeout'
        record.failure_reason = '支付超时（1小时未完成）'
    
    if timeout_records:
        db.session.commit()
        logger.info(f'Marked {len(timeout_records)} payment records as timeout')
    
    query = PaymentRecord.query
    
    if status:
        query = query.filter_by(status=status)
    if payment_type:
        query = query.filter_by(type=payment_type)
    if user_search:
        from app.models import User
        query = query.join(User).filter(
            (User.username.ilike(f'%{user_search}%')) | 
            (User.email.ilike(f'%{user_search}%'))
        )
    
    query = query.order_by(PaymentRecord.created_at.desc())
    
    # 手动分页（替代 Flask-SQLAlchemy 的 paginate）
    total = query.count()
    pages = (total + per_page - 1) // per_page
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        'payments': [p.to_dict(include_user=True) for p in items],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': pages
    }


@router.get('/admin/payments/stats')
def admin_get_payment_stats():
    """获取支付统计"""
    # 本月统计
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # 总收入（成功的支付，不含退款）
    total_income = db.session.query(func.sum(PaymentRecord.amount)).filter(
        PaymentRecord.status == 'succeeded',
        PaymentRecord.type != 'refund',
        PaymentRecord.created_at >= month_start
    ).scalar() or 0
    
    # 成功订单数
    success_count = PaymentRecord.query.filter(
        PaymentRecord.status == 'succeeded',
      PaymentRecord.created_at >= month_start
    ).count()
    
    # 失败订单数（包括 failed、timeout、pending 超过1小时的）
    failed_count = PaymentRecord.query.filter(
        PaymentRecord.status.in_(['failed', 'timeout']),
        PaymentRecord.created_at >= month_start
    ).count()
    
    # 退款金额
    refund_amount = db.session.query(func.sum(func.abs(PaymentRecord.amount))).filter(
        PaymentRecord.type == 'refund',
        PaymentRecord.created_at >= month_start
    ).scalar() or 0
    
    return {
        'stats': {
            'period': month_start.strftime('%Y-%m'),
            'total_income': float(total_income),
            'success_count': success_count,
            'failed_count': failed_count,
            'refund_amount': float(refund_amount)
        }
    }


# ==================== Stripe 支付流程 ====================

@router.get('/admin/payments/{payment_id}')
def admin_get_payment_detail(payment_id):
    """获取支付详情（管理员）"""
    payment = PaymentRecord.query.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail={'error': '支付记录不存在'})
    
    return {
        'payment': payment.to_dict(include_user=True)
    }


@router.post('/subscription/create-checkout')
async def create_checkout_session(request: Request, current_user=Depends(get_current_user)):
    """创建 Stripe Checkout 会话"""
    data = await request.json() or {}
    
    plan_id = data.get('plan_id')
    billing_period = data.get('billing_period', 'monthly')  # monthly or yearly
    
    if not plan_id:
        raise HTTPException(status_code=400, detail={'error': 'plan_id 不能为空'})
    
    # 获取计划
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail={'error': '计划不存在'})
    
    if not plan.is_active:
        raise HTTPException(status_code=400, detail={'error': '该计划已停用'})
    
    # 获取 Stripe 配置
    config = StripeConfig.query.first()
    if not config or not config.enabled:
        raise HTTPException(status_code=400, detail={'error': 'Stripe 支付未启用'})
    
    if not config.secret_key_encrypted:
        raise HTTPException(status_code=400, detail={'error': 'Stripe 配置不完整'})
    
    # 计算价格
    if billing_period == 'yearly':
        amount = plan.price_yearly
        period_label = '年'
    else:
        amount = plan.price_monthly
        period_label = '月'
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail={'error': '该计划不支持付费订阅'})
    
    try:
        stripe.api_key = config.secret_key_encrypted
        
        # 获取前端回调 URL
        frontend_url = settings.get('FRONTEND_URL', 'http://localhost:3000')
        
        # 创建 Checkout Session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': plan.currency.lower(),
                    'product_data': {
                        'name': f'{plan.display_name} - {billing_period == "yearly" and "年付" or "月付"}',
                        'description': plan.description or f'{plan.display_name}订阅计划',
                    },
                    'unit_amount': int(amount * 100),  # Stripe 使用分为单位
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/account/subscription?payment=success&session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/account/subscription?payment=cancelled',
            customer_email=current_user.email,
            metadata={
                'user_id': current_user.id,
                'plan_id': plan_id,
                'billing_period': billing_period
            }
        )
        
        # 创建待处理的支付记录
        payment_record = PaymentRecord(
            user_id=current_user.id,
            type='subscription',
            amount=amount,
            currency=plan.currency,
            status='pending',
            stripe_payment_intent_id=checkout_session.payment_intent,
            stripe_checkout_session_id=checkout_session.id,
            plan_id=plan_id,
            metadata_json={'billing_period': billing_period, 'checkout_session_id': checkout_session.id}
        )
        db.session.add(payment_record)
        db.session.commit()
        
        return {
            'checkout_url': checkout_session.url,
            'session_id': checkout_session.id
        }
        
    except ImportError:
        raise HTTPException(status_code=500, detail={'error': 'Stripe SDK 未安装'})
    except stripe.error.StripeError as e:
        logger.error(f'Stripe error: {str(e)}')
        raise HTTPException(status_code=500, detail={'error': f'支付服务错误: {str(e)}'})
    except Exception as e:
        logger.error(f'Create checkout error: {str(e)}')
        raise HTTPException(status_code=500, detail={'error': f'创建支付会话失败: {str(e)}'})


@router.get('/subscription/checkout-status/{session_id}')
def get_checkout_status(session_id):
    """获取 Checkout 会话状态，并在支付成功时更新本地记录"""
    config = StripeConfig.query.first()
    if not config or not config.secret_key_encrypted:
        raise HTTPException(status_code=400, detail={'error': 'Stripe 配置不完整'})
    
    try:
        stripe.api_key = config.secret_key_encrypted
        
        session = stripe.checkout.Session.retrieve(session_id)
        
        # 如果支付成功，主动更新本地记录（作为 Webhook 的备用方案）
        if session.payment_status == 'paid':
            payment_intent_id = session.payment_intent
            
            # 先通过 payment_intent_id 查找，如果没有则通过 checkout_session_id 查找
            payment_record = None
            if payment_intent_id:
                payment_record = PaymentRecord.query.filter_by(
                    stripe_payment_intent_id=payment_intent_id
                ).first()
            
            if not payment_record:
                # 通过 checkout_session_id 查找
                payment_record = PaymentRecord.query.filter_by(
                    stripe_checkout_session_id=session_id
                ).first()
            
            if not payment_record:
                # 通过 metadata_json 中的 checkout_session_id 查找
                payment_record = PaymentRecord.query.filter(
                    PaymentRecord.metadata_json['checkout_session_id'].astext == session_id
                ).first()
            
            if payment_record and payment_record.status == 'pending':
                payment_record.status = 'succeeded'
                # 更新 payment_intent_id（如果之前为空）
                if payment_intent_id and not payment_record.stripe_payment_intent_id:
                    payment_record.stripe_payment_intent_id = payment_intent_id
                db.session.commit()
                logger.info(f'Payment record {payment_record.id} updated to succeeded via checkout status check')
                
                # 同时更新订阅
                metadata = session.metadata or {}
                user_id = metadata.get('user_id')
                plan_id = metadata.get('plan_id')
                billing_period = metadata.get('billing_period', 'monthly')
                
                if user_id and plan_id:
                    if billing_period == 'yearly':
                        expires_at = datetime.utcnow() + timedelta(days=365)
                    else:
                        expires_at = datetime.utcnow() + timedelta(days=30)
                    
                    SubscriptionService.update_subscription(
                        user_id=user_id,
                        plan_id=plan_id,
                        expires_at=expires_at,
                        source='stripe_payment',
                        notes=f'Stripe 支付成功，{billing_period == "yearly" and "年付" or "月付"}'
                    )
                    logger.info(f'Subscription updated for user {user_id} via checkout status check')
        
        return {
            'status': session.payment_status,
            'customer_email': session.customer_email,
            'amount_total': session.amount_total / 100 if session.amount_total else 0,
            'currency': session.currency
        }
        
    except Exception as e:
        logger.error(f'Get checkout status error: {str(e)}')
        raise HTTPException(status_code=500, detail={'error': str(e)})


@router.post('/webhooks/stripe')
async def stripe_webhook(request: Request):
    """处理 Stripe Webhook 回调"""
    payload = (await request.body()).decode('utf-8')
    sig_header = request.headers.get('Stripe-Signature')
    
    config = StripeConfig.query.first()
    if not config:
        logger.error('Stripe config not found')
        raise HTTPException(status_code=400, detail={'error': 'Stripe not configured'})
    
    try:
        stripe.api_key = config.secret_key_encrypted
        
        # 验证 Webhook 签名
        if config.webhook_secret_encrypted and sig_header:
            try:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, config.webhook_secret_encrypted
                )
            except stripe.error.SignatureVerificationError as e:
                logger.error(f'Webhook signature verification failed: {str(e)}')
                raise HTTPException(status_code=400, detail={'error': 'Invalid signature'})
        else:
            # 没有配置 webhook secret，直接解析
            import json
            event = json.loads(payload)
        
        event_type = event.get('type') if isinstance(event, dict) else event.type
        event_data = event.get('data', {}).get('object', {}) if isinstance(event, dict) else event.data.object
        
        logger.info(f'Received Stripe webhook: {event_type}')
        
        # 处理不同的事件类型
        if event_type == 'checkout.session.completed':
            handle_checkout_completed(event_data)
        elif event_type == 'payment_intent.succeeded':
            handle_payment_succeeded(event_data)
        elif event_type == 'payment_intent.payment_failed':
            handle_payment_failed(event_data)
        
        return {'received': True}
        
    except ImportError:
        raise HTTPException(status_code=500, detail={'error': 'Stripe SDK not installed'})
    except Exception as e:
        logger.error(f'Webhook error: {str(e)}')
        raise HTTPException(status_code=500, detail={'error': str(e)})


def handle_checkout_completed(session):
    """处理 Checkout 完成事件"""
    try:
        metadata = session.get('metadata', {}) if isinstance(session, dict) else session.metadata
        user_id = metadata.get('user_id')
        plan_id = metadata.get('plan_id')
        billing_period = metadata.get('billing_period', 'monthly')
        
        if not user_id or not plan_id:
            logger.error('Missing user_id or plan_id in checkout session metadata')
            return
        
        # 获取 session id 和 payment_intent_id
        session_id = session.get('id') if isinstance(session, dict) else session.id
        payment_intent_id = session.get('payment_intent') if isinstance(session, dict) else session.payment_intent
        
        # 查找支付记录：先通过 checkout_session_id，再通过 payment_intent_id
        payment_record = None
        if session_id:
            payment_record = PaymentRecord.query.filter_by(stripe_checkout_session_id=session_id).first()
        
        if not payment_record and payment_intent_id:
            payment_record = PaymentRecord.query.filter_by(stripe_payment_intent_id=payment_intent_id).first()
        
        if payment_record and payment_record.status == 'pending':
            payment_record.status = 'succeeded'
            # 更新 payment_intent_id（如果之前为空）
            if payment_intent_id and not payment_record.stripe_payment_intent_id:
                payment_record.stripe_payment_intent_id = payment_intent_id
            db.session.commit()
            logger.info(f'Payment record {payment_record.id} updated to succeeded via webhook')
        
        # 计算订阅到期时间
        if billing_period == 'yearly':
            expires_at = datetime.utcnow() + timedelta(days=365)
        else:
            expires_at = datetime.utcnow() + timedelta(days=30)
        
        # 更新用户订阅
        SubscriptionService.update_subscription(
            user_id=user_id,
            plan_id=plan_id,
            expires_at=expires_at,
            source='stripe_webhook',
            notes=f'Stripe Webhook 支付成功，{billing_period == "yearly" and "年付" or "月付"}'
        )
        
        logger.info(f'Subscription updated for user {user_id}, plan {plan_id} via webhook')
        
    except Exception as e:
        logger.error(f'Error handling checkout completed: {str(e)}')


def handle_payment_succeeded(payment_intent):
    """处理支付成功事件"""
    try:
        payment_intent_id = payment_intent.get('id') if isinstance(payment_intent, dict) else payment_intent.id
        
        payment_record = PaymentRecord.query.filter_by(stripe_payment_intent_id=payment_intent_id).first()
        if payment_record and payment_record.status != 'succeeded':
            payment_record.status = 'succeeded'
            db.session.commit()
            logger.info(f'Payment record {payment_record.id} marked as succeeded')
            
    except Exception as e:
        logger.error(f'Error handling payment succeeded: {str(e)}')


def handle_payment_failed(payment_intent):
    """处理支付失败事件"""
    try:
        payment_intent_id = payment_intent.get('id') if isinstance(payment_intent, dict) else payment_intent.id
        
        payment_record = PaymentRecord.query.filter_by(stripe_payment_intent_id=payment_intent_id).first()
        if payment_record:
            payment_record.status = 'failed'
            # 获取失败原因
            last_error = payment_intent.get('last_payment_error', {}) if isinstance(payment_intent, dict) else payment_intent.last_payment_error
            if last_error:
                payment_record.failure_reason = last_error.get('message') if isinstance(last_error, dict) else last_error.message
            db.session.commit()
            logger.info(f'Payment record {payment_record.id} marked as failed')
            
    except Exception as e:
        logger.error(f'Error handling payment failed: {str(e)}')


@router.get('/subscription/publishable-key')
def get_publishable_key():
    """获取 Stripe Publishable Key（前端使用）"""
    config = StripeConfig.query.first()
    if not config or not config.enabled:
        raise HTTPException(status_code=400, detail={'error': 'Stripe 支付未启用'})
    
    return {
        'publishable_key': config.publishable_key
    }

