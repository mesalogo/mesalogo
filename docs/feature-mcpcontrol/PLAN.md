# Next RPA - MCP桌面自动化应用 设计方案

## 1. 概述

Next RPA 是一个基于 Model Context Protocol (MCP) 的桌面自动化应用，允许AI代理通过MCP协议控制PC进行RPA（Robotic Process Automation）操作。

## 2. 核心功能

### 2.1 基础控制能力
- 🖱️ **鼠标控制**: 移动、点击、拖拽、滚动
- ⌨️ **键盘控制**: 文本输入、快捷键、按键组合
- 🪟 **窗口管理**: 列出窗口、聚焦、调整大小和位置
- 📸 **屏幕操作**: 截图、屏幕尺寸检测、活动窗口捕获
- 📋 **剪贴板操作**: 读取和写入剪贴板内容

## 3. 应用配置项

### 3.1 连接模式 (Connection Mode)
用户可选择以下两种连接模式：

#### Cloud Provider
- 连接到云端托管的MCP服务
- 需要配置认证信息（API Key/Token）

#### Local
- 连接到本地或局域网内的MCP服务器
- **必需配置项**:
  - **MCP协议地址** (SSE URL): 例如 `http://192.168.1.100:3232/mcp`
  - **端口号**: 默认 3232

### 3.2 传输协议 (Transport Protocol)
- **SSE (Server-Sent Events)** - 推荐用于网络连接
- **STDIO** - 用于本地进程通信（可选）

配置格式:
```json
{
  "transport": "sse",
  "url": "http://<ip>:<port>/mcp"
}
```

### 3.3 安全连接配置 (Security)
用于远程部署场景（MCP规范要求）:
- **启用HTTPS**: 是/否
- **证书路径**: TLS证书文件路径 (可选)
- **密钥路径**: TLS密钥文件路径 (可选)

### 3.4 Automation Provider
MCPControl支持多种自动化后端，用户可根据需求选择：

#### 全局Provider设置
- **keysender** (默认) - 原生Windows自动化，高可靠性
- **powershell** - PowerShell脚本，简单操作
- **autohotkey** - AutoHotkey v2，高级自动化

#### 模块化Provider配置（高级）
允许为不同操作类型选择不同的provider:
- `AUTOMATION_KEYBOARD_PROVIDER` - 键盘操作provider
- `AUTOMATION_MOUSE_PROVIDER` - 鼠标操作provider
- `AUTOMATION_SCREEN_PROVIDER` - 屏幕操作provider
- `AUTOMATION_CLIPBOARD_PROVIDER` - 剪贴板操作provider

### 3.5 环境配置建议
- **推荐分辨率**: 1280x720（MCPControl优化的分辨率）
- **虚拟机运行**: 建议在虚拟机中运行以提高安全性
- **屏幕数量**: 单屏配置（多屏支持有限）

### 3.6 运行时配置
- **截图质量**: 控制截图的清晰度和文件大小
- **操作超时时间**: 设置自动化操作的超时限制（秒）
- **剪贴板访问**: 启用/禁用剪贴板操作权限
- **日志级别**: debug / info / warning / error

## 4. 数据库设计

### 4.1 现有数据库表结构

系统已有实体应用市场的数据库设计，Next RPA 将基于此结构存储配置：

#### MarketApp 表
```python
class MarketApp(BaseMixin, db.Model):
    __tablename__ = 'market_apps'
    
    app_id = Column(String(100), unique=True, nullable=False)  # 应用唯一标识: "next-rpa"
    name = Column(String(200), nullable=False)                 # 应用名称: "Next RPA"
    enabled = Column(Boolean, default=True)                    # 是否启用
    sort_order = Column(Integer, default=0)                    # 排序权重
    config = Column(JSON, nullable=False)                      # 应用完整配置 ⭐
```

#### ActionSpaceApp 表（应用与行动空间绑定）
```python
class ActionSpaceApp(BaseMixin, db.Model):
    __tablename__ = 'action_space_apps'
    
    action_space_id = Column(String(36), ForeignKey('action_spaces.id'))
    app_id = Column(String(100), ForeignKey('market_apps.app_id'))
    enabled = Column(Boolean, default=True)
    settings = Column(JSON, default=dict)  # 特定行动空间的配置覆盖 ⭐
```

### 4.2 Next RPA 配置数据结构

所有配置存储在 `MarketApp.config` JSON 字段中：

```json
{
  "basic": {
    "description": "基于 MCP 协议的桌面自动化应用",
    "icon": "/icons/next-rpa.svg",
    "category": "自动化工具",
    "version": "1.0.0",
    "author": "System"
  },
  "connection": {
    "mode": "local",
    "cloudProvider": {
      "apiKey": "",
      "endpoint": ""
    },
    "localConfig": {
      "sseUrl": "http://192.168.1.100:3232/mcp",
      "port": 3232
    }
  },
  "transport": {
    "type": "sse",
    "url": ""
  },
  "security": {
    "enableHttps": false,
    "certPath": "",
    "keyPath": ""
  },
  "provider": {
    "global": "keysender",
    "keyboard": "",
    "mouse": "",
    "screen": "",
    "clipboard": "",
    "autohotkeyPath": ""
  },
  "environment": {
    "recommendedResolution": "1280x720",
    "runInVM": true,
    "singleScreen": true
  },
  "runtime": {
    "screenshotQuality": 80,
    "operationTimeout": 30,
    "enableClipboard": true,
    "logLevel": "info"
  },
  "stats": {
    "launch_count": 0,
    "install_count": 0
  }
}
```

### 4.3 TypeScript 接口定义（前端使用）

```typescript
interface NextRPAConfig {
  basic: {
    description: string;
    icon: string;
    category: string;
    version: string;
    author: string;
  };
  connection: {
    mode: 'cloud' | 'local';
    cloudProvider?: {
      apiKey?: string;
      endpoint?: string;
    };
    localConfig?: {
      sseUrl: string;
      port?: number;
    };
  };
  transport: {
    type: 'sse' | 'stdio';
    url?: string;
  };
  security?: {
    enableHttps: boolean;
    certPath?: string;
    keyPath?: string;
  };
  provider: {
    global?: 'keysender' | 'powershell' | 'autohotkey';
    keyboard?: string;
    mouse?: string;
    screen?: string;
    clipboard?: string;
    autohotkeyPath?: string;
  };
  environment?: {
    recommendedResolution: string;
    runInVM: boolean;
    singleScreen: boolean;
  };
  runtime?: {
    screenshotQuality?: number;
    operationTimeout?: number;
    enableClipboard?: boolean;
    logLevel?: 'debug' | 'info' | 'warning' | 'error';
  };
  stats?: {
    launch_count: number;
    install_count: number;
  };
}
```

## 5. UI设计建议

### 5.1 配置表单布局
1. **连接设置** 标签页
   - 连接模式选择（单选：Cloud / Local）
   - Local模式下显示：
     - MCP协议地址输入框 (必填)
     - 端口号输入框 (默认3232)
     - 连接测试按钮

2. **安全设置** 标签页
   - HTTPS开关
   - 证书/密钥路径选择器

3. **Provider设置** 标签页
   - 简单模式: 全局Provider下拉选择
   - 高级模式: 分模块配置（展开/折叠）

4. **环境建议** 信息栏
   - 显示推荐配置（只读提示）
   - 当前环境检测（分辨率、屏幕数）

5. **运行时配置** 标签页
   - 截图质量滑块
   - 超时时间输入
   - 剪贴板开关
   - 日志级别下拉

### 5.2 状态指示
- 连接状态指示器（已连接/未连接/错误）
- 实时日志查看器
- 最近操作历史

## 6. 实现优先级

### Phase 1 - MVP (最小可行产品)
1. ✅ 基础连接配置（Local模式 + SSE）
2. ✅ MCP协议地址配置
3. ✅ 默认Provider（keysender）
4. ✅ 基础UI（连接设置表单）

### Phase 2 - 增强功能
1. ⏳ Cloud Provider支持
2. ⏳ HTTPS安全连接
3. ⏳ Provider选择功能
4. ⏳ 环境检测和建议

### Phase 3 - 高级功能
1. ⏳ 模块化Provider配置
2. ⏳ 运行时配置选项
3. ⏳ 操作历史和日志
4. ⏳ 配置导入/导出

## 7. 技术依赖

### 7.1 MCPControl 要求
- Windows OS
- Node.js (LTS)
- Build Tools (Visual Studio)
- Python 3.12+

### 7.2 应用集成
- MCP SDK: `@modelcontextprotocol/sdk`
- HTTP/SSE客户端库
- 配置管理模块

## 8. 安全考虑

1. **权限控制**: 用户需明确授权桌面控制权限
2. **连接安全**: 远程连接强制HTTPS
3. **操作审计**: 记录所有自动化操作日志
4. **沙箱隔离**: 建议在虚拟机中运行

## 9. 已知限制

- 仅支持 Windows OS
- 窗口最小化/还原操作暂不支持
- 多屏幕功能可能不稳定
- 最佳分辨率为 1280x720
- 某些操作可能需要管理员权限

## 10. 参考资源

- MCPControl GitHub: https://github.com/claude-did-this/MCPControl
- MCP 规范文档: https://modelcontextprotocol.io/
- AutoHotkey v2: https://www.autohotkey.com/
