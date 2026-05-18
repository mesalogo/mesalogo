#!/usr/bin/env python3
"""
简单测试计划阶段智能体显示修复
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_planning_agent_info_exists():
    """测试计划阶段是否发送agentInfo事件"""
    print("=== 测试计划阶段agentInfo事件是否存在 ===")
    
    try:
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找计划阶段的代码块
        lines = content.split('\n')
        
        planning_start = None
        planning_end = None
        
        for i, line in enumerate(lines):
            if '# 流式模式通知用户计划阶段开始' in line:
                planning_start = i
            elif planning_start and '# 流式模式处理计划' in line:
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
            ('"isPlanning": True', 'isPlanning标识')
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

def test_import_and_syntax():
    """测试导入和语法"""
    print("\n=== 测试导入和语法 ===")
    
    try:
        # 测试导入
        from app.services.conversation.auto_conversation import start_auto_discussion
        print("✅ 成功导入 start_auto_discussion")
        
        # 测试语法
        with open('app/services/conversation/auto_conversation.py', 'r', encoding='utf-8') as f:
            code = f.read()
        
        compile(code, 'app/services/conversation/auto_conversation.py', 'exec')
        print("✅ 代码语法正确")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始简单测试计划阶段智能体显示修复...")
    
    tests = [
        ("计划阶段agentInfo事件存在性", test_planning_agent_info_exists),
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
        print("🎉 所有测试通过！")
        print("\n📋 修复说明:")
        print("- 计划阶段现在会发送agentInfo事件")
        print("- 前端应该能正确显示智能体名称而不是'系统'")
        print("- 修复参考了总结阶段的实现方式")
        return True
    else:
        print("⚠️  部分测试失败")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
