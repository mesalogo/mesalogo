#!/bin/bash
# MesaLogo Desktop 更新服务器构建脚本
# 用法: ./publish-update-server.sh [--upload]
#
# 目录结构:
#   update.example.com/
#   ├── index.html
#   ├── latest-mac.yml -> v0.13.0/latest-mac.yml
#   ├── latest.yml -> v0.13.0/latest.yml
#   ├── v0.12.0/
#   │   ├── MesaLogo-0.12.0-arm64.dmg
#   │   ├── MesaLogo-0.12.0-arm64-mac.zip
#   │   └── ...
#   └── v0.13.0/
#       ├── MesaLogo-0.13.0-arm64.dmg
#       ├── MesaLogo-0.13.0-arm64-mac.zip
#       ├── latest-mac.yml
#       └── ...

set -e

# 配置
VERSION=$(node -p "require('./package.json').version")
OUTPUT_DIR="./update.example.com"
VERSION_DIR="${OUTPUT_DIR}/v${VERSION}"
REMOTE_SERVER=""
UPDATE_BASE_URL="${UPDATE_BASE_URL:-https://update.example.com}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 跨平台获取文件大小
get_file_size() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        stat -f%z "$1"
    else
        stat -c%s "$1"
    fi
}

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 解析参数
DO_UPLOAD=false
for arg in "$@"; do
    case $arg in
        --upload) DO_UPLOAD=true ;;
    esac
done

echo "============================================"
echo "  MesaLogo Update Server Builder"
echo "  Version: ${VERSION}"
echo "============================================"
echo ""

# 创建版本目录
mkdir -p "${VERSION_DIR}"

# 复制构建产物到版本目录
copy_release_files() {
    log_info "Copying release files to ${VERSION_DIR}..."
    
    if [ ! -d "./release" ]; then
        log_error "release/ directory not found. Please build first with: npm run build"
        exit 1
    fi
    
    # 处理版本号：electron-builder 会省略末尾的 .0，例如 0.14.0 -> 0.14
    VERSION_SHORT="${VERSION%.0}"
    
    # macOS
    if ls ./release/*-${VERSION_SHORT}*.dmg 1> /dev/null 2>&1; then
        cp ./release/*-${VERSION_SHORT}*.dmg "${VERSION_DIR}/"
        cp ./release/*-${VERSION_SHORT}*.dmg.blockmap "${VERSION_DIR}/" 2>/dev/null || true
    fi
    if ls ./release/*-${VERSION_SHORT}*-mac.zip 1> /dev/null 2>&1; then
        cp ./release/*-${VERSION_SHORT}*-mac.zip "${VERSION_DIR}/"
        cp ./release/*-${VERSION_SHORT}*-mac.zip.blockmap "${VERSION_DIR}/" 2>/dev/null || true
    fi
    
    # Windows (支持新旧文件名格式)
    if ls ./release/*${VERSION_SHORT}*.exe 1> /dev/null 2>&1; then
        cp ./release/*${VERSION_SHORT}*.exe "${VERSION_DIR}/"
        cp ./release/*${VERSION_SHORT}*.exe.blockmap "${VERSION_DIR}/" 2>/dev/null || true
    fi
    
    # Linux
    if ls ./release/*-${VERSION_SHORT}*.AppImage 1> /dev/null 2>&1; then
        cp ./release/*-${VERSION_SHORT}*.AppImage "${VERSION_DIR}/"
    fi
    
    log_info "Release files copied to ${VERSION_DIR}"
}

# 生成并更新 yml 文件
generate_yml_files() {
    log_info "Generating yml files..."
    
    # macOS yml
    if ls "${VERSION_DIR}"/*-mac.zip 1> /dev/null 2>&1; then
        MAC_ZIP=$(ls "${VERSION_DIR}"/*-mac.zip | head -1)
        MAC_ZIP=$(basename "$MAC_ZIP")
        MAC_ZIP_SIZE=$(get_file_size "${VERSION_DIR}/${MAC_ZIP}")
        MAC_ZIP_SHA512=$(shasum -a 512 "${VERSION_DIR}/${MAC_ZIP}" | awk '{print $1}' | xxd -r -p | base64)
        
        MAC_DMG=""
        if ls "${VERSION_DIR}"/*.dmg 1> /dev/null 2>&1; then
            MAC_DMG=$(ls "${VERSION_DIR}"/*.dmg | head -1)
            MAC_DMG=$(basename "$MAC_DMG")
        fi
        
        cat > "${VERSION_DIR}/latest-mac.yml" << EOF
version: ${VERSION}
files:
  - url: v${VERSION}/${MAC_ZIP}
    sha512: ${MAC_ZIP_SHA512}
    size: ${MAC_ZIP_SIZE}
EOF
        
        if [ -n "$MAC_DMG" ]; then
            MAC_DMG_SIZE=$(get_file_size "${VERSION_DIR}/${MAC_DMG}")
            MAC_DMG_SHA512=$(shasum -a 512 "${VERSION_DIR}/${MAC_DMG}" | awk '{print $1}' | xxd -r -p | base64)
            cat >> "${VERSION_DIR}/latest-mac.yml" << EOF
  - url: v${VERSION}/${MAC_DMG}
    sha512: ${MAC_DMG_SHA512}
    size: ${MAC_DMG_SIZE}
EOF
        fi
        
        cat >> "${VERSION_DIR}/latest-mac.yml" << EOF
path: v${VERSION}/${MAC_ZIP}
sha512: ${MAC_ZIP_SHA512}
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
EOF
        
        # 复制到根目录（不用符号链接，兼容性更好）
        cp "${VERSION_DIR}/latest-mac.yml" "${OUTPUT_DIR}/latest-mac.yml"
        log_info "Created latest-mac.yml"
    fi
    
    # Windows yml
    if ls "${VERSION_DIR}"/*.exe 1> /dev/null 2>&1; then
        WIN_EXE=$(ls "${VERSION_DIR}"/*.exe | head -1)
        WIN_EXE=$(basename "$WIN_EXE")
        WIN_EXE_SIZE=$(get_file_size "${VERSION_DIR}/${WIN_EXE}")
        WIN_EXE_SHA512=$(shasum -a 512 "${VERSION_DIR}/${WIN_EXE}" | awk '{print $1}' | xxd -r -p | base64)
        
        cat > "${VERSION_DIR}/latest.yml" << EOF
version: ${VERSION}
files:
  - url: v${VERSION}/${WIN_EXE}
    sha512: ${WIN_EXE_SHA512}
    size: ${WIN_EXE_SIZE}
path: v${VERSION}/${WIN_EXE}
sha512: ${WIN_EXE_SHA512}
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
EOF
        
        cp "${VERSION_DIR}/latest.yml" "${OUTPUT_DIR}/latest.yml"
        log_info "Created latest.yml"
    fi
    
    # Linux yml
    if ls "${VERSION_DIR}"/*.AppImage 1> /dev/null 2>&1; then
        LINUX_APP=$(ls "${VERSION_DIR}"/*.AppImage | head -1)
        LINUX_APP=$(basename "$LINUX_APP")
        LINUX_APP_SIZE=$(get_file_size "${VERSION_DIR}/${LINUX_APP}")
        LINUX_APP_SHA512=$(shasum -a 512 "${VERSION_DIR}/${LINUX_APP}" | awk '{print $1}' | xxd -r -p | base64)
        
        cat > "${VERSION_DIR}/latest-linux.yml" << EOF
version: ${VERSION}
files:
  - url: v${VERSION}/${LINUX_APP}
    sha512: ${LINUX_APP_SHA512}
    size: ${LINUX_APP_SIZE}
path: v${VERSION}/${LINUX_APP}
sha512: ${LINUX_APP_SHA512}
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
EOF
        
        cp "${VERSION_DIR}/latest-linux.yml" "${OUTPUT_DIR}/latest-linux.yml"
        log_info "Created latest-linux.yml"
    fi
}

# 生成索引页
generate_index_html() {
    log_info "Generating index.html..."
    
    # 获取所有版本目录
    VERSIONS=$(ls -d "${OUTPUT_DIR}"/v* 2>/dev/null | xargs -n1 basename | sort -V -r || echo "")
    
    # 生成版本列表 HTML
    VERSION_LIST=""
    for ver in $VERSIONS; do
        ver_num=${ver#v}
        VERSION_LIST="${VERSION_LIST}<li><a href=\"${ver}/\">${ver}</a></li>"
    done
    
    # 获取最新版本的下载链接
    DOWNLOAD_BUTTONS=""
    if [ -f "${VERSION_DIR}/latest-mac.yml" ]; then
        MAC_DMG=$(ls "${VERSION_DIR}"/*.dmg 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo "")
        if [ -n "$MAC_DMG" ]; then
            DOWNLOAD_BUTTONS="${DOWNLOAD_BUTTONS}<a class=\"download-btn\" href=\"v${VERSION}/${MAC_DMG}\">macOS (.dmg)</a>"
        fi
    fi
    if [ -f "${VERSION_DIR}/latest.yml" ]; then
        WIN_EXE=$(ls "${VERSION_DIR}"/*.exe 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo "")
        if [ -n "$WIN_EXE" ]; then
            DOWNLOAD_BUTTONS="${DOWNLOAD_BUTTONS}<a class=\"download-btn\" href=\"v${VERSION}/${WIN_EXE}\">Windows (.exe)</a>"
        fi
    fi
    if [ -f "${VERSION_DIR}/latest-linux.yml" ]; then
        LINUX_APP=$(ls "${VERSION_DIR}"/*.AppImage 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo "")
        if [ -n "$LINUX_APP" ]; then
            DOWNLOAD_BUTTONS="${DOWNLOAD_BUTTONS}<a class=\"download-btn\" href=\"v${VERSION}/${LINUX_APP}\">Linux (.AppImage)</a>"
        fi
    fi
    
    cat > "${OUTPUT_DIR}/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>MesaLogo Updates</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .version { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .download-btn { display: inline-block; padding: 10px 20px; background: #1890ff; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
        .download-btn:hover { background: #40a9ff; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
        .version-list { margin-top: 20px; }
        .version-list ul { list-style: none; padding: 0; }
        .version-list li { padding: 5px 0; }
        .version-list a { color: #1890ff; text-decoration: none; }
        .version-list a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>MesaLogo Desktop Updates</h1>
    <div class="version">
        <h2>Latest Version: ${VERSION}</h2>
        <p>Release Date: $(date +%Y-%m-%d)</p>
        <h3>Downloads</h3>
        ${DOWNLOAD_BUTTONS}
    </div>
    <h3>Auto Update Endpoints</h3>
    <ul>
        <li>macOS: <code>${UPDATE_BASE_URL}/latest-mac.yml</code></li>
        <li>Windows: <code>${UPDATE_BASE_URL}/latest.yml</code></li>
        <li>Linux: <code>${UPDATE_BASE_URL}/latest-linux.yml</code></li>
    </ul>
    <div class="version-list">
        <h3>All Versions</h3>
        <ul>${VERSION_LIST}</ul>
    </div>
</body>
</html>
EOF
}

# 上传到远程服务器
upload_to_server() {
    if [ -z "$REMOTE_SERVER" ]; then
        log_warn "REMOTE_SERVER not configured. Skipping upload."
        log_info "To upload, set REMOTE_SERVER in this script or run:"
        log_info "  rsync -avz --progress ${OUTPUT_DIR}/ user@server:/path/to/updates/"
        return
    fi
    
    log_info "Uploading to ${REMOTE_SERVER}..."
    rsync -avz --progress "${OUTPUT_DIR}/" "${REMOTE_SERVER}/"
    log_info "Upload complete"
}

# 显示构建结果
show_summary() {
    echo ""
    echo "============================================"
    echo "  Build Summary"
    echo "============================================"
    echo ""
    log_info "Output directory: ${OUTPUT_DIR}"
    log_info "Version directory: ${VERSION_DIR}"
    echo ""
    echo "Directory structure:"
    find "${OUTPUT_DIR}" -maxdepth 2 -type f -o -type l | sort
    echo ""
    log_info "To test locally, run:"
    echo "  cd ${OUTPUT_DIR} && python3 -m http.server 8080"
    echo "  Then set update URL to: http://localhost:8080"
}

# 主流程
copy_release_files
generate_yml_files
generate_index_html

if [ "$DO_UPLOAD" = true ]; then
    upload_to_server
fi

show_summary

log_info "Done!"
