#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    try:
        from app import create_app
        from app.services.external_knowledge import RagFlowAdapter
        
        app = create_app()
        
        with app.app_context():
            print("测试RagFlow适配器...")
            
            # 创建适配器
            config = {
                'base_url': 'http://localhost:7080',
                'api_key': 'ragflow-REPLACE_ME',
                'config': {'timeout': 30}
            }
            
            adapter = RagFlowAdapter(config)
            print("✓ 适配器创建成功")
            
            # 测试连接
            result = adapter.test_connection()
            print(f"连接测试: {result}")
            
            if result['success']:
                # 测试查询
                knowledge_config = {
                    'external_kb_id': 'f9b0243836bc11f096a90242c0a81006',
                    'query_config': {
                        'top_k': 3,
                        'similarity_threshold': 0.7
                    }
                }
                
                query_result = adapter.query_knowledge(knowledge_config, '什么是人工智能？')
                print(f"查询测试: {query_result}")
                
                if query_result['success']:
                    print("🎉 RagFlow测试成功！")
                else:
                    print("❌ 查询失败")
            else:
                print("❌ 连接失败")
                
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
