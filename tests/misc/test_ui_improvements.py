#!/usr/bin/env python3
"""
测试UI改进的脚本

验证以下改进：
1. "开始指定计划" 更名为 "制定计划"
2. 下拉列表提示文字优化
3. 总结功能移到计划功能下面
4. 开关放在标题右边，布局更紧凑
"""

import sys
import os
import re

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_planning_label_change():
    """测试计划功能标签更改"""
    print("=== 测试计划功能标签更改 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否包含新的标签
        if '制定计划' in content:
            print("✅ 找到新标签: '制定计划'")
        else:
            print("❌ 未找到新标签: '制定计划'")
            return False
        
        # 检查是否还有旧的标签
        if '开始指定计划' in content:
            print("❌ 仍然包含旧标签: '开始指定计划'")
            return False
        else:
            print("✅ 已移除旧标签: '开始指定计划'")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_placeholder_improvements():
    """测试下拉列表提示文字改进"""
    print("\n=== 测试下拉列表提示文字改进 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查计划智能体的提示文字
        planning_placeholder = "选择计划智能体（不选择则使用第一个智能体）"
        if planning_placeholder in content:
            print("✅ 计划智能体提示文字正确")
        else:
            print("❌ 计划智能体提示文字不正确")
            return False
        
        # 检查总结智能体的提示文字
        summary_placeholder = "选择总结智能体（不选择则使用第一个智能体）"
        if summary_placeholder in content:
            print("✅ 总结智能体提示文字正确")
        else:
            print("❌ 总结智能体提示文字不正确")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_layout_compactness():
    """测试布局紧凑性"""
    print("\n=== 测试布局紧凑性 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否使用了紧凑的开关布局
        compact_switch_pattern = r'display:\s*[\'"]flex[\'"].*justifyContent:\s*[\'"]space-between[\'"]'
        if re.search(compact_switch_pattern, content):
            print("✅ 使用了紧凑的开关布局")
        else:
            print("❌ 未使用紧凑的开关布局")
            return False
        
        # 检查是否使用了小尺寸开关
        if 'size="small"' in content:
            print("✅ 使用了小尺寸开关")
        else:
            print("❌ 未使用小尺寸开关")
            return False
        
        # 检查是否移除了不必要的副标题（检查label中是否还有这些文字）
        # 这些文字现在应该只在placeholder中，不在label中
        label_pattern_planning = r'label\s*=\s*[\'"]选择计划智能体[\'"]'
        label_pattern_summary = r'label\s*=\s*[\'"]选择总结智能体[\'"]'

        if re.search(label_pattern_planning, content) or re.search(label_pattern_summary, content):
            print("❌ 仍然在label中包含副标题")
            return False
        else:
            print("✅ 移除了label中的副标题，现在只在placeholder中")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_summary_position():
    """测试总结功能位置"""
    print("\n=== 测试总结功能位置 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # 找到计划功能和总结功能的位置
        planning_line = None
        summary_line = None
        
        for i, line in enumerate(lines):
            if '制定计划' in line:
                planning_line = i
            elif '讨论总结' in line:
                summary_line = i
        
        if planning_line is None:
            print("❌ 未找到计划功能")
            return False
        
        if summary_line is None:
            print("❌ 未找到总结功能")
            return False
        
        if summary_line > planning_line:
            print(f"✅ 总结功能在计划功能下面 (计划: 第{planning_line+1}行, 总结: 第{summary_line+1}行)")
            return True
        else:
            print(f"❌ 总结功能位置不正确 (计划: 第{planning_line+1}行, 总结: 第{summary_line+1}行)")
            return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_help_text_improvements():
    """测试帮助文字改进"""
    print("\n=== 测试帮助文字改进 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查计划功能的帮助文字
        planning_help = "计划将被写入共享记忆中，供其他智能体参考"
        if planning_help in content:
            print("✅ 计划功能帮助文字正确")
        else:
            print("❌ 计划功能帮助文字不正确")
            return False
        
        # 检查总结功能的帮助文字
        summary_help = "总结将被写入共享记忆和任务结论中"
        if summary_help in content:
            print("✅ 总结功能帮助文字正确")
        else:
            print("❌ 总结功能帮助文字不正确")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试UI改进...")
    
    tests = [
        ("计划功能标签更改", test_planning_label_change),
        ("下拉列表提示文字改进", test_placeholder_improvements),
        ("布局紧凑性", test_layout_compactness),
        ("总结功能位置", test_summary_position),
        ("帮助文字改进", test_help_text_improvements)
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
        print("🎉 所有UI改进测试通过！")
        return True
    else:
        print("⚠️  部分UI改进测试失败，请检查实现")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
