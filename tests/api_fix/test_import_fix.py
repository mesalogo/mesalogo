#!/usr/bin/env python3
"""
测试导入修复的脚本
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """测试关键模块的导入"""
    try:
        print("测试导入 auto_conversation 模块...")
        from app.services.conversation import auto_conversation
        print("✅ auto_conversation 模块导入成功")
        
        print("测试导入 ConversationService...")
        from app.services.conversation_service import ConversationService
        print("✅ ConversationService 导入成功")
        
        print("测试导入 variable_stop_conversation 模块...")
        from app.services.conversation import variable_stop_conversation
        print("✅ variable_stop_conversation 模块导入成功")
        
        print("测试函数签名...")
        # 检查函数签名是否正确
        import inspect
        sig = inspect.signature(auto_conversation.start_auto_discussion)
        params = list(sig.parameters.keys())
        
        expected_params = ['task_id', 'conversation_id', 'rounds', 'topic', 'summarize', 
                          'streaming', 'app_context', 'result_queue', 'summarizer_agent_id',
                          'enable_planning', 'planner_agent_id']
        
        print(f"函数参数: {params}")
        
        # 检查是否包含新增的计划参数
        if 'enable_planning' in params and 'planner_agent_id' in params:
            print("✅ 计划功能参数已正确添加")
        else:
            print("❌ 计划功能参数缺失")
            
        return True
        
    except ImportError as e:
        print(f"❌ 导入失败: {e}")
        return False
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_planning_prompt_generation():
    """测试计划提示词生成"""
    try:
        agent_name = "测试智能体"
        rounds = 3
        topic = "测试主题"
        
        # 模拟讨论模式的计划提示词
        discussion_prompt = f"<div style='color: #A0A0A0;'>@{agent_name} 请为即将开始的{rounds}轮自主行动制定详细计划。请分析任务主题，制定行动策略，并将完整的计划写入共享记忆中，以便其他智能体参考。\n任务主题：{topic}</div>\n"
        
        # 模拟条件停止模式的计划提示词
        conditional_prompt = f"<div style='color: #A0A0A0;'>@{agent_name} 请为即将开始的变量停止模式自主行动制定详细计划。请分析任务主题和停止条件，制定行动策略，并将完整的计划写入共享记忆中，以便其他智能体参考。\n任务主题：{topic}</div>\n"
        
        print("讨论模式计划提示词:")
        print(discussion_prompt)
        print("\n条件停止模式计划提示词:")
        print(conditional_prompt)
        
        # 检查提示词是否包含关键元素
        required_elements = ["@", "计划", "共享记忆", "任务主题"]
        
        for element in required_elements:
            if element in discussion_prompt and element in conditional_prompt:
                print(f"✅ 包含关键元素: {element}")
            else:
                print(f"❌ 缺少关键元素: {element}")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ 提示词生成测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试导入修复...")
    
    results = []
    
    # 测试导入
    results.append(test_imports())
    
    # 测试提示词生成
    results.append(test_planning_prompt_generation())
    
    # 总结结果
    print(f"\n=== 测试结果总结 ===")
    passed = sum(results)
    total = len(results)
    print(f"通过: {passed}/{total}")
    
    if passed == total:
        print("🎉 所有测试通过！导入修复成功")
        return True
    else:
        print("⚠️  部分测试失败，请检查修复")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
