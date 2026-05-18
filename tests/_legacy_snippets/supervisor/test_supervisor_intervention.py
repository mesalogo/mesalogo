#!/usr/bin/env python3
"""
测试监督者干预机制

测试功能：
1. 发送监督者干预消息
2. 验证消息的source和meta字段设置
3. 验证前端消息筛选逻辑
4. 验证监督者响应的meta字段
"""

import requests
import json
import time
import sys
import os
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 配置
BASE_URL = "http://localhost:8080"
TASK_ID = 1
CONVERSATION_ID = 1
SUPERVISOR_AGENT_ID = 13  # 假设这是一个监督者智能体

def test_supervisor_intervention():
    """测试监督者干预机制"""
    print("=== 测试监督者干预机制 ===\n")

    # 首先检查是否有监督者智能体
    print("0. 检查监督者智能体...")
    try:
        response = requests.get(f"{BASE_URL}/api/action-tasks/{TASK_ID}/agents")
        if response.status_code == 200:
            agents = response.json().get('agents', [])
            supervisors = [agent for agent in agents if agent.get('is_observer')]
            if not supervisors:
                print("❌ 任务中没有监督者智能体，跳过测试")
                return False

            global SUPERVISOR_AGENT_ID
            SUPERVISOR_AGENT_ID = supervisors[0]['id']
            print(f"✅ 找到监督者智能体: {supervisors[0]['name']} (ID: {SUPERVISOR_AGENT_ID})")
        else:
            print(f"❌ 获取智能体列表失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 检查监督者智能体失败: {str(e)}")
        return False

    # 1. 发送监督者干预消息
    print("\n1. 发送监督者干预消息...")
    intervention_data = {
        "content": f"监督者干预测试消息 - {datetime.now().strftime('%H:%M:%S')}",
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
            print(f"   用户消息ID: {result.get('human_message', {}).get('id')}")
            print(f"   监督者回复ID: {result.get('response', {}).get('id')}")
            
            # 检查用户消息的字段
            human_msg = result.get('human_message', {})
            print(f"   用户消息source: {human_msg.get('source')}")
            print(f"   用户消息meta: {human_msg.get('meta')}")
            
            # 检查监督者回复的字段
            supervisor_response = result.get('response', {})
            print(f"   监督者回复role: {supervisor_response.get('role')}")
            
        else:
            print(f"❌ 发送失败: {response.status_code}")
            print(f"   错误信息: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 发送请求失败: {str(e)}")
        return False
    
    # 2. 获取所有消息并验证筛选逻辑
    print("\n2. 验证消息筛选逻辑...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/action-tasks/{TASK_ID}/conversations/{CONVERSATION_ID}/messages"
        )
        
        if response.status_code == 200:
            all_messages = response.json().get('messages', [])
            print(f"✅ 获取到 {len(all_messages)} 条消息")
            
            # 筛选任务消息（包含干预消息）
            task_messages = []
            supervisor_messages = []

            for msg in all_messages:
                # 任务消息筛选逻辑（简化版）
                if (msg.get('source') == 'taskConversation' or
                    not msg.get('source') or
                    (msg.get('source') == 'supervisorConversation' and
                     msg.get('meta', {}).get('type'))):
                    task_messages.append(msg)

                # 监督者消息筛选逻辑
                if msg.get('source') == 'supervisorConversation':
                    supervisor_messages.append(msg)
            
            print(f"   任务消息数量: {len(task_messages)}")
            print(f"   监督者消息数量: {len(supervisor_messages)}")
            
            # 查找干预消息（简化版）
            intervention_messages = [
                msg for msg in all_messages
                if msg.get('source') == 'supervisorConversation' and msg.get('meta', {}).get('type')
            ]

            print(f"   干预消息数量: {len(intervention_messages)}")

            if intervention_messages:
                print("   干预消息详情:")
                for msg in intervention_messages:
                    print(f"     - ID: {msg.get('id')}, Role: {msg.get('role')}")
                    print(f"       Source: {msg.get('source')}")
                    print(f"       Meta: {msg.get('meta')}")
                    print(f"       Content: {msg.get('content')[:50]}...")
            
        else:
            print(f"❌ 获取消息失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 获取消息失败: {str(e)}")
        return False
    
    # 3. 发送普通监督者消息进行对比
    print("\n3. 发送普通监督者消息进行对比...")
    normal_data = {
        "content": "这是一个普通监督者消息，只在监督会话中显示",
        "target_agent_id": SUPERVISOR_AGENT_ID,
        "send_target": "supervisor"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/action-tasks/{TASK_ID}/conversations/{CONVERSATION_ID}/messages",
            json=normal_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 普通监督者消息发送成功")
            
            # 检查用户消息的字段
            human_msg = result.get('human_message', {})
            print(f"   用户消息source: {human_msg.get('source')}")
            print(f"   用户消息meta: {human_msg.get('meta')}")
            
        else:
            print(f"❌ 发送失败: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 发送请求失败: {str(e)}")
    
    print("\n=== 测试完成 ===")
    return True

def test_message_filtering():
    """测试前端消息筛选逻辑"""
    print("\n=== 测试前端消息筛选逻辑 ===")
    
    # 模拟消息数据
    mock_messages = [
        {
            "id": 1,
            "content": "普通任务消息",
            "role": "human",
            "source": "taskConversation",
            "meta": {}
        },
        {
            "id": 2,
            "content": "普通智能体回复",
            "role": "agent",
            "source": "taskConversation",
            "meta": {}
        },
        {
            "id": 3,
            "content": "监督者干预用户消息",
            "role": "human",
            "source": "supervisorConversation",
            "meta": {
                "intervention": {
                    "type": "info",
                    "display_in_task": True,
                    "source_ui": "supervisor"
                }
            }
        },
        {
            "id": 4,
            "content": "监督者干预回复",
            "role": "supervisor",
            "source": "supervisorConversation",
            "meta": {
                "intervention": {
                    "type": "info",
                    "display_in_task": True,
                    "source_ui": "supervisor"
                }
            }
        },
        {
            "id": 5,
            "content": "普通监督者消息",
            "role": "human",
            "source": "supervisorConversation",
            "meta": {}
        },
        {
            "id": 6,
            "content": "普通监督者回复",
            "role": "supervisor",
            "source": "supervisorConversation",
            "meta": {}
        }
    ]
    
    # 任务消息筛选逻辑
    task_messages = []
    for msg in mock_messages:
        if (msg.get('source') == 'taskConversation' or 
            not msg.get('source') or
            (msg.get('source') == 'supervisorConversation' and 
             msg.get('meta', {}).get('intervention', {}).get('display_in_task') == True)):
            task_messages.append(msg)
    
    # 监督者消息筛选逻辑
    supervisor_messages = []
    for msg in mock_messages:
        if msg.get('source') == 'supervisorConversation':
            supervisor_messages.append(msg)
    
    print(f"总消息数: {len(mock_messages)}")
    print(f"任务消息数: {len(task_messages)}")
    print(f"监督者消息数: {len(supervisor_messages)}")
    
    print("\n任务消息列表:")
    for msg in task_messages:
        print(f"  - ID: {msg['id']}, Role: {msg['role']}, Content: {msg['content']}")
    
    print("\n监督者消息列表:")
    for msg in supervisor_messages:
        print(f"  - ID: {msg['id']}, Role: {msg['role']}, Content: {msg['content']}")
    
    # 验证筛选结果
    expected_task_ids = [1, 2, 3, 4]  # 包含干预消息
    expected_supervisor_ids = [3, 4, 5, 6]  # 所有监督者相关消息
    
    actual_task_ids = [msg['id'] for msg in task_messages]
    actual_supervisor_ids = [msg['id'] for msg in supervisor_messages]
    
    if actual_task_ids == expected_task_ids:
        print("✅ 任务消息筛选逻辑正确")
    else:
        print(f"❌ 任务消息筛选逻辑错误: 期望 {expected_task_ids}, 实际 {actual_task_ids}")
    
    if actual_supervisor_ids == expected_supervisor_ids:
        print("✅ 监督者消息筛选逻辑正确")
    else:
        print(f"❌ 监督者消息筛选逻辑错误: 期望 {expected_supervisor_ids}, 实际 {actual_supervisor_ids}")

if __name__ == "__main__":
    # 测试前端筛选逻辑
    test_message_filtering()
    
    # 测试实际API
    test_supervisor_intervention()
