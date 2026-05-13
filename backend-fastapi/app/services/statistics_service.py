"""
系统统计服务

提供系统概览统计数据，包括任务数量、角色数量、行动空间数量等
支持按用户权限过滤，只统计用户可见的资源
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from app.models import (
    ActionTask, Role, ActionSpace, Agent, Message, Conversation,
    RuleSet, Knowledge, Capability, User, ActionTaskAgent, ActionSpaceRole,
    AutonomousTask, AutonomousTaskExecution
)
from app.extensions import db
from app.services.user_permission_service import UserPermissionService
from sqlalchemy import func, or_

logger = logging.getLogger(__name__)

class StatisticsService:
    """系统统计服务类"""

    @staticmethod
    def _filter_query(query, model_class, current_user: Optional[User] = None):
        """
        根据用户权限过滤查询
        
        Args:
            query: SQLAlchemy 查询对象
            model_class: 模型类
            current_user: 当前用户，如果为None则返回全部数据
            
        Returns:
            过滤后的查询对象
        """
        if current_user:
            return UserPermissionService.filter_viewable_resources(query, model_class, current_user)
        return query

    @staticmethod
    def get_system_overview(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取系统概览统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 包含各种统计数据的字典
        """
        try:
            # 获取行动任务总数（按用户过滤）
            task_query = ActionTask.query
            task_query = StatisticsService._filter_query(task_query, ActionTask, current_user)
            total_tasks = task_query.count()

            # 获取进行中的任务数量（状态为running或active）
            active_task_query = ActionTask.query.filter(
                ActionTask.status.in_(['running', 'active'])
            )
            active_task_query = StatisticsService._filter_query(active_task_query, ActionTask, current_user)
            active_tasks = active_task_query.count()

            # 获取角色总数（按用户过滤）
            role_query = Role.query
            role_query = StatisticsService._filter_query(role_query, Role, current_user)
            total_roles = role_query.count()

            # 获取行动空间总数（按用户过滤）
            space_query = ActionSpace.query
            space_query = StatisticsService._filter_query(space_query, ActionSpace, current_user)
            total_action_spaces = space_query.count()

            # 获取智能体总数（通过用户可见的任务关联）
            if current_user and not current_user.is_admin:
                # 获取用户可见任务的ID列表
                visible_task_ids = [t.id for t in task_query.all()]
                if visible_task_ids:
                    total_agents = Agent.query.filter(
                        Agent.action_task_id.in_(visible_task_ids)
                    ).count()
                    active_agents = Agent.query.filter(
                        Agent.action_task_id.in_(visible_task_ids),
                        Agent.status.in_(['active', 'running'])
                    ).count()
                else:
                    total_agents = 0
                    active_agents = 0
            else:
                total_agents = Agent.query.count()
                active_agents = Agent.query.filter(
                    Agent.status.in_(['active', 'running'])
                ).count()

            # 构建返回数据
            statistics = {
                'total_tasks': total_tasks,
                'active_tasks': active_tasks,
                'total_roles': total_roles,
                'total_action_spaces': total_action_spaces,
                'total_agents': total_agents,
                'active_agents': active_agents,
                'last_updated': datetime.now().isoformat()
            }

            logger.info(f"成功获取系统概览统计数据: {statistics}")
            return statistics

        except Exception as e:
            logger.error(f"获取系统概览统计数据失败: {str(e)}")
            # 返回默认数据，避免前端报错
            return {
                'total_tasks': 0,
                'active_tasks': 0,
                'total_roles': 0,
                'total_action_spaces': 0,
                'total_agents': 0,
                'active_agents': 0,
                'last_updated': datetime.now().isoformat()
            }

    @staticmethod
    def get_task_statistics(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取任务相关的详细统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 任务统计数据
        """
        try:
            from datetime import timedelta
            
            # 基础查询（按用户过滤）
            base_query = ActionTask.query
            base_query = StatisticsService._filter_query(base_query, ActionTask, current_user)
            
            # 按状态统计任务数量
            if current_user and not current_user.is_admin:
                # 获取用户可见任务的ID列表
                visible_task_ids = [t.id for t in base_query.all()]
                if visible_task_ids:
                    task_stats = db.session.query(
                        ActionTask.status,
                        func.count(ActionTask.id).label('count')
                    ).filter(ActionTask.id.in_(visible_task_ids)).group_by(ActionTask.status).all()
                else:
                    task_stats = []
            else:
                task_stats = db.session.query(
                    ActionTask.status,
                    func.count(ActionTask.id).label('count')
                ).group_by(ActionTask.status).all()

            # 转换为字典格式
            status_counts = {stat.status: stat.count for stat in task_stats}

            # 获取最近创建的任务数量（最近7天）
            recent_date = datetime.now() - timedelta(days=7)
            recent_query = ActionTask.query.filter(ActionTask.created_at >= recent_date)
            recent_query = StatisticsService._filter_query(recent_query, ActionTask, current_user)
            recent_tasks = recent_query.count()

            return {
                'status_counts': status_counts,
                'recent_tasks': recent_tasks,
                'total_tasks': sum(status_counts.values())
            }

        except Exception as e:
            logger.error(f"获取任务统计数据失败: {str(e)}")
            return {
                'status_counts': {},
                'recent_tasks': 0,
                'total_tasks': 0
            }

    @staticmethod
    def get_role_statistics(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取角色相关的详细统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 角色统计数据
        """
        try:
            from datetime import timedelta
            
            # 获取角色总数（按用户过滤）
            role_query = Role.query
            role_query = StatisticsService._filter_query(role_query, Role, current_user)
            total_roles = role_query.count()

            # 获取最近创建的角色数量（最近7天）
            recent_date = datetime.now() - timedelta(days=7)
            recent_query = Role.query.filter(Role.created_at >= recent_date)
            recent_query = StatisticsService._filter_query(recent_query, Role, current_user)
            recent_roles = recent_query.count()

            # 获取最常用的角色（按关联的智能体数量排序，按用户过滤）
            if current_user and not current_user.is_admin:
                visible_role_ids = [r.id for r in role_query.all()]
                if visible_role_ids:
                    most_used_roles = db.session.query(
                        Role.id,
                        Role.name,
                        func.count(Agent.id).label('usage_count')
                    ).outerjoin(Agent).filter(Role.id.in_(visible_role_ids)).group_by(Role.id).order_by(
                        func.count(Agent.id).desc()
                    ).limit(5).all()
                else:
                    most_used_roles = []
            else:
                most_used_roles = db.session.query(
                    Role.id,
                    Role.name,
                    func.count(Agent.id).label('usage_count')
                ).outerjoin(Agent).group_by(Role.id).order_by(
                    func.count(Agent.id).desc()
                ).limit(5).all()

            most_used_data = []
            for role in most_used_roles:
                most_used_data.append({
                    'id': role.id,
                    'name': role.name,
                    'usage_count': role.usage_count or 0
             })

            return {
                'total_roles': total_roles,
                'recent_roles': recent_roles,
                'most_used_roles': most_used_data
            }

        except Exception as e:
            logger.error(f"获取角色统计数据失败: {str(e)}")
            return {
                'total_roles': 0,
                'recent_roles': 0,
                'most_used_roles': []
            }

    @staticmethod
    def get_action_space_statistics(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取行动空间相关的详细统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 行动空间统计数据
        """
        try:
            from datetime import timedelta
            
            # 获取行动空间总数（按用户过滤）
            space_query = ActionSpace.query
            space_query = StatisticsService._filter_query(space_query, ActionSpace, current_user)
            total_spaces = space_query.count()

            # 获取最近创建的行动空间数量（最近7天）
            recent_date = datetime.now() - timedelta(days=7)
            recent_query = ActionSpace.query.filter(ActionSpace.created_at >= recent_date)
            recent_query = StatisticsService._filter_query(recent_query, ActionSpace, current_user)
            recent_spaces = recent_query.count()

            return {
                'total_action_spaces': total_spaces,
                'recent_action_spaces': recent_spaces
            }

        except Exception as e:
            logger.error(f"获取行动空间统计数据失败: {str(e)}")
            return {
                'total_action_spaces': 0,
                'recent_action_spaces': 0
            }

    @staticmethod
    def get_activity_trends(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取活动趋势统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 活动趋势统计数据
        """
        try:
            from datetime import timedelta
            now = datetime.now()
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_ago = today - timedelta(days=7)

            # 今日新增任务（按用户过滤）
            today_query = ActionTask.query.filter(ActionTask.created_at >= today)
            today_query = StatisticsService._filter_query(today_query, ActionTask, current_user)
            today_tasks = today_query.count()

            # 本周完成任务（按用户过滤）
            week_query = ActionTask.query.filter(
                ActionTask.status == 'completed',
                ActionTask.updated_at >= week_ago
            )
            week_query = StatisticsService._filter_query(week_query, ActionTask, current_user)
            week_completed_tasks = week_query.count()

            # 计算平均任务持续时间（已完成的任务，按用户过滤）
            completed_query = ActionTask.query.filter(
                ActionTask.status == 'completed',
                ActionTask.created_at.isnot(None),
                ActionTask.updated_at.isnot(None)
            )
            completed_query = StatisticsService._filter_query(completed_query, ActionTask, current_user)
            completed_tasks = completed_query.all()

            avg_duration_hours = 0
            if completed_tasks:
                total_duration = sum([
                    (task.updated_at - task.created_at).total_seconds() / 3600
                    for task in completed_tasks
                    if task.updated_at and task.created_at
                ])
                avg_duration_hours = round(total_duration / len(completed_tasks), 2)

            # 获取用户可见任务ID列表（用于消息过滤）
            visible_task_ids = None
            if current_user and not current_user.is_admin:
                task_query = ActionTask.query
                task_query = StatisticsService._filter_query(task_query, ActionTask, current_user)
                visible_task_ids = [t.id for t in task_query.all()]

            # 最近7天任务创建趋势和消息趋势
            daily_trends = []
            for i in range(7):
                day_start = today - timedelta(days=i)
                day_end = day_start + timedelta(days=1)

                # 统计当天创建的任务数量（按用户过滤）
                day_task_query = ActionTask.query.filter(
                    ActionTask.created_at >= day_start,
                    ActionTask.created_at < day_end
                )
                day_task_query = StatisticsService._filter_query(day_task_query, ActionTask, current_user)
                day_task_count = day_task_query.count()

                # 统计当天的消息数量（按用户可见任务过滤）
                if visible_task_ids is not None:
                    if visible_task_ids:
                        day_message_count = Message.query.filter(
                            Message.created_at >= day_start,
                            Message.created_at < day_end,
                            Message.action_task_id.in_(visible_task_ids)
                        ).count()
                    else:
                        day_message_count = 0
                else:
                    day_message_count = Message.query.filter(
                        Message.created_at >= day_start,
                        Message.created_at < day_end
                    ).count()

                daily_trends.append({
                    'date': day_start.strftime('%m-%d'),
                    'task_count': day_task_count,
                    'message_count': day_message_count
                })

            return {
                'today_new_tasks': today_tasks,
                'week_completed_tasks': week_completed_tasks,
                'avg_task_duration_hours': avg_duration_hours,
                'daily_trends': list(reversed(daily_trends))
            }

        except Exception as e:
            logger.error(f"获取活动趋势统计数据失败: {str(e)}")
            return {
                'today_new_tasks': 0,
                'week_completed_tasks': 0,
                'avg_task_duration_hours': 0,
                'daily_trends': []
            }

    @staticmethod
    def get_interaction_statistics(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取交互活动统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 交互统计数据
        """
        try:
            from datetime import timedelta
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

            # 获取用户可见任务ID列表（用于消息过滤）
            visible_task_ids = None
            if current_user and not current_user.is_admin:
                task_query = ActionTask.query
                task_query = StatisticsService._filter_query(task_query, ActionTask, current_user)
                visible_task_ids = [t.id for t in task_query.all()]

            # 总消息数量（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    total_messages = Message.query.filter(Message.action_task_id.in_(visible_task_ids)).count()
                else:
                    total_messages = 0
            else:
                total_messages = Message.query.count()

            # 今日消息数量（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    today_messages = Message.query.filter(
                        Message.created_at >= today,
                        Message.action_task_id.in_(visible_task_ids)
                    ).count()
                else:
                    today_messages = 0
            else:
                today_messages = Message.query.filter(
                    Message.created_at >= today
                ).count()

            # 计算平均每任务消息数（按用户过滤）
            avg_messages_per_task = 0
            task_query = ActionTask.query
            task_query = StatisticsService._filter_query(task_query, ActionTask, current_user)
            total_tasks = task_query.count()
            if total_tasks > 0:
                avg_messages_per_task = round(total_messages / total_tasks, 1)

            # 工具调用次数（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    tool_calls = Message.query.filter(
                        Message.action_task_id.in_(visible_task_ids),
                        or_(
                            Message.content.like('%toolResult%'),
                            Message.content.like('%tool_call_id%'),
                            Message.content.like('%tool_name%'),
                            Message.raw_message.like('%toolResult%'),
                            Message.raw_message.like('%tool_call_id%'),
                            Message.raw_message.like('%tool_name%')
                        )
                    ).count()
                else:
                    tool_calls = 0
            else:
                tool_calls = Message.query.filter(
                    or_(
                        Message.content.like('%toolResult%'),
                        Message.content.like('%tool_call_id%'),
                        Message.content.like('%tool_name%'),
                        Message.raw_message.like('%toolResult%'),
                        Message.raw_message.like('%tool_call_id%'),
                        Message.raw_message.like('%tool_name%')
                    )
                ).count()

            # 活跃会话数量（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    active_conversations = Conversation.query.filter(
                        Conversation.status == 'active',
                        Conversation.action_task_id.in_(visible_task_ids)
                    ).count()
                else:
                    active_conversations = 0
            else:
                active_conversations = Conversation.query.filter(
                    Conversation.status == 'active'
                ).count()

            # 智能体消息数量（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    agent_messages = Message.query.filter(
                        Message.role == 'agent',
                        Message.action_task_id.in_(visible_task_ids)
                    ).count()
                else:
                    agent_messages = 0
            else:
                agent_messages = Message.query.filter(
                    Message.role == 'agent'
                ).count()

            # 用户消息数量（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    human_messages = Message.query.filter(
                        Message.role == 'human',
                        Message.action_task_id.in_(visible_task_ids)
                    ).count()
                else:
                    human_messages = 0
            else:
                human_messages = Message.query.filter(
                    Message.role == 'human'
                ).count()

            return {
                'total_messages': total_messages,
                'today_messages': today_messages,
                'avg_messages_per_task': avg_messages_per_task,
                'tool_calls_count': tool_calls,
                'active_conversations': active_conversations,
                'agent_messages': agent_messages,
                'human_messages': human_messages
            }

        except Exception as e:
            logger.error(f"获取交互统计数据失败: {str(e)}")
            return {
                'total_messages': 0,
                'today_messages': 0,
                'avg_messages_per_task': 0,
                'tool_calls_count': 0,
                'active_conversations': 0,
                'agent_messages': 0,
                'human_messages': 0
            }

    @staticmethod
    def get_ecosystem_statistics(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取智能体生态统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 生态统计数据
        """
        try:
            # 获取用户可见任务ID列表（用于智能体过滤）
            visible_task_ids = None
            if current_user and not current_user.is_admin:
                task_query = ActionTask.query
                task_query = StatisticsService._filter_query(task_query, ActionTask, current_user)
                visible_task_ids = [t.id for t in task_query.all()]

            # 智能体状态分布（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    agent_status_stats = db.session.query(
                        Agent.status,
                        func.count(Agent.id).label('count')
                    ).filter(Agent.action_task_id.in_(visible_task_ids)).group_by(Agent.status).all()
                else:
                    agent_status_stats = []
            else:
                agent_status_stats = db.session.query(
                    Agent.status,
                    func.count(Agent.id).label('count')
                ).group_by(Agent.status).all()

            agent_status_distribution = {stat.status: stat.count for stat in agent_status_stats}

            # 获取用户可见角色（按用户过滤）
            role_query = Role.query
            role_query = StatisticsService._filter_query(role_query, Role, current_user)
            
            # 最常用角色TOP5（按用户过滤）
            if current_user and not current_user.is_admin:
                visible_role_ids = [r.id for r in role_query.all()]
                if visible_role_ids:
                    top_roles = db.session.query(
                        Role.id,
                        Role.name,
                        func.count(Agent.id).label('usage_count')
                    ).outerjoin(Agent).filter(Role.id.in_(visible_role_ids)).group_by(Role.id).order_by(
                        func.count(Agent.id).desc()
                    ).limit(5).all()
                else:
                    top_roles = []
            else:
                top_roles = db.session.query(
                    Role.id,
                    Role.name,
                    func.count(Agent.id).label('usage_count')
                ).outerjoin(Agent).group_by(Role.id).order_by(
                    func.count(Agent.id).desc()
                ).limit(5).all()

            top_roles_data = []
            for role in top_roles:
                top_roles_data.append({
                    'id': role.id,
                    'name': role.name,
                    'usage_count': role.usage_count or 0
                })

            # 角色使用率统计（按用户过滤）
            total_roles = role_query.count()
            if current_user and not current_user.is_admin:
                if visible_role_ids:
                    used_roles = db.session.query(Role.id).join(Agent).filter(Role.id.in_(visible_role_ids)).distinct().count()
                else:
                    used_roles = 0
            else:
                used_roles = db.session.query(Role.id).join(Agent).distinct().count()
            role_usage_rate = round((used_roles / total_roles * 100), 1) if total_roles > 0 else 0

            # 任务中智能体分布（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    task_agent_stats = db.session.query(
                        func.count(Agent.id).label('agent_count'),
                        ActionTask.id
                    ).join(ActionTask).filter(ActionTask.id.in_(visible_task_ids)).group_by(ActionTask.id).all()
                else:
                    task_agent_stats = []
            else:
                task_agent_stats = db.session.query(
                    func.count(Agent.id).label('agent_count'),
                    ActionTask.id
                ).join(ActionTask).group_by(ActionTask.id).all()

            avg_agents_per_task = 0
            if task_agent_stats:
                total_agents_in_tasks = sum([stat.agent_count for stat in task_agent_stats])
                avg_agents_per_task = round(total_agents_in_tasks / len(task_agent_stats), 1)

            return {
                'agent_status_distribution': agent_status_distribution,
                'top_roles': top_roles_data,
                'role_usage_rate': role_usage_rate,
                'avg_agents_per_task': avg_agents_per_task,
                'total_used_roles': used_roles,
                'total_available_roles': total_roles
            }

        except Exception as e:
            logger.error(f"获取生态统计数据失败: {str(e)}")
            return {
                'agent_status_distribution': {},
                'top_roles': [],
                'role_usage_rate': 0,
                'avg_agents_per_task': 0,
                'total_used_roles': 0,
                'total_available_roles': 0
            }

    @staticmethod
    def get_system_resources(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取系统资源统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 系统资源统计数据
        """
        try:
            # 知识库数量
            total_knowledge = Knowledge.query.count()

            # 规则集数量
            total_rule_sets = RuleSet.query.count()

            # 能力数量
            total_capabilities = Capability.query.count()

            # 行动空间资源分布（按用户过滤）
            space_query = ActionSpace.query
            space_query = StatisticsService._filter_query(space_query, ActionSpace, current_user)
            total_spaces = space_query.count()

            # 统计配置了角色的行动空间数量（按用户过滤）
            visible_space_ids = None
            if current_user and not current_user.is_admin:
                visible_space_ids = [s.id for s in space_query.all()]
                if visible_space_ids:
                    spaces_with_roles = db.session.query(
                        ActionSpaceRole.action_space_id
                    ).filter(ActionSpaceRole.action_space_id.in_(visible_space_ids)).distinct().count()
                else:
                    spaces_with_roles = 0
            else:
                spaces_with_roles = db.session.query(
                    ActionSpaceRole.action_space_id
                ).distinct().count()

            # 统计配置了规则的行动空间数量（按用户过滤）
            try:
                from app.models import ActionSpaceRuleSet
                if current_user and not current_user.is_admin:
                    if visible_space_ids:
                        spaces_with_rules = db.session.query(
                            ActionSpaceRuleSet.action_space_id
                        ).filter(ActionSpaceRuleSet.action_space_id.in_(visible_space_ids)).distinct().count()
                    else:
                        spaces_with_rules = 0
                else:
                    spaces_with_rules = db.session.query(
                        ActionSpaceRuleSet.action_space_id
                    ).distinct().count()
            except:
                spaces_with_rules = 0

            # 平均每个行动空间的角色数（按用户过滤）
            avg_roles_per_space = 0
            if total_spaces > 0:
                if current_user and not current_user.is_admin:
                    if visible_space_ids:
                        total_space_roles = ActionSpaceRole.query.filter(
                            ActionSpaceRole.action_space_id.in_(visible_space_ids)
                        ).count()
                    else:
                        total_space_roles = 0
                else:
                    total_space_roles = ActionSpaceRole.query.count()
                avg_roles_per_space = round(total_space_roles / total_spaces, 1)

            return {
                'total_knowledge': total_knowledge,
                'total_rule_sets': total_rule_sets,
                'total_capabilities': total_capabilities,
                'spaces_with_roles': spaces_with_roles,
                'spaces_with_rules': spaces_with_rules,
                'avg_roles_per_space': avg_roles_per_space,
                'total_action_spaces': total_spaces
            }

        except Exception as e:
            logger.error(f"获取系统资源统计数据失败: {str(e)}")
            return {
                'total_knowledge': 0,
                'total_rule_sets': 0,
                'total_capabilities': 0,
                'spaces_with_roles': 0,
                'spaces_with_rules': 0,
                'avg_roles_per_space': 0,
                'total_action_spaces': 0
            }

    @staticmethod
    def get_user_statistics(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取用户活动统计数据

        Args:
            current_user: 当前用户，用于权限过滤（管理员可见所有用户统计）

        Returns:
            Dict[str, Any]: 用户统计数据
        """
        try:
            from datetime import timedelta
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            week_ago = today - timedelta(days=7)

            # 总用户数（仅管理员可见全部）
            if current_user and current_user.is_admin:
                total_users = User.query.count()
            else:
                total_users = 1  # 非管理员只能看到自己

            # 活跃用户数（最近7天有创建任务或发送消息的用户）
            if current_user and current_user.is_admin:
                active_users_tasks = db.session.query(User.id).join(ActionTask).filter(
                    ActionTask.created_at >= week_ago
                ).distinct()

                active_users_messages = db.session.query(User.id).join(Message).filter(
                    Message.created_at >= week_ago,
                    Message.user_id.isnot(None)
                ).distinct()

                active_users = active_users_tasks.union(active_users_messages).count()
            else:
                active_users = 1 if current_user else 0

            # 用户创建任务分布（仅管理员可见）
            top_users = []
            if current_user and current_user.is_admin:
                user_task_stats = db.session.query(
                    User.id,
                    User.username,
                    func.count(ActionTask.id).label('task_count')
                ).outerjoin(ActionTask).group_by(User.id, User.username).order_by(
                    func.count(ActionTask.id).desc()
                ).limit(5).all()

                for user_stat in user_task_stats:
                    top_users.append({
                        'id': user_stat.id,
                        'username': user_stat.username,
                        'task_count': user_stat.task_count or 0
                    })

            # 平均每用户任务数
            avg_tasks_per_user = 0
            if current_user and current_user.is_admin:
                if total_users > 0:
                    total_tasks = ActionTask.query.count()
                    avg_tasks_per_user = round(total_tasks / total_users, 1)
            else:
                # 非管理员只统计自己的任务
                task_query = ActionTask.query
                task_query = StatisticsService._filter_query(task_query, ActionTask, current_user)
                avg_tasks_per_user = task_query.count()

            # 今日活跃用户
            if current_user and current_user.is_admin:
                today_active_tasks = db.session.query(User.id).join(ActionTask).filter(
                    ActionTask.created_at >= today
                ).distinct()

                today_active_messages = db.session.query(User.id).join(Message).filter(
                    Message.created_at >= today,
                    Message.user_id.isnot(None)
                ).distinct()

                today_active_users = today_active_tasks.union(today_active_messages).count()
            else:
                today_active_users = 1 if current_user else 0

            return {
                'total_users': total_users,
                'active_users': active_users,
                'today_active_users': today_active_users,
                'avg_tasks_per_user': avg_tasks_per_user,
                'top_users': top_users
            }

        except Exception as e:
            logger.error(f"获取用户统计数据失败: {str(e)}")
            return {
                'total_users': 0,
                'active_users': 0,
                'today_active_users': 0,
                'avg_tasks_per_user': 0,
                'top_users': []
            }

    @staticmethod
    def get_autonomous_task_statistics(current_user: Optional[User] = None) -> Dict[str, Any]:
        """
        获取自主行动任务统计数据

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            Dict[str, Any]: 自主行动任务统计数据
        """
        try:
            from datetime import timedelta
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            week_ago = today - timedelta(days=7)

            # 自主任务总数（按用户过滤）
            task_query = AutonomousTask.query
            if current_user and not current_user.is_admin:
                task_query = task_query.filter(AutonomousTask.user_id == current_user.id)
            total_autonomous_tasks = task_query.count()

            # 获取用户可见的自主任务ID列表
            visible_task_ids = None
            if current_user and not current_user.is_admin:
                visible_task_ids = [t.id for t in task_query.all()]

            # 按状态统计自主任务（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    autonomous_status_stats = db.session.query(
                        AutonomousTask.status,
                        func.count(AutonomousTask.id).label('count')
                    ).filter(AutonomousTask.id.in_(visible_task_ids)).group_by(AutonomousTask.status).all()
                else:
                    autonomous_status_stats = []
            else:
                autonomous_status_stats = db.session.query(
                    AutonomousTask.status,
                    func.count(AutonomousTask.id).label('count')
                ).group_by(AutonomousTask.status).all()

            autonomous_status_distribution = {stat.status: stat.count for stat in autonomous_status_stats}

            # 按类型统计自主任务（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    autonomous_type_stats = db.session.query(
                        AutonomousTask.type,
                        func.count(AutonomousTask.id).label('count')
                    ).filter(AutonomousTask.id.in_(visible_task_ids)).group_by(AutonomousTask.type).all()
                else:
                    autonomous_type_stats = []
            else:
                autonomous_type_stats = db.session.query(
                    AutonomousTask.type,
                    func.count(AutonomousTask.id).label('count')
                ).group_by(AutonomousTask.type).all()

            autonomous_type_distribution = {stat.type: stat.count for stat in autonomous_type_stats}

            # 活跃的自主任务数量（按用户过滤）
            active_query = AutonomousTask.query.filter(AutonomousTask.status == 'active')
            if current_user and not current_user.is_admin:
                active_query = active_query.filter(AutonomousTask.user_id == current_user.id)
            active_autonomous_tasks = active_query.count()

            # 今日创建的自主任务数量（按用户过滤）
            today_query = AutonomousTask.query.filter(AutonomousTask.created_at >= today)
            if current_user and not current_user.is_admin:
                today_query = today_query.filter(AutonomousTask.user_id == current_user.id)
            today_autonomous_tasks = today_query.count()

            # 本周创建的自主任务数量（按用户过滤）
            week_query = AutonomousTask.query.filter(AutonomousTask.created_at >= week_ago)
            if current_user and not current_user.is_admin:
                week_query = week_query.filter(AutonomousTask.user_id == current_user.id)
            week_autonomous_tasks = week_query.count()

            # 自主任务执行统计（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    total_executions = AutonomousTaskExecution.query.filter(
                        AutonomousTaskExecution.autonomous_task_id.in_(visible_task_ids)
                    ).count()
                else:
                    total_executions = 0
            else:
                total_executions = AutonomousTaskExecution.query.count()

            # 按执行状态统计（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    execution_status_stats = db.session.query(
                        AutonomousTaskExecution.status,
                        func.count(AutonomousTaskExecution.id).label('count')
                    ).filter(AutonomousTaskExecution.autonomous_task_id.in_(visible_task_ids)).group_by(AutonomousTaskExecution.status).all()
                else:
                    execution_status_stats = []
            else:
                execution_status_stats = db.session.query(
                    AutonomousTaskExecution.status,
                    func.count(AutonomousTaskExecution.id).label('count')
                ).group_by(AutonomousTaskExecution.status).all()

            execution_status_distribution = {stat.status: stat.count for stat in execution_status_stats}

            # 今日执行次数（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    today_executions = AutonomousTaskExecution.query.filter(
                        AutonomousTaskExecution.created_at >= today,
                        AutonomousTaskExecution.autonomous_task_id.in_(visible_task_ids)
                    ).count()
                else:
                    today_executions = 0
            else:
                today_executions = AutonomousTaskExecution.query.filter(
                    AutonomousTaskExecution.created_at >= today
                ).count()

            # 成功执行率（按用户过滤）
            if visible_task_ids is not None:
                if visible_task_ids:
                    successful_executions = AutonomousTaskExecution.query.filter(
                        AutonomousTaskExecution.status == 'completed',
                        AutonomousTaskExecution.autonomous_task_id.in_(visible_task_ids)
                    ).count()
                else:
                    successful_executions = 0
            else:
                successful_executions = AutonomousTaskExecution.query.filter(
                    AutonomousTaskExecution.status == 'completed'
                ).count()

            success_rate = 0
            if total_executions > 0:
                success_rate = round((successful_executions / total_executions) * 100, 1)

            # 平均执行时长（分钟，按用户过滤）
            avg_execution_duration = 0
            if visible_task_ids is not None:
                if visible_task_ids:
                    completed_executions = AutonomousTaskExecution.query.filter(
                        AutonomousTaskExecution.status == 'completed',
                        AutonomousTaskExecution.start_time.isnot(None),
                        AutonomousTaskExecution.end_time.isnot(None),
                        AutonomousTaskExecution.autonomous_task_id.in_(visible_task_ids)
                    ).all()
                else:
                    completed_executions = []
            else:
                completed_executions = AutonomousTaskExecution.query.filter(
                    AutonomousTaskExecution.status == 'completed',
                    AutonomousTaskExecution.start_time.isnot(None),
                    AutonomousTaskExecution.end_time.isnot(None)
                ).all()

            if completed_executions:
                total_duration = 0
                for execution in completed_executions:
                    if execution.start_time and execution.end_time:
                        duration = (execution.end_time - execution.start_time).total_seconds() / 60
                        total_duration += duration
                avg_execution_duration = round(total_duration / len(completed_executions), 1)

            return {
                'total_autonomous_tasks': total_autonomous_tasks,
                'active_autonomous_tasks': active_autonomous_tasks,
                'today_autonomous_tasks': today_autonomous_tasks,
                'week_autonomous_tasks': week_autonomous_tasks,
                'autonomous_status_distribution': autonomous_status_distribution,
                'autonomous_type_distribution': autonomous_type_distribution,
                'total_executions': total_executions,
                'today_executions': today_executions,
                'execution_status_distribution': execution_status_distribution,
                'success_rate': success_rate,
                'avg_execution_duration': avg_execution_duration
            }

        except Exception as e:
            logger.error(f"获取自主行动任务统计数据失败: {str(e)}")
            return {
                'total_autonomous_tasks': 0,
                'active_autonomous_tasks': 0,
                'today_autonomous_tasks': 0,
                'week_autonomous_tasks': 0,
                'autonomous_status_distribution': {},
                'autonomous_type_distribution': {},
                'total_executions': 0,
                'today_executions': 0,
                'execution_status_distribution': {},
                'success_rate': 0,
                'avg_execution_duration': 0
            }
