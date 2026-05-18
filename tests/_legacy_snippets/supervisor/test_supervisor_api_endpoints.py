#!/usr/bin/env python3
"""
测试脚本：验证监督者相关的API端点
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation, ActionTaskAgent
from app.extensions import db
import requests
import json

def test_supervisor_api_endpoints():
    """测试监督者相关的API端点"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试监督者相关的API端点 ===")
        
        # 创建测试数据
        action_space = ActionSpace(name="API测试空间", description="用于API测试的行动空间")
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="API测试任务",
            description="用于API测试的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        # 创建角色
        normal_role = Role(name="API测试普通角色", description="普通智能体角色")
        supervisor_role = Role(name="API测试监督者角色", description="监督者智能体角色", is_observer_role=True)
        db.session.add(normal_role)
        db.session.add(supervisor_role)
        db.session.flush()
        
        # 创建智能体
        normal_agent1 = Agent(
            name="API测试普通智能体1",
            description="普通智能体1",
            role_id=normal_role.id,
            action_task_id=action_task.id,
            is_observer=False
        )
        normal_agent2 = Agent(
            name="API测试普通智能体2",
            description="普通智能体2",
            role_id=normal_role.id,
            action_task_id=action_task.id,
            is_observer=False
        )
        supervisor_agent1 = Agent(
            name="API测试监督者智能体1",
            description="监督者智能体1",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        supervisor_agent2 = Agent(
            name="API测试监督者智能体2",
            description="监督者智能体2",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        
        db.session.add(normal_agent1)
        db.session.add(normal_agent2)
        db.session.add(supervisor_agent1)
        db.session.add(supervisor_agent2)
        db.session.flush()
        
        # 创建ActionTaskAgent关联
        task_agents = [
            ActionTaskAgent(action_task_id=action_task.id, agent_id=normal_agent1.id, is_default=True),
            ActionTaskAgent(action_task_id=action_task.id, agent_id=normal_agent2.id, is_default=False),
            ActionTaskAgent(action_task_id=action_task.id, agent_id=supervisor_agent1.id, is_default=False),
            ActionTaskAgent(action_task_id=action_task.id, agent_id=supervisor_agent2.id, is_default=False)
        ]
        
        for ta in task_agents:
            db.session.add(ta)
        db.session.flush()
        
        print(f"✅ 创建测试数据成功")
        print(f"   - 行动任务ID: {action_task.id}")
        print(f"   - 普通智能体: {normal_agent1.id}, {normal_agent2.id}")
        print(f"   - 监督者智能体: {supervisor_agent1.id}, {supervisor_agent2.id}")
        
        # 启动Flask测试服务器
        with app.test_client() as client:
            
            # 测试1: 获取所有智能体
            print("\n1. 测试获取所有智能体...")
            response = client.get(f'/api/action-tasks/{action_task.id}/agents')
            
            if response.status_code == 200:
                data = response.get_json()
                agents = data.get('agents', [])
                print(f"✅ 获取所有智能体成功，共{len(agents)}个")
                
                normal_count = sum(1 for agent in agents if not agent.get('is_observer', False))
                supervisor_count = sum(1 for agent in agents if agent.get('is_observer', False))
                
                print(f"   - 普通智能体: {normal_count}个")
                print(f"   - 监督者智能体: {supervisor_count}个")
                
                # 验证每个智能体的信息
                for agent in agents:
                    agent_type = "监督者" if agent.get('is_observer') else "普通智能体"
                    print(f"   - {agent_type}: {agent['name']} (ID: {agent['id']}, 角色: {agent.get('role_name', 'N/A')})")
                
            else:
                print(f"❌ 获取所有智能体失败: {response.status_code}")
                print(f"   响应: {response.get_data(as_text=True)}")
            
            # 测试2: 只获取监督者智能体
            print("\n2. 测试只获取监督者智能体...")
            response = client.get(f'/api/action-tasks/{action_task.id}/agents?is_observer=true')
            
            if response.status_code == 200:
                data = response.get_json()
                supervisors = data.get('agents', [])
                print(f"✅ 获取监督者智能体成功，共{len(supervisors)}个")
                
                # 验证所有返回的都是监督者
                all_supervisors = all(agent.get('is_observer', False) for agent in supervisors)
                if all_supervisors:
                    print(f"✅ 所有返回的智能体都是监督者")
                    for supervisor in supervisors:
                        print(f"   - 监督者: {supervisor['name']} (ID: {supervisor['id']}, 角色: {supervisor.get('role_name', 'N/A')})")
                else:
                    print(f"❌ 返回的智能体中包含非监督者")
                
            else:
                print(f"❌ 获取监督者智能体失败: {response.status_code}")
                print(f"   响应: {response.get_data(as_text=True)}")
            
            # 测试3: 只获取普通智能体
            print("\n3. 测试只获取普通智能体...")
            response = client.get(f'/api/action-tasks/{action_task.id}/agents?is_observer=false')
            
            if response.status_code == 200:
                data = response.get_json()
                normal_agents = data.get('agents', [])
                print(f"✅ 获取普通智能体成功，共{len(normal_agents)}个")
                
                # 验证所有返回的都是普通智能体
                all_normal = all(not agent.get('is_observer', True) for agent in normal_agents)
                if all_normal:
                    print(f"✅ 所有返回的智能体都是普通智能体")
                    for agent in normal_agents:
                        print(f"   - 普通智能体: {agent['name']} (ID: {agent['id']}, 角色: {agent.get('role_name', 'N/A')})")
                else:
                    print(f"❌ 返回的智能体中包含监督者")
                
            else:
                print(f"❌ 获取普通智能体失败: {response.status_code}")
                print(f"   响应: {response.get_data(as_text=True)}")
            
            # 测试4: 测试无效参数
            print("\n4. 测试无效参数...")
            response = client.get(f'/api/action-tasks/{action_task.id}/agents?is_observer=invalid')
            
            if response.status_code == 200:
                data = response.get_json()
                agents = data.get('agents', [])
                print(f"✅ 无效参数处理正确，返回所有智能体: {len(agents)}个")
            else:
                print(f"❌ 无效参数处理失败: {response.status_code}")
            
            # 测试5: 测试不存在的任务
            print("\n5. 测试不存在的任务...")
            response = client.get('/api/action-tasks/99999/agents')
            
            if response.status_code == 404:
                print(f"✅ 不存在的任务正确返回404")
            else:
                print(f"❌ 不存在的任务处理异常: {response.status_code}")
        
        # 回滚测试数据
        db.session.rollback()
        print("\n✅ 测试完成，已回滚测试数据")

def test_supervisor_message_creation_via_api():
    """测试通过API创建监督者消息"""
    app = create_app()
    
    with app.app_context():
        print("\n=== 测试通过API创建监督者消息 ===")
        
        # 创建测试数据
        action_space = ActionSpace(name="消息API测试空间", description="用于消息API测试的行动空间")
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="消息API测试任务",
            description="用于消息API测试的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="消息API测试会话",
            description="用于消息API测试的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        supervisor_role = Role(
            name="消息API测试监督者角色", 
            description="用于消息API测试的监督者角色",
            is_observer_role=True
        )
        db.session.add(supervisor_role)
        db.session.flush()
        
        supervisor_agent = Agent(
            name="消息API测试监督者智能体",
            description="用于消息API测试的监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        db.session.add(supervisor_agent)
        db.session.flush()
        
        # 直接创建supervisor消息（模拟API调用的结果）
        supervisor_message = Message(
            content="这是通过API创建的监督者消息",
            role='supervisor',
            action_task_id=action_task.id,
            conversation_id=conversation.id,
            agent_id=supervisor_agent.id
        )
        db.session.add(supervisor_message)
        db.session.flush()
        
        print(f"✅ 成功创建监督者消息")
        print(f"   - 消息ID: {supervisor_message.id}")
        print(f"   - 角色: {supervisor_message.role}")
        print(f"   - 内容: {supervisor_message.content}")
        print(f"   - 智能体ID: {supervisor_message.agent_id}")
        print(f"   - 智能体名称: {supervisor_agent.name}")
        print(f"   - 是否为监督者: {supervisor_agent.is_observer}")
        
        # 验证消息查询
        saved_message = Message.query.get(supervisor_message.id)
        if saved_message and saved_message.role == 'supervisor':
            print(f"✅ 监督者消息已正确保存到数据库")
        else:
            print(f"❌ 监督者消息保存验证失败")
        
        # 回滚测试数据
        db.session.rollback()
        print("✅ 消息API测试完成，已回滚测试数据")

if __name__ == "__main__":
    print("开始测试监督者相关的API端点...")
    test_supervisor_api_endpoints()
    test_supervisor_message_creation_via_api()
    print("\n所有API测试完成！")
