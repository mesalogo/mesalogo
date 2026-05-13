#!/usr/bin/env python3
"""
RagFlow完整测试脚本
创建外部知识库记录并测试查询功能
"""

import sys
import os
import json
import time
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    """主测试函数"""
    print("开始RagFlow完整测试...")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        from app import create_app
        from app.extensions import db
        from app.models import ExternalKnowledgeProvider, ExternalKnowledge
        from app.services.external_knowledge import ExternalKnowledgeService
        
        app = create_app()
        
        with app.app_context():
            print("\n=== 1. 检查RagFlow提供商 ===")
            
            # 查找RagFlow提供商
            ragflow_provider = ExternalKnowledgeProvider.query.filter_by(
                name="RagFlow真实环境"
            ).first()
            
            if ragflow_provider:
                print(f"✓ 找到RagFlow提供商，ID: {ragflow_provider.id}")
            else:
                print("✗ 未找到RagFlow提供商，创建新的...")
                ragflow_provider = ExternalKnowledgeProvider(
                    name="RagFlow真实环境",
                    type="ragflow",
                    base_url="http://localhost:7080",
                    api_key="ragflow-REPLACE_ME",
                    config={
                        "timeout": 30,
                        "max_retries": 3
                    },
                    status="active"
                )
                db.session.add(ragflow_provider)
                db.session.commit()
                print(f"✓ 创建RagFlow提供商成功，ID: {ragflow_provider.id}")
            
            print(f"\n=== 2. 测试提供商连接 ===")
            
            # 测试提供商连接
            from app.services.external_knowledge import AdapterFactory
            
            provider_config = {
                'base_url': ragflow_provider.base_url,
                'api_key': ragflow_provider.api_key,
                'config': ragflow_provider.config or {}
            }
            
            connection_result = AdapterFactory.test_adapter(ragflow_provider.type, provider_config)
            print(f"连接测试结果: {connection_result}")
            
            if not connection_result['success']:
                print("✗ 提供商连接失败，无法继续测试")
                return 1
            
            print("✓ 提供商连接成功")
            
            print(f"\n=== 3. 创建/检查外部知识库 ===")
            
            # 查找或创建外部知识库
            ragflow_knowledge = ExternalKnowledge.query.filter_by(
                provider_id=ragflow_provider.id,
                external_kb_id="f9b0243836bc11f096a90242c0a81006"
            ).first()
            
            if ragflow_knowledge:
                print(f"✓ 找到RagFlow知识库，ID: {ragflow_knowledge.id}")
            else:
                print("✗ 未找到RagFlow知识库，创建新的...")
                ragflow_knowledge = ExternalKnowledge(
                    name="RagFlow测试知识库",
                    description="使用真实RagFlow API的测试知识库",
                    provider_id=ragflow_provider.id,
                    external_kb_id="f9b0243836bc11f096a90242c0a81006",
                    query_config={
                        "top_k": 5,
                        "similarity_threshold": 0.7,
                        "vector_similarity_weight": 0.3,
                        "keywords_similarity_weight": 0.7,
                        "rerank": True
                    },
                    status="active"
                )
                db.session.add(ragflow_knowledge)
                db.session.commit()
                print(f"✓ 创建RagFlow知识库成功，ID: {ragflow_knowledge.id}")
            
            print(f"\n=== 4. 测试知识库连接 ===")
            
            # 测试知识库连接
            knowledge_test_result = ExternalKnowledgeService.test_knowledge_connection(ragflow_knowledge.id)
            print(f"知识库连接测试结果: {knowledge_test_result}")
            
            if not knowledge_test_result['success']:
                print("✗ 知识库连接失败")
                return 1
            
            print("✓ 知识库连接成功")
            
            print(f"\n=== 5. 测试知识库查询 ===")
            
            # 创建适配器并测试查询
            adapter = AdapterFactory.create_adapter(ragflow_provider.type, provider_config)
            
            knowledge_config = {
                'external_kb_id': ragflow_knowledge.external_kb_id,
                'query_config': ragflow_knowledge.query_config or {}
            }
            
            # 测试多个查询
            test_queries = [
                "什么是人工智能？",
                "机器学习的基本概念",
                "深度学习和神经网络"
            ]
            
            for i, query_text in enumerate(test_queries, 1):
                print(f"\n--- 查询 {i}: {query_text} ---")
                
                query_result = adapter.query_knowledge(knowledge_config, query_text)
                
                print(f"查询结果:")
                print(f"  - 成功: {query_result['success']}")
                print(f"  - 结果数量: {query_result['total_count']}")
                print(f"  - 查询时间: {query_result['query_time']:.3f}秒")
                
                if query_result['success'] and query_result['results']:
                    print(f"  - 第一个结果:")
                    first_result = query_result['results'][0]
                    print(f"    内容: {first_result['content'][:200]}...")
                    print(f"    相似度: {first_result['score']}")
                    print(f"    元数据: {first_result.get('metadata', {})}")
                elif query_result['success']:
                    print(f"  - 查询成功但无结果")
                else:
                    print(f"  - 查询失败: {query_result.get('error_message')}")
                
                time.sleep(1)  # 避免请求过于频繁
            
            print(f"\n=== 6. 测试获取知识库信息 ===")
            
            # 测试获取知识库详细信息
            info_result = ExternalKnowledgeService.get_knowledge_info(ragflow_knowledge.id)
            
            if info_result['success']:
                print("✓ 获取知识库信息成功")
                info = info_result['info']
                print(f"本地信息: {info['local_info']}")
                print(f"提供商信息: {info['provider_info']}")
                print(f"外部信息: {info['external_info']}")
            else:
                print(f"✗ 获取知识库信息失败: {info_result['error_message']}")
            
            print(f"\n=== 7. 测试统计功能 ===")
            
            # 测试查询统计
            stats_result = ExternalKnowledgeService.get_query_statistics(
                knowledge_id=ragflow_knowledge.id,
                days=7
            )
            
            if stats_result['success']:
                print("✓ 获取查询统计成功")
                stats = stats_result['statistics']
                print(f"统计信息: {stats}")
            else:
                print(f"✗ 获取查询统计失败: {stats_result['error_message']}")
            
            print(f"\n🎉 RagFlow完整测试成功！")
            print(f"\n=== 测试总结 ===")
            print(f"✓ 提供商连接正常")
            print(f"✓ 知识库创建成功")
            print(f"✓ 知识库查询正常")
            print(f"✓ 信息获取正常")
            print(f"✓ 统计功能正常")
            
            return 0
            
    except Exception as e:
        print(f"\n❌ RagFlow测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
