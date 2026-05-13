"""
触发器函数模块

提供各种触发条件的等待和评估函数（函数式，非类继承）

触发类型：
- manual: 立即执行，不等待
- time: 等待指定时间间隔
- variable: 等待变量满足条件
"""

import asyncio
import logging
from typing import Dict, Any, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .scheduler import Task

logger = logging.getLogger(__name__)


async def wait_for_trigger(task: 'Task') -> None:
    """
    根据 trigger_type 等待触发
    
    这是触发器的入口函数，根据配置分发到具体的等待函数
    """
    trigger_type = task.trigger_type
    
    if trigger_type == "manual":
        # 立即执行，不等待
        pass
    
    elif trigger_type == "time":
        await wait_for_time_trigger(task)
    
    elif trigger_type == "variable":
        await wait_for_variable_trigger(task)
    
    else:
        logger.warning(f"Unknown trigger type: {trigger_type}, treating as manual")


async def wait_for_time_trigger(task: 'Task') -> None:
    """
    等待时间触发
    
    trigger_config:
        interval_minutes: 时间间隔（分钟）
        interval_seconds: 时间间隔（秒），优先级高于interval_minutes
    """
    cfg = task.trigger_config or {}
    
    # 优先使用秒，否则用分钟转换
    interval = cfg.get("interval_seconds")
    if interval is None:
        interval = cfg.get("interval_minutes", 1) * 60
    
    # 第一轮不等待
    if task.current_round == 0:
        return
    
    logger.debug(f"Task {task.id} waiting {interval}s for next trigger")
    
    # 使用可取消的sleep
    try:
        # 分段sleep，以便响应取消
        remaining = interval
        while remaining > 0 and not task.cancel_event.is_set():
            sleep_time = min(remaining, 1.0)
            await asyncio.sleep(sleep_time)
            remaining -= sleep_time
    except asyncio.CancelledError:
        raise


async def wait_for_variable_trigger(task: 'Task') -> None:
    """
    等待变量触发条件
    
    trigger_config:
        conditions: 触发条件列表
        logic: 条件逻辑 "and" | "or"
        check_interval: 检查间隔（秒），默认1秒
    """
    cfg = task.trigger_config or {}
    conditions = cfg.get("conditions", [])
    logic = cfg.get("logic", "or")
    check_interval = cfg.get("check_interval", 1)
    
    if not conditions:
        logger.warning(f"Task {task.id} has no trigger conditions, executing immediately")
        return
    
    # 第一轮不等待（或根据配置决定）
    if task.current_round == 0 and not cfg.get("wait_first_trigger", False):
        return
    
    logger.debug(f"Task {task.id} waiting for variable trigger conditions")
    
    while not task.cancel_event.is_set():
        if _check_trigger_conditions(task, conditions, logic):
            logger.info(f"Task {task.id} trigger conditions met")
            return
        await asyncio.sleep(check_interval)


def _check_trigger_conditions(task: 'Task', conditions: List[Dict], logic: str) -> bool:
    """
    检查触发条件
    
    条件格式:
    {
        "variable_name": "xxx",
        "variable_type": "environment" | "agent",  # 变量来源
        "operator": "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "changed",
        "value": xxx
    }
    """
    if not conditions:
        return True
    
    results = [_evaluate_single_condition(task, cond) for cond in conditions]
    
    if logic == "and":
        return all(results)
    else:  # or
        return any(results)


def _evaluate_single_condition(task: 'Task', condition: Dict) -> bool:
    """
    评估单个条件
    
    兼容两种格式：
    1. 新格式: variable_name, variable_type, operator (==, !=, >, <)
    2. 原格式: variable, type, operator (equals, not_equals, greater_than, less_than, contains, not_contains)
    """
    try:
        # 兼容两种格式的字段名
        var_name = condition.get("variable_name") or condition.get("variable")
        var_type = condition.get("variable_type") or condition.get("type", "environment")
        operator = condition.get("operator", "==")
        expected = condition.get("value")
        
        if not var_name:
            logger.warning(f"Condition missing variable name: {condition}")
            return False
        
        # 操作符映射（原格式 -> 新格式）
        operator_map = {
            "equals": "==",
            "not_equals": "!=",
            "greater_than": ">",
            "less_than": "<",
            "greater_than_or_equal": ">=",
            "less_than_or_equal": "<=",
            "not_contains": "not_contains",
        }
        operator = operator_map.get(operator, operator)
        
        # 获取变量当前值
        current_value = _get_variable_value(task, var_name, var_type)
        
        # 评估条件
        return _compare_values(current_value, operator, expected)
        
    except Exception as e:
        logger.error(f"Error evaluating condition: {e}")
        return False


def _get_variable_value(task: 'Task', var_name: str, var_type: str) -> Any:
    """
    获取变量值
    
    支持两种变量类型：
    - environment: ActionTaskEnvironmentVariable（环境变量）
    - agent: AgentVariable（Agent变量）
    """
    try:
        if var_type == "environment":
            from app.models import ActionTaskEnvironmentVariable
            var = ActionTaskEnvironmentVariable.query.filter_by(
                action_task_id=task.action_task_id,
                name=var_name
            ).first()
            if var:
                # 尝试解析JSON值
                try:
                    import json
                    return json.loads(var.value) if var.value else None
                except (json.JSONDecodeError, TypeError):
                    return var.value
            return None
        elif var_type == "agent":
            from app.models import AgentVariable, Agent
            # AgentVariable 没有 action_task_id 字段，需要通过 Agent 关联查找
            agents = Agent.query.filter_by(action_task_id=task.action_task_id).all()
            for agent in agents:
                var = AgentVariable.query.filter_by(
                    agent_id=agent.id,
                    name=var_name
                ).first()
                if var:
                    try:
                        import json
                        return json.loads(var.value) if var.value else None
                    except (json.JSONDecodeError, TypeError):
                        return var.value
            return None
        else:
            logger.warning(f"Unknown variable type: {var_type}")
            return None
                
    except Exception as e:
        logger.error(f"Error getting variable {var_name} (type={var_type}): {e}")
        return None


def _compare_values(current: Any, operator: str, expected: Any) -> bool:
    """比较值"""
    try:
        if operator == "==":
            return current == expected
        elif operator == "!=":
            return current != expected
        elif operator == ">":
            return float(current) > float(expected)
        elif operator == "<":
            return float(current) < float(expected)
        elif operator == ">=":
            return float(current) >= float(expected)
        elif operator == "<=":
            return float(current) <= float(expected)
        elif operator == "contains":
            return str(expected) in str(current)
        elif operator == "not_contains":
            return str(expected) not in str(current)
        elif operator == "changed":
            # "changed" 需要跟踪上一次的值，这里简化处理
            return current is not None
        else:
            logger.warning(f"Unknown operator: {operator}")
            return False
    except (ValueError, TypeError) as e:
        logger.error(f"Error comparing values: {e}")
        return False


def evaluate_stop_conditions(task: 'Task', conditions: List[Dict], logic: str = "and") -> bool:
    """
    评估停止条件（用于 variable_stop 模式）
    
    与触发条件格式相同，但语义是"满足条件则停止"
    """
    return _check_trigger_conditions(task, conditions, logic)


async def wait_for_next_agent_variable(task: 'Task') -> Dict[str, Any]:
    """
    等待 nextAgent 变量设置（用于 autonomous_scheduling）
    
    检查 nextAgent 变量是否已设置，短超时后返回结果。
    
    execution_config:
        next_agent_variable: 变量名，默认 "nextAgent"
        next_todo_variable: 下一步TODO变量名，默认 "nextAgentTODO"
        check_interval: 检查间隔（秒），默认1秒
        max_wait_time: 最大等待时间（秒），默认10秒
    
    Returns:
        {"next_agent": str, "next_todo": str, "should_stop": bool}
        - should_stop=True 表示任务应该结束（nextAgent为空或超时）
    """
    cfg = task.execution_config or {}
    next_agent_var = cfg.get("next_agent_variable", "nextAgent")
    next_todo_var = cfg.get("next_todo_variable", "nextAgentTODO")
    check_interval = cfg.get("check_interval", 1)
    max_wait_time = cfg.get("max_wait_time", 10)  # 默认10秒超时（快速响应）
    
    waited_time = 0
    
    logger.debug(f"Task {task.id} checking nextAgent variable")
    
    while not task.cancel_event.is_set():
        current_agent = _get_variable_value(task, next_agent_var, "environment")
        
        # 检查 nextAgent 是否已设置且非空
        if current_agent and (not isinstance(current_agent, str) or current_agent.strip() != ''):
            next_todo = _get_variable_value(task, next_todo_var, "environment")
            logger.info(f"Task {task.id} next agent: {current_agent}, todo: {next_todo}")
            return {
                "next_agent": current_agent,
                "next_todo": next_todo,
                "should_stop": False
            }
        
        # 检查超时
        waited_time += check_interval
        if waited_time >= max_wait_time:
            logger.info(f"Task {task.id} nextAgent not set after {max_wait_time}s, stopping")
            return {
                "next_agent": None,
                "next_todo": None,
                "should_stop": True
            }
        
        await asyncio.sleep(check_interval)
    
    # 任务被取消
    return {
        "next_agent": None,
        "next_todo": None,
        "should_stop": True
    }
