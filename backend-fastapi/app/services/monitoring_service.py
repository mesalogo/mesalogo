"""
行动监控服务

提供行动监控仪表盘数据、规则执行日志查询和导出功能
"""
import csv
import io
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

from sqlalchemy import func, desc

from app.extensions import db
from app.models import (
    ActionSpace, ActionTask, RuleSet, Rule, RuleTriggerLog,
    RuleSetRule, User
)
from app.services.user_permission_service import UserPermissionService

logger = logging.getLogger(__name__)


class MonitoringService:

    @staticmethod
    def _filter_query(query, model_class, current_user: Optional[User] = None):
        if current_user:
            return UserPermissionService.filter_viewable_resources(query, model_class, current_user)
        return query

    @staticmethod
    def _format_log(log, rule_name, rule_type, task_name, space_name, rule_set_name):
        """统一格式化一条规则执行日志"""
        return {
            'id': log.id,
            'timestamp': log.created_at.isoformat() if log.created_at else None,
            'passed': log.passed,
            'type': 'success' if log.passed else ('error' if log.passed is False else 'info'),
            'rule_type': rule_type,
            'action_space': space_name or '',
            'rule_set': rule_set_name or '',
            'rule_name': rule_name or '',
            'task_name': task_name or '',
            'message': log.message or '',
            'execution_time': log.execution_time,
            'trigger_type': log.trigger_type,
            'trigger_source': log.trigger_source
        }

    @staticmethod
    def _build_log_query():
        """构建日志查询的基础 query，一次性 join 所有需要的表"""
        return db.session.query(
            RuleTriggerLog,
            Rule.name.label('rule_name'),
            Rule.type.label('rule_type'),
            ActionTask.title.label('task_name'),
            ActionSpace.name.label('space_name'),
            RuleSet.name.label('rule_set_name')
        ).join(
            Rule, RuleTriggerLog.rule_id == Rule.id
        ).outerjoin(
            ActionTask, RuleTriggerLog.action_task_id == ActionTask.id
        ).outerjoin(
            ActionSpace, ActionTask.action_space_id == ActionSpace.id
        ).outerjoin(
            RuleSetRule, RuleSetRule.rule_id == Rule.id
        ).outerjoin(
            RuleSet, RuleSet.id == RuleSetRule.rule_set_id
        )

    @staticmethod
    def get_dashboard_data(current_user: Optional[User] = None) -> Dict[str, Any]:
        """获取监控仪表盘聚合数据"""
        try:
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

            space_query = ActionSpace.query
            space_query = MonitoringService._filter_query(space_query, ActionSpace, current_user)
            active_spaces = space_query.count()

            total_rule_sets = RuleSet.query.count()
            total_executions = RuleTriggerLog.query.count()
            executions_today = RuleTriggerLog.query.filter(RuleTriggerLog.created_at >= today).count()
            passed_executions = RuleTriggerLog.query.filter(RuleTriggerLog.passed == True).count()
            abnormal_executions = RuleTriggerLog.query.filter(RuleTriggerLog.passed == False).count()

            execution_rate = round(passed_executions / total_executions * 100, 1) if total_executions > 0 else 0

            # 大模型 vs 逻辑规则占比
            type_counts = db.session.query(
                Rule.type, func.count(RuleTriggerLog.id)
            ).join(Rule, RuleTriggerLog.rule_id == Rule.id).group_by(Rule.type).all()
            type_map = dict(type_counts)
            llm_percent = round((type_map.get('llm', 0) / total_executions * 100), 1) if total_executions > 0 else 0
            logic_percent = round((type_map.get('logic', 0) / total_executions * 100), 1) if total_executions > 0 else 0

            # 最近异常（10条）
            base_query = MonitoringService._build_log_query()
            abnormals = base_query.filter(
                RuleTriggerLog.passed == False
            ).order_by(desc(RuleTriggerLog.created_at)).limit(10).all()

            recent_abnormals = [
                MonitoringService._format_log(log, rn, rt, tn, sn, rsn)
                for log, rn, rt, tn, sn, rsn in abnormals
            ]

            # 最近执行记录（10条）
            recents = base_query.order_by(desc(RuleTriggerLog.created_at)).limit(10).all()
            recent_logs = [
                MonitoringService._format_log(log, rn, rt, tn, sn, rsn)
                for log, rn, rt, tn, sn, rsn in recents
            ]

            return {
                'active_spaces': active_spaces,
                'total_rule_sets': total_rule_sets,
                'executions_today': executions_today,
                'abnormal_executions': abnormal_executions,
                'total_executions': total_executions,
                'execution_rate': execution_rate,
                'llm_percent': llm_percent,
                'logic_percent': logic_percent,
                'recent_abnormals': recent_abnormals,
                'recent_logs': recent_logs
            }

        except Exception as e:
            logger.error(f"获取监控仪表盘数据失败: {str(e)}")
            return {
                'active_spaces': 0, 'total_rule_sets': 0, 'executions_today': 0,
                'abnormal_executions': 0, 'total_executions': 0, 'execution_rate': 0,
                'llm_percent': 0, 'logic_percent': 0,
                'recent_abnormals': [], 'recent_logs': []
            }

    @staticmethod
    def get_rule_logs(
        page: int = 1,
        per_page: int = 20,
        action_space_id: Optional[str] = None,
        rule_type: Optional[str] = None,
        status: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        """查询规则执行日志，支持分页和过滤"""
        try:
            query = MonitoringService._build_log_query()

            if action_space_id:
                query = query.filter(ActionTask.action_space_id == action_space_id)
            if rule_type and rule_type != 'all':
                query = query.filter(Rule.type == rule_type)
            if status and status != 'all':
                status_map = {'success': True, 'error': False, 'warning': None}
                if status in status_map:
                    val = status_map[status]
                    query = query.filter(RuleTriggerLog.passed == val) if val is not None else query.filter(RuleTriggerLog.passed.is_(None))

            for time_str, op in [(start_time, '>='), (end_time, '<=')]:
                if time_str:
                    try:
                        dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                        if op == '>=':
                            query = query.filter(RuleTriggerLog.created_at >= dt)
                        else:
                            query = query.filter(RuleTriggerLog.created_at <= dt)
                    except ValueError:
                        pass

            query = query.order_by(desc(RuleTriggerLog.created_at))
            total = query.count()
            results = query.offset((page - 1) * per_page).limit(per_page).all()

            logs = [
                MonitoringService._format_log(log, rn, rt, tn, sn, rsn)
                for log, rn, rt, tn, sn, rsn in results
            ]

            return {
                'logs': logs, 'total': total,
                'page': page, 'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page
            }

        except Exception as e:
            logger.error(f"查询规则执行日志失败: {str(e)}")
            return {'logs': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 0}

    @staticmethod
    def export_rule_logs_csv(**filter_kwargs) -> str:
        """导出规则执行日志为 CSV"""
        try:
            result = MonitoringService.get_rule_logs(page=1, per_page=10000, **filter_kwargs)

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['时间', '状态', '规则类型', '行动空间', '规则集', '规则名称', '任务名称', '消息', '执行时间(ms)'])

            for log in result['logs']:
                exec_time = f"{log['execution_time'] * 1000:.2f}" if log['execution_time'] else ''
                writer.writerow([
                    log['timestamp'],
                    '成功' if log['type'] == 'success' else ('失败' if log['type'] == 'error' else '信息'),
                    '大模型' if log['rule_type'] == 'llm' else '逻辑',
                    log['action_space'], log['rule_set'], log['rule_name'],
                    log['task_name'], log['message'], exec_time
                ])

            return output.getvalue()
        except Exception as e:
            logger.error(f"导出规则执行日志失败: {str(e)}")
            return ''

    @staticmethod
    def get_action_spaces_list(current_user: Optional[User] = None) -> List[Dict[str, Any]]:
        """获取行动空间列表（用于过滤下拉框）"""
        try:
            query = ActionSpace.query
            query = MonitoringService._filter_query(query, ActionSpace, current_user)
            return [{'id': s.id, 'name': s.name} for s in query.all()]
        except Exception as e:
            logger.error(f"获取行动空间列表失败: {str(e)}")
            return []
