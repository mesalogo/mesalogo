#!/usr/bin/env python3
"""
直接测试RagFlow适配器
"""

import sys
import os
import json
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_ragflow_adapter():
    """直接测试RagFlow适配器"""
    print("开始测试RagFlow适配器...")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # 导入适配器
        from app.services.external_knowledge import RagFlowAdapter
        print("✓ RagFlow适配器导入成功")
        
        # 创建适配器实例
        config = {
            'base_url': 'http://localhost:7080',
            'api_key': 'ragflow-REPLACE_ME',
            'config': {
                'timeout': 30,
                'max_retries': 3
            }
        }
        
        adapter = RagFlowAdapter(config)
        print("✓ RagFlow适配器实例创建成功")
        
        # 测试连接
        print("\n=== 测试连接 ===")
        connection_result = adapter.test_connection()
        print(f"连接测试结果:")
        print(f"  - 成功: {connection_result['success']}")
        print(f"  - 消息: {connection_result['message']}")
        print(f"  - 响应时间: {connection_result['response_time']}ms")
        
        if connection_result['success']:
            print("✓ RagFlow连接测试成功")
            
            # 测试查询
            print("\n=== 测试查询 ===")
            knowledge_config = {
                'external_kb_id': 'f9b0243836bc11f096a90242c0a81006',
                'query_config': {
                    'top_k': 3,
                    'similarity_threshold': 0.7,
                    'vector_similarity_weight': 0.3,
                    'keywords_similarity_weight': 0.7,
                    'rerank': True
                }
            }
            
            query_result = adapter.query_knowledge(
                knowledge_config, 
                '什么是人工智能？'
            )
            
            print(f"查询结果:")
            print(f"  - 成功: {query_result['success']}")
            print(f"  - 结果数量: {query_result['total_count']}")
            print(f"  - 查询时间: {query_result['query_time']:.3f}秒")
            
            if query_result['success']:
                print("✓ RagFlow查询测试成功")
                
                # 显示查询结果
                if query_result['results']:
                    print("\n查询结果详情:")
                    for i, result in enumerate(query_result['results'][:2]):  # 只显示前2个结果
                        print(f"  结果 {i+1}:")
                        print(f"    - 内容: {result['content'][:100]}...")
                        print(f"    - 相似度: {result['score']}")
                        print(f"    - 元数据: {result['metadata']}")
                
                # 测试获取知识库信息
                print("\n=== 测试获取知识库信息 ===")
                info_result = adapter.get_knowledge_info('f9b0243836bc11f096a90242c0a81006')
                
                print(f"知识库信息结果:")
                print(f"  - 成功: {info_result['success']}")
                
                if info_result['success']:
                    print("✓ 获取知识库信息成功")
                    info = info_result['info']
                    print(f"  - ID: {info.get('id')}")
                    print(f"  - 名称: {info.get('name')}")
                    print(f"  - 描述: {info.get('description')}")
                    print(f"  - 文档数量: {info.get('document_count')}")
                    print(f"  - chunk数量: {info.get('chunk_count')}")
                else:
                    print(f"✗ 获取知识库信息失败: {info_result.get('error_message')}")
                
                # 测试获取数据集列表
                print("\n=== 测试获取数据集列表 ===")
                datasets_result = adapter.list_datasets()
                
                print(f"数据集列表结果:")
                print(f"  - 成功: {datasets_result['success']}")
                
                if datasets_result['success']:
                    print("✓ 获取数据集列表成功")
                    datasets = datasets_result['datasets']
                    print(f"  - 数据集数量: {len(datasets)}")
                    
                    if datasets:
                        print("  - 前3个数据集:")
                        for i, dataset in enumerate(datasets[:3]):
                            print(f"    {i+1}. {dataset.get('name')} (ID: {dataset.get('id')})")
                else:
                    print(f"✗ 获取数据集列表失败: {datasets_result.get('error_message')}")
                
                print("\n🎉 所有RagFlow适配器测试通过！")
                return True
                
            else:
                print(f"✗ RagFlow查询测试失败: {query_result.get('error_message')}")
                return False
        else:
            print(f"✗ RagFlow连接测试失败: {connection_result['message']}")
            return False
            
    except Exception as e:
        print(f"✗ RagFlow适配器测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_backend_integration():
    """测试后端集成"""
    print(f"\n{'='*50}")
    print("=== 测试后端集成 ===")
    
    try:
        import requests
        
        # 测试提供商连接
        print("测试提供商连接...")
        url = "http://localhost:8080/api/external-kb/providers/8/test"
        response = requests.post(url, headers={'Content-Type': 'application/json'}, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ 后端提供商连接测试成功: {data.get('message')}")
            return True
        else:
            print(f"✗ 后端提供商连接测试失败: {response.status_code}")
            print(f"响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ 后端集成测试异常: {e}")
        return False

def main():
    """主函数"""
    print("RagFlow真实API测试")
    print("=" * 50)
    
    # 测试适配器
    adapter_success = test_ragflow_adapter()
    
    # 测试后端集成
    backend_success = test_backend_integration()
    
    # 总结
    print(f"\n{'='*50}")
    print("=== 测试总结 ===")
    print(f"适配器测试: {'✓ 通过' if adapter_success else '✗ 失败'}")
    print(f"后端集成测试: {'✓ 通过' if backend_success else '✗ 失败'}")
    
    if adapter_success and backend_success:
        print("\n🎉 所有测试通过！RagFlow真实API集成成功！")
        return 0
    else:
        print("\n❌ 部分测试失败")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
