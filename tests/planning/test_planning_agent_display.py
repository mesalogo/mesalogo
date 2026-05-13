#!/usr/bin/env python3
"""
测试计划阶段智能体显示修复的脚本

验证计划阶段是否正确发送agentInfo事件，让前端显示智能体名称而不是"系统"
"""

import sys
import os
import re

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_planning_agent_info():
    """测试计划阶段是否发送agentInfo事件"""
    print("=== 测试计划阶段agentInfo事件 ===")
    
    try:
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否在计划阶段发送agentInfo事件
        planning_agent_info_pattern = r'sse_callback\(\s*\{\s*["\']type["\']\s*:\s*["\']agentInfo["\']\s*,.*["\']isPlanning["\']\s*:\s*True'
        
        if re.search(planning_agent_info_pattern, content, re.DOTALL):
            print("✅ 计划阶段正确发送agentInfo事件")
        else:
            print("❌ 计划阶段未发送agentInfo事件")
            return False
        
        # 检查agentInfo事件的内容
        required_fields = [
            '"turnPrompt"',
            '"agentId"',
            '"agentName"',
            '"round"',
            '"totalRounds"',
            '"responseOrder"',
            '"totalAgents"',
            '"isPlanning": True'
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in content:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"❌ agentInfo事件缺少字段: {missing_fields}")
            return False
        else:
            print("✅ agentInfo事件包含所有必需字段")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_planning_vs_summary_consistency():
    """测试计划阶段和总结阶段的实现一致性"""
    print("\n=== 测试计划阶段和总结阶段实现一致性 ===")
    
    try:
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查计划阶段的实现
        planning_section = re.search(
            r'# 流式模式通知用户计划阶段开始.*?sse_callback\(\{.*?\}\)',
            content, re.DOTALL
        )
        
        # 检查总结阶段的实现
        summary_section = re.search(
            r'# 通知用户总结阶段.*?sse_callback\(\{.*?\}\)',
            content, re.DOTALL
        )
        
        if not planning_section:
            print("❌ 未找到计划阶段的agentInfo发送代码")
            return False
        
        if not summary_section:
            print("❌ 未找到总结阶段的agentInfo发送代码")
            return False
        
        print("✅ 计划阶段和总结阶段都正确发送agentInfo事件")
        
        # 检查两者的结构是否相似
        planning_text = planning_section.group(0)
        summary_text = summary_section.group(0)

        # 检查关键字段是否都存在
        common_fields = ['"type"', '"turnPrompt"', '"agentId"', '"agentName"', '"round"', '"totalRounds"', '"responseOrder"', '"totalAgents"']

        planning_has_all = all(field in planning_text for field in common_fields)
        summary_has_all = all(field in summary_text for field in common_fields)

        print(f"计划阶段包含的字段: {[field for field in common_fields if field in planning_text]}")
        print(f"总结阶段包含的字段: {[field for field in common_fields if field in summary_text]}")

        if planning_has_all and summary_has_all:
            print("✅ 计划阶段和总结阶段的agentInfo结构一致")

            # 检查特殊标识字段
            has_planning_flag = '"isPlanning": True' in planning_text
            has_summary_flag = '"isSummarizing": True' in summary_text

            if has_planning_flag and has_summary_flag:
                print("✅ 计划阶段和总结阶段都有正确的特殊标识字段")
                return True
            else:
                print(f"❌ 特殊标识字段不完整: isPlanning={has_planning_flag}, isSummarizing={has_summary_flag}")
                return False
        else:
            print("❌ 计划阶段和总结阶段的agentInfo结构不一致")
            print(f"计划阶段缺少: {[field for field in common_fields if field not in planning_text]}")
            print(f"总结阶段缺少: {[field for field in common_fields if field not in summary_text]}")
            return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_planning_prompt_message():
    """测试计划阶段的提示消息"""
    print("\n=== 测试计划阶段提示消息 ===")
    
    try:
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查计划提示词的内容
        planning_prompt_pattern = r'planning_prompt\s*=\s*f["\']<div.*?@\{planner_agent\.name\}.*?制定详细计划'
        
        if re.search(planning_prompt_pattern, content, re.DOTALL):
            print("✅ 计划提示词格式正确")
        else:
            print("❌ 计划提示词格式不正确")
            return False
        
        # 检查是否包含必要的信息
        required_elements = [
            '@{planner_agent.name}',
            '制定详细计划',
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
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_code_syntax():
    """测试代码语法"""
    print("\n=== 测试代码语法 ===")
    
    try:
        # 尝试编译代码
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            code = f.read()
        
        compile(code, 'app/services/conversation/auto_conversation.py', 'exec')
        print("✅ 代码语法正确")
        return True
        
    except SyntaxError as e:
        print(f"❌ 语法错误: {e}")
        print(f"   位置: 第{e.lineno}行, 第{e.offset}列")
        return False
    except Exception as e:
        print(f"❌ 编译失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试计划阶段智能体显示修复...")
    
    tests = [
        ("计划阶段agentInfo事件", test_planning_agent_info),
        ("计划与总结实现一致性", test_planning_vs_summary_consistency),
        ("计划阶段提示消息", test_planning_prompt_message),
        ("代码语法", test_code_syntax)
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
        print("🎉 所有测试通过！计划阶段智能体显示修复成功")
        print("\n📋 修复说明:")
        print("- 计划阶段现在会正确发送agentInfo事件")
        print("- 前端将显示智能体名称而不是'系统'")
        print("- 实现与总结阶段保持一致")
        return True
    else:
        print("⚠️  部分测试失败，请检查修复")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
