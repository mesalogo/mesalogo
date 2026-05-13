#!/usr/bin/env python3
"""
测试脚本：验证修复后的supervisor消息处理逻辑
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation
from app.extensions import db
from app.services.conversation.message_processor import format_messages

def test_fixed_supervisor_message_processing():
    """测试修复后的supervisor消息处理"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试修复后的supervisor消息处理 ===")
        
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
        
        # 创建角色
        normal_role = Role(name="普通角色", description="普通智能体角色")
        supervisor_role = Role(name="监督者角色", description="监督者智能体角色", is_observer_role=True)
        db.session.add(normal_role)
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建智能体
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
        
        # 创建完整的对话序列
        messages = [
            Message(
                content="用户：大家好，我们开始讨论项目计划",
                role='human',
                action_task_id=action_task.id,
                conversation_id=conversation.id
            ),
            Message(
                content="我是普通智能体，我认为我们应该先制定时间表",
                role='agent',
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                agent_id=normal_agent.id
            ),
            Message(
                content="作为监督者，我建议大家在制定时间表时要考虑风险因素",
                role='supervisor',
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                agent_id=supervisor_agent.id
            ),
            Message(
                content="用户：好的，那我们先讨论一下可能的风险",
                role='human',
                action_task_id=action_task.id,
                conversation_id=conversation.id
            ),
            Message(
                content="我认为主要风险包括技术风险和时间风险",
                role='agent',
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                agent_id=normal_agent.id
            ),
            Message(
                content="监督者补充：还需要考虑资源风险和沟通风险",
                role='supervisor',
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                agent_id=supervisor_agent.id
            )
        ]
        
        for msg in messages:
            db.session.add(msg)
        db.session.flush()
        
        print(f"✅ 创建了{len(messages)}条测试消息")
        print("   - 2条human消息")
        print("   - 2条agent消息")
        print("   - 2条supervisor消息")
        
        # 测试format_messages函数
        print("\n1. 测试format_messages处理完整对话...")
        
        system_prompt = "你是一个测试智能体，参与项目讨论"
        current_content = "当前用户消息：请总结一下刚才的讨论"
        human_message = messages[0]
        
        try:
            formatted_messages = format_messages(
                system_prompt=system_prompt,
                recent_messages=messages,  # 包含所有历史消息
                current_content=current_content,
                human_message=human_message
            )
            
            print(f"✅ format_messages成功处理，返回{len(formatted_messages)}条格式化消息")
            
            # 详细检查每条消息
            for i, msg in enumerate(formatted_messages):
                print(f"\n   消息{i+1}: role={msg['role']}")
                content_preview = msg['content'][:100].replace('\n', ' ')
                print(f"   内容预览: {content_preview}...")
                
                # 特别检查supervisor消息的处理
                if '监督者' in msg['content']:
                    print(f"   ✅ 发现监督者消息标识")
                    if '[监督者]' in msg['content']:
                        print(f"   ✅ 监督者角色标识正确")
                    else:
                        print(f"   ❌ 监督者角色标识缺失")
                
                # 检查智能体消息的处理
                if '智能体' in msg['content'] and '[智能体]' in msg['content']:
                    print(f"   ✅ 普通智能体角色标识正确")
            
            # 统计不同类型的消息
            system_count = sum(1 for msg in formatted_messages if msg['role'] == 'system')
            user_count = sum(1 for msg in formatted_messages if msg['role'] == 'user')
            assistant_count = sum(1 for msg in formatted_messages if msg['role'] == 'assistant')
            
            print(f"\n   消息统计:")
            print(f"   - system消息: {system_count}条")
            print(f"   - user消息: {user_count}条")
            print(f"   - assistant消息: {assistant_count}条")
            
            # 验证supervisor消息是否被正确包含
            supervisor_messages_found = sum(1 for msg in formatted_messages 
                                          if msg['role'] == 'assistant' and '监督者' in msg['content'])
            print(f"   - 包含监督者标识的assistant消息: {supervisor_messages_found}条")
            
            if supervisor_messages_found == 2:  # 应该有2条supervisor消息
                print(f"   ✅ 所有supervisor消息都被正确处理")
            else:
                print(f"   ❌ supervisor消息处理不完整，期望2条，实际{supervisor_messages_found}条")
            
        except Exception as e:
            print(f"❌ format_messages处理失败: {e}")
            import traceback
            traceback.print_exc()
        
        # 测试消息筛选逻辑
        print("\n2. 测试消息筛选逻辑...")
        
        def filter_supervisor_messages(messages, supervisor_agent_ids):
            """筛选监督者相关消息"""
            return [msg for msg in messages if 
                    msg.role == 'supervisor' or 
                    (msg.role == 'human' and msg.agent_id in supervisor_agent_ids)]
        
        def filter_task_messages(messages, supervisor_agent_ids):
            """筛选任务消息（排除监督者相关的human消息）"""
            return [msg for msg in messages if not (
                msg.role == 'human' and msg.agent_id in supervisor_agent_ids
            )]
        
        supervisor_agent_ids = [supervisor_agent.id]
        
        # 筛选监督者相关消息
        supervisor_related = filter_supervisor_messages(messages, supervisor_agent_ids)
        print(f"✅ 监督者相关消息: {len(supervisor_related)}条")
        for msg in supervisor_related:
            print(f"   - {msg.role}: {msg.content[:50]}...")
        
        # 筛选任务消息
        task_messages = filter_task_messages(messages, supervisor_agent_ids)
        print(f"✅ 任务消息: {len(task_messages)}条")
        for msg in task_messages:
            print(f"   - {msg.role}: {msg.content[:50]}...")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")

if __name__ == "__main__":
    print("开始测试修复后的supervisor消息处理...")
    test_fixed_supervisor_message_processing()
    print("\n所有测试完成！")
