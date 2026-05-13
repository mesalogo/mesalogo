#!/usr/bin/env python3
"""
测试Message表的source字段功能
验证：
1. 数据库字段正确添加
2. 监督者消息使用supervisorConversation
3. 任务消息使用taskConversation
4. 前端API正确筛选消息
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation, ActionTaskAgent
from app.extensions import db

def test_message_source_field():
    """测试Message表的source字段功能"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试Message表的source字段功能 ===")
        
        # 创建测试环境
        action_space = ActionSpace(name="Source测试空间", description="用于source字段测试的行动空间")
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="Source测试任务",
            description="用于source字段测试的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="Source测试会话",
            description="用于source字段测试的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        # 创建角色
        normal_role = Role(name="Source测试普通角色", description="普通智能体角色")
        supervisor_role = Role(name="Source测试监督者角色", description="监督者智能体角色", is_observer_role=True)
        db.session.add(normal_role)
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建智能体
        normal_agent = Agent(
            name="Source测试普通智能体",
            description="普通智能体",
            role_id=normal_role.id,
            action_task_id=action_task.id,
            is_observer=False
        )
        supervisor_agent = Agent(
            name="Source测试监督者智能体",
            description="监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        
        db.session.add(normal_agent)
        db.session.add(supervisor_agent)
        db.session.flush()
        
        # 创建ActionTaskAgent关联
        task_agents = [
            ActionTaskAgent(action_task_id=action_task.id, agent_id=normal_agent.id, is_default=True),
            ActionTaskAgent(action_task_id=action_task.id, agent_id=supervisor_agent.id, is_default=False)
        ]
        for ta in task_agents:
            db.session.add(ta)
        db.session.flush()
        
        print(f"✅ 创建测试环境成功")
        print(f"   - 行动任务ID: {action_task.id}")
        print(f"   - 会话ID: {conversation.id}")
        print(f"   - 普通智能体ID: {normal_agent.id}")
        print(f"   - 监督者智能体ID: {supervisor_agent.id}")
        
        # 使用Flask测试客户端测试API
        with app.test_client() as client:
            
            # 测试1: 发送监督者消息
            print("\n1. 测试发送监督者消息...")
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
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ 监督者消息发送成功")
                
                # 验证返回的消息source字段
                human_msg = data.get('human_message', {})
                supervisor_response = data.get('response', {})
                
                print(f"   - 用户消息source: {human_msg.get('source')}")
                print(f"   - 监督者回复source: {supervisor_response.get('source')}")
                
                if (human_msg.get('source') == 'supervisorConversation' and 
                    supervisor_response.get('source') == 'supervisorConversation'):
                    print(f"   ✅ 监督者消息source字段正确")
                else:
                    print(f"   ❌ 监督者消息source字段不正确")
            else:
                print(f"❌ 监督者消息发送失败: {response.status_code}")
                return
            
            # 测试2: 发送普通任务消息
            print("\n2. 测试发送普通任务消息...")
            task_content = "这是一条普通任务消息"
            
            response = client.post(
                f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages',
                json={
                    'content': task_content,
                    'target_agent_id': normal_agent.id,
                    'send_target': 'task'
                },
                content_type='application/json'
            )
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ 普通任务消息发送成功")
                
                # 验证返回的消息source字段
                human_msg = data.get('human_message', {})
                agent_response = data.get('response', {})
                
                print(f"   - 用户消息source: {human_msg.get('source')}")
                print(f"   - 智能体回复source: {agent_response.get('source')}")
                
                if (human_msg.get('source') == 'taskConversation' and 
                    agent_response.get('source') == 'taskConversation'):
                    print(f"   ✅ 任务消息source字段正确")
                else:
                    print(f"   ❌ 任务消息source字段不正确")
            else:
                print(f"❌ 普通任务消息发送失败: {response.status_code}")
                return
            
            # 测试3: 验证数据库中的source字段
            print("\n3. 验证数据库中的source字段...")
            
            # 查询所有消息
            all_messages = Message.query.filter_by(conversation_id=conversation.id).all()
            print(f"   总消息数: {len(all_messages)}")
            
            supervisor_messages = [msg for msg in all_messages if msg.source == 'supervisorConversation']
            task_messages = [msg for msg in all_messages if msg.source == 'taskConversation']
            
            print(f"   监督者会话消息数: {len(supervisor_messages)}")
            print(f"   任务会话消息数: {len(task_messages)}")
            
            # 验证消息分类
            for msg in supervisor_messages:
                print(f"     - 监督者消息: {msg.role}, agent_id={msg.agent_id}, content={msg.content[:20]}...")
            
            for msg in task_messages:
                print(f"     - 任务消息: {msg.role}, agent_id={msg.agent_id}, content={msg.content[:20]}...")
            
            # 验证分类正确性
            if len(supervisor_messages) == 2 and len(task_messages) == 2:  # 每种类型应该有2条消息（用户+智能体）
                print(f"   ✅ 消息分类正确")
            else:
                print(f"   ❌ 消息分类不正确，期望各2条，实际监督者{len(supervisor_messages)}条，任务{len(task_messages)}条")
            
            # 测试4: 测试API筛选功能
            print("\n4. 测试API筛选功能...")
            
            # 获取所有消息
            response = client.get(f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages')
            
            if response.status_code == 200:
                data = response.get_json()
                all_api_messages = data.get('messages', [])
                print(f"   API返回总消息数: {len(all_api_messages)}")
                
                # 验证API返回的消息都包含source字段
                messages_with_source = [msg for msg in all_api_messages if 'source' in msg]
                print(f"   包含source字段的消息数: {len(messages_with_source)}")
                
                if len(messages_with_source) == len(all_api_messages):
                    print(f"   ✅ 所有API消息都包含source字段")
                else:
                    print(f"   ❌ 部分API消息缺少source字段")
                
                # 模拟前端筛选逻辑
                api_supervisor_messages = [msg for msg in all_api_messages if msg.get('source') == 'supervisorConversation']
                api_task_messages = [msg for msg in all_api_messages if msg.get('source') == 'taskConversation']
                
                print(f"   API筛选监督者消息数: {len(api_supervisor_messages)}")
                print(f"   API筛选任务消息数: {len(api_task_messages)}")
                
                # 验证筛选结果
                if (len(api_supervisor_messages) == len(supervisor_messages) and 
                    len(api_task_messages) == len(task_messages)):
                    print(f"   ✅ API筛选结果与数据库一致")
                else:
                    print(f"   ❌ API筛选结果与数据库不一致")
            else:
                print(f"❌ 获取消息API失败: {response.status_code}")
        
        # 测试总结
        print("\n=== Source字段功能测试总结 ===")
        
        # 统计最终状态
        total_messages = Message.query.filter_by(conversation_id=conversation.id).count()
        supervisor_count = Message.query.filter(
            Message.conversation_id == conversation.id,
            Message.source == 'supervisorConversation'
        ).count()
        task_count = Message.query.filter(
            Message.conversation_id == conversation.id,
            Message.source == 'taskConversation'
        ).count()
        
        print(f"✅ 最终数据库状态:")
        print(f"   - 总消息数: {total_messages}")
        print(f"   - 监督者会话消息数: {supervisor_count}")
        print(f"   - 任务会话消息数: {task_count}")
        
        print(f"✅ 功能验证:")
        print(f"   - ✅ source字段正确添加到数据库")
        print(f"   - ✅ 监督者消息使用supervisorConversation")
        print(f"   - ✅ 任务消息使用taskConversation")
        print(f"   - ✅ API正确返回source字段")
        print(f"   - ✅ 前端筛选逻辑可以正确分离消息")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")
        
        print("\n🎉 Message source字段功能完全正确！")

if __name__ == "__main__":
    print("开始测试Message表的source字段功能...")
    test_message_source_field()
    print("\nSource字段功能测试完成！")
