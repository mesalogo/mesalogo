"""
SubAgent 上下文构建模块

为 SubAgent 构建独立的上下文，包括：
- 目标 Agent 的 system_prompt
- SubAgent 任务提示
- 调用方提供的 context
- 任务级环境变量（只读）
"""

import logging
from typing import Dict, Any, Optional, List

from app.models import (
    Agent, Role, ActionTask, ActionSpace,
    ActionTaskEnvironmentVariable, ActionTaskAgent
)

logger = logging.getLogger(__name__)


class SubAgentContextBuilder:
    """SubAgent 上下文构建器"""

    @staticmethod
    def build_subagent_messages(
        target_agent: Agent,
        target_role: Role,
        action_task: ActionTask,
        caller_agent_name: str,
        caller_role_name: str,
        task_description: str,
        context: Optional[str] = None,
        max_tokens: int = 2048
    ) -> List[Dict[str, Any]]:
        """
        构建 SubAgent 的消息列表（system + user）

        Args:
            target_agent: 目标智能体对象
            target_role: 目标智能体的角色对象
            action_task: 行动任务对象
            caller_agent_name: 调用方智能体名称
            caller_role_name: 调用方角色名称
            task_description: 任务描述
            context: 可选的上下文信息
            max_tokens: 最大 token 数

        Returns:
            格式化的消息列表 [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
        """
        # 1. 构建 system prompt
        system_prompt = SubAgentContextBuilder._build_system_prompt(
            target_agent=target_agent,
            target_role=target_role,
            action_task=action_task
        )

        # 2. 构建 user message（子任务描述）
        user_content = SubAgentContextBuilder._build_task_message(
            caller_agent_name=caller_agent_name,
            caller_role_name=caller_role_name,
            task_description=task_description,
            context=context,
            action_task=action_task
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        return messages

    @staticmethod
    def _build_system_prompt(
        target_agent: Agent,
        target_role: Role,
        action_task: ActionTask
    ) -> str:
        """
        构建 SubAgent 的 system prompt

        保持目标 Agent 的角色身份，但标记为 SubAgent 模式
        """
        role_prompt = ""
        if target_role and hasattr(target_role, 'system_prompt') and target_role.system_prompt:
            role_prompt = target_role.system_prompt

        # 获取行动空间信息
        action_space = None
        if action_task and action_task.action_space_id:
            action_space = ActionSpace.query.get(action_task.action_space_id)

        system_prompt = f"""<roleDefinition>
# Role Definition
Your name is {target_agent.name}, you are a {target_role.name if target_role else 'undefined role'}, and your ID is {target_agent.id}.

## Role Principles
{role_prompt}

## Mode
You are currently operating in **SubAgent mode**. Another agent has called you to complete a specific sub-task.
- Focus exclusively on the sub-task described in the user message
- Provide a complete and actionable response
- Do not deviate from the task scope
- If you need more information, state what you need clearly in your response
</roleDefinition>"""

        # 添加行动空间背景
        if action_space:
            system_prompt += f"""
<actionSpace>
## Action Space: {action_space.name}
{action_space.description or ''}
Background: {action_space.settings.get('background', '') if action_space and action_space.settings else ''}
</actionSpace>"""

        # 添加环境变量（只读）
        env_vars = ActionTaskEnvironmentVariable.query.filter_by(
            action_task_id=action_task.id
        ).all()

        if env_vars:
            system_prompt += "\n<environmentVariables>\n## Task Environment Variables (Read-Only)\n"
            for var in env_vars:
                system_prompt += f"- {var.name}: {var.value}\n"
            system_prompt += "</environmentVariables>"

        return system_prompt

    @staticmethod
    def _build_task_message(
        caller_agent_name: str,
        caller_role_name: str,
        task_description: str,
        context: Optional[str],
        action_task: ActionTask
    ) -> str:
        """
        构建 SubAgent 收到的 user message（子任务描述）
        """
        message = f"""<subAgentTask>
## Sub-Task Assignment
You have been called by **{caller_agent_name}** (role: {caller_role_name}) to complete the following sub-task.

### Task
{task_description}
"""

        if context:
            message += f"""
### Background Context
{context}
"""

        message += """
### Requirements
- Focus on the above sub-task and provide a complete answer
- Do not deviate from the task scope
- Be concise but thorough
- If you need more information to complete the task, clearly state what is missing
</subAgentTask>"""

        return message
