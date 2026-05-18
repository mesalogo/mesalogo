#!/usr/bin/env python3
"""
测试制定计划开关默认打开的脚本
"""

import sys
import os
import re

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_planning_switch_default_value():
    """测试制定计划开关的默认值"""
    print("=== 测试制定计划开关默认值 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查Switch组件的initialValue
        switch_pattern = r'<Form\.Item\s+name="enablePlanning"\s+valuePropName="checked"\s+initialValue=\{true\}'
        
        if re.search(switch_pattern, content):
            print("✅ Switch组件的initialValue设置为true")
        else:
            print("❌ Switch组件的initialValue未设置为true")
            return False
        
        # 检查表单初始化时的默认值
        form_init_pattern = r'enablePlanning:\s*options\.enablePlanning\s*!==\s*undefined\s*\?\s*options\.enablePlanning\s*:\s*true'
        
        if re.search(form_init_pattern, content):
            print("✅ 表单初始化时的默认值设置为true")
        else:
            print("❌ 表单初始化时的默认值未设置为true")
            return False
        
        # 检查表单值变化处理中的默认值
        form_change_pattern = r'enablePlanning:\s*allValues\.enablePlanning\s*!==\s*undefined\s*\?\s*allValues\.enablePlanning\s*:\s*true'
        
        if re.search(form_change_pattern, content):
            print("✅ 表单值变化处理中的默认值设置为true")
        else:
            print("❌ 表单值变化处理中的默认值未设置为true")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_no_false_defaults():
    """测试确保没有遗留的false默认值"""
    print("\n=== 测试确保没有遗留的false默认值 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否还有enablePlanning相关的false默认值
        false_patterns = [
            r'enablePlanning.*\|\|\s*false',
            r'initialValue=\{false\}.*enablePlanning',
            r'enablePlanning.*initialValue.*false'
        ]
        
        found_false_defaults = []
        for pattern in false_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                found_false_defaults.append(pattern)
        
        if found_false_defaults:
            print(f"❌ 发现遗留的false默认值: {found_false_defaults}")
            return False
        else:
            print("✅ 没有发现遗留的false默认值")
            return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_code_consistency():
    """测试代码一致性"""
    print("\n=== 测试代码一致性 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 统计enablePlanning相关的设置
        lines = content.split('\n')
        
        planning_lines = []
        for i, line in enumerate(lines):
            if 'enablePlanning' in line and ('true' in line or 'false' in line):
                planning_lines.append((i + 1, line.strip()))
        
        print("enablePlanning相关的设置:")
        for line_num, line in planning_lines:
            print(f"  第{line_num}行: {line}")
        
        # 检查是否所有相关设置都使用了true作为默认值
        true_count = sum(1 for _, line in planning_lines if 'true' in line)
        false_count = sum(1 for _, line in planning_lines if 'false' in line and 'true' not in line)
        
        print(f"\n统计结果:")
        print(f"  使用true的设置: {true_count}")
        print(f"  使用false的设置: {false_count}")
        
        if false_count == 0 and true_count >= 2:  # 至少应该有Switch和表单初始化两处
            print("✅ 所有enablePlanning设置都使用true作为默认值")
            return True
        else:
            print("❌ 存在不一致的默认值设置")
            return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_syntax_check():
    """测试语法检查"""
    print("\n=== 测试语法检查 ===")
    
    try:
        with open('frontend/src/pages/actiontask/components/AutonomousTaskModal.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 基本的语法检查
        # 检查括号匹配
        open_braces = content.count('{')
        close_braces = content.count('}')
        
        if open_braces == close_braces:
            print("✅ 大括号匹配")
        else:
            print(f"❌ 大括号不匹配: 开括号{open_braces}, 闭括号{close_braces}")
            return False
        
        # 检查是否有明显的语法错误
        syntax_errors = [
            r'enablePlanning:\s*options\.enablePlanning\s*!==\s*undefined\s*\?\s*options\.enablePlanning\s*:\s*true\s*[^,}]',
            r'allValues\.enablePlanning\s*!==\s*undefined\s*\?\s*allValues\.enablePlanning\s*:\s*true\s*[^,}]'
        ]
        
        for pattern in syntax_errors:
            if re.search(pattern, content):
                print(f"❌ 发现潜在语法错误: {pattern}")
                return False
        
        print("✅ 未发现明显的语法错误")
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试制定计划开关默认打开设置...")
    
    tests = [
        ("制定计划开关默认值", test_planning_switch_default_value),
        ("确保没有遗留的false默认值", test_no_false_defaults),
        ("代码一致性", test_code_consistency),
        ("语法检查", test_syntax_check)
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
        print("🎉 所有测试通过！制定计划开关默认打开设置成功")
        print("\n📋 修改说明:")
        print("- Switch组件的initialValue设置为true")
        print("- 表单初始化时的默认值设置为true")
        print("- 表单值变化处理中的默认值设置为true")
        print("- 用户打开自主行动Modal时，制定计划开关将默认开启")
        return True
    else:
        print("⚠️  部分测试失败，请检查设置")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
