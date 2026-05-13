import logging
from typing import List, Dict, Any, Optional

from app.models import db, ActionSpace, RuleSet, Tag, ActionSpaceTag
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

logger = logging.getLogger(__name__)

class ActionSpaceService:
    """行动空间服务类"""

    @staticmethod
    def get_all_action_spaces() -> List[Dict[str, Any]]:
        """获取所有行动空间"""
        try:
            spaces = ActionSpace.query.all()
            result = []

            for space in spaces:
                # 获取行动空间关联的规则集数量
                rule_sets_count = RuleSet.query.filter_by(action_space_id=space.id).count()

                # 获取行动空间的标签
                space_tags = []
                for ast in ActionSpaceTag.query.filter_by(action_space_id=space.id).all():
                    tag = Tag.query.get(ast.tag_id)
                    if tag:
                        space_tags.append({
                            'id': tag.id,
                            'name': tag.name,
                            'type': tag.type,
                            'color': tag.color,
                            'description': tag.description
                        })

                result.append({
                    'id': space.id,
                    'name': space.name,
                    'description': space.description,
                    'settings': space.settings,
                    'rule_sets_count': rule_sets_count,
                    'tags': space_tags,
                    'created_at': space.created_at.isoformat() if space.created_at else None,
                    'updated_at': space.updated_at.isoformat() if space.updated_at else None
                })

            return result
        except Exception as e:
            logger.error(f"获取行动空间列表失败: {str(e)}")
            return []

    @staticmethod
    def get_action_space_by_id(space_id: int) -> Optional[Dict[str, Any]]:
        """获取特定行动空间详情"""
        try:
            space = ActionSpace.query.get(space_id)
            if not space:
                return None

            # 获取关联的规则集
            rule_sets = RuleSet.query.filter_by(action_space_id=space_id).all()
            rule_sets_data = []

            for rule_set in rule_sets:
                rule_sets_data.append({
                    'id': rule_set.id,
                    'name': rule_set.name,
                    'description': rule_set.description
                })

            # 获取行动空间的标签
            space_tags = []
            for ast in ActionSpaceTag.query.filter_by(action_space_id=space_id).all():
                tag = Tag.query.get(ast.tag_id)
                if tag:
                    space_tags.append({
                        'id': tag.id,
                        'name': tag.name,
                        'type': tag.type,
                        'color': tag.color,
                        'description': tag.description
                    })

            result = {
                'id': space.id,
                'name': space.name,
                'description': space.description,
                'settings': space.settings,
                'rule_sets': rule_sets_data,
                'tags': space_tags,
                'created_at': space.created_at.isoformat() if space.created_at else None,
                'updated_at': space.updated_at.isoformat() if space.updated_at else None
            }

            return result
        except Exception as e:
            logger.error(f"获取行动空间{space_id}详情失败: {str(e)}")
            return None

    @staticmethod
    def create_action_space(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """创建新行动空间"""
        if not data.get('name'):
            logger.error("创建行动空间失败: 缺少必填字段名称")
            return None

        try:
            # 创建行动空间
            space = ActionSpace(
                name=data.get('name'),
                description=data.get('description', ''),
                settings=data.get('settings', {})
            )

            db.session.add(space)
            db.session.flush()  # 获取ID但不提交

            # 处理标签关联
            tag_ids = data.get('tag_ids', [])
            for tag_id in tag_ids:
                tag = Tag.query.get(tag_id)
                if tag:
                    action_space_tag = ActionSpaceTag(
                        action_space_id=space.id,
                        tag_id=tag_id
                    )
                    db.session.add(action_space_tag)

            db.session.commit()

            return {
                'id': space.id,
                'name': space.name,
                'message': '行动空间创建成功'
            }

        except IntegrityError:
            db.session.rollback()
            logger.error("创建行动空间失败: 可能存在名称冲突")
            return None
        except Exception as e:
            db.session.rollback()
            logger.error(f"创建行动空间失败: {str(e)}")
            return None

    @staticmethod
    def update_action_space(space_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新行动空间信息"""
        try:
            space = ActionSpace.query.get(space_id)
            if not space:
                logger.error(f"更新行动空间失败: ID为{space_id}的行动空间未找到")
                return None

            # 更新基本信息
            if 'name' in data:
                space.name = data['name']
            if 'description' in data:
                space.description = data['description']
            if 'settings' in data:
                space.settings = data['settings']

            # 处理标签更新
            if 'tag_ids' in data:
                # 删除现有标签关联
                ActionSpaceTag.query.filter_by(action_space_id=space_id).delete()

                # 添加新的标签关联
                for tag_id in data['tag_ids']:
                    tag = Tag.query.get(tag_id)
                    if tag:
                        action_space_tag = ActionSpaceTag(
                            action_space_id=space_id,
                            tag_id=tag_id
                        )
                        db.session.add(action_space_tag)

            db.session.commit()

            return {
                'id': space.id,
                'name': space.name,
                'message': '行动空间更新成功'
            }

        except Exception as e:
            db.session.rollback()
            logger.error(f"更新行动空间失败: {str(e)}")
            return None

    @staticmethod
    def delete_action_space(space_id: int) -> bool:
        """删除行动空间"""
        try:
            space = ActionSpace.query.get(space_id)
            if not space:
                logger.error(f"删除行动空间失败: ID为{space_id}的行动空间未找到")
                return False

            # 检查是否有关联的行动任务
            from app.models import ActionTask
            action_tasks = ActionTask.query.filter_by(action_space_id=space_id).all()
            if action_tasks:
                logger.error(f"删除行动空间失败: 存在关联的行动任务")
                return False

            # 删除行动空间的关联关系（不删除实体本身）

            # 删除行动空间与标签的关联
            ActionSpaceTag.query.filter_by(action_space_id=space_id).delete()

            # 删除行动空间与规则集的关联（不删除规则集本身）
            from app.models import ActionSpaceRuleSet
            ActionSpaceRuleSet.query.filter_by(action_space_id=space_id).delete()

            # 删除行动空间与角色的关联（不删除角色本身）
            from app.models import ActionSpaceRole
            ActionSpaceRole.query.filter_by(action_space_id=space_id).delete()

            # 删除行动空间与监督者的关联
            from app.models import ActionSpaceObserver
            ActionSpaceObserver.query.filter_by(action_space_id=space_id).delete()

            # 删除行动空间专属的数据

            # 删除行动空间的环境变量（这些是行动空间专属的）
            from app.models import ActionSpaceEnvironmentVariable
            ActionSpaceEnvironmentVariable.query.filter_by(action_space_id=space_id).delete()

            # 删除角色在该行动空间中的变量配置（这些是行动空间专属的）
            from app.models import RoleVariable
            RoleVariable.query.filter_by(action_space_id=space_id).delete()

            # 删除行动空间本身
            db.session.delete(space)
            db.session.commit()

            return True

        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"删除行动空间失败: {str(e)}")
            return False

    @staticmethod
    def get_action_space_rule_sets(space_id: int) -> List[Dict[str, Any]]:
        """获取行动空间的规则集列表"""
        try:
            # 通过关联表查询行动空间的规则集
            from app.models import ActionSpaceRuleSet, RuleSet
            rule_set_relations = ActionSpaceRuleSet.query.filter_by(action_space_id=space_id).all()
            result = []

            for relation in rule_set_relations:
                rule_set = relation.rule_set
                if rule_set:
                    result.append({
                        'id': rule_set.id,
                        'name': rule_set.name,
                        'description': rule_set.description,
                        'rules': rule_set.rules,
                        'created_at': rule_set.created_at.isoformat() if rule_set.created_at else None,
                        'updated_at': rule_set.updated_at.isoformat() if rule_set.updated_at else None
                    })

            return result
        except Exception as e:
            logger.error(f"获取行动空间规则集失败: {str(e)}")
            return []

    @staticmethod
    def create_from_template(template_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """从模板创建行动空间"""
        try:
            # 获取模板行动空间
            template = ActionSpace.query.get(template_id)
            if not template:
                logger.error(f"从模板创建行动空间失败: ID为{template_id}的模板行动空间未找到")
                return None

            # 创建新行动空间
            new_space = ActionSpace(
                name=data.get('name', f"{template.name} 副本"),
                description=data.get('description', template.description),
                settings=data.get('settings', template.settings.copy() if template.settings else {})
            )

            db.session.add(new_space)
            db.session.flush()  # 获取新ID但不提交

            # 复制模板的规则集关联
            from app.models import ActionSpaceRuleSet
            template_rule_set_relations = ActionSpaceRuleSet.query.filter_by(action_space_id=template_id).all()
            for relation in template_rule_set_relations:
                # 创建新的关联关系，指向相同的规则集
                new_relation = ActionSpaceRuleSet(
                    action_space_id=new_space.id,
                    rule_set_id=relation.rule_set_id,
                    settings=relation.settings.copy() if relation.settings else {}
                )
                db.session.add(new_relation)

            # 复制模板的标签关联
            template_tags = ActionSpaceTag.query.filter_by(action_space_id=template_id).all()
            for tt in template_tags:
                new_tag = ActionSpaceTag(
                    action_space_id=new_space.id,
                    tag_id=tt.tag_id
                )
                db.session.add(new_tag)

            db.session.commit()

            return {
                'id': new_space.id,
                'name': new_space.name,
                'message': '从模板创建行动空间成功'
            }

        except Exception as e:
            db.session.rollback()
            logger.error(f"从模板创建行动空间失败: {str(e)}")
            return None