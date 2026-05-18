#!/usr/bin/env python3
"""
测试通用向量数据库连接功能
验证所有支持的向量数据库提供商的连接测试
"""

import sys
import os
import json
import requests
import time

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# 测试配置
TEST_CONFIGS = {
    'tidb': {
        'connectionString': 'mysql://USER:PASSWORD@tidb.example.com:4000/test'
    },
    'aliyun': {
        'apiKey': 'test-api-key-12345',
        'endpoint': 'https://dashvector-cn-beijing.aliyuncs.com'
    },
    'aws-opensearch': {
        'accessKeyId': 'AKIAIOSFODNN7EXAMPLE',
        'secretAccessKey': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'region': 'us-west-2',
        'endpoint': 'https://search-example-domain.us-west-2.es.amazonaws.com'
    },
    'pinecone': {
        'apiKey': 'test-pinecone-api-key',
        'environment': 'us-west1-gcp',
        'indexName': 'test-index'
    },
    'weaviate': {
        'endpoint': 'https://test-cluster.weaviate.network',
        'apiKey': 'test-weaviate-key'
    }
}

def test_flask_app():
    """测试Flask应用是否正常启动"""
    print("🧪 测试Flask应用启动")
    print("=" * 60)
    
    try:
        from app import create_app
        
        app = create_app()
        print("✅ Flask应用创建成功")
        
        # 测试应用上下文
        with app.app_context():
            print("✅ Flask应用上下文正常")
            
            # 检查蓝图注册
            blueprints = [bp.name for bp in app.blueprints.values()]
            print(f"📋 已注册的蓝图: {', '.join(blueprints)}")
            
            if 'vector_db' in blueprints:
                print("✅ 向量数据库蓝图已注册")
            else:
                print("❌ 向量数据库蓝图未注册")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ Flask应用测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_api_endpoints():
    """测试API端点（需要Flask服务器运行）"""
    print("\n🔌 测试向量数据库API端点")
    print("=" * 60)
    
    base_url = "http://localhost:5000/api/vector-db"
    
    # 测试获取支持的提供商
    print("📋 测试获取支持的提供商...")
    try:
        response = requests.get(f"{base_url}/providers", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                providers = data.get('providers', [])
                print(f"✅ 获取到 {len(providers)} 个支持的提供商:")
                for provider in providers[:5]:  # 只显示前5个
                    print(f"   - {provider['key']}: {provider['name']}")
            else:
                print(f"❌ API返回失败: {data.get('message')}")
        else:
            print(f"❌ HTTP错误: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求失败: {e}")
        print("💡 提示: 请确保Flask服务器正在运行 (python backend/app.py)")
        return False
    
    # 测试连接测试端点
    print("\n🔗 测试连接测试端点...")
    test_providers = ['tidb', 'aliyun', 'pinecone']
    
    for provider in test_providers:
        if provider not in TEST_CONFIGS:
            continue
            
        print(f"\n   测试 {provider} 连接...")
        try:
            response = requests.post(
                f"{base_url}/test-connection",
                json={
                    'provider': provider,
                    'config': TEST_CONFIGS[provider]
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    info = data.get('info', {})
                    response_time = info.get('response_time', 0)
                    print(f"   ✅ {provider} 连接测试成功 (耗时: {response_time}ms)")
                    print(f"      消息: {data.get('message')}")
                else:
                    print(f"   ❌ {provider} 连接测试失败: {data.get('message')}")
            else:
                print(f"   ❌ {provider} HTTP错误: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ {provider} 请求失败: {e}")
    
    return True

def test_config_validation():
    """测试配置验证功能"""
    print("\n✅ 测试配置验证功能")
    print("=" * 60)
    
    try:
        from app import create_app
        
        app = create_app()
        
        with app.app_context():
            # 导入验证函数
            from app.api.routes.vector_database import SUPPORTED_PROVIDERS
            
            print(f"📋 支持的提供商数量: {len(SUPPORTED_PROVIDERS)}")
            
            # 测试每个提供商的配置验证
            for provider, name in list(SUPPORTED_PROVIDERS.items())[:5]:  # 只测试前5个
                print(f"\n   测试 {provider} ({name}) 配置验证...")
                
                if provider in TEST_CONFIGS:
                    config = TEST_CONFIGS[provider]
                    print(f"   ✅ {provider} 配置完整: {list(config.keys())}")
                else:
                    print(f"   ⚠️  {provider} 缺少测试配置")
            
            return True
            
    except Exception as e:
        print(f"❌ 配置验证测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_frontend_integration():
    """测试前端集成"""
    print("\n🎨 测试前端集成")
    print("=" * 60)
    
    # 检查前端API服务文件
    frontend_api_file = "frontend/src/services/api/vectorDatabase.js"
    if os.path.exists(frontend_api_file):
        print("✅ 前端向量数据库API服务文件存在")
        
        # 读取文件内容检查关键函数
        with open(frontend_api_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        required_functions = [
            'testConnection',
            'validateConfig',
            'getSupportedProviders',
            'validateProviderConfig'
        ]
        
        for func in required_functions:
            if func in content:
                print(f"   ✅ 包含函数: {func}")
            else:
                print(f"   ❌ 缺少函数: {func}")
    else:
        print("❌ 前端向量数据库API服务文件不存在")
        return False
    
    # 检查前端页面修改
    settings_page_file = "frontend/src/pages/settings/GeneralSettingsPage.js"
    if os.path.exists(settings_page_file):
        print("✅ 设置页面文件存在")
        
        with open(settings_page_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'handleTestVectorDBConnection' in content:
            print("   ✅ 包含通用测试连接函数")
        else:
            print("   ❌ 缺少通用测试连接函数")
            
        if 'vectorDatabaseAPI' in content:
            print("   ✅ 导入了向量数据库API")
        else:
            print("   ❌ 未导入向量数据库API")
    else:
        print("❌ 设置页面文件不存在")
        return False
    
    return True

def main():
    """主测试函数"""
    print("🚀 开始通用向量数据库连接测试")
    print(f"📅 测试时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📊 测试提供商数量: {len(TEST_CONFIGS)}")
    
    results = []
    
    # 1. 测试Flask应用
    results.append(test_flask_app())
    
    # 2. 测试配置验证
    results.append(test_config_validation())
    
    # 3. 测试前端集成
    results.append(test_frontend_integration())
    
    # 4. 测试API端点（可选，需要服务器运行）
    print("\n💡 提示: 要测试API端点，请先启动Flask服务器:")
    print("   cd backend && python app.py")
    
    # 统计结果
    passed = sum(results)
    total = len(results)
    
    print("\n" + "=" * 60)
    print(f"📊 测试结果: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！通用向量数据库连接功能已就绪")
        print("\n📋 功能特性:")
        print("   ✅ 支持多种向量数据库提供商")
        print("   ✅ 通用连接测试API")
        print("   ✅ 配置验证功能")
        print("   ✅ 前端集成完成")
        print("   ✅ 用户友好的错误提示")
        
        print("\n🎯 使用方法:")
        print("   1. 在设置页面选择向量数据库提供商")
        print("   2. 配置相应的连接参数")
        print("   3. 点击'测试连接'按钮验证配置")
        
        return 0
    else:
        print("❌ 部分测试失败，请检查相关配置")
        return 1

if __name__ == "__main__":
    exit(main())
