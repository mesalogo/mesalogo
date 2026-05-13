"""
规则API路由

处理与规则相关的所有API请求
合并自 Flask rules/ 包 (rules.py, rule_sets.py, associations.py, validation.py, stats.py, utils.py)

Flask → FastAPI 变更:
- Blueprint → APIRouter
- request.args.get() → Query()
- request.get_json() → await request.json()
- jsonify(data) → 直接返回 dict
- jsonify(data), 4xx → HTTPException
- @login_required → current_user=Depends(get_current_user)
"""
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
import datetime
import logging

from app.models import (
    Rule, RuleSet, RuleSetRule, ActionSpace, ActionSpaceRuleSet, db
)
from app.services.user_permission_service import UserPermissionService
from core.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# 工具函数 (原 utils.py)
# ══════════════════════════════════════════════════════════════════════════════

def validate_rule_access(rule_id, current_user, permission_type='view'):
    """验证规则访问权限"""
    rule = Rule.query.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail='规则不存在')

    if permission_type == 'view' and not UserPermissionService.can_view_resource(current_user, rule):
        raise HTTPException(status_code=403, detail='无权限查看此规则')
    elif permission_type == 'edit' and not UserPermissionService.can_edit_resource(current_user, rule):
        raise HTTPException(status_code=403, detail='无权限编辑此规则')
    elif permission_type == 'delete' and not UserPermissionService.can_delete_resource(current_user, rule):
        raise HTTPException(status_code=403, detail='无权限删除此规则')

    return rule


def validate_rule_set_access(rule_set_id, current_user, permission_type='view'):
    """验证规则集访问权限"""
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail='规则集不存在')

    if permission_type == 'view' and not UserPermissionService.can_view_resource(current_user, rule_set):
        raise HTTPException(status_code=403, detail='无权限查看此规则集')
    elif permission_type == 'edit' and not UserPermissionService.can_edit_resource(current_user, rule_set):
        raise HTTPException(status_code=403, detail='无权限编辑此规则集')
    elif permission_type == 'delete' and not UserPermissionService.can_delete_resource(current_user, rule_set):
        raise HTTPException(status_code=403, detail='无权限删除此规则集')

    return rule_set


# ══════════════════════════════════════════════════════════════════════════════
# 规则 CRUD (原 rules.py)
# ══════════════════════════════════════════════════════════════════════════════

@router.get('/rules')
def get_rules(
    category: str = Query(None),
    is_active: str = Query(None),
    type: str = Query(None),
    current_user=Depends(get_current_user),
):
    """获取所有规则列表（已应用多租户权限过滤）"""
    # 可选的过滤参数
    rule_type = type

    # 构建查询
    query = Rule.query

    # 应用权限过滤
    query = UserPermissionService.filter_viewable_resources(query, Rule, current_user)

    if category:
        query = query.filter(Rule.category == category)

    if is_active is not None:
        is_active_bool = is_active.lower() == 'true'
        query = query.filter(Rule.is_active == is_active_bool)

    if rule_type:
        query = query.filter(Rule.type == rule_type)

    rules = query.all()
    result = []

    for rule in rules:
        # 获取与规则关联的规则集
        rule_sets = []
        for rsr in rule.rule_sets:
            rule_set = RuleSet.query.get(rsr.rule_set_id)
            if rule_set:
                rule_sets.append({
                    'id': rule_set.id,
                    'name': rule_set.name,
                    'priority': rsr.priority
                })

        # 从settings中获取interpreter
        interpreter = rule.settings.get('interpreter', 'javascript') if rule.settings else 'javascript'

        result.append({
            'id': rule.id,
            'name': rule.name,
            'description': rule.description,
            'content': rule.content,
            'category': rule.category,
            'type': rule.type,
            'is_active': rule.is_active,
            'settings': rule.settings,
            'interpreter': interpreter,
            'created_at': rule.created_at.isoformat() if rule.created_at else None,
            'updated_at': rule.updated_at.isoformat() if rule.updated_at else None,
            'rule_sets': rule_sets,
            # 多租户字段
            'created_by': rule.created_by,
            'is_shared': rule.is_shared
        })

    return {'rules': result}


@router.get('/rules/{rule_id}')
def get_rule(rule_id: str, current_user=Depends(get_current_user)):
    """获取特定规则详情"""
    rule = Rule.query.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail='规则未找到')

    # 检查查看权限
    if not UserPermissionService.can_view_resource(current_user, rule):
        raise HTTPException(status_code=403, detail='无权限查看此规则')

    # 获取与规则关联的规则集
    rule_sets = []
    for rsr in rule.rule_sets:
        rule_set = RuleSet.query.get(rsr.rule_set_id)
        if rule_set:
            rule_sets.append({
                'id': rule_set.id,
                'name': rule_set.name,
                'description': rule_set.description,
                'priority': rsr.priority
            })

    # 从settings中获取interpreter
    interpreter = rule.settings.get('interpreter', 'javascript') if rule.settings else 'javascript'

    result = {
        'id': rule.id,
        'name': rule.name,
        'description': rule.description,
        'content': rule.content,
        'category': rule.category,
        'type': rule.type,
        'is_active': rule.is_active,
        'settings': rule.settings,
        'interpreter': interpreter,
        'created_at': rule.created_at.isoformat() if rule.created_at else None,
        'updated_at': rule.updated_at.isoformat() if rule.updated_at else None,
        'rule_sets': rule_sets,
        # 多租户字段
        'created_by': rule.created_by,
        'is_shared': rule.is_shared
    }

    return result


@router.post('/rules', status_code=201)
async def create_rule(request: Request, current_user=Depends(get_current_user)):
    """创建新规则"""
    data = await request.json()

    # 验证必填字段
    required_fields = ['name', 'content']
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f'缺少必填字段: {field}')

    try:
        # 初始化settings
        settings = data.get('settings', {})

        # 如果是逻辑规则类型，并且提供了interpreter字段，则存入settings
        if data.get('type') == 'logic' and 'interpreter' in data:
            settings['interpreter'] = data['interpreter']

        # 设置多租户字段
        created_by = None
        is_shared = False

        if current_user:
            if current_user.is_admin:
                created_by = data.get('created_by', None)
                is_shared = data.get('is_shared', True if created_by is None else False)
            else:
                created_by = current_user.id
                is_shared = data.get('is_shared', False)

        rule = Rule(
            name=data['name'],
            description=data.get('description', ''),
            content=data['content'],
            category=data.get('category', ''),
            type=data.get('type', 'llm'),
            is_active=data.get('is_active', True),
            settings=settings,
            created_by=created_by,
            is_shared=is_shared
        )

        db.session.add(rule)
        db.session.commit()

        # 关联规则集（如果提供）
        rule_set_ids = data.get('rule_set_ids', [])
        if rule_set_ids:
            for rule_set_id in rule_set_ids:
                rule_set = RuleSet.query.get(rule_set_id)
                if rule_set:
                    rule_set_rule = RuleSetRule(
                        rule_id=rule.id,
                        rule_set_id=rule_set_id,
                        priority=0
                    )
                    db.session.add(rule_set_rule)

            db.session.commit()

        return {
            'id': rule.id,
            'name': rule.name,
            'message': '规则创建成功'
        }

    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail='规则创建失败，可能存在名称冲突')
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'规则创建失败: {str(e)}')


@router.put('/rules/{rule_id}')
async def update_rule(rule_id: str, request: Request, current_user=Depends(get_current_user)):
    """更新规则信息"""
    rule = Rule.query.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail='规则未找到')

    # 检查编辑权限
    if not UserPermissionService.can_edit_resource(current_user, rule):
        raise HTTPException(status_code=403, detail='无权限编辑此规则')

    data = await request.json()

    try:
        # 更新规则属性
        if 'name' in data:
            rule.name = data['name']
        if 'description' in data:
            rule.description = data['description']
        if 'content' in data:
            rule.content = data['content']
        if 'category' in data:
            rule.category = data['category']
        if 'type' in data:
            rule.type = data['type']
        if 'is_active' in data:
            rule.is_active = data['is_active']

        # 更新settings
        if 'settings' in data:
            rule.settings = data['settings']

        # 如果是逻辑规则，并且提供了interpreter字段
        if rule.type == 'logic' and 'interpreter' in data:
            if not rule.settings:
                rule.settings = {}
            rule.settings['interpreter'] = data['interpreter']

        # 只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, rule):
            rule.is_shared = data['is_shared']

        # 更新规则集关联
        if 'rule_set_ids' in data:
            RuleSetRule.query.filter_by(rule_id=rule_id).delete()

            for rule_set_id in data['rule_set_ids']:
                rule_set = RuleSet.query.get(rule_set_id)
                if rule_set:
                    rule_set_rule = RuleSetRule(
                        rule_id=rule.id,
                        rule_set_id=rule_set_id,
                        priority=0
                    )
                    db.session.add(rule_set_rule)

        db.session.commit()
        return {'message': '规则更新成功'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'规则更新失败: {str(e)}')


@router.delete('/rules/{rule_id}')
def delete_rule(rule_id: str, current_user=Depends(get_current_user)):
    """删除规则"""
    rule = Rule.query.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail='规则未找到')

    # 检查删除权限
    if not UserPermissionService.can_delete_resource(current_user, rule):
        raise HTTPException(status_code=403, detail='无权限删除此规则')

    try:
        # 首先删除与规则集的关联
        RuleSetRule.query.filter_by(rule_id=rule_id).delete()

        # 然后删除规则
        db.session.delete(rule)
        db.session.commit()

        return {'message': '规则删除成功'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'规则删除失败: {str(e)}')


# ══════════════════════════════════════════════════════════════════════════════
# 规则集 CRUD (原 rule_sets.py)
# ══════════════════════════════════════════════════════════════════════════════

@router.get('/rule-sets')
def get_all_rule_sets(
    name: str = Query(None),
    action_space_id: int = Query(None),
    current_user=Depends(get_current_user),
):
    """
    获取所有规则集列表，支持筛选（已应用多租户权限过滤）

    Query参数:
        name: 按名称筛选
        action_space_id: 按行动空间ID筛选
    """
    # 构建查询
    query = RuleSet.query

    # 应用权限过滤
    query = UserPermissionService.filter_viewable_resources(query, RuleSet, current_user)

    # 应用过滤条件
    if name:
        query = query.filter(RuleSet.name.ilike(f'%{name}%'))

    # 先获取所有规则集
    rule_sets = query.all()
    result = []

    for rule_set in rule_sets:
        # 获取规则集关联的行动空间
        related_spaces = []
        associations = ActionSpaceRuleSet.query.filter_by(rule_set_id=rule_set.id).all()

        for association in associations:
            space = ActionSpace.query.get(association.action_space_id)
            if space:
                related_spaces.append({
                    'id': space.id,
                    'name': space.name
                })

        # 如果指定了行动空间ID过滤，跳过不相关的规则集
        if action_space_id and not any(space['id'] == action_space_id for space in related_spaces):
            continue

        # 获取规则集规则数量
        rule_count = RuleSetRule.query.filter_by(rule_set_id=rule_set.id).count()

        # 获取主要关联的行动空间（如果有多个关联，取第一个）
        action_space_id_value = None
        action_space_name = None
        if related_spaces:
            action_space_id_value = related_spaces[0]['id']
            action_space_name = related_spaces[0]['name']

        result.append({
            'id': rule_set.id,
            'name': rule_set.name,
            'description': rule_set.description,
            'settings': rule_set.settings,
            'action_space_id': action_space_id_value,
            'action_space_name': action_space_name,
            'rule_count': rule_count,
            'created_at': rule_set.created_at.isoformat() if rule_set.created_at else None,
            'updated_at': rule_set.updated_at.isoformat() if rule_set.updated_at else None,
            # 多租户字段
            'created_by': rule_set.created_by,
            'is_shared': rule_set.is_shared
        })

    return {'rule_sets': result}


@router.post('/rule-sets', status_code=201)
async def create_rule_set(request: Request, current_user=Depends(get_current_user)):
    """
    创建新规则集

    规则集可以独立存在，不需要关联到行动空间。
    可以同时关联规则和行动空间。
    """
    data = await request.json()

    # 验证必填字段
    if not data.get('name'):
        raise HTTPException(status_code=400, detail='缺少必填字段: name')

    try:
        # 设置多租户字段
        created_by = None
        is_shared = False

        if current_user:
            if current_user.is_admin:
                created_by = data.get('created_by', None)
                is_shared = data.get('is_shared', True if created_by is None else False)
            else:
                created_by = current_user.id
                is_shared = data.get('is_shared', False)

        # 创建规则集
        rule_set = RuleSet(
            name=data.get('name'),
            description=data.get('description', ''),
            conditions=data.get('conditions', []),
            actions=data.get('actions', []),
            settings=data.get('settings', {}),
            created_by=created_by,
            is_shared=is_shared
        )

        db.session.add(rule_set)
        db.session.flush()

        # 如果提供了规则ID列表，创建规则关联
        rule_ids = data.get('rule_ids', [])
        for rule_id in rule_ids:
            rule = Rule.query.get(rule_id)
            if rule:
                rule_set_rule = RuleSetRule(
                    rule_set_id=rule_set.id,
                    rule_id=rule_id,
                    priority=0
                )
                db.session.add(rule_set_rule)

        # 如果提供了规则名称列表，也创建规则关联
        rule_names = data.get('rule_names', [])
        for rule_name in rule_names:
            rule = Rule.query.filter_by(name=rule_name).first()
            if rule:
                existing = db.session.query(RuleSetRule).filter_by(
                    rule_set_id=rule_set.id, rule_id=rule.id
                ).first()

                if not existing:
                    rule_set_rule = RuleSetRule(
                        rule_set_id=rule_set.id,
                        rule_id=rule.id,
                        priority=0
                    )
                    db.session.add(rule_set_rule)

        # 如果提供了行动空间ID，创建关联
        single_action_space_id = data.get('action_space_id')
        if single_action_space_id:
            action_space = ActionSpace.query.get(single_action_space_id)
            if action_space:
                association = ActionSpaceRuleSet(
                    action_space_id=single_action_space_id,
                    rule_set_id=rule_set.id,
                    settings={}
                )
                db.session.add(association)

        # 如果提供了行动空间ID列表，创建多个关联
        action_space_ids = data.get('action_space_ids', [])
        for space_id in action_space_ids:
            if space_id == single_action_space_id:
                continue

            action_space = ActionSpace.query.get(space_id)
            if action_space:
                association = ActionSpaceRuleSet(
                    action_space_id=space_id,
                    rule_set_id=rule_set.id,
                    settings={}
                )
                db.session.add(association)

        db.session.commit()

        return {
            'id': rule_set.id,
            'name': rule_set.name,
            'message': '规则集创建成功'
        }

    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail='规则集创建失败，可能存在名称冲突')
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'规则集创建失败: {str(e)}')


@router.get('/rule-sets/all-stats')
def get_all_rule_sets_stats():
    """获取所有规则集的统计信息（包括规则数量和所属行动空间）"""
    # 使用SQL聚合查询获取每个规则集的规则数量
    stats = db.session.query(
        RuleSet.id,
        RuleSet.name,
        RuleSet.description,
        RuleSet.created_at,
        RuleSet.updated_at,
        func.count(RuleSetRule.rule_id).label('rule_count')
    ).outerjoin(
        RuleSetRule, RuleSetRule.rule_set_id == RuleSet.id
    ).group_by(
        RuleSet.id
    ).all()

    result = []
    for rule_set in stats:
        # 获取关联的行动空间信息
        related_spaces = []
        associations = ActionSpaceRuleSet.query.filter_by(rule_set_id=rule_set.id).all()
        for association in associations:
            space = ActionSpace.query.get(association.action_space_id)
            if space:
                related_spaces.append({
                    'id': space.id,
                    'name': space.name
                })

        result.append({
            'id': rule_set.id,
            'name': rule_set.name,
            'description': rule_set.description,
            'rule_count': rule_set.rule_count,
            'related_spaces': related_spaces,
            'created_at': rule_set.created_at.isoformat() if rule_set.created_at else None,
            'updated_at': rule_set.updated_at.isoformat() if rule_set.updated_at else None
        })

    return {'rule_sets': result}

@router.get('/rule-sets/{rule_set_id}')
def get_rule_set(rule_set_id: str, current_user=Depends(get_current_user)):
    """
    获取单个规则集详情

    返回规则集详情，包括规则列表和关联的行动空间
    """
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail='规则集未找到')

    # 检查查看权限
    if not UserPermissionService.can_view_resource(current_user, rule_set):
        raise HTTPException(status_code=403, detail='无权限查看此规则集')

    # 获取规则集关联的规则
    rules = []
    for rsr in rule_set.rules_relation:
        rule = Rule.query.get(rsr.rule_id)
        if rule:
            interpreter = rule.settings.get('interpreter', 'javascript') if rule.settings else 'javascript'

            rules.append({
                'id': rule.id,
                'name': rule.name,
                'description': rule.description,
                'content': rule.content,
                'category': rule.category,
                'type': rule.type,
                'is_active': rule.is_active,
                'priority': rsr.priority,
                'interpreter': interpreter,
                'created_at': rule.created_at.isoformat() if rule.created_at else None,
                'updated_at': rule.updated_at.isoformat() if rule.updated_at else None
            })

    # 获取规则集关联的行动空间
    related_spaces = []
    associations = ActionSpaceRuleSet.query.filter_by(rule_set_id=rule_set.id).all()
    for association in associations:
        space = ActionSpace.query.get(association.action_space_id)
        if space:
            related_spaces.append({
                'id': space.id,
                'name': space.name,
                'description': space.description
            })

    result = {
        'id': rule_set.id,
        'name': rule_set.name,
        'description': rule_set.description,
        'settings': rule_set.settings,
        'conditions': rule_set.conditions,
        'actions': rule_set.actions,
        'rules': rules,
        'spaces': related_spaces,
        'created_at': rule_set.created_at.isoformat() if rule_set.created_at else None,
        'updated_at': rule_set.updated_at.isoformat() if rule_set.updated_at else None,
        # 多租户字段
        'created_by': rule_set.created_by,
        'is_shared': rule_set.is_shared
    }

    return result


@router.put('/rule-sets/{rule_set_id}')
async def update_rule_set(rule_set_id: str, request: Request, current_user=Depends(get_current_user)):
    """
    更新规则集信息

    可以更新规则集的基本信息，以及关联的规则和行动空间
    """
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail='规则集未找到')

    # 检查编辑权限
    if not UserPermissionService.can_edit_resource(current_user, rule_set):
        raise HTTPException(status_code=403, detail='无权限编辑此规则集')

    data = await request.json()

    try:
        # 更新规则集属性
        if 'name' in data:
            rule_set.name = data['name']
        if 'description' in data:
            rule_set.description = data['description']
        if 'settings' in data:
            rule_set.settings = data['settings']
        if 'conditions' in data:
            rule_set.conditions = data['conditions']
        if 'actions' in data:
            rule_set.actions = data['actions']

        # 只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, rule_set):
            rule_set.is_shared = data['is_shared']

        # 如果提供了规则ID列表，更新规则关联
        if 'rule_ids' in data:
            RuleSetRule.query.filter_by(rule_set_id=rule_set_id).delete()

            for rule_id in data['rule_ids']:
                rule = Rule.query.get(rule_id)
                if rule:
                    rule_set_rule = RuleSetRule(
                        rule_set_id=rule_set.id,
                        rule_id=rule_id,
                        priority=0
                    )
                    db.session.add(rule_set_rule)

        # 如果提供了规则优先级映射，更新规则优先级
        if 'rule_priorities' in data and isinstance(data['rule_priorities'], dict):
            for rule_id_str, priority in data['rule_priorities'].items():
                try:
                    r_id = int(rule_id_str)
                    rule_set_rule = RuleSetRule.query.filter_by(
                        rule_set_id=rule_set_id,
                        rule_id=r_id
                    ).first()

                    if rule_set_rule:
                        rule_set_rule.priority = priority
                except (ValueError, TypeError):
                    continue

        # 如果提供了行动空间ID列表，更新行动空间关联
        if 'action_space_ids' in data:
            ActionSpaceRuleSet.query.filter_by(rule_set_id=rule_set_id).delete()

            for space_id in data['action_space_ids']:
                action_space = ActionSpace.query.get(space_id)
                if action_space:
                    association = ActionSpaceRuleSet(
                        action_space_id=space_id,
                        rule_set_id=rule_set.id,
                        settings={}
                    )
                    db.session.add(association)

        db.session.commit()

        return {
            'id': rule_set.id,
            'name': rule_set.name,
            'message': '规则集更新成功'
        }

    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail='规则集更新失败，可能存在名称冲突')
    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'规则集更新失败: {str(e)}')


@router.delete('/rule-sets/{rule_set_id}')
def delete_rule_set(rule_set_id: str, current_user=Depends(get_current_user)):
    """删除规则集"""
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail='规则集未找到')

    # 检查删除权限
    if not UserPermissionService.can_delete_resource(current_user, rule_set):
        raise HTTPException(status_code=403, detail='无权限删除此规则集')

    try:
        # 首先删除规则集与规则的关联
        RuleSetRule.query.filter_by(rule_set_id=rule_set_id).delete()

        # 删除与行动空间的关联
        ActionSpaceRuleSet.query.filter_by(rule_set_id=rule_set_id).delete()

        # 然后删除规则集
        db.session.delete(rule_set)
        db.session.commit()

        return {'message': '规则集删除成功'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'规则集删除失败: {str(e)}')


# ══════════════════════════════════════════════════════════════════════════════
# 规则集关联管理 (原 associations.py)
# ══════════════════════════════════════════════════════════════════════════════

@router.get('/rule-sets/{rule_set_id}/rules')
def get_rule_set_rules(rule_set_id: str):
    """获取特定规则集的所有规则"""
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail='规则集未找到')

    # 获取规则集关联的规则
    rules = []
    for rsr in rule_set.rules_relation:
        rule = Rule.query.get(rsr.rule_id)
        if rule:
            rules.append({
                'id': rule.id,
                'name': rule.name,
                'description': rule.description,
                'content': rule.content,
                'category': rule.category,
                'is_active': rule.is_active,
                'priority': rsr.priority,
                'created_at': rule.created_at.isoformat() if rule.created_at else None,
                'updated_at': rule.updated_at.isoformat() if rule.updated_at else None
            })

    return {'rules': rules}


@router.post('/rule-sets/{rule_set_id}/rules')
async def add_rule_to_rule_set(rule_set_id: str, request: Request):
    """向规则集添加规则"""
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail='规则集未找到')

    data = await request.json()

    # 验证必填字段
    if 'rule_id' not in data:
        raise HTTPException(status_code=400, detail='缺少必填字段: rule_id')

    rule_id = data['rule_id']
    rule = Rule.query.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail='规则未找到')

    # 检查是否已经存在关联
    existing = RuleSetRule.query.filter_by(rule_set_id=rule_set_id, rule_id=rule_id).first()
    if existing:
        raise HTTPException(status_code=400, detail='规则已经添加到该规则集')

    try:
        rule_set_rule = RuleSetRule(
            rule_id=rule_id,
            rule_set_id=rule_set_id,
            priority=data.get('priority', 0)
        )

        db.session.add(rule_set_rule)
        db.session.commit()

        return {'message': '规则成功添加到规则集'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'添加规则失败: {str(e)}')


@router.delete('/rule-sets/{rule_set_id}/rules/{rule_id}')
def remove_rule_from_rule_set(rule_set_id: str, rule_id: str):
    """从规则集移除规则"""
    rule_set_rule = RuleSetRule.query.filter_by(rule_set_id=rule_set_id, rule_id=rule_id).first()
    if not rule_set_rule:
        raise HTTPException(status_code=404, detail='规则未添加到该规则集')

    try:
        db.session.delete(rule_set_rule)
        db.session.commit()

        return {'message': '规则已从规则集移除'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'移除规则失败: {str(e)}')


@router.put('/rule-sets/{rule_set_id}/rules/{rule_id}/priority')
async def update_rule_priority(rule_set_id: str, rule_id: str, request: Request):
    """更新规则在规则集中的优先级"""
    rule_set_rule = RuleSetRule.query.filter_by(rule_set_id=rule_set_id, rule_id=rule_id).first()
    if not rule_set_rule:
        raise HTTPException(status_code=404, detail='规则未添加到该规则集')

    data = await request.json()

    # 验证必填字段
    if 'priority' not in data:
        raise HTTPException(status_code=400, detail='缺少必填字段: priority')

    try:
        rule_set_rule.priority = data['priority']
        db.session.commit()

        return {'message': '规则优先级更新成功'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail=f'更新规则优先级失败: {str(e)}')


# ══════════════════════════════════════════════════════════════════════════════
# 规则验证和测试 (原 validation.py)
# ══════════════════════════════════════════════════════════════════════════════

@router.post('/rules/test')
async def test_rules(request: Request):
    """测试规则

    可以同时测试多条自然语言规则，但逻辑规则只能一次测试一条

    请求参数示例:
    {
        "rules": [
            {"id": 1, "name": "规则1", "type": "llm", "content": "自然语言规则内容"}
        ],
        "context": "我想要测试的场景是...",
        "role_id": 1,
        "variables": {
            "var1": "value1",
            "var2": "value2"
        }
    }

    返回结果示例:
    {
        "results": [
            {
                "rule_id": 1,
                "rule_name": "规则1",
                "rule_type": "llm",
                "passed": true,
                "message": "规则通过测试",
                "details": "测试细节..."
            }
        ],
        "timestamp": "2023-06-05T12:34:56.789Z"
    }
    """
    data = await request.json()

    # 验证请求数据
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=400, detail='无效的请求数据')

    rules = data.get('rules', [])
    context = data.get('context', '')
    role_id = data.get('role_id')
    variables = data.get('variables', {})

    if not rules or not isinstance(rules, list):
        raise HTTPException(status_code=400, detail='无效的规则列表')

    if not context:
        raise HTTPException(status_code=400, detail='缺少测试场景描述')

    # 检查是否同时包含了自然语言规则和逻辑规则
    has_llm_rules = any(rule.get('type') == 'llm' for rule in rules)
    has_logic_rules = any(rule.get('type') == 'logic' for rule in rules)

    if has_llm_rules and has_logic_rules:
        raise HTTPException(status_code=400, detail='不能同时测试自然语言规则和逻辑规则')

    # 检查逻辑规则数量
    if has_logic_rules and len([r for r in rules if r.get('type') == 'logic']) > 1:
        raise HTTPException(status_code=400, detail='一次只能测试一条逻辑规则')

    # 如果存在自然语言规则但没有提供角色ID，返回错误
    if has_llm_rules and not role_id:
        raise HTTPException(status_code=400, detail='测试自然语言规则时必须提供角色ID')

    results = []

    for rule_item in rules:
        rule_id_val = rule_item.get('id')
        rule_name = rule_item.get('name', f'规则{rule_id_val}')
        rule_type = rule_item.get('type', 'llm')
        rule_content = rule_item.get('content', '')

        # 查询数据库中的规则
        rule = None
        if rule_id_val:
            rule = Rule.query.get(rule_id_val)

        # 如果提供了变量，进行模板变量替换
        if variables and rule_content:
            import re

            logger.debug(f"变量替换前的规则内容: {rule_content}")
            logger.debug(f"可用变量: {variables}")

            for var_name, var_value in variables.items():
                pattern = r'\{\{\s*' + re.escape(var_name) + r'\s*\}\}'
                old_content = rule_content
                rule_content = re.sub(pattern, str(var_value), rule_content)
                if old_content != rule_content:
                    logger.debug(f"替换变量 {var_name}: {var_value}")

            logger.debug(f"变量替换后的规则内容: {rule_content}")

        if rule_type == 'llm':
            # 自然语言规则测试逻辑
            if role_id:
                from app.models import Role, Agent
                from app.services.conversation.model_client import ModelClient

                # 获取角色信息（兼容前端传入agent_id的情况）
                role = Role.query.get(role_id)
                if not role:
                    agent = Agent.query.get(role_id)
                    if agent and getattr(agent, 'role_id', None):
                        role = Role.query.get(agent.role_id)

                if not role:
                    raise HTTPException(
                        status_code=404,
                        detail=f'未找到ID为{role_id}的角色或无法通过Agent映射到角色'
                    )

                try:
                    from app.models import ModelConfig
                    model_config = None
                    if role.model:
                        model_config = ModelConfig.query.get(role.model)

                    if not model_config:
                        model_config = ModelConfig.query.filter_by(is_default_text=True).first()
                        if not model_config:
                            text_models = ModelConfig.query.filter(
                                ModelConfig.modalities.contains('text_output')
                            ).all()
                            if text_models:
                                model_config = text_models[0]
                            else:
                                model_config = ModelConfig.query.first()

                    if not model_config:
                        results.append({
                            'rule_id': rule_id_val,
                            'rule_name': rule_name,
                            'rule_type': 'llm',
                            'passed': False,
                            'message': '规则测试失败',
                            'details': '未找到可用的模型配置'
                        })
                        continue

                    model_client = ModelClient()

                    system_prompt = role.system_prompt if role and role.system_prompt else ""

                    if not system_prompt:
                        system_prompt = "你是一个规则评估专家，需要评估给定场景是否符合特定规则。"

                    test_prompt = f"""
规则内容: {rule_content if rule_content else (rule.content if rule else '无效规则')}

测试场景: {context}

请评估该场景是否通过了该规则的要求。先解释你的推理过程，然后明确给出结论。
结论必须以"通过"或"不通过"明确表示。
"""

                    model_params = {
                        'temperature': role.temperature if role and role.temperature is not None else 0.7,
                        'top_p': role.top_p if role and role.top_p is not None else 0.9,
                        'presence_penalty': role.presence_penalty if role and role.presence_penalty is not None else 0,
                        'frequency_penalty': role.frequency_penalty if role and role.frequency_penalty is not None else 0,
                        'max_tokens': model_config.max_output_tokens if model_config.max_output_tokens else 1000
                    }

                    logger.debug(f"=== LLM规则判断请求 DEBUG ===")
                    logger.debug(f"规则ID: {rule_id_val}")
                    logger.debug(f"规则名称: {rule_name}")
                    logger.debug(f"角色ID: {role_id}")
                    logger.debug(f"角色名称: {role.name if role else 'Unknown'}")
                    logger.debug(f"模型配置ID: {model_config.id if model_config else 'None'}")
                    logger.debug(f"模型ID: {model_config.model_id if model_config else 'None'}")
                    logger.debug(f"API URL: {model_config.base_url if model_config else 'None'}")
                    logger.debug(f"系统提示词长度: {len(system_prompt)} 字符")
                    logger.debug(f"测试提示词长度: {len(test_prompt)} 字符")
                    logger.debug(f"规则内容: {rule_content[:100]}{'...' if len(rule_content) > 100 else ''}")
                    context_str = str(context)
                    logger.debug(f"测试场景: {context_str[:200]}{'...' if len(context_str) > 200 else ''}")
                    logger.debug(f"=== LLM请求参数 ===")
                    logger.debug(f"Temperature: {model_params.get('temperature')}")
                    logger.debug(f"Max tokens: {model_params.get('max_tokens')}")
                    logger.debug(f"Top P: {model_params.get('top_p')}")
                    logger.debug(f"Frequency penalty: {model_params.get('frequency_penalty')}")
                    logger.debug(f"Presence penalty: {model_params.get('presence_penalty')}")
                    logger.debug(f"==========================")

                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": test_prompt}
                    ]

                    logger.debug(f"=== LLM请求消息 ===")
                    for i, msg in enumerate(messages):
                        logger.debug(f"消息 {i+1} ({msg['role']}): {msg['content'][:300]}{'...' if len(msg['content']) > 300 else ''}")
                    logger.debug(f"==================")

                    logger.info(f"开始调用LLM进行规则判断 - 规则: {rule_name}")
                    try:
                        response = model_client.send_request(
                            api_url=model_config.base_url,
                            api_key=model_config.api_key,
                            messages=messages,
                            model=model_config.model_id,
                            is_stream=False,
                            temperature=model_params.get('temperature'),
                            max_tokens=model_params.get('max_tokens'),
                            top_p=model_params.get('top_p'),
                            frequency_penalty=model_params.get('frequency_penalty'),
                            presence_penalty=model_params.get('presence_penalty')
                        )
                        logger.info(f"LLM调用完成 - 规则: {rule_name}")
                    except Exception as e:
                        logger.error(f"LLM调用失败 - 规则: {rule_name}, 错误: {str(e)}")
                        response = f"Error: {str(e)}"

                    # 解析响应
                    if isinstance(response, str):
                        response_text = response
                    else:
                        response_text = response.get('text', '') if response else ''

                    logger.debug(f"=== LLM响应 DEBUG ===")
                    logger.debug(f"响应类型: {type(response)}")
                    logger.debug(f"响应长度: {len(response_text)} 字符")
                    logger.debug(f"响应内容: {response_text[:500]}{'...' if len(response_text) > 500 else ''}")

                    passed = False
                    if '不通过' in response_text:
                        passed = False
                        logger.debug(f"判断结果: 不通过 (检测到'不通过'关键词)")
                    elif '通过' in response_text:
                        passed = True
                        logger.debug(f"判断结果: 通过 (检测到'通过'关键词)")
                    else:
                        logger.debug(f"判断结果: 不通过 (未检测到明确关键词)")

                    details = response_text
                    if len(details) > 500:
                        details = details[:500] + '...'

                    logger.debug(f"最终判断: {'通过' if passed else '不通过'}")
                    logger.debug(f"====================")

                    results.append({
                        'rule_id': rule_id_val,
                        'rule_name': rule_name,
                        'rule_type': 'llm',
                        'passed': passed,
                        'message': '规则' + ('通过' if passed else '不通过'),
                        'details': details
                    })
                except HTTPException:
                    raise
                except Exception as e:
                    import traceback
                    error_details = traceback.format_exc()

                    logger.error(f"=== LLM规则测试错误 DEBUG ===")
                    logger.error(f"规则ID: {rule_id_val}")
                    logger.error(f"规则名称: {rule_name}")
                    logger.error(f"角色ID: {role_id}")
                    logger.error(f"错误类型: {type(e).__name__}")
                    logger.error(f"错误消息: {str(e)}")
                    logger.error(f"完整错误堆栈: {error_details}")
                    logger.error(f"模型配置: {model_config.model_id if model_config else 'None'}")
                    logger.error(f"API URL: {model_config.base_url if model_config else 'None'}")
                    logger.error(f"==============================")

                    results.append({
                        'rule_id': rule_id_val,
                        'rule_name': rule_name,
                        'rule_type': 'llm',
                        'passed': False,
                        'message': '规则测试出错',
                        'details': f'错误原因: {str(e)}'
                    })
            else:
                logger.error(f"自然语言规则测试失败 - 规则ID: {rule_id_val}, 规则名称: {rule_name}")
                logger.error(f"错误原因: 自然语言规则必须提供角色ID")

                results.append({
                    'rule_id': rule_id_val,
                    'rule_name': rule_name,
                    'rule_type': 'llm',
                    'passed': False,
                    'message': '规则测试失败',
                    'details': '自然语言规则必须提供角色ID进行测试'
                })
        else:  # logic类型规则
            try:
                rule_content = rule_content if rule_content else (rule.content if rule else '')

                logger.debug(f"规则内容 - 来自请求: {len(rule_content) if rule_content else 0} 字符")
                if rule:
                    logger.debug(f"规则内容 - 来自数据库: {len(rule.content) if rule.content else 0} 字符")

                interpreter = rule_item.get('interpreter', 'javascript')

                logger.info(f"规则测试 - 规则ID: {rule_id_val}, 解释器: {interpreter}, 规则类型: {rule_type}")
                logger.debug(f"规则项数据: {rule_item}")
                if rule:
                    logger.debug(f"数据库规则设置: {rule.settings}")
                logger.info(f"最终使用的解释器（来自界面）: {interpreter}")

                logger.debug(f"=== 逻辑规则测试 DEBUG ===")
                logger.debug(f"规则ID: {rule_id_val}")
                logger.debug(f"规则名称: {rule_name}")
                logger.debug(f"解释器: {interpreter}")
                logger.debug(f"规则内容: {rule_content}")
                context_str = str(context)
                logger.debug(f"测试场景: {context_str[:200]}{'...' if len(context_str) > 200 else ''}")

                context_as_variables = {
                    "scenario": context
                }

                logger.debug(f"上下文变量: {context_as_variables}")
                logger.debug(f"========================")

                from app.services.rule_sandbox import test_rule_safely

                logger.info(f"开始执行逻辑规则 - 规则: {rule_name}")
                sandbox_result = test_rule_safely(interpreter, rule_content, context_as_variables)
                logger.info(f"逻辑规则执行完成 - 规则: {rule_name}")

                logger.debug(f"=== 沙盒执行结果 DEBUG ===")
                logger.debug(f"执行结果: {sandbox_result}")
                logger.debug(f"是否通过: {sandbox_result.get('passed', False)}")
                logger.debug(f"详细信息: {sandbox_result.get('details', '无详情')}")
                logger.debug(f"==========================")

                results.append({
                    'rule_id': rule_id_val,
                    'rule_name': rule_name,
                    'rule_type': 'logic',
                    'passed': sandbox_result.get('passed', False),
                    'message': '规则' + ('通过' if sandbox_result.get('passed', False) else '不通过'),
                    'details': sandbox_result.get('details', '执行完成')
                })

            except Exception as e:
                import traceback
                error_details = traceback.format_exc()

                results.append({
                    'rule_id': rule_id_val,
                    'rule_name': rule_name,
                    'rule_type': 'logic',
                    'passed': False,
                    'message': '规则测试出错',
                    'details': f"沙盒执行错误: {str(e)}\n{error_details}"
                })

    # 返回测试结果
    response = {
        'results': results,
        'timestamp': datetime.datetime.now().isoformat()
    }

    return response


# ══════════════════════════════════════════════════════════════════════════════
# 统计信息 (原 stats.py)
# ══════════════════════════════════════════════════════════════════════════════
