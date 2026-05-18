#!/usr/bin/env python3
"""
测试脚本：验证消息处理器对supervisor角色的支持
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation
from app.extensions import db
from app.services.conversation.message_processor import format_messages, build_system_prompt

def test_format_messages_with_supervisor():
    """测试format_messages函数对supervisor消息的处理"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试format_messages对supervisor消息的处理 ===")
        
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
        
        # 创建普通角色和监督者角色
        normal_role = Role(name="普通角色", description="普通智能体角色")
        supervisor_role = Role(name="监督者角色", description="监督者智能体角色", is_observer_role=True)
        db.session.add(normal_role)
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建普通智能体和监督者智能体
        normal_agent = Agent(
            name="普通智能体",
            description="普通智能体",
            role_id=normal_role.id,
            action_task_id=action_task.id,
            is_observer=False
        )
        supervisor_agent = Agent(
            name="监督者智能体",
            description="监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        db.session.add(normal_agent)
        db.session.add(supervisor_agent)
        db.session.flush()
        
        # 创建测试消息序列
        messages = [
            Message(
                content="用户发起对话",
                role='human',
                action_task_id=action_task.id,
                conversation_id=conversation.id
            ),
            Message(
                content="我是普通智能体的回复",
                role='agent',
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                agent_id=normal_agent.id
            ),
            Message(
                content="我是监督者的观察和建议",
                role='supervisor',
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                agent_id=supervisor_agent.id
            ),
            Message(
                content="用户继续对话",
                role='human',
                action_task_id=action_task.id,
                conversation_id=conversation.id
            )
        ]
        
        for msg in messages:
            db.session.add(msg)
        db.session.flush()
        
        print(f"✅ 创建了{len(messages)}条测试消息")
        
        # 测试format_messages函数
        print("\n1. 测试format_messages函数...")
        
        system_prompt = "你是一个测试智能体"
        current_content = "当前用户消息"
        human_message = messages[0]  # 使用第一条human消息作为当前消息
        
        try:
            formatted_messages = format_messages(
                system_prompt=system_prompt,
                recent_messages=messages[:-1],  # 除了最后一条消息
                current_content=current_content,
                human_message=human_message
            )
            
            print(f"✅ format_messages成功处理，返回{len(formatted_messages)}条格式化消息")
            
            # 检查格式化后的消息
            for i, msg in enumerate(formatted_messages):
                print(f"   消息{i+1}: role={msg['role']}, content前50字符={msg['content'][:50]}...")
                
                # 特别检查supervisor消息的处理
                if 'supervisor' in msg['content'] or '监督者' in msg['content']:
                    print(f"     ⚠️  发现可能的supervisor消息处理")
            
        except Exception as e:
            print(f"❌ format_messages处理失败: {e}")
            import traceback
            traceback.print_exc()
        
        # 测试build_system_prompt对监督者的处理
        print("\n2. 测试build_system_prompt对监督者的处理...")
        
        try:
            # 测试普通智能体的系统提示词
            normal_prompt = build_system_prompt(
                agent=normal_agent,
                agent_role=normal_role,
                action_task=action_task,
                conversation=conversation,
                tool_definitions=[],
                tool_names=[],
                role_capabilities=[]
            )
            
            print(f"✅ 普通智能体系统提示词生成成功")
            print(f"   包含监督者标识: {'监督者' in normal_prompt}")
            
            # 测试监督者智能体的系统提示词
            supervisor_prompt = build_system_prompt(
                agent=supervisor_agent,
                agent_role=supervisor_role,
                action_task=action_task,
                conversation=conversation,
                tool_definitions=[],
                tool_names=[],
                role_capabilities=[]
            )
            
            print(f"✅ 监督者智能体系统提示词生成成功")
            print(f"   包含监督者标识: {'监督者' in supervisor_prompt}")
            
            # 显示监督者提示词的关键部分
            if '监督者' in supervisor_prompt:
                lines = supervisor_prompt.split('\n')
                for line in lines:
                    if '监督者' in line:
                        print(f"   监督者标识行: {line.strip()}")
                        break
            
        except Exception as e:
            print(f"❌ build_system_prompt处理失败: {e}")
            import traceback
            traceback.print_exc()
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")

def test_message_processor_integration():
    """测试消息处理器的完整集成"""
    app = create_app()
    
    with app.app_context():
        print("\n=== 测试消息处理器完整集成 ===")
        
        try:
            from app.services.conversation.message_processor import process_message_common
            
            # 创建测试数据
            action_space = ActionSpace(name="集成测试空间", description="用于集成测试的行动空间")
            db.session.add(action_space)
            db.session.flush()
            
            action_task = ActionTask(
                title="集成测试任务",
                description="用于集成测试的行动任务",
                action_space_id=action_space.id
            )
            db.session.add(action_task)
            db.session.flush()
            
            conversation = Conversation(
                title="集成测试会话",
                description="用于集成测试的会话",
                action_task_id=action_task.id
            )
            db.session.add(conversation)
            db.session.flush()
            
            supervisor_role = Role(
                name="集成测试监督者角色", 
                description="用于集成测试的监督者角色",
                is_observer_role=True
            )
            db.session.add(supervisor_role)
            db.session.flush()
            
            supervisor_agent = Agent(
                name="集成测试监督者智能体",
                description="用于集成测试的监督者智能体",
                role_id=supervisor_role.id,
                action_task_id=action_task.id,
                is_observer=True
            )
            db.session.add(supervisor_agent)
            db.session.flush()
            
            # 测试process_message_common函数
            print("1. 测试process_message_common处理监督者消息...")
            
            result = process_message_common(
                conversation_id=conversation.id,
                content="请监督者检查当前对话",
                target_agent_id=supervisor_agent.id
            )
            
            if result and len(result) >= 9:
                human_message, agent, role, model_config, formatted_messages, conv, role_model_params, agent_info, model_settings = result
                
                print(f"✅ process_message_common成功处理监督者消息")
                print(f"   - 人类消息ID: {human_message.id if human_message else 'None'}")
                print(f"   - 目标智能体: {agent.name if agent else 'None'}")
                print(f"   - 智能体角色: {role.name if role else 'None'}")
                print(f"   - 是否为监督者: {agent.is_observer if agent else 'None'}")
                print(f"   - 格式化消息数量: {len(formatted_messages) if formatted_messages else 0}")
                
                # 检查agent_info中的监督者信息
                if agent_info:
                    print(f"   - agent_info包含监督者标识: {agent_info.get('is_observer', False)}")
                
            else:
                print(f"❌ process_message_common返回结果异常: {result}")
            
            # 回滚测试数据
            db.session.rollback()
            print("✅ 集成测试完成，已回滚测试数据")
            
        except Exception as e:
            print(f"❌ 集成测试失败: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()

if __name__ == "__main__":
    print("开始测试消息处理器对supervisor角色的支持...")
    test_format_messages_with_supervisor()
    test_message_processor_integration()
    print("\n所有测试完成！")
