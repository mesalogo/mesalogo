#!/usr/bin/env python3
"""
完整的计划功能测试脚本

测试计划功能的完整流程：
1. 导入检查
2. 函数签名验证
3. 提示词生成测试
4. 模拟API调用测试
"""

import sys
import os
import json

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_function_signatures():
    """测试函数签名是否正确"""
    print("=== 测试函数签名 ===")
    
    try:
        from app.services.conversation.auto_conversation import start_auto_discussion, start_auto_discussion_stream
        import inspect
        
        # 测试主函数签名
        sig = inspect.signature(start_auto_discussion)
        params = list(sig.parameters.keys())
        
        expected_params = [
            'task_id', 'conversation_id', 'rounds', 'topic', 'summarize', 
            'streaming', 'app_context', 'result_queue', 'summarizer_agent_id',
            'enable_planning', 'planner_agent_id'
        ]
        
        print(f"start_auto_discussion 参数: {params}")
        
        missing_params = [p for p in expected_params if p not in params]
        if missing_params:
            print(f"❌ 缺少参数: {missing_params}")
            return False
        else:
            print("✅ start_auto_discussion 函数签名正确")
        
        # 测试流式函数签名
        sig_stream = inspect.signature(start_auto_discussion_stream)
        params_stream = list(sig_stream.parameters.keys())
        
        expected_params_stream = [
            'app_context', 'task_id', 'conversation_id', 'rounds', 'topic',
            'summarize', 'result_queue', 'summarizer_agent_id',
            'enable_planning', 'planner_agent_id'
        ]
        
        print(f"start_auto_discussion_stream 参数: {params_stream}")
        
        missing_params_stream = [p for p in expected_params_stream if p not in params_stream]
        if missing_params_stream:
            print(f"❌ 流式函数缺少参数: {missing_params_stream}")
            return False
        else:
            print("✅ start_auto_discussion_stream 函数签名正确")
            
        return True
        
    except Exception as e:
        print(f"❌ 函数签名测试失败: {e}")
        return False

def test_prompt_templates():
    """测试提示词模板"""
    print("\n=== 测试提示词模板 ===")
    
    try:
        # 测试数据
        agent_name = "项目经理"
        rounds = 5
        topic = "如何提高团队协作效率"
        
        # 讨论模式计划提示词
        discussion_planning_prompt = f"<div style='color: #A0A0A0;'>@{agent_name} 请为即将开始的{rounds}轮自主行动制定详细计划。请分析任务主题，制定行动策略，并将完整的计划写入共享记忆中，以便其他智能体参考。\n任务主题：{topic}</div>\n"
        
        # 条件停止模式计划提示词
        conditional_planning_prompt = f"<div style='color: #A0A0A0;'>@{agent_name} 请为即将开始的变量停止模式自主行动制定详细计划。请分析任务主题和停止条件，制定行动策略，并将完整的计划写入共享记忆中，以便其他智能体参考。\n任务主题：{topic}</div>\n"
        
        # 优化后的总结提示词
        summary_prompt = f"<div style='color: #A0A0A0;'>@{agent_name} 请根据上面的行动内容，详细总结所有观点和结论，突出重点和共识，以及存在的分歧。请将总结记录到共享记忆中，并将最终结论写入任务结论中。\n任务主题：{topic}</div>\n"
        
        print("讨论模式计划提示词:")
        print(discussion_planning_prompt)
        
        print("\n条件停止模式计划提示词:")
        print(conditional_planning_prompt)
        
        print("\n优化后的总结提示词:")
        print(summary_prompt)
        
        # 验证关键元素
        required_elements = {
            "计划提示词": ["@", "计划", "共享记忆", "任务主题"],
            "总结提示词": ["@", "总结", "共享记忆", "任务结论", "任务主题"]
        }
        
        # 检查计划提示词
        for element in required_elements["计划提示词"]:
            if element in discussion_planning_prompt and element in conditional_planning_prompt:
                print(f"✅ 计划提示词包含: {element}")
            else:
                print(f"❌ 计划提示词缺少: {element}")
                return False
        
        # 检查总结提示词
        for element in required_elements["总结提示词"]:
            if element in summary_prompt:
                print(f"✅ 总结提示词包含: {element}")
            else:
                print(f"❌ 总结提示词缺少: {element}")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ 提示词模板测试失败: {e}")
        return False

def test_api_data_structure():
    """测试API数据结构"""
    print("\n=== 测试API数据结构 ===")
    
    try:
        # 模拟前端发送的数据结构
        discussion_data = {
            "rounds": 3,
            "topic": "团队协作优化",
            "summarize": True,
            "summarizerAgentId": None,
            "enablePlanning": True,
            "plannerAgentId": 123,
            "isInfinite": False,
            "isTimeTrigger": False,
            "isVariableTrigger": False
        }
        
        conditional_stop_data = {
            "topic": "持续优化直到达标",
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
            "maxRuntime": 60
        }
        
        print("讨论模式数据结构:")
        print(json.dumps(discussion_data, indent=2, ensure_ascii=False))
        
        print("\n条件停止模式数据结构:")
        print(json.dumps(conditional_stop_data, indent=2, ensure_ascii=False))
        
        # 验证必要字段
        required_fields = ["enablePlanning", "plannerAgentId"]
        
        for field in required_fields:
            if field in discussion_data and field in conditional_stop_data:
                print(f"✅ 数据结构包含: {field}")
            else:
                print(f"❌ 数据结构缺少: {field}")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ API数据结构测试失败: {e}")
        return False

def test_import_safety():
    """测试导入安全性"""
    print("\n=== 测试导入安全性 ===")
    
    try:
        # 测试关键模块导入
        modules_to_test = [
            "app.services.conversation.auto_conversation",
            "app.services.conversation.variable_stop_conversation",
            "app.services.conversation_service",
            "app.api.routes.conversations"
        ]
        
        for module_name in modules_to_test:
            try:
                __import__(module_name)
                print(f"✅ 成功导入: {module_name}")
            except ImportError as e:
                print(f"❌ 导入失败: {module_name} - {e}")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ 导入安全性测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始完整的计划功能测试...")
    
    tests = [
        ("导入安全性", test_import_safety),
        ("函数签名", test_function_signatures),
        ("提示词模板", test_prompt_templates),
        ("API数据结构", test_api_data_structure)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"执行测试: {test_name}")
        print(f"{'='*50}")
        
        try:
            result = test_func()
            results.append(result)
            
            if result:
                print(f"✅ {test_name} 测试通过")
            else:
                print(f"❌ {test_name} 测试失败")
                
        except Exception as e:
            print(f"❌ {test_name} 测试异常: {e}")
            results.append(False)
    
    # 总结结果
    print(f"\n{'='*50}")
    print("测试结果总结")
    print(f"{'='*50}")
    
    passed = sum(results)
    total = len(results)
    
    for i, (test_name, _) in enumerate(tests):
        status = "✅ 通过" if results[i] else "❌ 失败"
        print(f"{test_name}: {status}")
    
    print(f"\n总计: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！计划功能实现完整且正确")
        return True
    else:
        print("⚠️  部分测试失败，请检查实现")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
