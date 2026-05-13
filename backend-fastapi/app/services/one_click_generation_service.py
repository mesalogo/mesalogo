"""
一键生成服务
提供一键创建角色、行动空间、规则和任务的功能
"""

import json
import logging
from typing import Dict, List, Any, Optional
from app.models import Role, ActionSpace, Rule, ActionTask, RuleSet, ActionSpaceRuleSet
from app.extensions import db
from app.services.conversation.model_client import ModelClient
from app.api.routes.settings import DEFAULT_PROMPT_TEMPLATES

logger = logging.getLogger(__name__)

class OneClickGenerationService:
    """一键生成服务类"""
    
    def __init__(self):
        self.model_client = ModelClient()
    
    def _replace_template_variables(self, template: str, variables: Dict[str, Any]) -> str:
        """替换模板中的变量"""
        result = template
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            result = result.replace(placeholder, str(value) if value is not None else '')
        return result
    
    def _call_model(self, prompt: str, system_prompt: str = None, **kwargs) -> str:
        """调用模型生成内容"""
        try:
            # 获取默认文本生成模型配置
            from app.models import ModelConfig, SystemSetting

            # 首先尝试获取辅助生成专用模型
            assistant_model_setting = SystemSetting.query.filter_by(key='assistant_generation_model').first()
            default_model = None

            if assistant_model_setting and assistant_model_setting.value != 'default':
                # 使用指定的辅助生成模型
                try:
                    default_model = ModelConfig.query.filter_by(id=int(assistant_model_setting.value)).first()
                    if default_model:
                        logger.info(f"使用指定的辅助生成模型: {default_model.name}")
                except (ValueError, TypeError):
                    logger.warning(f"辅助生成模型ID格式错误: {assistant_model_setting.value}")

            if not default_model:
                # 回退到系统默认文本生成模型
                default_model = ModelConfig.query.filter_by(is_default_text=True).first()
                if default_model:
                    logger.info(f"使用默认文本生成模型: {default_model.name}")

            if not default_model:
                # 如果还没有找到，查找第一个支持文本输出的模型
                text_models = ModelConfig.query.filter(
                    ModelConfig.modalities.contains('text_output')
                ).all()
                if text_models:
                    default_model = text_models[0]
                    logger.info(f"使用第一个文本生成模型: {default_model.name}")

            if not default_model:
                raise Exception("未找到可用的文本生成模型配置，请在模型配置页面设置默认文本生成模型")

            logger.info(f"一键生成使用模型: {default_model.name} ({default_model.model_id}) - {default_model.base_url}")

            # 准备消息
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # 调用模型，max_tokens使用模型配置，temperature固定为0.6以保证生成稳定性
            response = self.model_client.send_request(
                api_url=default_model.base_url,
                api_key=default_model.api_key,
                messages=messages,
                model=default_model.model_id,
                is_stream=False,
                temperature=0.6,
                max_tokens=default_model.max_output_tokens
            )

            return response

        except Exception as e:
            logger.error(f"模型调用失败: {str(e)}")
            raise Exception(f"模型调用失败: {str(e)}")
    
    def _parse_json_response(self, response: str) -> Any:
        """解析JSON响应"""
        try:
            # 清理响应内容
            response = response.strip()
            
            # 尝试提取JSON部分
            if '```json' in response:
                start = response.find('```json') + 7
                end = response.find('```', start)
                if end != -1:
                    response = response[start:end].strip()
            elif '```' in response:
                start = response.find('```') + 3
                end = response.find('```', start)
                if end != -1:
                    response = response[start:end].strip()
            
            import re
            
            # 修复不规范的JSON：将没有引号的key添加双引号
            # 匹配模式：在 { 或 , 后面的不带引号的key（支持中文和英文）
            # 例如: {name: "value"} -> {"name": "value"}
            # 例如: {描述: "value"} -> {"描述": "value"}
            def fix_unquoted_keys(json_str):
                # 匹配不带引号的key：在 { 或 , 或换行后，空白符后，非引号开头的标识符，后跟冒号
                # 支持中文、英文、数字、下划线
                pattern = r'([{\[,]\s*)([a-zA-Z_\u4e00-\u9fff][a-zA-Z0-9_\u4e00-\u9fff]*)(\s*:)'
                return re.sub(pattern, r'\1"\2"\3', json_str)
            
            response = fix_unquoted_keys(response)
            
            # 处理JSON字符串中的控制字符（如未转义的换行符）
            # 在JSON字符串值内部，换行符需要转义为\n
            # 匹配JSON字符串值中的实际换行符并转义
            def escape_newlines_in_strings(match):
                s = match.group(0)
                # 转义字符串内的实际换行符
                s = s.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                return s
            
            # 匹配双引号包围的字符串（简单处理，不处理嵌套引号的复杂情况）
            response = re.sub(r'"[^"]*"', escape_newlines_in_strings, response, flags=re.DOTALL)
            
            # 解析JSON
            return json.loads(response)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {str(e)}, 响应内容: {response}")
            raise Exception(f"生成内容格式不正确: {str(e)}")
    
    def generate_role(self, user_requirement: str) -> List[Dict[str, Any]]:
        """生成多个协作角色配置"""
        try:
            logger.info(f"开始生成协作角色，用户需求: {user_requirement}")

            # 获取提示词模板
            template = DEFAULT_PROMPT_TEMPLATES.get('oneClickRoleGeneration')
            if not template:
                raise Exception("未找到角色生成模板")

            # 替换模板变量
            prompt = self._replace_template_variables(template, {
                'user_requirement': user_requirement
            })

            # 调用模型生成
            system_prompt = "你是一个专业的AI助手，擅长根据需求设计多智能体协作系统。请严格按照要求输出JSON数组格式。"
            response = self._call_model(prompt, system_prompt)

            # 解析响应
            roles_data = self._parse_json_response(response)

            # 验证是否为数组
            if not isinstance(roles_data, list):
                raise Exception("生成的角色配置应该是数组格式")

            # 基本数量验证（至少需要1个角色）
            if len(roles_data) < 1:
                raise Exception("至少需要生成1个角色")

            # 移除上限限制，允许生成更多角色

            # 验证每个角色的必要字段
            required_fields = ['name', 'description', 'system_prompt']
            for i, role in enumerate(roles_data):
                for field in required_fields:
                    if field not in role:
                        raise Exception(f"第{i+1}个角色缺少必要字段: {field}")

            role_names = [role['name'] for role in roles_data]
            logger.info(f"角色生成成功，共生成 {len(roles_data)} 个角色: {', '.join(role_names)}")
            return roles_data

        except Exception as e:
            logger.error(f"角色生成失败: {str(e)}")
            raise
    
    def generate_action_space(self, user_requirement: str, roles_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        """生成行动空间配置"""
        try:
            role_names = [role.get('name', 'Unknown') for role in roles_info]
            logger.info(f"开始生成行动空间，角色: {', '.join(role_names)}")

            # 获取提示词模板
            template = DEFAULT_PROMPT_TEMPLATES.get('oneClickActionSpaceGeneration')
            if not template:
                raise Exception("未找到行动空间生成模板")

            # 替换模板变量
            prompt = self._replace_template_variables(template, {
                'user_requirement': user_requirement,
                'roles_info': json.dumps(roles_info, ensure_ascii=False, indent=2)
            })
            
            # 调用模型生成
            system_prompt = "你是一个专业的AI助手，擅长根据需求生成行动空间配置。请严格按照要求输出JSON格式。"
            response = self._call_model(prompt, system_prompt)
            
            # 解析响应
            space_data = self._parse_json_response(response)
            
            # 验证必要字段
            required_fields = ['name', 'description']
            for field in required_fields:
                if field not in space_data:
                    raise Exception(f"生成的行动空间配置缺少必要字段: {field}")
            
            # 确保settings字段存在
            if 'settings' not in space_data:
                space_data['settings'] = {}
            
            logger.info(f"行动空间生成成功: {space_data['name']}")
            return space_data
            
        except Exception as e:
            logger.error(f"行动空间生成失败: {str(e)}")
            raise
    
    def generate_rules(self, user_requirement: str, roles_info: List[Dict[str, Any]],
                      action_space_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """生成规则配置"""
        try:
            logger.info(f"开始生成规则，行动空间: {action_space_info.get('name', 'Unknown')}")
            
            # 获取提示词模板
            template = DEFAULT_PROMPT_TEMPLATES.get('oneClickRulesGeneration')
            if not template:
                raise Exception("未找到规则生成模板")
            
            # 替换模板变量
            prompt = self._replace_template_variables(template, {
                'user_requirement': user_requirement,
                'roles_info': json.dumps(roles_info, ensure_ascii=False, indent=2),
                'action_space_info': json.dumps(action_space_info, ensure_ascii=False, indent=2)
            })
            
            # 调用模型生成
            system_prompt = "你是一个专业的AI助手，擅长根据需求生成规则配置。请严格按照要求输出JSON数组格式。"
            response = self._call_model(prompt, system_prompt)
            
            # 解析响应
            rules_data = self._parse_json_response(response)
            
            # 验证是否为数组
            if not isinstance(rules_data, list):
                raise Exception("生成的规则配置应该是数组格式")
            
            # 验证每个规则的必要字段
            required_fields = ['name', 'content']
            for i, rule in enumerate(rules_data):
                for field in required_fields:
                    if field not in rule:
                        raise Exception(f"第{i+1}个规则缺少必要字段: {field}")

                # 设置固定类型为自然语言规则
                rule['type'] = 'llm'
            
            logger.info(f"规则生成成功，共生成 {len(rules_data)} 个规则")
            return rules_data
            
        except Exception as e:
            logger.error(f"规则生成失败: {str(e)}")
            raise
    
    def generate_task(self, user_requirement: str, roles_info: List[Dict[str, Any]],
                     action_space_info: Dict[str, Any], rules_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        """生成任务配置"""
        try:
            logger.info(f"开始生成任务")
            
            # 获取提示词模板
            template = DEFAULT_PROMPT_TEMPLATES.get('oneClickTaskGeneration')
            if not template:
                raise Exception("未找到任务生成模板")
            
            # 替换模板变量
            prompt = self._replace_template_variables(template, {
                'user_requirement': user_requirement,
                'roles_info': json.dumps(roles_info, ensure_ascii=False, indent=2),
                'action_space_info': json.dumps(action_space_info, ensure_ascii=False, indent=2),
                'rules_info': json.dumps(rules_info, ensure_ascii=False, indent=2)
            })
            
            # 调用模型生成
            system_prompt = "你是一个专业的AI助手，擅长根据需求生成任务配置。请严格按照要求输出JSON格式。"
            response = self._call_model(prompt, system_prompt)
            
            # 解析响应
            task_data = self._parse_json_response(response)
            
            # 验证必要字段
            required_fields = ['title', 'description']
            for field in required_fields:
                if field not in task_data:
                    raise Exception(f"生成的任务配置缺少必要字段: {field}")
            
            # 强制为一键创建的任务设置sequential模式
            # 这确保所有一键创建的任务都能正确处理多个智能体的顺序响应
            # 移除AI模型可能生成的其他模式设置，避免出现panel等不适合的模式
            task_data['mode'] = 'sequential'
            
            logger.info(f"任务生成成功: {task_data['title']}")
            return task_data
            
        except Exception as e:
            logger.error(f"任务生成失败: {str(e)}")
            raise
    
    def generate_all(self, user_requirement: str) -> Dict[str, Any]:
        """一键生成所有内容"""
        try:
            logger.info(f"开始一键生成，用户需求: {user_requirement}")

            # 第一步：生成多个协作角色
            roles_data = self.generate_role(user_requirement)

            # 第二步：生成行动空间
            action_space_data = self.generate_action_space(user_requirement, roles_data)

            # 第三步：生成规则
            rules_data = self.generate_rules(user_requirement, roles_data, action_space_data)

            # 第四步：生成任务
            task_data = self.generate_task(user_requirement, roles_data, action_space_data, rules_data)

            result = {
                'roles': roles_data,  # 注意：改为复数形式
                'action_space': action_space_data,
                'rules': rules_data,
                'task': task_data
            }

            logger.info("一键生成完成")
            return result

        except Exception as e:
            logger.error(f"一键生成失败: {str(e)}")
            raise
