"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: one_click_generation.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: one_click_generation.py
# ============================================================

"""
一键生成API路由
提供一键创建角色、行动空间、规则和任务的API接口
"""

import logging
from app.services.one_click_generation_service import OneClickGenerationService
from app.services.role_service import RoleService
from app.models import Role, ActionSpace, Rule, ActionTask, RuleSet, ActionSpaceRuleSet, RuleSetRule, ActionSpaceRole, Agent, ActionTaskAgent
from app.extensions import db

logger = logging.getLogger(__name__)

# 创建蓝图

@router.post('/one-click-generation/generate-role')
async def generate_role(request: Request):
    """生成角色配置"""
    try:
        data = await request.json()
        user_requirement = data.get('user_requirement')
        
        if not user_requirement:
            raise HTTPException(status_code=400, detail={'error': '缺少用户需求描述'})
        
        service = OneClickGenerationService()
        role_data = service.generate_role(user_requirement)
        
        return {
            'success': True,
            'data': role_data
        }
        
    except Exception as e:
        logger.error(f"生成角色失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })

@router.post('/one-click-generation/generate-action-space')
async def generate_action_space(request: Request):
    """生成行动空间配置"""
    try:
        data = await request.json()
        user_requirement = data.get('user_requirement')
        roles_info = data.get('roles_info')  # 改为复数形式

        if not user_requirement or not roles_info:
            raise HTTPException(status_code=400, detail={'error': '缺少必要参数'})

        service = OneClickGenerationService()
        action_space_data = service.generate_action_space(user_requirement, roles_info)

        return {
            'success': True,
            'data': action_space_data
        }

    except Exception as e:
        logger.error(f"生成行动空间失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })

@router.post('/one-click-generation/generate-rules')
async def generate_rules(request: Request):
    """生成规则配置"""
    try:
        data = await request.json()
        user_requirement = data.get('user_requirement')
        roles_info = data.get('roles_info')  # 改为复数形式
        action_space_info = data.get('action_space_info')

        if not all([user_requirement, roles_info, action_space_info]):
            raise HTTPException(status_code=400, detail={'error': '缺少必要参数'})

        service = OneClickGenerationService()
        rules_data = service.generate_rules(user_requirement, roles_info, action_space_info)

        return {
            'success': True,
            'data': rules_data
        }

    except Exception as e:
        logger.error(f"生成规则失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })

@router.post('/one-click-generation/generate-task')
async def generate_task(request: Request):
    """生成任务配置"""
    try:
        data = await request.json()
        user_requirement = data.get('user_requirement')
        roles_info = data.get('roles_info')  # 改为复数形式
        action_space_info = data.get('action_space_info')
        rules_info = data.get('rules_info')

        if not all([user_requirement, roles_info, action_space_info, rules_info]):
            raise HTTPException(status_code=400, detail={'error': '缺少必要参数'})

        service = OneClickGenerationService()
        task_data = service.generate_task(user_requirement, roles_info, action_space_info, rules_info)

        return {
            'success': True,
            'data': task_data
        }

    except Exception as e:
        logger.error(f"生成任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })

@router.post('/one-click-generation/generate-all')
async def generate_all(request: Request):
    """一键生成所有内容"""
    try:
        data = await request.json()
        user_requirement = data.get('user_requirement')
        
        if not user_requirement:
            raise HTTPException(status_code=400, detail={'error': '缺少用户需求描述'})
        
        service = OneClickGenerationService()
        result = service.generate_all(user_requirement)
        
        return {
            'success': True,
            'data': result
        }
        
    except Exception as e:
        logger.error(f"一键生成失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })

@router.post('/one-click-generation/create-all')
async def create_all(request: Request, current_user=Depends(get_current_user)):
    """批量创建所有实体"""
    try:
        # 获取当前用户
        data = await request.json()
        generated_data = data.get('generated_data')
        
        if not generated_data:
            raise HTTPException(status_code=400, detail={'error': '缺少生成的数据'})

        # 验证数据结构
        logger.info(f"接收到的数据字段: {list(generated_data.keys())}")

        roles_data = generated_data.get('roles')  # 改为复数形式
        action_space_data = generated_data.get('action_space')
        rules_data = generated_data.get('rules')
        task_data = generated_data.get('task')

        if not all([roles_data, action_space_data, rules_data, task_data]):
            missing_fields = []
            if not roles_data:
                missing_fields.append('roles')
            if not action_space_data:
                missing_fields.append('action_space')
            if not rules_data:
                missing_fields.append('rules')
            if not task_data:
                missing_fields.append('task')

            logger.error(f"缺少字段: {missing_fields}")
            raise HTTPException(status_code=400, detail={'error': f'生成的数据不完整，缺少字段: {", ".join(missing_fields)}'})

        created_entities = {}

        try:
            # 1. 创建多个角色
            created_roles = []
            for role_data in roles_data:
                # 使用RoleService创建角色，自动处理默认能力绑定
                role = RoleService.create_role({
                    'name': role_data['name'],
                    'description': role_data.get('description', ''),
                    'system_prompt': role_data['system_prompt'],
                    'temperature': role_data.get('temperature', 0.7),
                    'is_shared': False
                }, current_user)

                created_roles.append({
                    'id': role.id,
                    'name': role.name,
                    'role_type': role_data.get('role_type', 'primary')
                })
                logger.info(f"角色创建成功: {role.name} (ID: {role.id})")

            created_entities['roles'] = created_roles
            
            # 2. 创建行动空间
            action_space = ActionSpace(
                name=action_space_data['name'],
                description=action_space_data.get('description', ''),
                settings=action_space_data.get('settings', {}),
                created_by=current_user.id if current_user else None,
                is_shared=False
            )
            db.session.add(action_space)
            db.session.flush()  # 获取ID
            created_entities['action_space'] = {
                'id': action_space.id,
                'name': action_space.name
            }

            # 2.5. 将角色绑定到行动空间
            for role_info in created_roles:
                action_space_role = ActionSpaceRole(
                    action_space_id=action_space.id,
                    role_id=role_info['id'],
                    quantity=1,  # 默认数量为1
                    settings={},  # 默认设置
                    additional_prompt=''  # 默认无额外提示词
                )
                db.session.add(action_space_role)

            logger.info(f"已将 {len(created_roles)} 个角色绑定到行动空间")
            
            # 3. 创建规则集
            rule_set_name = f"{action_space_data['name']}规则集"
            rule_set = RuleSet(
                name=rule_set_name,
                description=f"为{action_space_data['name']}自动生成的规则集",
                created_by=current_user.id if current_user else None,
                is_shared=False
            )
            db.session.add(rule_set)
            db.session.flush()  # 获取ID
            logger.info(f"规则集创建成功: {rule_set_name} (ID: {rule_set.id})")
            
            # 4. 创建规则并关联到规则集
            created_rules = []
            logger.info(f"开始创建 {len(rules_data)} 个规则")
            for i, rule_data in enumerate(rules_data):
                logger.info(f"创建第 {i+1} 个规则: {rule_data.get('name', 'Unknown')}")

                # 创建规则（只使用必要字段）
                rule = Rule(
                    name=rule_data['name'],
                    content=rule_data['content'],
                    type='llm',  # 固定为自然语言规则
                    created_by=current_user.id if current_user else None,
                    is_shared=False
                )
                db.session.add(rule)
                db.session.flush()  # 获取规则ID
                logger.info(f"规则创建成功，ID: {rule.id}")

                # 创建规则集与规则的关联
                rule_set_rule = RuleSetRule(
                    rule_set_id=rule_set.id,
                    rule_id=rule.id,
                    priority=0  # 默认优先级
                )
                db.session.add(rule_set_rule)
                logger.info(f"规则关联创建成功: 规则集ID {rule_set.id} -> 规则ID {rule.id}")

                created_rules.append({
                    'id': rule.id,
                    'name': rule.name
                })

            logger.info(f"所有规则创建完成，共 {len(created_rules)} 个规则")
            
            created_entities['rule_set'] = {
                'id': rule_set.id,
                'name': rule_set.name,
                'rules': created_rules
            }
            
            # 5. 关联行动空间和规则集
            action_space_rule_set = ActionSpaceRuleSet(
                action_space_id=action_space.id,
                rule_set_id=rule_set.id
            )
            db.session.add(action_space_rule_set)
            logger.info(f"行动空间与规则集关联成功: 行动空间ID {action_space.id} -> 规则集ID {rule_set.id}")
            
            # 6. 创建行动任务
            action_task = ActionTask(
                title=task_data['title'],
                description=task_data.get('description', ''),
                mode=task_data.get('mode', 'sequential'),
                action_space_id=action_space.id,
                rule_set_id=rule_set.id,
                status='active',
                user_id=current_user.id if current_user else None  # 设置当前用户ID
            )
            db.session.add(action_task)
            db.session.flush()  # 获取ID
            created_entities['action_task'] = {
                'id': action_task.id,
                'title': action_task.title
            }

            # 7. 为每个角色创建智能体
            created_agents = []
            for i, role in enumerate(created_roles):
                logger.info(f"为角色 {role['name']} (ID: {role['id']}) 创建智能体")

                # 创建智能体实例
                agent = Agent(
                    name=role['name'],
                    description='',  # 角色没有description字段
                    avatar='default.png',
                    settings={},
                    action_task_id=action_task.id,
                    role_id=role['id'],
                    type='agent',
                    is_observer=False
                )
                db.session.add(agent)
                db.session.flush()  # 获取agent.id

                # 创建行动任务-智能体关联
                task_agent = ActionTaskAgent(
                    action_task_id=action_task.id,
                    agent_id=agent.id,
                    is_default=(i == 0)  # 第一个智能体设为默认
                )
                db.session.add(task_agent)

                created_agents.append({
                    'id': agent.id,
                    'name': agent.name,
                    'role_id': role['id']
                })
                logger.info(f"智能体创建成功: {agent.name} (ID: {agent.id})")

            created_entities['agents'] = created_agents
            logger.info(f"所有智能体创建完成，共 {len(created_agents)} 个智能体")

            # 提交所有更改
            db.session.commit()

            # 8. 创建默认会话（流式输出功能需要）
            try:
                from app.services.conversation_service import ConversationService
                default_conversation = ConversationService.create_conversation_for_action_task(action_task)
                logger.info(f"默认会话创建成功: {default_conversation['id']}")
            except Exception as e:
                logger.error(f"创建默认会话失败: {str(e)}")

            # 9. 初始化项目空间文件结构
            try:
                from app.services.workspace_service import workspace_service

                # 获取智能体信息
                agent_ids = [agent['id'] for agent in created_agents]
                agent_info = []
                for agent_data in created_agents:
                    # 获取角色名称
                    role_name = None
                    for role in created_roles:
                        if role['id'] == agent_data['role_id']:
                            role_name = role['name']
                            break

                    agent_info.append({
                        'id': agent_data['id'],
                        'name': agent_data['name'],
                        'role_name': role_name
                    })

                workspace_service.initialize_workspace_for_action_task(
                    task_id=action_task.id,
                    agent_ids=agent_ids,
                    task_title=action_task.title,
                    agent_info=agent_info
                )
                logger.info(f"项目空间文件结构初始化成功")
            except Exception as e:
                logger.error(f"初始化项目空间文件结构失败: {str(e)}")
                # 继续处理，不中断任务创建

            # 验证创建结果
            rule_set_rules_count = RuleSetRule.query.filter_by(rule_set_id=rule_set.id).count()
            action_space_rule_sets_count = ActionSpaceRuleSet.query.filter_by(action_space_id=action_space.id).count()
            agents_count = Agent.query.filter_by(action_task_id=action_task.id).count()

            logger.info(f"一键创建成功，创建了角色、行动空间、规则集、任务和智能体")
            logger.info(f"验证结果: 规则集包含 {rule_set_rules_count} 个规则，行动空间关联 {action_space_rule_sets_count} 个规则集，任务包含 {agents_count} 个智能体")

            return {
                'success': True,
                'message': '一键创建成功',
                'data': created_entities,
                'verification': {
                    'rule_set_rules_count': rule_set_rules_count,
                    'action_space_rule_sets_count': action_space_rule_sets_count,
                    'agents_count': agents_count
                }
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"创建实体失败: {str(e)}")
            raise
        
    except Exception as e:
        logger.error(f"批量创建失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': str(e)
        })

