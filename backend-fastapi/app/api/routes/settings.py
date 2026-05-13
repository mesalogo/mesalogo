"""
系统设置 API 路由

Flask → FastAPI 变更:
- current_app.config → settings 单例
- current_app.logger → logger
- jsonify() → 直接返回 dict
"""
import json
import logging
from fastapi import APIRouter, HTTPException, Request
from app.models import SystemSetting
from app.extensions import db
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── 默认提示词模板（从 Flask 版本原样保留） ───
DEFAULT_PROMPT_TEMPLATES = {
    'roleSystemPrompt': '''请根据以下角色信息生成一个专业的系统提示词：\n\n角色名称：{{name}}\n角色描述：{{description}}\n\n要求：\n1. 系统提示词应该清晰地定义角色的身份、专业领域和能力\n2. 包含角色的行为准则和回答风格\n3. 明确角色的职责范围和限制\n4. 使用专业、准确的语言\n5. 长度适中，既要详细又要简洁\n\n请直接返回系统提示词内容，不需要额外的解释。''',
    'actionSpaceBackground': '''请根据以下多智能体行动空间信息生成专业的背景设定：\n\n行动空间名称：{{name}}\n行动空间描述：{{description}}\n\n要求：\n1. 背景设定应该详细描述行动空间的环境、场景和上下文\n2. 包含相关的历史背景、现状分析和发展趋势\n3. 明确行动空间的目标和意义\n4. 使用生动、具体的语言描述\n5. 为参与者提供充分的情境信息\n\n请直接返回背景设定内容，不需要额外的解释。''',
    'actionSpaceRules': '''请根据以下行动空间信息生成专业的基本规则：\n\n行动空间名称：{{name}}\n行动空间描述：{{description}}\n\n要求：\n1. 基本规则应该明确定义行动空间内的行为准则和约束条件\n2. 包含参与者的权限和责任范围\n3. 规定交互方式和协作机制\n4. 明确决策流程和执行标准\n5. 包含风险控制和异常处理规则\n6. 使用清晰、准确的语言表述\n7. 条理清晰，便于理解和执行\n\n请直接返回基本规则内容，不需要额外的解释。''',
    'actionTaskDescription': '''请根据以下信息生成详细的行动任务描述：\n\n任务名称：{{title}}\n行动空间名称：{{action_space_name}}\n行动空间描述：{{action_space_description}}\n参与角色：{{roles}}\n\n要求：\n1. 任务描述应该明确任务的目标和预期成果\n2. 详细说明任务的执行步骤和关键节点\n3. 明确各角色的职责分工和协作方式\n4. 包含任务的评估标准和成功指标\n5. 考虑可能的风险和应对措施\n6. 使用清晰、具体的语言描述\n7. 确保任务的可执行性和可衡量性\n\n请直接返回任务描述内容，不需要额外的解释。''',
    'userMessageExpand': '''请根据以下信息扩展和优化要发送给智能体的用户消息，要求以用户身份输出：\n\n原始消息：{{original_message}}\n当前行动空间：{{action_space_name}}\n行动空间描述：{{action_space_description}}\n参与角色：{{participant_roles}}\n辅助模式：{{assist_mode}}\n\n要求：\n1. 保持原始消息的核心意图和目的\n2. 根据行动空间背景和参与角色，调整语言风格和专业程度\n3. 补充必要的上下文信息和细节\n4. 确保消息清晰、具体、易于理解\n\n请直接返回优化后的消息内容，不需要额外的解释。''',
    'oneClickRoleGeneration': '''请根据以下用户需求生成2-8个协作的智能体角色配置：\n\n用户需求：{{user_requirement}}\n\n请分析需求，设计必要的多个角色来协作完成任务。请生成一个JSON数组，包含2-8个角色对象。''',
    'oneClickActionSpaceGeneration': '''请根据以下信息生成行动空间配置：\n\n用户需求：{{user_requirement}}\n角色信息：{{roles_info}}\n\n请生成一个JSON格式的行动空间配置。''',
    'oneClickRulesGeneration': '''请根据以下信息生成3-5个多角色协作规则：\n\n用户需求：{{user_requirement}}\n角色信息：{{roles_info}}\n行动空间信息：{{action_space_info}}\n\n请生成一个JSON数组，包含3-5个规则对象。''',
    'oneClickTaskGeneration': '''请根据以下信息生成多角色协作任务配置：\n\n用户需求：{{user_requirement}}\n角色信息：{{roles_info}}\n行动空间信息：{{action_space_info}}\n规则信息：{{rules_info}}\n\n请生成一个JSON格式的任务配置。''',
    'experimentProtocolGeneration': '''请根据以下并行实验配置，生成一份清晰的实验行为协议。'''
}

# 文档解析器默认配置
DEFAULT_DOCUMENT_PARSER_TOOL = "mineru"
DEFAULT_DOCUMENT_PARSER_MINERU_CONFIG = {
    "backend_type": "local", "executable_path": "", "server_url": "", "timeout": 300
}
DEFAULT_DOCUMENT_PARSER_PADDLEOCR_VL_CONFIG = {
    "executable_path": "paddleocr", "vl_rec_backend": "vllm-server",
    "server_url": "http://127.0.0.1:8118/v1", "extra_args": "", "timeout": 300
}

# ─── 设置映射表 ───
SETTINGS_MAP = {
    'temperature': {'db_key': 'temperature', 'config_key': 'TEMPERATURE', 'value_type': 'number'},
    'max_tokens': {'db_key': 'max_tokens', 'config_key': 'MAX_TOKENS', 'value_type': 'number'},
    'system_prompt': {'db_key': 'system_prompt', 'config_key': 'SYSTEM_PROMPT', 'value_type': 'string'},
    'platform_language': {'db_key': 'platform_language', 'config_key': 'PLATFORM_LANGUAGE', 'value_type': 'string'},
    'max_conversation_history_length': {'db_key': 'max_conversation_history_length', 'config_key': 'MAX_CONVERSATION_HISTORY_LENGTH', 'value_type': 'number'},
    'auto_summarize_context': {'db_key': 'auto_summarize_context', 'config_key': 'AUTO_SUMMARIZE_CONTEXT', 'value_type': 'boolean'},
    'auto_summarize_context_autonomous': {'db_key': 'auto_summarize_context_autonomous', 'config_key': 'AUTO_SUMMARIZE_CONTEXT_AUTONOMOUS', 'value_type': 'boolean'},
    'streaming_enabled': {'db_key': 'streaming_enabled', 'config_key': 'STREAMING_ENABLED', 'value_type': 'boolean'},
    'timezone': {'db_key': 'timezone', 'config_key': 'TIMEZONE', 'value_type': 'string'},
    'include_thinking_content_in_context': {'db_key': 'include_thinking_content_in_context', 'config_key': 'INCLUDE_THINKING_CONTENT_IN_CONTEXT', 'value_type': 'boolean'},
    'split_tool_calls_in_history': {'db_key': 'split_tool_calls_in_history', 'config_key': 'SPLIT_TOOL_CALLS_IN_HISTORY', 'value_type': 'boolean'},
    'create_agent_workspace': {'db_key': 'create_agent_workspace', 'config_key': 'CREATE_AGENT_WORKSPACE', 'value_type': 'boolean'},
    'use_builtin_vector_db': {'db_key': 'use_builtin_vector_db', 'config_key': 'USE_BUILTIN_VECTOR_DB', 'value_type': 'boolean'},
    'vector_db_provider': {'db_key': 'vector_db_provider', 'config_key': 'VECTOR_DB_PROVIDER', 'value_type': 'string'},
    'vector_db_config': {'db_key': 'vector_db_config', 'config_key': 'VECTOR_DB_CONFIG', 'value_type': 'json'},
    'builtin_vector_db_host': {'db_key': 'builtin_vector_db_host', 'config_key': 'BUILTIN_VECTOR_DB_HOST', 'value_type': 'string'},
    'builtin_vector_db_port': {'db_key': 'builtin_vector_db_port', 'config_key': 'BUILTIN_VECTOR_DB_PORT', 'value_type': 'number'},
    'enable_assistant_generation': {'db_key': 'enable_assistant_generation', 'config_key': 'ENABLE_ASSISTANT_GENERATION', 'value_type': 'boolean'},
    'assistant_generation_model': {'db_key': 'assistant_generation_model', 'config_key': 'ASSISTANT_GENERATION_MODEL', 'value_type': 'string'},
    'enable_experiment_protocol_generation': {'db_key': 'enable_experiment_protocol_generation', 'config_key': 'ENABLE_EXPERIMENT_PROTOCOL_GENERATION', 'value_type': 'boolean'},
    'experiment_protocol_model': {'db_key': 'experiment_protocol_model', 'config_key': 'EXPERIMENT_PROTOCOL_MODEL', 'value_type': 'string'},
    'http_connection_timeout': {'db_key': 'http_connection_timeout', 'config_key': 'HTTP_CONNECTION_TIMEOUT', 'value_type': 'number'},
    'http_read_timeout': {'db_key': 'http_read_timeout', 'config_key': 'HTTP_READ_TIMEOUT', 'value_type': 'number'},
    'stream_socket_timeout': {'db_key': 'stream_socket_timeout', 'config_key': 'STREAM_SOCKET_TIMEOUT', 'value_type': 'number'},
    'default_model_timeout': {'db_key': 'default_model_timeout', 'config_key': 'DEFAULT_MODEL_TIMEOUT', 'value_type': 'number'},
    'document_parser_tool': {'db_key': 'document_parser_tool', 'config_key': 'DOCUMENT_PARSER_TOOL', 'value_type': 'string'},
    'document_parser_mineru_config': {'db_key': 'document_parser_mineru_config', 'config_key': 'DOCUMENT_PARSER_MINERU_CONFIG', 'value_type': 'json'},
    'document_parser_paddleocr_vl_config': {'db_key': 'document_parser_paddleocr_vl_config', 'config_key': 'DOCUMENT_PARSER_PADDLEOCR_VL_CONFIG', 'value_type': 'json'},
    'pdf_converter_config': {'db_key': 'pdf_converter_config', 'config_key': 'PDF_CONVERTER_CONFIG', 'value_type': 'json'},
    'job_manager_max_workers': {'db_key': 'job_manager_max_workers', 'config_key': 'JOB_MANAGER_MAX_WORKERS', 'value_type': 'number'},
    'tool_call_context_rounds': {'db_key': 'tool_call_context_rounds', 'config_key': 'TOOL_CALL_CONTEXT_ROUNDS', 'value_type': 'number'},
    'tool_result_max_length': {'db_key': 'tool_result_max_length', 'config_key': 'TOOL_RESULT_MAX_LENGTH', 'value_type': 'number'},
    'compress_tool_definitions': {'db_key': 'compress_tool_definitions', 'config_key': 'COMPRESS_TOOL_DEFINITIONS', 'value_type': 'boolean'},
    'tool_call_correction': {'db_key': 'tool_call_correction', 'config_key': 'TOOL_CALL_CORRECTION', 'value_type': 'boolean'},
    'tool_call_correction_threshold': {'db_key': 'tool_call_correction_threshold', 'config_key': 'TOOL_CALL_CORRECTION_THRESHOLD', 'value_type': 'number'},
}


def _parse_setting_value(value_str: str, value_type: str):
    """将数据库中的字符串值转换为 Python 类型"""
    if value_type == 'boolean':
        return value_str.lower() in ('true', '1', 'yes')
    elif value_type == 'number':
        try:
            return float(value_str) if '.' in value_str else int(value_str)
        except (ValueError, TypeError):
            return 0
    elif value_type == 'json':
        try:
            return json.loads(value_str)
        except (ValueError, TypeError):
            return {}
    return value_str


@router.get('')
def get_settings_handler():
    """获取系统设置"""
    settings_dict = {}

    # 从数据库获取所有系统设置
    db_settings = SystemSetting.query.all()
    logger.info(f"从数据库获取到 {len(db_settings)} 个系统设置")

    for setting in db_settings:
        key = setting.key
        parsed = _parse_setting_value(setting.value, setting.value_type)
        settings_dict[key] = parsed
        # 同步到 settings 单例
        settings[setting.key.upper()] = parsed

    # 填充默认值
    _defaults = {
        'model': settings.get('DEFAULT_MODEL', ''),
        'temperature': settings.get('TEMPERATURE', 0.7),
        'max_tokens': settings.get('MAX_TOKENS', 2000),
        'system_prompt': settings.get('SYSTEM_PROMPT', '你是一个拥有多种角色的模拟对话系统。请按照世界设定和角色特性进行回应。'),
        'use_builtin_vector_db': settings.get('USE_BUILTIN_VECTOR_DB', True),
        'vector_db_provider': settings.get('VECTOR_DB_PROVIDER', 'aliyun'),
        'vector_db_config': settings.get('VECTOR_DB_CONFIG', {}),
        'builtin_vector_db_host': settings.get('BUILTIN_VECTOR_DB_HOST', 'localhost'),
        'builtin_vector_db_port': settings.get('BUILTIN_VECTOR_DB_PORT', 19530),
        'enableAssistantGeneration': settings.get('ENABLE_ASSISTANT_GENERATION', True),
        'assistantGenerationModel': settings.get('ASSISTANT_GENERATION_MODEL', 'default'),
        'enable_experiment_protocol_generation': settings.get('ENABLE_EXPERIMENT_PROTOCOL_GENERATION', True),
        'experiment_protocol_model': settings.get('EXPERIMENT_PROTOCOL_MODEL', 'default'),
        'httpConnectionTimeout': settings.get('HTTP_CONNECTION_TIMEOUT', 30),
        'httpReadTimeout': settings.get('HTTP_READ_TIMEOUT', 300),
        'streamSocketTimeout': settings.get('STREAM_SOCKET_TIMEOUT', 60),
        'defaultModelTimeout': settings.get('DEFAULT_MODEL_TIMEOUT', 60),
        'document_parser_tool': settings.get('DOCUMENT_PARSER_TOOL', DEFAULT_DOCUMENT_PARSER_TOOL),
        'document_parser_mineru_config': settings.get('DOCUMENT_PARSER_MINERU_CONFIG', DEFAULT_DOCUMENT_PARSER_MINERU_CONFIG),
        'document_parser_paddleocr_vl_config': settings.get('DOCUMENT_PARSER_PADDLEOCR_VL_CONFIG', DEFAULT_DOCUMENT_PARSER_PADDLEOCR_VL_CONFIG),
        'pdf_converter_config': settings.get('PDF_CONVERTER_CONFIG', {"executable_path": "soffice", "timeout": 120}),
        'job_manager_max_workers': settings.get('JOB_MANAGER_MAX_WORKERS', 10),
    }
    for k, v in _defaults.items():
        if k not in settings_dict:
            settings_dict[k] = v

    return settings_dict


@router.post('')
async def update_settings_handler(request: Request):
    """更新系统设置"""
    data = await request.json()
    logger.debug(f"收到更新系统设置请求: {data}")

    for front_key, value in data.items():
        if front_key in SETTINGS_MAP:
            info = SETTINGS_MAP[front_key]
            db_key = info['db_key']
            config_key = info['config_key']
            value_type = info['value_type']

            if value_type == 'boolean':
                db_value = str(value).lower()
                config_value = db_value in ('true', '1', 'yes')
            elif value_type == 'number':
                db_value = str(value)
                try:
                    config_value = float(db_value) if '.' in db_value else int(db_value)
                except (ValueError, TypeError):
                    config_value = 0
            elif value_type == 'json':
                db_value = json.dumps(value, ensure_ascii=False)
                config_value = value
            else:
                db_value = value
                config_value = value

            setting = SystemSetting.query.filter_by(key=db_key).first()
            try:
                if setting:
                    SystemSetting.set(
                        key=db_key, value=db_value, value_type=value_type,
                        description=setting.description, category=setting.category,
                        is_secret=setting.is_secret
                    )
                else:
                    SystemSetting.set(
                        key=db_key, value=db_value, value_type=value_type,
                        description=f"前端设置: {front_key}", category="system"
                    )
                settings[config_key] = config_value
            except Exception as e:
                logger.error(f"保存设置 {db_key} 失败: {str(e)}")
        else:
            logger.warning(f"未知的设置: {front_key} = {value}")

    return {'success': True, 'message': '系统设置已更新'}


@router.get('/prompt-templates')
def get_prompt_templates():
    """获取提示词模板"""
    try:
        templates = {}
        template_keys = [
            'roleSystemPrompt', 'actionSpaceBackground', 'actionSpaceRules',
            'actionTaskDescription', 'userMessageExpand',
            'oneClickRoleGeneration', 'oneClickActionSpaceGeneration',
            'oneClickRulesGeneration', 'oneClickTaskGeneration',
            'experimentProtocolGeneration'
        ]
        for key in template_keys:
            db_key = f'prompt_template_{key}'
            setting = SystemSetting.query.filter_by(key=db_key).first()
            if setting:
                templates[key] = setting.value
            elif key in DEFAULT_PROMPT_TEMPLATES:
                templates[key] = DEFAULT_PROMPT_TEMPLATES[key]
        return templates
    except Exception as e:
        logger.error(f"获取提示词模板失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取提示词模板失败")


@router.post('/prompt-templates')
async def update_prompt_templates(request: Request):
    """更新提示词模板"""
    try:
        data = await request.json()
        template_keys = {
            'roleSystemPrompt': 'prompt_template_roleSystemPrompt',
            'actionSpaceBackground': 'prompt_template_actionSpaceBackground',
            'actionSpaceRules': 'prompt_template_actionSpaceRules',
            'actionTaskDescription': 'prompt_template_actionTaskDescription',
            'userMessageExpand': 'prompt_template_userMessageExpand',
            'experimentProtocolGeneration': 'prompt_template_experimentProtocolGeneration'
        }

        for front_key, template_content in data.items():
            if front_key in template_keys:
                db_key = template_keys[front_key]
                setting = SystemSetting.query.filter_by(key=db_key).first()
                if setting:
                    SystemSetting.set(
                        key=db_key, value=template_content, value_type='string',
                        description=setting.description, category=setting.category,
                        is_secret=setting.is_secret
                    )
                else:
                    SystemSetting.set(
                        key=db_key, value=template_content, value_type='string',
                        description=f'辅助生成提示词模板: {front_key}',
                        category='assistant_generation'
                    )
        db.session.commit()
        return {"success": True, "message": "提示词模板更新成功"}
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新提示词模板失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新提示词模板失败: {str(e)}")


@router.post('/prompt-templates/reset')
def reset_prompt_templates():
    """重置提示词模板为默认值"""
    try:
        template_keys = {
            'roleSystemPrompt': 'prompt_template_roleSystemPrompt',
            'actionSpaceBackground': 'prompt_template_actionSpaceBackground',
            'actionSpaceRules': 'prompt_template_actionSpaceRules',
            'actionTaskDescription': 'prompt_template_actionTaskDescription',
            'userMessageExpand': 'prompt_template_userMessageExpand',
            'experimentProtocolGeneration': 'prompt_template_experimentProtocolGeneration'
        }
        for front_key, db_key in template_keys.items():
            setting = SystemSetting.query.filter_by(key=db_key).first()
            if setting:
                db.session.delete(setting)
        db.session.commit()
        return {"success": True, "message": "提示词模板已重置为默认值", "templates": DEFAULT_PROMPT_TEMPLATES}
    except Exception as e:
        db.session.rollback()
        logger.error(f"重置提示词模板失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重置提示词模板失败: {str(e)}")
