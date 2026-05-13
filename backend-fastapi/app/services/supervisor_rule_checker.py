"""
监督者规则检查服务
集成规则检查功能到监督者系统中
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from app.models import Rule, RuleSet, RuleSetRule, Message, Agent, Role, ActionTask, ActionSpace, db, RuleTriggerLog
from app.services.rule_sandbox import RuleSandbox
from app.services.conversation.model_client import ModelClient

logger = logging.getLogger(__name__)

class SupervisorRuleChecker:
    """监督者规则检查服务"""
    
    def __init__(self):
        self.rule_sandbox = RuleSandbox()
        self.model_client = ModelClient()
    
    def check_conversation_rules(self, conversation_id: int, rule_set_ids: List[int] = None, 
                               role_id: int = None) -> Dict[str, Any]:
        """
        检查会话是否符合规则要求
        
        Args:
            conversation_id: 会话ID
            rule_set_ids: 规则集ID列表，如果为None则使用行动空间关联的规则集
            role_id: 执行规则检查的角色ID，用于模型配置
            
        Returns:
            Dict包含检查结果和详细信息
        """
        try:
            logger.info(f"开始检查会话 {conversation_id} 的规则合规性")
            
            # 获取会话相关信息
            conversation_info = self._get_conversation_info(conversation_id)
            if not conversation_info:
                return {
                    'success': False,
                    'error': '无法获取会话信息',
                    'results': []
                }
            
            # 获取规则集
            rules = self._get_rules_for_checking(conversation_info, rule_set_ids)
            if not rules:
                return {
                    'success': True,
                    'message': '没有找到需要检查的规则',
                    'results': []
                }
            
            # 构建会话上下文
            context = self._build_conversation_context(conversation_id)
            if not context:
                return {
                    'success': False,
                    'error': '无法构建会话上下文',
                    'results': []
                }
            
            # 执行规则检查
            check_results = self._execute_rule_checking(rules, context, role_id)
            
            # 生成检查摘要
            summary = self._generate_check_summary(check_results)
            
            logger.info(f"会话 {conversation_id} 规则检查完成，共检查 {len(rules)} 条规则")
            
            return {
                'success': True,
                'conversation_id': conversation_id,
                'total_rules': len(rules),
                'passed_rules': len([r for r in check_results if r.get('passed', False)]),
                'failed_rules': len([r for r in check_results if not r.get('passed', True)]),
                'summary': summary,
                'results': check_results
            }
            
        except Exception as e:
            logger.error(f"检查会话规则时出错: {str(e)}")
            return {
                'success': False,
                'error': f'规则检查失败: {str(e)}',
                'results': []
            }
    
    def get_supervisor_rule_prompt(self, conversation_id: int, rule_set_ids: List[int] = None) -> str:
        """
        为监督者生成包含规则检查结果的提示词
        
        Args:
            conversation_id: 会话ID
            rule_set_ids: 规则集ID列表
            
        Returns:
            包含规则检查结果的提示词
        """
        try:
            # 执行规则检查
            check_result = self.check_conversation_rules(conversation_id, rule_set_ids)
            
            if not check_result.get('success', False):
                return f"规则检查失败: {check_result.get('error', '未知错误')}"
            
            # 构建规则检查提示词
            prompt_parts = []
            
            if check_result.get('total_rules', 0) > 0:
                prompt_parts.append("## 规则检查结果")
                prompt_parts.append(f"总规则数: {check_result['total_rules']}")
                prompt_parts.append(f"通过规则: {check_result['passed_rules']}")
                prompt_parts.append(f"违反规则: {check_result['failed_rules']}")
                
                if check_result.get('summary'):
                    prompt_parts.append(f"\n### 检查摘要\n{check_result['summary']}")
                
                # 添加详细结果
                results = check_result.get('results', [])
                if results:
                    prompt_parts.append("\n### 详细结果")
                    for result in results:
                        status = "✅ 通过" if result.get('passed', False) else "❌ 违反"
                        prompt_parts.append(f"- {status} {result.get('rule_name', '未知规则')}")
                        if result.get('details'):
                            prompt_parts.append(f"  详情: {result['details']}")
            else:
                prompt_parts.append("## 规则检查结果\n没有找到需要检查的规则。")
            
            return "\n".join(prompt_parts)
            
        except Exception as e:
            logger.error(f"生成监督者规则提示词时出错: {str(e)}")
            return f"生成规则检查提示词失败: {str(e)}"
    
    def _get_conversation_info(self, conversation_id: int) -> Optional[Dict[str, Any]]:
        """获取会话相关信息"""
        try:
            from app.models import Conversation
            
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                return None
            
            action_task = ActionTask.query.get(conversation.action_task_id)
            if not action_task:
                return None
            
            action_space = ActionSpace.query.get(action_task.action_space_id)
            if not action_space:
                return None
            
            return {
                'conversation': conversation,
                'action_task': action_task,
                'action_space': action_space
            }
            
        except Exception as e:
            logger.error(f"获取会话信息时出错: {str(e)}")
            return None
    
    def _get_rules_for_checking(self, conversation_info: Dict[str, Any], 
                              rule_set_ids: List[int] = None) -> List[Dict[str, Any]]:
        """获取需要检查的规则"""
        try:
            rules = []
            
            if rule_set_ids:
                # 使用指定的规则集
                for rule_set_id in rule_set_ids:
                    rule_set_rules = db.session.query(Rule).join(
                        RuleSetRule, Rule.id == RuleSetRule.rule_id
                    ).filter(RuleSetRule.rule_set_id == rule_set_id).all()
                    
                    for rule in rule_set_rules:
                        rules.append({
                            'id': rule.id,
                            'name': rule.name,
                            'type': rule.type,
                            'content': rule.content,
                            'description': rule.description
                        })
            else:
                # 使用行动空间关联的规则集
                action_space = conversation_info['action_space']
                from app.models import ActionSpaceRuleSet
                
                space_rule_sets = db.session.query(RuleSet).join(
                    ActionSpaceRuleSet, RuleSet.id == ActionSpaceRuleSet.rule_set_id
                ).filter(ActionSpaceRuleSet.action_space_id == action_space.id).all()
                
                for rule_set in space_rule_sets:
                    rule_set_rules = db.session.query(Rule).join(
                        RuleSetRule, Rule.id == RuleSetRule.rule_id
                    ).filter(RuleSetRule.rule_set_id == rule_set.id).all()
                    
                    for rule in rule_set_rules:
                        rules.append({
                            'id': rule.id,
                            'name': rule.name,
                            'type': rule.type,
                            'content': rule.content,
                            'description': rule.description
                        })
            
            return rules
            
        except Exception as e:
            logger.error(f"获取规则时出错: {str(e)}")
            return []
    
    def _build_conversation_context(self, conversation_id: int) -> Optional[str]:
        """构建会话上下文"""
        try:
            # 获取会话中的消息
            messages = Message.query.filter_by(
                conversation_id=conversation_id
            ).order_by(Message.created_at.asc()).limit(50).all()  # 限制最近50条消息
            
            if not messages:
                return "会话中暂无消息。"
            
            context_parts = []
            for message in messages:
                # 获取发送者信息
                if message.role == 'human':
                    sender = "用户"
                elif message.agent_id:
                    agent = Agent.query.get(message.agent_id)
                    sender = agent.name if agent else "智能体"
                else:
                    sender = "系统"
                
                # 构建消息内容
                content = message.content[:500]  # 限制消息长度
                if len(message.content) > 500:
                    content += "..."
                
                context_parts.append(f"{sender}: {content}")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"构建会话上下文时出错: {str(e)}")
            return None
    
    def _execute_rule_checking(self, rules: List[Dict[str, Any]], context: str,
                             role_id: int = None, variables: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """执行规则检查"""
        try:
            results = []
            
            # 使用规则沙盒执行检查
            for rule in rules:
                try:
                    if rule['type'] == 'llm':
                        # 使用LLM规则检查
                        result = self._check_llm_rule(rule, context, role_id)
                    elif rule['type'] == 'logic':
                        # 使用逻辑规则检查（Python或JavaScript）
                        result = self._check_logic_rule(rule, context, variables)
                    elif rule['type'] == 'python':
                        # 使用Python规则检查（向后兼容）
                        context_vars = {'context': context}
                        if variables:
                            context_vars.update(variables)
                        success, output, error = self.rule_sandbox.execute_python(rule['content'], context_vars)
                        if success:
                            # 尝试解析输出为字典
                            try:
                                import json
                                if output.strip():
                                    result = json.loads(output.strip())
                                else:
                                    result = {'passed': True, 'details': '规则执行成功，无输出'}
                            except json.JSONDecodeError:
                                # 如果不是JSON，尝试解析为简单的布尔值
                                if 'true' in output.lower() or 'pass' in output.lower():
                                    result = {'passed': True, 'details': output}
                                else:
                                    result = {'passed': False, 'details': output}
                        else:
                            result = {'passed': False, 'details': f'Python执行失败: {error}', 'error': error}
                    else:
                        result = {
                            'passed': False,
                            'details': f"不支持的规则类型: {rule['type']}"
                        }
                    
                    results.append({
                        'rule_id': rule['id'],
                        'rule_name': rule['name'],
                        'rule_type': rule['type'],
                        'passed': result.get('passed', False),
                        'details': result.get('details', ''),
                        'error': result.get('error')
                    })
                    
                except Exception as e:
                    logger.error(f"检查规则 {rule['name']} 时出错: {str(e)}")
                    results.append({
                        'rule_id': rule['id'],
                        'rule_name': rule['name'],
                        'rule_type': rule['type'],
                        'passed': False,
                        'details': f"规则检查失败: {str(e)}",
                        'error': str(e)
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"执行规则检查时出错: {str(e)}")
            return []

    def _check_logic_rule(self, rule: Dict[str, Any], context: str, variables: Dict[str, Any] = None) -> Dict[str, Any]:
        """使用逻辑规则检查（Python或JavaScript）"""
        try:
            # 获取解释器类型
            interpreter = rule.get('interpreter', 'javascript')  # 默认为javascript
            if not interpreter:
                # 从settings中获取
                settings = rule.get('settings', {})
                interpreter = settings.get('interpreter', 'javascript')

            # 准备上下文变量
            context_vars = {'context': context}
            if variables:
                context_vars.update(variables)

            # 根据解释器类型执行规则
            if interpreter == 'python':
                success, output, error = self.rule_sandbox.execute_python(rule['content'], context_vars)
            elif interpreter == 'javascript':
                success, output, error = self.rule_sandbox.execute_javascript(rule['content'], context_vars)
            else:
                return {
                    'passed': False,
                    'details': f"不支持的解释器类型: {interpreter}",
                    'error': f"不支持的解释器类型: {interpreter}"
                }

            if success:
                # 尝试解析输出
                try:
                    import json
                    if output.strip():
                        # 尝试解析为JSON
                        try:
                            result_data = json.loads(output.strip())
                            if isinstance(result_data, dict):
                                return result_data
                            elif isinstance(result_data, bool):
                                return {'passed': result_data, 'details': f'规则执行结果: {result_data}'}
                            else:
                                return {'passed': bool(result_data), 'details': f'规则执行结果: {result_data}'}
                        except json.JSONDecodeError:
                            # 不是JSON，尝试解析为布尔值
                            output_lower = output.strip().lower()
                            if output_lower in ['true', '1', 'pass', 'passed']:
                                return {'passed': True, 'details': f'规则执行结果: {output.strip()}'}
                            elif output_lower in ['false', '0', 'fail', 'failed']:
                                return {'passed': False, 'details': f'规则执行结果: {output.strip()}'}
                            else:
                                # 尝试转换为布尔值
                                try:
                                    result_bool = bool(eval(output.strip()))
                                    return {'passed': result_bool, 'details': f'规则执行结果: {output.strip()}'}
                                except:
                                    return {'passed': False, 'details': f'无法解析执行结果: {output.strip()}'}
                    else:
                        return {'passed': True, 'details': '规则执行成功，无输出'}
                except Exception as e:
                    return {'passed': False, 'details': f'解析执行结果时出错: {str(e)}', 'error': str(e)}
            else:
                return {'passed': False, 'details': f'{interpreter.title()}执行失败: {error}', 'error': error}

        except Exception as e:
            logger.error(f"检查逻辑规则时出错: {str(e)}")
            return {'passed': False, 'details': f'逻辑规则检查失败: {str(e)}', 'error': str(e)}

    def _check_llm_rule(self, rule: Dict[str, Any], context: str, role_id: int = None) -> Dict[str, Any]:
        """使用LLM检查规则"""
        try:
            # 获取模型配置
            model_config = self._get_model_config(role_id)
            if not model_config:
                return {
                    'passed': False,
                    'details': '无法获取模型配置'
                }
            
            # 构建检查提示词
            system_prompt = f"""你是一个规则检查助手。请根据以下规则检查给定的会话内容是否符合要求。

规则内容：{rule['content']}

请仔细分析会话内容，判断是否违反了上述规则。

回答格式：
- 如果符合规则，回答：PASS: [简要说明原因]
- 如果违反规则，回答：FAIL: [详细说明违反的具体内容和原因]"""

            user_prompt = f"请检查以下会话内容：\n\n{context}"
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # 构建agent_info以传递provider信息
            agent_info = {
                'provider': model_config.get('provider', 'unknown'),
                'name': '规则检查系统',
                'role_name': '规则检查器'
            }

            # 调用模型
            response = self.model_client.send_request(
                api_url=model_config['base_url'],
                api_key=model_config['api_key'],
                messages=messages,
                model=model_config['model_id'],
                is_stream=False,
                agent_info=agent_info,
                temperature=0.3,  # 使用较低的温度确保一致性
                max_tokens=1000
            )
            
            # 解析响应
            if response.startswith('PASS:'):
                return {
                    'passed': True,
                    'details': response[5:].strip()
                }
            elif response.startswith('FAIL:'):
                return {
                    'passed': False,
                    'details': response[5:].strip()
                }
            else:
                # 尝试从响应中推断结果
                response_lower = response.lower()
                if '符合' in response_lower or 'pass' in response_lower or '通过' in response_lower:
                    return {
                        'passed': True,
                        'details': response
                    }
                else:
                    return {
                        'passed': False,
                        'details': response
                    }
            
        except Exception as e:
            logger.error(f"LLM规则检查时出错: {str(e)}")
            return {
                'passed': False,
                'details': f'LLM检查失败: {str(e)}',
                'error': str(e)
            }
    
    def _get_model_config(self, role_id: int = None) -> Optional[Dict[str, Any]]:
        """获取模型配置"""
        try:
            from app.models import ModelConfig, Role

            role_model = None

            # 如果提供了role_id，优先使用角色指定的模型
            if role_id:
                role = Role.query.get(role_id)
                if role and role.model:
                    role_model = ModelConfig.query.get(role.model)
                    if role_model:
                        logger.info(f"监督规则检查器使用角色指定模型: {role_model.name} (角色: {role.name})")
                    else:
                        logger.warning(f"角色 {role.name} 指定的模型ID {role.model} 不存在，将使用默认模型")

            # 如果没有角色指定的模型，使用默认文本生成模型
            if not role_model:
                role_model = ModelConfig.query.filter_by(is_default_text=True).first()
                if role_model:
                    logger.info(f"监督规则检查器使用默认文本生成模型: {role_model.name}")

            # 如果没有设置默认文本生成模型，查找第一个支持文本输出的模型
            if not role_model:
                text_models = ModelConfig.query.filter(
                    ModelConfig.modalities.contains('text_output')
                ).all()
                if text_models:
                    role_model = text_models[0]
                    logger.info(f"监督规则检查器使用第一个支持文本输出的模型: {role_model.name}")

            # 最后回退到第一个可用模型
            if not role_model:
                role_model = ModelConfig.query.first()
                if role_model:
                    logger.warning(f"监督规则检查器回退到第一个可用模型: {role_model.name}")

            if role_model:
                return {
                    'model_id': role_model.model_id,
                    'base_url': role_model.base_url,
                    'api_key': role_model.api_key,
                    'provider': role_model.provider
                }
            else:
                logger.warning("未找到可用的模型配置")
                return None
        except Exception as e:
            logger.error(f"获取模型配置时出错: {str(e)}")
            return None
    
    def _generate_check_summary(self, results: List[Dict[str, Any]]) -> str:
        """生成检查摘要"""
        try:
            if not results:
                return "没有执行任何规则检查。"
            
            passed_count = len([r for r in results if r.get('passed', False)])
            failed_count = len(results) - passed_count
            
            summary_parts = []
            
            if failed_count == 0:
                summary_parts.append("✅ 所有规则检查均通过，会话内容符合规范。")
            else:
                summary_parts.append(f"⚠️ 发现 {failed_count} 条规则违反，需要注意以下问题：")
                
                for result in results:
                    if not result.get('passed', True):
                        summary_parts.append(f"- {result.get('rule_name', '未知规则')}: {result.get('details', '无详情')}")
            
            return "\n".join(summary_parts)
            
        except Exception as e:
            logger.error(f"生成检查摘要时出错: {str(e)}")
            return f"生成摘要失败: {str(e)}"

    def save_rule_trigger_logs(self, conversation_id: int, check_results: List[Dict[str, Any]],
                              context: str, variables: Dict[str, Any] = None,
                              trigger_type: str = 'automatic', trigger_source: str = 'supervisor') -> None:
        """
        保存规则触发记录到数据库

        Args:
            conversation_id: 会话ID
            check_results: 规则检查结果列表
            context: 检查上下文
            variables: 变量值
            trigger_type: 触发类型
            trigger_source: 触发源
        """
        try:
            # 获取会话信息
            from app.models import Conversation
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                logger.error(f"会话 {conversation_id} 不存在，无法保存规则触发记录")
                return

            action_task_id = conversation.action_task_id
            if not action_task_id:
                logger.error(f"会话 {conversation_id} 没有关联的行动任务，无法保存规则触发记录")
                return

            # 为每个检查结果创建触发记录
            for result in check_results:
                rule_id = result.get('rule_id')
                if not rule_id:
                    continue

                # 计算执行时间（如果有的话）
                execution_time = result.get('execution_time')

                trigger_log = RuleTriggerLog(
                    rule_id=rule_id,
                    action_task_id=action_task_id,
                    conversation_id=conversation_id,
                    trigger_type=trigger_type,
                    trigger_source=trigger_source,
                    context=context,
                    variables=variables or {},
                    result=result,
                    passed=result.get('passed', False),
                    message=result.get('message', ''),
                    details=result.get('details', ''),
                    execution_time=execution_time
                )

                db.session.add(trigger_log)

            # 提交所有记录
            db.session.commit()
            logger.info(f"成功保存 {len(check_results)} 条规则触发记录")

        except Exception as e:
            db.session.rollback()
            logger.error(f"保存规则触发记录时出错: {str(e)}")

    def check_task_rules_with_logging(self, task_id: int, rules: List[Dict[str, Any]],
                                    context: str, role_id: int = None,
                                    variables: Dict[str, Any] = None,
                                    conversation_id: int = None,
                                    trigger_type: str = 'manual',
                                    trigger_source: str = 'user') -> Dict[str, Any]:
        """
        检查任务规则并记录触发日志

        Args:
            task_id: 任务ID
            rules: 规则列表
            context: 检查上下文
            role_id: 角色ID
            variables: 变量值
            conversation_id: 会话ID
            trigger_type: 触发类型
            trigger_source: 触发源

        Returns:
            检查结果
        """
        try:
            import time
            start_time = time.time()

            # 执行规则检查
            check_results = self._execute_rule_checking(rules, context, role_id, variables)

            # 计算总执行时间
            total_execution_time = time.time() - start_time

            # 为每个结果添加执行时间信息
            for result in check_results:
                if 'execution_time' not in result:
                    result['execution_time'] = total_execution_time / len(check_results)

            # 如果有会话ID，保存触发记录
            if conversation_id:
                self.save_rule_trigger_logs(
                    conversation_id=conversation_id,
                    check_results=check_results,
                    context=context,
                    variables=variables,
                    trigger_type=trigger_type,
                    trigger_source=trigger_source
                )

            # 生成检查摘要
            summary = self._generate_check_summary(check_results)

            logger.info(f"任务 {task_id} 规则检查完成，共检查 {len(rules)} 条规则")

            return {
                'success': True,
                'task_id': task_id,
                'conversation_id': conversation_id,
                'total_rules': len(rules),
                'passed_rules': len([r for r in check_results if r.get('passed', False)]),
                'failed_rules': len([r for r in check_results if not r.get('passed', True)]),
                'summary': summary,
                'results': check_results,
                'execution_time': total_execution_time
            }

        except Exception as e:
            logger.error(f"检查任务规则时出错: {str(e)}")
            return {
                'success': False,
                'error': f'规则检查失败: {str(e)}',
                'results': []
            }
