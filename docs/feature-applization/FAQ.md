# 常见问题解答 (FAQ)

## 🔧 开发相关

### Q1: 开发时每次都要等 Flask 启动太慢？

**A**: 使用分离模式开发：

```bash
# 终端1: 启动后端
cd backend
python3 run_app.py

# 终端2: 启动前端
cd frontend
npm start

# 终端3: 启动 Electron（不启动后端）
cd electron
# 修改 main.js，注释掉 startFlaskServer()
electron .
```

### Q2: Electron 打包后体积太大？

**A**: 优化策略：

1. **使用 asar 归档**:
```json
{
  "build": {
    "asar": true
  }
}
```

2. **排除不必要的文件**:
```json
{
  "files": [
    "!**/*.map",
    "!**/node_modules/*/{CHANGELOG.md,README.md}",
    "!**/node_modules/.bin"
  ]
}
```

3. **使用 electron-builder 的压缩选项**:
```json
{
  "compression": "maximum"
}
```

### Q3: PyInstaller 打包后无法找到模块？

**A**: 添加隐藏导入：

```python
# 在 .spec 文件中
hiddenimports=[
    'missing_module_name',
    'package.submodule',
]
```

或使用 hook 文件：

```python
# 创建 hooks/hook-yourmodule.py
from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = collect_all('yourmodule')
```

### Q4: 跨平台路径问题？

**A**: 始终使用 `path.join()`:

```javascript
// ❌ 错误
const filePath = __dirname + '/resources/icon.png';

// ✅ 正确
const filePath = path.join(__dirname, 'resources', 'icon.png');
```

---

## 🐛 错误处理

### Q5: Electron 白屏问题？

**A**: 检查以下几点：

1. **检查控制台错误**: 打开 DevTools (`Cmd+Alt+I` / `Ctrl+Shift+I`)

2. **检查 CSP (Content Security Policy)**:
```html
<!-- 在 frontend/public/index.html 添加 -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*">
```

3. **检查路径问题**:
```javascript
// 确保前端路径正确
mainWindow.loadURL(
  isDev 
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../frontend/build/index.html')}`
);
```

### Q6: Flask 启动失败？

**A**: 调试步骤：

1. **检查端口占用**:
```bash
# macOS/Linux
lsof -i :8080

# Windows
netstat -ano | findstr :8080
```

2. **查看 Flask 日志**:
```javascript
// 在 main.js 中
flaskProcess.stderr.on('data', (data) => {
  console.error(`Flask Error: ${data}`);
  // 写入日志文件
  fs.appendFileSync('flask-error.log', data);
});
```

3. **手动测试后端**:
```bash
cd backend/dist
./run_app  # 直接运行查看错误
```

### Q7: 数据库锁定错误？

**A**: SQLite 并发问题：

```python
# 在 config.py 中配置
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
    "connect_args": {
        "check_same_thread": False,  # SQLite 特定
        "timeout": 30
    }
}
```

### Q8: CORS 错误？

**A**: 更新 Flask CORS 配置：

```python
# backend/app/__init__.py
CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:3000", "file://"],
         "allow_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True
     }})
```

---

## 🚀 打包发布

### Q9: macOS 无法打开应用（"已损坏"）？

**A**: 代码签名问题：

```bash
# 临时解决（开发用）
xattr -cr /Applications/ABM\ LLM.app

# 长期解决：申请 Apple Developer 账户并签名
```

### Q10: Windows 防火墙拦截？

**A**: 添加防火墙规则：

```javascript
// 在安装脚本中添加
const { execSync } = require('child_process');

function addFirewallRule() {
  try {
    execSync(
      `netsh advfirewall firewall add rule name="ABM LLM" dir=in action=allow program="${appPath}" enable=yes`,
      { windowsHide: true }
    );
  } catch (error) {
    console.error('Failed to add firewall rule:', error);
  }
}
```

### Q11: Linux 依赖库缺失？

**A**: 在 README 中列出依赖：

```bash
# Ubuntu/Debian
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1

# Fedora/RHEL
sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-core libdrm mesa-libgbm
```

---

## 📊 性能优化

### Q12: 应用启动慢？

**A**: 优化启动流程：

1. **延迟加载**:
```javascript
// 先显示启动画面
const splash = new BrowserWindow({
  width: 400,
  height: 300,
  transparent: true,
  frame: false
});
splash.loadFile('splash.html');

// Flask 启动后再显示主窗口
await waitForFlask();
splash.close();
createWindow();
```

2. **预热数据库**:
```python
# 在 Flask 启动时
@app.before_first_request
def warmup():
    db.engine.execute('SELECT 1')
```

### Q13: 内存占用过高？

**A**: 优化策略：

```javascript
// 限制渲染进程内存
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');

// 定期清理缓存
setInterval(() => {
  mainWindow.webContents.session.clearCache();
}, 1000 * 60 * 30); // 每30分钟
```

---

## 🔐 安全相关

### Q14: 如何安全存储 API 密钥？

**A**: 使用 electron-store + 加密：

```javascript
const Store = require('electron-store');
const { safeStorage } = require('electron');

const store = new Store({
  encryptionKey: 'your-encryption-key'
});

// 存储
const encryptedKey = safeStorage.encryptString(apiKey);
store.set('apiKey', encryptedKey.toString('base64'));

// 读取
const buffer = Buffer.from(store.get('apiKey'), 'base64');
const apiKey = safeStorage.decryptString(buffer);
```

### Q15: 如何防止 XSS 攻击？

**A**: 安全配置：

```javascript
// 主进程
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true
}

// 前端：使用 DOMPurify 清理用户输入
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

---

## 🌐 网络相关

### Q16: 如何支持代理？

**A**: 配置 Electron 代理：

```javascript
// 在 app.ready 前
app.commandLine.appendSwitch('proxy-server', 'http://proxy.example.com:8080');

// 或使用系统代理
const { session } = require('electron');
session.defaultSession.setProxy({
  proxyRules: 'http://proxy.example.com:8080'
});
```

### Q17: 离线模式支持？

**A**: 实现离线检测：

```javascript
// 主进程
const { net } = require('electron');

function checkOnline() {
  return net.isOnline();
}

ipcMain.handle('check-online', () => checkOnline());

// 渲染进程
window.addEventListener('online', () => {
  console.log('Network online');
});

window.addEventListener('offline', () => {
  console.log('Network offline');
});
```

---

## 📝 其他问题

### Q18: 如何添加快捷键？

**A**: 使用 globalShortcut：

```javascript
const { globalShortcut } = require('electron');

app.on('ready', () => {
  // 注册快捷键
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    mainWindow.show();
  });
});

app.on('will-quit', () => {
  // 注销所有快捷键
  globalShortcut.unregisterAll();
});
```

### Q19: 如何支持多语言？

**A**: 使用 i18next + electron-settings：

```javascript
const Store = require('electron-store');
const store = new Store();

// 检测系统语言
const locale = app.getLocale(); // 'zh-CN', 'en-US'
store.set('language', locale);

// 在前端使用
import i18n from 'i18next';
const language = await window.electronAPI.getLanguage();
i18n.changeLanguage(language);
```

### Q20: 如何调试打包后的应用？

**A**: 启用日志：

```javascript
// 主进程
const log = require('electron-log');
log.transports.file.level = 'debug';
log.info('App started');

// 查看日志位置
console.log(log.transports.file.getFile().path);
// macOS: ~/Library/Logs/ABM LLM/main.log
// Windows: %USERPROFILE%\AppData\Roaming\ABM LLM\logs\main.log
// Linux: ~/.config/ABM LLM/logs/main.log
```

---

如有其他问题，请提交 Issue 或查阅官方文档：
- [Electron 文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build)
- [PyInstaller 文档](https://pyinstaller.org)
