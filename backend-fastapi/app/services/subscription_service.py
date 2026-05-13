"""订阅服务 - 配额检查和用量统计"""
from datetime import datetime
from typing import Optional
from app.models import SubscriptionPlan, UserSubscription, UsageRecord, User
from app.extensions import db
from app.utils.datetime_utils import get_current_time_with_timezone

# 存量资源类型（检查实际数量）
STOCK_RESOURCES = ['tasks', 'agents', 'spaces', 'knowledge_bases']
# 增量资源类型（检查周期用量）
FLOW_RESOURCES = ['daily_conversations', 'monthly_tokens', 'storage_mb']


class SubscriptionService:
    """订阅服务"""
    
    @staticmethod
    def get_current_subscription(user_id: str) -> Optional[UserSubscription]:
        """获取用户当前订阅"""
        return UserSubscription.query.filter_by(
            user_id=user_id, 
            is_current=True
        ).first()
    
    @staticmethod
    def get_user_plan(user_id: str) -> Optional[SubscriptionPlan]:
        """获取用户当前计划"""
        sub = SubscriptionService.get_current_subscription(user_id)
        if sub and sub.plan:
            return sub.plan
        # 返回默认计划
        return SubscriptionPlan.query.filter_by(is_default=True, is_active=True).first()
    
    @staticmethod
    def get_plan_limit(user_id: str, limit_key: str) -> Optional[int]:
        """获取用户计划的某项限额"""
        plan = SubscriptionService.get_user_plan(user_id)
        if plan and plan.limits:
            return plan.limits.get(limit_key)
        return None
    
    @staticmethod
    def has_feature(user_id: str, feature_name: str) -> bool:
        """检查用户是否有某功能权限"""
        plan = SubscriptionService.get_user_plan(user_id)
        if plan and plan.features:
            return plan.features.get(feature_name, False)
        return False
    
    @staticmethod
    def get_current_period() -> str:
        """获取当前统计周期 (月)"""
        now = get_current_time_with_timezone()
        return now.strftime('%Y-%m')
    
    @staticmethod
    def get_current_day() -> str:
        """获取当前日期"""
        now = get_current_time_with_timezone()
        return now.strftime('%Y-%m-%d')
    
    @staticmethod
    def get_usage(user_id: str, resource_type: str, period: str = None) -> int:
        """获取用户某资源的用量"""
        if period is None:
            period = SubscriptionService.get_current_period()
        
        record = UsageRecord.query.filter_by(
            scope='user',
            scope_id=user_id,
            period=period,
            resource_type=resource_type
        ).first()
        
        return record.usage_count if record else 0
    
    @staticmethod
    def increment_usage(user_id: str, resource_type: str, increment: int = 1, period: str = None, period_type: str = 'monthly') -> int:
        """增加用量，返回新用量"""
        if period is None:
            period = SubscriptionService.get_current_period() if period_type == 'monthly' else SubscriptionService.get_current_day()
        
        record = UsageRecord.query.filter_by(
            scope='user',
            scope_id=user_id,
            period=period,
            resource_type=resource_type
        ).first()
        
        if record:
            record.usage_count += increment
        else:
            record = UsageRecord(
                scope='user',
                scope_id=user_id,
                period=period,
                period_type=period_type,
                resource_type=resource_type,
                usage_count=increment
            )
            db.session.add(record)
        
        db.session.commit()
        return record.usage_count
    
    @staticmethod
    def check_quota(user_id: str, resource_type: str, increment: int = 1) -> dict:
        """
        检查是否超出配额
        - 存量资源（tasks/agents/spaces/knowledge_bases）：检查实际数量
        - 增量资源（daily_conversations/monthly_tokens/storage_mb）：检查周期用量
        返回: {
            'allowed': bool,
            'current': int,
            'limit': int or None,
            'remaining': int or None
        }
        """
        # 管理员跳过配额检查
        user = User.query.get(user_id)
        if user and user.is_admin:
            return {
                'allowed': True,
                'current': 0,
                'limit': None,
                'remaining': None
            }
        
        # 资源类型到限额key的映射
        limit_key_map = {
            'tasks': 'max_tasks',
            'agents': 'max_agents',
            'spaces': 'max_spaces',
            'knowledge_bases': 'max_knowledge_bases',
            'storage_mb': 'max_storage_mb',
            'daily_conversations': 'max_daily_conversations',
            'monthly_tokens': 'max_monthly_tokens'
        }
        
        limit_key = limit_key_map.get(resource_type, f'max_{resource_type}')
        limit = SubscriptionService.get_plan_limit(user_id, limit_key)
        
        # 根据资源类型获取当前用量
        if resource_type in STOCK_RESOURCES:
            # 存量资源：查询实际数量
            current = SubscriptionService._get_stock_count(user_id, resource_type)
        else:
            # 增量资源：查询周期用量
            if resource_type == 'daily_conversations':
                period = SubscriptionService.get_current_day()
            else:
                period = SubscriptionService.get_current_period()
            current = SubscriptionService.get_usage(user_id, resource_type, period)
        
        result = {
            'allowed': True,
            'current': current,
            'limit': limit,
            'remaining': None
        }
        
        # -1 表示无限制
        if limit is not None and limit != -1:
            result['remaining'] = max(0, limit - current)
            result['allowed'] = (current + increment) <= limit
        
        return result
    
    @staticmethod
    def _get_stock_count(user_id: str, resource_type: str) -> int:
        """获取存量资源的实际数量"""
        from app.models import ActionTask, Agent, ActionSpace, Knowledge
        
        if resource_type == 'tasks':
            return ActionTask.query.filter_by(user_id=user_id).count()
        elif resource_type == 'agents':
            # Agent 通过 action_task 级联到 user，统计用户任务下的所有智能体
            return Agent.query.join(ActionTask).filter(ActionTask.user_id == user_id).count()
        elif resource_type == 'spaces':
            return ActionSpace.query.filter_by(created_by=user_id).count()
        elif resource_type == 'knowledge_bases':
            return Knowledge.query.filter_by(created_by=user_id).count()
        return 0
    
    @staticmethod
    def get_remaining_quota(user_id: str, resource_type: str) -> Optional[int]:
        """获取剩余配额"""
        result = SubscriptionService.check_quota(user_id, resource_type, 0)
        return result['remaining']
    
    @staticmethod
    def assign_default_plan(user_id: str, created_by: str = None) -> Optional[UserSubscription]:
        """为用户分配默认计划"""
        # 检查是否已有订阅
        existing = SubscriptionService.get_current_subscription(user_id)
        if existing:
            return existing
        
        default_plan = SubscriptionPlan.query.filter_by(is_default=True, is_active=True).first()
        if not default_plan:
            return None
        
        subscription = UserSubscription(
            user_id=user_id,
            plan_id=default_plan.id,
            status='active',
            is_current=True,
            source='system_default',
            created_by=created_by
        )
        db.session.add(subscription)
        db.session.commit()
        return subscription
    
    @staticmethod
    def update_subscription(user_id: str, plan_id: str, expires_at: datetime = None, 
                           source: str = 'admin_assign', created_by: str = None, 
                           notes: str = None) -> UserSubscription:
        """更新用户订阅"""
        # 将当前订阅设为非当前
        current = SubscriptionService.get_current_subscription(user_id)
        if current:
            current.is_current = False
            current.status = 'expired'
        
        # 创建新订阅
        subscription = UserSubscription(
            user_id=user_id,
            plan_id=plan_id,
            status='active',
            is_current=True,
            expires_at=expires_at,
            source=source,
            created_by=created_by,
            notes=notes
        )
        db.session.add(subscription)
        db.session.commit()
        return subscription
    
    @staticmethod
    def get_all_usage(user_id: str, period: str = None) -> dict:
        """获取用户所有资源用量"""
        if period is None:
            period = SubscriptionService.get_current_period()
        
        records = UsageRecord.query.filter_by(
            scope='user',
            scope_id=user_id,
            period=period
        ).all()
        
        return {r.resource_type: r.usage_count for r in records}
    
    @staticmethod
    def get_usage_with_limits(user_id: str) -> list:
        """获取用户用量和限额对比"""
        plan = SubscriptionService.get_user_plan(user_id)
        limits = plan.limits if plan else {}
        
        # 月度用量（增量资源）
        monthly_usage = SubscriptionService.get_all_usage(user_id)
        # 日用量（增量资源）
        daily_usage = SubscriptionService.get_all_usage(user_id, SubscriptionService.get_current_day())
        
        result = []
        resource_configs = [
            ('tasks', 'max_tasks', '行动任务', 'stock'),
            ('agents', 'max_agents', '智能体', 'stock'),
            ('spaces', 'max_spaces', '行动空间', 'stock'),
            ('knowledge_bases', 'max_knowledge_bases', '知识库', 'stock'),
            ('storage_mb', 'max_storage_mb', '存储空间(MB)', 'monthly'),
            ('daily_conversations', 'max_daily_conversations', '今日对话', 'daily'),
            ('monthly_tokens', 'max_monthly_tokens', '本月Token', 'monthly'),
        ]
        
        for resource_type, limit_key, display_name, period_type in resource_configs:
            # 根据资源类型获取用量
            if period_type == 'stock':
                usage = SubscriptionService._get_stock_count(user_id, resource_type)
            elif period_type == 'daily':
                usage = daily_usage.get(resource_type, 0)
            else:
                usage = monthly_usage.get(resource_type, 0)
            
            limit = limits.get(limit_key)
            
            result.append({
                'resource_type': resource_type,
                'display_name': display_name,
                'usage': usage,
                'limit': limit,
                'remaining': max(0, limit - usage) if limit and limit > 0 else None,
                'percentage': round(usage / limit * 100, 1) if limit and limit > 0 else 0
            })
        
        return result
