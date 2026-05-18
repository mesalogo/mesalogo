#!/usr/bin/env python3
"""
测试监督者监控范围配置
验证规则遵守情况始终启用，其他功能暂时关闭
"""

import sys
import os
import requests
import json

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# API基础URL
BASE_URL = 'http://localhost:8080/api'

def test_observer_monitoring_scope():
    """测试监督者监控范围配置"""
    
    print("=" * 60)
    print("测试监督者监控范围配置")
    print("=" * 60)
    
    # 1. 获取智能助手空间的监督者
    print("\n1. 获取智能助手空间的监督者...")
    try:
        response = requests.get(f'{BASE_URL}/action-spaces/1/observers')
        response.raise_for_status()
        observers_data = response.json()
        
        observers = observers_data.get('observers', [])
        if not observers:
            print("❌ 智能助手空间没有监督者")
            return False
        
        observer = observers[0]
        observer_id = observer['id']
        print(f"✅ 找到监督者: {observer['name']} (ID: {observer_id})")
        
    except Exception as e:
        print(f"❌ 获取监督者失败: {str(e)}")
        return False
    
    # 2. 检查当前监督者的监控范围设置
    print(f"\n2. 检查监督者的监控范围设置...")
    try:
        settings = observer.get('settings', {})
        supervision = settings.get('supervision', {})
        monitoring_scope = supervision.get('monitoring_scope', {})
        
        print(f"   当前监控范围设置:")
        print(f"   - 规则遵守情况: {monitoring_scope.get('rule_compliance', 'undefined')}")
        print(f"   - 对话质量: {monitoring_scope.get('conversation_quality', 'undefined')}")
        print(f"   - 任务进度: {monitoring_scope.get('task_progress', 'undefined')}")
        print(f"   - 智能体行为: {monitoring_scope.get('agent_behavior', 'undefined')}")
        
        # 验证设置是否符合要求
        expected_settings = {
            'rule_compliance': True,
            'conversation_quality': False,
            'task_progress': False,
            'agent_behavior': False
        }
        
        all_correct = True
        for key, expected_value in expected_settings.items():
            actual_value = monitoring_scope.get(key)
            if actual_value != expected_value:
                print(f"   ❌ {key}: 期望 {expected_value}, 实际 {actual_value}")
                all_correct = False
            else:
                print(f"   ✅ {key}: {actual_value} (正确)")
        
        if all_correct:
            print("✅ 监控范围设置符合要求")
            return True
        else:
            print("❌ 监控范围设置不符合要求")
            return False
        
    except Exception as e:
        print(f"❌ 检查监控范围设置失败: {str(e)}")
        return False

def test_update_observer_settings():
    """测试更新监督者设置时监控范围的处理"""
    
    print("\n" + "=" * 60)
    print("测试更新监督者设置")
    print("=" * 60)
    
    # 获取监督者
    try:
        response = requests.get(f'{BASE_URL}/action-spaces/1/observers')
        response.raise_for_status()
        observers_data = response.json()
        
        observers = observers_data.get('observers', [])
        if not observers:
            print("❌ 智能助手空间没有监督者")
            return False
        
        observer = observers[0]
        observer_id = observer['id']
        
        # 更新监督者设置
        print(f"\n更新监督者设置...")
        
        update_data = {
            "settings": {
                "supervision": {
                    "supervision_mode": "round_based",
                    "triggers": {
                        "after_each_agent": False,
                        "after_each_round": True,
                        "on_rule_violation": True
                    },
                    "intervention_settings": {
                        "threshold": 0.7,
                        "max_interventions_per_round": 2,
                        "intervention_mode": "basic"
                    },
                    "monitoring_scope": {
                        "rule_compliance": True,
                        "conversation_quality": False,
                        "task_progress": False,
                        "agent_behavior": False
                    },
                    "reporting": {
                        "generate_summary": True,
                        "log_interventions": True,
                        "alert_on_issues": True
                    }
                }
            }
        }
        
        response = requests.put(f'{BASE_URL}/action-spaces/1/observers/{observer_id}', 
                              json=update_data)
        response.raise_for_status()
        
        print("✅ 监督者设置更新成功")
        
        # 验证更新后的设置
        response = requests.get(f'{BASE_URL}/action-spaces/1/observers')
        response.raise_for_status()
        observers_data = response.json()
        
        updated_observer = observers_data.get('observers', [])[0]
        updated_settings = updated_observer.get('settings', {})
        updated_supervision = updated_settings.get('supervision', {})
        updated_monitoring_scope = updated_supervision.get('monitoring_scope', {})
        
        print(f"\n验证更新后的监控范围设置:")
        expected_settings = {
            'rule_compliance': True,
            'conversation_quality': False,
            'task_progress': False,
            'agent_behavior': False
        }
        
        all_correct = True
        for key, expected_value in expected_settings.items():
            actual_value = updated_monitoring_scope.get(key)
            if actual_value != expected_value:
                print(f"   ❌ {key}: 期望 {expected_value}, 实际 {actual_value}")
                all_correct = False
            else:
                print(f"   ✅ {key}: {actual_value} (正确)")
        
        if all_correct:
            print("✅ 更新后的监控范围设置符合要求")
            return True
        else:
            print("❌ 更新后的监控范围设置不符合要求")
            return False
        
    except Exception as e:
        print(f"❌ 更新监督者设置失败: {str(e)}")
        return False

if __name__ == "__main__":
    print("监督者监控范围配置测试")
    print("验证规则遵守情况始终启用，其他功能暂时关闭")
    
    # 等待用户确认
    input("\n按回车键开始测试...")
    
    # 执行测试
    test1_success = test_observer_monitoring_scope()
    test2_success = test_update_observer_settings()
    
    if test1_success and test2_success:
        print("\n🎉 所有测试通过！")
        print("监督者监控范围配置正确：")
        print("- 规则遵守情况：始终启用 ✅")
        print("- 对话质量：暂时关闭（待实现）⏳")
        print("- 任务进度：暂时关闭（待实现）⏳")
        print("- 智能体行为：暂时关闭（待实现）⏳")
        sys.exit(0)
    else:
        print("\n❌ 测试失败")
        sys.exit(1)
