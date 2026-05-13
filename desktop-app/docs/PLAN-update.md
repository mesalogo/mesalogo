# Desktop App 自动更新功能计划

## 概述

为 MesaLogo Desktop 应用添加"检查更新"功能，让用户能够方便地获取最新版本。

## 菜单位置

| 平台 | 位置 |
|------|------|
| macOS | `MesaLogo` -> `检查更新...` (在"关于"下方) |
| Windows/Linux | `帮助` -> `检查更新...` |

## 技术方案

### 推荐: 混合更新方案

根据更新内容类型，采用不同的更新策略：

| 更新类型 | 内容 | 方案 | 是否重启 | 更新大小 |
|----------|------|------|----------|----------|
| 前端更新 | dist/ 目录 (UI/业务逻辑) | Web 热更新 | 否，刷新即可 | ~1-5MB |
| 主进程更新 | main.js, preload.js (status bar, 菜单等) | electron-updater 差分更新 | 是，需重启 | ~2-10MB |
| 全量更新 | 整个应用 | electron-updater | 是，需重启 | ~150MB |

**优势:**
- 高频的前端更新 -> 无感知热更新，用户体验好
- 低频的主进程更新 -> 差分下载，更新包小
- 灵活控制，按需选择更新方式

---

## 服务端部署

### 目录结构

```
https://update.mesalogo.com/
├── latest.yml                    # macOS 主进程更新元数据
├── latest-linux.yml              # Linux 主进程更新元数据  
├── latest.yml                    # Windows 主进程更新元数据
├── MesaLogo-0.12.0.dmg          # macOS 安装包
├── MesaLogo-0.12.0.dmg.blockmap # macOS 差分文件
├── MesaLogo-0.12.0-mac.zip      # macOS zip包
├── MesaLogo-0.12.0-mac.zip.blockmap
├── MesaLogo-Setup-0.12.0.exe    # Windows 安装包
├── MesaLogo-Setup-0.12.0.exe.blockmap
├── MesaLogo-0.12.0.AppImage     # Linux 安装包
├── MesaLogo-0.12.0.AppImage.blockmap
└── web/                          # 前端热更新目录
    ├── manifest.json             # 前端版本清单
    ├── 0.12.1/                   # 版本目录
    │   └── dist.zip              # 前端资源包
    └── 0.12.2/
        └── dist.zip
```

### latest.yml 格式 (electron-updater 标准格式)

```yaml
version: 0.12.0
releaseDate: '2024-01-04T00:00:00.000Z'
path: MesaLogo-0.12.0.dmg
sha512: <sha512-hash>
size: 157286400
blockMapSize: 162580
```

### web/manifest.json 格式 (前端热更新)

```json
{
  "version": "0.12.1",
  "releaseDate": "2024-01-04T10:00:00.000Z",
  "url": "https://update.mesalogo.com/web/0.12.1/dist.zip",
  "sha256": "abc123...",
  "size": 2048576,
  "changelog": "- 修复登录页面样式问题\n- 优化任务列表加载速度",
  "minElectronVersion": "0.12.0"
}
```

### 服务端部署选项

#### 选项 1: 静态文件服务器 (推荐)

使用 Nginx 托管静态文件，最简单：

```nginx
server {
    listen 443 ssl;
    server_name update.mesalogo.com;
    
    root /var/www/mesalogo-updates;
    
    location / {
        autoindex off;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "no-cache";
    }
}
```

#### 选项 2: 对象存储 (OSS/S3)

- 阿里云 OSS / 腾讯云 COS / AWS S3
- 成本低，CDN 加速
- 配置 CORS 允许跨域

#### 选项 3: GitHub Releases

- 免费，适合开源项目
- electron-builder 原生支持
- 国内访问可能较慢

---

## 构建脚本

### build-update.sh

```bash
#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")
OUTPUT_DIR="./release"
UPDATE_SERVER="user@update.mesalogo.com:/var/www/mesalogo-updates"

echo "=== Building MesaLogo v${VERSION} ==="

# 1. 构建前端
echo "Building frontend..."
cd ../frontend
npm run build
cp -r dist ../desktop-app/dist

# 2. 构建 Electron 应用 (生成 blockmap 差分文件)
echo "Building Electron app..."
cd ../desktop-app
npx electron-builder --mac --win --linux --publish never

# 3. 打包前端热更新包
echo "Packaging web update..."
mkdir -p "${OUTPUT_DIR}/web/${VERSION}"
cd dist && zip -r "../${OUTPUT_DIR}/web/${VERSION}/dist.zip" . && cd ..

# 4. 生成前端 manifest.json
DIST_ZIP="${OUTPUT_DIR}/web/${VERSION}/dist.zip"
SHA256=$(shasum -a 256 "$DIST_ZIP" | cut -d' ' -f1)
SIZE=$(stat -f%z "$DIST_ZIP")

cat > "${OUTPUT_DIR}/web/manifest.json" << EOF
{
  "version": "${VERSION}",
  "releaseDate": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "url": "https://update.mesalogo.com/web/${VERSION}/dist.zip",
  "sha256": "${SHA256}",
  "size": ${SIZE},
  "changelog": "",
  "minElectronVersion": "0.12.0"
}
EOF

# 5. 上传到更新服务器
echo "Uploading to update server..."
rsync -avz --progress "${OUTPUT_DIR}/" "${UPDATE_SERVER}/"

echo "=== Build complete ==="
echo "Version: ${VERSION}"
echo "Files uploaded to: ${UPDATE_SERVER}"
```

### package.json 配置

```json
{
  "build": {
    "appId": "com.mesalogo.desktop",
    "productName": "MesaLogo",
    "publish": {
      "provider": "generic",
      "url": "https://update.mesalogo.com"
    },
    "mac": {
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis"]
    },
    "linux": {
      "target": ["AppImage"]
    },
    "nsis": {
      "differentialPackage": true
    }
  }
}
```

---

## 客户端实现

### 1. 安装依赖

```bash
npm install electron-updater
```

### 2. 配置 package.json

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-org",
      "repo": "abm-llm-v2"
    }
  }
}
```

### 3. 主进程代码 (main.js)

```javascript
const { autoUpdater } = require('electron-updater');

// 配置更新
autoUpdater.autoDownload = false; // 不自动下载，让用户确认
autoUpdater.autoInstallOnAppQuit = true;

// 检查更新
function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

// 更新事件
autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '发现新版本',
    message: `发现新版本 ${info.version}，是否下载？`,
    buttons: ['下载', '稍后']
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-not-available', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '检查更新',
    message: '当前已是最新版本'
  });
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow.setProgressBar(progress.percent / 100);
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.setProgressBar(-1);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '更新就绪',
    message: '新版本已下载完成，重启应用以完成更新',
    buttons: ['立即重启', '稍后']
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (error) => {
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: '更新错误',
    message: `检查更新失败: ${error.message}`
  });
});
```

### 4. 菜单集成

```javascript
// macOS 应用菜单
{
  label: app.name,
  submenu: [
    { role: 'about', label: '关于 MesaLogo' },
    {
      label: '检查更新...',
      click: () => checkForUpdates()
    },
    { type: 'separator' },
    // ...
  ]
}

// Windows/Linux 帮助菜单
{
  label: '帮助',
  submenu: [
    {
      label: '检查更新...',
      click: () => checkForUpdates()
    },
    // ...
  ]
}
```

### 5. 发布流程

```bash
# 1. 更新版本号
npm version patch/minor/major

# 2. 构建并发布
npm run build
# 或使用 electron-builder 发布到 GitHub
npx electron-builder --publish always
```

## 开发计划

### Phase 1: 基础功能
- [ ] 安装 electron-updater
- [ ] 配置 GitHub Releases 作为更新源
- [ ] 实现检查更新菜单
- [ ] 实现更新提示对话框

### Phase 2: 用户体验优化
- [ ] 添加下载进度条 (任务栏)
- [ ] 添加更新日志显示
- [ ] 支持后台静默检查 (启动时)
- [ ] 添加"跳过此版本"选项

### Phase 3: 高级功能 (可选)
- [ ] 支持自建更新服务器
- [ ] 支持灰度发布 (beta 通道)
- [ ] 支持回滚到旧版本

## 注意事项

1. **代码签名**: macOS 要求应用必须签名才能使用自动更新
2. **GitHub Token**: 私有仓库需要配置 GH_TOKEN 环境变量
3. **版本号**: 必须遵循 semver 规范 (x.y.z)
4. **测试**: 建议先在 dev 环境测试更新流程

## 参考资料

- [electron-updater 文档](https://www.electron.build/auto-update)
- [GitHub Releases 发布](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Electron 代码签名](https://www.electronjs.org/docs/latest/tutorial/code-signing)
