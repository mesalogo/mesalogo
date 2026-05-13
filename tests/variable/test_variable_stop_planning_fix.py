#!/usr/bin/env python3
"""
测试变量停止行动计划功能修复的脚本
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_variable_stop_planning_agent_info():
    """测试变量停止行动计划阶段是否发送agentInfo事件"""
    print("=== 测试变量停止行动计划阶段agentInfo事件 ===")
    
    try:
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找计划阶段的代码块
        lines = content.split('\n')
        
        planning_start = None
        planning_end = None
        
        for i, line in enumerate(lines):
            if '# 流式模式通知用户计划阶段开始' in line:
                planning_start = i
            elif planning_start and 'response_completed, error_info = ConversationService._process_single_agent_response(' in line:
                planning_end = i
                break
        
        if not planning_start:
            print("❌ 未找到计划阶段代码")
            return False
        
        if not planning_end:
            print("❌ 未找到计划阶段结束标记")
            return False
        
        # 检查计划阶段代码块
        planning_code = '\n'.join(lines[planning_start:planning_end])
        
        print(f"计划阶段代码块 (第{planning_start+1}-{planning_end}行):")
        print("=" * 50)
        print(planning_code)
        print("=" * 50)
        
        # 检查关键元素
        checks = [
            ('sse_callback({', '调用sse_callback'),
            ('"type": "agentInfo"', 'agentInfo类型'),
            ('"turnPrompt"', 'turnPrompt字段'),
            ('"agentId"', 'agentId字段'),
            ('"agentName"', 'agentName字段'),
            ('"isPlanning": True', 'isPlanning标识'),
            ('"totalRounds": 999', '变量停止模式轮数设置')
        ]
        
        all_passed = True
        for check_text, check_name in checks:
            if check_text in planning_code:
                print(f"✅ {check_name}: 存在")
            else:
                print(f"❌ {check_name}: 缺失")
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_variable_stop_vs_auto_discussion_consistency():
    """测试变量停止行动和自动讨论的计划功能一致性"""
    print("\n=== 测试变量停止行动和自动讨论计划功能一致性 ===")
    
    try:
        # 读取两个文件
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            variable_stop_content = f.read()
        
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            auto_discussion_content = f.read()
        
        # 检查关键字段是否都存在
        common_fields = [
            '"type": "agentInfo"',
            '"turnPrompt"',
            '"agentId"',
            '"agentName"',
            '"round": 0',
            '"responseOrder": 1',
            '"totalAgents": 1',
            '"isPlanning": True'
        ]
        
        variable_stop_has_all = all(field in variable_stop_content for field in common_fields)
        auto_discussion_has_all = all(field in auto_discussion_content for field in common_fields)
        
        print(f"变量停止行动包含的字段: {[field for field in common_fields if field in variable_stop_content]}")
        print(f"自动讨论包含的字段: {[field for field in common_fields if field in auto_discussion_content]}")
        
        if variable_stop_has_all and auto_discussion_has_all:
            print("✅ 变量停止行动和自动讨论的计划功能agentInfo结构一致")
            return True
        else:
            print("❌ 变量停止行动和自动讨论的计划功能agentInfo结构不一致")
            print(f"变量停止行动缺少: {[field for field in common_fields if field not in variable_stop_content]}")
            print(f"自动讨论缺少: {[field for field in common_fields if field not in auto_discussion_content]}")
            return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_variable_stop_planning_prompt():
    """测试变量停止行动计划提示词"""
    print("\n=== 测试变量停止行动计划提示词 ===")
    
    try:
        with open('app/services/conversation/variable_stop_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查计划提示词的内容
        required_elements = [
            '变量停止模式自主行动',
            '制定详细计划',
            '分析任务主题和停止条件',
            '共享记忆',
            '任务主题'
        ]
        
        missing_elements = []
        for element in required_elements:
            if element not in content:
                missing_elements.append(element)
        
        if missing_elements:
            print(f"❌ 计划提示词缺少元素: {missing_elements}")
            return False
        else:
            print("✅ 计划提示词包含所有必要元素")
            
            # 检查提示词是否针对变量停止模式进行了定制
            if '变量停止模式' in content and '停止条件' in content:
                print("✅ 计划提示词针对变量停止模式进行了定制")
                return True
            else:
                print("❌ 计划提示词未针对变量停止模式进行定制")
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
    print("开始测试变量停止行动计划功能修复...")
    
    tests = [
        ("变量停止行动计划阶段agentInfo事件", test_variable_stop_planning_agent_info),
        ("变量停止行动和自动讨论一致性", test_variable_stop_vs_auto_discussion_consistency),
        ("变量停止行动计划提示词", test_variable_stop_planning_prompt),
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
        print("🎉 所有测试通过！变量停止行动计划功能修复成功")
        print("\n📋 修复说明:")
        print("- 变量停止行动计划阶段现在会发送agentInfo事件")
        print("- 前端将正确显示智能体名称而不是'系统'")
        print("- 与自动讨论的计划功能保持一致")
        print("- 计划提示词针对变量停止模式进行了定制")
        return True
    else:
        print("⚠️  部分测试失败，请检查修复")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
