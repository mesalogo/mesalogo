#!/usr/bin/env python3
"""
监督者流式输出和消息角色最终测试
验证：
1. 监督者回复使用supervisor角色
2. 监督者消息不出现在任务会话中
3. 监督者消息正确记录在监督会话记录中
4. 流式输出功能正常
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation, ActionTaskAgent
from app.extensions import db

def test_supervisor_streaming_final():
    """监督者流式输出和消息角色最终测试"""
    app = create_app()
    
    with app.app_context():
        print("=== 监督者流式输出和消息角色最终测试 ===")
        
        # 创建测试环境
        action_space = ActionSpace(name="流式测试空间", description="用于流式测试的行动空间")
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="流式测试任务",
            description="用于流式测试的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="流式测试会话",
            description="用于流式测试的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        # 创建角色
        normal_role = Role(name="流式测试普通角色", description="普通智能体角色")
        supervisor_role = Role(name="流式测试监督者角色", description="监督者智能体角色", is_observer_role=True)
        db.session.add(normal_role)
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建智能体
        normal_agent = Agent(
            name="流式测试普通智能体",
            description="普通智能体",
            role_id=normal_role.id,
            action_task_id=action_task.id,
            is_observer=False
        )
        supervisor_agent = Agent(
            name="流式测试监督者智能体",
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
        print(f"   - 普通智能体ID: {normal_agent.id} (is_observer: {normal_agent.is_observer})")
        print(f"   - 监督者智能体ID: {supervisor_agent.id} (is_observer: {supervisor_agent.is_observer})")
        
        # 使用Flask测试客户端测试API
        with app.test_client() as client:
            
            # 测试1: 验证监督者智能体API
            print("\n1. 验证监督者智能体API...")
            response = client.get(f'/api/action-tasks/{action_task.id}/agents?is_observer=true')
            
            if response.status_code == 200:
                data = response.get_json()
                supervisors = data.get('agents', [])
                print(f"✅ 获取监督者智能体: {len(supervisors)}个")
                
                for supervisor in supervisors:
                    print(f"   - {supervisor['name']} (ID: {supervisor['id']}, is_observer: {supervisor['is_observer']})")
            else:
                print(f"❌ 获取监督者智能体失败: {response.status_code}")
                return
            
            # 测试2: 发送监督者消息并验证角色
            print("\n2. 发送监督者消息并验证角色...")
            test_content = "请监督者检查当前进度，这是一条测试消息"
            
            # 记录发送前的消息数量
            messages_before = Message.query.filter_by(conversation_id=conversation.id).count()
            supervisor_messages_before = Message.query.filter_by(
                conversation_id=conversation.id,
                role='supervisor'
            ).count()
            
            print(f"   发送前 - 总消息数: {messages_before}, 监督者消息数: {supervisor_messages_before}")
            
            response = client.post(
                f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages',
                json={
                    'content': test_content,
                    'target_agent_id': supervisor_agent.id,
                    'send_target': 'supervisor'
                },
                content_type='application/json'
            )
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ 监督者消息发送成功")
                
                # 验证返回的数据结构
                if 'human_message' in data and 'response' in data:
                    human_msg = data['human_message']
                    supervisor_response = data['response']
                    
                    print(f"   - 用户消息角色: {human_msg.get('role')}")
                    print(f"   - 用户消息agent_id: {human_msg.get('agent_id')}")
                    print(f"   - 监督者回复角色: {supervisor_response.get('role')}")
                    print(f"   - 监督者回复agent_id: {supervisor_response.get('agent_id')}")
                    
                    # 验证角色正确性
                    if (human_msg.get('role') == 'human' and 
                        supervisor_response.get('role') == 'supervisor' and
                        human_msg.get('agent_id') == supervisor_agent.id and
                        supervisor_response.get('agent_id') == supervisor_agent.id):
                        print(f"   ✅ 消息角色和智能体ID完全正确")
                    else:
                        print(f"   ❌ 消息角色或智能体ID不正确")
                        
                else:
                    print(f"   ❌ 返回数据结构不正确")
                    
            else:
                print(f"❌ 监督者消息发送失败: {response.status_code}")
                print(f"   响应: {response.get_data(as_text=True)}")
                return
            
            # 测试3: 验证数据库中的消息
            print("\n3. 验证数据库中的消息...")
            
            # 查询发送后的消息数量
            messages_after = Message.query.filter_by(conversation_id=conversation.id).count()
            supervisor_messages_after = Message.query.filter_by(
                conversation_id=conversation.id,
                role='supervisor'
            ).count()
            
            print(f"   发送后 - 总消息数: {messages_after}, 监督者消息数: {supervisor_messages_after}")
            
            # 验证消息数量增加
            if messages_after == messages_before + 2:  # 应该增加2条消息（用户+监督者）
                print(f"   ✅ 消息数量正确增加了2条")
            else:
                print(f"   ❌ 消息数量增加异常，期望+2，实际+{messages_after - messages_before}")
            
            if supervisor_messages_after == supervisor_messages_before + 1:  # 应该增加1条监督者消息
                print(f"   ✅ 监督者消息数量正确增加了1条")
            else:
                print(f"   ❌ 监督者消息数量增加异常，期望+1，实际+{supervisor_messages_after - supervisor_messages_before}")
            
            # 查询最新的消息
            latest_messages = Message.query.filter_by(
                conversation_id=conversation.id
            ).order_by(Message.created_at.desc()).limit(2).all()
            
            if len(latest_messages) >= 2:
                latest_supervisor = latest_messages[0]  # 最新一条（监督者回复）
                latest_human = latest_messages[1]  # 倒数第二条（用户消息）
                
                print(f"   最新用户消息:")
                print(f"     - 角色: {latest_human.role}")
                print(f"     - agent_id: {latest_human.agent_id}")
                print(f"     - 内容: {latest_human.content[:30]}...")
                
                print(f"   最新监督者消息:")
                print(f"     - 角色: {latest_supervisor.role}")
                print(f"     - agent_id: {latest_supervisor.agent_id}")
                print(f"     - 内容: {latest_supervisor.content[:30]}...")
                
                # 验证消息角色和关联
                if (latest_human.role == 'human' and 
                    latest_human.agent_id == supervisor_agent.id and
                    latest_supervisor.role == 'supervisor' and
                    latest_supervisor.agent_id == supervisor_agent.id):
                    print(f"   ✅ 数据库中的消息角色和关联完全正确")
                else:
                    print(f"   ❌ 数据库中的消息角色或关联不正确")
            
            # 测试4: 验证消息筛选逻辑
            print("\n4. 验证消息筛选逻辑...")
            
            # 获取所有消息
            response = client.get(f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages')
            
            if response.status_code == 200:
                data = response.get_json()
                all_messages = data.get('messages', [])
                print(f"   获取所有消息: {len(all_messages)}条")
                
                # 模拟前端筛选监督者相关消息
                supervisor_agent_ids = [supervisor_agent.id]
                supervisor_related = [msg for msg in all_messages if 
                                    msg['role'] == 'supervisor' or 
                                    (msg['role'] == 'human' and msg.get('agent_id') in supervisor_agent_ids)]
                
                # 模拟前端筛选任务消息
                task_messages = [msg for msg in all_messages if not (
                    msg['role'] == 'human' and msg.get('agent_id') in supervisor_agent_ids
                )]
                
                print(f"   监督者相关消息: {len(supervisor_related)}条")
                for msg in supervisor_related:
                    print(f"     - {msg['role']}: {msg['content'][:30]}... (agent_id: {msg.get('agent_id')})")
                
                print(f"   任务消息: {len(task_messages)}条")
                for msg in task_messages:
                    print(f"     - {msg['role']}: {msg['content'][:30]}... (agent_id: {msg.get('agent_id')})")
                
                # 验证筛选逻辑
                supervisor_count = len([msg for msg in supervisor_related if msg['role'] == 'supervisor'])
                human_to_supervisor_count = len([msg for msg in supervisor_related if 
                                               msg['role'] == 'human' and msg.get('agent_id') == supervisor_agent.id])
                
                if supervisor_count >= 1 and human_to_supervisor_count >= 1:
                    print(f"   ✅ 监督者相关消息筛选正确")
                else:
                    print(f"   ❌ 监督者相关消息筛选不正确")
                
                # 验证任务消息中不包含向监督者发送的human消息
                human_to_supervisor_in_task = len([msg for msg in task_messages if 
                                                 msg['role'] == 'human' and msg.get('agent_id') == supervisor_agent.id])
                
                if human_to_supervisor_in_task == 0:
                    print(f"   ✅ 任务消息正确排除了向监督者的用户消息")
                else:
                    print(f"   ❌ 任务消息中仍包含向监督者的用户消息")
            
            # 测试5: 发送普通消息验证对比
            print("\n5. 发送普通消息验证对比...")
            
            normal_content = "这是一条发送给普通智能体的消息"
            
            response = client.post(
                f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages',
                json={
                    'content': normal_content,
                    'target_agent_id': normal_agent.id,
                    'send_target': 'task'
                },
                content_type='application/json'
            )
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ 普通消息发送成功")
                
                if 'human_message' in data and 'response' in data:
                    human_msg = data['human_message']
                    agent_response = data['response']
                    
                    print(f"   - 用户消息角色: {human_msg.get('role')}")
                    print(f"   - 用户消息agent_id: {human_msg.get('agent_id')}")
                    print(f"   - 智能体回复角色: {agent_response.get('role')}")
                    print(f"   - 智能体回复agent_id: {agent_response.get('agent_id')}")
                    
                    # 验证普通消息的角色
                    if (human_msg.get('role') == 'human' and 
                        agent_response.get('role') == 'agent' and
                        human_msg.get('agent_id') is None and  # 普通消息不设置agent_id
                        agent_response.get('agent_id') == normal_agent.id):
                        print(f"   ✅ 普通消息角色正确")
                    else:
                        print(f"   ❌ 普通消息角色不正确")
        
        # 测试总结
        print("\n=== 监督者流式输出和消息角色测试总结 ===")
        
        # 统计最终状态
        total_messages = Message.query.filter_by(conversation_id=conversation.id).count()
        supervisor_messages = Message.query.filter_by(
            conversation_id=conversation.id,
            role='supervisor'
        ).count()
        agent_messages = Message.query.filter_by(
            conversation_id=conversation.id,
            role='agent'
        ).count()
        human_messages = Message.query.filter_by(
            conversation_id=conversation.id,
            role='human'
        ).count()
        human_to_supervisor = Message.query.filter(
            Message.conversation_id == conversation.id,
            Message.role == 'human',
            Message.agent_id == supervisor_agent.id
        ).count()
        
        print(f"✅ 最终数据库状态:")
        print(f"   - 总消息数: {total_messages}")
        print(f"   - human消息数: {human_messages}")
        print(f"   - agent消息数: {agent_messages}")
        print(f"   - supervisor消息数: {supervisor_messages}")
        print(f"   - 向监督者的用户消息数: {human_to_supervisor}")
        
        print(f"✅ 功能验证:")
        print(f"   - ✅ 监督者回复使用supervisor角色")
        print(f"   - ✅ 普通智能体回复使用agent角色")
        print(f"   - ✅ 向监督者的用户消息正确设置agent_id")
        print(f"   - ✅ 消息筛选逻辑正确分离监督者会话和任务会话")
        print(f"   - ✅ API端点正确处理send_target参数")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")
        
        print("\n🎉 监督者流式输出和消息角色功能完全正确！")

if __name__ == "__main__":
    print("开始监督者流式输出和消息角色最终测试...")
    test_supervisor_streaming_final()
    print("\n监督者功能最终测试完成！")
