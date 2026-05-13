from datetime import datetime
from app.models import db, ActionTask, Agent, Message, ActionTaskAgent, ActionSpace, RuleSet, ActionSpaceEnvironmentVariable, ActionTaskEnvironmentVariable, RoleVariable, Conversation
from app.services.message_service import MessageService
from app.services.agent_variable_service import AgentVariableService

import logging
logger = logging.getLogger(__name__)

class ActionTaskService:
    """行动任务处理服务"""

    @staticmethod
    def get_action_tasks():
        """获取所有行动任务"""
        action_tasks = ActionTask.query.all()
        result = []

        for task in action_tasks:
            # 获取任务关联的智能体数量
            agent_count = ActionTaskAgent.query.filter_by(action_task_id=task.id).count()

            # 获取消息数量
            message_count = Message.query.filter_by(action_task_id=task.id).count()

            # 获取会话数量
            conversation_count = Conversation.query.filter_by(action_task_id=task.id).count()

            result.append({
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': task.status,
                'mode': task.mode,
                'created_at': task.created_at.isoformat(),
                'updated_at': task.updated_at.isoformat(),
                'agent_count': agent_count,
                'message_count': message_count,
                'conversation_count': conversation_count
            })

        return result

    @staticmethod
    def get_action_spaces():
        """获取所有行动空间"""
        spaces = ActionSpace.query.all()
        result = []

        for space in spaces:
            # 获取与空间关联的规则集
            rule_sets = RuleSet.query.filter_by(action_space_id=space.id).all()
            rule_set_list = []

            for rs in rule_sets:
                rule_set_list.append({
                    'id': rs.id,
                    'name': rs.name,
                    'description': rs.description
                })

            result.append({
                'id': space.id,
                'name': space.name,
                'description': space.description,
                'settings': space.settings,
                'created_at': space.created_at.isoformat(),
                'updated_at': space.updated_at.isoformat(),
                'rule_sets': rule_set_list
            })

        return result

    @staticmethod
    def get_action_task(task_id):
        """获取单个行动任务详情"""
        task = ActionTask.query.get(task_id)
        if not task:
            return None

        # 获取参与的智能体
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task_id).all()
        agents = []

        for task_agent in task_agents:
            agent = Agent.query.get(task_agent.agent_id)
            if agent:
                agents.append({
                    'id': agent.id,
                    'name': agent.name,
                    'description': agent.description,
                    'avatar': agent.avatar,
                    'is_default': task_agent.is_default,
                    'is_observer': agent.is_observer,  # 添加是否为监督者标记
                    'type': agent.type  # 添加智能体类型
                })

        # 获取行动空间和规则集
        action_space = None
        if task.action_space_id:
            space = ActionSpace.query.get(task.action_space_id)
            if space:
                action_space = {
                    'id': space.id,
                    'name': space.name,
                    'description': space.description
                }

        rule_set = None
        if task.rule_set_id:
            rs = RuleSet.query.get(task.rule_set_id)
            if rs:
                rule_set = {
                    'id': rs.id,
                    'name': rs.name,
                    'description': rs.description
                }

        return {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'mode': task.mode,
            'created_at': task.created_at.isoformat(),
            'updated_at': task.updated_at.isoformat(),
            'agents': agents,
            'action_space': action_space,
            'rule_set': rule_set
        }

    @staticmethod
    def create_action_task(data):
        """创建新行动任务"""
        try:
            new_task = ActionTask(
                title=data.get('title', '新行动任务'),
                description=data.get('description', ''),
                status='active',
                mode=data.get('mode', 'sequential'),
                rule_set_id=data.get('rule_set_id'),
                action_space_id=data.get('action_space_id'),
                user_id=data.get('user_id')
            )

            db.session.add(new_task)
            db.session.commit()

            # 添加智能体到行动任务
            agent_ids = data.get('agent_ids', [])
            for idx, agent_id in enumerate(agent_ids):
                # 第一个智能体设为默认
                is_default = (idx == 0)

                # 获取智能体并设置 action_task_id
                agent = Agent.query.get(agent_id)
                if agent:
                    agent.action_task_id = new_task.id
                    db.session.commit()

                    # 获取智能体对应的角色
                    if agent.role_id and new_task.action_space_id:
                        # 查找该角色在当前行动空间的环境变量
                        role_vars = RoleVariable.query.filter_by(
                            role_id=agent.role_id,
                            action_space_id=new_task.action_space_id
                        ).all()

                        # 为智能体创建这些环境变量
                        for role_var in role_vars:
                            try:
                                # 将角色变量转换为智能体变量
                                AgentVariableService.create_variable(
                                    agent_id=agent.id,
                                    name=role_var.name,
                                    value=role_var.value,
                                    is_public=True
                                )
                                logger.info(f"已为智能体 {agent.id} 创建环境变量: {role_var.name}")
                            except Exception as e:
                                logger.error(f"为智能体 {agent.id} 创建环境变量 {role_var.name} 失败: {str(e)}")

                # 创建行动任务-智能体关联
                task_agent = ActionTaskAgent(
                    action_task_id=new_task.id,
                    agent_id=agent_id,
                    is_default=is_default
                )
                db.session.add(task_agent)

            db.session.commit()

            # 如果关联了行动空间，复制行动空间的环境变量到行动任务中
            if new_task.action_space_id:
                try:
                    # 检查数据中是否已经包含了环境变量
                    has_space_vars_in_data = False
                    if data.get('environment_variables'):
                        # 查看是否有标记为space来源的环境变量
                        for var_data in data.get('environment_variables', []):
                            if var_data.get('source') == 'space':
                                has_space_vars_in_data = True
                                break

                    # 只有在数据中没有行动空间环境变量时才从行动空间获取
                    if not has_space_vars_in_data:
                        # 获取行动空间的传统环境变量
                        space_vars = ActionSpaceEnvironmentVariable.query.filter_by(
                            action_space_id=new_task.action_space_id
                        ).all()

                        # 复制传统环境变量到行动任务
                        for space_var in space_vars:
                            task_var = ActionTaskEnvironmentVariable(
                                name=space_var.name,
                                label=space_var.label,
                                value=space_var.value,
                                action_task_id=new_task.id
                            )
                            db.session.add(task_var)

                        # 获取行动空间绑定的共享环境变量
                        from app.models import ActionSpaceSharedVariable, SharedEnvironmentVariable
                        shared_bindings = db.session.query(ActionSpaceSharedVariable, SharedEnvironmentVariable).join(
                            SharedEnvironmentVariable, ActionSpaceSharedVariable.shared_variable_id == SharedEnvironmentVariable.id
                        ).filter(ActionSpaceSharedVariable.action_space_id == new_task.action_space_id).all()

                        # 复制共享环境变量到行动任务
                        for binding, shared_var in shared_bindings:
                            task_var = ActionTaskEnvironmentVariable(
                                name=shared_var.name,
                                label=shared_var.label,
                                value=shared_var.value,
                                shared_variable_id=shared_var.id,  # 关联共享变量ID
                                is_readonly=shared_var.is_readonly,  # 继承只读属性
                                action_task_id=new_task.id
                            )
                            db.session.add(task_var)

                        db.session.commit()
                        logger.info(f"已从行动空间复制{len(space_vars)}个传统环境变量和{len(shared_bindings)}个共享环境变量到行动任务")

                    # 添加从请求数据中传来的环境变量
                    if data.get('environment_variables'):
                        for var_data in data.get('environment_variables'):
                            # 只处理行动任务级别的环境变量，忽略角色变量
                            # 因为角色变量已经被转换为智能体变量处理
                            if not var_data.get('role_id'):
                                env_var = ActionTaskEnvironmentVariable(
                                    name=var_data.get('name'),
                                    label=var_data.get('label', var_data.get('name')),  # 添加label字段
                                    value=var_data.get('value', ''),
                                    action_task_id=new_task.id
                                )
                                db.session.add(env_var)

                        db.session.commit()
                        logger.info(f"已从请求数据添加环境变量到行动任务")
                except Exception as e:
                    logger.error(f"复制行动空间环境变量失败: {str(e)}")
                    # 不中断任务创建流程，继续执行

            # 创建默认会话
            from app.services.conversation_service import ConversationService
            default_conversation = ConversationService.create_conversation_for_action_task(new_task)

            return ActionTaskService.get_action_task(new_task.id)
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating action task: {e}")
            raise

    @staticmethod
    def update_action_task(task_id, data):
        """更新行动任务信息"""
        task = ActionTask.query.get(task_id)
        if not task:
            return None

        if 'title' in data:
            task.title = data['title']

        if 'description' in data:
            task.description = data['description']

        if 'status' in data:
            valid_statuses = ['active', 'completed', 'terminated']
            if data['status'] in valid_statuses:
                task.status = data['status']

        if 'mode' in data:
            valid_modes = ['sequential', 'panel']
            if data['mode'] in valid_modes:
                task.mode = data['mode']

        if 'rule_set_id' in data:
            task.rule_set_id = data['rule_set_id']

        if 'action_space_id' in data:
            task.action_space_id = data['action_space_id']

        db.session.commit()

        return ActionTaskService.get_action_task(task_id)

    @staticmethod
    def delete_action_task(task_id):
        """删除行动任务及其相关数据
        
        删除顺序（按外键依赖从叶子到根）：
        conversations 的子表 → conversations → action_tasks 的其他子表 → action_task
        """
        from app.models import (
            AutonomousTask, AutonomousTaskExecution, Conversation,
            ConversationAgent, ConversationPlan, ConversationPlanItem,
            ActionTaskEnvironmentVariable, RuleTriggerLog, ExperimentStep
        )

        task = ActionTask.query.get(task_id)
        if not task:
            return False

        # ── 1. 收集所有关联 conversation ID ──
        conversations = Conversation.query.filter_by(action_task_id=task_id).all()
        conversation_ids = [c.id for c in conversations]

        # ── 2. 停止并删除自主任务（依赖 conversation_id） ──
        stopped_autonomous_tasks = 0
        for conversation in conversations:
            autonomous_tasks = AutonomousTask.query.filter_by(conversation_id=conversation.id).all()
            for autonomous_task in autonomous_tasks:
                if autonomous_task.status == 'active':
                    try:
                        from app.services.scheduler.task_adapter import stop_task
                        stop_success = stop_task(task_id, conversation.id, autonomous_task.type)
                        if stop_success:
                            logger.info(f"已停止自主任务: {autonomous_task.id} (类型: {autonomous_task.type})")
                        else:
                            autonomous_task.status = 'stopped'
                            logger.error(f"停止自主任务失败，已直接更新状态: {autonomous_task.id}")
                        stopped_autonomous_tasks += 1
                    except Exception as e:
                        logger.info(f"停止自主任务 {autonomous_task.id} 时出错: {str(e)}")

                # 删除自主任务的执行记录
                AutonomousTaskExecution.query.filter_by(autonomous_task_id=autonomous_task.id).delete()

            # 删除该会话的所有自主任务
            AutonomousTask.query.filter_by(conversation_id=conversation.id).delete()

        logger.info(f"已停止并删除 {stopped_autonomous_tasks} 个自主任务")

        # ── 3. 删除 conversation 的子表（conversation_plans → plan_items 有 cascade，但保险起见显式删） ──
        if conversation_ids:
            # conversation_plan_items（依赖 conversation_plan）
            plan_ids = [p.id for p in ConversationPlan.query.filter(
                ConversationPlan.conversation_id.in_(conversation_ids)
            ).all()]
            if plan_ids:
                ConversationPlanItem.query.filter(
                    ConversationPlanItem.plan_id.in_(plan_ids)
                ).delete(synchronize_session=False)
            # conversation_plans
            ConversationPlan.query.filter(
                ConversationPlan.conversation_id.in_(conversation_ids)
            ).delete(synchronize_session=False)
            # conversation_agents
            ConversationAgent.query.filter(
                ConversationAgent.conversation_id.in_(conversation_ids)
            ).delete(synchronize_session=False)
            # rule_trigger_logs（引用 conversation_id）
            RuleTriggerLog.query.filter(
                RuleTriggerLog.conversation_id.in_(conversation_ids)
            ).delete(synchronize_session=False)
            # experiment_steps（引用 conversation_id）
            ExperimentStep.query.filter(
                ExperimentStep.conversation_id.in_(conversation_ids)
            ).delete(synchronize_session=False)

        # ── 4. 删除 messages（引用 action_task_id 和 conversation_id） ──
        Message.query.filter_by(action_task_id=task_id).delete()

        # ── 5. 删除 conversations 本身（必须在子表清理完之后） ──
        if conversation_ids:
            Conversation.query.filter(
                Conversation.id.in_(conversation_ids)
            ).delete(synchronize_session=False)

        # ── 6. 删除 action_tasks 的其他子表 ──
        # rule_trigger_logs（也引用 action_task_id）
        RuleTriggerLog.query.filter_by(action_task_id=task_id).delete()
        # experiment_steps（也引用 action_task_id）
        ExperimentStep.query.filter_by(action_task_id=task_id).delete()
        # action_task_environment_variables
        ActionTaskEnvironmentVariable.query.filter_by(action_task_id=task_id).delete()

        # 获取所有相关的智能体并清除其 action_task_id（SET NULL）
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task_id).all()
        for task_agent in task_agents:
            agent = Agent.query.get(task_agent.agent_id)
            if agent and agent.action_task_id == task_id:
                agent.action_task_id = None

        # 删除任务的所有智能体关联
        ActionTaskAgent.query.filter_by(action_task_id=task_id).delete()

        # ── 7. 删除项目空间文件 ──
        try:
            from app.services.workspace_service import workspace_service
            workspace_service.delete_workspace_for_action_task(task_id)
            logger.info(f"已删除行动任务 {task_id} 的项目空间文件")
        except Exception as e:
            logger.error(f"删除行动任务 {task_id} 的项目空间文件失败: {str(e)}")

        # ── 8. 删除行动任务本身 ──
        db.session.delete(task)
        db.session.commit()

        return True

    @staticmethod
    def add_agent_to_action_task(task_id, agent_id, is_default=False):
        """将智能体添加到行动任务"""
        # 检查行动任务和智能体是否存在
        task = ActionTask.query.get(task_id)
        agent = Agent.query.get(agent_id)

        if not task or not agent:
            return False

        # 检查智能体是否已经在行动任务中
        existing = ActionTaskAgent.query.filter_by(
            action_task_id=task_id,
            agent_id=agent_id
        ).first()

        if existing:
            # 如果要设为默认，更新状态
            if is_default and not existing.is_default:
                # 先将所有智能体设为非默认
                ActionTaskAgent.query.filter_by(
                    action_task_id=task_id,
                    is_default=True
                ).update({'is_default': False})

                # 设置当前智能体为默认
                existing.is_default = True

                # 确保智能体的action_task_id已设置
                if agent.action_task_id != task_id:
                    agent.action_task_id = task_id

                # 更新行动任务的updated_at时间
                from app.utils.datetime_utils import get_current_time_with_timezone
                task.updated_at = get_current_time_with_timezone()

                db.session.commit()

            return True

        # 如果是默认智能体，确保其他智能体不是默认的
        if is_default:
            ActionTaskAgent.query.filter_by(
                action_task_id=task_id,
                is_default=True
            ).update({'is_default': False})

        # 创建新的关联
        task_agent = ActionTaskAgent(
            action_task_id=task_id,
            agent_id=agent_id,
            is_default=is_default
        )

        # 更新智能体的action_task_id字段
        agent.action_task_id = task_id

        # 更新行动任务的updated_at时间
        from app.utils.datetime_utils import get_current_time_with_timezone
        task.updated_at = get_current_time_with_timezone()

        db.session.add(task_agent)
        db.session.commit()

        return True

    @staticmethod
    def remove_agent_from_action_task(task_id, agent_id):
        """从行动任务中移除智能体"""
        task_agent = ActionTaskAgent.query.filter_by(
            action_task_id=task_id,
            agent_id=agent_id
        ).first()

        if not task_agent:
            return False

        # 如果是默认智能体且不是唯一的智能体，需要指定新的默认智能体
        if task_agent.is_default:
            other_agent = ActionTaskAgent.query.filter(
                ActionTaskAgent.action_task_id == task_id,
                ActionTaskAgent.agent_id != agent_id
            ).first()

            if other_agent:
                other_agent.is_default = True

        # 获取agent对象并清除其action_task_id
        agent = Agent.query.get(agent_id)
        if agent and agent.action_task_id == task_id:
            agent.action_task_id = None

        # 更新行动任务的updated_at时间
        from app.utils.datetime_utils import get_current_time_with_timezone
        task = ActionTask.query.get(task_id)
        if task:
            task.updated_at = get_current_time_with_timezone()

        db.session.delete(task_agent)
        db.session.commit()

        return True

    @staticmethod
    def get_action_task_messages(task_id):
        """获取行动任务的所有消息"""
        messages = Message.query.filter_by(action_task_id=task_id).order_by(Message.created_at).all()

        # 格式化消息用于API响应
        formatted_messages = [MessageService.format_message_for_api(msg) for msg in messages]

        return formatted_messages

    @staticmethod
    def add_message_to_action_task(task_id, data):
        """向行动任务添加消息"""
        # 检查行动任务是否存在且状态为active
        task = ActionTask.query.get(task_id)
        if not task:
            return None, "行动任务不存在"

        if task.status != 'active':
            return None, f"行动任务状态为{task.status}，不能添加消息"

        # 创建人类消息
        if 'content' not in data:
            return None, "消息内容不能为空"

        human_message = MessageService.create_message(
            content=data['content'],
            role='human',
            task_id=task_id,
            user_id=data.get('user_id')
        )

        # 如果需要模拟智能体响应
        agent_message = None
        if data.get('simulate_response'):
            # 获取目标智能体或默认智能体
            agent = None
            if data.get('target_agent_id'):
                agent = Agent.query.get(data.get('target_agent_id'))
            else:
                # 获取默认智能体
                task_agent = ActionTaskAgent.query.filter_by(
                    action_task_id=task_id,
                    is_default=True
                ).first()

                if task_agent:
                    agent = Agent.query.get(task_agent.agent_id)

            if agent:
                # 创建智能体响应
                agent_message = MessageService.create_message(
                    content=data.get('simulate_content', f"这是来自{agent.name}的模拟回复"),
                    role='agent',
                    agent_id=agent.id,
                    thinking=data.get('simulate_thinking', "这是模拟的思考过程"),
                    task_id=task_id
                )

        return human_message, agent_message

    @staticmethod
    def get_default_agent_for_action_task(task_id):
        """获取行动任务的默认智能体"""
        task_agent = ActionTaskAgent.query.filter_by(
            action_task_id=task_id,
            is_default=True
        ).first()

        if not task_agent:
            return None

        return Agent.query.get(task_agent.agent_id)

    @staticmethod
    def _get_speaking_agents_for_task(task, turn=1):
        """根据任务模式获取当前应该发言的智能体列表"""
        # 获取行动任务中的所有智能体
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task.id).all()
        agents = [Agent.query.get(ta.agent_id) for ta in task_agents if ta.agent_id]
        agents = [a for a in agents if a]  # 过滤掉无效的智能体

        if not agents:
            return []

        if task.mode == "panel":
            return agents
        elif task.mode == "sequential":
            return [agents[(turn-1) % len(agents)]]

        return agents

    @staticmethod
    def generate_agent_response(task_id, message_content, target_agent_id=None):
        """生成智能体对用户消息的回复"""
        task = ActionTask.query.get(task_id)
        if not task:
            return None, "行动任务不存在"

        # 获取目标智能体或默认智能体
        agent = None
        if target_agent_id:
            agent = Agent.query.get(target_agent_id)
        else:
            # 获取默认智能体
            task_agent = ActionTaskAgent.query.filter_by(
                action_task_id=task_id,
                is_default=True
            ).first()

            if task_agent:
                agent = Agent.query.get(task_agent.agent_id)

        if not agent:
            return None, "没有找到可用的智能体"

        # 在实际应用中，这里应该调用LLM服务生成回复
        # 这里只是模拟一个简单的回复
        response_content = f"作为{agent.name}，我收到了您的消息：\"{message_content}\"。我会尝试提供有价值的回应。"

        # 创建智能体回复消息
        agent_message = MessageService.create_message(
            content=response_content,
            role='agent',
            agent_id=agent.id,
            thinking="这是智能体的思考过程",
            task_id=task_id
        )

        return agent_message, None