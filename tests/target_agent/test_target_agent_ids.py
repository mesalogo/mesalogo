#!/usr/bin/env python3
"""
测试target_agent_ids字段的存储和读取功能

这个脚本测试：
1. 用户消息中target_agent_ids字段是否正确存储到meta字段
2. API响应是否正确包含target_agent_ids信息
3. 前端是否能正确显示目标智能体信息
"""

import sys
import os
import json
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.models import db, Message, ActionSpace, ActionTask, Conversation, Agent, Role, User
from sqlalchemy import text

def test_target_agent_ids_storage():
    """测试target_agent_ids字段的存储功能"""
    app = create_app()

    with app.app_context():
        print("=== 测试target_agent_ids字段存储功能 ===")

        try:
            # 1. 创建测试数据
            print("\n1. 创建测试数据...")

            # 创建用户
            user = User(username="test_user", email="test@example.com", is_active=True)
            db.session.add(user)
            db.session.flush()

            # 创建行动空间
            action_space = ActionSpace(name="测试空间", description="用于测试target_agent_ids的行动空间")
            db.session.add(action_space)
            db.session.flush()

            # 创建行动任务
            action_task = ActionTask(
                title="测试任务",
                description="用于测试target_agent_ids的行动任务",
                action_space_id=action_space.id
            )
            db.session.add(action_task)
            db.session.flush()

            # 创建会话
            conversation = Conversation(
                title="测试会话",
                description="用于测试target_agent_ids的会话",
                action_task_id=action_task.id
            )
            db.session.add(conversation)
            db.session.flush()

            # 创建角色
            role1 = Role(name="测试角色1", description="第一个测试角色")
            role2 = Role(name="测试角色2", description="第二个测试角色")
            db.session.add_all([role1, role2])
            db.session.flush()

            # 创建智能体
            agent1 = Agent(
                name="智能体1",
                description="第一个测试智能体",
                role_id=role1.id,
                action_task_id=action_task.id
            )
            agent2 = Agent(
                name="智能体2",
                description="第二个测试智能体",
                role_id=role2.id,
                action_task_id=action_task.id
            )
            db.session.add_all([agent1, agent2])
            db.session.flush()

            print(f"✅ 测试数据创建成功")
            print(f"   - 用户ID: {user.id}")
            print(f"   - 行动任务ID: {action_task.id}")
            print(f"   - 会话ID: {conversation.id}")
            print(f"   - 智能体1 ID: {agent1.id}")
            print(f"   - 智能体2 ID: {agent2.id}")

            # 2. 直接测试消息创建和meta字段存储
            print("\n2. 测试直接创建包含target_agent_ids的消息...")

            # 创建包含单个目标智能体的消息
            message1 = Message(
                content="测试消息：发送给单个智能体",
                role='human',
                source='taskConversation',
                meta={'target_agent_ids': [agent1.id]},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message1)
            db.session.flush()

            print(f"✅ 成功创建用户消息 ID={message1.id}")
            print(f"   - 内容: {message1.content}")
            print(f"   - meta字段: {message1.meta}")

            # 验证meta字段中的target_agent_ids
            if message1.meta and 'target_agent_ids' in message1.meta:
                target_ids = message1.meta['target_agent_ids']
                if target_ids == [agent1.id]:
                    print(f"✅ target_agent_ids正确存储: {target_ids}")
                else:
                    print(f"❌ target_agent_ids存储错误，期望: [{agent1.id}], 实际: {target_ids}")
            else:
                print(f"❌ meta字段中未找到target_agent_ids")

            # 3. 测试多个目标智能体的存储
            print("\n3. 测试多个目标智能体的存储...")

            # 创建包含多个目标智能体的消息
            message2 = Message(
                content="测试消息：发送给多个智能体",
                role='human',
                source='taskConversation',
                meta={'target_agent_ids': [agent1.id, agent2.id]},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message2)
            db.session.flush()

            print(f"✅ 成功创建用户消息 ID={message2.id}")
            print(f"   - 内容: {message2.content}")
            print(f"   - meta字段: {message2.meta}")

            # 验证meta字段中的target_agent_ids
            if message2.meta and 'target_agent_ids' in message2.meta:
                target_ids = message2.meta['target_agent_ids']
                expected_ids = [agent1.id, agent2.id]
                if set(target_ids) == set(expected_ids):
                    print(f"✅ target_agent_ids正确存储: {target_ids}")
                else:
                    print(f"❌ target_agent_ids存储错误，期望: {expected_ids}, 实际: {target_ids}")
            else:
                print(f"❌ meta字段中未找到target_agent_ids")

            # 4. 测试无目标智能体的存储（发送给所有智能体）
            print("\n4. 测试无目标智能体的存储（发送给所有智能体）...")

            # 创建不包含target_agent_ids的消息
            message3 = Message(
                content="测试消息：发送给所有智能体",
                role='human',
                source='taskConversation',
                meta={},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message3)
            db.session.flush()

            print(f"✅ 成功创建用户消息 ID={message3.id}")
            print(f"   - 内容: {message3.content}")
            print(f"   - meta字段: {message3.meta}")

            # 验证meta字段中没有target_agent_ids
            if message3.meta and 'target_agent_ids' in message3.meta:
                print(f"❌ 意外发现target_agent_ids: {message3.meta['target_agent_ids']}")
            else:
                print(f"✅ 正确：未设置target_agent_ids（发送给所有智能体）")

            # 回滚测试数据
            db.session.rollback()
            print("\n✅ target_agent_ids存储测试完成，已回滚测试数据")

        except Exception as e:
            print(f"❌ target_agent_ids存储测试失败: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()

def test_api_response_target_agent_ids():
    """测试API响应中target_agent_ids字段的读取功能"""
    app = create_app()
    
    with app.app_context():
        print("\n=== 测试API响应中target_agent_ids字段读取功能 ===")
        
        try:
            # 1. 创建测试数据
            print("\n1. 创建测试数据...")
            
            # 创建用户
            user = User(username="test_user2", email="test2@example.com", is_active=True)
            db.session.add(user)
            db.session.flush()
            
            # 创建行动空间
            action_space = ActionSpace(name="测试空间2", description="用于测试API响应的行动空间")
            db.session.add(action_space)
            db.session.flush()
            
            # 创建行动任务
            action_task = ActionTask(
                title="测试任务2",
                description="用于测试API响应的行动任务",
                action_space_id=action_space.id
            )
            db.session.add(action_task)
            db.session.flush()
            
            # 创建会话
            conversation = Conversation(
                title="测试会话2",
                description="用于测试API响应的会话",
                action_task_id=action_task.id
            )
            db.session.add(conversation)
            db.session.flush()
            
            # 创建角色
            role1 = Role(name="测试角色A", description="第一个测试角色")
            role2 = Role(name="测试角色B", description="第二个测试角色")
            db.session.add_all([role1, role2])
            db.session.flush()
            
            # 创建智能体
            agent1 = Agent(
                name="智能体A",
                description="第一个测试智能体",
                role_id=role1.id,
                action_task_id=action_task.id
            )
            agent2 = Agent(
                name="智能体B", 
                description="第二个测试智能体",
                role_id=role2.id,
                action_task_id=action_task.id
            )
            db.session.add_all([agent1, agent2])
            db.session.flush()
            
            # 2. 直接创建包含target_agent_ids的消息
            print("\n2. 创建包含target_agent_ids的测试消息...")
            
            # 创建包含单个目标智能体的消息
            message1 = Message(
                content="测试消息1：发送给智能体A",
                role='human',
                source='taskConversation',
                meta={'target_agent_ids': [agent1.id]},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message1)
            
            # 创建包含多个目标智能体的消息
            message2 = Message(
                content="测试消息2：发送给智能体A和B",
                role='human',
                source='taskConversation',
                meta={'target_agent_ids': [agent1.id, agent2.id]},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message2)
            
            # 创建不包含target_agent_ids的消息（发送给所有智能体）
            message3 = Message(
                content="测试消息3：发送给所有智能体",
                role='human',
                source='taskConversation',
                meta={},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message3)
            
            db.session.commit()
            
            print(f"✅ 测试消息创建成功")
            print(f"   - 消息1 ID: {message1.id} (目标: 智能体A)")
            print(f"   - 消息2 ID: {message2.id} (目标: 智能体A和B)")
            print(f"   - 消息3 ID: {message3.id} (目标: 所有智能体)")
            
            # 3. 测试数据库中的消息读取
            print("\n3. 测试从数据库读取target_agent_ids字段...")

            # 直接从数据库查询消息
            messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.created_at).all()

            print(f"✅ 成功从数据库获取会话消息，共 {len(messages)} 条")

            for i, msg in enumerate(messages):
                print(f"\n   消息 {i+1}:")
                print(f"   - ID: {msg.id}")
                print(f"   - 内容: {msg.content}")
                print(f"   - meta字段: {msg.meta}")

                # 从meta字段提取target_agent_ids
                meta = getattr(msg, 'meta', {})
                target_agent_ids = meta.get('target_agent_ids') if meta else None
                print(f"   - target_agent_ids: {target_agent_ids}")

                # 验证target_agent_ids字段
                if msg.id == message1.id:
                    expected = [agent1.id]
                    if target_agent_ids == expected:
                        print(f"   ✅ target_agent_ids正确: {target_agent_ids}")
                    else:
                        print(f"   ❌ target_agent_ids错误，期望: {expected}, 实际: {target_agent_ids}")

                elif msg.id == message2.id:
                    expected = [agent1.id, agent2.id]
                    if target_agent_ids and set(target_agent_ids) == set(expected):
                        print(f"   ✅ target_agent_ids正确: {target_agent_ids}")
                    else:
                        print(f"   ❌ target_agent_ids错误，期望: {expected}, 实际: {target_agent_ids}")

                elif msg.id == message3.id:
                    if target_agent_ids is None:
                        print(f"   ✅ target_agent_ids正确为None（发送给所有智能体）")
                    else:
                        print(f"   ❌ target_agent_ids应为None，实际: {target_agent_ids}")
            
            # 回滚测试数据
            db.session.rollback()
            print("\n✅ API响应target_agent_ids测试完成，已回滚测试数据")
            
        except Exception as e:
            print(f"❌ API响应target_agent_ids测试失败: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()

if __name__ == "__main__":
    print("开始测试target_agent_ids字段功能...")
    test_target_agent_ids_storage()
    test_api_response_target_agent_ids()
    print("\n所有测试完成！")
