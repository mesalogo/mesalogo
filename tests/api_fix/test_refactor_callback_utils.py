#!/usr/bin/env python3
"""
测试重构后的callback_utils功能的脚本

验证重构后的代码功能完全正常，没有破坏现有功能
"""

import sys
import os
import queue
import json

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_callback_utils_import():
    """测试callback_utils模块导入"""
    print("=== 测试callback_utils模块导入 ===")
    
    try:
        from app.services.conversation.callback_utils import (
            create_standard_sse_callback,
            create_agent_info_event,
            create_planning_prompt,
            create_summary_prompt,
            create_action_prompt
        )
        print("✅ 成功导入所有callback_utils函数")
        return True
    except Exception as e:
        print(f"❌ 导入失败: {e}")
        return False

def test_sse_callback_functionality():
    """测试sse_callback功能"""
    print("\n=== 测试sse_callback功能 ===")
    
    try:
        from app.services.conversation.callback_utils import create_standard_sse_callback
        
        # 创建测试队列
        test_queue = queue.Queue()
        
        # 创建sse_callback
        sse_callback = create_standard_sse_callback(True, test_queue)
        
        # 测试字符串内容
        sse_callback("测试文本内容")
        result1 = json.loads(test_queue.get())
        
        expected1 = {
            'content': '测试文本内容',
            'meta': None
        }
        
        if result1 == expected1:
            print("✅ 字符串内容处理正确")
        else:
            print(f"❌ 字符串内容处理错误: {result1}")
            return False
        
        # 测试agentInfo事件
        agent_info = {
            "type": "agentInfo",
            "turnPrompt": "测试提示",
            "agentId": "123",
            "agentName": "测试智能体"
        }
        
        sse_callback(agent_info)
        result2 = json.loads(test_queue.get())
        
        expected2 = {
            'content': None,
            'meta': agent_info
        }
        
        if result2 == expected2:
            print("✅ agentInfo事件处理正确")
        else:
            print(f"❌ agentInfo事件处理错误: {result2}")
            return False
        
        # 测试非流式模式
        sse_callback_no_stream = create_standard_sse_callback(False, test_queue)
        sse_callback_no_stream("应该被忽略的内容")
        
        if test_queue.empty():
            print("✅ 非流式模式正确忽略内容")
        else:
            print("❌ 非流式模式未正确忽略内容")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ sse_callback功能测试失败: {e}")
        return False

def test_helper_functions():
    """测试辅助函数"""
    print("\n=== 测试辅助函数 ===")
    
    try:
        from app.services.conversation.callback_utils import (
            create_agent_info_event,
            create_planning_prompt,
            create_summary_prompt,
            create_action_prompt
        )
        
        # 测试create_agent_info_event
        agent_info = create_agent_info_event(
            agent_name="测试智能体",
            role_name="测试角色",
            agent_id="123",
            turn_prompt="测试轮次",
            round_num=1,
            total_rounds=3,
            response_order=1,
            total_agents=2,
            isPlanning=True
        )
        
        expected_fields = [
            "type", "turnPrompt", "agentId", "agentName", 
            "round", "totalRounds", "responseOrder", "totalAgents", "isPlanning"
        ]
        
        if all(field in agent_info for field in expected_fields):
            print("✅ create_agent_info_event 包含所有必需字段")
        else:
            print("❌ create_agent_info_event 缺少必需字段")
            return False
        
        # 测试create_planning_prompt
        planning_prompt = create_planning_prompt("测试智能体", "测试主题", "discussion", 3)
        if "测试智能体" in planning_prompt and "测试主题" in planning_prompt and "3轮" in planning_prompt:
            print("✅ create_planning_prompt 生成正确")
        else:
            print("❌ create_planning_prompt 生成错误")
            return False
        
        # 测试create_summary_prompt
        summary_prompt = create_summary_prompt("测试智能体", "测试主题")
        if "测试智能体" in summary_prompt and "测试主题" in summary_prompt and "总结" in summary_prompt:
            print("✅ create_summary_prompt 生成正确")
        else:
            print("❌ create_summary_prompt 生成错误")
            return False
        
        # 测试create_action_prompt
        action_prompt = create_action_prompt("测试智能体", "测试主题", 1, 3, 1, True)
        if "测试智能体" in action_prompt and "第一个行动者" in action_prompt:
            print("✅ create_action_prompt 生成正确")
        else:
            print("❌ create_action_prompt 生成错误")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 辅助函数测试失败: {e}")
        return False

def test_auto_conversation_import():
    """测试auto_conversation模块导入"""
    print("\n=== 测试auto_conversation模块导入 ===")
    
    try:
        from app.services.conversation.auto_conversation import start_auto_discussion
        print("✅ 成功导入auto_conversation")
        return True
    except Exception as e:
        print(f"❌ auto_conversation导入失败: {e}")
        return False

def test_variable_stop_conversation_import():
    """测试variable_stop_conversation模块导入"""
    print("\n=== 测试variable_stop_conversation模块导入 ===")
    
    try:
        from app.services.conversation.variable_stop_conversation import start_variable_stop_conversation
        print("✅ 成功导入variable_stop_conversation")
        return True
    except Exception as e:
        print(f"❌ variable_stop_conversation导入失败: {e}")
        return False

def test_code_syntax():
    """测试代码语法"""
    print("\n=== 测试代码语法 ===")
    
    files_to_test = [
        'app/services/conversation/callback_utils.py',
        'app/services/conversation/auto_conversation.py',
        'app/services/conversation/variable_stop_conversation.py'
    ]
    
    for file_path in files_to_test:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                code = f.read()
            
            compile(code, file_path, 'exec')
            print(f"✅ {file_path} 语法正确")
        except SyntaxError as e:
            print(f"❌ {file_path} 语法错误: {e}")
            return False
        except Exception as e:
            print(f"❌ {file_path} 编译失败: {e}")
            return False
    
    return True

def test_refactor_consistency():
    """测试重构一致性"""
    print("\n=== 测试重构一致性 ===")
    
    try:
        # 检查两个文件是否都使用了callback_utils
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            auto_content = f.read()
        
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            variable_content = f.read()
        
        # 检查是否都导入了callback_utils
        if 'from app.services.conversation.callback_utils import create_standard_sse_callback' in auto_content:
            print("✅ auto_conversation.py 正确导入callback_utils")
        else:
            print("❌ auto_conversation.py 未正确导入callback_utils")
            return False
        
        if 'from app.services.conversation.callback_utils import create_standard_sse_callback' in variable_content:
            print("✅ variable_stop_conversation.py 正确导入callback_utils")
        else:
            print("❌ variable_stop_conversation.py 未正确导入callback_utils")
            return False
        
        # 检查是否都使用了create_standard_sse_callback
        if 'sse_callback = create_standard_sse_callback(streaming, result_queue)' in auto_content:
            print("✅ auto_conversation.py 正确使用create_standard_sse_callback")
        else:
            print("❌ auto_conversation.py 未正确使用create_standard_sse_callback")
            return False
        
        if 'sse_callback = create_standard_sse_callback(streaming, result_queue)' in variable_content:
            print("✅ variable_stop_conversation.py 正确使用create_standard_sse_callback")
        else:
            print("❌ variable_stop_conversation.py 未正确使用create_standard_sse_callback")
            return False
        
        # 检查是否移除了原来的sse_callback定义
        if 'def sse_callback(content):' not in auto_content:
            print("✅ auto_conversation.py 已移除原sse_callback定义")
        else:
            print("❌ auto_conversation.py 仍有原sse_callback定义")
            return False
        
        if 'def sse_callback(content):' not in variable_content:
            print("✅ variable_stop_conversation.py 已移除原sse_callback定义")
        else:
            print("❌ variable_stop_conversation.py 仍有原sse_callback定义")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 重构一致性测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试重构后的callback_utils功能...")
    
    tests = [
        ("callback_utils模块导入", test_callback_utils_import),
        ("sse_callback功能", test_sse_callback_functionality),
        ("辅助函数", test_helper_functions),
        ("auto_conversation模块导入", test_auto_conversation_import),
        ("variable_stop_conversation模块导入", test_variable_stop_conversation_import),
        ("代码语法", test_code_syntax),
        ("重构一致性", test_refactor_consistency)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*60}")
        print(f"执行测试: {test_name}")
        print(f"{'='*60}")
        
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
    print(f"\n{'='*60}")
    print("测试结果总结")
    print(f"{'='*60}")
    
    passed = sum(results)
    total = len(results)
    
    for i, (test_name, _) in enumerate(tests):
        status = "✅ 通过" if results[i] else "❌ 失败"
        print(f"{test_name}: {status}")
    
    print(f"\n总计: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！重构成功完成")
        print("\n📋 重构成果:")
        print("- 成功提取重复的sse_callback函数到公共模块")
        print("- 两个文件都正确使用公共函数，消除了代码重复")
        print("- 所有功能保持完全正常，没有破坏现有功能")
        print("- 代码结构更清晰，维护性更好")
        return True
    else:
        print("⚠️  部分测试失败，请检查重构")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
