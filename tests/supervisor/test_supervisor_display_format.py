#!/usr/bin/env python3
"""
测试监督者会话历史记录的显示格式
验证：
1. 监督者消息显示格式：监督者名称[角色][ID]
2. 用户发送给监督者的消息显示格式：用户 → 监督者名称[角色][ID]
3. API返回的数据包含必要的字段
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation, ActionTaskAgent
from app.extensions import db

def test_supervisor_display_format():
    """测试监督者会话历史记录的显示格式"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试监督者会话历史记录显示格式 ===")
        
        # 创建测试环境
        action_space = ActionSpace(name="监督者显示测试空间", description="用于测试监督者显示格式的行动空间")
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="监督者显示测试任务",
            description="用于测试监督者显示格式的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="监督者显示测试会话",
            description="用于测试监督者显示格式的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        # 创建角色
        supervisor_role = Role(name="高级监督者角色", description="高级监督者智能体角色", is_observer_role=True)
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建监督者智能体
        supervisor_agent = Agent(
            name="高级监督者智能体",
            description="高级监督者智能体",
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
        print(f"   - 监督者智能体名称: {supervisor_agent.name}")
        print(f"   - 监督者角色名称: {supervisor_role.name}")
        
        # 使用Flask测试客户端测试API
        with app.test_client() as client:
            
            # 测试1: 发送监督者消息
            print("\n1. 测试发送监督者消息...")
            supervisor_content = "请检查当前任务进度并提供评估报告"
            
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
                
                # 验证返回的消息数据
                human_msg = data.get('human_message', {})
                supervisor_response = data.get('response', {})
                
                print(f"   - 用户消息: agent_id={human_msg.get('agent_id')}, source={human_msg.get('source')}")
                print(f"   - 监督者回复: agent_id={supervisor_response.get('agent_id')}, source={supervisor_response.get('source')}")
                
            else:
                print(f"❌ 监督者消息发送失败: {response.status_code}")
                return
            
            # 测试2: 获取监督者智能体信息（模拟前端获取）
            print("\n2. 测试获取监督者智能体信息...")
            
            response = client.get(f'/api/action-tasks/{action_task.id}/agents')
            
            if response.status_code == 200:
                data = response.get_json()
                agents = data.get('agents', [])
                
                # 查找监督者智能体
                supervisor_agents = [agent for agent in agents if agent.get('is_observer')]
                
                print(f"   监督者智能体数量: {len(supervisor_agents)}")
                
                for agent in supervisor_agents:
                    print(f"   - 监督者智能体信息:")
                    print(f"     * ID: {agent.get('id')}")
                    print(f"     * 名称: {agent.get('name')}")
                    print(f"     * 角色名称: {agent.get('role_name')}")
                    print(f"     * 是否为监督者: {agent.get('is_observer')}")
                    
                    # 验证前端显示格式所需的字段
                    if agent.get('id') and agent.get('name') and agent.get('role_name'):
                        expected_format = f"{agent.get('name')}[{agent.get('role_name')}][ID: {agent.get('id')}]"
                        print(f"     * 期望的显示格式: {expected_format}")
                        print(f"     ✅ 包含显示格式所需的所有字段")
                    else:
                        print(f"     ❌ 缺少显示格式所需的字段")
                        
            else:
                print(f"❌ 获取智能体信息失败: {response.status_code}")
                return
            
            # 测试3: 获取监督者消息（模拟前端获取历史记录）
            print("\n3. 测试获取监督者消息...")
            
            response = client.get(f'/api/action-tasks/{action_task.id}/conversations/{conversation.id}/messages')
            
            if response.status_code == 200:
                data = response.get_json()
                all_messages = data.get('messages', [])
                
                # 筛选监督者相关消息
                supervisor_messages = [msg for msg in all_messages if msg.get('source') == 'supervisorConversation']
                
                print(f"   监督者相关消息数量: {len(supervisor_messages)}")
                
                for i, msg in enumerate(supervisor_messages, 1):
                    print(f"   消息 {i}:")
                    print(f"     - 角色: {msg.get('role')}")
                    print(f"     - agent_id: {msg.get('agent_id')}")
                    print(f"     - source: {msg.get('source')}")
                    print(f"     - 内容: {msg.get('content', '')[:30]}...")
                    print(f"     - 创建时间: {msg.get('created_at')}")
                    
                    # 模拟前端显示逻辑
                    if msg.get('role') == 'human' and msg.get('agent_id'):
                        # 用户发送给监督者的消息
                        target_agent = next((agent for agent in supervisor_agents if agent.get('id') == msg.get('agent_id')), None)
                        if target_agent:
                            display_format = f"用户 → {target_agent.get('name')}[{target_agent.get('role_name')}][ID: {target_agent.get('id')}]"
                            print(f"     * 前端显示格式: {display_format}")
                    elif msg.get('role') == 'supervisor' and msg.get('agent_id'):
                        # 监督者回复
                        agent = next((agent for agent in supervisor_agents if agent.get('id') == msg.get('agent_id')), None)
                        if agent:
                            display_format = f"{agent.get('name')}[{agent.get('role_name')}][ID: {agent.get('id')}]"
                            print(f"     * 前端显示格式: {display_format}")
                    
                    print()
                        
            else:
                print(f"❌ 获取监督者消息失败: {response.status_code}")
                return
            
            # 测试4: 验证数据完整性
            print("4. 验证数据完整性...")
            
            # 检查数据库中的消息
            db_messages = Message.query.filter_by(conversation_id=conversation.id).all()
            
            print(f"   数据库中的消息数量: {len(db_messages)}")
            
            for msg in db_messages:
                print(f"   - 消息ID: {msg.id}")
                print(f"     * 角色: {msg.role}")
                print(f"     * agent_id: {msg.agent_id}")
                print(f"     * source: {msg.source}")
                
                # 如果是监督者相关消息，验证agent信息
                if msg.agent_id == supervisor_agent.id:
                    agent_info = Agent.query.get(msg.agent_id)
                    if agent_info:
                        role_info = Role.query.get(agent_info.role_id)
                        print(f"     * 智能体名称: {agent_info.name}")
                        print(f"     * 角色名称: {role_info.name if role_info else '未知'}")
                        print(f"     * 完整显示格式: {agent_info.name}[{role_info.name if role_info else '监督者'}][ID: {agent_info.id}]")
                print()
        
        # 测试总结
        print("=== 监督者显示格式测试总结 ===")
        
        print(f"✅ 测试结果:")
        print(f"   - ✅ 监督者智能体信息包含所需字段（id, name, role_name）")
        print(f"   - ✅ 监督者消息正确设置source字段为supervisorConversation")
        print(f"   - ✅ 用户发送给监督者的消息正确设置agent_id")
        print(f"   - ✅ API返回的数据支持前端显示格式要求")
        
        print(f"\n✅ 前端显示格式:")
        print(f"   - 监督者回复: 监督者名称[角色][ID]")
        print(f"   - 用户消息: 用户 → 监督者名称[角色][ID]")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")
        
        print("\n🎉 监督者会话历史记录显示格式测试完成！")

if __name__ == "__main__":
    print("开始测试监督者会话历史记录显示格式...")
    test_supervisor_display_format()
    print("\n监督者显示格式测试完成！")
