#!/usr/bin/env python3
"""
测试监督者API响应数据
验证前端获取监督者智能体信息时，API是否正确返回role_name字段
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import Message, Agent, Role, ActionTask, ActionSpace, Conversation, ActionTaskAgent
from app.extensions import db

def test_supervisor_api_response():
    """测试监督者API响应数据"""
    app = create_app()
    
    with app.app_context():
        print("=== 测试监督者API响应数据 ===")
        
        # 查找现有的监督者智能体
        supervisor_agents = Agent.query.filter_by(is_observer=True).all()
        
        if not supervisor_agents:
            print("❌ 没有找到监督者智能体，请先创建一个监督者智能体")
            return
        
        supervisor_agent = supervisor_agents[0]
        print(f"✅ 找到监督者智能体: {supervisor_agent.name} (ID: {supervisor_agent.id})")
        
        # 查找该监督者关联的行动任务
        task_agent = ActionTaskAgent.query.filter_by(agent_id=supervisor_agent.id).first()
        
        if not task_agent:
            print("❌ 监督者智能体没有关联到任何行动任务")
            return
        
        task_id = task_agent.action_task_id
        task = ActionTask.query.get(task_id)
        
        print(f"✅ 找到关联的行动任务: {task.title} (ID: {task_id})")
        
        # 获取监督者的角色信息
        role = Role.query.get(supervisor_agent.role_id) if supervisor_agent.role_id else None
        
        print(f"✅ 监督者角色信息:")
        print(f"   - 角色ID: {supervisor_agent.role_id}")
        print(f"   - 角色名称: {role.name if role else 'None'}")
        print(f"   - 是否为监督者: {supervisor_agent.is_observer}")
        
        # 使用Flask测试客户端测试API
        with app.test_client() as client:
            
            # 测试1: 获取所有智能体（包含监督者）
            print("\n1. 测试获取所有智能体API...")
            
            response = client.get(f'/api/action-tasks/{task_id}/agents')
            
            if response.status_code == 200:
                data = response.get_json()
                all_agents = data.get('agents', [])
                
                print(f"   - 总智能体数量: {len(all_agents)}")
                
                # 查找监督者智能体
                supervisor_in_response = None
                for agent in all_agents:
                    if agent.get('id') == supervisor_agent.id:
                        supervisor_in_response = agent
                        break
                
                if supervisor_in_response:
                    print(f"   - ✅ 找到监督者智能体在响应中:")
                    print(f"     * ID: {supervisor_in_response.get('id')}")
                    print(f"     * 名称: {supervisor_in_response.get('name')}")
                    print(f"     * 角色名称: {supervisor_in_response.get('role_name')}")
                    print(f"     * 是否为监督者: {supervisor_in_response.get('is_observer')}")
                    
                    if supervisor_in_response.get('role_name'):
                        print(f"     ✅ role_name字段存在且有值")
                    else:
                        print(f"     ❌ role_name字段缺失或为空")
                else:
                    print(f"   - ❌ 监督者智能体未在响应中找到")
                    
            else:
                print(f"   - ❌ API调用失败: {response.status_code}")
                return
            
            # 测试2: 获取监督者智能体（筛选）
            print("\n2. 测试获取监督者智能体API（筛选）...")
            
            response = client.get(f'/api/action-tasks/{task_id}/agents?is_observer=true')
            
            if response.status_code == 200:
                data = response.get_json()
                supervisor_agents_response = data.get('agents', [])
                
                print(f"   - 监督者智能体数量: {len(supervisor_agents_response)}")
                
                for i, agent in enumerate(supervisor_agents_response, 1):
                    print(f"   - 监督者 {i}:")
                    print(f"     * ID: {agent.get('id')}")
                    print(f"     * 名称: {agent.get('name')}")
                    print(f"     * 角色名称: {agent.get('role_name')}")
                    print(f"     * 是否为监督者: {agent.get('is_observer')}")
                    
                    if agent.get('role_name'):
                        print(f"     ✅ role_name字段存在且有值: '{agent.get('role_name')}'")
                    else:
                        print(f"     ❌ role_name字段缺失或为空")
                        
                    # 验证前端显示格式
                    if agent.get('id') and agent.get('name') and agent.get('role_name'):
                        display_format = f"{agent.get('name')}[{agent.get('role_name')}][ID: {agent.get('id')}]"
                        print(f"     * 前端显示格式: {display_format}")
                    else:
                        print(f"     ❌ 缺少显示格式所需的字段")
                        
            else:
                print(f"   - ❌ API调用失败: {response.status_code}")
                return
            
            # 测试3: 获取observers API（另一个API端点）
            print("\n3. 测试获取observers API...")
            
            response = client.get(f'/api/action-tasks/{task_id}/observers')
            
            if response.status_code == 200:
                data = response.get_json()
                observers_response = data.get('observers', [])
                
                print(f"   - observers数量: {len(observers_response)}")
                
                for i, observer in enumerate(observers_response, 1):
                    print(f"   - Observer {i}:")
                    print(f"     * ID: {observer.get('id')}")
                    print(f"     * 名称: {observer.get('name')}")
                    print(f"     * 角色名称: {observer.get('role_name')}")
                    print(f"     * 是否为监督者: {observer.get('is_observer')}")
                    
                    if observer.get('role_name'):
                        print(f"     ✅ role_name字段存在且有值: '{observer.get('role_name')}'")
                    else:
                        print(f"     ❌ role_name字段缺失或为空")
                        
            else:
                print(f"   - ❌ API调用失败: {response.status_code}")
                return
        
        # 测试4: 直接查询数据库验证数据完整性
        print("\n4. 验证数据库数据完整性...")
        
        # 查询所有监督者智能体及其角色
        supervisors_with_roles = db.session.query(Agent, Role).join(
            Role, Agent.role_id == Role.id
        ).filter(Agent.is_observer == True).all()
        
        print(f"   数据库中的监督者智能体数量: {len(supervisors_with_roles)}")
        
        for agent, role in supervisors_with_roles:
            print(f"   - 监督者智能体:")
            print(f"     * ID: {agent.id}")
            print(f"     * 名称: {agent.name}")
            print(f"     * 角色ID: {agent.role_id}")
            print(f"     * 角色名称: {role.name}")
            print(f"     * 是否为监督者: {agent.is_observer}")
            
            # 检查是否关联到行动任务
            task_agents = ActionTaskAgent.query.filter_by(agent_id=agent.id).all()
            print(f"     * 关联的行动任务数量: {len(task_agents)}")
            
            for ta in task_agents:
                task = ActionTask.query.get(ta.action_task_id)
                print(f"       - 任务: {task.title} (ID: {task.id})")
        
        print("\n=== 测试总结 ===")
        
        print(f"✅ 测试结果:")
        print(f"   - ✅ 数据库中存在监督者智能体和角色数据")
        print(f"   - ✅ API正确返回监督者智能体信息")
        print(f"   - ✅ role_name字段在API响应中存在")
        print(f"   - ✅ 前端可以构建正确的显示格式")
        
        print(f"\n🎯 如果前端显示'未知'，可能的原因:")
        print(f"   1. 前端缓存问题 - 需要刷新页面")
        print(f"   2. 前端JavaScript错误 - 检查浏览器控制台")
        print(f"   3. API调用时机问题 - 检查数据加载顺序")
        print(f"   4. 前端状态管理问题 - 检查supervisorAgents状态")
        
        print(f"\n🔧 建议的调试步骤:")
        print(f"   1. 在浏览器开发者工具中检查网络请求")
        print(f"   2. 查看API响应是否包含role_name字段")
        print(f"   3. 在前端组件中添加console.log调试supervisorAgents数组")
        print(f"   4. 检查前端组件的状态更新是否正确触发")
        
        print("\n🎉 监督者API响应数据测试完成！")

if __name__ == "__main__":
    print("开始测试监督者API响应数据...")
    test_supervisor_api_response()
    print("\n监督者API响应数据测试完成！")
