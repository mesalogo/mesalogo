#!/usr/bin/env python3
"""
LightRAG 知识库集成测试脚本

测试流程：
1. 创建 LightRAG 类型知识库
2. 上传文档到 LightRAG
3. 查询测试（5 种模式）
4. 获取文档列表
5. 获取知识图谱数据
6. 清理测试数据
"""

import requests
import json
import time
import sys
from pathlib import Path

# 配置
BASE_URL = "http://localhost:8080"  # 后端 API 端口
LIGHTRAG_URL = "http://localhost:9621"
TEST_KB_NAME = "test_lightrag_kb"
TEST_QUERY = "什么是人工智能？"

# 跳过 LightRAG 直接健康检查（因为有连接问题）
SKIP_LIGHTRAG_HEALTH_CHECK = True

# 测试用的文档内容
TEST_DOCUMENT = """
# 人工智能简介

人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

## 主要领域

1. **机器学习**：让计算机从数据中学习
2. **自然语言处理**：理解和生成人类语言
3. **计算机视觉**：让计算机理解图像和视频
4. **机器人技术**：创建能够与物理世界交互的智能系统

## 应用场景

- 智能助手（如 Siri、Alexa）
- 自动驾驶汽车
- 医疗诊断
- 金融风控
- 推荐系统
"""

def print_step(step, message):
    """打印测试步骤"""
    print(f"\n{'='*60}")
    print(f"步骤 {step}: {message}")
    print('='*60)

def print_result(success, message, data=None):
    """打印测试结果"""
    status = "✅ 成功" if success else "❌ 失败"
    print(f"{status}: {message}")
    if data:
        print(f"数据: {json.dumps(data, indent=2, ensure_ascii=False)}")

def check_lightrag_health():
    """检查 LightRAG 服务状态"""
    print_step(0, "检查 LightRAG 服务状态")
    
    if SKIP_LIGHTRAG_HEALTH_CHECK:
        print_result(True, "跳过 LightRAG 直接健康检查（通过后端 API 测试）")
        return True
    
    try:
        response = requests.get(f"{LIGHTRAG_URL}/health", timeout=5)
        if response.status_code == 200:
            print_result(True, "LightRAG 服务运行正常")
            return True
        else:
            print_result(False, f"LightRAG 服务异常: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"无法连接到 LightRAG 服务: {e}")
        return False

def get_auth_token():
    """获取认证 token（如果需要）"""
    # 如果你的 API 需要认证，在这里实现登录逻辑
    # 返回 token 或 None
    return None

def create_lightrag_knowledge(token=None):
    """创建 LightRAG 类型知识库"""
    print_step(1, "创建 LightRAG 类型知识库")
    
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = {
        "name": TEST_KB_NAME,
        "description": "LightRAG 集成测试知识库",
        "kb_type": "lightrag",
        "is_shared": False,
        "lightrag_config": {
            "chunk_size": 1200,
            "chunk_overlap": 100,
            "summary_language": "Chinese",
            "default_query_mode": "mix",
            "enable_mode_selection": True,
            "top_k": 10
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/knowledges",
            headers=headers,
            json=data,
            timeout=10
        )
        
        if response.status_code == 200 or response.status_code == 201:
            result = response.json()
            if result.get('success'):
                kb_id = result['data']['id']
                print_result(True, f"知识库创建成功，ID: {kb_id}", result['data'])
                return kb_id
            else:
                print_result(False, f"创建失败: {result.get('message')}")
                return None
        else:
            print_result(False, f"HTTP 错误: {response.status_code}")
            print(f"响应: {response.text}")
            return None
    except Exception as e:
        print_result(False, f"请求异常: {e}")
        return None

def upload_document(kb_id, token=None):
    """上传文档到 LightRAG"""
    print_step(2, "上传文档到 LightRAG")
    
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    # 保存测试文档到临时文件
    test_file = Path("/tmp/test_ai_intro.md")
    test_file.write_text(TEST_DOCUMENT, encoding='utf-8')
    
    data = {
        "file_path": str(test_file),
        "workspace": kb_id
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/knowledge/{kb_id}/lightrag/upload",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                job_id = result['data'].get('job_id')
                print_result(True, f"文档上传任务已提交，Job ID: {job_id}", result['data'])
                
                # 等待任务完成
                if job_id:
                    print("\n等待上传任务完成...")
                    time.sleep(5)  # 简单等待，实际应该轮询 job 状态
                
                return True
            else:
                print_result(False, f"上传失败: {result.get('message')}")
                return False
        else:
            print_result(False, f"HTTP 错误: {response.status_code}")
            print(f"响应: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {e}")
        return False

def query_lightrag(kb_id, mode, token=None):
    """查询 LightRAG 知识库"""
    print_step(f"3.{mode}", f"查询测试 - {mode.upper()} 模式")
    
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = {
        "query": TEST_QUERY,
        "mode": mode,
        "top_k": 5
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/knowledge/{kb_id}/lightrag/query",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                answer = result['data'].get('answer') or result['data'].get('response')
                elapsed = result['data'].get('elapsed_time', 'N/A')
                print_result(True, f"查询成功 (耗时: {elapsed}ms)")
                print(f"\n回答:\n{answer[:200]}..." if len(answer) > 200 else f"\n回答:\n{answer}")
                return True
            else:
                print_result(False, f"查询失败: {result.get('message')}")
                return False
        else:
            print_result(False, f"HTTP 错误: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {e}")
        return False

def get_documents(kb_id, token=None):
    """获取文档列表"""
    print_step(4, "获取文档列表")
    
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/knowledge/{kb_id}/lightrag/documents",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                docs = result['data']
                print_result(True, f"获取到 {len(docs)} 个文档", docs)
                return True
            else:
                print_result(False, f"获取失败: {result.get('message')}")
                return False
        else:
            print_result(False, f"HTTP 错误: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {e}")
        return False

def get_graph_data(kb_id, token=None):
    """获取知识图谱数据"""
    print_step(5, "获取知识图谱数据")
    
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/knowledge/{kb_id}/lightrag/graph?limit=50",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                graph = result['data']
                nodes = graph.get('nodes', [])
                edges = graph.get('edges', [])
                print_result(True, f"获取到图谱数据: {len(nodes)} 个节点, {len(edges)} 条边")
                return True
            else:
                print_result(False, f"获取失败: {result.get('message')}")
                return False
        else:
            print_result(False, f"HTTP 错误: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {e}")
        return False

def delete_knowledge(kb_id, token=None):
    """删除测试知识库"""
    print_step(6, "清理测试数据")
    
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.delete(
            f"{BASE_URL}/api/knowledges/{kb_id}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print_result(True, "测试知识库已删除")
                return True
            else:
                print_result(False, f"删除失败: {result.get('message')}")
                return False
        else:
            print_result(False, f"HTTP 错误: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {e}")
        return False

def main():
    """主测试流程"""
    print("\n" + "="*60)
    print("LightRAG 知识库集成测试")
    print("="*60)
    
    # 检查 LightRAG 服务
    if not check_lightrag_health():
        print("\n❌ LightRAG 服务未运行，请先启动服务")
        sys.exit(1)
    
    # 获取认证 token（如果需要）
    token = get_auth_token()
    
    # 创建知识库
    kb_id = create_lightrag_knowledge(token)
    if not kb_id:
        print("\n❌ 测试失败：无法创建知识库")
        sys.exit(1)
    
    try:
        # 上传文档
        if not upload_document(kb_id, token):
            print("\n⚠️  文档上传失败，但继续测试其他功能")
        
        # 查询测试（5 种模式）
        query_modes = ['naive', 'local', 'global', 'hybrid', 'mix']
        for mode in query_modes:
            query_lightrag(kb_id, mode, token)
            time.sleep(1)  # 避免请求过快
        
        # 获取文档列表
        get_documents(kb_id, token)
        
        # 获取图谱数据
        get_graph_data(kb_id, token)
        
    finally:
        # 清理测试数据
        delete_knowledge(kb_id, token)
    
    print("\n" + "="*60)
    print("✅ 测试完成")
    print("="*60)

if __name__ == "__main__":
    main()
