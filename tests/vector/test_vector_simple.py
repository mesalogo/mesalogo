#!/usr/bin/env python3
"""
简化的向量化功能测试
专注于核心功能验证
"""

import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_embedding_model():
    """测试嵌入模型"""
    print("测试嵌入模型...")
    
    try:
        from app import create_app
        
        app = create_app()
        with app.app_context():
            from app.services.vector_db.embedding_service import embedding_service
            
            # 测试文本
            test_texts = [
                "这是一个测试文档。",
                "人工智能技术发展迅速。"
            ]
            
            print(f"测试文本: {test_texts}")
            
            # 生成向量
            success, embeddings, meta_info = embedding_service.generate_embeddings(test_texts)
            
            if success:
                print("✅ 嵌入模型测试成功")
                print(f"向量数量: {len(embeddings)}")
                print(f"向量维度: {len(embeddings[0]) if embeddings else 0}")
                return True
            else:
                print(f"❌ 嵌入模型测试失败: {embeddings}")
                return False
                
    except Exception as e:
        print(f"❌ 嵌入模型测试异常: {e}")
        return False

def test_vector_db():
    """测试向量数据库"""
    print("\n测试向量数据库...")
    
    try:
        from app import create_app
        
        app = create_app()
        with app.app_context():
            from app.services.vector_db_service import get_vector_db_service
            
            vector_db_service = get_vector_db_service()
            
            if vector_db_service.is_available():
                print("✅ 向量数据库服务可用")
                
                # 测试创建知识库
                test_kb = "test_simple_kb"
                success, message, _ = vector_db_service.create_knowledge_base(test_kb, dimension=384)
                
                if success:
                    print("✅ 知识库创建成功")
                    
                    # 测试添加文档
                    docs = ["测试文档1", "测试文档2"]
                    metadata = [{"source": "test1"}, {"source": "test2"}]
                    
                    success, message, _ = vector_db_service.add_documents(test_kb, docs, metadata)
                    
                    if success:
                        print("✅ 文档添加成功")
                        
                        # 测试搜索
                        success, results, _ = vector_db_service.search(test_kb, "测试", top_k=2)
                        
                        if success:
                            print(f"✅ 搜索成功，找到 {len(results)} 个结果")
                            return True
                        else:
                            print(f"❌ 搜索失败: {results}")
                    else:
                        print(f"❌ 文档添加失败: {message}")
                else:
                    print(f"⚠️  知识库创建失败: {message}")
                    # 可能已存在，继续测试搜索
                    success, results, _ = vector_db_service.search(test_kb, "测试", top_k=2)
                    if success:
                        print(f"✅ 搜索现有知识库成功，找到 {len(results)} 个结果")
                        return True
                    
            else:
                print("❌ 向量数据库服务不可用")
                
        return False
        
    except Exception as e:
        print(f"❌ 向量数据库测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_system_config():
    """测试系统配置"""
    print("\n测试系统配置...")
    
    try:
        from app import create_app
        
        app = create_app()
        with app.app_context():
            from app.models import SystemSetting
            
            # 检查向量数据库配置
            use_builtin = SystemSetting.get('use_builtin_vector_db', True)
            provider = SystemSetting.get('vector_db_provider', 'tidb')
            
            print(f"使用内置向量数据库: {use_builtin}")
            print(f"向量数据库提供商: {provider}")
            
            # 检查向量数据库配置
            vector_config = SystemSetting.get('vector_db_config', {})
            if isinstance(vector_config, str):
                import json
                try:
                    vector_config = json.loads(vector_config)
                except:
                    pass
            
            if provider in vector_config:
                print(f"✅ 找到 {provider} 配置")
                config = vector_config[provider]
                if 'connectionString' in config:
                    # 隐藏敏感信息
                    conn_str = config['connectionString']
                    if '@' in conn_str:
                        parts = conn_str.split('@')
                        masked = parts[0].split(':')[0] + ':***@' + '@'.join(parts[1:])
                        print(f"连接字符串: {masked}")
                    else:
                        print(f"连接字符串: {conn_str}")
                return True
            else:
                print(f"❌ 未找到 {provider} 配置")
                return False
                
    except Exception as e:
        print(f"❌ 系统配置测试异常: {e}")
        return False

def main():
    """主测试函数"""
    print("开始简化向量化功能测试...")
    print("=" * 50)
    
    results = []
    
    # 测试系统配置
    print("1. 系统配置测试")
    results.append(test_system_config())
    
    # 测试嵌入模型
    print("\n2. 嵌入模型测试")
    results.append(test_embedding_model())
    
    # 测试向量数据库
    print("\n3. 向量数据库测试")
    results.append(test_vector_db())
    
    # 总结
    print("\n" + "=" * 50)
    print("测试结果:")
    test_names = ["系统配置", "嵌入模型", "向量数据库"]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{i+1}. {name}: {status}")
    
    all_passed = all(results)
    print(f"\n总体结果: {'✅ 全部通过' if all_passed else '❌ 部分失败'}")
    
    if all_passed:
        print("\n🎉 向量化功能正常工作！")
        print("可以开始使用文档管理和语义搜索功能。")
    else:
        print("\n⚠️  向量化功能存在问题，请检查配置。")
    
    return all_passed

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
