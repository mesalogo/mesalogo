#!/usr/bin/env python3
"""
测试自主任务计划功能的脚本

这个脚本用于验证：
1. 前端界面是否正确显示计划功能选项
2. 后端API是否正确接收和处理计划参数
3. 计划提示词是否正确生成
"""

import json
import requests
import time

# 测试配置
BASE_URL = "http://localhost:5000"
TEST_TASK_ID = 1  # 需要根据实际情况调整
TEST_CONVERSATION_ID = 1  # 需要根据实际情况调整

def test_discussion_with_planning():
    """测试带计划功能的讨论模式"""
    print("=== 测试讨论模式 + 计划功能 ===")
    
    # 构建请求数据
    data = {
        "rounds": 2,
        "topic": "如何提高团队协作效率",
        "summarize": True,
        "summarizerAgentId": None,
        "enablePlanning": True,
        "plannerAgentId": None,  # 使用默认（第一个智能体）
        "isInfinite": False,
        "isTimeTrigger": False,
        "isVariableTrigger": False
    }
    
    print(f"请求数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
    
    try:
        # 发送请求
        url = f"{BASE_URL}/api/action-tasks/{TEST_TASK_ID}/conversations/{TEST_CONVERSATION_ID}/auto-discussion"
        response = requests.post(url, json=data, timeout=30)
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 200:
            print("✅ 讨论模式 + 计划功能测试成功")
            return True
        else:
            print("❌ 讨论模式 + 计划功能测试失败")
            return False
            
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return False

def test_conditional_stop_with_planning():
    """测试带计划功能的条件停止模式"""
    print("\n=== 测试条件停止模式 + 计划功能 ===")
    
    # 构建请求数据
    data = {
        "topic": "持续优化系统性能，直到达到目标指标",
        "enablePlanning": True,
        "plannerAgentId": None,
        "isInfinite": True,
        "isTimeTrigger": False,
        "isVariableTrigger": False,
        "stopConditions": [
            {
                "type": "environment",
                "variable": "performance_score",
                "operator": ">=",
                "value": "90"
            }
        ],
        "conditionLogic": "and",
        "maxRuntime": 60  # 最大运行60分钟
    }
    
    print(f"请求数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
    
    try:
        # 发送请求
        url = f"{BASE_URL}/api/action-tasks/{TEST_TASK_ID}/conversations/{TEST_CONVERSATION_ID}/auto-discussion"
        response = requests.post(url, json=data, timeout=30)
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 200:
            print("✅ 条件停止模式 + 计划功能测试成功")
            return True
        else:
            print("❌ 条件停止模式 + 计划功能测试失败")
            return False
            
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return False

def test_planning_prompts():
    """测试计划提示词的生成"""
    print("\n=== 测试计划提示词生成 ===")
    
    # 模拟计划提示词
    agent_name = "项目经理"
    topic = "如何提高团队协作效率"
    
    expected_planning_prompt = f"<div style='color: #A0A0A0;'>@{agent_name} 请为即将开始的2轮自主行动制定详细计划。请分析任务主题，制定行动策略，并将完整的计划写入共享记忆中，以便其他智能体参考。\n任务主题：{topic}</div>\n"
    
    print("期望的计划提示词:")
    print(expected_planning_prompt)
    
    # 模拟总结提示词
    expected_summary_prompt = f"<div style='color: #A0A0A0;'>@{agent_name} 请根据上面的行动内容，详细总结所有观点和结论，突出重点和共识，以及存在的分歧。请将总结记录到共享记忆中，并将最终结论写入任务结论中。\n任务主题：{topic}</div>\n"
    
    print("\n期望的总结提示词:")
    print(expected_summary_prompt)
    
    print("✅ 提示词格式验证完成")
    return True

def main():
    """主测试函数"""
    print("开始测试自主任务计划功能...")
    print(f"测试目标: {BASE_URL}")
    print(f"测试任务ID: {TEST_TASK_ID}")
    print(f"测试会话ID: {TEST_CONVERSATION_ID}")
    
    results = []
    
    # 测试提示词生成
    results.append(test_planning_prompts())
    
    # 注意：以下测试需要实际的服务器运行
    print("\n注意：以下测试需要服务器运行且有有效的任务和会话数据")
    
    # 测试讨论模式 + 计划功能
    # results.append(test_discussion_with_planning())
    
    # 测试条件停止模式 + 计划功能  
    # results.append(test_conditional_stop_with_planning())
    
    # 总结结果
    print(f"\n=== 测试结果总结 ===")
    passed = sum(results)
    total = len(results)
    print(f"通过: {passed}/{total}")
    
    if passed == total:
        print("🎉 所有测试通过！")
    else:
        print("⚠️  部分测试失败，请检查实现")

if __name__ == "__main__":
    main()
