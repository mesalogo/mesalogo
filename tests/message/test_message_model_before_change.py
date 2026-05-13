#!/usr/bin/env python3
"""
测试脚本：验证Message模型修改前的状态
确保当前的role字段只支持预期的值
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation
from app.extensions import db
from sqlalchemy import text

def test_current_message_model():
    """测试当前Message模型的role字段约束"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试Message模型修改前的状态 ===")
        
        # 1. 检查当前role字段的约束
        print("\n1. 检查当前role字段约束...")
        try:
            # 查询数据库schema获取role字段的枚举值
            result = db.session.execute(text("""
                SELECT COLUMN_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'messages' 
                AND COLUMN_NAME = 'role'
            """))
            
            column_type = result.fetchone()
            if column_type:
                print(f"✅ 当前role字段类型: {column_type[0]}")
            else:
                print("❌ 无法获取role字段信息")
                
        except Exception as e:
            print(f"❌ 查询role字段约束失败: {e}")
        
        # 2. 测试创建不同role的消息
        print("\n2. 测试创建不同role的消息...")
        
        # 创建测试数据
        action_space = ActionSpace(name="测试空间", description="用于测试的行动空间")
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="测试任务",
            description="用于测试的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="测试会话",
            description="用于测试的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        role = Role(name="测试角色", description="用于测试的角色")
        db.session.add(role)
        db.session.flush()
        
        agent = Agent(
            name="测试智能体",
            description="用于测试的智能体",
            role_id=role.id,
            action_task_id=action_task.id
        )
        db.session.add(agent)
        db.session.flush()
        
        # 测试有效的role值
        valid_roles = ['human', 'agent', 'system', 'tool']
        for role_value in valid_roles:
            try:
                message = Message(
                    content=f"测试{role_value}消息",
                    role=role_value,
                    action_task_id=action_task.id,
                    conversation_id=conversation.id,
                    agent_id=agent.id if role_value == 'agent' else None
                )
                db.session.add(message)
                db.session.flush()
                print(f"✅ 成功创建role='{role_value}'的消息")
                
            except Exception as e:
                print(f"❌ 创建role='{role_value}'的消息失败: {e}")
        
        # 测试无效的role值（应该失败）
        print("\n3. 测试无效的role值...")
        try:
            invalid_message = Message(
                content="测试supervisor消息",
                role='supervisor',  # 这应该失败，因为当前不支持
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                agent_id=agent.id
            )
            db.session.add(invalid_message)
            db.session.flush()
            print("❌ 意外成功：supervisor role应该被拒绝")
            
        except Exception as e:
            print(f"✅ 预期失败：supervisor role被正确拒绝: {e}")
        
        # 4. 统计当前消息数量
        print("\n4. 统计当前消息...")
        message_count = Message.query.count()
        print(f"✅ 当前消息总数: {message_count}")
        
        # 按role统计
        for role_value in valid_roles:
            count = Message.query.filter_by(role=role_value).count()
            print(f"   - role='{role_value}': {count}条")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")

def test_agent_observer_field():
    """测试Agent模型的is_observer字段"""
    app = create_app()
    
    with app.app_context():
        print("\n=== 测试Agent模型的is_observer字段 ===")
        
        try:
            # 检查is_observer字段是否存在
            result = db.session.execute(text("""
                SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'agents' 
                AND COLUMN_NAME = 'is_observer'
            """))
            
            column_info = result.fetchone()
            if column_info:
                print(f"✅ is_observer字段存在: {column_info}")
            else:
                print("❌ is_observer字段不存在")
                
            # 测试创建监督者智能体
            action_space = ActionSpace(name="测试空间", description="用于测试的行动空间")
            db.session.add(action_space)
            db.session.flush()
            
            action_task = ActionTask(
                title="测试任务",
                description="用于测试的行动任务",
                action_space_id=action_space.id
            )
            db.session.add(action_task)
            db.session.flush()
            
            role = Role(name="监督者角色", description="用于测试的监督者角色", is_observer_role=True)
            db.session.add(role)
            db.session.flush()
            
            # 创建普通智能体
            normal_agent = Agent(
                name="普通智能体",
                description="普通智能体",
                role_id=role.id,
                action_task_id=action_task.id,
                is_observer=False
            )
            db.session.add(normal_agent)
            db.session.flush()
            print("✅ 成功创建普通智能体")
            
            # 创建监督者智能体
            supervisor_agent = Agent(
                name="监督者智能体",
                description="监督者智能体",
                role_id=role.id,
                action_task_id=action_task.id,
                is_observer=True
            )
            db.session.add(supervisor_agent)
            db.session.flush()
            print("✅ 成功创建监督者智能体")
            
            # 验证查询
            supervisors = Agent.query.filter_by(is_observer=True).all()
            print(f"✅ 查询到{len(supervisors)}个监督者智能体")
            
            normal_agents = Agent.query.filter_by(is_observer=False).all()
            print(f"✅ 查询到{len(normal_agents)}个普通智能体")
            
            # 回滚测试数据
            db.session.rollback()
            print("✅ 测试完成，已回滚测试数据")
            
        except Exception as e:
            print(f"❌ 测试Agent.is_observer字段失败: {e}")
            db.session.rollback()

if __name__ == "__main__":
    print("开始测试Message模型修改前的状态...")
    test_current_message_model()
    test_agent_observer_field()
    print("\n所有测试完成！")
