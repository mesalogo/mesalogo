#!/usr/bin/env python3
"""
向量化功能测试脚本
测试嵌入模型和向量数据库的集成功能
"""

import os
import sys
import json
import tempfile
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_embedding_service():
    """测试嵌入模型服务"""
    print("1. 测试嵌入模型服务...")

    try:
        from app import create_app
        from app.services.vector_db.embedding_service import embedding_service

        # 创建应用上下文
        app = create_app()
        with app.app_context():
            # 测试文本
            test_texts = [
                "这是一个测试文档，包含中文内容。",
                "This is a test document with English content.",
                "向量化处理测试，用于验证嵌入模型功能。",
                "Vector processing test for embedding model validation."
            ]

            print(f"测试文本数量: {len(test_texts)}")
            for i, text in enumerate(test_texts, 1):
                print(f"  {i}. {text}")

            # 生成向量
            print("\n生成向量...")
            success, embeddings, meta_info = embedding_service.generate_embeddings(test_texts)

            if success:
                print("✅ 向量生成成功")
                print(f"向量数量: {len(embeddings)}")
                print(f"向量维度: {len(embeddings[0]) if embeddings else 0}")
                print(f"元信息: {meta_info}")

                # 显示向量示例
                if embeddings:
                    print(f"第一个向量前10维: {embeddings[0][:10]}")

                return True, embeddings, meta_info
            else:
                print(f"❌ 向量生成失败: {embeddings}")
                return False, None, None

    except Exception as e:
        print(f"❌ 嵌入模型服务测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False, None, None

def test_vector_db_service():
    """测试向量数据库服务"""
    print("\n2. 测试向量数据库服务...")

    try:
        from app import create_app
        from app.services.vector_db_service import get_vector_db_service

        # 创建应用上下文
        app = create_app()
        with app.app_context():
            vector_db_service = get_vector_db_service()

            if not vector_db_service.is_available():
                print("❌ 向量数据库服务不可用")
                return False

            print("✅ 向量数据库服务可用")
        
            # 测试创建知识库
            test_kb_name = f"test_kb_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            print(f"\n创建测试知识库: {test_kb_name}")

            success, message, kb_info = vector_db_service.create_knowledge_base(test_kb_name, dimension=384)
        
        if success:
            print(f"✅ 知识库创建成功: {message}")
            print(f"知识库信息: {kb_info}")
        else:
            print(f"⚠️  知识库创建失败: {message}")
            # 可能已经存在，继续测试
        
        # 测试添加文档
        test_documents = [
            "这是第一个测试文档，包含关于人工智能的内容。",
            "第二个文档讨论机器学习和深度学习技术。",
            "第三个文档介绍自然语言处理的应用。"
        ]
        
        test_metadatas = [
            {"source": "doc1.txt", "type": "ai"},
            {"source": "doc2.txt", "type": "ml"},
            {"source": "doc3.txt", "type": "nlp"}
        ]
        
        print(f"\n添加 {len(test_documents)} 个测试文档...")
        success, message, add_info = vector_db_service.add_documents(
            test_kb_name, test_documents, test_metadatas, source="test_script"
        )
        
        if success:
            print(f"✅ 文档添加成功: {message}")
            print(f"添加信息: {add_info}")
        else:
            print(f"❌ 文档添加失败: {message}")
            return False
        
        # 测试搜索
        search_queries = [
            "人工智能",
            "机器学习",
            "自然语言处理",
            "深度学习技术"
        ]
        
        print(f"\n测试搜索功能...")
        for query in search_queries:
            print(f"\n搜索查询: '{query}'")
            success, results, search_info = vector_db_service.search(test_kb_name, query, top_k=2)
            
            if success:
                print(f"✅ 搜索成功，找到 {len(results)} 个结果")
                for i, result in enumerate(results, 1):
                    score = result.get('score', 0)
                    text = result.get('text', '')[:50]
                    source = result.get('metadata', {}).get('source', 'unknown')
                    print(f"  {i}. 相似度: {score:.3f}, 来源: {source}")
                    print(f"     内容: {text}...")
            else:
                print(f"❌ 搜索失败: {results}")
        
        return True
        
    except Exception as e:
        print(f"❌ 向量数据库服务测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_document_processing():
    """测试文档处理功能"""
    print("\n3. 测试文档处理功能...")
    
    try:
        from app.services.document_processor import knowledge_processor
        
        # 创建测试文件
        test_content = """# 测试文档

## 简介
这是一个用于测试向量化处理的文档。

## 内容
文档包含以下主题：
- 人工智能技术
- 机器学习算法
- 深度学习网络
- 自然语言处理

## 详细说明
人工智能是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。
机器学习是人工智能的一个子集，它使计算机能够在没有明确编程的情况下学习和改进。
深度学习是机器学习的一个子集，使用神经网络来模拟人脑的工作方式。

## 结论
这些技术正在改变我们的世界，为各行各业带来创新和效率提升。
"""
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
            f.write(test_content)
            temp_file = f.name
        
        print(f"创建测试文件: {temp_file}")
        print(f"文件内容长度: {len(test_content)} 字符")
        
        # 测试文档处理
        knowledge_id = 999  # 使用测试ID
        print(f"\n处理文档到知识库 {knowledge_id}...")
        
        success, result = knowledge_processor.process_file_for_knowledge_base(
            knowledge_id, temp_file, chunk_size=200, overlap=50
        )
        
        if success:
            print("✅ 文档处理成功")
            
            # 显示处理结果
            processing_summary = result.get('processing_summary', {})
            print(f"处理摘要:")
            print(f"  总块数: {processing_summary.get('total_chunks', 0)}")
            print(f"  总字符数: {processing_summary.get('total_chars', 0)}")
            print(f"  向量维度: {processing_summary.get('vector_dimension', 0)}")
            print(f"  处理时间: {processing_summary.get('processing_time', 0)} 秒")
            
            # 显示文本块示例
            chunks = result.get('chunks', [])
            if chunks:
                print(f"\n文本块示例 (共 {len(chunks)} 个):")
                for i, chunk in enumerate(chunks[:3], 1):
                    text = chunk.get('text', '')[:100]
                    print(f"  块 {i}: {text}...")
            
        else:
            print(f"❌ 文档处理失败: {result.get('error', '未知错误')}")
        
        # 清理临时文件
        os.unlink(temp_file)
        print(f"\n✅ 临时文件清理完成")
        
        return success
        
    except Exception as e:
        print(f"❌ 文档处理测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_system_settings():
    """测试系统设置"""
    print("\n4. 测试系统设置...")
    
    try:
        from app.models import SystemSetting
        from app import create_app
        
        app = create_app()
        with app.app_context():
            # 检查向量数据库设置
            use_builtin = SystemSetting.get('use_builtin_vector_db', True)
            vector_provider = SystemSetting.get('vector_db_provider', 'tidb')
            
            print(f"使用内置向量数据库: {use_builtin}")
            print(f"向量数据库提供商: {vector_provider}")
            
            # 检查嵌入模型设置
            embedding_settings = SystemSetting.query.filter(
                SystemSetting.key.like('%embedding%')
            ).all()
            
            print(f"\n嵌入模型相关设置:")
            for setting in embedding_settings:
                print(f"  {setting.key}: {setting.value}")
            
            return True
            
    except Exception as e:
        print(f"❌ 系统设置测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主测试函数"""
    print("开始向量化功能测试...")
    print("=" * 60)
    
    results = {}
    
    # 测试嵌入模型服务
    success, embeddings, meta_info = test_embedding_service()
    results['embedding_service'] = success
    
    # 测试向量数据库服务
    success = test_vector_db_service()
    results['vector_db_service'] = success
    
    # 测试文档处理功能
    success = test_document_processing()
    results['document_processing'] = success
    
    # 测试系统设置
    success = test_system_settings()
    results['system_settings'] = success
    
    # 总结结果
    print("\n" + "=" * 60)
    print("测试结果总结:")
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"  {test_name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有向量化功能测试通过！")
        print("向量数据库和嵌入模型集成正常工作。")
    else:
        print("⚠️  部分测试失败，请检查配置和依赖。")
    
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
