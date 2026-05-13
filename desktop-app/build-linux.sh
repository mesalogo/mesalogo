#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
DESKTOP_DIR="$SCRIPT_DIR"

echo "=== ABM-LLM Desktop App Build Script (Electron) for Linux ==="

# 1. 构建前端
echo "[1/5] Building frontend..."
cd "$FRONTEND_DIR"
pnpm build

# 2. 复制前端构建产物到 desktop-app/dist
echo "[2/5] Copying frontend build to desktop-app/dist..."
rm -rf "$DESKTOP_DIR/dist"
cp -r "$FRONTEND_DIR/build" "$DESKTOP_DIR/dist"

# 3. 确保路径为绝对路径（适配 Electron 本地 HTTP 服务器 + SPA 路由）
echo "[3/5] Patching paths for Electron..."

# 在 index.html 头部添加 base 标签（使用绝对路径，避免 SPA 路由问题）
sed -i 's|<head>|<head><base href="/">|' "$DESKTOP_DIR/dist/index.html"
echo "  Patched index.html with base href"

# 4. 安装依赖（如果需要）
echo "[4/5] Checking dependencies..."
cd "$DESKTOP_DIR"
if [ ! -d "node_modules" ]; then
  npm install
fi

# 5. 构建 Electron 应用
echo "[5/5] Building Electron application for Linux..."
npm run build:linux

echo "=== Build complete! ==="
echo "Output: $DESKTOP_DIR/release/"
