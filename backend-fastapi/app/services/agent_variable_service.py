from typing import List, Dict, Any, Optional, Union
from app.models import AgentVariable, Agent
from app.extensions import db
import json
from datetime import datetime

class AgentVariableService:
    """代理变量服务，用于管理代理的专有变量"""

    @staticmethod
    def create_variable(agent_id: int, name: str, value: Any, is_public: bool = True, label: str = None) -> AgentVariable:
        """创建一个新的代理变量

        Args:
            agent_id: 代理ID
            name: 变量名称
            value: 变量值
            is_public: 是否对其他代理公开
            label: 变量标签，用于前端显示，如果未提供则使用名称

        Returns:
            新创建的代理变量实例
        """
        # 检查代理是否存在
        agent = Agent.query.get(agent_id)
        if not agent:
            raise ValueError(f"代理ID {agent_id} 不存在")

        # 检查变量名是否已存在
        existing = AgentVariable.query.filter_by(agent_id=agent_id, name=name).first()
        if existing:
            raise ValueError(f"变量名 {name} 已存在于代理 {agent_id}")

        # 转换值为字符串存储
        str_value = str(value)

        # 如果未提供标签，则使用名称作为标签
        if label is None:
            # 将下划线替换为空格，并将单词首字母大写，以生成默认标签
            label = name.replace('_', ' ').title()

        # 创建变量
        variable = AgentVariable(
            agent_id=agent_id,
            name=name,
            label=label,
            value=str_value,
            is_public=is_public,
            history=[{"timestamp": datetime.utcnow().isoformat(), "value": str_value}]
        )

        db.session.add(variable)
        db.session.commit()

        return variable

    @staticmethod
    def get_variable(agent_id: int, name: str) -> Optional[AgentVariable]:
        """获取代理变量"""
        return AgentVariable.query.filter_by(agent_id=agent_id, name=name).first()

    @staticmethod
    def get_variable_value(agent_id: int, name: str, default=None) -> Any:
        """获取代理变量值，直接返回字符串值"""
        var = AgentVariableService.get_variable(agent_id, name)
        if not var:
            return default

        return var.value

    @staticmethod
    def get_agent_variables(agent_id: int, include_private: bool = False) -> List[AgentVariable]:
        """获取代理的所有变量"""
        query = AgentVariable.query.filter_by(agent_id=agent_id)
        if not include_private:
            query = query.filter_by(is_public=True)
        return query.all()

    @staticmethod
    def update_variable(agent_id: int, name: str, value: Any) -> AgentVariable:
        """更新代理变量值，并记录历史记录"""
        variable = AgentVariableService.get_variable(agent_id, name)
        if not variable:
            raise ValueError(f"变量名 {name} 不存在于代理 {agent_id}")

        # 转换值为字符串存储
        str_value = str(value)

        # 更新历史记录
        history = variable.history or []
        history.append({"timestamp": datetime.utcnow().isoformat(), "value": str_value})

        # 更新值
        variable.value = str_value
        variable.history = history
        variable.updated_at = datetime.utcnow()

        # 更新关联的行动任务的updated_at时间
        from app.models import ActionTaskAgent, ActionTask
        from app.utils.datetime_utils import get_current_time_with_timezone

        # 查找智能体参与的行动任务
        task_agents = ActionTaskAgent.query.filter_by(agent_id=agent_id).all()
        for task_agent in task_agents:
            action_task = ActionTask.query.get(task_agent.action_task_id)
            if action_task:
                action_task.updated_at = get_current_time_with_timezone()

        db.session.commit()

        return variable

    @staticmethod
    def delete_variable(agent_id: int, name: str) -> bool:
        """删除代理变量"""
        variable = AgentVariableService.get_variable(agent_id, name)
        if not variable:
            return False

        db.session.delete(variable)
        db.session.commit()

        return True

    # 由于只保留text类型，不再需要类型转换方法