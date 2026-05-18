#!/usr/bin/env python3
"""
简单的target_agent_ids字段测试

测试消息的meta字段是否能正确存储和读取target_agent_ids
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.models import db, Message, ActionSpace, ActionTask, Conversation, Agent, Role, User

def test_basic_meta_field():
    """测试基本的meta字段功能"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试基本meta字段功能 ===")
        
        try:
            # 创建最小测试数据
            user = User(username="test_user", email="test@example.com", is_active=True)
            db.session.add(user)
            db.session.flush()
            
            action_space = ActionSpace(name="测试空间", description="测试")
            db.session.add(action_space)
            db.session.flush()
            
            action_task = ActionTask(
                title="测试任务",
                description="测试",
                action_space_id=action_space.id
            )
            db.session.add(action_task)
            db.session.flush()
            
            conversation = Conversation(
                title="测试会话",
                description="测试",
                action_task_id=action_task.id
            )
            db.session.add(conversation)
            db.session.flush()
            
            print("✅ 基础数据创建成功")
            
            # 测试1: 创建包含target_agent_ids的消息
            print("\n测试1: 创建包含target_agent_ids的消息")
            message1 = Message(
                content="测试消息1",
                role='human',
                source='taskConversation',
                meta={'target_agent_ids': [1, 2, 3]},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message1)
            db.session.flush()
            
            print(f"✅ 消息创建成功 ID={message1.id}")
            print(f"   meta字段: {message1.meta}")
            
            # 验证存储
            if message1.meta and 'target_agent_ids' in message1.meta:
                target_ids = message1.meta['target_agent_ids']
                if target_ids == [1, 2, 3]:
                    print(f"✅ target_agent_ids正确存储: {target_ids}")
                else:
                    print(f"❌ target_agent_ids存储错误: {target_ids}")
            else:
                print(f"❌ meta字段中未找到target_agent_ids")
            
            # 测试2: 从数据库重新读取
            print("\n测试2: 从数据库重新读取消息")
            saved_message = Message.query.get(message1.id)
            if saved_message:
                print(f"✅ 消息读取成功 ID={saved_message.id}")
                print(f"   meta字段: {saved_message.meta}")
                
                if saved_message.meta and 'target_agent_ids' in saved_message.meta:
                    target_ids = saved_message.meta['target_agent_ids']
                    if target_ids == [1, 2, 3]:
                        print(f"✅ target_agent_ids正确读取: {target_ids}")
                    else:
                        print(f"❌ target_agent_ids读取错误: {target_ids}")
                else:
                    print(f"❌ 读取的消息meta字段中未找到target_agent_ids")
            else:
                print(f"❌ 无法从数据库读取消息")
            
            # 测试3: 创建空meta字段的消息
            print("\n测试3: 创建空meta字段的消息")
            message2 = Message(
                content="测试消息2",
                role='human',
                source='taskConversation',
                meta={},
                action_task_id=action_task.id,
                conversation_id=conversation.id,
                user_id=user.id
            )
            db.session.add(message2)
            db.session.flush()
            
            print(f"✅ 消息创建成功 ID={message2.id}")
            print(f"   meta字段: {message2.meta}")
            
            # 验证空meta字段
            if not message2.meta or 'target_agent_ids' not in message2.meta:
                print(f"✅ 正确：空meta字段中没有target_agent_ids")
            else:
                print(f"❌ 意外发现target_agent_ids: {message2.meta.get('target_agent_ids')}")
            
            # 回滚测试数据
            db.session.rollback()
            print("\n✅ 所有测试完成，已回滚测试数据")
            
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()

if __name__ == "__main__":
    print("开始简单的target_agent_ids字段测试...")
    test_basic_meta_field()
    print("\n测试完成！")
