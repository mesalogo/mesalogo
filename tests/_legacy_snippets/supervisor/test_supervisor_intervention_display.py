#!/usr/bin/env python3
"""
测试监督者干预消息在任务会话中的显示
"""

import requests
import json

BASE_URL = "http://localhost:8080"
TASK_ID = 9  # 使用任务9
CONVERSATION_ID = 29  # 使用会话29
SUPERVISOR_AGENT_ID = 13  # 监督者智能体ID

def test_supervisor_intervention_display():
    """测试监督者干预消息的显示逻辑"""
    print("=== 测试监督者干预消息显示 ===\n")
    
    # 1. 发送监督者干预消息
    print("1. 发送监督者干预消息...")
    intervention_data = {
        "content": "这是一个监督者干预测试消息，应该在任务会话中显示",
        "target_agent_id": SUPERVISOR_AGENT_ID,
        "send_target": "task_intervention"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/action-tasks/{TASK_ID}/conversations/{CONVERSATION_ID}/messages",
            json=intervention_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 监督者干预消息发送成功")
            
            # 检查用户消息的字段
            human_msg = result.get('human_message', {})
            print(f"   用户消息ID: {human_msg.get('id')}")
            print(f"   用户消息source: {human_msg.get('source')}")
            print(f"   用户消息meta: {human_msg.get('meta')}")
            print(f"   用户消息agent_id: {human_msg.get('agent_id')}")
            
            # 检查监督者回复的字段
            supervisor_response = result.get('response', {})
            print(f"   监督者回复ID: {supervisor_response.get('id')}")
            print(f"   监督者回复role: {supervisor_response.get('role')}")
            
        else:
            print(f"❌ 发送失败: {response.status_code}")
            print(f"   错误信息: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 发送请求失败: {str(e)}")
        return False
    
    # 2. 获取所有消息并测试筛选逻辑
    print("\n2. 获取所有消息并测试筛选逻辑...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/action-tasks/{TASK_ID}/conversations/{CONVERSATION_ID}/messages")
        
        if response.status_code == 200:
            all_messages = response.json().get('messages', [])
            print(f"✅ 获取到 {len(all_messages)} 条消息")
            
            # 应用前端的任务消息筛选逻辑
            task_messages = []
            supervisor_messages = []
            intervention_messages = []
            
            for msg in all_messages:
                # 任务消息筛选逻辑（与前端保持一致）
                if (msg.get('source') == 'taskConversation' or 
                    not msg.get('source') or
                    (msg.get('source') == 'supervisorConversation' and 
                     msg.get('meta', {}).get('intervention', {}).get('display_in_task') == True)):
                    task_messages.append(msg)
                
                # 监督者消息筛选逻辑
                if msg.get('source') == 'supervisorConversation':
                    supervisor_messages.append(msg)
                
                # 干预消息筛选
                if msg.get('meta', {}).get('intervention', {}).get('display_in_task') == True:
                    intervention_messages.append(msg)
            
            print(f"   任务消息数量: {len(task_messages)}")
            print(f"   监督者消息数量: {len(supervisor_messages)}")
            print(f"   干预消息数量: {len(intervention_messages)}")
            
            # 显示最近的几条干预消息
            if intervention_messages:
                print("\n   最近的干预消息:")
                for msg in intervention_messages[-3:]:  # 显示最近3条
                    print(f"     - ID: {msg.get('id')}, Role: {msg.get('role')}")
                    print(f"       Source: {msg.get('source')}")
                    print(f"       Meta: {msg.get('meta')}")
                    print(f"       Content: {msg.get('content')[:50]}...")
                    print()
            
            # 显示最近的几条任务消息
            if task_messages:
                print("   最近的任务消息:")
                for msg in task_messages[-5:]:  # 显示最近5条
                    print(f"     - ID: {msg.get('id')}, Role: {msg.get('role')}")
                    print(f"       Source: {msg.get('source', 'None')}")
                    if msg.get('meta'):
                        print(f"       Meta: {msg.get('meta')}")
                    print(f"       Content: {msg.get('content')[:50]}...")
                    print()
            
            # 验证干预消息是否正确包含在任务消息中
            intervention_in_task = 0
            for msg in intervention_messages:
                if msg in task_messages:
                    intervention_in_task += 1
            
            print(f"   干预消息中包含在任务消息的数量: {intervention_in_task}/{len(intervention_messages)}")
            
            if intervention_in_task == len(intervention_messages):
                print("   ✅ 所有干预消息都正确包含在任务消息中")
            else:
                print("   ❌ 部分干预消息未包含在任务消息中")
            
        else:
            print(f"❌ 获取消息失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 获取消息失败: {str(e)}")
        return False
    
    print("\n=== 测试完成 ===")
    return True

if __name__ == "__main__":
    test_supervisor_intervention_display()
