# 步骤1: 项目初始化

## 📦 创建 Electron 项目

### 1.1 创建目录结构

在项目根目录执行：

```bash
# 创建 electron 目录
mkdir electron
cd electron

# 初始化 npm 项目
npm init -y

# 创建资源目录
mkdir -p resources
```

### 1.2 安装依赖

```bash
# 核心依赖
npm install electron --save-dev

# 打包工具
npm install electron-builder --save-dev

# 运行时依赖
npm install axios electron-store --save

# 开发工具
npm install concurrently wait-on --save-dev
```

### 1.3 创建 package.json

编辑 `electron/package.json`:

```json
{
  "name": "abm-llm-desktop",
  "version": "0.10.0",
  "description": "ABM LLM Desktop Application",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\" \"wait-on http://localhost:3000 && electron .\"",
    "dev:backend": "cd ../backend && python3 run_app.py",
    "dev:frontend": "cd ../frontend && npm start",
    "build": "electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "author": "ABM Team",
  "license": "MIT",
  "devDependencies": {
    "concurrently": "^8.2.2",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "electron-store": "^8.1.0"
  },
  "build": {
    "appId": "com.abm.llm.desktop",
    "productName": "ABM LLM",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "resources/**/*",
      "../frontend/build/**/*"
    ],
    "extraResources": [
      {
        "from": "../backend/dist",
        "to": "backend",
        "filter": ["**/*"]
      }
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "icon": "resources/icon.icns",
      "target": ["dmg", "zip"]
    },
    "win": {
      "icon": "resources/icon.ico",
      "target": ["nsis", "portable"]
    },
    "linux": {
      "icon": "resources/icon.png",
      "target": ["AppImage", "deb"],
      "category": "Office"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

### 1.4 准备应用图标

1. **创建基础图标**: 准备一个 512x512 的 PNG 图标 `resources/icon.png`

2. **生成平台图标**:

```bash
# macOS (.icns)
# 使用 iconutil 或在线工具转换
# https://cloudconvert.com/png-to-icns

# Windows (.ico)
# 使用 ImageMagick 或在线工具
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Linux
# 直接使用 PNG
```

### 1.5 配置 .gitignore

在 `electron/.gitignore` 添加:

```
node_modules/
dist/
*.log
.DS_Store
```

---

## ✅ 验证安装

```bash
# 检查 Electron 版本
npx electron --version

# 应该输出类似: v28.0.0
```

---

## 🎯 下一步

继续 [02-main-process.md](./02-main-process.md) 开发主进程。
