"""
并行实验室服务

设计原则：
- 统一绑定 ActionSpace（场景模板）
- is_template 只是标记是否系统预置，不影响数据结构和工作流
- 每个并行实例创建独立的 ActionTask（变量隔离）
- 复用现有的 ActionTask + AutonomousTask 机制
"""

import logging
import random
from datetime import datetime
from typing import Dict, List, Any, Optional
from itertools import product

from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.models import (
    ParallelExperiment, ExperimentStep, ActionTask, ActionSpace, ActionSpaceRole,
    Conversation, ConversationAgent, Agent, AutonomousTask, Message,
    ActionTaskAgent, ActionTaskEnvironmentVariable,
    ActionSpaceEnvironmentVariable, ActionSpaceSharedVariable,
    SharedEnvironmentVariable, RoleVariable, Role, ActionSpaceObserver
)
from app.services.scheduler.task_adapter import start_task
from app.services.agent_service import AgentService
from app.services.agent_variable_service import AgentVariableService
from app.services.workspace_service import workspace_service
from app.services.action_task_service import ActionTaskService
from app.utils.datetime_utils import get_current_time_with_timezone

logger = logging.getLogger(__name__)


class ParallelExperimentService:
    """并行实验服务"""
    
    @staticmethod
    def create_experiment(config: Dict[str, Any], user_id: str = None) -> str:
        """创建并启动实验（支持延迟创建优化）
        
        Args:
            config: 实验配置
                {
                    "name": "实验名称",
                    "description": "实验描述",
                    "experiment_type": "comparative" | "normal",  # 实验类型
                    "source_action_space_id": "行动空间ID",
                    "variables": {
                        "response_temperature": {"type": "enumerated", "values": [0.3, 0.5, 0.7, 0.9]}
                    },
                    "objectives": [{"variable": "customer_satisfaction", "type": "maximize"}],
                    "stop_conditions": [{"expression": "customer_satisfaction > 0.9"}],
                    "task_config": {"type": "discussion", "rounds": 5}
                }
            user_id: 创建者用户ID
        
        Returns:
            实验ID
        """
        try:
            # 验证行动空间是否存在
            action_space = ActionSpace.query.get(config['source_action_space_id'])
            if not action_space:
                raise ValueError(f"行动空间不存在: {config['source_action_space_id']}")
            
            # 获取实验类型（默认为对比实验）
            experiment_type = config.get('experiment_type', 'comparative')
            task_config = config.get('task_config', {})
            max_concurrent = task_config.get('maxConcurrent', 3)
            
            # 根据实验类型生成参数组合
            if experiment_type == 'normal':
                combinations = ParallelExperimentService._generate_normal_task_parameters(
                    config.get('variables', {})
                )
            else:
                combinations = ParallelExperimentService._generate_parameter_combinations(
                    config.get('variables', {})
                )
            
            # === 延迟创建策略 ===
            initial_create_count = min(max_concurrent * 2, len(combinations))
            initial_combinations = combinations[:initial_create_count]
            remaining_combinations = combinations[initial_create_count:]
            
            # 创建实验记录
            experiment = ParallelExperiment(
                name=config['name'],
                description=config.get('description', ''),
                source_action_space_id=config['source_action_space_id'],
                config=config,
                status='created',
                is_template=False,
                total_runs=len(combinations),
                current_iteration=1,
                pending_combinations={'1': remaining_combinations}
            )
            
            db.session.add(experiment)
            db.session.flush()
            
            # 提取目标变量名列表
            objectives = config.get('objectives', [])
            objective_var_names = [obj.get('variable') for obj in objectives if obj.get('variable')]
            
            # 只为初始批次创建 ActionTask
            cloned_task_ids = []
            for i, params in enumerate(initial_combinations):
                task = ParallelExperimentService._create_action_task_from_space(
                    action_space_id=config['source_action_space_id'],
                    params=params,
                    name_suffix=f"实验{experiment.id[:8]}-Run{i+1}",
                    experiment_id=experiment.id,
                    objective_variables=objective_var_names,
                    user_id=user_id
                )
                cloned_task_ids.append(task.id)
            
            experiment.cloned_action_task_ids = {'1': cloned_task_ids}
            experiment.status = 'running'
            experiment.start_time = get_current_time_with_timezone()
            
            db.session.commit()
            
            logger.info(f"延迟创建策略: 总任务={len(combinations)}, 预创建={initial_create_count}, 待创建={len(remaining_combinations)}")
            
            # 根据最大并发数启动任务（通过独立线程池）
            from app.services.experiment_executor import submit_experiment_tasks
            
            submit_experiment_tasks(
                experiment.id, cloned_task_ids, task_config, max_concurrent
            )
            
            logger.info(f"实验已创建并启动: {experiment.name}, 预创建 {len(cloned_task_ids)} 个, 总计 {len(combinations)} 个")
            return experiment.id
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"创建实验失败: {str(e)}")
            raise
    
    @staticmethod
    def _generate_normal_task_parameters(variables: Dict[str, Any]) -> List[Dict[str, Any]]:
        """生成普通任务参数（固定值，只生成一个组合）
        
        Args:
            variables: 变量配置，格式为 {"var_name": value} 或 {"var_name": {"value": value}}
        
        Returns:
            包含一个参数组合的列表
        """
        if not variables:
            return [{}]
        
        params = {}
        for var_name, var_config in variables.items():
            # 支持两种格式：直接值或包含value字段的对象
            if isinstance(var_config, dict) and 'value' in var_config:
                params[var_name] = var_config['value']
            else:
                params[var_name] = var_config
        
        return [params]
    
    @staticmethod
    def _generate_parameter_combinations(variables: Dict[str, Any]) -> List[Dict[str, Any]]:
        """生成参数组合（笛卡尔积）- 用于对比实验
        
        支持的变量类型：
        - enumerated: {"type": "enumerated", "values": [0.3, 0.5, 0.7]}
        - stepped: {"type": "stepped", "start": 100, "step": 50, "end": 500}
        - random: {"type": "random", "min": 0, "max": 1, "count": 5}
        """
        if not variables:
            return [{}]
        
        variable_values = {}
        
        for var_name, var_config in variables.items():
            var_type = var_config.get('type', 'enumerated')
            
            if var_type == 'enumerated':
                values = var_config.get('values', [])
            elif var_type == 'stepped':
                start = var_config.get('start', 0)
                step = var_config.get('step', 1)
                end = var_config.get('end', start)
                values = []
                current = start
                while current <= end:
                    values.append(current)
                    current += step
            elif var_type == 'random':
                min_val = var_config.get('min', 0)
                max_val = var_config.get('max', 1)
                count = var_config.get('count', 5)
                seed = var_config.get('seed')
                rng = random.Random(seed) if seed is not None else random
                values = [rng.uniform(min_val, max_val) for _ in range(count)]
            else:
                logger.warning(f"未知的变量类型: {var_type}")
                values = [None]
            
            variable_values[var_name] = values
        
        # 生成笛卡尔积
        var_names = list(variable_values.keys())
        var_value_lists = [variable_values[name] for name in var_names]
        
        combinations = []
        for combo_values in product(*var_value_lists):
            combinations.append(dict(zip(var_names, combo_values)))
        
        return combinations
    
    @staticmethod
    def _create_action_task_from_space(
        action_space_id: str, 
        params: Dict[str, Any], 
        name_suffix: str,
        experiment_id: str,
        objective_variables: List[str] = None,
        user_id: str = None
    ) -> ActionTask:
        """从 ActionSpace 创建 ActionTask（包含 Agent 和变量）
        
        Args:
            objective_variables: 目标变量名列表，这些变量会被添加到环境变量中（初始值为0）
            user_id: 创建者用户ID
        """
        
        action_space = ActionSpace.query.get(action_space_id)
        if not action_space:
            raise ValueError(f"行动空间不存在: {action_space_id}")
        
        # 创建 ActionTask
        task = ActionTask(
            title=f"{action_space.name} - {name_suffix}",
            description=f"并行实验自动创建: {experiment_id}",
            status='active',
            mode='sequential',
            action_space_id=action_space_id,
            is_experiment_clone=True,
            user_id=user_id
        )
        db.session.add(task)
        db.session.flush()
        
        # 从 ActionSpace 的 roles 创建 Agent（普通智能体）
        space_roles = ActionSpaceRole.query.filter_by(action_space_id=action_space_id).all()
        
        created_agents = []
        participant_count = 0
        for i, space_role in enumerate(space_roles):
            role = Role.query.get(space_role.role_id)
            if not role:
                continue
            
            # 根据 quantity 创建多个 Agent
            for q in range(space_role.quantity):
                agent_name = role.name if space_role.quantity == 1 else f"{role.name}_{q+1}"
                
                agent = Agent(
                    name=agent_name,
                    description=role.description,
                    avatar=role.avatar,
                    settings=role.settings,  # 复制角色设置
                    role_id=role.id,
                    action_task_id=task.id,
                    source=role.source,
                    type='agent',  # 标记为普通智能体类型
                    additional_prompt=space_role.additional_prompt or '',
                    is_observer=False  # 普通智能体不是监督者
                )
                db.session.add(agent)
                db.session.flush()
                
                participant_count += 1
                
                # 创建 ActionTaskAgent 关联
                task_agent = ActionTaskAgent(
                    action_task_id=task.id,
                    agent_id=agent.id,
                    is_default=(participant_count == 1)  # 第一个参与者智能体设为默认
                )
                db.session.add(task_agent)
                
                # 创建角色变量为智能体变量
                role_vars = RoleVariable.query.filter_by(
                    role_id=role.id,
                    action_space_id=action_space_id
                ).all()
                for role_var in role_vars:
                    try:
                        AgentVariableService.create_variable(
                            agent_id=agent.id,
                            name=role_var.name,
                            value=role_var.value,
                            is_public=True,
                            label=role_var.label  # 添加 label 参数
                        )
                    except Exception as e:
                        logger.warning(f"创建智能体变量失败: {str(e)}")
                
                created_agents.append(agent)
        
        # 从 ActionSpace 的 observers 创建监督者智能体
        space_observers = ActionSpaceObserver.query.filter_by(action_space_id=action_space_id).all()
        
        for space_observer in space_observers:
            role = Role.query.get(space_observer.role_id)
            if not role:
                continue
            
            observer_agent = Agent(
                name=role.name,
                description=role.description,
                avatar=role.avatar,
                settings=role.settings,  # 复制角色设置
                role_id=role.id,
                action_task_id=task.id,
                source=role.source,
                type='observer',  # 标记为监督者类型
                additional_prompt=space_observer.additional_prompt or '',
                is_observer=True  # 标记为监督者
            )
            db.session.add(observer_agent)
            db.session.flush()
            
            # 创建 ActionTaskAgent 关联（监督者不设为默认智能体）
            task_agent = ActionTaskAgent(
                action_task_id=task.id,
                agent_id=observer_agent.id,
                is_default=False
            )
            db.session.add(task_agent)
            
            # 创建角色变量为智能体变量
            role_vars = RoleVariable.query.filter_by(
                role_id=role.id,
                action_space_id=action_space_id
            ).all()
            for role_var in role_vars:
                try:
                    AgentVariableService.create_variable(
                        agent_id=observer_agent.id,
                        name=role_var.name,
                        value=role_var.value,
                        is_public=True,
                        label=role_var.label  # 添加 label 参数
                    )
                except Exception as e:
                    logger.warning(f"创建监督者智能体变量失败: {str(e)}")
            
            created_agents.append(observer_agent)
        
        logger.info(f"已创建 {participant_count} 个普通智能体和 {len(space_observers)} 个监督者智能体")
        
        # 复制环境变量到 ActionTask
        # 1. 复制行动空间的环境变量
        space_vars = ActionSpaceEnvironmentVariable.query.filter_by(
            action_space_id=action_space_id
        ).all()
        for space_var in space_vars:
            value = space_var.value
            # 如果参数中有该变量，使用参数值
            if space_var.name in params:
                value = str(params[space_var.name])
            
            task_var = ActionTaskEnvironmentVariable(
                name=space_var.name,
                label=space_var.label,
                value=value,
                action_task_id=task.id
            )
            db.session.add(task_var)
        
        # 2. 复制共享环境变量
        shared_bindings = db.session.query(
            ActionSpaceSharedVariable, SharedEnvironmentVariable
        ).join(
            SharedEnvironmentVariable, 
            ActionSpaceSharedVariable.shared_variable_id == SharedEnvironmentVariable.id
        ).filter(
            ActionSpaceSharedVariable.action_space_id == action_space_id
        ).all()
        
        for binding, shared_var in shared_bindings:
            value = shared_var.value
            if shared_var.name in params:
                value = str(params[shared_var.name])
            
            task_var = ActionTaskEnvironmentVariable(
                name=shared_var.name,
                label=shared_var.label,
                value=value,
                shared_variable_id=shared_var.id,
                is_readonly=shared_var.is_readonly,
                action_task_id=task.id
            )
            db.session.add(task_var)
        
        # 3. 添加参数中的新变量（如果不在环境变量中）
        existing_var_names = {v.name for v in space_vars} | {sv.name for _, sv in shared_bindings}
        for param_name, param_value in params.items():
            if param_name not in existing_var_names:
                task_var = ActionTaskEnvironmentVariable(
                    name=param_name,
                    label=param_name,
                    value=str(param_value),
                    action_task_id=task.id
                )
                db.session.add(task_var)
                existing_var_names.add(param_name)
        
        # 4. 添加目标变量（如果不在环境变量中）
        if objective_variables:
            for obj_var_name in objective_variables:
                if obj_var_name not in existing_var_names:
                    task_var = ActionTaskEnvironmentVariable(
                        name=obj_var_name,
                        label=obj_var_name,
                        value='0',
                        action_task_id=task.id
                    )
                    db.session.add(task_var)
                    existing_var_names.add(obj_var_name)
        
        db.session.flush()
        
        # 使用 ConversationService 创建默认会话（与标准流程一致）
        from app.services.conversation_service import ConversationService
        conversation = ConversationService.create_conversation_for_action_task(task)
        
        db.session.commit()
        
        # 初始化项目空间文件结构
        try:
            agent_ids = [agent.id for agent in created_agents]
            agent_info = []
            for agent in created_agents:
                role_name = None
                if agent.role_id:
                    role = Role.query.get(agent.role_id)
                    if role:
                        role_name = role.name
                agent_info.append({
                    'id': agent.id,
                    'name': agent.name,
                    'role_name': role_name
                })
            
            workspace_service.initialize_workspace_for_action_task(
                task_id=task.id,
                agent_ids=agent_ids,
                task_title=task.title,
                agent_info=agent_info
            )
            logger.info(f"已为行动任务 {task.id} 初始化项目空间文件结构")
        except Exception as e:
            logger.error(f"初始化项目空间文件结构失败: {str(e)}")
            # 继续处理，不中断任务创建
        
        logger.info(f"从行动空间创建任务: {task.title}, 智能体数量: {len(created_agents)}")
        return task
    
    @staticmethod
    def _start_autonomous_task(task_id: str, task_config: Dict[str, Any]):
        """启动自主任务（同步等待完成）"""
        import asyncio
        from app.services.scheduler.task_adapter import _get_or_create_event_loop, _convert_config
        from app.services.scheduler.scheduler import TaskScheduler, Task, TaskState
        import uuid

        conversation = Conversation.query.filter_by(action_task_id=task_id).first()
        if not conversation:
            raise ValueError(f"任务没有会话: {task_id}")

        task_type = task_config.get('type', 'discussion')
        config = {
            'rounds': task_config.get('rounds', 3),
            'topic': task_config.get('topic'),
            'summarize': task_config.get('summarize', True),
        }

        trigger_type, trigger_config, execution_mode, execution_config = _convert_config(task_type, config)

        task = Task(
            id=str(uuid.uuid4()),
            action_task_id=task_id,
            conversation_id=conversation.id,
            trigger_type=trigger_type,
            trigger_config=trigger_config,
            execution_mode=execution_mode,
            execution_config=execution_config,
            result_queue=None,
            context={'task_type': task_type}
        )

        scheduler = TaskScheduler.get_instance()
        loop = _get_or_create_event_loop()

        future = asyncio.run_coroutine_threadsafe(
            scheduler.submit_and_start(task),
            loop
        )
        future.result()  # 等待提交完成

        # 等待任务真正执行完成（带超时保护）
        # singleTaskTimeout 从 task_config 读取（单位：分钟），0 表示不限制
        single_task_timeout_minutes = task_config.get('singleTaskTimeout', 60)
        timeout = single_task_timeout_minutes * 60 if single_task_timeout_minutes > 0 else 0
        
        def _wait_for_completion():
            import time
            start = time.time()
            while True:
                t = scheduler._tasks.get(task.id)
                if not t or t.state in (TaskState.COMPLETED, TaskState.STOPPED, TaskState.FAILED):
                    break
                if timeout > 0:
                    elapsed = time.time() - start
                    if elapsed > timeout:
                        logger.error(f"实验任务超时({single_task_timeout_minutes}分钟): task_id={task_id}, scheduler_task={task.id}")
                        # 尝试停止超时的任务
                        try:
                            import asyncio
                            cancel_future = asyncio.run_coroutine_threadsafe(
                                scheduler.stop_task(task.id),
                                loop
                            )
                            cancel_future.result(timeout=10)
                        except Exception as e:
                            logger.error(f"停止超时任务失败: {e}")
                        break
                time.sleep(1)

        _wait_for_completion()
        logger.info(f"已启动自主任务: {task_id}, scheduler_task={task.id}, final_state={task.state}")
    
    @staticmethod
    def get_experiment(experiment_id: str) -> Optional[Dict[str, Any]]:
        """获取实验详情"""
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return None
        return experiment.to_dict(include_runs=True)
    
    @staticmethod
    def list_experiments(include_templates: bool = True, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """获取实验列表（支持分页，joinedload 消除 N+1）"""
        from sqlalchemy.orm import joinedload
        
        query = ParallelExperiment.query.options(
            joinedload(ParallelExperiment.source_action_space)  # 预加载行动空间，消除 N+1
        ).order_by(ParallelExperiment.created_at.desc())
        if not include_templates:
            query = query.filter_by(is_template=False)
        
        # 分页
        total = query.count()
        experiments = query.offset((page - 1) * limit).limit(limit).all()
        
        return {
            'experiments': [exp.to_dict() for exp in experiments],
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': (total + limit - 1) // limit
        }
    
    @staticmethod
    def get_experiment_status(experiment_id: str, include_messages: bool = False, iteration: Optional[int] = None,
                              runs_page: int = None, runs_limit: int = None) -> Optional[Dict[str, Any]]:
        """获取实验状态（包含每个 run 的详细状态，支持 runs 分页）
        
        Args:
            experiment_id: 实验ID
            include_messages: 是否包含消息列表（用于 Timeline）
            iteration: 指定轮次（默认为当前轮次）
            runs_page: runs 分页页码（1-based，None 表示全部）
            runs_limit: 每页 runs 数量（默认 10）
        """
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return None
        
        runs = []
        completed_count = 0
        failed_count = 0
        stopped_count = 0
        total_runs_count = 0
        
        # 获取指定轮次或当前轮次的任务ID列表
        current_iteration = experiment.current_iteration or 0
        query_iteration = iteration if iteration is not None else current_iteration
        current_task_ids = []
        if experiment.cloned_action_task_ids and query_iteration:
            current_task_ids = experiment.cloned_action_task_ids.get(str(query_iteration), [])
        
        if current_task_ids:
            # ── 两阶段查询：先统计全量状态（轻量），再只对分页 slice 做详细查询 ──
            
            # ====== 阶段 1：全量统计（只查 AutonomousTask 状态，不查 env_vars/messages）======
            # 批量查 Conversation → AutonomousTask 状态，用于 completed/failed/stopped 计数
            all_convs = Conversation.query.filter(
                Conversation.action_task_id.in_(current_task_ids)
            ).all()
            conv_by_task = {str(c.action_task_id): c for c in all_convs}
            
            all_conv_ids = [c.id for c in all_convs]
            auto_task_latest = {}
            if all_conv_ids:
                all_auto_tasks = AutonomousTask.query.filter(
                    AutonomousTask.conversation_id.in_(all_conv_ids)
                ).order_by(AutonomousTask.created_at.desc()).all()
                for at in all_auto_tasks:
                    cid = str(at.conversation_id)
                    if cid not in auto_task_latest:
                        auto_task_latest[cid] = at
            
            # 统计各状态（遍历全量 task_ids，只读内存中的 map）
            status_by_task = {}  # task_id → run_status
            for task_id in current_task_ids:
                conv = conv_by_task.get(str(task_id))
                at = auto_task_latest.get(str(conv.id)) if conv else None
                run_status = 'pending'
                if at:
                    if at.status == 'completed':
                        run_status = 'completed'
                        completed_count += 1
                    elif at.status == 'failed':
                        run_status = 'failed'
                        failed_count += 1
                    elif at.status == 'stopped':
                        run_status = 'stopped'
                        stopped_count += 1
                    elif at.status == 'active':
                        run_status = 'running'
                status_by_task[str(task_id)] = run_status
            
            # ====== 阶段 2：分页 slice 的详细数据（env_vars + messages）======
            total_runs_count = len(current_task_ids)
            
            if runs_page is not None:
                _limit = runs_limit or 10
                _offset = (runs_page - 1) * _limit
                page_task_ids = current_task_ids[_offset:_offset + _limit]
            else:
                page_task_ids = current_task_ids
            
            # 批量查 ActionTask（仅分页 slice）
            page_tasks = ActionTask.query.filter(ActionTask.id.in_(page_task_ids)).all()
            task_map = {str(t.id): t for t in page_tasks}
            
            # 批量查 env_vars（仅分页 slice，最大瓶颈）
            from app.models import ActionTaskEnvironmentVariable
            page_task_id_strs = [str(tid) for tid in page_task_ids]
            env_vars_by_task = {}
            if page_task_id_strs:
                all_env_vars = ActionTaskEnvironmentVariable.query.filter(
                    ActionTaskEnvironmentVariable.action_task_id.in_(page_task_id_strs)
                ).all()
                for ev in all_env_vars:
                    tid = str(ev.action_task_id)
                    if tid not in env_vars_by_task:
                        env_vars_by_task[tid] = {}
                    env_vars_by_task[tid][ev.name] = ev.value
            
            # 批量查 messages（仅分页 slice 的 conversations）
            messages_by_conv = {}
            if include_messages:
                from app.services.message_service import MessageService
                page_conv_ids = [conv_by_task[str(tid)].id for tid in page_task_ids if str(tid) in conv_by_task]
                if page_conv_ids:
                    all_messages = Message.query.filter(
                        Message.conversation_id.in_(page_conv_ids)
                    ).order_by(Message.created_at).all()
                    for m in all_messages:
                        cid = str(m.conversation_id)
                        if cid not in messages_by_conv:
                            messages_by_conv[cid] = []
                        messages_by_conv[cid].append(m)
            
            # 预提取实验配置
            config_variables = experiment.config.get('variables', {})
            objectives = experiment.config.get('objectives', [])
            
            # 组装 runs（仅分页 slice）
            for i, task_id in enumerate(page_task_ids):
                # 计算全局 run_number
                global_index = (current_task_ids.index(task_id) if runs_page is not None else i)
                task = task_map.get(str(task_id))
                if not task:
                    continue
                
                conversation = conv_by_task.get(str(task_id))
                
                variables = env_vars_by_task.get(str(task_id), {})
                
                parameters = {}
                for var_name in config_variables.keys():
                    if var_name in variables:
                        parameters[var_name] = variables[var_name]
                
                current_metrics = {}
                for obj in objectives:
                    var_name = obj.get('variable')
                    if var_name and var_name in variables:
                        try:
                            current_metrics[var_name] = float(variables[var_name])
                        except (ValueError, TypeError):
                            current_metrics[var_name] = variables[var_name]
                
                run_data = {
                    'run_number': global_index + 1,
                    'action_task_id': task_id,
                    'status': status_by_task.get(str(task_id), 'pending'),
                    'parameters': parameters,
                    'current_metrics': current_metrics
                }
                
                if include_messages and conversation:
                    conv_messages = messages_by_conv.get(str(conversation.id), [])
                    run_data['messages'] = []
                    for m in conv_messages:
                        message_data = MessageService.format_message_for_api(m)
                        message_data['agent_name'] = m.agent.name if m.agent else None
                        message_data['agent_id'] = m.agent_id
                        message_data['source'] = getattr(m, 'source', 'taskConversation')
                        message_data['meta'] = getattr(m, 'meta', {})
                        run_data['messages'].append(message_data)
                
                runs.append(run_data)
        
        # 计算待创建任务数（延迟创建模式）—— 提前计算，后续逻辑需要
        pending_task_count = 0
        if experiment.pending_combinations and query_iteration:
            pending_list = experiment.pending_combinations.get(str(query_iteration), [])
            pending_task_count = len(pending_list) if isinstance(pending_list, list) else 0
        
        # === 写操作区域：更新统计 + 检查完成/停止条件 ===
        # 使用 try/except 处理 MySQL 乐观锁冲突（后台线程可能同时在修改同一行）
        try:
            # 更新实验统计
            experiment.completed_runs = completed_count
            experiment.failed_runs = failed_count  # 仅真正的失败
            
            # 检查停止条件是否满足
            stop_conditions_met = False
            if experiment.status == 'running':
                stop_conditions_met = ParallelExperimentService._check_stop_conditions(experiment, runs)
            
            # 检查是否全部完成或停止条件满足
            # 注意：延迟创建模式下，需要同时检查 pending_combinations 是否为空
            has_pending_combinations = pending_task_count > 0
            all_created_done = completed_count + failed_count + stopped_count >= len(current_task_ids)  # 所有已创建的任务都结束了
            
            if stop_conditions_met:
                logger.info(f"实验 {experiment.name} 满足停止条件，正在停止...")
                ParallelExperimentService._finalize_experiment(experiment)
            elif all_created_done and not has_pending_combinations and experiment.status == 'running':
                # 所有任务都完成了（包括没有剩余待创建的）
                ParallelExperimentService._finalize_experiment(experiment)
            elif experiment.status == 'running':
                # 并发池：检查是否需要启动更多任务或创建新任务
                ParallelExperimentService._check_and_start_pending_tasks(experiment, runs)
            
            db.session.commit()
        except Exception as e:
            # MySQL 乐观锁冲突（1020 Record has changed）或其他写冲突
            # rollback 后重新读取最新状态，但不再尝试写入（避免死循环）
            logger.warning(f"实验状态更新冲突（后台线程竞争），忽略本次写入: {str(e)[:100]}")
            db.session.rollback()
            # 重新读取实验最新状态（用于返回值）
            experiment = ParallelExperiment.query.get(experiment_id)
            if not experiment:
                return None
        
        # 获取查询轮次的结果摘要
        query_results_summary = None
        if experiment.results_summary and query_iteration:
            query_results_summary = experiment.results_summary.get(str(query_iteration))
        
        # 重新计算 pending_task_count（finalize 或 stop 可能已清空 pending_combinations）
        pending_task_count = 0
        if experiment.pending_combinations and query_iteration:
            pending_list = experiment.pending_combinations.get(str(query_iteration), [])
            pending_task_count = len(pending_list) if isinstance(pending_list, list) else 0
        
        # 生成未创建任务的占位行（"排队中"状态）
        created_count = len(runs)
        for i in range(pending_task_count):
            run_number = created_count + i + 1
            # 从 pending_combinations 中获取参数组合（用于展示）
            pending_params = {}
            if experiment.pending_combinations and query_iteration:
                pending_list = experiment.pending_combinations.get(str(query_iteration), [])
                if i < len(pending_list):
                    pending_params = pending_list[i]
            
            runs.append({
                'run_number': run_number,
                'action_task_id': None,  # 未创建，无 task_id
                'status': 'queued',  # 排队中（区别于 pending = 已创建未启动）
                'parameters': pending_params,
                'current_metrics': {}
            })
        
        result = {
            'experiment_id': experiment_id,
            'name': experiment.name,
            'status': experiment.status,
            'current_iteration': current_iteration,
            'query_iteration': query_iteration,
            'total_runs': experiment.total_runs,
            'completed_runs': completed_count,
            'failed_runs': failed_count,
            'stopped_runs': stopped_count,
            'runs': runs,
            'results_summary': query_results_summary,
            'all_iterations': list(experiment.cloned_action_task_ids.keys()) if experiment.cloned_action_task_ids else [],
            'pending_task_count': pending_task_count  # 待创建任务数
        }
        
        # 分页信息
        if runs_page is not None:
            _limit = runs_limit or 10
            result['runs_page'] = runs_page
            result['runs_limit'] = _limit
            result['runs_total'] = total_runs_count
            result['runs_total_pages'] = (total_runs_count + _limit - 1) // _limit
        
        return result
    
    @staticmethod
    def _check_stop_conditions(experiment: ParallelExperiment, runs: List[Dict[str, Any]]) -> bool:
        """检查停止条件是否满足
        
        支持简单表达式: "variable > 0.9", "variable < 10"
        使用安全的表达式解析，不使用 eval()
        """
        stop_conditions = experiment.config.get('stop_conditions', [])
        if not stop_conditions:
            return False
        
        for run in runs:
            if run['status'] != 'completed':
                continue
            
            metrics = run.get('current_metrics', {})
            
            for condition in stop_conditions:
                expression = condition.get('expression', '').strip()
                if not expression:
                    continue
                
                try:
                    if ParallelExperimentService._safe_evaluate_condition(expression, metrics):
                        logger.info(f"停止条件满足: {expression}")
                        return True
                except Exception as e:
                    logger.warning(f"评估停止条件失败 '{expression}': {str(e)}")
        
        return False
    
    @staticmethod
    def _safe_evaluate_condition(expression: str, variables: Dict[str, Any]) -> bool:
        """安全地评估条件表达式
        
        只支持简单的比较表达式，不使用 eval()
        支持的格式: "variable_name operator value"
        支持的运算符: >, <, >=, <=, ==, !=
        
        Args:
            expression: 条件表达式，如 "satisfaction > 0.9"
            variables: 变量名到值的映射
        
        Returns:
            条件是否满足
        """
        import re
        
        # 支持的运算符（按长度降序排列，确保 >= 在 > 之前匹配）
        operators = ['>=', '<=', '!=', '==', '>', '<']
        
        # 尝试解析表达式
        matched_op = None
        for op in operators:
            if op in expression:
                matched_op = op
                break
        
        if not matched_op:
            raise ValueError(f"不支持的表达式格式，缺少比较运算符: {expression}")
        
        # 分割表达式
        parts = expression.split(matched_op)
        if len(parts) != 2:
            raise ValueError(f"不支持的表达式格式: {expression}")
        
        left_str = parts[0].strip()
        right_str = parts[1].strip()
        
        # 解析左侧（可能是变量名或数值）
        left_value = ParallelExperimentService._parse_operand(left_str, variables)
        # 解析右侧（可能是变量名或数值）
        right_value = ParallelExperimentService._parse_operand(right_str, variables)
        
        # 执行比较
        if matched_op == '>':
            return left_value > right_value
        elif matched_op == '<':
            return left_value < right_value
        elif matched_op == '>=':
            return left_value >= right_value
        elif matched_op == '<=':
            return left_value <= right_value
        elif matched_op == '==':
            return left_value == right_value
        elif matched_op == '!=':
            return left_value != right_value
        
        return False
    
    @staticmethod
    def _parse_operand(operand: str, variables: Dict[str, Any]) -> float:
        """解析操作数，可能是变量名或数值
        
        Args:
            operand: 操作数字符串
            variables: 变量名到值的映射
        
        Returns:
            解析后的数值
        """
        # 首先尝试作为数值解析
        try:
            return float(operand)
        except ValueError:
            pass
        
        # 尝试作为变量名查找
        if operand in variables:
            try:
                return float(variables[operand])
            except (ValueError, TypeError):
                raise ValueError(f"变量 '{operand}' 的值无法转换为数值: {variables[operand]}")
        
        raise ValueError(f"未知的操作数: '{operand}'，不是有效数值也不是已知变量")
    
    @staticmethod
    def _check_and_start_pending_tasks(experiment: ParallelExperiment, runs: List[Dict[str, Any]]):
        """检查并启动等待中的任务（通过独立线程池）
        
        注意：任务完成时会通过 experiment_executor 的回调主动触发，
        这里作为兜底逻辑保留（前端轮询时也会检查）。
        同时检查是否需要从 pending_combinations 中创建新任务。
        """
        task_config = experiment.config.get('task_config', {})
        max_concurrent = task_config.get('maxConcurrent', 3)
        
        running_count = sum(1 for r in runs if r['status'] == 'running')
        pending_tasks = [r for r in runs if r['status'] == 'pending']
        slots_available = max_concurrent - running_count
        
        if slots_available > 0 and pending_tasks:
            from app.services.experiment_executor import submit_experiment_tasks, is_task_submitted
            
            # 过滤掉已提交过的任务
            task_ids_to_start = [
                r['action_task_id'] for r in pending_tasks[:slots_available]
                if not is_task_submitted(experiment.id, r['action_task_id'])
            ]
            if task_ids_to_start:
                submit_experiment_tasks(
                    experiment.id, task_ids_to_start, task_config, max_concurrent
                )
                logger.info(f"并发池启动新任务: {task_ids_to_start}")
        
        # 延迟创建：如果已创建的 pending 任务不足，从 pending_combinations 中创建新任务
        created_pending_count = len(pending_tasks)
        if created_pending_count < max_concurrent and experiment.pending_combinations:
            # 需要补充创建的数量：保持缓冲区为 max_concurrent 个待运行任务
            needed = max_concurrent - created_pending_count
            ParallelExperimentService._create_next_tasks(experiment, needed)
    
    @staticmethod
    def _create_next_tasks(experiment: ParallelExperiment, count: int) -> List[str]:
        """从 pending_combinations 中按需创建新任务（延迟创建核心方法）
        
        Args:
            experiment: 实验对象
            count: 需要创建的任务数量
        
        Returns:
            新创建的任务ID列表
        """
        current_iteration = experiment.current_iteration or 0
        if not current_iteration:
            return []
        
        iteration_key = str(current_iteration)
        
        # 获取待创建的组合
        if not experiment.pending_combinations:
            return []
        pending = experiment.pending_combinations.get(iteration_key, [])
        if not pending:
            return []
        
        # 取出要创建的参数组合
        to_create = pending[:count]
        remaining = pending[count:]
        
        if not to_create:
            return []
        
        config = experiment.config or {}
        objectives = config.get('objectives', [])
        objective_var_names = [obj.get('variable') for obj in objectives if obj.get('variable')]
        
        # 当前已创建的任务数（用于计算 Run 编号）
        current_task_ids = experiment.cloned_action_task_ids.get(iteration_key, [])
        start_index = len(current_task_ids)
        
        # 获取 user_id（从已有任务中获取）
        user_id = None
        if current_task_ids:
            existing_task = ActionTask.query.get(current_task_ids[0])
            if existing_task:
                user_id = existing_task.user_id
        
        new_task_ids = []
        for i, params in enumerate(to_create):
            run_number = start_index + i + 1
            task = ParallelExperimentService._create_action_task_from_space(
                action_space_id=experiment.source_action_space_id,
                params=params,
                name_suffix=f"实验{experiment.id[:8]}-第{current_iteration}轮-Run{run_number}",
                experiment_id=experiment.id,
                objective_variables=objective_var_names,
                user_id=user_id
            )
            new_task_ids.append(task.id)
        
        # 更新实验记录
        current_task_ids.extend(new_task_ids)
        experiment.cloned_action_task_ids[iteration_key] = current_task_ids
        flag_modified(experiment, 'cloned_action_task_ids')
        
        experiment.pending_combinations[iteration_key] = remaining
        flag_modified(experiment, 'pending_combinations')
        
        try:
            db.session.commit()
        except Exception as e:
            logger.warning(f"延迟创建任务 commit 冲突，重试: {str(e)[:100]}")
            db.session.rollback()
            # 重试：重新读取实验并更新
            experiment = ParallelExperiment.query.get(experiment.id)
            if experiment:
                if not experiment.cloned_action_task_ids:
                    experiment.cloned_action_task_ids = {}
                existing = experiment.cloned_action_task_ids.get(iteration_key, [])
                existing.extend(new_task_ids)
                experiment.cloned_action_task_ids[iteration_key] = existing
                flag_modified(experiment, 'cloned_action_task_ids')
                
                if not experiment.pending_combinations:
                    experiment.pending_combinations = {}
                experiment.pending_combinations[iteration_key] = remaining
                flag_modified(experiment, 'pending_combinations')
                db.session.commit()
        
        logger.info(f"延迟创建任务: 实验={experiment.id[:8]}, 新建={len(new_task_ids)}, 剩余待创建={len(remaining)}")
        
        # 提交新任务到执行器
        task_config = config.get('task_config', {})
        max_concurrent = task_config.get('maxConcurrent', 3)
        
        from app.services.experiment_executor import submit_experiment_tasks
        submit_experiment_tasks(
            experiment.id, new_task_ids, task_config, max_concurrent
        )
        
        return new_task_ids
    
    @staticmethod
    def _finalize_experiment(experiment: ParallelExperiment):
        """实验完成后计算最佳结果（当前轮次）
        
        同时清空 pending_combinations（停止条件满足时可能还有未创建的任务）
        """
        current_iteration = experiment.current_iteration or 0
        
        # 清空待创建任务队列
        if experiment.pending_combinations and current_iteration:
            experiment.pending_combinations[str(current_iteration)] = []
            flag_modified(experiment, 'pending_combinations')
        current_task_ids = []
        if experiment.cloned_action_task_ids and current_iteration:
            current_task_ids = experiment.cloned_action_task_ids.get(str(current_iteration), [])
        
        if not current_task_ids:
            experiment.status = 'completed'
            experiment.end_time = get_current_time_with_timezone()
            return
        
        results = []
        objectives = experiment.config.get('objectives', [])
        
        # 记录每个任务的最终步骤
        for i, task_id in enumerate(current_task_ids):
            try:
                ParallelExperimentService.record_step(
                    experiment_id=experiment.id,
                    action_task_id=task_id,
                    step_number=i + 1
                )
            except Exception as e:
                logger.warning(f"记录实验步骤失败 {task_id}: {str(e)}")
        
        for task_id in current_task_ids:
            task = ActionTask.query.get(task_id)
            if not task:
                continue
            
            variables = {v.name: v.value for v in task.environment_variables}
            
            # 提取参数
            config_variables = experiment.config.get('variables', {})
            parameters = {}
            for var_name in config_variables.keys():
                if var_name in variables:
                    parameters[var_name] = variables[var_name]
            
            # 提取目标变量值
            metrics = {}
            for obj in objectives:
                var_name = obj.get('variable')
                if var_name and var_name in variables:
                    try:
                        metrics[var_name] = float(variables[var_name])
                    except (ValueError, TypeError):
                        metrics[var_name] = 0
            
            results.append({
                'action_task_id': task_id,
                'parameters': parameters,
                'metrics': metrics
            })
        
        # 根据 objectives 计算最佳结果
        best_run = None
        if results and objectives:
            primary_objective = objectives[0]
            obj_var = primary_objective.get('variable')
            obj_type = primary_objective.get('type', 'maximize')
            
            if obj_var:
                if obj_type == 'maximize':
                    best_run = max(results, key=lambda r: r['metrics'].get(obj_var, float('-inf')))
                else:  # minimize
                    best_run = min(results, key=lambda r: r['metrics'].get(obj_var, float('inf')))
        
        experiment.status = 'completed'
        experiment.end_time = get_current_time_with_timezone()
        
        # 按轮次存储结果摘要
        if not experiment.results_summary:
            experiment.results_summary = {}
        experiment.results_summary[str(current_iteration)] = {
            'best_run': best_run,
            'all_results': results
        }
        flag_modified(experiment, 'results_summary')
        
        logger.info(f"实验完成: {experiment.name}, 第{current_iteration}轮, 最佳结果: {best_run}")
    
    @staticmethod
    def create_draft_experiment(name: str, description: str, source_action_space_id: str) -> str:
        """创建草稿实验（仅基础信息，不启动）
        
        Args:
            name: 实验名称
            description: 实验描述
            source_action_space_id: 行动空间ID
        
        Returns:
            实验ID
        """
        # 验证行动空间是否存在
        action_space = ActionSpace.query.get(source_action_space_id)
        if not action_space:
            raise ValueError(f"行动空间不存在: {source_action_space_id}")
        
        experiment = ParallelExperiment(
            name=name,
            description=description,
            source_action_space_id=source_action_space_id,
            config={},  # 空配置，等待用户填写
            status='created',
            is_template=False,
            total_runs=0
        )
        db.session.add(experiment)
        db.session.commit()
        
        logger.info(f"草稿实验创建成功: {experiment.name}")
        return experiment.id
    
    @staticmethod
    def update_experiment(experiment_id: str, config: Dict[str, Any]) -> bool:
        """更新实验配置
        
        只能更新 created 状态的实验
        """
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return False
        
        if experiment.status == 'running':
            raise ValueError("运行中的实验不能更新")
        
        # 更新配置
        if not experiment.config:
            experiment.config = {}
        
        # 合并配置
        if 'name' in config:
            experiment.name = config['name']
        if 'description' in config:
            experiment.description = config['description']
        if 'variables' in config:
            experiment.config['variables'] = config['variables']
        if 'objectives' in config:
            experiment.config['objectives'] = config['objectives']
        if 'stop_conditions' in config:
            experiment.config['stop_conditions'] = config['stop_conditions']
        if 'custom_variables' in config:
            experiment.config['custom_variables'] = config['custom_variables']
        if 'task_config' in config:
            experiment.config['task_config'] = config['task_config']
        if 'experiment_type' in config:
            experiment.config['experiment_type'] = config['experiment_type']
        if 'experiment_protocol' in config:
            experiment.config['experiment_protocol'] = config['experiment_protocol']
        
        # 标记 JSON 字段已修改，确保 SQLAlchemy 检测到变化
        flag_modified(experiment, 'config')
        db.session.commit()
        logger.info(f"实验配置已更新: {experiment.name}")
        return True
    
    @staticmethod
    def start_experiment(experiment_id: str, user_id: str = None) -> bool:
        """启动实验（支持多轮次执行，延迟创建优化）
        
        - created 状态：首次启动
        - completed/stopped/failed 状态：重新执行（新轮次）
        
        延迟创建策略：
        当总任务数 > max_concurrent * 2 时，只预创建 max_concurrent * 2 个任务，
        剩余参数组合存储在 pending_combinations 中，任务完成时按需创建新任务。
        """
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return False
        
        # 允许 created/completed/stopped/failed 状态启动
        if experiment.status not in ['created', 'completed', 'stopped', 'failed']:
            raise ValueError("实验正在运行中，无法重新启动")
        
        config = experiment.config or {}
        
        # 获取实验类型
        experiment_type = config.get('experiment_type', 'comparative')
        task_config = config.get('task_config', {})
        
        logger.info(f"启动实验: {experiment.name}, 类型: {experiment_type}")
        logger.info(f"实验完整配置: {config}")
        
        # 验证配置
        variables = config.get('variables', {})
        if experiment_type == 'comparative' and not variables:
            raise ValueError("请至少配置一个扫描变量")
        
        # 根据实验类型生成参数组合
        if experiment_type == 'normal':
            # 普通任务：根据 totalTasks 创建多个相同配置的任务
            total_tasks = task_config.get('totalTasks', 3)
            max_concurrent = task_config.get('maxConcurrent', 3)
            base_params = ParallelExperimentService._generate_normal_task_parameters(variables)
            combinations = base_params * total_tasks  # 复制 totalTasks 份
        else:
            # 对比实验：根据变量配置生成参数组合
            max_concurrent = task_config.get('maxConcurrent', 3)
            combinations = ParallelExperimentService._generate_parameter_combinations(variables)
        
        if not combinations:
            raise ValueError("无法生成参数组合")
        
        # 增加轮次号
        new_iteration = (experiment.current_iteration or 0) + 1
        experiment.current_iteration = new_iteration
        experiment.total_runs = len(combinations)
        experiment.completed_runs = 0
        experiment.failed_runs = 0
        
        # 提取目标变量名列表
        objectives = config.get('objectives', [])
        objective_var_names = [obj.get('variable') for obj in objectives if obj.get('variable')]
        
        # === 延迟创建策略 ===
        # 预创建数量 = max_concurrent * 2（缓冲区，确保任务完成后立刻有新任务可执行）
        initial_create_count = min(max_concurrent * 2, len(combinations))
        initial_combinations = combinations[:initial_create_count]
        remaining_combinations = combinations[initial_create_count:]
        
        logger.info(f"延迟创建策略: 总任务={len(combinations)}, 预创建={initial_create_count}, 待创建={len(remaining_combinations)}")
        
        # 为初始批次创建 ActionTask
        cloned_task_ids = []
        for i, params in enumerate(initial_combinations):
            task = ParallelExperimentService._create_action_task_from_space(
                action_space_id=experiment.source_action_space_id,
                params=params,
                name_suffix=f"实验{experiment.id[:8]}-第{new_iteration}轮-Run{i+1}",
                experiment_id=experiment.id,
                objective_variables=objective_var_names,
                user_id=user_id
            )
            cloned_task_ids.append(task.id)
        
        # 按轮次存储已创建的任务ID
        if not experiment.cloned_action_task_ids:
            experiment.cloned_action_task_ids = {}
        experiment.cloned_action_task_ids[str(new_iteration)] = cloned_task_ids
        flag_modified(experiment, 'cloned_action_task_ids')
        
        # 存储剩余待创建的参数组合
        if not experiment.pending_combinations:
            experiment.pending_combinations = {}
        experiment.pending_combinations[str(new_iteration)] = remaining_combinations
        flag_modified(experiment, 'pending_combinations')
        
        experiment.status = 'running'
        experiment.start_time = get_current_time_with_timezone()
        experiment.end_time = None
        
        db.session.commit()
        
        # 根据最大并发数启动任务
        logger.info(f"实验配置 task_config: {task_config}")
        logger.info(f"最大并发数: {max_concurrent}, 已创建任务: {len(cloned_task_ids)}, 待创建: {len(remaining_combinations)}")
        
        from app.services.experiment_executor import submit_experiment_tasks
        
        submit_experiment_tasks(
            experiment.id, cloned_task_ids, task_config, max_concurrent
        )
        
        logger.info(f"实验已启动: {experiment.name}, 第{new_iteration}轮, 预创建 {len(cloned_task_ids)} 个, 总计 {len(combinations)} 个")
        return True
    
    @staticmethod
    def clone_experiment(experiment_id: str, new_name: str = None) -> str:
        """复制实验（包括模板实验）"""
        source = ParallelExperiment.query.get(experiment_id)
        if not source:
            raise ValueError(f"实验不存在: {experiment_id}")
        
        new_experiment = ParallelExperiment(
            name=new_name or f"{source.name} (副本)",
            description=source.description,
            source_action_space_id=source.source_action_space_id,
            config=source.config.copy() if source.config else {},
            status='created',
            is_template=False
        )
        db.session.add(new_experiment)
        db.session.commit()
        
        logger.info(f"实验复制成功: {new_experiment.name}")
        return new_experiment.id
    
    @staticmethod
    def pause_experiment(experiment_id: str) -> bool:
        """暂停实验"""
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return False
        
        if experiment.status != 'running':
            return False
        
        # 暂停当前轮次运行中的自主任务
        current_iteration = experiment.current_iteration or 0
        current_task_ids = []
        if experiment.cloned_action_task_ids and current_iteration:
            current_task_ids = experiment.cloned_action_task_ids.get(str(current_iteration), [])
        
        from app.services.scheduler import stop_task
        from app.services.experiment_executor import cancel_experiment
        
        # 先取消 executor 中的待执行队列 + 主动停止调度器中正在运行的任务
        cancel_experiment(experiment_id, current_task_ids)
        
        # 兜底：遍历所有 task，停止 active/running 状态的
        for task_id in current_task_ids:
            conversation = Conversation.query.filter_by(action_task_id=task_id).first()
            if conversation:
                autonomous_task = AutonomousTask.query.filter_by(
                    conversation_id=conversation.id
                ).order_by(AutonomousTask.created_at.desc()).first()
                if autonomous_task and autonomous_task.status in ('active', 'running'):
                    try:
                        stop_task(task_id, conversation.id, autonomous_task.type)
                        logger.info(f"已暂停自主任务: {autonomous_task.id}")
                    except Exception as e:
                        logger.error(f"暂停自主任务失败 {autonomous_task.id}: {str(e)}")
        
        # 清除脏数据后再更新状态
        db.session.expire_all()
        experiment = ParallelExperiment.query.get(experiment.id)
        
        # 将 active/stopped 的任务标记为 paused
        for task_id in current_task_ids:
            conversation = Conversation.query.filter_by(action_task_id=task_id).first()
            if conversation:
                autonomous_task = AutonomousTask.query.filter_by(
                    conversation_id=conversation.id
                ).order_by(AutonomousTask.created_at.desc()).first()
                if autonomous_task and autonomous_task.status in ('active', 'stopped'):
                    autonomous_task.status = 'paused'
        
        experiment.status = 'paused'
        db.session.commit()
        
        logger.info(f"实验已暂停: {experiment.name}")
        return True
    
    @staticmethod
    def resume_experiment(experiment_id: str) -> bool:
        """恢复实验"""
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return False
        
        if experiment.status != 'paused':
            return False
        
        # 重新启动当前轮次暂停的自主任务
        task_config = experiment.config.get('task_config', {})
        max_concurrent = task_config.get('maxConcurrent', 3)
        current_iteration = experiment.current_iteration or 0
        current_task_ids = []
        if experiment.cloned_action_task_ids and current_iteration:
            current_task_ids = experiment.cloned_action_task_ids.get(str(current_iteration), [])
        
        paused_task_ids = []
        for task_id in current_task_ids:
            conversation = Conversation.query.filter_by(action_task_id=task_id).first()
            if conversation:
                # 检查是否有已暂停的任务（使用 paused 状态）
                autonomous_task = AutonomousTask.query.filter_by(
                    conversation_id=conversation.id
                ).order_by(AutonomousTask.created_at.desc()).first()
                
                if autonomous_task and autonomous_task.status == 'paused':
                    paused_task_ids.append(task_id)
        
        if paused_task_ids:
            from app.services.experiment_executor import submit_experiment_tasks
            submit_experiment_tasks(
                experiment_id, paused_task_ids, task_config, max_concurrent
            )
        
        experiment.status = 'running'
        db.session.commit()
        
        logger.info(f"实验已恢复: {experiment.name}")
        return True
    
    @staticmethod
    def stop_experiment(experiment_id: str) -> bool:
        """停止实验
        
        停止策略（三层保障）：
        1. cancel_experiment: 清空 executor 待执行队列 + 主动停止调度器中所有正在运行的任务
        2. 遍历所有任务，停止 active/running 状态的 AutonomousTask（兜底）
        3. 清空 pending_combinations
        """
        # 先清理可能存在的脏 session（前次请求乐观锁冲突可能留下脏状态）
        try:
            db.session.rollback()
        except Exception:
            pass
        
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return False
        
        if experiment.status not in ['running', 'paused']:
            return False
        
        # 停止当前轮次运行中的自主任务
        current_iteration = experiment.current_iteration or 0
        current_task_ids = []
        if experiment.cloned_action_task_ids and current_iteration:
            current_task_ids = experiment.cloned_action_task_ids.get(str(current_iteration), [])
        
        from app.services.scheduler import stop_task
        from app.services.experiment_executor import cancel_experiment
        
        # 第一层：清空 executor 队列 + 主动停止调度器中正在运行的线程任务
        cancel_experiment(experiment_id, current_task_ids)
        
        # 第二层：遍历所有 task，停止 active 或 running 状态的（兜底，处理可能遗漏的）
        for task_id in current_task_ids:
            try:
                conversation = Conversation.query.filter_by(action_task_id=task_id).first()
                if conversation:
                    autonomous_task = AutonomousTask.query.filter_by(
                        conversation_id=conversation.id
                    ).order_by(AutonomousTask.created_at.desc()).first()
                    if autonomous_task and autonomous_task.status in ('active', 'running'):
                        try:
                            stop_task(task_id, conversation.id, autonomous_task.type)
                            logger.info(f"已停止自主任务: {autonomous_task.id}")
                        except Exception as e:
                            logger.error(f"停止自主任务失败 {autonomous_task.id}: {str(e)}")
            except Exception as e:
                logger.error(f"查询任务 {task_id} 状态失败: {str(e)}")
        
        # 清除 session 中的脏数据（调度器线程可能已更新这些行），然后重新查询
        db.session.rollback()
        db.session.expire_all()
        
        experiment = ParallelExperiment.query.get(experiment_id)
        experiment.status = 'stopped'
        experiment.end_time = get_current_time_with_timezone()
        
        # 清空待创建任务队列（延迟创建模式）
        if experiment.pending_combinations:
            current_iteration = experiment.current_iteration or 0
            if current_iteration:
                experiment.pending_combinations[str(current_iteration)] = []
                flag_modified(experiment, 'pending_combinations')
        
        try:
            db.session.commit()
        except Exception as e:
            logger.warning(f"停止实验 commit 冲突，重试: {str(e)[:100]}")
            db.session.rollback()
            # 重试：重新读取并仅更新状态
            experiment = ParallelExperiment.query.get(experiment_id)
            if experiment:
                experiment.status = 'stopped'
                experiment.end_time = get_current_time_with_timezone()
                db.session.commit()
        
        logger.info(f"实验已停止: {experiment.name}")
        return True
    
    @staticmethod
    def delete_experiment(experiment_id: str) -> bool:
        """删除实验"""
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return False
        
        # 模板不能删除
        if experiment.is_template:
            raise ValueError("模板实验不能删除")
        
        # 先停止实验
        if experiment.status in ['running', 'paused']:
            ParallelExperimentService.stop_experiment(experiment_id)
        
        # 删除实验步骤记录（先删，因为它引用了 action_task_id 和 experiment_id）
        ExperimentStep.query.filter_by(experiment_id=experiment_id).delete()
        db.session.flush()
        
        # 删除所有轮次的 ActionTask（使用 ActionTaskService 完整清理关联数据）
        # 注意：delete_action_task 内部会 commit，每个 task 独立事务
        if experiment.cloned_action_task_ids:
            for iteration, task_ids in experiment.cloned_action_task_ids.items():
                for task_id in task_ids:
                    try:
                        ActionTaskService.delete_action_task(task_id)
                    except Exception as e:
                        logger.error(f"删除实验克隆任务 {task_id} 失败: {str(e)}")
                        # 关键：IntegrityError 等异常会让 session 进入不可用状态
                        # 必须 rollback 才能继续后续操作
                        try:
                            db.session.rollback()
                        except Exception:
                            pass
        
        # 重新查询 experiment（之前的 commit/rollback 可能使 ORM 对象 detached）
        experiment = ParallelExperiment.query.get(experiment_id)
        if experiment:
            db.session.delete(experiment)
            db.session.commit()
        
        logger.info(f"实验已删除: {experiment.name}")
        return True
    
    @staticmethod
    def create_best_task(experiment_id: str, task_name: str = None, user_id: str = None) -> str:
        """使用最佳参数创建新任务"""
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            raise ValueError(f"实验不存在: {experiment_id}")
        
        if experiment.status != 'completed':
            raise ValueError("实验尚未完成")
        
        # 获取当前轮次的最佳参数
        best_params = {}
        current_iteration = experiment.current_iteration or 0
        if experiment.results_summary and current_iteration:
            iteration_summary = experiment.results_summary.get(str(current_iteration), {})
            best_run = iteration_summary.get('best_run')
            if best_run:
                best_params = best_run.get('parameters', {})
        
        # 提取目标变量名列表
        config = experiment.config or {}
        objectives = config.get('objectives', [])
        objective_var_names = [obj.get('variable') for obj in objectives if obj.get('variable')]
        
        # 从 ActionSpace 创建新任务
        task = ParallelExperimentService._create_action_task_from_space(
            action_space_id=experiment.source_action_space_id,
            params=best_params,
            name_suffix=task_name or "(最佳参数)",
            experiment_id=experiment_id,
            objective_variables=objective_var_names,
            user_id=user_id
        )
        
        # 标记为非实验克隆（正常任务）
        task.is_experiment_clone = False
        db.session.commit()
        
        logger.info(f"使用最佳参数创建任务: {task.title}")
        return task.id
    
    @staticmethod
    def record_step(experiment_id: str, action_task_id: str, step_number: int) -> Optional[str]:
        """记录实验步骤（变量快照）
        
        由调度器在每轮对话结束后调用
        """
        experiment = ParallelExperiment.query.get(experiment_id)
        if not experiment:
            return None
        
        task = ActionTask.query.get(action_task_id)
        if not task:
            return None
        
        conversation = Conversation.query.filter_by(action_task_id=action_task_id).first()
        
        # 获取当前变量快照
        variables_snapshot = {v.name: v.value for v in task.environment_variables}
        
        step = ExperimentStep(
            experiment_id=experiment_id,
            action_task_id=action_task_id,
            conversation_id=conversation.id if conversation else None,
            step_number=step_number,
            variables_snapshot=variables_snapshot
        )
        db.session.add(step)
        db.session.commit()
        
        logger.info(f"记录实验步骤: {experiment_id}:{action_task_id}:step{step_number}")
        return step.id
    
    @staticmethod
    def get_experiment_steps(experiment_id: str, page: int = None, limit: int = None) -> Dict[str, Any]:
        """获取实验的步骤记录（支持分页）
        
        Args:
            experiment_id: 实验ID
            page: 页码（None 表示返回全部，向后兼容）
            limit: 每页数量（默认 50）
            
        Returns:
            分页模式: {'steps': [...], 'total': N, 'page': N, 'limit': N}
            全量模式: [step_dict, ...]（向后兼容）
        """
        query = ExperimentStep.query.filter_by(experiment_id=experiment_id).order_by(
            ExperimentStep.action_task_id, ExperimentStep.step_number
        )
        
        if page is not None:
            # 分页模式
            limit = limit or 50
            total = query.count()
            steps = query.offset((page - 1) * limit).limit(limit).all()
            return {
                'steps': [step.to_dict() for step in steps],
                'total': total,
                'page': page,
                'limit': limit,
                'total_pages': (total + limit - 1) // limit
            }
        else:
            # 全量模式（向后兼容）
            steps = query.all()
            return [step.to_dict() for step in steps]
    
    @staticmethod
    def get_run_steps(experiment_id: str, action_task_id: str) -> List[Dict[str, Any]]:
        """获取单个 run 的步骤记录
        
        Args:
            experiment_id: 实验ID
            action_task_id: 行动任务ID
        
        Returns:
            步骤记录列表
        """
        steps = ExperimentStep.query.filter_by(
            experiment_id=experiment_id,
            action_task_id=action_task_id
        ).order_by(ExperimentStep.step_number).all()
        
        return [step.to_dict() for step in steps]
