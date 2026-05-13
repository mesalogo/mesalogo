#!/usr/bin/env python3
"""
调试source字段设置问题
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation, ActionTaskAgent
from app.extensions import db

def test_debug_source():
    """调试source字段设置问题"""
    app = create_app()
    
    with app.app_context():
        print("=== 调试source字段设置问题 ===")
        
        # 创建测试环境
        action_space = ActionSpace(name="Debug测试空间", description="用于调试的行动空间")
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="Debug测试任务",
            description="用于调试的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="Debug测试会话",
            description="用于调试的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        # 创建角色
        supervisor_role = Role(name="Debug监督者角色", description="监督者智能体角色", is_observer_role=True)
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建智能体
        supervisor_agent = Agent(
            name="Debug监督者智能体",
            description="监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        
        db.session.add(supervisor_agent)
        db.session.flush()
        
        # 创建ActionTaskAgent关联
        task_agent = ActionTaskAgent(action_task_id=action_task.id, agent_id=supervisor_agent.id, is_default=False)
        db.session.add(task_agent)
        db.session.flush()
        
        print(f"✅ 创建测试环境成功")
        print(f"   - 行动任务ID: {action_task.id}")
        print(f"   - 会话ID: {conversation.id}")
        print(f"   - 监督者智能体ID: {supervisor_agent.id}")
        
        # 使用Flask测试客户端测试API
        with app.test_client() as client:
            
            # 测试发送监督者消息
            print("\n测试发送监督者消息...")
            supervisor_content = "请监督者检查当前进度"
            
            response = client.post(
                f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages',
                json={
                    'content': supervisor_content,
                    'target_agent_id': supervisor_agent.id,
                    'send_target': 'supervisor'
                },
                content_type='application/json'
            )
            
            print(f"响应状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.get_json()
                print(f"响应数据: {data}")
                
                # 检查数据库中的消息
                messages = Message.query.filter_by(conversation_id=conversation.id).all()
                print(f"\n数据库中的消息:")
                for msg in messages:
                    print(f"  - ID: {msg.id}, role: {msg.role}, source: {msg.source}, agent_id: {msg.agent_id}, content: {msg.content[:30]}...")
            else:
                print(f"请求失败: {response.get_data(as_text=True)}")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")

if __name__ == "__main__":
    print("开始调试source字段设置问题...")
    test_debug_source()
    print("\n调试完成！")
