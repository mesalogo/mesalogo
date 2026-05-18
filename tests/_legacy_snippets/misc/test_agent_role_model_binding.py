#!/usr/bin/env python3
"""
测试智能体和角色的模型绑定关系
"""
import requests
import json
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:5000/api"

def test_agent_role_model_binding():
    """测试智能体和角色的模型绑定关系"""
    print("=== 测试智能体和角色的模型绑定关系 ===\n")
    
    # 1. 获取所有模型配置
    print("1. 获取所有模型配置...")
    response = requests.get(f"{BASE_URL}/model-configs")
    if response.status_code != 200:
        print(f"❌ 获取模型配置失败: {response.status_code}")
        return False
    
    models = response.json()
    print(f"✅ 获取到 {len(models)} 个模型配置")
    
    # 显示模型信息
    for model in models:
        default_flags = []
        if model.get('is_default', False):
            default_flags.append('旧默认')
        if model.get('is_default_text', False):
            default_flags.append('默认文本生成')
        if model.get('is_default_embedding', False):
            default_flags.append('默认嵌入')
        
        flag_str = f" ({', '.join(default_flags)})" if default_flags else ""
        print(f"  - {model['name']} (ID: {model['id']}){flag_str}")
    
    # 2. 获取所有角色
    print(f"\n2. 获取所有角色...")
    response = requests.get(f"{BASE_URL}/roles")
    if response.status_code != 200:
        print(f"❌ 获取角色失败: {response.status_code}")
        return False
    
    roles_data = response.json()
    roles = roles_data.get('roles', [])
    print(f"✅ 获取到 {len(roles)} 个角色")
    
    # 显示角色的模型绑定情况
    print("\n角色的模型绑定情况:")
    for role in roles:
        model_info = "未设置模型（使用默认）"
        if role.get('model') is not None:
            model_id = role['model']
            # 查找对应的模型
            model = next((m for m in models if m['id'] == model_id), None)
            if model:
                model_info = f"绑定模型: {model['name']} (ID: {model_id})"
            else:
                model_info = f"绑定模型ID: {model_id} (模型不存在!)"
        
        print(f"  - 角色 '{role['name']}': {model_info}")
    
    # 3. 获取行动任务列表
    print(f"\n3. 获取行动任务列表...")
    response = requests.get(f"{BASE_URL}/action-tasks")
    if response.status_code != 200:
        print(f"❌ 获取行动任务失败: {response.status_code}")
        return False
    
    tasks = response.json()
    print(f"✅ 获取到 {len(tasks)} 个行动任务")
    
    if not tasks:
        print("⚠️  没有行动任务，无法测试智能体模型绑定")
        return True
    
    # 4. 检查第一个行动任务的智能体
    task = tasks[0]
    print(f"\n4. 检查行动任务 '{task['name']}' 的智能体...")
    
    response = requests.get(f"{BASE_URL}/action-tasks/{task['id']}")
    if response.status_code != 200:
        print(f"❌ 获取行动任务详情失败: {response.status_code}")
        return False
    
    task_detail = response.json()
    agents = task_detail.get('agents', [])
    print(f"✅ 任务中有 {len(agents)} 个智能体")
    
    # 显示智能体的角色和模型绑定情况
    print("\n智能体的角色和模型绑定情况:")
    for agent in agents:
        role_id = agent.get('role_id')
        role_name = "未知角色"
        role_model_info = "未知"
        
        if role_id:
            # 查找对应的角色
            role = next((r for r in roles if r['id'] == role_id), None)
            if role:
                role_name = role['name']
                if role.get('model') is not None:
                    model_id = role['model']
                    model = next((m for m in models if m['id'] == model_id), None)
                    if model:
                        role_model_info = f"角色绑定模型: {model['name']} (ID: {model_id})"
                    else:
                        role_model_info = f"角色绑定模型ID: {model_id} (模型不存在!)"
                else:
                    role_model_info = "角色未设置模型（使用默认）"
        
        print(f"  - 智能体 '{agent['name']}' -> 角色 '{role_name}': {role_model_info}")
    
    # 5. 测试消息发送，看实际使用的模型
    if agents:
        test_agent = agents[0]
        print(f"\n5. 测试智能体 '{test_agent['name']}' 的模型使用情况...")
        
        # 发送测试消息
        test_message = "你好，请简单介绍一下你自己。"
        
        try:
            response = requests.post(f"{BASE_URL}/conversations/{task['conversation_id']}/messages", 
                                   json={
                                       "content": test_message,
                                       "target_agent_id": test_agent['id']
                                   })
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 消息发送成功")
                
                # 获取最新的消息来查看响应
                response = requests.get(f"{BASE_URL}/conversations/{task['conversation_id']}/messages")
                if response.status_code == 200:
                    messages = response.json()
                    if messages:
                        latest_message = messages[-1]
                        if latest_message.get('sender_type') == 'agent':
                            print(f"✅ 智能体回复: {latest_message['content'][:100]}...")
                        else:
                            print("⚠️  最新消息不是智能体回复")
                    else:
                        print("⚠️  没有找到消息")
                else:
                    print(f"⚠️  获取消息失败: {response.status_code}")
            else:
                print(f"❌ 消息发送失败: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ 测试消息发送时出错: {e}")
    
    print("\n🎉 智能体和角色模型绑定测试完成")
    return True

if __name__ == "__main__":
    print("开始测试智能体和角色的模型绑定关系...")
    
    try:
        # 测试服务器连接
        response = requests.get(f"{BASE_URL}/model-configs", timeout=5)
        if response.status_code != 200:
            print(f"❌ 无法连接到服务器: {response.status_code}")
            sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"❌ 无法连接到服务器: {e}")
        print("请确保后端服务器正在运行 (python run.py)")
        sys.exit(1)
    
    success = test_agent_role_model_binding()
    
    if success:
        print("\n🎉 测试完成")
    else:
        print("\n❌ 测试失败")
        sys.exit(1)
