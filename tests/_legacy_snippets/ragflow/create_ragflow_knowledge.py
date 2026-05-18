#!/usr/bin/env python3
"""
创建RagFlow外部知识库记录并测试
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    try:
        from app import create_app
        from app.extensions import db
        from app.models import ExternalKnowledgeProvider, ExternalKnowledge
        
        app = create_app()
        
        with app.app_context():
            print("创建RagFlow外部知识库记录...")
            
            # 查找RagFlow提供商
            provider = ExternalKnowledgeProvider.query.filter_by(name="RagFlow真实环境").first()
            
            if not provider:
                print("未找到RagFlow提供商")
                return
            
            print(f"找到提供商: {provider.name} (ID: {provider.id})")
            
            # 检查是否已存在
            existing = ExternalKnowledge.query.filter_by(
                provider_id=provider.id,
                external_kb_id="f9b0243836bc11f096a90242c0a81006"
            ).first()
            
            if existing:
                print(f"知识库已存在，ID: {existing.id}")
                knowledge_id = existing.id
            else:
                # 创建外部知识库记录
                knowledge = ExternalKnowledge(
                    name="RagFlow测试知识库",
                    description="使用真实RagFlow API的测试知识库",
                    provider_id=provider.id,
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
                
                db.session.add(knowledge)
                db.session.commit()
                
                print(f"创建知识库成功，ID: {knowledge.id}")
                knowledge_id = knowledge.id
            
            # 测试知识库查询
            print(f"\n测试知识库查询...")
            
            import requests
            import json
            
            # 测试查询API
            url = f"http://localhost:8080/api/external-kb/knowledges/{knowledge_id}/query"
            payload = {
                "query": "什么是人工智能？",
                "params": {
                    "top_k": 3
                }
            }
            
            response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=60)
            
            print(f"查询响应状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✓ 查询成功")
                print(f"结果: {json.dumps(data, indent=2, ensure_ascii=False)}")
            else:
                print(f"✗ 查询失败: {response.text}")
            
            # 测试连接
            print(f"\n测试知识库连接...")
            url = f"http://localhost:8080/api/external-kb/knowledges/{knowledge_id}/test"
            response = requests.post(url, headers={'Content-Type': 'application/json'}, timeout=30)
            
            print(f"连接测试状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✓ 连接测试成功")
                print(f"结果: {json.dumps(data, indent=2, ensure_ascii=False)}")
            else:
                print(f"✗ 连接测试失败: {response.text}")
                
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
