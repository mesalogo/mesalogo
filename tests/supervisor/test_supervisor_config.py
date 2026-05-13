#!/usr/bin/env python3
"""
监督者配置功能测试脚本

用于测试监督者配置的基本功能，包括：
1. 创建行动空间
2. 添加监督者
3. 配置监督者设置
4. 验证配置是否正确保存和读取
"""

import requests
import json
import sys

# 配置
BASE_URL = "http://localhost:5000"
API_BASE = f"{BASE_URL}/api"

def test_supervisor_configuration():
    """测试监督者配置功能"""
    
    print("🚀 开始测试监督者配置功能...")
    
    # 1. 创建测试行动空间
    print("\n1. 创建测试行动空间...")
    space_data = {
        "name": "监督者配置测试空间",
        "description": "用于测试监督者配置功能的行动空间",
        "settings": {
            "background": "这是一个测试环境",
            "rules": "测试规则"
        }
    }
    
    response = requests.post(f"{API_BASE}/action-spaces", json=space_data)
    if response.status_code != 201:
        print(f"❌ 创建行动空间失败: {response.text}")
        return False
    
    space_id = response.json()["id"]
    print(f"✅ 行动空间创建成功，ID: {space_id}")
    
    # 2. 获取可用角色（假设系统中已有角色）
    print("\n2. 获取可用角色...")
    response = requests.get(f"{API_BASE}/roles")
    if response.status_code != 200:
        print(f"❌ 获取角色失败: {response.text}")
        return False
    
    roles = response.json()
    if not roles:
        print("❌ 系统中没有可用角色，请先创建角色")
        return False
    
    role_id = roles[0]["id"]
    print(f"✅ 找到可用角色，ID: {role_id}, 名称: {roles[0]['name']}")
    
    # 3. 添加监督者到行动空间
    print("\n3. 添加监督者到行动空间...")
    observer_data = {
        "role_id": role_id,
        "additional_prompt": "你是一个测试监督者，负责监控测试过程。"
    }
    
    response = requests.post(f"{API_BASE}/action-spaces/{space_id}/observers", json=observer_data)
    if response.status_code != 201:
        print(f"❌ 添加监督者失败: {response.text}")
        return False
    
    print("✅ 监督者添加成功")
    
    # 4. 配置监督者设置
    print("\n4. 配置监督者设置...")
    supervision_settings = {
        "settings": {
            "supervision": {
                "supervision_mode": "round_based",
                "triggers": {
                    "after_each_agent": False,
                    "after_each_round": True,
                    "on_conflict_detected": True,
                    "on_rule_violation": True,
                    "time_interval": 300
                },
                "intervention_settings": {
                    "threshold": 0.8,
                    "max_interventions_per_round": 3,
                    "auto_intervention": True,
                    "require_approval": False
                },
                "monitoring_scope": {
                    "rule_compliance": True,
                    "conversation_quality": True,
                    "task_progress": True,
                    "agent_behavior": True
                },
                "reporting": {
                    "generate_summary": True,
                    "log_interventions": True,
                    "alert_on_issues": True
                }
            }
        }
    }
    
    response = requests.put(f"{API_BASE}/action-spaces/{space_id}/observers/{role_id}", json=supervision_settings)
    if response.status_code != 200:
        print(f"❌ 配置监督者设置失败: {response.text}")
        return False
    
    print("✅ 监督者设置配置成功")
    
    # 5. 验证配置是否正确保存
    print("\n5. 验证监督者配置...")
    response = requests.get(f"{API_BASE}/action-spaces/{space_id}/observers")
    if response.status_code != 200:
        print(f"❌ 获取监督者列表失败: {response.text}")
        return False
    
    observers = response.json().get("observers", [])
    if not observers:
        print("❌ 没有找到监督者")
        return False
    
    observer = observers[0]
    saved_settings = observer.get("settings", {}).get("supervision", {})
    
    # 验证关键配置
    expected_mode = "round_based"
    expected_threshold = 0.8
    expected_max_interventions = 3
    
    if saved_settings.get("supervision_mode") != expected_mode:
        print(f"❌ 监督模式配置错误: 期望 {expected_mode}, 实际 {saved_settings.get('supervision_mode')}")
        return False
    
    if saved_settings.get("intervention_settings", {}).get("threshold") != expected_threshold:
        print(f"❌ 干预阈值配置错误: 期望 {expected_threshold}, 实际 {saved_settings.get('intervention_settings', {}).get('threshold')}")
        return False
    
    if saved_settings.get("intervention_settings", {}).get("max_interventions_per_round") != expected_max_interventions:
        print(f"❌ 最大干预次数配置错误: 期望 {expected_max_interventions}, 实际 {saved_settings.get('intervention_settings', {}).get('max_interventions_per_round')}")
        return False
    
    print("✅ 监督者配置验证成功")
    print(f"📋 保存的配置: {json.dumps(saved_settings, indent=2, ensure_ascii=False)}")
    
    # 6. 清理测试数据
    print("\n6. 清理测试数据...")
    response = requests.delete(f"{API_BASE}/action-spaces/{space_id}")
    if response.status_code == 200:
        print("✅ 测试数据清理成功")
    else:
        print(f"⚠️ 清理测试数据失败: {response.text}")
    
    print("\n🎉 监督者配置功能测试完成！")
    return True

if __name__ == "__main__":
    try:
        success = test_supervisor_configuration()
        if success:
            print("\n✅ 所有测试通过！")
            sys.exit(0)
        else:
            print("\n❌ 测试失败！")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 测试过程中发生错误: {str(e)}")
        sys.exit(1)
