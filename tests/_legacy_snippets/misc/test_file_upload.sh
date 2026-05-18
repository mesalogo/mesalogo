#!/bin/bash

# 测试文档管理功能的简单脚本

BASE_URL="http://localhost:8080/api"
KNOWLEDGE_ID=1  # 使用现有的知识库ID

echo "开始测试文档管理功能..."
echo "使用知识库ID: $KNOWLEDGE_ID"
echo "================================"

# 1. 测试获取文件列表
echo "1. 测试获取文件列表..."
curl -X GET "$BASE_URL/knowledges/$KNOWLEDGE_ID/files" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo -e "\n================================"

# 2. 创建测试文件
echo "2. 创建测试文件..."
TEST_FILE="/tmp/test_document.txt"
cat > "$TEST_FILE" << EOF
这是一个测试文档。
包含一些中文内容用于测试向量化处理。
这是第三行内容。
测试文档管理功能。
EOF

echo "测试文件已创建: $TEST_FILE"
echo "文件内容:"
cat "$TEST_FILE"

echo -e "\n================================"

# 3. 测试文件上传
echo "3. 测试文件上传..."
curl -X POST "$BASE_URL/knowledges/$KNOWLEDGE_ID/files" \
  -F "file=@$TEST_FILE" \
  | python3 -m json.tool

echo -e "\n================================"

# 4. 再次获取文件列表，验证上传
echo "4. 验证文件上传 - 再次获取文件列表..."
curl -X GET "$BASE_URL/knowledges/$KNOWLEDGE_ID/files" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo -e "\n================================"

# 5. 测试获取文件内容
echo "5. 测试获取文件内容..."
curl -X GET "$BASE_URL/knowledges/$KNOWLEDGE_ID/files/test_document.txt/content" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo -e "\n================================"

# 6. 测试搜索功能
echo "6. 测试搜索功能..."
curl -X POST "$BASE_URL/knowledges/$KNOWLEDGE_ID/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "测试"}' \
  | python3 -m json.tool

echo -e "\n================================"

# 7. 测试删除文件
echo "7. 测试删除文件..."
curl -X DELETE "$BASE_URL/knowledges/$KNOWLEDGE_ID/files/test_document.txt" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo -e "\n================================"

# 8. 最后再次获取文件列表，验证删除
echo "8. 验证文件删除 - 最后获取文件列表..."
curl -X GET "$BASE_URL/knowledges/$KNOWLEDGE_ID/files" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo -e "\n================================"

# 清理
echo "9. 清理临时文件..."
rm -f "$TEST_FILE"
echo "测试完成！"
