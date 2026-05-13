# Next RPA - MCP桌面自动化应用 产品计划

## 1. 概述

Next RPA 是一个集成在实体应用市场中的 MCP（Model Context Protocol）桌面自动化应用。它允许用户配置并控制基于 MCPControl 的 Windows 桌面自动化流程，实现 AI 驱动的 RPA 操作。

## 2. 产品定位

### 2.1 目标用户
- 需要进行桌面自动化的企业用户
- RPA 开发人员和测试人员
- AI 应用开发者

### 2.2 核心价值
- **AI 集成**: 通过 MCP 协议让 AI 代理直接控制桌面
- **灵活配置**: 支持多种连接模式和自动化后端
- **安全可控**: 提供完整的安全配置和权限管理
- **易于使用**: 图形化配置界面，无需编写代码

## 3. 功能规划

### 3.1 核心功能（Phase 1 - 已完成 ✅）

#### 3.1.1 应用配置管理
- [x] 连接模式配置（Local/Cloud）
- [x] MCP 协议地址配置
- [x] 传输协议选择（SSE/STDIO）
- [x] 安全连接设置（HTTPS/TLS）
- [x] Provider 选择（keysender/powershell/autohotkey）
- [x] 运行时参数配置
- [x] 配置保存和加载

#### 3.1.2 用户界面
- [x] 配置表单（5个Tab页）
  - [x] 连接设置
  - [x] 安全设置
  - [x] Provider 设置
  - [x] 运行时配置
  - [x] 环境建议
- [x] 连接状态指示
- [x] 表单验证
- [x] 帮助提示（Tooltip）

#### 3.1.3 数据存储
- [x] MarketApp 表存储应用配置
- [x] JSON 格式配置数据
- [x] 配置更新 API
- [x] Seed data 初始化

### 3.2 增强功能（Phase 2 - 规划中 ⏳）

#### 3.2.1 连接测试
**优先级**: 高

功能描述：
- 实现真实的 MCP 连接测试
- 显示连接延迟和状态详情
- 自动检测 MCPControl 版本
- 连接失败诊断和建议

技术实现：
```javascript
// 连接测试 API
async function testMCPConnection(config) {
  const response = await fetch(`${config.sseUrl}/health`, {
    method: 'GET',
    timeout: 5000
  });
  
  return {
    status: response.ok ? 'connected' : 'error',
    latency: response.time,
    version: response.headers.get('X-MCP-Version'),
    capabilities: await response.json()
  };
}
```

#### 3.2.2 配置模板
**优先级**: 中

功能描述：
- 预设常用配置模板
  - 本地开发环境模板
  - 生产环境模板
  - 测试环境模板
- 配置导入/导出功能
- 配置版本管理
- 模板市场（社区共享）

数据结构：
```json
{
  "templates": [
    {
      "id": "local-dev",
      "name": "本地开发环境",
      "description": "适用于本地开发测试",
      "config": { ... },
      "tags": ["开发", "本地"],
      "author": "系统内置",
      "downloads": 0
    }
  ]
}
```

#### 3.2.3 环境检测
**优先级**: 中

功能描述：
- 自动检测当前系统环境
  - 操作系统版本
  - 屏幕分辨率
  - 已安装依赖
- 显示系统要求对比
- 依赖项检查和安装引导
- 环境优化建议

UI 设计：
```
┌─────────────────────────────┐
│ 环境检测                    │
├─────────────────────────────┤
│ ✓ Windows 10 Pro            │
│ ✗ 分辨率: 1920x1080         │
│   推荐: 1280x720            │
│ ✓ Node.js 18.x              │
│ ✗ Python 未安装             │
│ ✓ Build Tools 已安装        │
├─────────────────────────────┤
│ [一键优化] [查看详情]       │
└─────────────────────────────┘
```

#### 3.2.4 Cloud Provider 支持
**优先级**: 低

功能描述：
- 定义云端 MCP 服务接口规范
- 实现云端连接和认证
- 支持多云端服务商
- 计费和使用量统计

### 3.3 高级功能（Phase 3 - 长期规划 📋）

#### 3.3.1 实时监控
**优先级**: 高

功能描述：
- RPA 运行日志实时显示
- 操作历史记录和回放
- 性能指标监控
  - CPU/内存使用率
  - 操作执行时间
  - 成功/失败率
- 错误告警和通知

界面设计：
```
┌─────────────────────────────────────┐
│ 实时监控                            │
├─────────────────────────────────────┤
│ [日志] [指标] [历史]               │
│                                     │
│ 16:30:25 鼠标移动到 (100, 200)     │
│ 16:30:26 点击左键                   │
│ 16:30:27 输入文本: "Hello"         │
│ 16:30:28 截图保存: screenshot.png   │
│                                     │
│ CPU: ████░░░░ 45%                   │
│ 内存: ██░░░░░░ 23%                  │
│ 成功: 98.5% | 失败: 1.5%           │
└─────────────────────────────────────┘
```

#### 3.3.2 脚本编辑器
**优先级**: 中

功能描述：
- 可视化流程设计器
- 代码编辑器（支持语法高亮）
- 脚本调试功能
- 脚本库和复用
- 版本控制集成

技术选型：
- 流程设计: React Flow / G6
- 代码编辑: Monaco Editor
- 调试: Chrome DevTools Protocol

#### 3.3.3 任务调度
**优先级**: 中

功能描述：
- 定时任务配置
- 循环任务执行
- 条件触发
- 任务队列管理
- 并发控制

配置示例：
```json
{
  "schedule": {
    "type": "cron",
    "expression": "0 9 * * *",
    "timezone": "Asia/Shanghai"
  },
  "retry": {
    "maxAttempts": 3,
    "backoff": "exponential"
  },
  "concurrency": 5
}
```

#### 3.3.4 团队协作
**优先级**: 低

功能描述：
- 多用户配置共享
- 权限管理
- 操作审计
- 协作注释
- 变更历史

## 4. 技术架构

### 4.1 前端架构

```
NextRPAApp (React Component)
├── ConfigForm (配置表单)
│   ├── ConnectionTab (连接设置)
│   ├── SecurityTab (安全设置)
│   ├── ProviderTab (Provider设置)
│   ├── RuntimeTab (运行时配置)
│   └── EnvironmentTab (环境建议)
├── ConnectionStatus (连接状态)
├── MonitorPanel (监控面板) - Phase 3
└── ScriptEditor (脚本编辑器) - Phase 3
```

### 4.2 后端架构

```
Backend API
├── /market/apps/next-rpa (应用信息)
├── /market/apps/next-rpa/config (配置管理)
│   ├── PUT - 更新配置
│   ├── GET - 获取配置
│   └── POST /validate - 验证配置
├── /next-rpa/connection/test (连接测试) - Phase 2
├── /next-rpa/templates (配置模板) - Phase 2
├── /next-rpa/monitoring (实时监控) - Phase 3
└── /next-rpa/scripts (脚本管理) - Phase 3
```

### 4.3 数据模型

#### 4.3.1 应用配置
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
    cloudProvider?: CloudProviderConfig;
    localConfig?: LocalConfig;
  };
  transport: {
    type: 'sse' | 'stdio';
    url?: string;
  };
  security?: SecurityConfig;
  provider: ProviderConfig;
  environment?: EnvironmentConfig;
  runtime?: RuntimeConfig;
  stats?: StatsConfig;
}
```

#### 4.3.2 运行时状态
```typescript
interface RuntimeState {
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastConnected?: Date;
  version?: string;
  logs: LogEntry[];
  metrics: {
    cpu: number;
    memory: number;
    successRate: number;
  };
}
```

## 5. 用户体验设计

### 5.1 首次使用流程

```
1. 点击 Next RPA 应用卡片
   ↓
2. 显示欢迎页面和快速向导
   ↓
3. 选择连接模式（Local/Cloud）
   ↓
4. 填写必填配置项
   ↓
5. 测试连接
   ↓
6. 保存配置
   ↓
7. 显示操作指南
```

### 5.2 常规使用流程

```
1. 打开 Next RPA 应用
   ↓
2. 查看连接状态
   ↓
3. 修改配置（可选）
   ↓
4. 保存配置
   ↓
5. 在对话中使用 RPA 功能
```

### 5.3 错误处理

| 错误类型 | 用户提示 | 建议操作 |
|---------|---------|---------|
| 连接失败 | "无法连接到 MCPControl 服务" | 1. 检查 URL 是否正确<br>2. 确认服务是否启动<br>3. 查看防火墙设置 |
| 配置无效 | "配置验证失败" | 显示具体的验证错误信息 |
| 权限不足 | "需要管理员权限" | 提示以管理员身份运行 |
| 版本不兼容 | "MCPControl 版本过低" | 提供升级指南链接 |

## 6. 安全考虑

### 6.1 配置安全
- API Key 加密存储
- HTTPS 强制（生产环境）
- 敏感信息脱敏显示
- 配置导出时加密

### 6.2 操作安全
- 操作审计日志
- 权限控制
- 沙箱隔离（虚拟机）
- 危险操作确认

### 6.3 网络安全
- HTTPS/TLS 加密
- 证书验证
- IP 白名单
- 防火墙规则

## 7. 性能优化

### 7.1 前端优化
- 配置表单懒加载
- 日志虚拟滚动
- 防抖/节流
- 本地缓存

### 7.2 后端优化
- 配置缓存
- 批量操作
- 异步处理
- 连接池

## 8. 测试策略

### 8.1 单元测试
- 配置验证逻辑
- API 请求/响应
- 组件渲染

### 8.2 集成测试
- 配置保存和加载
- 连接测试
- 端到端流程

### 8.3 手动测试清单
- [ ] 配置表单所有字段正常工作
- [ ] 连接测试功能正常
- [ ] 配置保存和加载正确
- [ ] 错误提示清晰准确
- [ ] 响应式布局适配
- [ ] 浏览器兼容性

## 9. 部署计划

### 9.1 前端部署
```bash
# 构建前端
cd frontend
npm run build

# 验证构建
npm run test
```

### 9.2 后端部署
```bash
# 应用数据库迁移
flask db upgrade

# 导入 seed data
python seed_market_data.py

# 重启服务
systemctl restart backend
```

### 9.3 数据迁移
```sql
-- 检查应用是否存在
SELECT * FROM market_apps WHERE app_id = 'next-rpa';

-- 如果需要更新配置
UPDATE market_apps 
SET config = '...' 
WHERE app_id = 'next-rpa';
```

## 10. 监控和维护

### 10.1 关键指标
- 应用启动次数
- 配置保存成功率
- 连接测试成功率
- 平均使用时长
- 错误率

### 10.2 日志收集
```javascript
// 前端日志
logger.info('NextRPA: Config saved', { userId, configId });

// 后端日志
logger.info(f"应用 next-rpa 配置已更新: {app_id}")
```

### 10.3 告警规则
- 错误率 > 5%
- API 响应时间 > 3s
- 连接测试失败率 > 10%

## 11. 文档计划

### 11.1 用户文档
- [ ] 快速开始指南
- [ ] 配置说明
- [ ] 常见问题 FAQ
- [ ] 故障排查指南

### 11.2 开发文档
- [x] 设计方案（PLAN.md）
- [x] 实施总结（IMPLEMENTATION.md）
- [ ] API 文档
- [ ] 组件文档

### 11.3 视频教程
- [ ] 5分钟快速上手
- [ ] 完整配置演示
- [ ] 高级功能介绍

## 12. 路线图

### Q4 2025
- [x] Phase 1: MVP 功能完成
- [ ] 用户测试和反馈收集
- [ ] Bug 修复和优化

### Q1 2026
- [ ] Phase 2: 增强功能开发
  - [ ] 连接测试
  - [ ] 配置模板
  - [ ] 环境检测
- [ ] 文档完善

### Q2 2026
- [ ] Phase 3: 高级功能开发
  - [ ] 实时监控
  - [ ] 脚本编辑器
  - [ ] 任务调度
- [ ] Cloud Provider 支持

### Q3 2026
- [ ] 团队协作功能
- [ ] 企业版发布
- [ ] 生态建设

## 13. 成功指标

### 13.1 产品指标
- 用户采用率 > 60%
- 日活跃用户 > 100
- 配置成功率 > 95%
- 用户满意度 > 4.5/5

### 13.2 技术指标
- 页面加载时间 < 2s
- API 响应时间 < 500ms
- 错误率 < 2%
- 可用性 > 99.5%

## 14. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| MCPControl 兼容性问题 | 高 | 中 | 版本检测和适配 |
| 用户配置错误 | 中 | 高 | 增强表单验证和提示 |
| 网络连接不稳定 | 中 | 中 | 重试机制和离线模式 |
| 安全漏洞 | 高 | 低 | 定期安全审计 |

## 15. 开源技术选型对比

基于2024-2025年主流的Computer Use / Desktop Control开源项目调研，以下是与我们产品集成的技术选型分析：

### 15.1 主要候选方案

| 项目 | 平台 | 特点 | Stars | 集成难度 | 推荐 |
|------|------|------|-------|----------|------|
| **[DesktopCommanderMCP](https://github.com/wonderwhy-er/DesktopCommanderMCP)** | 跨平台 | 终端控制、文件系统搜索、diff编辑、ripgrep集成，有官方Dockerfile | 5.1k | 低 | ✅ 容器推荐 |
| **[MCPControl](https://github.com/claude-did-this/MCPControl)** | **仅Windows** | 鼠标、键盘、窗口管理、截图、SSE/HTTPS支持，多Provider(keysender/powershell/autohotkey) | 261 | 中 | ⚠️ 仅Windows |
| **[Playwright MCP](https://github.com/microsoft/playwright-mcp)** | 跨平台 | 微软官方，使用accessibility snapshots，稳定可靠 | 24.9k | 低 | ✅ 浏览器推荐 |
| **Agent TARS** (字节跳动) | 跨平台 | 多模态AI Agent，GUI+视觉，MCP原生支持 | 活跃 | 中 | |
| **[Cloudflare Playwright MCP](https://developers.cloudflare.com/browser-rendering/playwright/playwright-mcp/)** | 跨平台 | Cloudflare fork，可部署到 Workers，适合云端场景 | - | 中 | ✅ 云端推荐 |
| **[mcp-browser-use](https://github.com/Saik0s/mcp-browser-use)** | 跨平台 | AI驱动浏览器自动化，自然语言控制，支持截图分析和状态持久化 | 858 | 低 | ⚠️ 不推荐 |
| **Windows-MCP** | Windows | 原生Windows UI控制，无需CV | 3.6k+ | 低 | |
| **Browser MCP** | 跨平台 | 浏览器自动化，本地运行 | - | 低 | |
| **OpenAdapt.AI** | 跨平台 | 生成式流程自动化，观察学习 | 活跃 | 高 | |
| **MCP Desktop Automation** | 跨平台 | RobotJS实现，轻量级 | 1.7k | 低 | |
| **Midscene MCP** | 跨平台 | AI UI自动化，自然语言控制 | - | 中 | |

### 15.1.1 重点项目详解

#### DesktopCommanderMCP (推荐用于容器环境)
- **GitHub**: https://github.com/wonderwhy-er/DesktopCommanderMCP
- **Stars**: 5.1k (非常活跃，2025-12-30 仍在更新)
- **功能**:
  - 终端控制和命令执行
  - 文件系统搜索 (集成 ripgrep)
  - Diff 文件编辑
  - 跨平台支持 (Linux/macOS/Windows)
- **安装**: `npm install -g desktop-commander-mcp` 或 `npx desktop-commander-mcp`
- **容器支持**: 有官方 Dockerfile
- **适用场景**: 容器内终端/文件系统自动化

#### MCPControl (推荐用于 Windows 桌面控制)
- **GitHub**: https://github.com/claude-did-this/MCPControl
- **Stars**: 261
- **功能**:
  - 鼠标控制 (移动、点击、拖拽、滚动)
  - 键盘控制 (输入、快捷键、按键保持)
  - 窗口管理 (列表、聚焦、调整大小)
  - 屏幕截图
  - 剪贴板操作
- **传输协议**: SSE (支持 HTTPS/TLS)
- **Provider**: keysender (默认) / powershell / autohotkey
- **安装**: `npm install -g mcp-control`
- **启动**: `mcp-control --sse --port 3232`
- **限制**: **仅支持 Windows**，最佳分辨率 1280x720
- **适用场景**: Windows 虚拟机桌面自动化

### 15.2 推荐集成方案

#### 方案A: Agent TARS 集成 (推荐)
**优势**:
- 字节跳动开发，活跃维护
- 多模态能力（GUI + 视觉识别）
- 原生MCP协议支持
- 支持CLI和Web UI
- 混合浏览器控制（GUI/DOM）

**集成方式**:
```bash
# 安装
npm install -g agent-tars
# 或
npx agent-tars
```

**与我们产品的集成点**:
1. 作为MCP Server注册到我们的MCP Server Manager
2. 通过SSE协议与后端通信
3. 前端NextRPAApp组件调用Agent TARS的能力
4. 支持远程电脑和浏览器操作

#### 方案B: Windows-MCP + Browser MCP 组合
**优势**:
- Windows-MCP专注桌面控制，成熟稳定
- Browser MCP专注浏览器自动化
- 两者互补，覆盖完整场景

**集成方式**:
```json
{
  "mcpServers": {
    "windows-control": {
      "command": "npx",
      "args": ["windows-mcp"]
    },
    "browser-control": {
      "command": "npx", 
      "args": ["browser-mcp"]
    }
  }
}
```

#### 方案C: 自建 + OpenAdapt.AI
**优势**:
- 完全可控
- OpenAdapt.AI提供观察学习能力
- 可定制化程度高

**适用场景**: 需要深度定制或有特殊安全要求

### 15.3 与现有架构的集成设计

```
┌─────────────────────────────────────────────────────────┐
│                    ABM-LLM 平台                          │
├─────────────────────────────────────────────────────────┤
│  Frontend                                                │
│  ├── NextRPAApp.tsx (配置界面)                          │
│  ├── RPAMonitor.tsx (实时监控) - Phase 3                │
│  └── RPAScriptEditor.tsx (脚本编辑) - Phase 3           │
├─────────────────────────────────────────────────────────┤
│  Backend                                                 │
│  ├── mcp_server_manager.py (MCP服务管理)                │
│  ├── rpa_service.py (RPA业务逻辑) - 新增                │
│  └── tool_call_executor.py (工具调用执行)               │
├─────────────────────────────────────────────────────────┤
│  MCP Layer (可选择的后端)                                │
│  ├── Agent TARS (推荐)                                  │
│  │   ├── Desktop Control                                │
│  │   ├── Browser Control (GUI/DOM)                      │
│  │   └── Vision Recognition                             │
│  ├── Windows-MCP (Windows专用)                          │
│  ├── Browser MCP (浏览器专用)                           │
│  └── MCP Desktop Automation (轻量级)                    │
└─────────────────────────────────────────────────────────┘
```

### 15.4 集成实现步骤

#### Phase 1: 基础集成
1. 在 `mcp_server_manager.py` 中添加RPA MCP Server注册
2. 扩展 `tool_call_executor.py` 支持RPA工具调用
3. 前端NextRPAApp支持选择MCP后端

#### Phase 2: Agent TARS深度集成
1. 封装Agent TARS CLI为后台服务
2. 实现SSE事件流转发到前端
3. 添加截图预览和操作回放功能

#### Phase 3: 高级功能
1. 集成OpenAdapt.AI的观察学习能力
2. 实现RPA脚本录制和回放
3. 支持多设备协同控制

### 15.5 配置扩展

在现有配置基础上，添加MCP后端选择：

```json
{
  "connection": {
    "mode": "local",
    "mcpBackend": "agent-tars",
    "localConfig": {
      "sseUrl": "http://localhost:3232/mcp",
      "port": 3232
    }
  },
  "agentTars": {
    "enableVision": true,
    "browserMode": "hybrid",
    "remoteControl": false
  },
  "browserMcp": {
    "stealthMode": true,
    "useExistingProfile": true
  }
}
```

### 15.6 技术选型建议

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| **Linux容器环境** | **DesktopCommanderMCP** + **Playwright MCP** | 跨平台，有Docker支持，终端+浏览器全覆盖 |
| **Windows桌面控制** | **MCPControl** | SSE支持，多Provider，专为Windows设计 |
| 通用RPA | Agent TARS | 功能全面，MCP原生支持 |
| 纯浏览器自动化 | **Playwright MCP** | 微软官方，稳定可靠，24.9k stars |
| 需要学习能力 | OpenAdapt.AI | 观察用户操作生成脚本 |
| 轻量级需求 | MCP Desktop Automation | 简单，依赖少 |

> **注意**: 
> - mcp-browser-use (Saik0s) 存在稳定性问题，不推荐使用。建议使用微软官方的 Playwright MCP。
> - MCPControl 仅支持 Windows，不适合 Linux 容器环境。
> - DesktopCommanderMCP 5.1k stars，活跃维护，推荐用于容器内终端/文件系统控制。

## 16. 参考资源

### 16.1 核心项目
- [DesktopCommanderMCP](https://github.com/wonderwhy-er/DesktopCommanderMCP) - **推荐用于容器环境，5.1k stars**
- [MCPControl GitHub](https://github.com/claude-did-this/MCPControl) - **推荐用于Windows桌面控制**
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) - **推荐用于浏览器自动化，24.9k stars**
- [Agent TARS](https://github.com/bytedance/UI-TARS-desktop)
- [Windows-MCP](https://github.com/CursorTouch/Windows-MCP)
- [Browser MCP](https://browsermcp.io/)
- [OpenAdapt.AI](https://github.com/OpenAdaptAI)
- [MCP Desktop Automation](https://github.com/tanob/mcp-desktop-automation)
- [Midscene MCP](https://midscenejs.com/web-mcp)

### 16.2 规范文档
- [MCP 规范文档](https://modelcontextprotocol.io/)
- [AutoHotkey v2](https://www.autohotkey.com/)

### 16.3 内部文档
- [实体应用市场文档](../feature-market/PLAN-market.md)
- [实施总结](../feature-mcpcontrol/IMPLEMENTATION.md)

---

**文档版本**: v1.3  
**最后更新**: 2025-12-31  
**维护者**: 开发团队
