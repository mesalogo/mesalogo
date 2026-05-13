# Electron 多平台应用改造方案

## 📋 方案概述

将现有的 Flask + React Web 应用改造为基于 Electron 的跨平台桌面应用。

**目标平台**: Windows, macOS, Linux

**核心架构**: 
- Electron 主进程管理应用生命周期
- Flask 后端作为子进程运行
- React 前端在 Electron 渲染进程中显示

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────┐
│           Electron 主进程 (main.js)               │
│  ├─ 管理应用窗口                                  │
│  ├─ 启动/停止 Flask 子进程                        │
│  ├─ 系统托盘                                      │
│  └─ 原生功能 (文件系统、通知等)                   │
└─────────────────────────────────────────────────┘
           │                            │
           ↓                            ↓
┌──────────────────────┐    ┌──────────────────────┐
│  渲染进程 (前端)      │    │  Flask 子进程 (后端)  │
│  ├─ React UI         │←───│  ├─ API 服务器       │
│  ├─ 路由             │HTTP│  ├─ 数据库           │
│  └─ 状态管理         │    │  └─ MCP 服务         │
└──────────────────────┘    └──────────────────────┘
```

---

## 📁 项目结构

```
abm-llm-v2/
├── backend/                 # 现有后端 (无需大改)
├── frontend/                # 现有前端 (无需大改)
├── electron/               # 新增：Electron 相关
│   ├── main.js             # 主进程
│   ├── preload.js          # 预加载脚本
│   ├── package.json        # Electron 依赖
│   ├── electron-builder.json  # 打包配置
│   └── resources/          # 应用图标
│       ├── icon.png        # 通用图标 (512x512)
│       ├── icon.icns       # macOS 图标
│       └── icon.ico        # Windows 图标
└── docs/
    └── feature-applization/  # 本文档目录
```

---

## 🔑 关键技术点

### 1. Flask 子进程管理

**开发环境**: 直接调用系统 Python
```javascript
flaskProcess = spawn('python3', ['backend/run_app.py']);
```

**生产环境**: 使用 PyInstaller 打包
```javascript
flaskProcess = spawn(path.join(resourcesPath, 'backend/run_app.exe'));
```

### 2. 进程间通信

- **前端 ↔ Flask**: HTTP REST API (现有方式保持不变)
- **前端 ↔ Electron**: IPC (用于原生功能，如文件选择)

### 3. 安全性

使用 `contextIsolation` 和 `preload.js` 防止前端直接访问 Node.js API：

```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.js')
}
```

### 4. 数据持久化

- **数据库**: SQLite 文件存储在用户数据目录
- **配置**: 使用 `electron-store` 管理配置
- **日志**: 存储在 `app.getPath('logs')`

---

## 🚀 实施步骤

详见各子文档：
1. [项目初始化](./01-initialization.md)
2. [主进程开发](./02-main-process.md)
3. [前端集成](./03-frontend-integration.md)
4. [后端打包](./04-backend-packaging.md)
5. [应用打包与发布](./05-build-and-release.md)

---

## 📊 优势与局限

### ✅ 优势

1. **快速改造**: 前后端代码几乎无需修改
2. **跨平台**: 一次构建，三平台运行
3. **原生体验**: 系统托盘、通知、文件访问
4. **离线运行**: 无需依赖外部服务器
5. **自动更新**: 支持 OTA 更新

### ⚠️ 局限

1. **安装包体积**: ~150-200MB (包含 Python 运行时)
2. **内存占用**: ~200-400MB (Electron + Flask)
3. **启动时间**: 需等待 Flask 启动 (~2-5秒)

---

## 🛠️ 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | ^28.0.0 |
| 打包工具 | electron-builder | ^24.0.0 |
| 后端打包 | PyInstaller | ^6.0.0 |
| 前端 | React | 19.2.0 |
| 后端 | Flask | latest |

---

## 📝 开发环境要求

- Node.js >= 18.x
- Python >= 3.10
- npm >= 9.x
- 操作系统: macOS / Windows / Linux

---

## 🎯 下一步

阅读 [01-initialization.md](./01-initialization.md) 开始项目初始化。
