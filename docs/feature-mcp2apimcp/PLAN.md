# MCP 路径统一规划：从 /mcp/ 迁移到 /api/mcp/

## 背景

当前系统中存在两种 MCP 接口路径格式：
1. **直连服务**：`/mcp/*` - 无 `/api` 前缀
2. **聚合服务**：`/api/mcp/*` - 有 `/api` 前缀

为了保持 API 路径的一致性，所有平台自己提供的 API 都应使用 `/api` 前缀，因此需要将直连服务的路径从 `/mcp/*` 统一改为 `/api/mcp/*`。

## 现状分析

### 当前路径分类

#### 已使用 `/api/mcp/` 前缀的接口（聚合服务）
- `/api/mcp/variables` - 变量聚合服务
- `/api/mcp/knowledge-base` - 知识库服务

#### 需要修改的接口

**说明**：经过代码审查发现，**后端路由已经正确使用了 `/api/mcp` 前缀**，问题在于前端调用时漏掉了 `/api` 前缀。

**前端错误调用路径** → **正确路径**：
- `/mcp/env-vars` → `/api/mcp/env-vars` （后端已正确，前端需修正）
- `/mcp/agent-vars` → `/api/mcp/agent-vars` （后端已正确，前端需修正）
- `/mcp/tools` → `/api/mcp/graph-tools` （图谱工具列表，后端需重命名避免混淆）
- `/mcp/tools/call` → `/api/mcp/graph-tools/call` （图谱工具调用，后端需重命名）
- `/mcp/servers` → `/api/mcp/servers` （后端已正确，前端需修正）
- `/mcp/servers/{serverId}` → `/api/mcp/servers/{serverId}` （后端已正确，前端需修正）
- `/mcp/servers/{serverId}/enable` → `/api/mcp/servers/{serverId}/enable` （后端已正确，前端需修正）
- `/mcp/servers/{serverId}/disable` → `/api/mcp/servers/{serverId}/disable` （后端已正确，前端需修正）
- `/mcp/servers/config` → `/api/mcp/servers/config` （后端已正确，前端需修正）
- `/mcp/tools/{serverId}` → `/api/mcp/tools/{serverId}` （后端已正确，前端需修正）

## 影响范围

### 后端文件修改

#### 1. 路由定义修改

**重要发现**：大部分后端路由已经正确使用 `/api/mcp` 前缀！

| 文件 | 行号 | 当前路径 | 状态 | 修改说明 |
|------|------|----------|------|----------|
| `app/api/routes/environment_variables.py` | 207 | `@env_var_bp.route('/mcp/env-vars')` | ❌ 需修改 | 改为 `/api/mcp/env-vars` |
| `app/api/routes/agent_variables.py` | 290 | `@agent_variable_bp.route('/mcp/agent-vars')` | ❌ 需修改 | 改为 `/api/mcp/agent-vars` |
| `app/api/routes/graph_mcp.py` | 197 | `@graph_mcp_bp.route('/mcp/tools')` | ❌ 需修改并重命名 | 改为 `/api/mcp/graph-tools` |
| `app/api/routes/graph_mcp.py` | 254 | `@graph_mcp_bp.route('/mcp/tools/call')` | ❌ 需修改并重命名 | 改为 `/api/mcp/graph-tools/call` |
| `app/services/mcp_server_manager.py` | 76 | `url_prefix='/api/mcp'` | ✅ 已正确 | Blueprint 前缀已正确 |
| `app/services/mcp_server_manager.py` | 1440-1568 | 所有 `/servers/*` 路由 | ✅ 已正确 | 因为 Blueprint 前缀，实际路径是 `/api/mcp/servers/*` |
| `app/services/mcp_server_manager.py` | 1568 | `@route('/tools/<server_id>')` | ✅ 已正确 | 实际路径是 `/api/mcp/tools/<server_id>` |

#### 2. 配置文件（已正确，无需修改）
- `app/services/mcp_routes_config.py` - 已使用 `/api/mcp/` 路径
- `app/services/mcp_server_manager.py` - Blueprint 前缀已正确设置为 `/api/mcp`

### 前端文件修改

#### 1. MCP 服务器管理页面
**文件：** `src/pages/settings/MCPServersPage.js`

**问题**：所有 MCP 接口调用都漏掉了 `/api` 前缀，导致 404 错误。

| 行号 | 当前代码（错误） | 修改后代码（正确） | 说明 |
|------|-----------------|-------------------|------|
| 49 | `${getApiBaseUrl()}/mcp/tools/${serverId}` | `${getApiBaseUrl()}/api/mcp/tools/${serverId}` | 获取服务器工具列表 |
| 94 | `${getApiBaseUrl()}/mcp/servers` | `${getApiBaseUrl()}/api/mcp/servers` | 获取服务器列表 |
| 135 | `${getApiBaseUrl()}/mcp/servers/${serverId}/enable` | `${getApiBaseUrl()}/api/mcp/servers/${serverId}/enable` | 启用服务器 |
| 165 | `${getApiBaseUrl()}/mcp/servers/${serverId}/disable` | `${getApiBaseUrl()}/api/mcp/servers/${serverId}/disable` | 禁用服务器 |
| 199 | `${getApiBaseUrl()}/mcp/servers/${serverId}` | `${getApiBaseUrl()}/api/mcp/servers/${serverId}` | 删除服务器 |
| 338 | `${getApiBaseUrl()}/mcp/servers/${values.id}` | `${getApiBaseUrl()}/api/mcp/servers/${values.id}` | 更新服务器 |
| 344 | `${getApiBaseUrl()}/mcp/servers` | `${getApiBaseUrl()}/api/mcp/servers` | 添加服务器 |
| 366 | `${getApiBaseUrl()}/mcp/servers/config` | `${getApiBaseUrl()}/api/mcp/servers/config` | 获取配置文件 |
| 479 | `${getApiBaseUrl()}/mcp/servers/config` | `${getApiBaseUrl()}/api/mcp/servers/config` | 保存配置文件 |

#### 2. 工具管理页面
**文件：** `src/pages/roles/ToolManagement.js`

**问题**：所有 MCP 接口调用都漏掉了 `/api` 前缀。

| 行号 | 当前代码（错误） | 修改后代码（正确） | 说明 |
|------|-----------------|-------------------|------|
| 83 | `${getApiBaseUrl()}/mcp/servers` | `${getApiBaseUrl()}/api/mcp/servers` | 获取服务器列表 |
| 109 | `${getApiBaseUrl()}/mcp/tools/${server.id}` | `${getApiBaseUrl()}/api/mcp/tools/${server.id}` | 获取服务器工具列表 |
| 153 | `${getApiBaseUrl()}/mcp/tools/${serverId}` | `${getApiBaseUrl()}/api/mcp/tools/${serverId}` | 获取服务器工具列表 |

### 文档更新

#### API 文档
**文件：** `docs/refer/API.md`

需要更新说明部分，将例外情况修改为：
- ~~原文：除特别说明外，以下表格中的路径均不含`/api`前缀，实际调用请加上`/api`；例外：OpenAI兼容接口(`/v1/*`)与图谱MCP工具接口(`/mcp/*`)无需`/api`，MCP变量服务使用`/api/mcp/*`。~~
- **修改为：** 除特别说明外，以下表格中的路径均不含`/api`前缀，实际调用请加上`/api`；例外：OpenAI兼容接口(`/v1/*`)无需`/api`前缀。

更新 MCP 接口列表，统一使用 `/api/mcp/*` 路径。

## 实施步骤

### Phase 1: 后端路由修改（优先级：高）

**发现**：除了图谱 MCP 和变量服务外，其他路由已经正确！只需修改 4 个路由定义。

1. **修改环境变量路由**
   - 文件：`app/api/routes/environment_variables.py`
   - 行号：207
   - 修改：`@env_var_bp.route('/mcp/env-vars')` → `@env_var_bp.route('/api/mcp/env-vars')`
   - 原因：补充缺失的 `/api` 前缀

2. **修改智能体变量路由**
   - 文件：`app/api/routes/agent_variables.py`
   - 行号：290
   - 修改：`@agent_variable_bp.route('/mcp/agent-vars')` → `@agent_variable_bp.route('/api/mcp/agent-vars')`
   - 原因：补充缺失的 `/api` 前缀

3. **修改图谱工具路由（重命名避免混淆）**
   - 文件：`app/api/routes/graph_mcp.py`
   - 修改：
     - 行 197：`@graph_mcp_bp.route('/mcp/tools')` → `@graph_mcp_bp.route('/api/mcp/graph-tools')`
     - 行 254：`@graph_mcp_bp.route('/mcp/tools/call')` → `@graph_mcp_bp.route('/api/mcp/graph-tools/call')`
   - 原因：
     - 补充缺失的 `/api` 前缀
     - 重命名 `tools` 为 `graph-tools`，避免与 MCP 服务器工具列表路径 `/api/mcp/tools/{server_id}` 混淆

4. **无需修改的路由（已正确）**
   - `app/services/mcp_server_manager.py` - Blueprint 前缀已设置为 `/api/mcp`
   - 所有 `/servers/*` 相关路由已正确
   - 所有 `/tools/<server_id>` 路由已正确

### Phase 2: 前端代码修改（优先级：高）

**问题根源**：前端调用时漏掉了 `/api` 前缀，导致所有 MCP 接口返回 404。

1. **修改 MCP 服务器管理页面**
   - 文件：`src/pages/settings/MCPServersPage.js`
   - 修改：将所有 `/mcp/` 路径改为 `/api/mcp/`（共 9 处）
   - 方法：全局替换 `${getApiBaseUrl()}/mcp/` 为 `${getApiBaseUrl()}/api/mcp/`

2. **修改工具管理页面**
   - 文件：`src/pages/roles/ToolManagement.js`
   - 修改：将所有 `/mcp/` 路径改为 `/api/mcp/`（共 3 处）
   - 方法：全局替换 `${getApiBaseUrl()}/mcp/` 为 `${getApiBaseUrl()}/api/mcp/`

### Phase 3: 文档更新（优先级：中）

1. **更新 API 文档**
   - 文件：`docs/refer/API.md`
   - 更新说明部分，移除 MCP 接口的例外说明
   - 更新 MCP 接口路径示例

### Phase 4: 测试验证（优先级：高）

1. **后端测试**
   - [ ] 测试环境变量 API：`POST /api/mcp/env-vars`
   - [ ] 测试智能体变量 API：`POST /api/mcp/agent-vars`
   - [ ] 测试图谱工具列表：`GET /api/mcp/graph-tools`
   - [ ] 测试图谱工具调用：`POST /api/mcp/graph-tools/call`
   - [ ] 测试 MCP 服务器管理：`GET /api/mcp/servers`
   - [ ] 测试 MCP 服务器工具列表：`GET /api/mcp/servers/{id}/tools`

2. **前端测试**
   - [ ] 测试 MCP 服务器管理页面功能
   - [ ] 测试工具管理页面的 MCP 工具加载
   - [ ] 测试角色配置中的 MCP 工具选择

3. **集成测试**
   - [ ] 测试 MCP 工具的完整调用链路
   - [ ] 测试变量服务的读写操作
   - [ ] 测试图谱增强功能

## 兼容性说明

**无需考虑向后兼容**，原因：
1. MCP 功能为新功能，尚未正式完成和发布
2. 前端调用本身就是错误的（漏掉 `/api` 前缀），需要修复而非保持
3. 这是 bug 修复而非接口变更，应直接纠正

## 风险评估

| 风险 | 影响程度 | 缓解措施 |
|------|----------|----------|
| 前端调用失败 | 低 | 修改后即可正常工作，当前本身就是无法使用的状态 |
| 后端路由冲突 | 低 | 只修改 4 个路由，其他已正确 |
| 测试覆盖不足 | 中 | 按照测试清单逐项验证 |

## 验收标准

- [ ] 所有 `/mcp/*` 路径已改为 `/api/mcp/*`
- [ ] 后端路由测试通过
- [ ] 前端功能测试通过
- [ ] API 文档已更新
- [ ] 无遗留的旧路径引用
- [ ] 所有测试用例通过

## 预估工作量

本次修改为 **Bug 修复**，工作量较小：

- 后端修改：0.5 小时（只需修改 4 个路由定义）
- 前端修改：0.5 小时（全局替换即可）
- 文档更新：0.5 小时
- 测试验证：1 小时
- **总计：2.5 小时**

## 重要改进说明

### 核心问题

**这不是一次重构，而是一次 Bug 修复**：
- 后端大部分路由已经正确使用 `/api/mcp` 前缀
- 前端调用时漏掉了 `/api` 前缀，导致 404 错误
- 需要修正前端错误，并完善后端剩余的路由

### 路径语义优化

除了修复 Bug，还进行了语义优化：

1. **图谱工具路径重命名**
   - 原路径：`/mcp/tools` 和 `/mcp/tools/call`
   - 新路径：`/api/mcp/graph-tools` 和 `/api/mcp/graph-tools/call`
   - **原因**：
     - 补充 `/api` 前缀
     - 改名为 `graph-tools` 避免与 MCP 服务器工具列表路径 `/api/mcp/tools/{server_id}` 混淆

2. **变量服务路径修正**
   - 环境变量：`/mcp/env-vars` → `/api/mcp/env-vars`
   - 智能体变量：`/mcp/agent-vars` → `/api/mcp/agent-vars`
   - **原因**：补充缺失的 `/api` 前缀

### 路径设计原则

- **统一前缀**：所有平台 API 使用 `/api` 前缀（除 OpenAI 兼容接口外）
- **语义明确**：使用具体名称而非通用名称（如 `graph-tools` 而非 `tools`）
- **避免歧义**：不同功能使用不同路径名，避免混淆

## 后续优化建议

1. **统一 API 路径规范**
   - 制定 API 路径命名规范文档
   - 所有平台 API 统一使用 `/api` 前缀
   - 外部兼容接口（如 OpenAI）除外

2. **API 版本管理**
   - 考虑引入版本号：`/api/v1/mcp/*`
   - 便于未来的接口升级和兼容性管理

3. **自动化测试**
   - 添加 API 路径的集成测试
   - 确保路径变更不会破坏功能

## 重要发现：前端代理导致的路径重复问题

### 问题现象
实施后发现前端请求路径变成了 `/api/api/mcp/servers`（双重 `/api`）。

### 根本原因
1. **前端代理配置**（`craco.config.js`）会拦截所有 `/api/*` 请求
2. **错误代码**使用了 `${getApiBaseUrl()}/api/mcp/servers`
3. **结果**：
   - `getApiBaseUrl()` 返回 `http://localhost:8080`
   - 前端发起请求：`http://localhost:8080/api/mcp/servers`
   - 被代理拦截（因为以 `/api` 开头）
   - 转发给后端：`http://localhost:8080/api/api/mcp/servers` ❌

### 最终解决方案
**前端应该直接使用相对路径 `/api/mcp/servers`**，让代理自动转发：
```javascript
// ❌ 错误
const apiUrl = `${getApiBaseUrl()}/api/mcp/servers`;

// ✅ 正确（使用原生 axios）
const apiUrl = `/api/mcp/servers`;

// ✅ 最推荐（使用全局 api 实例）
import api from '@/services/api/axios';
await api.get('/mcp/servers');  // baseURL 已包含 /api
```

### 规范化工作
基于此次问题，在 `docs/refer/API.md` 中添加了完整的 **API 路径规范**章节，包括：
1. 后端 Blueprint 定义规范（不应包含 `/api`）
2. 前端 API 调用规范（使用全局 api 实例）
3. 前端代理工作原理说明
4. 常见错误和解决方案
5. 开发检查清单
6. 完整的路径组成示例

## 相关文档

- [API 参考文档](../refer/API.md) - **已添加完整的 API 路径规范章节**
- [MCP 协议说明](../feature-knowledge-base/PLAN-mcp-prd.md)
- [系统架构文档](../README.md)

## 变更历史

| 日期 | 版本 | 修改人 | 说明 |
|------|------|--------|------|
| 2024-01-XX | 1.0 | - | 初始版本 |
| 2024-01-XX | 1.1 | - | 发现并修复前端代理导致的路径重复问题 |
| 2024-01-XX | 1.2 | - | 在 API.md 中添加完整的路径规范章节 |
