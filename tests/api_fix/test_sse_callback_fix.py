#!/usr/bin/env python3
"""
测试 sse_callback 修复的脚本
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_function_structure():
    """测试函数结构是否正确"""
    print("=== 测试函数结构 ===")
    
    try:
        # 读取文件内容
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查 sse_callback 定义的位置
        sse_callback_positions = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if 'def sse_callback(' in line:
                sse_callback_positions.append(i + 1)  # 行号从1开始
        
        print(f"找到 sse_callback 定义的位置: {sse_callback_positions}")
        
        if len(sse_callback_positions) == 1:
            print("✅ sse_callback 只定义了一次")
            
            # 检查定义位置是否在计划阶段之前
            planning_start_line = None
            for i, line in enumerate(lines):
                if '# 如果启用计划功能，先进行计划阶段' in line:
                    planning_start_line = i + 1
                    break
            
            if planning_start_line and sse_callback_positions[0] < planning_start_line:
                print(f"✅ sse_callback 定义在计划阶段之前 (第{sse_callback_positions[0]}行 < 第{planning_start_line}行)")
                return True
            else:
                print(f"❌ sse_callback 定义位置不正确")
                return False
                
        elif len(sse_callback_positions) == 0:
            print("❌ 没有找到 sse_callback 定义")
            return False
        else:
            print(f"❌ sse_callback 定义了多次: {sse_callback_positions}")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_import_structure():
    """测试导入结构"""
    print("\n=== 测试导入结构 ===")
    
    try:
        from app.services.conversation.auto_conversation import start_auto_discussion
        print("✅ 成功导入 start_auto_discussion")
        
        # 检查函数签名
        import inspect
        sig = inspect.signature(start_auto_discussion)
        params = list(sig.parameters.keys())
        
        required_params = ['enable_planning', 'planner_agent_id']
        missing_params = [p for p in required_params if p not in params]
        
        if missing_params:
            print(f"❌ 缺少参数: {missing_params}")
            return False
        else:
            print("✅ 函数签名包含计划参数")
            return True
            
    except Exception as e:
        print(f"❌ 导入测试失败: {e}")
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

def test_variable_scope():
    """测试变量作用域"""
    print("\n=== 测试变量作用域 ===")
    
    try:
        # 读取文件内容
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # 查找 sse_callback 的使用位置
        sse_callback_usage = []
        sse_callback_definition = None
        
        for i, line in enumerate(lines):
            if 'def sse_callback(' in line:
                sse_callback_definition = i + 1
            elif 'sse_callback=' in line or 'sse_callback(' in line:
                if 'def sse_callback(' not in line:  # 排除定义行
                    sse_callback_usage.append(i + 1)
        
        print(f"sse_callback 定义位置: 第{sse_callback_definition}行")
        print(f"sse_callback 使用位置: {sse_callback_usage}")
        
        if sse_callback_definition:
            # 检查所有使用位置是否在定义之后
            invalid_usage = [pos for pos in sse_callback_usage if pos < sse_callback_definition]
            
            if invalid_usage:
                print(f"❌ 在定义之前使用 sse_callback: {invalid_usage}")
                return False
            else:
                print("✅ 所有 sse_callback 使用都在定义之后")
                return True
        else:
            print("❌ 没有找到 sse_callback 定义")
            return False
            
    except Exception as e:
        print(f"❌ 变量作用域测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试 sse_callback 修复...")
    
    tests = [
        ("函数结构", test_function_structure),
        ("导入结构", test_import_structure),
        ("代码语法", test_code_syntax),
        ("变量作用域", test_variable_scope)
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
        print("🎉 所有测试通过！sse_callback 修复成功")
        return True
    else:
        print("⚠️  部分测试失败，请检查修复")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
