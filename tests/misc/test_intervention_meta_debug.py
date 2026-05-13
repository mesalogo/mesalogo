#!/usr/bin/env python3
"""
调试监督者干预消息meta字段问题
"""

import sys
import os
# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import (
    Message, Agent, Role, ActionTask, ActionSpace, Conversation, 
    ActionTaskAgent, db
)
from datetime import datetime

def test_intervention_meta_debug():
    """调试监督者干预消息meta字段"""
    app = create_app()
    
    with app.app_context():
        print("=== 监督者干预消息Meta字段调试 ===")
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 创建测试环境
        print("\n1. 创建测试环境...")
        action_space = ActionSpace(
            name="Meta调试空间", 
            description="用于调试meta字段的行动空间"
        )
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="Meta调试任务",
            description="用于调试meta字段的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="Meta调试会话",
            description="用于调试meta字段的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        # 创建监督者角色和智能体
        supervisor_role = Role(
            name="Meta调试监督者角色", 
            description="监督者智能体角色", 
            is_observer_role=True
        )
        db.session.add(supervisor_role)
        db.session.flush()
        
        supervisor_agent = Agent(
            name="Meta调试监督者智能体",
            description="监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        db.session.add(supervisor_agent)
        db.session.flush()
        
        # 创建ActionTaskAgent关联
        task_agent = ActionTaskAgent(
            action_task_id=action_task.id, 
            agent_id=supervisor_agent.id, 
            is_default=False
        )
        db.session.add(task_agent)
        db.session.flush()
        
        print(f"✅ 测试环境创建成功")
        print(f"   - 监督者智能体ID: {supervisor_agent.id}")
        
        # 使用Flask测试客户端测试API
        with app.test_client() as client:
            
            # 测试监督者干预消息
            print("\n2. 测试监督者干预消息...")
            intervention_content = "这是一条监督者干预消息"
            
            response = client.post(
                f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages',
                json={
                    'content': intervention_content,
                    'target_agent_id': supervisor_agent.id,
                    'send_target': 'task_intervention'
                },
                content_type='application/json'
            )
            
            print(f"   响应状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ 监督者干预消息发送成功")
                
                human_msg = data.get('human_message', {})
                supervisor_response = data.get('response', {})
                
                print(f"\n   用户消息详情:")
                print(f"   - ID: {human_msg.get('id')}")
                print(f"   - source: {human_msg.get('source')}")
                print(f"   - meta: {human_msg.get('meta')}")
                print(f"   - agent_id: {human_msg.get('agent_id')}")
                
                print(f"\n   监督者回复详情:")
                print(f"   - ID: {supervisor_response.get('id')}")
                print(f"   - role: {supervisor_response.get('role')}")
                print(f"   - source: {supervisor_response.get('source')}")
                print(f"   - meta: {supervisor_response.get('meta')}")
                print(f"   - agent_id: {supervisor_response.get('agent_id')}")
                
                # 直接从数据库查询消息验证
                print(f"\n3. 直接从数据库验证...")
                
                if human_msg.get('id'):
                    db_human_msg = Message.query.get(human_msg['id'])
                    if db_human_msg:
                        print(f"   数据库用户消息:")
                        print(f"   - source: {db_human_msg.source}")
                        print(f"   - meta: {db_human_msg.meta}")
                        print(f"   - agent_id: {db_human_msg.agent_id}")
                        
                        # 验证meta字段
                        if db_human_msg.meta and db_human_msg.meta.get('type') == 'info':
                            print(f"   ✅ 用户消息meta.type=info设置正确")
                        else:
                            print(f"   ❌ 用户消息meta.type=info设置错误")
                    else:
                        print(f"   ❌ 数据库中未找到用户消息")
                
                if supervisor_response.get('id'):
                    db_supervisor_msg = Message.query.get(supervisor_response['id'])
                    if db_supervisor_msg:
                        print(f"\n   数据库监督者回复:")
                        print(f"   - role: {db_supervisor_msg.role}")
                        print(f"   - source: {db_supervisor_msg.source}")
                        print(f"   - meta: {db_supervisor_msg.meta}")
                        print(f"   - agent_id: {db_supervisor_msg.agent_id}")
                        
                        # 验证meta字段
                        if db_supervisor_msg.meta and db_supervisor_msg.meta.get('type') == 'info':
                            print(f"   ✅ 监督者回复meta.type=info设置正确")
                        else:
                            print(f"   ❌ 监督者回复meta.type=info设置错误")
                    else:
                        print(f"   ❌ 数据库中未找到监督者回复")
                
            else:
                print(f"❌ 监督者干预消息发送失败: {response.status_code}")
                print(f"   响应: {response.get_data(as_text=True)[:200]}...")
        
        # 测试总结
        print(f"\n=== Meta字段调试总结 ===")
        print(f"✅ 测试完成，检查上述输出确认meta字段是否正确设置")
        
        # 回滚测试数据
        db.session.rollback()
        print(f"\n✅ 测试完成，已回滚测试数据")
        
        return True

if __name__ == "__main__":
    print("开始监督者干预消息Meta字段调试...")
    success = test_intervention_meta_debug()
    if success:
        print("\n✅ Meta字段调试测试完成")
    else:
        print("\n❌ Meta字段调试测试失败")
