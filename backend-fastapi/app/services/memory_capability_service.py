"""
Memory能力管理服务

负责根据图谱增强开关状态动态管理所有角色的memory能力
"""

from typing import Tuple, List
import logging
from app.models import Role, Capability, RoleCapability, GraphEnhancement
from app.extensions import db

logger = logging.getLogger(__name__)


class MemoryCapabilityService:
    """Memory能力管理服务类"""
    
    def __init__(self):
        self.memory_capability_name = "memory"
    
    def get_memory_capability(self) -> Capability:
        """获取memory能力对象"""
        capability = Capability.query.filter_by(name=self.memory_capability_name).first()
        if not capability:
            raise Exception(f"未找到名为 '{self.memory_capability_name}' 的能力，请检查种子数据是否正确加载")
        return capability
    
    def is_graph_enhancement_enabled(self) -> bool:
        """检查图谱增强是否启用"""
        try:
            config = GraphEnhancement.query.filter_by(framework='graphiti').first()
            return config and config.enabled
        except Exception as e:
            logger.error(f"检查图谱增强状态失败: {e}")
            return False
    
    def get_all_roles(self) -> List[Role]:
        """获取所有角色"""
        return Role.query.all()
    
    def role_has_memory_capability(self, role_id: int) -> bool:
        """检查角色是否已具有memory能力"""
        try:
            memory_capability = self.get_memory_capability()
            relation = RoleCapability.query.filter_by(
                role_id=role_id,
                capability_id=memory_capability.id
            ).first()
            return relation is not None
        except Exception as e:
            logger.error(f"检查角色memory能力失败: {e}")
            return False
    
    def add_memory_capability_to_role(self, role_id: int) -> Tuple[bool, str]:
        """为角色添加memory能力"""
        try:
            # 检查角色是否存在
            role = Role.query.get(role_id)
            if not role:
                return False, f"角色 ID {role_id} 不存在"
            
            # 检查是否已有memory能力
            if self.role_has_memory_capability(role_id):
                return True, f"角色 '{role.name}' 已具有memory能力"
            
            # 获取memory能力
            memory_capability = self.get_memory_capability()
            
            # 创建关联
            role_capability = RoleCapability(
                role_id=role_id,
                capability_id=memory_capability.id
            )
            db.session.add(role_capability)
            db.session.commit()
            
            logger.info(f"为角色 '{role.name}' 添加memory能力成功")
            return True, f"为角色 '{role.name}' 添加memory能力成功"
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"为角色添加memory能力失败: {e}")
            return False, f"为角色添加memory能力失败: {str(e)}"
    
    def remove_memory_capability_from_role(self, role_id: int) -> Tuple[bool, str]:
        """从角色移除memory能力"""
        try:
            # 检查角色是否存在
            role = Role.query.get(role_id)
            if not role:
                return False, f"角色 ID {role_id} 不存在"
            
            # 获取memory能力
            memory_capability = self.get_memory_capability()
            
            # 查找并删除关联
            relation = RoleCapability.query.filter_by(
                role_id=role_id,
                capability_id=memory_capability.id
            ).first()
            
            if relation:
                db.session.delete(relation)
                db.session.commit()
                logger.info(f"从角色 '{role.name}' 移除memory能力成功")
                return True, f"从角色 '{role.name}' 移除memory能力成功"
            else:
                return True, f"角色 '{role.name}' 本来就没有memory能力"
                
        except Exception as e:
            db.session.rollback()
            logger.error(f"从角色移除memory能力失败: {e}")
            return False, f"从角色移除memory能力失败: {str(e)}"
    
    def add_memory_capability_to_all_roles(self) -> Tuple[bool, str]:
        """为所有角色添加memory能力"""
        try:
            roles = self.get_all_roles()
            success_count = 0
            error_messages = []
            
            for role in roles:
                success, message = self.add_memory_capability_to_role(role.id)
                if success:
                    success_count += 1
                else:
                    error_messages.append(f"角色 '{role.name}': {message}")
            
            if error_messages:
                error_summary = "; ".join(error_messages)
                return False, f"部分角色添加memory能力失败: {error_summary}"
            else:
                return True, f"成功为 {success_count} 个角色添加memory能力"
                
        except Exception as e:
            logger.error(f"为所有角色添加memory能力失败: {e}")
            return False, f"为所有角色添加memory能力失败: {str(e)}"
    
    def remove_memory_capability_from_all_roles(self) -> Tuple[bool, str]:
        """从所有角色移除memory能力"""
        try:
            roles = self.get_all_roles()
            success_count = 0
            error_messages = []
            
            for role in roles:
                success, message = self.remove_memory_capability_from_role(role.id)
                if success:
                    success_count += 1
                else:
                    error_messages.append(f"角色 '{role.name}': {message}")
            
            if error_messages:
                error_summary = "; ".join(error_messages)
                return False, f"部分角色移除memory能力失败: {error_summary}"
            else:
                return True, f"成功从 {success_count} 个角色移除memory能力"
                
        except Exception as e:
            logger.error(f"从所有角色移除memory能力失败: {e}")
            return False, f"从所有角色移除memory能力失败: {str(e)}"
    
    def sync_memory_capability_with_graph_enhancement(self) -> Tuple[bool, str]:
        """根据图谱增强开关状态同步所有角色的memory能力"""
        try:
            is_enabled = self.is_graph_enhancement_enabled()
            
            if is_enabled:
                # 图谱增强启用，为所有角色添加memory能力
                success, message = self.add_memory_capability_to_all_roles()
                if success:
                    logger.info("图谱增强已启用，已为所有角色添加memory能力")
                    return True, f"图谱增强已启用，{message}"
                else:
                    return False, f"图谱增强已启用，但添加memory能力失败: {message}"
            else:
                # 图谱增强关闭，从所有角色移除memory能力
                success, message = self.remove_memory_capability_from_all_roles()
                if success:
                    logger.info("图谱增强已关闭，已从所有角色移除memory能力")
                    return True, f"图谱增强已关闭，{message}"
                else:
                    return False, f"图谱增强已关闭，但移除memory能力失败: {message}"
                    
        except Exception as e:
            logger.error(f"同步memory能力状态失败: {e}")
            return False, f"同步memory能力状态失败: {str(e)}"
    
    def get_memory_capability_status(self) -> dict:
        """获取memory能力状态统计"""
        try:
            roles = self.get_all_roles()
            total_roles = len(roles)
            roles_with_memory = 0
            
            for role in roles:
                if self.role_has_memory_capability(role.id):
                    roles_with_memory += 1
            
            is_graph_enabled = self.is_graph_enhancement_enabled()
            
            return {
                'graph_enhancement_enabled': is_graph_enabled,
                'total_roles': total_roles,
                'roles_with_memory': roles_with_memory,
                'roles_without_memory': total_roles - roles_with_memory,
                'sync_status': 'synced' if (is_graph_enabled and roles_with_memory == total_roles) or (not is_graph_enabled and roles_with_memory == 0) else 'out_of_sync'
            }
            
        except Exception as e:
            logger.error(f"获取memory能力状态失败: {e}")
            return {
                'error': str(e),
                'graph_enhancement_enabled': False,
                'total_roles': 0,
                'roles_with_memory': 0,
                'roles_without_memory': 0,
                'sync_status': 'error'
            }


# 创建全局服务实例
memory_capability_service = MemoryCapabilityService()
