"""
知识库能力管理服务
负责根据知识库绑定状态动态管理角色的knowledge_access能力
"""

import logging
from typing import Tuple
from app.models import Role, Capability, RoleCapability, RoleKnowledge, RoleExternalKnowledge

logger = logging.getLogger(__name__)
from app.extensions import db


class KnowledgeCapabilityService:
    """Knowledge能力管理服务类"""
    
    CAPABILITY_NAME = "knowledge_access"
    
    def get_knowledge_access_capability(self) -> Capability:
        """获取knowledge_access能力对象"""
        capability = Capability.query.filter_by(name=self.CAPABILITY_NAME).first()
        if not capability:
            raise ValueError(f"未找到 {self.CAPABILITY_NAME} 能力，请检查数据库初始化")
        return capability
    
    def role_has_knowledge_access_capability(self, role_id: str) -> bool:
        """检查角色是否已具有knowledge_access能力"""
        try:
            capability = self.get_knowledge_access_capability()
            relation = RoleCapability.query.filter_by(
                role_id=role_id,
                capability_id=capability.id
            ).first()
            return relation is not None
        except Exception as e:
            logger.error(f"检查角色knowledge_access能力失败: {e}")
            return False
    
    def role_has_any_knowledge_binding(self, role_id: str) -> bool:
        """检查角色是否有任何知识库绑定（内部或外部）"""
        try:
            # 检查内部知识库绑定
            internal_count = RoleKnowledge.query.filter_by(role_id=role_id).count()
            if internal_count > 0:
                return True
            
            # 检查外部知识库绑定
            external_count = RoleExternalKnowledge.query.filter_by(role_id=role_id).count()
            if external_count > 0:
                return True
            
            return False
        except Exception as e:
            logger.error(f"检查角色知识库绑定失败: {e}")
            return False
    
    def add_knowledge_access_capability(self, role_id: str) -> Tuple[bool, str]:
        """为角色添加knowledge_access能力"""
        try:
            # 检查角色是否存在
            role = Role.query.get(role_id)
            if not role:
                return False, f"角色不存在: {role_id}"
            
            # 检查是否已经有该能力
            if self.role_has_knowledge_access_capability(role_id):
                logger.info(f"角色 '{role.name}' 已具有knowledge_access能力，跳过添加")
                return True, f"角色 '{role.name}' 已具有knowledge_access能力"
            
            # 获取knowledge_access能力
            capability = self.get_knowledge_access_capability()
            
            # 创建关联
            role_capability = RoleCapability(
                role_id=role_id,
                capability_id=capability.id
            )
            db.session.add(role_capability)
            db.session.commit()
            
            logger.info(f"为角色 '{role.name}' 添加knowledge_access能力成功")
            return True, f"为角色 '{role.name}' 添加knowledge_access能力成功"
        
        except Exception as e:
            db.session.rollback()
            error_msg = f"添加knowledge_access能力失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def remove_knowledge_access_capability(self, role_id: str) -> Tuple[bool, str]:
        """从角色移除knowledge_access能力"""
        try:
            # 检查角色是否存在
            role = Role.query.get(role_id)
            if not role:
                return False, f"角色不存在: {role_id}"
            
            # 获取knowledge_access能力
            capability = self.get_knowledge_access_capability()
            
            # 查找并删除关联
            relation = RoleCapability.query.filter_by(
                role_id=role_id,
                capability_id=capability.id
            ).first()
            
            if relation:
                db.session.delete(relation)
                db.session.commit()
                logger.info(f"从角色 '{role.name}' 移除knowledge_access能力成功")
                return True, f"从角色 '{role.name}' 移除knowledge_access能力成功"
            else:
                logger.info(f"角色 '{role.name}' 没有knowledge_access能力，无需移除")
                return True, f"角色 '{role.name}' 没有knowledge_access能力"
        
        except Exception as e:
            db.session.rollback()
            error_msg = f"移除knowledge_access能力失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def sync_knowledge_access_capability(self, role_id: str) -> Tuple[bool, str]:
        """
        同步角色的knowledge_access能力
        根据角色是否有知识库绑定来决定是否应该有该能力
        """
        try:
            role = Role.query.get(role_id)
            if not role:
                return False, f"角色不存在: {role_id}"
            
            has_binding = self.role_has_any_knowledge_binding(role_id)
            has_capability = self.role_has_knowledge_access_capability(role_id)
            
            if has_binding and not has_capability:
                # 有绑定但没有能力，添加能力
                return self.add_knowledge_access_capability(role_id)
            elif not has_binding and has_capability:
                # 没有绑定但有能力，移除能力
                return self.remove_knowledge_access_capability(role_id)
            else:
                # 状态一致，无需操作
                status = "有" if has_binding else "无"
                return True, f"角色 '{role.name}' {status}知识库绑定，能力状态正确"
        
        except Exception as e:
            error_msg = f"同步knowledge_access能力失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def sync_all_roles_knowledge_access_capability(self) -> Tuple[bool, str, dict]:
        """
        同步所有角色的knowledge_access能力
        返回: (成功标志, 消息, 详细结果字典)
        """
        try:
            roles = Role.query.all()
            results = {
                'total': len(roles),
                'added': 0,
                'removed': 0,
                'unchanged': 0,
                'failed': 0,
                'details': []
            }
            
            for role in roles:
                success, message = self.sync_knowledge_access_capability(role.id)
                
                result_detail = {
                    'role_id': role.id,
                    'role_name': role.name,
                    'success': success,
                    'message': message
                }
                
                if success:
                    if '添加' in message:
                        results['added'] += 1
                    elif '移除' in message:
                        results['removed'] += 1
                    else:
                        results['unchanged'] += 1
                else:
                    results['failed'] += 1
                
                results['details'].append(result_detail)
            
            summary = f"同步完成: 总计{results['total']}个角色, " \
                     f"添加{results['added']}个, 移除{results['removed']}个, " \
                     f"未变更{results['unchanged']}个, 失败{results['failed']}个"
            
            logger.info(summary)
            return True, summary, results
        
        except Exception as e:
            error_msg = f"批量同步knowledge_access能力失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg, {}


# 创建全局服务实例
knowledge_capability_service = KnowledgeCapabilityService()

