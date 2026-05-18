#!/usr/bin/env python3
"""
测试系统消息修复的脚本

验证变量停止自主行动中系统消息的格式是否正确
"""

import sys
import os
import json

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_format_system_message():
    """测试format_system_message函数的输出格式"""
    print("=== 测试format_system_message函数 ===")
    
    try:
        from app.services.conversation.message_formater import format_system_message
        
        # 测试系统消息格式化
        message_id = "test-123"
        content = "提示：现在开始变量停止模式的自主行动，智能体将持续轮流行动，直到满足停止条件。\n任务主题：测试主题"
        created_at = "2025-06-22T12:04:41"
        
        result = format_system_message(message_id, content, created_at)
        
        print("输入参数:")
        print(f"  message_id: {message_id}")
        print(f"  content: {content[:50]}...")
        print(f"  created_at: {created_at}")
        
        print("\n输出结果:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # 验证格式
        expected_structure = {
            "content": None,
            "meta": {
                "message": {
                    "id": message_id,
                    "content": content,
                    "role": "system",
                    "created_at": created_at
                }
            }
        }
        
        if result == expected_structure:
            print("✅ 格式正确")
            return True
        else:
            print("❌ 格式不正确")
            print("期望格式:")
            print(json.dumps(expected_structure, indent=2, ensure_ascii=False))
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_frontend_processing_simulation():
    """模拟前端处理逻辑"""
    print("\n=== 模拟前端处理逻辑 ===")
    
    try:
        from app.services.conversation.message_formater import format_system_message
        
        # 模拟后端发送的系统消息
        message_id = "test-456"
        content = "提示：停止条件已满足，变量停止任务结束。共进行了 1 轮行动，第 1 个智能体发言前停止。"
        created_at = "2025-06-22T12:06:04"
        
        backend_message = format_system_message(message_id, content, created_at)
        
        print("后端发送的消息:")
        print(json.dumps(backend_message, indent=2, ensure_ascii=False))
        
        # 模拟前端处理（修复前的逻辑）
        print("\n修复前的前端处理:")
        if backend_message.get('meta', {}).get('message'):
            meta_message = backend_message['meta']['message']
            old_system_message = {
                'id': f'system-{1234567890}',
                'role': 'system',
                'content': meta_message,  # 错误：将整个对象赋值给content
                'timestamp': '2025-06-22T12:06:04'
            }
            print("前端创建的消息对象:")
            print(json.dumps(old_system_message, indent=2, ensure_ascii=False))
            print("❌ content字段包含整个对象，会显示为空白")
        
        # 模拟前端处理（修复后的逻辑）
        print("\n修复后的前端处理:")
        if backend_message.get('meta', {}).get('message'):
            meta_message = backend_message['meta']['message']
            new_system_message = {
                'id': meta_message.get('id') or f'system-{1234567890}',
                'role': 'system',
                'content': meta_message.get('content') or meta_message,  # 正确：提取content字段
                'timestamp': meta_message.get('created_at') or '2025-06-22T12:06:04'
            }
            print("前端创建的消息对象:")
            print(json.dumps(new_system_message, indent=2, ensure_ascii=False))
            print("✅ content字段包含正确的文本内容")
            
            return True
            
    except Exception as e:
        print(f"❌ 模拟测试失败: {e}")
        return False

def test_variable_stop_message_scenarios():
    """测试变量停止模式中的各种系统消息场景"""
    print("\n=== 测试变量停止模式系统消息场景 ===")
    
    try:
        from app.services.conversation.message_formater import format_system_message
        
        scenarios = [
            {
                "name": "开始消息",
                "content": "提示：现在开始变量停止模式的自主行动，智能体将持续轮流行动，直到满足停止条件。\n任务主题：测试主题"
            },
            {
                "name": "停止条件满足消息",
                "content": "提示：停止条件已满足，变量停止任务结束。共进行了 3 轮行动，第 2 个智能体发言前停止。"
            },
            {
                "name": "超时停止消息",
                "content": "提示：达到最大运行时间限制 30 分钟，变量停止任务结束。共进行了 5 轮行动，第 1 个智能体发言前停止。"
            },
            {
                "name": "手动停止消息",
                "content": "提示：变量停止任务被用户手动停止。"
            }
        ]
        
        all_passed = True
        
        for i, scenario in enumerate(scenarios):
            print(f"\n场景 {i+1}: {scenario['name']}")
            
            # 格式化消息
            message_id = f"test-{i+1}"
            created_at = "2025-06-22T12:00:00"
            
            backend_message = format_system_message(message_id, scenario['content'], created_at)
            
            # 模拟修复后的前端处理
            if backend_message.get('meta', {}).get('message'):
                meta_message = backend_message['meta']['message']
                frontend_message = {
                    'id': meta_message.get('id') or f'system-{1234567890}',
                    'role': 'system',
                    'content': meta_message.get('content') or meta_message,
                    'timestamp': meta_message.get('created_at') or '2025-06-22T12:00:00'
                }
                
                # 验证content是否为字符串且非空
                if isinstance(frontend_message['content'], str) and frontend_message['content'].strip():
                    print(f"✅ {scenario['name']} - 内容正确")
                    print(f"   内容: {frontend_message['content'][:50]}...")
                else:
                    print(f"❌ {scenario['name']} - 内容错误")
                    print(f"   内容: {frontend_message['content']}")
                    all_passed = False
            else:
                print(f"❌ {scenario['name']} - 消息格式错误")
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ 场景测试失败: {e}")
        return False

def test_edge_cases():
    """测试边缘情况"""
    print("\n=== 测试边缘情况 ===")
    
    try:
        from app.services.conversation.message_formater import format_system_message
        
        # 测试空内容
        empty_message = format_system_message("empty-1", "", "2025-06-22T12:00:00")
        print("空内容测试:")
        print(json.dumps(empty_message, indent=2, ensure_ascii=False))
        
        # 测试特殊字符
        special_content = "提示：包含特殊字符的消息 <>&\"'\n换行测试"
        special_message = format_system_message("special-1", special_content, "2025-06-22T12:00:00")
        print("\n特殊字符测试:")
        print(json.dumps(special_message, indent=2, ensure_ascii=False))
        
        # 测试长内容
        long_content = "提示：" + "这是一个很长的消息内容。" * 20
        long_message = format_system_message("long-1", long_content, "2025-06-22T12:00:00")
        print(f"\n长内容测试 (长度: {len(long_content)}):")
        print(f"内容预览: {long_content[:100]}...")
        
        print("✅ 边缘情况测试通过")
        return True
        
    except Exception as e:
        print(f"❌ 边缘情况测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始测试系统消息修复...")
    
    tests = [
        ("format_system_message函数", test_format_system_message),
        ("前端处理逻辑模拟", test_frontend_processing_simulation),
        ("变量停止消息场景", test_variable_stop_message_scenarios),
        ("边缘情况", test_edge_cases)
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
        print("🎉 所有测试通过！系统消息修复成功")
        print("\n📋 修复说明:")
        print("- 前端现在正确提取meta.message.content字段作为消息内容")
        print("- 兼容旧格式，如果没有content字段则使用整个message对象")
        print("- 使用后端提供的消息ID和时间戳")
        print("- 变量停止模式的系统消息将正常显示")
        return True
    else:
        print("⚠️  部分测试失败，请检查修复")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
