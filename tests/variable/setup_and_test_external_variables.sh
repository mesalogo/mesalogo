#!/bin/bash

# 外部环境变量功能设置和测试脚本

set -e  # 遇到错误立即退出

echo "=========================================="
echo "外部环境变量功能设置和测试"
echo "=========================================="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "项目根目录: $PROJECT_ROOT"

# 1. 创建数据库表
echo ""
echo "1. 创建外部环境变量数据库表..."
cd "$PROJECT_ROOT"
python3 scripts/create_external_variables_table.py

if [ $? -ne 0 ]; then
    echo "❌ 数据库表创建失败"
    exit 1
fi

echo "✅ 数据库表创建成功"

# 2. 启动后端服务器（后台运行）
echo ""
echo "2. 启动后端服务器..."

# 检查是否已有服务器在运行
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ 后端服务器已在运行"
else
    echo "启动后端服务器..."
    cd "$PROJECT_ROOT"
    
    # 后台启动服务器
    nohup python3 run_app.py > logs/server.log 2>&1 &
    SERVER_PID=$!
    
    echo "服务器PID: $SERVER_PID"
    echo "等待服务器启动..."
    
    # 等待服务器启动
    for i in {1..30}; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo "✅ 后端服务器启动成功"
            break
        fi
        
        if [ $i -eq 30 ]; then
            echo "❌ 后端服务器启动超时"
            kill $SERVER_PID 2>/dev/null || true
            exit 1
        fi
        
        echo "等待中... ($i/30)"
        sleep 2
    done
fi

# 3. 运行测试
echo ""
echo "3. 运行外部环境变量功能测试..."
cd "$PROJECT_ROOT"
python3 scripts/test_external_variables.py

TEST_RESULT=$?

# 4. 清理（可选）
echo ""
echo "4. 测试完成"

if [ $TEST_RESULT -eq 0 ]; then
    echo "🎉 所有测试通过！"
    echo ""
    echo "你现在可以："
    echo "1. 访问 http://localhost:8080 查看前端界面"
    echo "2. 在行动空间 -> 环境变量 -> 外部环境变量 中管理外部变量"
    echo "3. 查看 logs/server.log 了解服务器日志"
    echo ""
    echo "后端服务器仍在运行，使用以下命令停止："
    echo "pkill -f 'python3 run_app.py'"
else
    echo "❌ 测试失败，请检查日志"
    echo "服务器日志: logs/server.log"
fi

exit $TEST_RESULT
