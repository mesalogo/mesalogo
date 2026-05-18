#!/usr/bin/env python3
"""
测试文档管理功能
包括文件上传、获取文件列表、删除文件等功能
"""

import requests
import json
import os
import tempfile

BASE_URL = "http://localhost:8080/api"

def create_test_knowledge():
    """创建测试知识库"""
    print("1. 创建测试知识库...")
    
    data = {
        "name": "文档管理测试知识库",
        "description": "用于测试文档管理功能的知识库"
    }
    
    response = requests.post(f"{BASE_URL}/knowledges", json=data)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            knowledge_id = result['data']['id']
            print(f"✅ 知识库创建成功，ID: {knowledge_id}")
            return knowledge_id
        else:
            print(f"❌ 创建失败: {result.get('message')}")
    else:
        print(f"❌ HTTP错误: {response.status_code}")
        print(f"响应: {response.text}")
    
    return None

def create_test_files():
    """创建测试文件"""
    print("\n2. 创建测试文件...")
    
    # 创建临时文件
    files = {}
    
    # 创建文本文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write("这是一个测试文本文件。\n包含一些中文内容用于测试向量化处理。\n这是第三行内容。")
        files['test.txt'] = f.name
    
    # 创建Markdown文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
        f.write("""# 测试Markdown文件

## 简介
这是一个用于测试的Markdown文件。

## 内容
- 项目1
- 项目2
- 项目3

## 结论
测试文件创建完成。
""")
        files['test.md'] = f.name
    
    # 创建JSON文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        test_data = {
            "name": "测试数据",
            "description": "这是一个测试JSON文件",
            "items": ["item1", "item2", "item3"],
            "metadata": {
                "version": "1.0",
                "author": "测试系统"
            }
        }
        json.dump(test_data, f, ensure_ascii=False, indent=2)
        files['test.json'] = f.name
    
    print(f"✅ 创建了 {len(files)} 个测试文件")
    for name, path in files.items():
        print(f"  - {name}: {path}")
    
    return files

def test_file_upload(knowledge_id, files):
    """测试文件上传"""
    print(f"\n3. 测试文件上传到知识库 {knowledge_id}...")
    
    uploaded_files = []
    
    for filename, filepath in files.items():
        print(f"\n上传文件: {filename}")
        
        try:
            with open(filepath, 'rb') as f:
                files_data = {'file': (filename, f, 'text/plain')}
                response = requests.post(
                    f"{BASE_URL}/knowledges/{knowledge_id}/files",
                    files=files_data
                )
            
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    print(f"✅ {filename} 上传成功")
                    print(f"   文件大小: {result['data'].get('size', 'unknown')}")
                    print(f"   处理信息: {result['data'].get('processing_info', {})}")
                    uploaded_files.append(filename)
                else:
                    print(f"❌ {filename} 上传失败: {result.get('message')}")
            else:
                print(f"❌ {filename} HTTP错误: {response.status_code}")
                print(f"   响应: {response.text}")
                
        except Exception as e:
            print(f"❌ {filename} 上传异常: {e}")
    
    return uploaded_files

def test_get_files(knowledge_id):
    """测试获取文件列表"""
    print(f"\n4. 测试获取知识库 {knowledge_id} 的文件列表...")
    
    response = requests.get(f"{BASE_URL}/knowledges/{knowledge_id}/files")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            files = result['data']
            print(f"✅ 获取文件列表成功，共 {len(files)} 个文件")
            
            for i, file_info in enumerate(files, 1):
                print(f"  {i}. {file_info.get('name', 'unknown')}")
                print(f"     类型: {file_info.get('type', 'unknown')}")
                print(f"     大小: {file_info.get('size', 'unknown')}")
                print(f"     状态: {file_info.get('status', 'unknown')}")
                print(f"     上传时间: {file_info.get('upload_time', 'unknown')}")
            
            return files
        else:
            print(f"❌ 获取失败: {result.get('message')}")
    else:
        print(f"❌ HTTP错误: {response.status_code}")
        print(f"响应: {response.text}")
    
    return []

def test_file_content(knowledge_id, filename):
    """测试获取文件内容"""
    print(f"\n5. 测试获取文件内容: {filename}")
    
    response = requests.get(f"{BASE_URL}/knowledges/{knowledge_id}/files/{filename}/content")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            content = result['data']['content']
            print(f"✅ 获取文件内容成功")
            print(f"   文件类型: {result['data'].get('type', 'unknown')}")
            print(f"   内容长度: {len(content)} 字符")
            print(f"   内容预览: {content[:100]}...")
        else:
            print(f"❌ 获取失败: {result.get('message')}")
    else:
        print(f"❌ HTTP错误: {response.status_code}")
        print(f"响应: {response.text}")

def test_search_knowledge(knowledge_id):
    """测试知识库搜索"""
    print(f"\n6. 测试知识库搜索...")
    
    search_queries = ["测试", "内容", "Markdown"]
    
    for query in search_queries:
        print(f"\n搜索查询: '{query}'")
        
        data = {"query": query}
        response = requests.post(f"{BASE_URL}/knowledges/{knowledge_id}/search", json=data)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                results = result['data']['results']
                print(f"✅ 搜索成功，找到 {len(results)} 个结果")
                
                for i, item in enumerate(results[:3], 1):  # 只显示前3个结果
                    print(f"  {i}. 相似度: {item.get('score', 0):.3f}")
                    print(f"     来源: {item.get('source', 'unknown')}")
                    print(f"     内容: {item.get('content', '')[:50]}...")
            else:
                print(f"❌ 搜索失败: {result.get('message')}")
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            print(f"响应: {response.text}")

def test_delete_file(knowledge_id, filename):
    """测试删除文件"""
    print(f"\n7. 测试删除文件: {filename}")
    
    response = requests.delete(f"{BASE_URL}/knowledges/{knowledge_id}/files/{filename}")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print(f"✅ 文件 {filename} 删除成功")
        else:
            print(f"❌ 删除失败: {result.get('message')}")
    else:
        print(f"❌ HTTP错误: {response.status_code}")
        print(f"响应: {response.text}")

def cleanup_test_knowledge(knowledge_id):
    """清理测试知识库"""
    print(f"\n8. 清理测试知识库 {knowledge_id}...")
    
    response = requests.delete(f"{BASE_URL}/knowledges/{knowledge_id}")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print(f"✅ 测试知识库删除成功")
        else:
            print(f"❌ 删除失败: {result.get('message')}")
    else:
        print(f"❌ HTTP错误: {response.status_code}")

def cleanup_test_files(files):
    """清理测试文件"""
    print("\n9. 清理临时测试文件...")
    
    for filename, filepath in files.items():
        try:
            os.unlink(filepath)
            print(f"✅ 删除临时文件: {filename}")
        except Exception as e:
            print(f"❌ 删除临时文件失败 {filename}: {e}")

def main():
    """主测试函数"""
    print("开始文档管理功能测试...")
    print("=" * 60)
    
    knowledge_id = None
    test_files = {}
    
    try:
        # 1. 创建测试知识库
        knowledge_id = create_test_knowledge()
        if not knowledge_id:
            print("❌ 无法创建测试知识库，测试终止")
            return
        
        # 2. 创建测试文件
        test_files = create_test_files()
        
        # 3. 测试文件上传
        uploaded_files = test_file_upload(knowledge_id, test_files)
        
        # 4. 测试获取文件列表
        file_list = test_get_files(knowledge_id)
        
        # 5. 测试获取文件内容
        if uploaded_files:
            test_file_content(knowledge_id, uploaded_files[0])
        
        # 6. 测试搜索功能
        test_search_knowledge(knowledge_id)
        
        # 7. 测试删除文件
        if uploaded_files:
            test_delete_file(knowledge_id, uploaded_files[0])
            
            # 再次获取文件列表验证删除
            print("\n验证删除结果:")
            test_get_files(knowledge_id)
        
    except Exception as e:
        print(f"❌ 测试过程中发生异常: {e}")
    
    finally:
        # 清理资源
        if knowledge_id:
            cleanup_test_knowledge(knowledge_id)
        
        if test_files:
            cleanup_test_files(test_files)
    
    print("\n" + "=" * 60)
    print("文档管理功能测试完成")

if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保后端服务正在运行在 http://localhost:8080")
    except KeyboardInterrupt:
        print("\n测试被用户中断")
    except Exception as e:
        print(f"❌ 测试失败: {e}")
