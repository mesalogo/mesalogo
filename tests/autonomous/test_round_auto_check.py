#!/usr/bin/env python3
"""
测试轮次自动检查功能
验证智能体回复完成后是否自动触发规则检查
"""

import sys
import os
import requests
import json
import time
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# API基础URL
BASE_URL = 'http://localhost:8080/api'

def test_round_auto_check():
    """测试轮次自动检查功能"""
    
    print("=" * 60)
    print("测试轮次自动检查功能")
    print("=" * 60)
    
    # 1. 获取行动任务和会话
    print("\n1. 获取行动任务和会话...")
    try:
        response = requests.get(f'{BASE_URL}/action-tasks')
        response.raise_for_status()
        data = response.json()

        # 检查响应格式
        if isinstance(data, dict) and 'action_tasks' in data:
            tasks = data['action_tasks']
        elif isinstance(data, list):
            tasks = data
        else:
            print(f"❌ 意外的响应格式: {type(data)}")
            return False

        if not tasks:
            print("❌ 没有找到行动任务，请先创建行动任务")
            return False

        # 优先选择智能助手空间的任务（action_space_id=1），因为我们已经为它配置了监督者
        task = None
        for t in tasks:
            if t.get('action_space_id') == 1:
                task = t
                break

        if not task:
            print("❌ 没有找到智能助手空间的任务，请创建一个智能助手空间的任务")
            return False
        task_id = task['id']
        print(f"✅ 找到行动任务: {task['title']} (ID: {task_id})")
        
        # 获取会话
        response = requests.get(f'{BASE_URL}/action-tasks/{task_id}/conversations')
        response.raise_for_status()
        conv_data = response.json()

        # 检查响应格式
        if isinstance(conv_data, dict) and 'conversations' in conv_data:
            conversations = conv_data['conversations']
        elif isinstance(conv_data, list):
            conversations = conv_data
        else:
            print(f"❌ 意外的会话响应格式: {type(conv_data)}")
            return False

        if not conversations:
            print("❌ 没有找到会话，请先创建会话")
            return False

        conversation = conversations[0]
        conversation_id = conversation['id']
        print(f"✅ 找到会话 (ID: {conversation_id})")
        
    except Exception as e:
        print(f"❌ 获取任务和会话失败: {str(e)}")
        return False
    
    # 2. 检查监督者配置
    print(f"\n2. 检查监督者配置...")
    try:
        response = requests.get(f'{BASE_URL}/action-spaces/{task["action_space_id"]}/observers')
        response.raise_for_status()
        observers = response.json()
        
        if not observers:
            print("❌ 没有找到监督者，请先配置监督者")
            return False
            
        observer = observers[0]
        observer_id = observer['id']
        print(f"✅ 找到监督者: {observer['name']} (ID: {observer_id})")
        
        # 检查监督者设置
        settings = observer.get('settings', {}).get('supervision', {})
        supervision_mode = settings.get('supervision_mode', 'round_based')
        triggers = settings.get('triggers', {})
        
        print(f"   监督模式: {supervision_mode}")
        print(f"   轮次检查: {triggers.get('after_each_round', True)}")
        print(f"   即时检查: {triggers.get('after_each_agent', False)}")
        
    except Exception as e:
        print(f"❌ 获取监督者配置失败: {str(e)}")
        return False
    
    # 3. 记录检查前的触发记录数量
    print(f"\n3. 记录检查前的触发记录数量...")
    try:
        response = requests.get(f'{BASE_URL}/action-tasks/{task_id}/rule-triggers')
        response.raise_for_status()
        triggers_before = response.json()
        
        before_count = len(triggers_before.get('triggers', []))
        print(f"✅ 检查前触发记录数量: {before_count}")
        
    except Exception as e:
        print(f"❌ 获取触发记录失败: {str(e)}")
        return False
    
    # 4. 发送消息触发智能体回复
    print(f"\n4. 发送消息触发智能体回复...")
    try:
        test_message = f"请简单回复一下，这是轮次自动检查测试。当前时间：{datetime.now().strftime('%H:%M:%S')}"
        
        message_data = {
            'content': test_message
        }
        
        print(f"   发送消息: {test_message}")
        
        response = requests.post(f'{BASE_URL}/action-tasks/{task_id}/conversations/{conversation_id}/messages', 
                               json=message_data)
        response.raise_for_status()
        
        print("✅ 消息发送成功，智能体正在处理...")
        
        # 等待智能体回复完成
        time.sleep(3)
        
    except Exception as e:
        print(f"❌ 发送消息失败: {str(e)}")
        return False
    
    # 5. 检查是否自动生成了触发记录
    print(f"\n5. 检查是否自动生成了触发记录...")
    try:
        # 等待一段时间确保异步处理完成
        time.sleep(2)
        
        response = requests.get(f'{BASE_URL}/action-tasks/{task_id}/rule-triggers')
        response.raise_for_status()
        triggers_after = response.json()
        
        after_count = len(triggers_after.get('triggers', []))
        new_triggers = after_count - before_count
        
        print(f"✅ 检查后触发记录数量: {after_count}")
        print(f"✅ 新增触发记录数量: {new_triggers}")
        
        if new_triggers > 0:
            print("🎉 轮次自动检查功能正常工作！")
            
            # 显示最新的触发记录
            latest_triggers = triggers_after.get('triggers', [])[:new_triggers]
            print("\n   最新的触发记录:")
            for trigger in latest_triggers:
                status = "通过" if trigger.get('passed') else "未通过"
                trigger_type = trigger.get('trigger_type', 'unknown')
                trigger_source = trigger.get('trigger_source', 'unknown')
                created_time = trigger.get('created_at', '')[:19].replace('T', ' ')
                
                print(f"   - {trigger.get('rule_name')}: {status}")
                print(f"     触发类型: {trigger_type}, 触发源: {trigger_source}")
                print(f"     创建时间: {created_time}")
                if trigger.get('message'):
                    print(f"     消息: {trigger.get('message')[:100]}...")
                print()
            
            return True
        else:
            print("❌ 没有生成新的触发记录，轮次自动检查可能未正常工作")
            
            # 检查可能的原因
            print("\n   可能的原因:")
            print("   1. 监督者没有关联规则集")
            print("   2. 监督者配置的触发条件不正确")
            print("   3. 规则检查过程中出现错误")
            print("   4. 智能体回复未完成或失败")
            
            return False
        
    except Exception as e:
        print(f"❌ 检查触发记录失败: {str(e)}")
        return False

def test_immediate_check():
    """测试即时检查功能"""
    
    print("\n" + "=" * 60)
    print("测试即时检查功能")
    print("=" * 60)
    
    # 这里可以添加即时检查的测试逻辑
    # 需要先将监督者配置改为即时模式
    print("即时检查测试需要手动配置监督者为即时模式")
    print("请在前端将监督者的监督模式改为'immediate'，然后重新运行测试")
    
    return True

def check_supervisor_logs():
    """检查监督者相关的日志"""
    
    print("\n" + "=" * 60)
    print("检查监督者相关日志")
    print("=" * 60)
    
    print("请检查后端日志中是否有以下关键信息:")
    print("1. '触发即时监督检查' 或 '触发轮次监督检查'")
    print("2. '规则检查完成 - 监督者: X, 会话: Y'")
    print("3. '成功保存 X 条规则触发记录'")
    print("4. 任何与 'supervisor_event_manager' 相关的错误信息")
    
    return True

if __name__ == "__main__":
    print("轮次自动检查功能测试")
    print("请确保:")
    print("1. 后端服务已启动 (http://localhost:8080)")
    print("2. 已创建行动任务和会话")
    print("3. 已配置监督者并关联规则集")
    print("4. 监督者配置为轮次检查模式")
    
    # 等待用户确认
    input("\n按回车键开始测试...")
    
    # 执行测试
    success = test_round_auto_check()
    
    if success:
        print("\n🎉 轮次自动检查功能测试通过！")
        
        # 可选：测试即时检查
        test_immediate = input("\n是否测试即时检查功能？(y/n): ").lower().strip()
        if test_immediate == 'y':
            test_immediate_check()
        
        # 检查日志
        check_logs = input("\n是否查看日志检查指南？(y/n): ").lower().strip()
        if check_logs == 'y':
            check_supervisor_logs()
        
        sys.exit(0)
    else:
        print("\n❌ 轮次自动检查功能测试失败")
        
        # 提供故障排除建议
        print("\n故障排除建议:")
        print("1. 检查监督者是否正确配置并关联了规则集")
        print("2. 检查监督者的监督模式是否为 'round_based'")
        print("3. 检查监督者的触发条件 'after_each_round' 是否为 true")
        print("4. 查看后端日志中的错误信息")
        print("5. 确认智能体回复是否成功完成")
        
        check_supervisor_logs()
        
        sys.exit(1)
