#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BACKEND_IMAGE="${BACKEND_IMAGE:-mesalogo/backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-mesalogo/frontend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=== ABM-LLM Docker Image Builder ==="
echo "Project root: $PROJECT_ROOT"
echo "Backend image: $BACKEND_IMAGE:$IMAGE_TAG"
echo "Frontend image: $FRONTEND_IMAGE:$IMAGE_TAG"
echo ""

# 从 backend 目录拷贝配置文件到 abm-docker（如果不存在）
copy_config_files() {
    if [ ! -f "$SCRIPT_DIR/config.conf" ]; then
        echo "==> Copying config.conf from backend..."
        cp "$PROJECT_ROOT/backend/config.conf" "$SCRIPT_DIR/config.conf"
    fi
    if [ ! -f "$SCRIPT_DIR/mcp_config.json" ]; then
        echo "==> Copying mcp_config.json from backend..."
        cp "$PROJECT_ROOT/backend/mcp_config.json" "$SCRIPT_DIR/mcp_config.json"
    fi
    if [ ! -d "$SCRIPT_DIR/volumes/backend-knowledgebase" ]; then
        echo "==> Copying knowledgebase from backend..."
        mkdir -p "$SCRIPT_DIR/volumes/backend-knowledgebase"
        cp -r "$PROJECT_ROOT/backend/knowledgebase/demo_files" "$SCRIPT_DIR/volumes/backend-knowledgebase/"
        cp "$PROJECT_ROOT/backend/knowledgebase/README.md" "$SCRIPT_DIR/volumes/backend-knowledgebase/" 2>/dev/null || true
    fi
}

build_backend() {
    copy_config_files
    echo "==> Building backend image..."
    docker build \
        -t "${BACKEND_IMAGE}:${IMAGE_TAG}" \
        -f "$SCRIPT_DIR/backend.Dockerfile" \
        "$PROJECT_ROOT"
    echo "==> Backend image built: ${BACKEND_IMAGE}:${IMAGE_TAG}"
}

build_frontend() {
    echo "==> Building frontend image..."
    docker build \
        -t "${FRONTEND_IMAGE}:${IMAGE_TAG}" \
        -f "$SCRIPT_DIR/frontend.Dockerfile" \
        "$PROJECT_ROOT"
    echo "==> Frontend image built: ${FRONTEND_IMAGE}:${IMAGE_TAG}"
}

build_all() {
    build_backend
    echo ""
    build_frontend
}

show_help() {
    echo "Usage: $0 [backend|frontend|all]"
    echo ""
    echo "Options:"
    echo "  backend   Build backend image only"
    echo "  frontend  Build frontend image only"
    echo "  all       Build all images (default)"
    echo ""
    echo "Environment variables:"
    echo "  BACKEND_IMAGE   Backend image name (default: mesalogo/backend)"
    echo "  FRONTEND_IMAGE  Frontend image name (default: mesalogo/frontend)"
    echo "  IMAGE_TAG       Image tag (default: latest)"
}

case "${1:-all}" in
    backend)
        build_backend
        ;;
    frontend)
        build_frontend
        ;;
    all)
        build_all
        ;;
    -h|--help|help)
        show_help
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac

echo ""
echo "=== Build completed ==="
docker images | grep "mesalogo" | head -10
