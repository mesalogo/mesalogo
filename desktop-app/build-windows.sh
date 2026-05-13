#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
DESKTOP_DIR="$SCRIPT_DIR"

echo "=== ABM-LLM Desktop App Build Script (Windows via Docker) ==="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# 1. 构建前端
echo "[1/4] Building frontend..."
cd "$FRONTEND_DIR"
pnpm build

# 2. 复制前端构建产物到 desktop-app/dist
echo "[2/4] Copying frontend build to desktop-app/dist..."
rm -rf "$DESKTOP_DIR/dist"
cp -r "$FRONTEND_DIR/build" "$DESKTOP_DIR/dist"

# 3. 确保路径为绝对路径（适配 Electron 本地 HTTP 服务器 + SPA 路由）
echo "[3/4] Patching paths for Electron..."

# 检测 sed 版本（macOS vs Linux）
if [[ "$OSTYPE" == "darwin"* ]]; then
    SED_INPLACE="sed -i ''"
else
    SED_INPLACE="sed -i"
fi

# 在 index.html 头部添加 base 标签（使用绝对路径，避免 SPA 路由问题）
$SED_INPLACE 's|<head>|<head><base href="/">|' "$DESKTOP_DIR/dist/index.html"
echo "  Patched index.html with base href"

# 4. 使用 Docker 构建 Windows 应用
echo "[4/4] Building Windows application using Docker..."
cd "$DESKTOP_DIR"

docker run --rm \
  -v "$DESKTOP_DIR":/project \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  -w /project \
  electronuserland/builder:wine \
  /bin/bash -c "npm install && npm run build:win"

echo "=== Build complete! ==="
echo "Output: $DESKTOP_DIR/release/"
echo "Generated: .exe installer (NSIS format)"
