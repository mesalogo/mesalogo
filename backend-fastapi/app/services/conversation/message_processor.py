"""
消息处理模块

提供处理消息的共享核心逻辑、提示词构建和消息格式化功能

函数与关键变量说明:
---------------------------------------

消息处理核心:
* process_message_common - 处理消息的共享核心逻辑，构建提示词
  - conversation_id: 会话ID
  - content: 消息内容
  - target_agent_id: 目标智能体ID(可选)
  - user_id: 用户ID(可选)
  - target_agent_ids: 目标智能体ID列表(可选，多个智能体，优先级高于target_agent_id)
  - no_new_message: 是否跳过创建新消息 (可选，用于流式API中复用已创建的消息)
  - existing_human_message: 已存在的人类消息对象 (可选，与no_new_message配合使用)
  - 返回: (human_message, agent, agent_role, role_model, model_messages, conversation, role_model_params, agent_info, model_settings)

提示词构建:
* build_system_prompt - 构建系统提示词
  - agent: 智能体对象
  - agent_role: 智能体角色对象
  - action_task: 行动任务对象
  - conversation: 会话对象
  - tool_definitions: 工具定义列表
  - tool_names: 工具名称列表
  - role_capabilities: 角色能力列表

消息格式化:
* format_messages - 格式化消息为模型可用的格式
  - system_prompt: 系统提示词
  - recent_messages: 最近的消息列表
  - content: 当前消息内容
"""
import json
import logging
import os
import re
from typing import List, Dict, Any, Optional, Tuple

from app.models import (
    db, Conversation, Message, Agent, ActionTask, RuleSet, Rule,
    ActionSpace, Role, RoleCapability, Capability, RoleTool, Tool,
    ActionTaskEnvironmentVariable, ActionSpaceRole, ActionTaskAgent,
    RoleKnowledge, Knowledge, RoleExternalKnowledge, ExternalKnowledge, ExternalKnowledgeProvider
)
from app.utils.datetime_utils import get_current_time_with_timezone
from app.services.mcp_server_manager import mcp_manager
from app.services.tool_schema_cache import tool_schema_cache
from app.services.workspace_service import WorkspaceService

# 导入拆分的模块
from app.services.conversation.prompt_builder import build_system_prompt
from app.services.conversation.tool_definition_builder import compress_tool_definition

logger = logging.getLogger(__name__)

# compress_tool_definition 已移至 tool_definition_builder.py，通过导入使用

def process_message_common(conversation_id: int, content: str, target_agent_id=None, user_id=None,
                          target_agent_ids=None, no_new_message=False, existing_human_message=None, send_target=None, isolation_mode=False) -> tuple:
    """
    处理消息的共享核心逻辑

    Args:
        conversation_id: 会话ID
        content: 消息内容
        target_agent_id: 目标智能体ID (可选，单个智能体)
        user_id: 用户ID (可选)
        target_agent_ids: 目标智能体ID列表 (可选，多个智能体，优先级高于target_agent_id)
        no_new_message: 是否跳过创建新消息 (可选，用于流式API中复用已创建的消息)
        existing_human_message: 已存在的人类消息对象 (可选，与no_new_message配合使用)
        send_target: 发送目标 (可选，'supervisor'表示发送给监督者，'task'表示发送给任务会话，'task_intervention'表示监督者干预)
        isolation_mode: 隔离模式 (可选，True时智能体只能看到自己与用户的消息历史)

    Returns:
        tuple: (human_message, target_agent, role, model_config, formatted_messages, conversation, role_model_params, agent_info, model_settings)
    """
    # 如果提供了target_agent_ids列表，优先使用它
    if target_agent_ids and len(target_agent_ids) > 0:
        if len(target_agent_ids) == 1:
            # 如果列表只有一个元素，使用单个智能体处理逻辑
            target_agent_id = target_agent_ids[0]
        else:
            # 多个智能体时，只处理第一个智能体的响应
            # 注意：多个智能体的处理应在流式API中完成，这里只处理普通API的情况
            logger.info(f"process_message_common收到多个智能体ID: {target_agent_ids}，将只处理第一个")
            target_agent_id = target_agent_ids[0]

    # 检查会话是否存在
    conversation = Conversation.query.get(conversation_id)
    if not conversation:
        logger.warning(f"会话不存在: {conversation_id}")
        return None, None, None, None, None, None, None, None, None

    if conversation.status != 'active':
        logger.warning(f"会话状态为{conversation.status}，不能添加消息")
        return None, None, None, None, None, None, None, None, None

    # 创建人类消息 - 如果no_new_message为True则使用existing_human_message
    human_message = existing_human_message
    if not no_new_message:
        # 处理多模态内容：如果content是list，序列化为JSON字符串
        if isinstance(content, list):
            content_str = json.dumps(content, ensure_ascii=False)
            logger.info(f"多模态消息内容已序列化，长度: {len(content_str)}")
        else:
            content_str = content

        human_message = Message(
            content=content_str,
            role='human',
            user_id=user_id,
            action_task_id=conversation.action_task_id,
            conversation_id=conversation_id
        )

        # 根据send_target设置source字段、agent_id和meta字段
        logger.debug(f"[消息处理器] 检查发送目标: send_target={send_target}, target_agent_id={target_agent_id}")
        if send_target == 'supervisor' and target_agent_id:
            human_message.agent_id = target_agent_id
            human_message.source = 'supervisorConversation'
            logger.debug(f"[消息处理器] 用户消息发送给监督者，设置agent_id={target_agent_id}, source=supervisorConversation")
        elif send_target == 'task_intervention' and target_agent_id:
            # 监督者干预：source设为supervisorConversation，设置meta.type为info
            human_message.agent_id = target_agent_id
            human_message.source = 'supervisorConversation'
            # 设置干预meta信息
            if not human_message.meta:
                human_message.meta = {}
            human_message.meta['type'] = 'info'
            logger.debug(f"[消息处理器] 监督者干预消息，设置agent_id={target_agent_id}, source=supervisorConversation, meta.type=info")
        else:
            human_message.source = 'taskConversation'
            logger.debug(f"[消息处理器] 用户消息发送给任务会话，设置source=taskConversation，原因：send_target={send_target}, target_agent_id={target_agent_id}")

        # 存储目标智能体ID信息到meta字段
        if not human_message.meta:
            human_message.meta = {}

        if target_agent_ids:
            human_message.meta['target_agent_ids'] = target_agent_ids
            logger.info(f"[消息处理器] 用户消息指定多个目标智能体ID: {target_agent_ids}")
        elif target_agent_id:
            human_message.meta['target_agent_ids'] = [target_agent_id]
            logger.info(f"[消息处理器] 用户消息指定单个目标智能体ID: {target_agent_id}")
        else:
            # 如果没有指定目标智能体，则表示发送给所有智能体
            logger.info(f"[消息处理器] 用户消息未指定目标智能体，将发送给所有智能体")

        db.session.add(human_message)

        # 更新行动任务的updated_at时间
        if conversation.action_task_id:
            from app.utils.datetime_utils import get_current_time_with_timezone
            action_task = ActionTask.query.get(conversation.action_task_id)
            if action_task:
                action_task.updated_at = get_current_time_with_timezone()
                logger.debug(f"更新行动任务的updated_at时间: 任务ID={conversation.action_task_id}")

        db.session.commit()

        # 写入 Redis 消息缓存
        try:
            from core.model_cache import cache_message
            cache_message(human_message)
        except Exception as _cache_err:
            logger.debug(f"Redis 缓存人类消息失败（不影响业务）: {_cache_err}")

        logger.info(f"创建了人类消息 ID={human_message.id}")

    # 获取目标智能体
    agent = None
    action_task = ActionTask.query.get(conversation.action_task_id)
    if not action_task:
        logger.warning(f"未找到关联的行动任务，无法生成回复，会话ID: {conversation_id}")
        return human_message, None, None, None, None, conversation, None, None, None

    if target_agent_id:
        # 检查目标智能体是否属于此行动任务
        agent_relation = ActionTaskAgent.query.filter_by(
            action_task_id=action_task.id,
            agent_id=target_agent_id
        ).first()

        if agent_relation:
            agent = Agent.query.get(agent_relation.agent_id)
            logger.info(f"从行动任务中获取到目标智能体: {agent.name if agent else 'None'}")
        else:
            logger.warning(f"目标智能体 {target_agent_id} 不属于行动任务 {action_task.id}")
    else:
        # 获取默认智能体
        agent_relation = ActionTaskAgent.query.filter_by(
            action_task_id=action_task.id,
            is_default=True
        ).first()

        if agent_relation:
            agent = Agent.query.get(agent_relation.agent_id)
            logger.info(f"从行动任务中获取到默认智能体: {agent.name if agent else 'None'}")
        else:
            # 如果没有默认智能体，尝试获取行动任务中的第一个智能体
            agent_relation = ActionTaskAgent.query.filter_by(
                action_task_id=action_task.id
            ).first()

            if agent_relation:
                agent = Agent.query.get(agent_relation.agent_id)
                logger.info(f"从行动任务中获取到第一个智能体: {agent.name if agent else 'None'}")

    if not agent:
        logger.warning(f"未找到智能体，无法生成回复，会话ID: {conversation_id}")
        return human_message, None, None, None, None, conversation, None, None, None

    # 获取智能体的角色及其模型配置
    agent_role = None
    role_model = None
    model_settings = {}

    # 从智能体获取角色
    if hasattr(agent, 'role_id') and agent.role_id:
        agent_role = Role.query.get(agent.role_id)
        logger.info(f"从智能体 {agent.id} 获取到角色: {agent_role.name if agent_role else 'None'}")

    # 检查是否为外部角色
    is_external_role = agent_role and agent_role.source == 'external'

    # 从角色获取模型信息
    if is_external_role:
        # 外部角色：从settings.external_config获取配置
        logger.info(f"检测到外部角色: {agent_role.name}")

        if agent_role.settings and 'external_config' in agent_role.settings:
            external_config = agent_role.settings['external_config']
            api_config = external_config.get('api_config', {})
            platform_specific = external_config.get('platform_specific', {})

            # 构建外部角色的模型配置
            # 外部角色的max_tokens从external_config中获取，如果没有则使用默认值
            external_max_tokens = external_config.get('max_tokens', 2000)
            model_settings = {
                'model_id': api_config.get('model', 'external-model'),
                'temperature': agent_role.temperature if agent_role.temperature is not None else 0.7,
                'max_tokens': external_max_tokens,
                'api_url': api_config.get('base_url', ''),
                'api_key': api_config.get('api_key', ''),
                'top_p': agent_role.top_p if agent_role.top_p is not None else 1.0,
                'frequency_penalty': agent_role.frequency_penalty if agent_role.frequency_penalty is not None else 0.0,
                'presence_penalty': agent_role.presence_penalty if agent_role.presence_penalty is not None else 0.0,
                # 外部角色特有配置
                'platform': external_config.get('platform', 'custom'),
                'external_id': external_config.get('external_id', ''),
                'platform_specific': platform_specific
            }

            # 创建一个虚拟的role_model对象用于兼容性
            class ExternalRoleModel:
                def __init__(self, config):
                    self.model_id = config.get('model_id')
                    self.base_url = config.get('api_url')
                    self.api_key = config.get('api_key')
                    self.provider = config.get('platform', 'external')
                    self.temperature = config.get('temperature', 0.7)
                    self.max_output_tokens = config.get('max_tokens', 2000)

            role_model = ExternalRoleModel(model_settings)
            logger.info(f"从外部角色 {agent_role.id} 获取到配置: platform={model_settings.get('platform')}, api_url={model_settings.get('api_url')}")
        else:
            logger.warning(f"外部角色 {agent_role.name} 缺少external_config配置")
            return human_message, agent, agent_role, None, None, conversation, None, None, None
    else:
        # 内部角色：使用原有逻辑
        if agent_role and hasattr(agent_role, 'model') and agent_role.model:
            # 获取模型的配置
            from app.models import ModelConfig
            role_model = ModelConfig.query.get(agent_role.model)
            if role_model:
                # 获取模型配置，为角色参数设置默认值
                model_settings = {
                    'model_id': role_model.model_id,
                    'temperature': agent_role.temperature if agent_role.temperature is not None else 0.7,
                    'max_tokens': role_model.max_output_tokens or 2000,  # max_tokens从模型配置中获取
                    'api_url': role_model.base_url,
                    'api_key': role_model.api_key,
                    'top_p': agent_role.top_p if agent_role.top_p is not None else 1.0,
                    'frequency_penalty': agent_role.frequency_penalty if agent_role.frequency_penalty is not None else 0.0,
                    'presence_penalty': agent_role.presence_penalty if agent_role.presence_penalty is not None else 0.0
                }
                logger.info(f"从内部角色 {agent_role.id} 获取到模型配置: {model_settings}")

        if not role_model:
            # 尝试使用默认文本生成模型
            from app.models import ModelConfig
            role_model = ModelConfig.query.filter_by(is_default_text=True).first()
            if not role_model:
                # 如果没有设置默认文本生成模型，查找第一个支持文本输出的模型
                text_models = ModelConfig.query.filter(
                    ModelConfig.modalities.contains('text_output')
                ).all()
                if text_models:
                    role_model = text_models[0]
            if role_model:
                # 使用默认模型配置，但仍然从角色获取模型参数（如果有的话）
                model_settings = {
                    'model_id': role_model.model_id,
                    'temperature': agent_role.temperature if agent_role and agent_role.temperature is not None else 0.7,
                    'max_tokens': role_model.max_output_tokens or 2000,  # 从模型配置中获取
                    'api_url': role_model.base_url,
                    'api_key': role_model.api_key,
                    'top_p': agent_role.top_p if agent_role and agent_role.top_p is not None else 1.0,
                    'frequency_penalty': agent_role.frequency_penalty if agent_role and agent_role.frequency_penalty is not None else 0.0,
                    'presence_penalty': agent_role.presence_penalty if agent_role and agent_role.presence_penalty is not None else 0.0
                }
                logger.info(f"使用默认模型配置: {model_settings}")

        if not role_model:
            logger.warning("找不到可用的模型配置，无法生成回复")
            return human_message, agent, agent_role, None, None, conversation, None, None, None

    # 检查模型是否支持函数调用（仅内部角色）
    model_supports_function_calling = False
    if not is_external_role and role_model and hasattr(role_model, 'capabilities') and role_model.capabilities:
        model_supports_function_calling = 'function_calling' in role_model.capabilities
        logger.info(f"模型 {role_model.model_id} 是否支持函数调用: {model_supports_function_calling}")

    # 获取历史消息（根据系统设置中的上下文历史消息长度）
    from app.models import SystemSetting
    max_history_length = SystemSetting.get('max_conversation_history_length', 30)
    logger.info(f"使用系统设置的上下文历史消息长度: {max_history_length}")

    # 优先从 Redis 缓存读取历史消息
    recent_messages = None
    try:
        from core.model_cache import get_conversation_messages_cached
        cached_msgs = get_conversation_messages_cached(
            conversation_id,
            roles=['agent', 'human'],
            limit=max_history_length if max_history_length > 0 else 0,
            order_desc=False,
        )
        if cached_msgs:
            # 缓存命中：将 dict 列表转为模拟对象供后续代码使用
            # 后续 format_messages 只读 .role / .content / .agent_id / .meta 等属性
            class _MsgProxy:
                """轻量代理，让 dict 表现得像 ORM Message 对象"""
                def __init__(self, d):
                    self.__dict__.update(d)
                def __getattr__(self, name):
                    return self.__dict__.get(name)

            recent_messages = [_MsgProxy(m) for m in cached_msgs]
            logger.debug(f"从 Redis 缓存获取 {len(recent_messages)} 条历史消息")
    except Exception as _cache_err:
        logger.debug(f"Redis 读取历史消息失败（fallback DB）: {_cache_err}")

    # Redis 未命中 → 从 DB 查询（原始逻辑）
    if recent_messages is None:
        query = Message.query.filter(
            Message.conversation_id == conversation_id,
            Message.role.in_(['agent', 'human'])
        ).order_by(Message.created_at.desc())

        if max_history_length == 0:
            logger.info("上下文历史消息长度设置为0，获取所有历史消息")
        else:
            query = query.limit(max_history_length)

        recent_messages = query.all()
        recent_messages.reverse()

    # 开始构建提示词
    # 获取提示模板
    prompt_template = None
    if agent_role and hasattr(agent_role, 'system_prompt') and agent_role.system_prompt:
        prompt_template = agent_role.system_prompt
        logger.info(f"从角色 {agent_role.id} 获取到提示模板")

    # 添加角色工具能力
    role_capabilities = []
    tool_definitions = []  # 用于存储工具定义
    tool_names = []        # 用于存储工具名称
    
    # 从系统配置读取是否压缩工具定义
    from app.models import SystemSetting
    compress_tools = SystemSetting.get('compress_tool_definitions', False)
    tool_compression_count = 0  # 记录压缩的工具数量

    if agent_role:
        # 查询角色的能力
        role_capability_relations = RoleCapability.query.filter_by(role_id=agent_role.id).all()
        for rc in role_capability_relations:
            capability = Capability.query.get(rc.capability_id)
            if capability:
                role_capabilities.append(capability.name)

                # 只有当模型支持function_calling时，才继续解析工具
                if capability.tools and model_supports_function_calling:
                    # 获取能力关联的工具
                    for server_name, server_tools in capability.tools.items():
                        if isinstance(server_tools, list) and server_tools:
                            try:
                                # 使用全局mcp_manager实例，避免重复创建和加载配置
                                from app.services.mcp_server_manager import mcp_manager

                                # 优先从缓存获取工具定义
                                all_server_tools = None
                                if tool_schema_cache.has_tools(server_name):
                                    logger.debug(f"从缓存获取服务器 {server_name} 的工具定义")
                                    all_server_tools = tool_schema_cache.get_tools(server_name)
                                else:
                                    # 如果缓存中没有，则从服务器获取
                                    logger.debug(f"缓存中没有服务器 {server_name} 的工具定义，从服务器获取")
                                    all_server_tools = mcp_manager.get_tools(server_name)
                                    # 将获取到的工具定义缓存起来
                                    if all_server_tools:
                                        tool_schema_cache.set_tools(server_name, all_server_tools)

                                # 确保工具列表存在
                                tools_list = []
                                if isinstance(all_server_tools, dict) and "tools" in all_server_tools:
                                    tools_list = all_server_tools["tools"]
                                elif isinstance(all_server_tools, list):
                                    tools_list = all_server_tools

                                # 根据角色能力中指定的工具名称筛选
                                for tool in tools_list:
                                    # 获取工具名称
                                    tool_name = None

                                    # 已经是标准格式
                                    if isinstance(tool, dict) and "function" in tool and isinstance(tool["function"], dict) and "name" in tool["function"]:
                                        tool_name = tool["function"]["name"]
                                    # 直接包含name字段
                                    elif isinstance(tool, dict) and "name" in tool:
                                        tool_name = tool.get("name")
                                        # 转换成标准格式（去重检查）
                                        if tool_name and tool_name in server_tools and tool_name not in tool_names:
                                            # 创建标准格式的工具定义
                                            standardized_tool = {
                                                "type": "function",
                                                "function": {
                                                    "name": tool_name,
                                                    "description": tool.get("description", f"工具: {tool_name}"),
                                                    "parameters": tool.get("parameters", tool.get("inputSchema", {
                                                        "type": "object",
                                                        "properties": {},
                                                        "required": []
                                                    }))
                                                }
                                            }
                                            # 如果启用压缩，压缩工具定义
                                            if compress_tools:
                                                standardized_tool = compress_tool_definition(standardized_tool)
                                                tool_compression_count += 1
                                            tool_definitions.append(standardized_tool)
                                            tool_names.append(tool_name)
                                            continue

                                    # 如果工具名在配置的tools列表中且已经是标准格式，直接添加（去重检查）
                                    if tool_name and tool_name in server_tools and tool_name not in tool_names:
                                        # 如果启用压缩，压缩工具定义
                                        if compress_tools:
                                            tool = compress_tool_definition(tool)
                                            tool_compression_count += 1
                                        tool_definitions.append(tool)
                                        tool_names.append(tool_name)

                            except Exception as e:
                                logger.error(f"获取服务器 {server_name} 的工具失败: {str(e)}")

    # 注入技能工具（如果角色绑定了技能）
    if agent_role and model_supports_function_calling:
        try:
            from app.services.skill_service import SkillService
            skill_service = SkillService()
            skills_metadata = skill_service.get_skill_metadata_for_prompt(agent_role.id)
            if skills_metadata:
                from app.mcp_servers.skill_server import SKILL_TOOLS
                for tool in SKILL_TOOLS:
                    tool_name = tool["name"]
                    if tool_name not in tool_names:
                        std_tool = {
                            "type": "function",
                            "function": {
                                "name": tool_name,
                                "description": tool["description"],
                                "parameters": tool.get("inputSchema", {
                                    "type": "object",
                                    "properties": {},
                                    "required": []
                                })
                            }
                        }
                        if compress_tools:
                            std_tool = compress_tool_definition(std_tool)
                            tool_compression_count += 1
                        tool_definitions.append(std_tool)
                        tool_names.append(tool_name)
                logger.info(f"[Skill工具注入] 角色 {agent_role.id} 绑定了 {len(skills_metadata)} 个技能，注入了 {len(SKILL_TOOLS)} 个skill工具")
        except Exception as e:
            logger.error(f"注入技能工具失败: {e}")

    # 输出工具压缩统计信息
    if compress_tools and tool_compression_count > 0:
        logger.info(f"[工具定义优化] 已压缩 {tool_compression_count} 个工具定义，预计节省约70%的Token")

    # 准备对话历史上下文（如果不是隔离模式且有target_agent_id）
    # v4.0 改进：将所有历史消息（包括当前agent自己的历史）都放入system prompt
    # 这样可以确保 messages 数组始终是 [system, user] 格式，兼容 Claude API
    other_agents_context = None
    
    if not isolation_mode and target_agent_id and recent_messages:
        logger.debug(f"[多Agent模式] 准备对话历史上下文，target_agent_id={target_agent_id}")
        
        # 获取是否在上下文中包含思考内容的系统设置
        from app.models import SystemSetting
        include_thinking = SystemSetting.get('include_thinking_content_in_context', False)
        
        # v4.0: 将所有历史消息都放入 system prompt（不再区分连续消息和历史消息）
        all_history_messages = []
        for msg in recent_messages:
            # 跳过最新的用户消息（避免重复，因为会作为当前 user 消息添加）
            if msg.role == "human" and msg.content == content:
                continue
            all_history_messages.append(msg)
        
        logger.info(f"[多Agent模式] 将 {len(all_history_messages)} 条历史消息放入system prompt")
        
        # 格式化所有对话历史（包括user消息、所有agents的消息）
        if all_history_messages:
            # 传入 current_agent_id 用于在历史中标注"你的历史回复"
            other_agents_context = _format_conversation_history(all_history_messages, current_agent_id=target_agent_id, include_thinking=include_thinking)
            logger.info(f"[多Agent模式] 格式化了对话历史，共 {len(all_history_messages)} 条消息")
    
    # 构建系统提示词（包含other_agents_context）
    system_prompt = build_system_prompt(
        agent=agent,
        agent_role=agent_role,
        action_task=action_task,
        conversation=conversation,
        tool_definitions=tool_definitions,
        tool_names=tool_names,
        role_capabilities=role_capabilities,
        model_supports_function_calling=model_supports_function_calling,
        other_agents_context=other_agents_context
    )

    # 格式化为模型可用的消息格式
    # v4.0: 非隔离模式下不再传递 continuous_own_messages，因为所有历史都在 system prompt 中
    model_messages = format_messages(system_prompt, recent_messages, content, human_message, target_agent_id, isolation_mode, None)

    # 记录将要使用的模型设置
    logger.info(f"使用模型配置: model_id={model_settings.get('model_id')}, temperature={model_settings.get('temperature')}, max_tokens={model_settings.get('max_tokens')}")

    # 准备智能体信息和角色模型参数
    agent_info = {
        'id': agent.id,
        'name': agent.name,
        'role_id': agent_role.id if agent_role else None,
        'role_name': agent_role.name if agent_role else None,
        'capabilities': role_capabilities,
        'tool_names': tool_names,
        'tools': tool_definitions,  # 添加工具定义到agent_info
        'provider': role_model.provider if role_model else 'unknown',  # 添加provider到agent_info
        'is_external': is_external_role,  # 标识是否为外部角色
        'platform': model_settings.get('platform') if is_external_role else None,  # 外部平台类型
        'external_config': {  # 完整的外部配置
            'platform': model_settings.get('platform'),
            'external_id': model_settings.get('external_id'),
            'api_config': {
                'api_key': model_settings.get('api_key'),
                'base_url': model_settings.get('api_url'),
                'model': model_settings.get('model_id')
            },
            'platform_specific': model_settings.get('platform_specific', {})
        } if is_external_role else None
    }

    # 构建角色模型参数，用于传递给LLM API
    role_model_params = {
        'temperature': model_settings.get('temperature', 0.7),
        'max_tokens': model_settings.get('max_tokens', 2000),
        'top_p': model_settings.get('top_p'),
        'frequency_penalty': model_settings.get('frequency_penalty'),
        'presence_penalty': model_settings.get('presence_penalty')
    }

    # 添加调试日志，确认参数传递
    logger.info(f"构建的角色模型参数: {role_model_params}")
    logger.info(f"原始模型设置: temperature={model_settings.get('temperature')}, top_p={model_settings.get('top_p')}, frequency_penalty={model_settings.get('frequency_penalty')}, presence_penalty={model_settings.get('presence_penalty')}")

    return human_message, agent, agent_role, role_model, model_messages, conversation, role_model_params, agent_info, model_settings

# build_system_prompt 已移至 prompt_builder.py，通过顶部导入使用

def format_messages(system_prompt, recent_messages, current_content, human_message, target_agent_id=None, isolation_mode=False, continuous_own_messages=None):
    """格式化消息为模型可用的格式 / Format messages for model use

    Args:
        system_prompt: 系统提示词 / System prompt
        recent_messages: 最近的消息列表 / Recent messages list
        current_content: 当前消息内容 / Current message content
        human_message: 人类消息对象 / Human message object
        target_agent_id: 目标智能体ID / Target agent ID
        isolation_mode: 隔离模式，True时只显示目标智能体与用户的消息 / Isolation mode, when True only show messages between target agent and user
        continuous_own_messages: 当前agent的连续消息列表（用于多agent模式）/ Continuous messages from current agent (for multi-agent mode)

    Returns:
        list: 格式化后的消息列表 / Formatted message list
    """
    from app.models import SystemSetting
    import re
    import json
    import uuid

    # 获取是否在上下文中包含思考内容的系统设置 / Get system setting for whether to include thinking content in context
    include_thinking = SystemSetting.get('include_thinking_content_in_context', False)
    logger.debug(f"是否在上下文中包含思考内容: {include_thinking}")

    # 获取是否将工具调用拆分为独立历史消息的系统设置 / Get system setting for whether to split tool calls into separate history messages
    split_tool_calls = SystemSetting.get('split_tool_calls_in_history', True)
    logger.debug(f"是否将工具调用拆分为独立历史消息: {split_tool_calls}")

    model_messages = []

    # 注意：system_prompt 已经在 process_message_common 中包含了 other_agents_context
    # 添加系统提示词 / Add system prompt
    model_messages.append({
        "role": "system",
        "content": system_prompt
    })

    # 如果是隔离模式，使用旧的逻辑（不改变隔离模式的行为）
    if isolation_mode and target_agent_id:
        logger.debug(f"[隔离模式] 使用传统的消息过滤逻辑")
        # 添加历史消息 / Add historical messages
        if recent_messages:
            for msg in recent_messages:
                # 确保跳过最新的用户消息 / Skip the latest user message
                if msg.role == "human" and msg.content == current_content:
                    continue

                # 隔离模式过滤：只显示目标智能体与用户的消息
                if (msg.role == "agent" or msg.role == "supervisor") and msg.agent_id:
                    if str(msg.agent_id) != str(target_agent_id):
                        logger.debug(f"隔离模式：跳过非目标智能体的消息，消息智能体ID={msg.agent_id}，目标智能体ID={target_agent_id}")
                        continue
                # 用户消息始终保留

                # 根据消息角色添加
                if msg.role == "human":
                    model_messages.append({
                        "role": "user",
                        "content": msg.content
                    })
                elif (msg.role == "agent" or msg.role == "supervisor") and msg.agent_id:
                    # 处理智能体消息
                    expanded_messages = _expand_assistant_message_with_tool_calls(msg, include_thinking, split_tool_calls)
                    model_messages.extend(expanded_messages)
    else:
        # 非隔离模式（多Agent模式）：所有历史消息已在 system prompt 中
        # v4.0 改进：不再添加 continuous_own_messages 作为 assistant
        # 这样可以确保 messages 数组始终是 [system, user] 格式
        # 兼容 Claude API 要求（必须以 user 开头）
        logger.debug(f"[多Agent模式] 所有历史消息已在system prompt中，messages只包含当前user消息")

    # 添加当前用户消息 / Add current user message
    model_messages.append({
        "role": "user",
        "content": current_content
    })

    return model_messages


def _expand_assistant_message_with_tool_calls(msg, include_thinking=False, split_tool_calls=True):
    """
    将包含工具调用的assistant消息扩展为独立的消息列表，保持工具调用在内容中的原始顺序

    Args:
        msg: 数据库中的消息对象
        include_thinking: 是否包含思考内容
        split_tool_calls: 是否将工具调用拆分为独立的历史消息

    Returns:
        list: 扩展后的消息列表，按原始顺序包含assistant、tool等角色的消息
    """
    import re
    import json
    import uuid

    # 处理智能体消息中的思考内容 / Handle thinking content in agent messages
    message_content = msg.content

    # 检查消息是否包含思考内容 / Check if message contains thinking content
    has_thinking_content = '<thinking>' in message_content or '<think>' in message_content

    # 如果不包含思考内容，则移除<thinking>标签及其内容 / If not including thinking content, remove <thinking> tags and their content
    if not include_thinking and has_thinking_content:
        # 记录原始内容长度 / Record original content length
        original_length = len(message_content)

        # 查找所有<thinking>和<think>标签内容，用于日志记录 / Find all <thinking> and <think> tag content for logging
        thinking_contents = re.findall(r'<thinking>(.*?)</thinking>', message_content, flags=re.DOTALL)
        think_contents = re.findall(r'<think>(.*?)</think>', message_content, flags=re.DOTALL)
        all_thinking_contents = thinking_contents + think_contents
        if all_thinking_contents:
            logger.debug(f"找到 {len(thinking_contents)} 个<thinking>标签内容和 {len(think_contents)} 个<think>标签内容")
            for i, content in enumerate(all_thinking_contents):
                tag_type = "<thinking>" if i < len(thinking_contents) else "<think>"
                logger.debug(f"{tag_type}标签 #{i+1} 内容前20个字符: {content[:20]}...")

        # 移除<thinking>...</thinking>标签及其内容，使用非贪婪匹配确保只匹配每对标签之间的内容 / Remove <thinking>...</thinking> tags and content using non-greedy matching
        message_content = re.sub(r'<thinking>.*?</thinking>', '', message_content, flags=re.DOTALL)

        # 移除<think>...</think>标签及其内容，同样使用非贪婪匹配 / Remove <think>...</think> tags and content using non-greedy matching
        message_content = re.sub(r'<think>.*?</think>', '', message_content, flags=re.DOTALL)

        # 记录移除后的内容长度 / Record content length after removal
        new_length = len(message_content)
        logger.info(f"从消息中移除思考内容: 原始长度={original_length}, 新长度={new_length}, 移除了{original_length - new_length}个字符")

    # 获取智能体信息 / Get agent information
    agent_name = None
    role_name = None

    # 尝试从消息中获取智能体信息 / Try to get agent information from message
    if msg.agent_id:
        from app.models import Agent, Role
        agent = Agent.query.get(msg.agent_id)
        if agent:
            agent_name = agent.name
            if hasattr(agent, 'role_id') and agent.role_id:
                role = Role.query.get(agent.role_id)
                if role:
                    role_name = role.name

    # 按顺序解析消息内容，保持工具调用的原始位置 / Parse message content in order, maintaining original tool call positions
    message_segments = _parse_message_segments_with_tool_calls(message_content)

    expanded_messages = []

    # 检查是否包含工具调用以及是否需要扩展 / Check if contains tool calls and whether to expand
    has_tool_calls = any(segment['type'] == 'tool_result' for segment in message_segments)

    # 如果有工具调用且配置为拆分工具调用，按顺序创建消息序列 / If there are tool calls and configured to split them, create message sequence in order
    if has_tool_calls and split_tool_calls:
        logger.debug(f"在消息中发现工具调用，将按原始顺序扩展为独立消息")

        # 按顺序处理每个段落 / Process each segment in order
        current_assistant_content = ""

        for segment in message_segments:
            if segment['type'] == 'content':
                # 累积文本内容 / Accumulate text content
                current_assistant_content += segment['content']
            elif segment['type'] == 'tool_result':
                # 遇到工具调用结果，需要先创建包含工具调用的assistant消息
                # 然后立即创建tool消息

                # 创建assistant消息（包含当前内容和工具调用）
                # 注意：这里只保留纯文本内容，不包含JSON格式的工具调用
                assistant_message = {
                    "role": "assistant",
                    "content": current_assistant_content.strip(),
                    "tool_calls": [segment['tool_call']]
                }

                expanded_messages.append(assistant_message)

                # 立即添加tool消息
                # segment['content'] 已经是从JSON中提取的纯文本（由_parse_message_segments_with_tool_calls处理）
                tool_message = {
                    "role": "tool",
                    "tool_call_id": segment['tool_call']['id'],
                    "content": segment['content']  # 这里是纯文本，不包含JSON格式
                }
                expanded_messages.append(tool_message)

                # 重置当前内容
                current_assistant_content = ""

        # 处理最后剩余的内容
        if current_assistant_content.strip():
            assistant_message = {
                "role": "assistant",
                "content": current_assistant_content.strip()
            }

            expanded_messages.append(assistant_message)

        logger.debug(f"扩展消息完成：共生成 {len(expanded_messages)} 个消息，所有JSON格式已转换为纯文本")
    elif has_tool_calls and not split_tool_calls:
        # 有工具调用但配置为不拆分，保留完整内容包括工具调用结果 / Has tool calls but configured not to split, keep complete content including tool results
        logger.debug(f"在消息中发现工具调用，但配置为不拆分，将保留完整内容")

        # 重建完整内容，包括文本和工具调用结果 / Rebuild complete content including text and tool results
        complete_content = ""
        for segment in message_segments:
            if segment['type'] == 'content':
                complete_content += segment['content']
            elif segment['type'] == 'tool_result':
                # 将工具调用结果以文本形式添加到内容中 / Add tool call results as text to content
                tool_name = segment['tool_call']['function']['name']
                tool_result = segment['content']
                complete_content += f"\n[工具调用结果 - {tool_name}]: {tool_result}\n"

        # 清理多余的空行 / Clean up extra empty lines
        complete_content = re.sub(r'\n\s*\n\s*\n', '\n\n', complete_content)
        complete_content = complete_content.strip()

        # 不添加HTML注释，保持原始内容
        # （之前的HTML注释会影响LLM学习，已移除）

        expanded_messages.append({
            "role": "assistant",
            "content": complete_content
        })

        logger.debug(f"保留完整内容完成，生成1个assistant消息")
    else:
        # 没有工具调用，说明_parse_message_segments_with_tool_calls解析失败
        # 使用tool_json_utils清理JSON
        logger.warning(f"_parse_message_segments_with_tool_calls未识别到工具调用，尝试手动清理JSON")
        
        from app.services.conversation.tool_json_utils import remove_tool_result_jsons
        cleaned_content = remove_tool_result_jsons(message_content)
        
        if cleaned_content.strip():
            expanded_messages.append({
                "role": "assistant",
                "content": cleaned_content
            })
            logger.info(f"手动清理了工具调用JSON，内容长度: {len(cleaned_content)}")
        else:
            # 如果清理后内容为空，保留原始内容（避免空消息）
            expanded_messages.append({
                "role": "assistant",
                "content": message_content
            })
            logger.warning(f"清理JSON后内容为空，保留原始内容")

    return expanded_messages


def _convert_tool_calls_to_inline(message_content):
    """
    将消息中的工具调用转换为内联HTML注释格式
    
    Args:
        message_content: 原始消息内容
    
    Returns:
        str: 转换后的内容，工具调用以HTML注释形式内联
    """
    # 解析消息中的工具调用
    segments = _parse_message_segments_with_tool_calls(message_content)
    
    result_parts = []
    for segment in segments:
        if segment['type'] == 'content':
            result_parts.append(segment['content'])
        elif segment['type'] == 'tool_result':
            tool_call = segment['tool_call']
            tool_name = tool_call['function']['name']
            tool_result = segment['content']
            
            # 从系统设置读取工具结果最大长度，0表示不截断
            from app.models import SystemSetting
            tool_result_max_length = SystemSetting.get('tool_result_max_length', 2000)
            
            # 截断过长的结果
            if tool_result_max_length > 0 and len(tool_result) > tool_result_max_length:
                tool_result = tool_result[:tool_result_max_length] + "...(truncated)"
            
            # 转换为内联格式（省略参数以节省Token）
            inline_tool = f"""
<!--Tool Call: {tool_name}-->
<!--Result: {tool_result}-->
"""
            result_parts.append(inline_tool)
    
    return "".join(result_parts)


def _format_conversation_history(messages, current_agent_id, include_thinking=True):
    """
    将对话历史（包括user消息和其他agents的消息）格式化为system prompt的补充内容
    将工具调用转换为标准格式描述，避免LLM学习JSON格式
    
    Args:
        messages: 消息列表（user + other agents，不包括current agent）
        current_agent_id: 当前智能体ID（用于过滤）
        include_thinking: 是否包含思考内容
    
    Returns:
        str: 格式化后的对话历史，如果没有消息则返回None
    """
    if not messages:
        return None
    
    formatted_parts = []
    
    for msg in messages:
        if msg.role == "human":
            # 格式化用户消息
            formatted_msg = f"""**User said:**
{msg.content.strip()}"""
            formatted_parts.append(formatted_msg)
            logger.debug(f"[格式化对话历史] User消息，长度: {len(msg.content)}")
            
        elif (msg.role == "agent" or msg.role == "supervisor") and msg.agent_id:
            # v4.0: 包含所有agents的消息（包括当前agent自己的历史）
            # 当前agent的消息会被标注为"你的历史回复"
            is_current_agent = current_agent_id and str(msg.agent_id) == str(current_agent_id)
            
            # 获取智能体信息
            agent_name = "Unknown Agent"
            role_name = "Unknown Role"
            role_indicator = "Agent"
            agent_id = "unknown"
            
            agent = Agent.query.get(msg.agent_id)
            if agent:
                agent_name = agent.name
                agent_id = agent.id
                if hasattr(agent, 'role_id') and agent.role_id:
                    role = Role.query.get(agent.role_id)
                    if role:
                        role_name = role.name
                role_indicator = "Supervisor" if msg.role == "supervisor" else "Agent"
            
            # 处理消息内容
            message_content = msg.content
            
            # 移除思考内容（如果需要）
            if not include_thinking:
                message_content = re.sub(r'<thinking>.*?</thinking>', '', message_content, flags=re.DOTALL)
                message_content = re.sub(r'<think>.*?</think>', '', message_content, flags=re.DOTALL)
            
            # 解析工具调用，转换为标准格式描述
            segments = _parse_message_segments_with_tool_calls(message_content)
            
            # 分离文本内容和工具调用
            # 注意：只保留纯文本内容，不包含JSON格式的工具调用
            text_parts = []
            tool_calls_info = []
            
            for segment in segments:
                if segment['type'] == 'content':
                    # 只添加纯文本内容，跳过可能包含JSON的部分
                    content_text = segment['content'].strip()
                    # 重要：只添加非空且不包含JSON标识的文本
                    if content_text and '{"content": null' not in content_text and '"toolResult"' not in content_text:
                        text_parts.append(content_text)
                elif segment['type'] == 'tool_result':
                    tc = segment['tool_call']
                    tool_result = segment['content']
                    
                    # 从系统设置读取工具结果最大长度
                    from app.models import SystemSetting
                    tool_result_max_length = SystemSetting.get('tool_result_max_length', 2000)
                    
                    # 截断过长的结果
                    if tool_result_max_length > 0 and len(tool_result) > tool_result_max_length:
                        tool_result = tool_result[:tool_result_max_length] + "...(truncated)"
                    
                    tool_calls_info.append({
                        'name': tc['function']['name'],
                        'arguments': tc['function']['arguments'],
                        'result': tool_result
                    })
            
            # 构建标准格式的消息描述
            message_parts = []
            
            # 添加文本内容（使用换行连接，保持段落结构）
            if text_parts:
                text_content = "\n\n".join(text_parts).strip()
                if text_content:
                    message_parts.append(text_content)
            
            # 添加工具调用（标准格式描述，避免JSON格式）
            for tc_info in tool_calls_info:
                # 解析arguments（如果是JSON字符串）
                try:
                    if isinstance(tc_info['arguments'], str):
                        args_dict = json.loads(tc_info['arguments'])
                        # 格式化为易读的参数列表
                        args_str = ", ".join([f"{k}={repr(v)}" for k, v in args_dict.items()])
                    else:
                        args_str = str(tc_info['arguments'])
                except:
                    args_str = tc_info['arguments']
                
                tool_call_desc = (
                    f"\n**[Tool Call]** {tc_info['name']}({args_str})\n"
                    f"**[Result]** {tc_info['result']}\n"
                )
                message_parts.append(tool_call_desc)
            
            # 构建这条消息的格式化内容
            message_text = "\n".join(message_parts)
            
            # v4.0: 如果是当前agent的消息，标注为"你的历史回复"
            if is_current_agent:
                formatted_msg = f"""**You ({agent_name}) [{role_name}] previously said:**
{message_text}"""
            else:
                formatted_msg = f"""**{agent_name} [{role_name}] [{role_indicator}] [ID: {agent_id}] said:**
{message_text}"""
            
            formatted_parts.append(formatted_msg)
            logger.debug(f"[格式化对话历史] {agent_name} [ID: {agent_id}], 文本长度: {len(message_text)}, 工具调用数: {len(tool_calls_info)}")
            
            # 添加详细调试：输出转换后的内容片段
            if tool_calls_info:
                logger.debug(f"[格式化对话历史] 转换后的消息片段（前500字符）: {message_text[:500]}")
                # 检查是否还包含JSON格式
                if '{"content": null' in message_text or '"toolResult"' in message_text:
                    logger.warning(f"[格式化对话历史] 警告：转换后的消息仍包含JSON格式！")
    
    if not formatted_parts:
        return None
    
    result = "\n\n".join(formatted_parts)
    logger.info(f"[格式化对话历史] 共格式化 {len(formatted_parts)} 条消息，总长度: {len(result)}")
    return result


def _format_message_with_tool_calls(message_content):
    """
    格式化包含工具调用的消息，保留原始结构以便LLM学习
    
    Args:
        message_content: 原始消息内容（可能包含工具调用JSON）
    
    Returns:
        str: 格式化后的内容，保留工具调用的结构化信息
    """
    # 解析消息中的工具调用
    segments = _parse_message_segments_with_tool_calls(message_content)
    
    result_parts = []
    for segment in segments:
        if segment['type'] == 'content':
            result_parts.append(segment['content'])
        elif segment['type'] == 'tool_result':
            tool_call = segment['tool_call']
            tool_name = tool_call['function']['name']
            tool_result = segment['content']
            
            # 从系统设置读取工具结果最大长度，0表示不截断
            from app.models import SystemSetting
            tool_result_max_length = SystemSetting.get('tool_result_max_length', 2000)
            
            # 截断过长的结果
            if tool_result_max_length > 0 and len(tool_result) > tool_result_max_length:
                tool_result = tool_result[:tool_result_max_length] + "...(truncated)"
            
            # 精简格式：只保留工具名称和结果，省略参数以节省Token
            tool_info = f"""
[Called tool: {tool_name}]
[Result: {tool_result}]
"""
            result_parts.append(tool_info)
    
    return "".join(result_parts)


def _parse_message_segments_with_tool_calls(content):
    """
    按顺序解析消息内容，将其分割为文本段落和工具调用结果段落

    Args:
        content: 消息内容字符串

    Returns:
        list: 段落列表，每个段落包含type和content字段
            - type: 'content' 或 'tool_result'
            - content: 段落内容
            - tool_call: 工具调用信息（仅当type为'tool_result'时）
    """
    import json
    import uuid
    from app.services.conversation.tool_json_utils import extract_tool_result_jsons

    segments = []

    try:
        # 提取所有工具调用结果JSON
        tool_results = extract_tool_result_jsons(content)

        # 添加调试日志
        logger.debug(f"[工具调用解析] 消息内容长度: {len(content)}")
        logger.debug(f"[工具调用解析] 找到工具调用结果数量: {len(tool_results)}")

        # 如果没有找到工具调用结果但内容中包含可能的标识，记录警告
        if not tool_results and ('toolResult' in content or 'tool_call_id' in content):
            logger.warning(f"[工具调用解析] 消息中可能包含工具调用结果但未被解析器识别")
            logger.warning(f"[工具调用解析] 消息内容前500字符: {content[:500]}")

        if not tool_results:
            # 没有工具调用结果，整个内容作为一个文本段落
            segments.append({
                'type': 'content',
                'content': content
            })
            return segments

        # 按位置顺序处理内容
        last_end = 0

        for obj, start_pos, end_pos in tool_results:
            # 添加工具调用结果之前的文本内容
            if start_pos > last_end:
                text_content = content[last_end:start_pos]
                # 只添加非空的纯文本内容（JSON会被跳过，因为它们被识别为tool_result）
                if text_content.strip():
                    segments.append({
                        'type': 'content',
                        'content': text_content
                    })

            # 解析工具调用结果
            try:
                meta = obj['meta']
                tool_call_id = meta.get('tool_call_id', str(uuid.uuid4()))
                tool_name = meta.get('tool_name', 'unknown_tool')
                tool_content = meta.get('content', '')
                tool_parameter = meta.get('tool_parameter', '{}')

                # 如果 content 是 JSON 字符串，需要进一步解析提取实际文本
                if isinstance(tool_content, str) and tool_content.strip().startswith('{'):
                    try:
                        content_obj = json.loads(tool_content)
                        # MCP 工具返回格式: {"meta": null, "content": [{"type": "text", "text": "..."}], ...}
                        if isinstance(content_obj, dict) and 'content' in content_obj:
                            content_list = content_obj['content']
                            if isinstance(content_list, list) and len(content_list) > 0:
                                # 提取所有 text 字段并合并
                                text_parts = []
                                for item in content_list:
                                    if isinstance(item, dict) and 'text' in item:
                                        text_parts.append(item['text'])
                                if text_parts:
                                    tool_content = '\n'.join(text_parts)
                                    logger.debug(f"[工具调用解析] 从 MCP 格式中提取文本，长度: {len(tool_content)}")
                    except json.JSONDecodeError:
                        # 如果解析失败，保持原始内容
                        logger.debug(f"[工具调用解析] content 不是有效的 JSON，保持原始内容")
                        pass

                # 创建工具调用对象
                tool_call = {
                    "id": tool_call_id,
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": tool_parameter
                    }
                }

                # 添加工具调用结果段落
                segments.append({
                    'type': 'tool_result',
                    'content': tool_content,
                    'tool_call': tool_call
                })

                logger.debug(f"解析到工具调用结果段落: {tool_name}, 位置: {start_pos}-{end_pos}, 内容长度: {len(tool_content)}")

            except Exception as e:
                logger.warning(f"处理工具调用结果时出错: {e}")
                # 如果处理失败，将其作为普通文本处理
                segments.append({
                    'type': 'content',
                    'content': content[start_pos:end_pos]
                })

            last_end = end_pos

        # 添加最后剩余的文本内容
        if last_end < len(content):
            remaining_content = content[last_end:]
            # 只添加非空的纯文本内容（JSON会被跳过，因为它们被识别为tool_result）
            if remaining_content.strip():
                segments.append({
                    'type': 'content',
                    'content': remaining_content
                })

        logger.debug(f"消息内容分割为 {len(segments)} 个段落")

    except Exception as e:
        logger.error(f"解析消息段落时出错: {e}")
        # 出错时返回整个内容作为文本段落
        segments = [{
            'type': 'content',
            'content': content
        }]

    return segments