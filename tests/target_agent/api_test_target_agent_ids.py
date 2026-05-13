#!/usr/bin/env python3
"""
通过API测试target_agent_ids字段功能

这个脚本通过HTTP API测试target_agent_ids的存储和读取
"""

import requests
import json
import time

BASE_URL = "http://localhost:8080/api"

def test_api_target_agent_ids():
    """通过API测试target_agent_ids功能"""
    print("=== 通过API测试target_agent_ids功能 ===")
    
    try:
        # 1. 获取现有的行动任务
        print("\n1. 获取行动任务列表...")
        response = requests.get(f"{BASE_URL}/action-tasks")
        if response.status_code == 200:
            tasks = response.json().get('action_tasks', [])
            if tasks:
                task = tasks[0]  # 使用第一个任务
                task_id = task['id']
                print(f"✅ 找到行动任务: {task['title']} (ID: {task_id})")
            else:
                print("❌ 没有找到行动任务")
                return
        else:
            print(f"❌ 获取行动任务失败: {response.status_code}")
            return
        
        # 2. 获取任务的会话
        print(f"\n2. 获取任务 {task_id} 的会话...")
        response = requests.get(f"{BASE_URL}/action-tasks/{task_id}/conversations")
        if response.status_code == 200:
            conversations = response.json().get('conversations', [])
            if conversations:
                conversation = conversations[0]  # 使用第一个会话
                conversation_id = conversation['id']
                print(f"✅ 找到会话: {conversation['title']} (ID: {conversation_id})")
            else:
                print("❌ 没有找到会话")
                return
        else:
            print(f"❌ 获取会话失败: {response.status_code}")
            return
        
        # 3. 获取任务的智能体
        print(f"\n3. 获取任务 {task_id} 的智能体...")
        response = requests.get(f"{BASE_URL}/action-tasks/{task_id}")
        if response.status_code == 200:
            task_detail = response.json()
            agents = task_detail.get('agents', [])
            if len(agents) >= 2:
                agent1 = agents[0]
                agent2 = agents[1]
                print(f"✅ 找到智能体: {agent1['name']} (ID: {agent1['id']}) 和 {agent2['name']} (ID: {agent2['id']})")
            else:
                print("❌ 需要至少2个智能体进行测试")
                return
        else:
            print(f"❌ 获取任务详情失败: {response.status_code}")
            return
        
        # 4. 发送包含target_agent_ids的消息
        print(f"\n4. 发送包含target_agent_ids的消息...")
        
        # 测试单个目标智能体
        message_data = {
            "content": "测试消息：发送给单个智能体",
            "target_agent_ids": [agent1['id']]
        }
        
        response = requests.post(
            f"{BASE_URL}/action-tasks/{task_id}/conversations/{conversation_id}/messages",
            json=message_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"✅ 成功发送消息（单个目标智能体）")
        else:
            print(f"❌ 发送消息失败: {response.status_code} - {response.text}")
        
        # 等待一下
        time.sleep(1)
        
        # 测试多个目标智能体
        message_data = {
            "content": "测试消息：发送给多个智能体",
            "target_agent_ids": [agent1['id'], agent2['id']]
        }
        
        response = requests.post(
            f"{BASE_URL}/action-tasks/{task_id}/conversations/{conversation_id}/messages",
            json=message_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"✅ 成功发送消息（多个目标智能体）")
        else:
            print(f"❌ 发送消息失败: {response.status_code} - {response.text}")
        
        # 等待一下
        time.sleep(1)
        
        # 测试无目标智能体（发送给所有智能体）
        message_data = {
            "content": "测试消息：发送给所有智能体"
        }
        
        response = requests.post(
            f"{BASE_URL}/action-tasks/{task_id}/conversations/{conversation_id}/messages",
            json=message_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"✅ 成功发送消息（所有智能体）")
        else:
            print(f"❌ 发送消息失败: {response.status_code} - {response.text}")
        
        # 5. 获取会话消息并验证target_agent_ids
        print(f"\n5. 获取会话消息并验证target_agent_ids...")
        
        response = requests.get(f"{BASE_URL}/action-tasks/{task_id}/conversations/{conversation_id}/messages")
        if response.status_code == 200:
            messages = response.json().get('messages', [])
            print(f"✅ 成功获取会话消息，共 {len(messages)} 条")
            
            # 查找我们刚才发送的测试消息
            test_messages = [msg for msg in messages if msg.get('content', '').startswith('测试消息：')]
            
            for i, msg in enumerate(test_messages[-3:]):  # 只看最后3条测试消息
                print(f"\n   测试消息 {i+1}:")
                print(f"   - ID: {msg['id']}")
                print(f"   - 内容: {msg['content']}")
                print(f"   - target_agent_ids: {msg.get('target_agent_ids', 'None')}")
                
                # 验证target_agent_ids
                if "单个智能体" in msg['content']:
                    expected = [agent1['id']]
                    actual = msg.get('target_agent_ids')
                    if actual == expected:
                        print(f"   ✅ target_agent_ids正确: {actual}")
                    else:
                        print(f"   ❌ target_agent_ids错误，期望: {expected}, 实际: {actual}")
                        
                elif "多个智能体" in msg['content']:
                    expected = [agent1['id'], agent2['id']]
                    actual = msg.get('target_agent_ids')
                    if actual and set(actual) == set(expected):
                        print(f"   ✅ target_agent_ids正确: {actual}")
                    else:
                        print(f"   ❌ target_agent_ids错误，期望: {expected}, 实际: {actual}")
                        
                elif "所有智能体" in msg['content']:
                    actual = msg.get('target_agent_ids')
                    if actual is None:
                        print(f"   ✅ target_agent_ids正确为None（发送给所有智能体）")
                    else:
                        print(f"   ❌ target_agent_ids应为None，实际: {actual}")
        else:
            print(f"❌ 获取会话消息失败: {response.status_code}")
        
        print("\n✅ API测试完成")
        
    except Exception as e:
        print(f"❌ API测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("开始API测试target_agent_ids字段功能...")
    test_api_target_agent_ids()
    print("\n测试完成！")
