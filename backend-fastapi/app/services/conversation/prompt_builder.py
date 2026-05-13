"""
提示词构建模块

从 message_processor.py 抽离，负责构建系统提示词
"""
import os
import logging
from typing import List, Dict, Any, Optional

from app.models import (
    db, Agent, ActionTask, ActionSpace, Role, RoleCapability, Capability,
    ActionTaskAgent, RuleSet, Rule, RuleSetRule,
    ActionTaskEnvironmentVariable, AgentVariable,
    RoleKnowledge, Knowledge, RoleExternalKnowledge, ExternalKnowledge, ExternalKnowledgeProvider,
    ConversationPlan, ConversationPlanItem
)
from app.utils.datetime_utils import get_current_time_with_timezone
from app.services.workspace_service import WorkspaceService

logger = logging.getLogger(__name__)

def build_system_prompt(agent, agent_role, action_task, conversation, tool_definitions, tool_names, role_capabilities, model_supports_function_calling=False, other_agents_context=None):
    """构建系统提示词 / Build system prompt

    Args:
        agent: 智能体对象 / Agent object
        agent_role: 智能体角色对象 / Agent role object
        action_task: 行动任务对象 / Action task object
        conversation: 会话对象 / Conversation object
        tool_definitions: 工具定义列表 / Tool definitions list
        tool_names: 工具名称列表 / Tool names list
        role_capabilities: 角色能力列表 / Role capabilities list
        model_supports_function_calling: 模型是否支持函数调用 / Whether model supports function calling
        other_agents_context: 其他agents的历史消息格式化内容（可选） / Formatted context from other agents (optional)

    Returns:
        str: 构建好的系统提示词 / Built system prompt
    """
    # 获取提示模板 / Get prompt template
    prompt_template = ""
    if agent_role and hasattr(agent_role, 'system_prompt') and agent_role.system_prompt:
        prompt_template = agent_role.system_prompt

    # 使用f-string进行格式化 / Format using f-string
    # 判断是否为监督者 / Check if this is an observer/supervisor
    is_observer = hasattr(agent, 'is_observer') and agent.is_observer
    observer_role_text = ", and you are a supervisor for this task" if is_observer else ""

    system_prompt = f"""<roleDefinition>
# Role Definition
Your name is {agent.name}, you are a {agent_role.name if agent_role else 'undefined role'}{observer_role_text}, and your ID is {agent.id}.
Please remember your name, role, and ID. You must not refer to yourself in third person or confuse yourself with other agents.

## Role Principles
{prompt_template}
## Note on Identity Markers          
DO NOT include HTML comment markers (e.g., `<!--The following is a reply from...-->`) in your responses. These are system-generated. Respond with content only. 
## Additional Principles
*In addition to the above principles, you must also follow the additional role prompts in your action space*
</roleDefinition>"""

    # 如果是监督者，添加监督者特殊提示 / Add special supervisor instructions if this is an observer
    if is_observer:
        system_prompt += """<observerDefinition>
## Supervisor Special Instructions
As a supervisor, your responsibility is to monitor and evaluate the performance of other agents in the action task, rather than directly participating in task execution. You should:
1. Observe whether other agents' behaviors and decisions comply with the rules in the rule set
2. Evaluate whether they follow rules and complete task objectives
3. Provide objective evaluations and suggestions
4. Intervene when necessary, but avoid excessive intervention
5. Maintain a neutral and objective stance
</observerDefinition>

"""

        # 监督者不需要规则检查提示词，因为监督者的职责是监督其他智能体，而不是被监督
        # 这样可以避免监督者回复时触发额外的LLM API调用进行规则检查
        logger.debug(f"跳过为监督者 {agent.name} 添加规则检查结果（监督者不需要被监督）")

    # 获取行动空间信息 / Get action space information
    action_space = None
    if action_task.action_space_id:
        action_space = ActionSpace.query.get(action_task.action_space_id)

    # 格式化其余部分 / Format the rest of the prompt
    system_prompt += f"""<actionSpace>
## Action Space
The action space is the virtual environment where you operate. You play a role in this space and must follow the role principles and rules of this space.

### Action Space Name
{action_space.name if action_space else 'Undefined Action Space'}

### Action Space Description
{action_space.description if action_space else ''}

## Action Space Background
{action_space.settings.get('background', '') if action_space and action_space.settings else ''}

## Action Space Basic Principles
{action_space.settings.get('rules', '') if action_space and action_space.settings else ''}

### Additional Principles You Must Follow in This Action Space
{agent.additional_prompt if hasattr(agent, 'additional_prompt') and agent.additional_prompt else ''}
"""

    task_agents = ActionTaskAgent.query.filter_by(action_task_id=action_task.id).all()

    # 添加当前空间参与角色列表，分为普通参与者和监督者 / Add current space participant role list, separated into regular participants and supervisors
    if task_agents:
        # 获取所有智能体对象 / Get all agent objects
        agent_objects = []
        for task_agent in task_agents:
            agent_obj = Agent.query.get(task_agent.agent_id)
            if agent_obj and agent_obj.role:
                agent_objects.append(agent_obj)

        # 分离普通参与者和监督者 / Separate regular participants and supervisors
        participants = [a for a in agent_objects if not (hasattr(a, 'is_observer') and a.is_observer)]
        observers = [a for a in agent_objects if hasattr(a, 'is_observer') and a.is_observer]

        # 添加普通参与者列表 / Add regular participants list
        if participants:
            system_prompt += "\n## Current Space Participant Role List\n"
            for agent_obj in participants:
                role_name = agent_obj.role.name if hasattr(agent_obj.role, 'name') else ""
                system_prompt += f"- {agent_obj.name}[{role_name}][ID: {agent_obj.id}]\n"

        # 添加监督者列表 / Add supervisors list
        if observers:
            system_prompt += "\n## Current Space Supervisor List\n"
            for agent_obj in observers:
                role_name = agent_obj.role.name if hasattr(agent_obj.role, 'name') else ""
                system_prompt += f"- {agent_obj.name}[{role_name}][ID: {agent_obj.id}]\n"

    # 检查是否为并行实验任务，如果是则获取实验协议
    experiment_protocol = None
    if hasattr(action_task, 'is_experiment_clone') and action_task.is_experiment_clone:
        from app.models import ParallelExperiment
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import JSONB
        
        # 优化查询：使用 JSON 包含查询而不是遍历所有实验
        # 首先尝试直接查询包含该任务ID的实验
        task_id = action_task.id
        experiments = ParallelExperiment.query.filter(
            ParallelExperiment.status.in_(['running', 'paused', 'completed']),
            ParallelExperiment.cloned_action_task_ids.isnot(None)
        ).all()
        
        # 在内存中查找（JSON 字段的深度查询在不同数据库中支持不同）
        for exp in experiments:
            if exp.cloned_action_task_ids:
                # 快速检查：先检查任务ID是否在任何轮次中
                for iteration, task_ids in exp.cloned_action_task_ids.items():
                    if task_id in task_ids:
                        experiment_protocol = exp.config.get('experiment_protocol') if exp.config else None
                        break
                if experiment_protocol:
                    break

    # 检查是否为自主调度模式 / Check if this is autonomous scheduling mode
    is_autonomous_scheduling = False
    if hasattr(action_task, 'config') and action_task.config:
        execution_mode = action_task.config.get('execution_mode', '')
        is_autonomous_scheduling = execution_mode in ['dynamic', 'autonomous_scheduling']

    system_prompt += f"""<actionTask>
### Current Action Task
Task Name: {action_task.title}
Task ID: {action_task.id}
Conversation/Session ID: {conversation.id}
Task Description: {action_task.description}
"""

    # 如果是自主调度模式，添加 nextAgent 和 nextAgentTODO 的说明
    if is_autonomous_scheduling:
        system_prompt += """
<autonomousScheduling>
## Autonomous Scheduling Mode
This task uses autonomous scheduling. After completing your work, you MUST designate the next agent.

### Required Actions After Your Task
Use the `set_task_var` tool to set these two environment variables:

1. **nextAgent** - The name of the next agent to act
   - Choose from the participant list above
   - Set to empty string "" to end the task
   - Example: `set_task_var(name="nextAgent", value="网络安全审核员")`

2. **nextAgentTODO** - Description of what the next agent should do
   - Be specific about the task
   - Example: `set_task_var(name="nextAgentTODO", value="请审核系统的网络安全配置")`

### When to End the Task
Set nextAgent to "" (empty string) when:
- The task objective has been fully achieved
- All necessary reviews/evaluations are complete
- A consensus or final decision has been reached
- No further agent participation is needed

### Important Notes
- If you don't set nextAgent, the task will stop automatically after timeout
- Always provide clear instructions in nextAgentTODO for the next agent
</autonomousScheduling>
"""

    # 如果有实验协议，添加到提示词中
    if experiment_protocol:
        system_prompt += f"""
<experimentProtocol>
{experiment_protocol}
</experimentProtocol>
"""

# 检查角色是否有环境变量能力 / Check if the role has environment variables capability
    has_env_vars = False
    if agent_role:
        # 查询角色的能力 / Query role capabilities
        role_capability_relations = RoleCapability.query.filter_by(role_id=agent_role.id).all()
        for rc in role_capability_relations:
            capability = Capability.query.get(rc.capability_id)
            if capability and capability.name == "environment_variables":
                has_env_vars = True
                break

    # 如果角色有环境变量能力，添加环境变量信息 / If the role has environment variables capability, add environment variable information
    if has_env_vars:
        # 获取任务的环境变量 / Get task environment variables
        system_prompt += "<agentAndTaskVariables># Variables Related to Task and You\n"
        system_prompt += "## Current Time\n" + get_current_time_with_timezone().strftime("%Y-%m-%d %H:%M:%S")
        env_vars = ActionTaskEnvironmentVariable.query.filter_by(action_task_id=action_task.id).all()

        # 获取智能体的变量 / Get agent variables
        from app.models import AgentVariable
        agent_vars = AgentVariable.query.filter_by(agent_id=agent.id).all()

        # 添加环境变量到系统提示 / Add environment variables to system prompt
        if env_vars or agent_vars:
            system_prompt += "\n## Current Environment Variables and Personal Variables\n"

            # 添加环境变量 / Add environment variables
            if env_vars:
                system_prompt += "### Task Environment Variables\n"
                for var in env_vars:
                    # 检查是否为共享环境变量
                    if getattr(var, 'shared_variable_id', None):
                        # 共享环境变量，添加特殊标识
                        readonly_indicator = " [READONLY]" if getattr(var, 'is_readonly', False) else ""
                        system_prompt += f"- {var.name}: {var.value} [SHARED]{readonly_indicator}\n"
                    else:
                        # 传统任务环境变量
                        system_prompt += f"- {var.name}: {var.value}\n"

            # 添加智能体变量 / Add agent variables
            if agent_vars:
                system_prompt += "### Your Personal Variables\n"
                for var in agent_vars:
                    # 只添加公开变量或自己的私有变量 / Only add public variables or your own private variables
                    if var.is_public or var.agent_id == agent.id:
                        system_prompt += f"- {var.name}: {var.value}\n"
        system_prompt += "</agentAndTaskVariables>"

    # 添加规则集信息 / Add rule set information
    rule_set = None
    rules = []
    if action_task.rule_set_id:
        rule_set = RuleSet.query.get(action_task.rule_set_id)
        if rule_set:
            # 获取规则集中的所有规则 / Get all rules in the rule set
            from app.models import RuleSetRule
            rule_set_rules = RuleSetRule.query.filter_by(rule_set_id=rule_set.id).all()
            if rule_set_rules:
                rule_ids = [rsr.rule_id for rsr in rule_set_rules]
                rules = Rule.query.filter(Rule.id.in_(rule_ids)).all()
                logger.info(f"从规则集 {rule_set.id} 获取到 {len(rules)} 条规则")

    if rule_set:
        # 添加具体规则 / Add specific rules
        if rules:
            rulesPrompts = ""
            system_prompt += "\n"
            for rule in rules:
                rulesPrompts += f"- {rule.name}\n{rule.description}\n"

        system_prompt += f"""<rules>
## In this action task, you must follow these rules:
### Rule Set Name
{rule_set.name}

### Rule Set Description
{rule_set.description}

### Rule Set Rules
{rulesPrompts}
</rules>
"""
    system_prompt += "</actionTask>"
    system_prompt += "</actionSpace>"

    # 初始化能力字典 / Initialize capabilities dictionary
    agent_capabilities = dict() # 存储在字典中，包括能力和描述，方便后续查删操作，key为能力名称，value为能力描述 / Store in dictionary with capability name as key and description as value for easy lookup and deletion

    if agent_role:
        # 查询角色的能力 / Query role capabilities
        role_capability_relations = RoleCapability.query.filter_by(role_id=agent_role.id).all()
        for rc in role_capability_relations:
            capability = Capability.query.get(rc.capability_id)
            if capability:
                agent_capabilities[capability.name]=capability.description

    # 处理 workspace_management 能力的动态占位符替换 / Handle dynamic placeholder replacement for workspace_management
    if "workspace_management" in agent_capabilities:
        workspace_capability_description = agent_capabilities["workspace_management"]
        
        workspace_dir = os.getcwd()+f"/agent-workspace"
        task_workspace = f"{workspace_dir}/ActionTask-{action_task.id}"
        
        # 检查是否存在智能体个人工作空间 / Check if agent personal workspace exists
        agent_workspace_path = os.path.join(WorkspaceService().workspace_dir, f'ActionTask-{action_task.id}/Agent-{agent.id}')
        has_agent_workspace = os.path.exists(agent_workspace_path)
        
        # 构建动态占位符的值 / Build dynamic placeholder values
        agent_workspace_structure = ""
        agent_workspace_files = ""
        agent_workspace_usage = ""
        
        if has_agent_workspace:
            agent_workspace_structure = f"├── Agent-{agent.id}/              # Your personal workspace\n│   └── AgentWorkspace.md          # Your personal notes and workspace\n"
            agent_workspace_files = "- `AgentWorkspace.md`: Your personal workspace and notes\n"
            agent_workspace_usage = f"  - Personal files: `{task_workspace}/Agent-{agent.id}/filename.md`\n"
        
        # 读取项目索引文件 / Read project index file
        project_index_content = ""
        project_index_path = os.path.join(WorkspaceService().workspace_dir, f'ActionTask-{action_task.id}/ProjectIndex.md')
        if os.path.exists(project_index_path):
            try:
                with open(project_index_path, 'r', encoding='utf-8') as f:
                    project_index_content = f.read()
            except Exception as e:
                logger.error(f"读取项目索引文件失败: {str(e)}")
                project_index_content = "无法读取项目索引文件"
        else:
            project_index_content = "项目索引文件不存在"
        
        # 替换能力描述中的占位符 / Replace placeholders in capability description
        workspace_description = workspace_capability_description.replace("{task_workspace}", task_workspace)
        workspace_description = workspace_description.replace("{agent_workspace_structure}", agent_workspace_structure)
        workspace_description = workspace_description.replace("{agent_workspace_files}", agent_workspace_files)
        workspace_description = workspace_description.replace("{agent_workspace_usage}", agent_workspace_usage)
        workspace_description = workspace_description.replace("{project_index_content}", project_index_content)
        
        # 更新能力描述 / Update capability description
        agent_capabilities["workspace_management"] = workspace_description

    system_prompt += f"""<agentCapabilities>
# Your Main Capabilities

## Tool Usage Guidelines
- Before calling any tool, first output your motivation and reasoning for using that specific tool
- Use the provided tools when appropriate to answer user questions
- Do NOT describe what tools you would use - actually use them after explaining your motivation
- Do NOT output function calls as text - use the proper tool calling mechanism
- If you need clarification for tool parameters, ask the user first
- Only use tools when necessary to fulfill the user's request

"""

    # 构建能力与工具的映射关系 / Build capability-tool mapping
    capability_tools_map = {}
    if agent_role:
        # 查询角色的能力，获取每个能力关联的工具 / Query role capabilities and get tools associated with each capability
        role_capability_relations = RoleCapability.query.filter_by(role_id=agent_role.id).all()
        for rc in role_capability_relations:
            capability = Capability.query.get(rc.capability_id)
            if capability and capability.tools:
                # 收集该能力关联的所有工具 / Collect all tools associated with this capability
                capability_tool_list = []
                for server_name, server_tools in capability.tools.items():
                    if isinstance(server_tools, list) and server_tools:
                        for tool_name in server_tools:
                            capability_tool_list.append(f"{tool_name}")
                capability_tools_map[capability.name] = capability_tool_list

    # 为每个能力添加描述和配套工具 / Add description and supporting tools for each capability
    for capability_name, capability_description in agent_capabilities.items():
        system_prompt += f"""<capability>## {capability_name}\n{capability_description}\n"""

        # 添加与该能力配套的工具列表 / Add list of tools supporting this capability
        if capability_name in capability_tools_map and capability_tools_map[capability_name]:
            system_prompt += f"""<capabilityTools>### Supporting Tools\n"""
            for tool_info in capability_tools_map[capability_name]:
                system_prompt += f"- {tool_info}\n"
            system_prompt += "</capabilityTools>"
        system_prompt += "</capability>"

    system_prompt += "</agentCapabilities>"

    # 注入 SubAgent 协作能力提示 / Inject SubAgent collaboration capability prompt
    system_prompt += _build_subagent_capability_prompt(agent, action_task)

    # 注入可用技能列表 / Inject available skills list
    if agent_role:
        system_prompt += _build_available_skills_prompt(agent_role)

    # 检查是否具备知识库访问能力，如果有则添加知识库信息 / Check if has knowledge access capability, if so add knowledge base information
    if "knowledge_access" in agent_capabilities and agent_role:
        # 查询角色绑定的内部知识库 / Query internal knowledge bases bound to the role
        internal_knowledges = db.session.query(
            RoleKnowledge, Knowledge
        ).join(
            Knowledge,
            RoleKnowledge.knowledge_id == Knowledge.id
        ).filter(RoleKnowledge.role_id == agent_role.id).all()

        # 查询角色绑定的外部知识库 / Query external knowledge bases bound to the role
        external_knowledges = db.session.query(
            RoleExternalKnowledge, ExternalKnowledge, ExternalKnowledgeProvider
        ).join(
            ExternalKnowledge,
            RoleExternalKnowledge.external_knowledge_id == ExternalKnowledge.id
        ).join(
            ExternalKnowledgeProvider,
            ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
        ).filter(
            RoleExternalKnowledge.role_id == agent_role.id,
            ExternalKnowledge.status == 'active',
            ExternalKnowledgeProvider.status == 'active'
        ).all()

        # 如果有绑定的知识库，添加知识库信息到提示词 / If there are bound knowledge bases, add knowledge base information to prompt
        if internal_knowledges or external_knowledges:
            system_prompt += """<knowledgeBases>
# Available Knowledge Bases
You have access to the following knowledge bases through the query_knowledge tool. Use this tool to search for relevant information when needed.

"""

            # 添加内部知识库信息 / Add internal knowledge base information
            if internal_knowledges:
                system_prompt += "## Internal Knowledge Bases\n"
                for _, knowledge in internal_knowledges:
                    system_prompt += f"- **{knowledge.name}**: {knowledge.description or 'No description available'}\n"
                system_prompt += "\n"

            # 添加外部知识库信息 / Add external knowledge base information
            if external_knowledges:
                system_prompt += "## External Knowledge Bases\n"
                for _, ext_knowledge, provider in external_knowledges:
                    system_prompt += f"- **{ext_knowledge.name}** (via {provider.name}): {ext_knowledge.description or 'No description available'}\n"
                system_prompt += "\n"

            system_prompt += """## How to Query Knowledge Bases
Use the `query_knowledge` tool with the following parameters:
- agent_id: Your agent ID (exactly: {})
- query: Your search query text

STRICT constraints:
- Only use your own agent_id shown above. Never use or infer any other agent's ID.
- Do not modify or reformat the agent_id; pass it verbatim.
- If you are unsure of your agent_id, use the one stated above and do not guess.
- If a query fails or returns no results, do not try a different agent_id. Report the issue instead.
- Never attempt to access other agents' knowledge bases or pass their IDs.

The tool will automatically search all knowledge bases bound to your role and return relevant information.
</knowledgeBases>

""".format(agent.id)

    # 如果模型支持函数调用且有工具，不再单独添加toolUsage（已合并到agentCapabilities）
    # Tool usage instructions have been moved to <agentCapabilities> section
    
    # 添加当前会话的执行计划（如果有）/ Add current conversation plan if exists
    try:
        active_plan = ConversationPlan.query.filter_by(
            conversation_id=conversation.id
        ).order_by(ConversationPlan.created_at.desc()).first()
        
        if active_plan:
            plan_dict = active_plan.to_dict(include_items=True, include_progress=True)
            items = plan_dict.get('items', [])
            if items:
                system_prompt += f"\n<currentPlan>\n# Plan: {plan_dict['title']} ({plan_dict.get('completed_count', 0)}/{plan_dict.get('total_count', 0)})\n"
                for item in items:
                    status_icon = "✓" if item['status'] == 'completed' else "○"
                    system_prompt += f"- [{status_icon}] {item['title']} (id:{item['id']})\n"
                system_prompt += "</currentPlan>\n"
    except Exception as e:
        logger.warning(f"获取会话计划失败: {str(e)}")
    
    # 在system prompt末尾添加对话历史上下文（如果有）
    if other_agents_context:
        system_prompt += f"""
<conversationHistory>
# Previous Conversation History
The following shows the conversation history in this session.
- Messages marked with "You (...) previously said" are YOUR previous responses.
- Messages from other agents show their name and role.

{other_agents_context}
</conversationHistory>
"""
        logger.info(f"[System Prompt] 添加了对话历史上下文，长度: {len(other_agents_context)}")
    
    return system_prompt

def _build_subagent_capability_prompt(agent, action_task) -> str:
    """构建 SubAgent 协作能力的 prompt 注入内容

    只有当 subagent-server 已启用时才注入。
    列出同一行动任务中可调用的其他 Agent。
    """
    try:
        # 检查用户是否启用了 SubAgent 开关（从线程上下文读取）
        try:
            from app.services.thread_context import g
            if g.enable_subagent is not None and not g.enable_subagent:
                return ""
        except Exception:
            pass  # 继续检查 mcp_config

        # 检查 subagent-server 是否在 mcp_config 中启用
        from app.services.mcp_server_manager import mcp_manager
        servers_config = mcp_manager.servers_config.get('mcpServers', {})
        subagent_config = servers_config.get('subagent-server', {})
        if not subagent_config.get('enabled', False):
            return ""

        # 获取同一行动任务中的其他 Agent
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=action_task.id).all()
        other_agents = []
        for ta in task_agents:
            other_agent = Agent.query.get(ta.agent_id)
            if not other_agent or other_agent.id == agent.id:
                continue
            # 排除监督者
            if hasattr(other_agent, 'is_observer') and other_agent.is_observer:
                continue
            role = other_agent.role if hasattr(other_agent, 'role') and other_agent.role else None
            role_name = role.name if role else "未定义角色"
            other_agents.append(f"- **{other_agent.name}** [{role_name}]")

        if not other_agents:
            return ""

        agents_list = "\n".join(other_agents)

        prompt = f"""
<subAgentCapability>
## Calling Other Agents (SubAgent Collaboration)

You can call other agents in the current action task to assist you when needed.

### Available Agents (use their exact name as target_agent_name)
{agents_list}

### Tools
- `invoke_agent`: Call a single agent with parameters: task_id, target_agent_name, task_description, context(optional)
- `invoke_agents`: Call multiple agents in parallel with parameters: task_id, invocations(array)
- `list_available_agents`: List all callable agents and their roles.

### Correct Parameter Format

**invoke_agent** (single call):
```json
{{
  "task_id": "{action_task.id}",
  "target_agent_name": "AgentNameHere",
  "task_description": "What you need this agent to do",
  "context": "Optional background info"
}}
```

**invoke_agents** (parallel call):
```json
{{
  "task_id": "{action_task.id}",
  "invocations": [
    {{"target_agent_name": "Agent1Name", "task_description": "Task for agent 1"}},
    {{"target_agent_name": "Agent2Name", "task_description": "Task for agent 2"}}
  ]
}}
```

⚠️ **CRITICAL**: Use `target_agent_name` (the agent's display name from the list above), NOT agent_id. Use `invocations` as the array field name, NOT agents. Use `task_description`, NOT instruction.

### When to Use
- When you need another role's professional knowledge or judgment
- When you need information or analysis from multiple roles simultaneously
- When a sub-task is better handled by a specialist role
</subAgentCapability>
"""
        return prompt

    except Exception as e:
        logger.warning(f"构建 SubAgent 能力提示词失败: {e}")
        return ""

def _build_available_skills_prompt(agent_role) -> str:
    """构建可用技能的 prompt 注入内容"""
    try:
        from app.services.skill_service import SkillService
        skill_service = SkillService()
        skills_metadata = skill_service.get_skill_metadata_for_prompt(agent_role.id)
        if not skills_metadata:
            return ""

        prompt = "\n<available_skills>\n"
        prompt += "# Available Skills\n"
        prompt += "The following skills are available to you. When a user's request matches a skill's description, "
        prompt += "use the `read_skill` tool to load the full instructions, then follow them.\n\n"

        for skill in skills_metadata:
            prompt += f"""<skill>
<name>{skill['name']}</name>
<description>{skill['description']}</description>
</skill>
"""

        prompt += "</available_skills>\n"
        return prompt
    except Exception as e:
        logger.warning(f"构建技能提示词失败: {e}")
        return ""
