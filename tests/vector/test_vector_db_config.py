#!/usr/bin/env python3
"""
测试向量数据库配置保存和加载功能
"""

import sys
import os
import json

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# 设置Flask应用上下文
os.environ['FLASK_ENV'] = 'development'

def test_vector_db_config():
    """测试向量数据库配置功能"""
    print("🧪 测试向量数据库配置保存和加载功能")
    print("=" * 60)
    
    try:
        from app import create_app
        from app.models import SystemSetting
        
        app = create_app()
        
        with app.app_context():
            print("✅ Flask应用创建成功")
            
            # 测试配置数据
            test_config = {
                "tidb": {
                    "connectionString": "mysql://USER:PASSWORD@tidb.example.com:4000/test"
                },
                "aliyun": {
                    "apiKey": "test-api-key",
                    "endpoint": "https://test.endpoint.com"
                }
            }
            
            print(f"📝 测试配置数据: {json.dumps(test_config, indent=2, ensure_ascii=False)}")
            
            # 保存配置
            print("\n📋 保存向量数据库配置...")
            SystemSetting.set(
                key='vector_db_config',
                value=json.dumps(test_config, ensure_ascii=False),
                value_type='json',
                description='向量数据库配置',
                category='vector_db'
            )
            print("✅ 配置保存成功")
            
            # 读取配置
            print("\n📖 读取向量数据库配置...")
            setting = SystemSetting.query.filter_by(key='vector_db_config').first()
            
            if setting:
                print(f"✅ 找到配置记录:")
                print(f"   - Key: {setting.key}")
                print(f"   - Value Type: {setting.value_type}")
                print(f"   - Raw Value: {setting.value}")
                
                # 解析JSON
                try:
                    parsed_config = json.loads(setting.value)
                    print(f"   - Parsed Config: {json.dumps(parsed_config, indent=4, ensure_ascii=False)}")
                    
                    # 验证数据完整性
                    if 'tidb' in parsed_config and 'connectionString' in parsed_config['tidb']:
                        tidb_conn = parsed_config['tidb']['connectionString']
                        print(f"✅ TiDB连接字符串: {tidb_conn[:50]}...")
                    else:
                        print("❌ TiDB配置不完整")
                        
                except json.JSONDecodeError as e:
                    print(f"❌ JSON解析失败: {e}")
            else:
                print("❌ 未找到配置记录")
            
            # 测试API路由的处理逻辑
            print("\n🔧 测试API路由处理逻辑...")
            from app.api.routes.settings import get_settings
            
            # 模拟请求上下文
            with app.test_request_context():
                try:
                    response = get_settings()
                    data = response.get_json()
                    
                    if 'vectorDBConfig' in data:
                        print("✅ API返回包含vectorDBConfig")
                        print(f"   - Type: {type(data['vectorDBConfig'])}")
                        print(f"   - Content: {json.dumps(data['vectorDBConfig'], indent=2, ensure_ascii=False)}")
                    else:
                        print("❌ API返回不包含vectorDBConfig")
                        print(f"   - Available keys: {list(data.keys())}")
                        
                except Exception as e:
                    print(f"❌ API测试失败: {e}")
            
            print("\n🎉 测试完成!")
            return True
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_tidb_api():
    """测试TiDB向量数据库API"""
    print("\n🔌 测试TiDB向量数据库API")
    print("=" * 60)
    
    try:
        from app import create_app
        
        app = create_app()
        
        with app.app_context():
            # 测试连接字符串
            test_connection_string = "mysql://USER:PASSWORD@tidb.example.com:4000/test"
            
            print(f"🔗 测试连接字符串: {test_connection_string[:50]}...")
            
            # 测试配置验证
            print("\n📋 测试配置验证...")
            from app.services.vector_db.tidb_config import tidb_config_manager
            
            try:
                config = tidb_config_manager.create_config(test_connection_string)
                print("✅ 配置创建成功")
                print(f"   - Host: {config.host}")
                print(f"   - Port: {config.port}")
                print(f"   - Database: {config.database}")
                print(f"   - Username: {config.username}")
            except Exception as e:
                print(f"❌ 配置创建失败: {e}")
            
            # 测试连接
            print("\n🔌 测试数据库连接...")
            try:
                success, message, info = tidb_config_manager.test_connection(config)
                if success:
                    print(f"✅ 连接测试成功: {message}")
                    if info:
                        print(f"   - 数据库版本: {info.get('version', 'unknown')}")
                        print(f"   - 响应时间: {info.get('response_time', 0):.2f}ms")
                else:
                    print(f"❌ 连接测试失败: {message}")
            except Exception as e:
                print(f"❌ 连接测试异常: {e}")
            
            print("\n🎉 TiDB API测试完成!")
            return True
            
    except Exception as e:
        print(f"❌ TiDB API测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 开始向量数据库配置测试")
    print(f"📅 测试时间: {os.popen('date').read().strip()}")
    
    success1 = test_vector_db_config()
    success2 = test_tidb_api()
    
    print("\n" + "=" * 60)
    if success1 and success2:
        print("🎉 所有测试通过！")
        exit(0)
    else:
        print("❌ 部分测试失败")
        exit(1)
