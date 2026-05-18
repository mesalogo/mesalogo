#!/usr/bin/env python3
"""
直接测试嵌入模型功能
不依赖复杂的应用上下文
"""

import sys
import os

def test_sentence_transformers():
    """测试sentence-transformers库"""
    print("1. 测试sentence-transformers库...")
    
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        
        print("✅ sentence-transformers库导入成功")
        
        # 使用轻量级模型进行测试
        model_name = "all-MiniLM-L6-v2"
        print(f"加载模型: {model_name}")
        
        model = SentenceTransformer(model_name)
        print("✅ 模型加载成功")
        
        # 测试文本
        test_texts = [
            "这是一个测试文档。",
            "人工智能技术发展迅速。",
            "This is a test document.",
            "AI technology is developing rapidly."
        ]
        
        print(f"测试文本数量: {len(test_texts)}")
        
        # 生成向量
        print("生成向量...")
        embeddings = model.encode(test_texts)
        
        print("✅ 向量生成成功")
        print(f"向量形状: {embeddings.shape}")
        print(f"向量维度: {embeddings.shape[1]}")
        print(f"数据类型: {embeddings.dtype}")
        
        # 显示向量示例
        print(f"第一个向量前5维: {embeddings[0][:5]}")
        
        # 计算相似度
        from sklearn.metrics.pairwise import cosine_similarity
        similarity_matrix = cosine_similarity(embeddings)
        
        print("\n相似度矩阵:")
        for i, text in enumerate(test_texts):
            print(f"{i+1}. {text[:20]}...")
            for j, sim in enumerate(similarity_matrix[i]):
                if i != j:
                    print(f"   与文本{j+1}相似度: {sim:.3f}")
        
        return True
        
    except ImportError as e:
        print(f"❌ sentence-transformers库未安装: {e}")
        return False
    except Exception as e:
        print(f"❌ sentence-transformers测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_tidb_vector():
    """测试TiDB向量数据库连接"""
    print("\n2. 测试TiDB向量数据库连接...")
    
    try:
        import tidb_vector
        from tidb_vector.integrations import TiDBVectorClient
        
        print("✅ tidb-vector库导入成功")
        
        # 测试连接字符串（使用环境变量或配置）
        connection_string = "mysql://USER:PASSWORD@tidb.example.com:4000/test"
        
        print("尝试连接TiDB...")
        
        # 创建客户端
        client = TiDBVectorClient(
            connection_string=connection_string,
            table_name="test_embeddings",
            distance_strategy="cosine",
            vector_dimension=384
        )
        
        print("✅ TiDB向量客户端创建成功")
        
        # 测试基本操作
        test_vectors = [
            [0.1] * 384,  # 测试向量1
            [0.2] * 384,  # 测试向量2
        ]
        
        test_documents = [
            "测试文档1",
            "测试文档2"
        ]
        
        test_metadata = [
            {"source": "test1", "type": "test"},
            {"source": "test2", "type": "test"}
        ]
        
        print("测试添加向量...")
        
        # 添加向量
        client.add_texts(
            texts=test_documents,
            embeddings=test_vectors,
            metadatas=test_metadata
        )
        
        print("✅ 向量添加成功")
        
        # 测试搜索
        print("测试向量搜索...")
        query_vector = [0.15] * 384
        
        results = client.similarity_search_by_vector(
            embedding=query_vector,
            k=2
        )
        
        print(f"✅ 搜索成功，找到 {len(results)} 个结果")
        for i, result in enumerate(results):
            print(f"  {i+1}. {result.page_content}")
        
        return True
        
    except ImportError as e:
        print(f"❌ tidb-vector库未安装: {e}")
        return False
    except Exception as e:
        print(f"❌ TiDB向量测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_integration():
    """测试集成功能"""
    print("\n3. 测试集成功能...")
    
    try:
        from sentence_transformers import SentenceTransformer
        import tidb_vector
        from tidb_vector.integrations import TiDBVectorClient
        
        # 加载嵌入模型
        model = SentenceTransformer("all-MiniLM-L6-v2")
        
        # 创建TiDB客户端
        connection_string = "mysql://USER:PASSWORD@tidb.example.com:4000/test"
        client = TiDBVectorClient(
            connection_string=connection_string,
            table_name="integration_test",
            distance_strategy="cosine",
            vector_dimension=384
        )
        
        # 测试文档
        documents = [
            "人工智能是计算机科学的一个分支。",
            "机器学习是人工智能的子集。",
            "深度学习使用神经网络。",
            "自然语言处理处理文本数据。"
        ]
        
        print(f"处理 {len(documents)} 个文档...")
        
        # 生成向量
        embeddings = model.encode(documents)
        print(f"✅ 生成向量，维度: {embeddings.shape}")
        
        # 添加到向量数据库
        metadata = [{"doc_id": i, "type": "ai"} for i in range(len(documents))]
        
        client.add_texts(
            texts=documents,
            embeddings=embeddings.tolist(),
            metadatas=metadata
        )
        
        print("✅ 文档添加到向量数据库成功")
        
        # 测试语义搜索
        query = "什么是AI技术？"
        query_embedding = model.encode([query])
        
        results = client.similarity_search_by_vector(
            embedding=query_embedding[0].tolist(),
            k=3
        )
        
        print(f"\n查询: {query}")
        print(f"✅ 找到 {len(results)} 个相关结果:")
        for i, result in enumerate(results):
            print(f"  {i+1}. {result.page_content}")
        
        return True
        
    except Exception as e:
        print(f"❌ 集成测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主测试函数"""
    print("开始向量化功能直接测试...")
    print("=" * 60)
    
    results = []
    
    # 测试sentence-transformers
    results.append(test_sentence_transformers())
    
    # 测试TiDB向量数据库
    results.append(test_tidb_vector())
    
    # 测试集成功能
    results.append(test_integration())
    
    # 总结
    print("\n" + "=" * 60)
    print("测试结果总结:")
    
    test_names = ["Sentence Transformers", "TiDB Vector", "集成功能"]
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{i+1}. {name}: {status}")
    
    all_passed = all(results)
    print(f"\n总体结果: {'✅ 全部通过' if all_passed else '❌ 部分失败'}")
    
    if all_passed:
        print("\n🎉 向量化基础功能正常！")
        print("嵌入模型和向量数据库都可以正常工作。")
    else:
        print("\n⚠️  向量化功能存在问题，请检查依赖和配置。")
    
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
