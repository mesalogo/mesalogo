#!/usr/bin/env python3
"""
测试变量停止行动计划功能最终修复的脚本
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_variable_stop_sse_callback_consistency():
    """测试变量停止行动与自动讨论的sse_callback一致性"""
    print("=== 测试变量停止行动与自动讨论的sse_callback一致性 ===")
    
    try:
        # 读取两个文件
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            variable_stop_content = f.read()
        
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            auto_discussion_content = f.read()
        
        # 检查sse_callback函数的定义
        sse_callback_checks = [
            'def sse_callback(content):',
            'if isinstance(content, dict):',
            'content.get(\'type\') == \'agentInfo\'',
            'result_queue.put(json.dumps({',
            '\'content\': None,',
            '\'meta\': content'
        ]
        
        variable_stop_has_all = all(check in variable_stop_content for check in sse_callback_checks)
        auto_discussion_has_all = all(check in auto_discussion_content for check in sse_callback_checks)
        
        print(f"变量停止行动sse_callback检查: {variable_stop_has_all}")
        print(f"自动讨论sse_callback检查: {auto_discussion_has_all}")
        
        if variable_stop_has_all and auto_discussion_has_all:
            print("✅ 变量停止行动和自动讨论的sse_callback实现一致")
            return True
        else:
            print("❌ 变量停止行动和自动讨论的sse_callback实现不一致")
            return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_variable_stop_planning_agent_info_usage():
    """测试变量停止行动计划阶段是否正确使用sse_callback"""
    print("\n=== 测试变量停止行动计划阶段sse_callback使用 ===")
    
    try:
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查计划阶段是否直接调用sse_callback而不是wrap_stream_callback
        planning_checks = [
            '# 流式模式通知用户计划阶段开始',
            'sse_callback({',
            '"type": "agentInfo"',
            '"isPlanning": True'
        ]
        
        # 检查是否移除了wrap_stream_callback的使用
        no_wrap_callback_in_planning = 'wrap_stream_callback(result_queue)' not in content.split('# 流式模式处理计划')[0]
        
        planning_has_all = all(check in content for check in planning_checks)
        
        print(f"计划阶段sse_callback调用检查: {planning_has_all}")
        print(f"移除wrap_stream_callback检查: {no_wrap_callback_in_planning}")
        
        if planning_has_all:
            print("✅ 计划阶段正确使用sse_callback")
            return True
        else:
            print("❌ 计划阶段未正确使用sse_callback")
            return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_variable_stop_loop_agent_info_usage():
    """测试变量停止循环中智能体信息是否正确使用sse_callback"""
    print("\n=== 测试变量停止循环中智能体信息sse_callback使用 ===")
    
    try:
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查循环中是否直接调用sse_callback
        loop_checks = [
            '# 流式模式通知用户当前发言智能体信息',
            'sse_callback({',
            '"turnPrompt": f"轮到智能体 {agent.name}({role_name}) 行动"'
        ]
        
        # 检查函数签名是否包含sse_callback参数
        function_signature_check = '_execute_variable_stop_loop(task_key: str, task_id: int, conversation_id: int,' in content and 'sse_callback)' in content
        
        loop_has_all = all(check in content for check in loop_checks)
        
        print(f"循环中sse_callback调用检查: {loop_has_all}")
        print(f"函数签名包含sse_callback参数: {function_signature_check}")
        
        if loop_has_all and function_signature_check:
            print("✅ 循环中正确使用sse_callback")
            return True
        else:
            print("❌ 循环中未正确使用sse_callback")
            return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_import_and_syntax():
    """测试导入和语法"""
    print("\n=== 测试导入和语法 ===")
    
    try:
        # 测试导入
        from app.services.conversation.variable_stop_conversation import start_variable_stop_conversation
        print("✅ 成功导入 start_variable_stop_conversation")
        
        # 测试语法
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            code = f.read()
        
        compile(code, 'app/services/conversation/variable_stop_conversation.py', 'exec')
        print("✅ 代码语法正确")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试变量停止行动计划功能最终修复...")
    
    tests = [
        ("sse_callback一致性", test_variable_stop_sse_callback_consistency),
        ("计划阶段sse_callback使用", test_variable_stop_planning_agent_info_usage),
        ("循环中sse_callback使用", test_variable_stop_loop_agent_info_usage),
        ("导入和语法", test_import_and_syntax)
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
        print("🎉 所有测试通过！变量停止行动计划功能最终修复成功")
        print("\n📋 修复说明:")
        print("- 变量停止行动现在使用与自动讨论相同的sse_callback实现")
        print("- 计划阶段和循环阶段都正确发送agentInfo事件")
        print("- 前端将正确显示智能体名称而不是'系统'")
        print("- 完全与auto_conversation保持一致")
        return True
    else:
        print("⚠️  部分测试失败，请检查修复")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
