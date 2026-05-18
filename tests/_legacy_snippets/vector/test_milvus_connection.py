#!/usr/bin/env python3
"""
测试Milvus向量数据库连接功能
验证真实的Milvus连接测试（移除模拟数据）
"""

import sys
import os
import json
import time

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Milvus连接配置
MILVUS_CONFIG = {
    'endpoint': 'localhost:19530',
    'username': 'default',
    'password': ''
}

def test_milvus_direct():
    """直接测试Milvus连接"""
    print("🔌 直接测试Milvus连接")
    print("=" * 60)
    
    try:
        # 尝试导入pymilvus
        try:
            from pymilvus import connections, utility
            print("✅ pymilvus库导入成功")
        except ImportError as e:
            print(f"❌ pymilvus库未安装: {e}")
            print("💡 请运行: pip install pymilvus==2.3.4")
            return False
        
        # 解析endpoint
        endpoint = MILVUS_CONFIG['endpoint']
        username = MILVUS_CONFIG['username']
        password = MILVUS_CONFIG['password']
        
        if ':' in endpoint:
            host, port = endpoint.split(':')
            port = int(port)
        else:
            host = endpoint
            port = 19530
        
        print(f"📋 连接信息:")
        print(f"   - Host: {host}")
        print(f"   - Port: {port}")
        print(f"   - Username: {username}")
        print(f"   - Password: {'***' if password else '(空)'}")
        
        # 创建连接
        conn_alias = f"test_conn_{int(time.time())}"
        print(f"\n🔗 创建连接 (alias: {conn_alias})...")
        
        start_time = time.time()
        connections.connect(
            alias=conn_alias,
            host=host,
            port=port,
            user=username,
            password=password,
            timeout=10
        )
        connect_time = time.time() - start_time
        print(f"✅ 连接建立成功 (耗时: {connect_time:.2f}秒)")
        
        # 测试连接
        print("\n📊 获取服务器信息...")
        try:
            server_version = utility.get_server_version(using=conn_alias)
            print(f"✅ Milvus服务器版本: {server_version}")
            
            # 获取更多信息
            try:
                # 列出集合（如果有权限）
                collections = utility.list_collections(using=conn_alias)
                print(f"📚 可用集合数量: {len(collections)}")
                if collections:
                    print(f"   集合列表: {collections[:5]}")  # 只显示前5个
            except Exception as e:
                print(f"⚠️  无法获取集合列表: {e}")
                
        except Exception as e:
            print(f"❌ 获取服务器信息失败: {e}")
            return False
        
        # 断开连接
        print(f"\n🔌 断开连接...")
        connections.disconnect(conn_alias)
        print("✅ 连接已断开")
        
        total_time = time.time() - start_time
        print(f"\n🎉 Milvus连接测试成功！")
        print(f"📊 总耗时: {total_time:.2f}秒")
        print(f"📋 服务器版本: {server_version}")
        
        return True
        
    except Exception as e:
        print(f"❌ Milvus连接测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_api_function():
    """测试API函数"""
    print("\n🧪 测试API函数")
    print("=" * 60)
    
    try:
        from app import create_app
        
        app = create_app()
        
        with app.app_context():
            from app.api.routes.vector_database import test_milvus_connection
            
            print("📋 测试配置:")
            print(f"   {json.dumps(MILVUS_CONFIG, indent=2, ensure_ascii=False)}")
            
            print("\n🔗 调用test_milvus_connection函数...")
            start_time = time.time()
            success, message, info = test_milvus_connection(MILVUS_CONFIG)
            end_time = time.time()
            
            print(f"📊 测试结果:")
            print(f"   - 成功: {success}")
            print(f"   - 消息: {message}")
            print(f"   - 耗时: {(end_time - start_time):.2f}秒")
            
            if info:
                print(f"   - 详细信息:")
                for key, value in info.items():
                    print(f"     * {key}: {value}")
            
            if success:
                print("✅ API函数测试成功")
            else:
                print("❌ API函数测试失败")
                
            return success
            
    except Exception as e:
        print(f"❌ API函数测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_no_mock_data():
    """验证没有模拟数据"""
    print("\n🚫 验证移除模拟数据")
    print("=" * 60)
    
    # 检查API文件中是否还有模拟数据
    api_file = "backend/app/api/routes/vector_database.py"
    if os.path.exists(api_file):
        with open(api_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        mock_keywords = ['模拟', '（模拟）', 'mock', 'Mock', 'MOCK']
        found_mock = []
        
        for keyword in mock_keywords:
            if keyword in content:
                # 找到包含关键词的行
                lines = content.split('\n')
                for i, line in enumerate(lines, 1):
                    if keyword in line:
                        found_mock.append(f"第{i}行: {line.strip()}")
        
        if found_mock:
            print("❌ 发现模拟数据:")
            for mock_line in found_mock:
                print(f"   {mock_line}")
            return False
        else:
            print("✅ 未发现模拟数据关键词")
            
        # 检查是否有真实的连接测试实现
        if 'test_milvus_connection' in content:
            print("✅ 包含真实的Milvus连接测试函数")
        else:
            print("❌ 缺少Milvus连接测试函数")
            return False
            
        if 'from pymilvus import' in content:
            print("✅ 包含pymilvus导入")
        else:
            print("❌ 缺少pymilvus导入")
            return False
            
        return True
    else:
        print("❌ API文件不存在")
        return False

def main():
    """主测试函数"""
    print("🚀 开始Milvus真实连接测试")
    print(f"📅 测试时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🎯 目标: 移除所有模拟数据，实现真实连接测试")
    
    results = []
    
    # 1. 验证移除模拟数据
    results.append(test_no_mock_data())
    
    # 2. 直接测试Milvus连接
    results.append(test_milvus_direct())
    
    # 3. 测试API函数
    results.append(test_api_function())
    
    # 统计结果
    passed = sum(results)
    total = len(results)
    
    print("\n" + "=" * 60)
    print(f"📊 测试结果: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！Milvus真实连接测试已就绪")
        print("\n✅ 完成的改进:")
        print("   🚫 移除了所有模拟数据")
        print("   🔌 实现了真实的Milvus连接测试")
        print("   📊 提供详细的连接信息和错误处理")
        print("   ⚡ 支持连接超时和性能监控")
        
        print(f"\n🎯 Milvus连接配置:")
        print(f"   - 地址: {MILVUS_CONFIG['endpoint']}")
        print(f"   - 用户: {MILVUS_CONFIG['username']}")
        
        return 0
    else:
        print("❌ 部分测试失败")
        if not results[1]:  # 如果直接连接失败
            print("\n💡 可能的解决方案:")
            print("   1. 确保Milvus服务器正在运行")
            print("   2. 检查网络连接和防火墙设置")
            print("   3. 验证连接地址和端口")
            print("   4. 安装pymilvus: pip install pymilvus==2.3.4")
        return 1

if __name__ == "__main__":
    exit(main())
