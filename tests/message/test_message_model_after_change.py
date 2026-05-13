#!/usr/bin/env python3
"""
测试脚本：验证Message模型修改后的状态
确保supervisor角色正常工作
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation
from app.extensions import db

def test_supervisor_message_creation():
    """测试创建supervisor角色的消息"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试Message模型修改后的状态 ===")
        
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
        
        # 创建监督者角色
        supervisor_role = Role(
            name="测试监督者角色", 
            description="用于测试的监督者角色",
            is_observer_role=True
        )
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建监督者智能体
        supervisor_agent = Agent(
            name="测试监督者智能体",
            description="用于测试的监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        db.session.add(supervisor_agent)
        db.session.flush()
        
        print(f"✅ 创建测试数据成功")
        print(f"   - 行动空间ID: {action_space.id}")
        print(f"   - 行动任务ID: {action_task.id}")
        print(f"   - 会话ID: {conversation.id}")
        print(f"   - 监督者角色ID: {supervisor_role.id}")
        print(f"   - 监督者智能体ID: {supervisor_agent.id}")
        
        # 测试创建所有支持的role类型的消息
        print("\n1. 测试创建不同role的消息...")
        
        test_roles = [
            ('human', None, '用户消息'),
            ('agent', supervisor_agent.id, '普通智能体消息'),
            ('system', None, '系统消息'),
            ('tool', None, '工具调用结果消息'),
            ('supervisor', supervisor_agent.id, '监督者消息')  # 新增的supervisor角色
        ]
        
        created_messages = []
        for role_value, agent_id, description in test_roles:
            try:
                message = Message(
                    content=f"这是一条{description}：{role_value}",
                    role=role_value,
                    action_task_id=action_task.id,
                    conversation_id=conversation.id,
                    agent_id=agent_id
                )
                db.session.add(message)
                db.session.flush()
                created_messages.append(message)
                print(f"✅ 成功创建role='{role_value}'的消息，ID: {message.id}")
                
            except Exception as e:
                print(f"❌ 创建role='{role_value}'的消息失败: {e}")
        
        # 验证消息查询
        print("\n2. 验证消息查询...")
        
        # 查询所有消息
        all_messages = Message.query.filter_by(conversation_id=conversation.id).all()
        print(f"✅ 查询到{len(all_messages)}条消息")
        
        # 按role统计
        for role_value, _, description in test_roles:
            count = Message.query.filter_by(
                conversation_id=conversation.id,
                role=role_value
            ).count()
            print(f"   - role='{role_value}' ({description}): {count}条")
        
        # 特别验证supervisor消息
        print("\n3. 验证监督者消息...")
        supervisor_messages = Message.query.filter_by(
            conversation_id=conversation.id,
            role='supervisor'
        ).all()
        
        if supervisor_messages:
            for msg in supervisor_messages:
                print(f"✅ 监督者消息ID: {msg.id}")
                print(f"   - 内容: {msg.content}")
                print(f"   - 智能体ID: {msg.agent_id}")
                print(f"   - 创建时间: {msg.created_at}")
        else:
            print("❌ 没有找到监督者消息")
        
        # 验证监督者智能体查询
        print("\n4. 验证监督者智能体查询...")
        supervisors = Agent.query.filter_by(is_observer=True).all()
        print(f"✅ 查询到{len(supervisors)}个监督者智能体")
        
        for supervisor in supervisors:
            print(f"   - 监督者: {supervisor.name} (ID: {supervisor.id})")
            print(f"     角色: {supervisor.role.name if supervisor.role else 'None'}")
            print(f"     is_observer: {supervisor.is_observer}")
            
            # 查询该监督者的消息
            supervisor_msgs = Message.query.filter_by(
                agent_id=supervisor.id,
                role='supervisor'
            ).all()
            print(f"     消息数量: {len(supervisor_msgs)}")
        
        # 验证消息筛选逻辑（模拟前端筛选）
        print("\n5. 验证消息筛选逻辑...")
        
        def filter_supervisor_messages(messages, supervisor_agent_ids):
            """模拟前端的监督者消息筛选逻辑"""
            return [msg for msg in messages if 
                    msg.role == 'supervisor' or 
                    (msg.role == 'human' and msg.agent_id in supervisor_agent_ids)]
        
        def filter_task_messages(messages, supervisor_agent_ids):
            """模拟前端的任务消息筛选逻辑"""
            return [msg for msg in messages if not (
                msg.role == 'human' and msg.agent_id in supervisor_agent_ids
            )]
        
        supervisor_agent_ids = [agent.id for agent in supervisors]
        
        # 筛选监督者相关消息
        supervisor_related = filter_supervisor_messages(all_messages, supervisor_agent_ids)
        print(f"✅ 监督者相关消息: {len(supervisor_related)}条")
        for msg in supervisor_related:
            print(f"   - {msg.role}: {msg.content[:50]}...")
        
        # 筛选任务消息
        task_messages = filter_task_messages(all_messages, supervisor_agent_ids)
        print(f"✅ 任务消息: {len(task_messages)}条")
        for msg in task_messages:
            print(f"   - {msg.role}: {msg.content[:50]}...")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")

def test_message_service_integration():
    """测试消息服务与supervisor角色的集成"""
    app = create_app()
    
    with app.app_context():
        print("\n=== 测试消息服务集成 ===")
        
        try:
            from app.services.message_service import MessageService
            
            # 创建测试数据
            action_space = ActionSpace(name="服务测试空间", description="用于测试消息服务的行动空间")
            db.session.add(action_space)
            db.session.flush()
            
            action_task = ActionTask(
                title="服务测试任务",
                description="用于测试消息服务的行动任务",
                action_space_id=action_space.id
            )
            db.session.add(action_task)
            db.session.flush()
            
            conversation = Conversation(
                title="服务测试会话",
                description="用于测试消息服务的会话",
                action_task_id=action_task.id
            )
            db.session.add(conversation)
            db.session.flush()
            
            supervisor_role = Role(
                name="服务测试监督者角色", 
                description="用于测试消息服务的监督者角色",
                is_observer_role=True
            )
            db.session.add(supervisor_role)
            db.session.flush()
            
            supervisor_agent = Agent(
                name="服务测试监督者智能体",
                description="用于测试消息服务的监督者智能体",
                role_id=supervisor_role.id,
                action_task_id=action_task.id,
                is_observer=True
            )
            db.session.add(supervisor_agent)
            db.session.flush()
            
            # 使用MessageService创建supervisor消息
            supervisor_message = MessageService.create_message(
                content="这是通过MessageService创建的监督者消息",
                role='supervisor',
                agent_id=supervisor_agent.id,
                task_id=action_task.id,
                conversation_id=conversation.id
            )
            
            print(f"✅ 通过MessageService成功创建监督者消息")
            print(f"   - 消息ID: {supervisor_message.id}")
            print(f"   - 角色: {supervisor_message.role}")
            print(f"   - 内容: {supervisor_message.content}")
            print(f"   - 智能体ID: {supervisor_message.agent_id}")
            
            # 验证消息已正确保存
            saved_message = Message.query.get(supervisor_message.id)
            if saved_message and saved_message.role == 'supervisor':
                print(f"✅ 监督者消息已正确保存到数据库")
            else:
                print(f"❌ 监督者消息保存验证失败")
            
            # 回滚测试数据
            db.session.rollback()
            print("✅ 消息服务集成测试完成，已回滚测试数据")
            
        except ImportError as e:
            print(f"❌ 无法导入MessageService: {e}")
        except Exception as e:
            print(f"❌ 消息服务集成测试失败: {e}")
            db.session.rollback()

if __name__ == "__main__":
    print("开始测试Message模型修改后的状态...")
    test_supervisor_message_creation()
    test_message_service_integration()
    print("\n所有测试完成！")
