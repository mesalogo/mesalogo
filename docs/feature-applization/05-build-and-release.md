# 步骤5: 应用打包与发布

## 🚀 完整构建流程

### 5.1 构建前准备

```bash
# 1. 清理之前的构建
cd electron
rm -rf dist node_modules
npm install

cd ../frontend
rm -rf build node_modules
npm install

cd ../backend
rm -rf dist build *.spec
```

### 5.2 构建步骤

创建 `electron/build.sh` (macOS/Linux):

```bash
#!/bin/bash
set -e

echo "========================================="
echo "ABM LLM Desktop 构建脚本"
echo "========================================="

# 1. 构建前端
echo "📦 步骤1: 构建 React 前端..."
cd ../frontend
npm run build:electron
echo "✅ 前端构建完成"

# 2. 打包后端
echo "📦 步骤2: 打包 Flask 后端..."
cd ../backend
python3 build.py --clean
echo "✅ 后端打包完成"

# 3. 打包 Electron 应用
echo "📦 步骤3: 打包 Electron 应用..."
cd ../electron

# 根据平台选择构建目标
if [[ "$OSTYPE" == "darwin"* ]]; then
    npm run build:mac
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    npm run build:linux
else
    echo "❌ 不支持的操作系统"
    exit 1
fi

echo "========================================="
echo "✅ 构建完成！"
echo "📁 输出目录: electron/dist"
echo "========================================="
```

创建 `electron/build.bat` (Windows):

```batch
@echo off
echo =========================================
echo ABM LLM Desktop 构建脚本
echo =========================================

REM 1. 构建前端
echo 📦 步骤1: 构建 React 前端...
cd ..\frontend
call npm run build:electron
if errorlevel 1 goto error
echo ✅ 前端构建完成

REM 2. 打包后端
echo 📦 步骤2: 打包 Flask 后端...
cd ..\backend
python build.py --clean
if errorlevel 1 goto error
echo ✅ 后端打包完成

REM 3. 打包 Electron 应用
echo 📦 步骤3: 打包 Electron 应用...
cd ..\electron
call npm run build:win
if errorlevel 1 goto error

echo =========================================
echo ✅ 构建完成！
echo 📁 输出目录: electron\dist
echo =========================================
goto end

:error
echo ❌ 构建失败！
exit /b 1

:end
```

### 5.3 执行构建

```bash
# macOS/Linux
chmod +x electron/build.sh
./electron/build.sh

# Windows
electron\build.bat
```

---

## 📦 electron-builder 高级配置

### 完整的 `electron/electron-builder.json`:

```json
{
  "appId": "com.abm.llm.desktop",
  "productName": "ABM LLM",
  "copyright": "Copyright © 2024 ABM Team",
  "directories": {
    "output": "dist",
    "buildResources": "resources"
  },
  "files": [
    "main.js",
    "preload.js",
    "package.json",
    "node_modules/**/*",
    "../frontend/build/**/*"
  ],
  "extraResources": [
    {
      "from": "../backend/dist",
      "to": "backend",
      "filter": ["**/*"]
    },
    {
      "from": "../backend/app.db",
      "to": "backend",
      "filter": ["app.db"]
    }
  ],
  "mac": {
    "category": "public.app-category.productivity",
    "icon": "resources/icon.icns",
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      },
      {
        "target": "zip",
        "arch": ["x64", "arm64"]
      }
    ],
    "darkModeSupport": true,
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "resources/entitlements.mac.plist",
    "entitlementsInherit": "resources/entitlements.mac.plist"
  },
  "dmg": {
    "contents": [
      {
        "x": 130,
        "y": 220
      },
      {
        "x": 410,
        "y": 220,
        "type": "link",
        "path": "/Applications"
      }
    ],
    "window": {
      "width": 540,
      "height": 380
    }
  },
  "win": {
    "icon": "resources/icon.ico",
    "target": [
      {
        "target": "nsis",
        "arch": ["x64", "ia32"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      },
      {
        "target": "zip",
        "arch": ["x64"]
      }
    ],
    "verifyUpdateCodeSignature": false
  },
  "nsis": {
    "oneClick": false,
    "allowElevation": true,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "ABM LLM",
    "artifactName": "${productName}-Setup-${version}.${ext}",
    "deleteAppDataOnUninstall": false,
    "installerIcon": "resources/icon.ico",
    "uninstallerIcon": "resources/icon.ico",
    "installerHeaderIcon": "resources/icon.ico"
  },
  "portable": {
    "artifactName": "${productName}-Portable-${version}.${ext}"
  },
  "linux": {
    "icon": "resources/icon.png",
    "target": [
      "AppImage",
      "deb",
      "rpm",
      "snap"
    ],
    "category": "Office",
    "desktop": {
      "Name": "ABM LLM",
      "Comment": "AI Agent Based Management System",
      "Type": "Application",
      "Terminal": false
    }
  },
  "appImage": {
    "artifactName": "${productName}-${version}.${ext}"
  },
  "snap": {
    "confinement": "classic",
    "grade": "stable"
  },
  "publish": {
    "provider": "github",
    "owner": "your-github-username",
    "repo": "abm-llm-v2"
  }
}
```

### macOS 授权文件

创建 `electron/resources/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
  </dict>
</plist>
```

---

## 🔐 代码签名（可选）

### macOS 代码签名

```bash
# 1. 获取开发者证书
# 从 Apple Developer 账户下载

# 2. 在 electron-builder.json 中配置
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)",
    "hardenedRuntime": true
  }
}

# 3. 公证应用（notarization）
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
npm run build:mac
```

### Windows 代码签名

```bash
# 1. 获取证书（.pfx 文件）

# 2. 在 electron-builder.json 中配置
{
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "password",
    "signingHashAlgorithms": ["sha256"]
  }
}

# 3. 或使用环境变量
set CSC_LINK=path\to\certificate.pfx
set CSC_KEY_PASSWORD=password
npm run build:win
```

---

## 🌐 自动更新配置

### 使用 electron-updater

```bash
npm install electron-updater --save
```

修改 `electron/main.js`:

```javascript
const { autoUpdater } = require('electron-updater');

// 配置更新
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-username',
  repo: 'abm-llm-v2'
});

// 检查更新
app.on('ready', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

// 更新事件
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: '发现新版本',
    message: '正在下载更新...'
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: '更新就绪',
    message: '更新已下载，重启应用后生效',
    buttons: ['立即重启', '稍后']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
```

---

## 📊 构建产物

成功构建后，`electron/dist/` 目录结构：

```
dist/
├── mac/
│   ├── ABM LLM.app                    # macOS 应用
│   └── ABM LLM-0.10.0-arm64.dmg       # 安装镜像
├── win-unpacked/                       # Windows 解压版
└── ABM LLM Setup 0.10.0.exe           # Windows 安装程序
```

**文件大小预估**:
- macOS: ~180-250 MB
- Windows: ~150-200 MB
- Linux: ~160-220 MB

---

## 📦 发布到 GitHub Releases

### 手动发布

```bash
# 1. 创建 tag
git tag v0.10.0
git push origin v0.10.0

# 2. 在 GitHub 创建 Release
# 上传 dist/ 目录中的安装包

# 3. 编写 Release Notes
```

### 自动发布

使用 GitHub Actions，创建 `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Build Frontend
        run: |
          cd frontend
          npm install
          npm run build:electron
      
      - name: Build Backend
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pyinstaller
          python build.py
      
      - name: Build Electron App
        run: |
          cd electron
          npm install
          npm run build
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Upload Release Assets
        uses: softprops/action-gh-release@v1
        with:
          files: electron/dist/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 🧪 测试清单

- [ ] 应用能正常启动
- [ ] Flask 后端能正常响应
- [ ] 前端界面显示正常
- [ ] API 调用正常
- [ ] 数据库读写正常
- [ ] 文件上传/下载功能正常
- [ ] 系统托盘正常工作
- [ ] 窗口最小化/关闭行为正确
- [ ] 系统通知正常
- [ ] 应用退出时清理进程
- [ ] 安装/卸载正常
- [ ] 自动更新功能正常（如启用）

---

## 🎯 完成！

至此，Electron 多平台应用改造方案文档已完成。按照以上步骤，您可以将 Flask + React 应用成功改造为跨平台桌面应用。
