# API 参考文档

本文档列出了后端提供的所有API接口，用于前端开发和调试。

## API 路径规范（重要！）

### 1. 后端路由定义规范

#### 规则 1：Blueprint 不应包含 `/api` 前缀


**正确示例：**
```python
# ✅ 正确：Blueprint 只定义业务路径
action_task_bp = Blueprint('action_tasks', __name__, url_prefix='/action-tasks')
role_bp = Blueprint('roles', __name__, url_prefix='/roles')

# ✅ 正确：子模块使用业务命名空间
vector_db_bp = Blueprint('vector_db', __name__, url_prefix='/vector-db')
mcp_bp = Blueprint('mcp', __name__, url_prefix='/mcp')
```

**错误示例：**
```python
# ❌ 错误：不要在 Blueprint 中包含 /api 前缀
bp = Blueprint('xxx', __name__, url_prefix='/api/mcp')  # 错误！
```

**原因**：`/api` 前缀由 Flask 应用或 Nginx 统一管理，Blueprint 只负责业务路由。
在注册的时候已经统一声明了（backend/app/api/routes/__init__.py）。

#### 规则 2：路由装饰器直接写业务路径

**正确示例：**
```python
# ✅ 正确：直接写业务路径
@action_task_bp.route('/', methods=['GET'])              # 实际路径：/api/action-tasks
@action_task_bp.route('/<task_id>', methods=['GET'])     # 实际路径：/api/action-tasks/<task_id>

# ✅ 正确：嵌套路径
@mcp_bp.route('/servers', methods=['GET'])               # 实际路径：/api/mcp/servers
@mcp_bp.route('/graph-tools', methods=['GET'])           # 实际路径：/api/mcp/graph-tools
```

**错误示例：**
```python
# ❌ 错误：路由装饰器中不要包含 /api 前缀
@bp.route('/api/mcp/servers', methods=['GET'])           # 错误！会导致 /api/api/mcp/servers
```

#### 规则 3：特殊路径的处理

**例外情况（无需 `/api` 前缀）：**
- OpenAI 兼容接口：`/v1/*`
- 公共访问接口：`/public/*`（如果需要）

```python
# ✅ 正确：OpenAI 兼容接口不需要 /api 前缀
openai_bp = Blueprint('openai', __name__, url_prefix='/v1')

# ✅ 正确：公共接口
public_bp = Blueprint('public', __name__, url_prefix='/public')
```

### 2. 前端调用规范

#### 规则 1：使用统一的 API 客户端

**推荐方式（使用全局 axios 实例）：**
```javascript
// ✅ 推荐：使用全局配置的 api 实例
import api from '@/services/api/axios';

// baseURL 已配置为 http://localhost:8080/api
await api.get('/action-tasks');              // 实际请求：/api/action-tasks
await api.post('/mcp/servers', data);        // 实际请求：/api/mcp/servers
```

**原因**：
- `api` 实例已配置 `baseURL: 'http://localhost:8080/api'`
- 请求会自动添加 `/api` 前缀
- 开发环境通过代理转发到后端

#### 规则 2：避免手动拼接完整 URL

**正确示例：**
```javascript
// ✅ 正确：直接使用相对路径
const response = await api.get('/action-tasks');
const response = await api.post('/mcp/servers', data);
```

**错误示例：**
```javascript
// ❌ 错误：不要手动拼接 getApiBaseUrl()
const apiUrl = `${getApiBaseUrl()}/api/mcp/servers`;    // 会导致 /api/api/mcp/servers
await axios.get(apiUrl);

// ❌ 错误：不要在路径中重复 /api
await api.get('/api/mcp/servers');                       // 会导致 /api/api/mcp/servers
```

#### 规则 3：特殊情况下的原生 axios 调用

**如果必须使用原生 axios（不推荐）：**
```javascript
// ⚠️ 不推荐但可接受：使用相对路径，依赖代理
import axios from 'axios';

// 开发环境：前端代理会将 /api/* 转发到后端
await axios.get('/api/mcp/servers');         // ✅ 正确

// ❌ 错误：不要手动拼接完整 URL
await axios.get('http://localhost:8080/api/mcp/servers');  // 会绕过代理
```

### 3. 前端代理配置

**开发环境代理（craco.config.js）：**
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api'  // 保持 /api 路径不变
    }
  }
}
```

**工作原理：**
- 前端请求 `/api/action-tasks` 
- 代理转发到 `http://localhost:8080/api/action-tasks`
- 后端接收到 `/api/action-tasks`

### 4. 常见错误和解决方案

| 错误现象 | 原因 | 解决方案 |
|----------|------|----------|
| `404: /api/api/xxx` | Blueprint 包含了 `/api` 前缀 | 移除 Blueprint 的 `/api` 前缀 |
| `404: /api/api/xxx` | 前端使用了 `${getApiBaseUrl()}/api/xxx` | 使用 `api.get('/xxx')` 或 `/api/xxx` |
| `404: /xxx` | 忘记加 `/api` 前缀 | 确保使用 `api` 实例或路径以 `/api` 开头 |
| CORS 错误 | 绕过了前端代理 | 使用相对路径而非完整 URL |

### 5. 检查清单

#### 后端开发检查清单
- [ ] Blueprint 的 `url_prefix` 不包含 `/api`
- [ ] 路由装饰器 `@bp.route()` 只写业务路径
- [ ] 特殊接口（如 `/v1/*`）正确配置为无 `/api` 前缀

#### 前端开发检查清单  
- [ ] 优先使用 `import api from '@/services/api/axios'`
- [ ] API 调用使用相对路径：`api.get('/action-tasks')`
- [ ] 不使用 `getApiBaseUrl()` 手动拼接 URL
- [ ] 不在路径中重复写 `/api`

### 6. 路径组成示例

**完整路径组成：**
```
前端代码       →  代理转发        →  Flask 应用      →  Blueprint    →  路由装饰器
api.get('/xxx') →  /api/xxx      →  /api 前缀处理   →  url_prefix   →  @route()
                                      (由 app 管理)      (/tasks)        ('/<id>')
                                                        
最终路径：/api/tasks/<id>
```

**MCP 服务示例：**
```
前端：api.get('/mcp/servers')
    ↓
代理：GET /api/mcp/servers → http://localhost:8080/api/mcp/servers
    ↓
Flask：接收 /api/mcp/servers
    ↓
Blueprint：url_prefix='/mcp'
    ↓
Route：@bp.route('/servers')
    ↓
Handler：处理请求
```

---

## 后端 REST API

**说明**：以下表格中的路径**不含** `/api` 前缀，实际调用时前端会自动添加。例外：OpenAI 兼容接口 (`/v1/*`) 无需 `/api` 前缀。

### 健康检查

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/health` | GET | API服务健康检查 |

### 认证管理 (Authentication)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/auth/login` | POST | 用户登录 |
| `/auth/logout` | POST | 用户登出 |
| `/auth/validate` | GET | 验证JWT令牌 |
| `/auth/user` | GET | 获取当前用户信息 |
| `/auth/change-password` | POST | 修改用户密码 |

### 行动任务管理 (Action Tasks)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/action-tasks` | GET | 获取所有行动任务列表，支持`include_agents=true`参数 |
| `/action-tasks/<task_id>` | GET | 获取特定行动任务详情 |
| `/action-tasks` | POST | 创建新行动任务 |
| `/action-tasks/<task_id>` | PUT | 更新行动任务信息 |
| `/action-tasks/<task_id>` | DELETE | 删除行动任务 |
| `/action-tasks/<task_id>/agents` | GET | 获取行动任务的智能体列表 |
| `/action-tasks/<task_id>/agents` | POST | 为行动任务添加智能体 |
| `/action-tasks/<task_id>/agents/<agent_id>` | DELETE | 从行动任务中移除智能体 |
| `/action-tasks/<task_id>/agents/<agent_id>/default` | PUT | 设置智能体为默认智能体 |
| `/action-tasks/<task_id>/direct-agents` | GET | 获取任务直接关联的智能体列表 |
| `/action-tasks/<task_id>/direct-agents` | POST | 为任务添加直接智能体 |
| `/action-tasks/<task_id>/default` | PUT | 设置默认规则集 |
| `/action-tasks/<task_id>/environment` | GET | 获取任务环境信息 |
| `/action-tasks/<task_id>/environment/variables` | PUT | 更新任务的环境变量 |
| `/action-tasks/<task_id>/conversations` | GET | 获取行动任务的会话列表 |
| `/action-tasks/<task_id>/conversations/<conversation_id>` | GET | 获取行动任务的特定会话 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/messages` | GET | 获取会话的消息列表 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/messages` | POST | 发送消息，支持`stream=1`参数启用流式响应 |
| `/action-tasks/<task_id>/conversations` | POST | 创建新会话 |
| `/action-tasks/<task_id>/conversations/<conversation_id>` | PUT | 更新会话信息 |
| `/action-tasks/<task_id>/conversations/<conversation_id>` | DELETE | 删除会话 |

| `/action-tasks/<task_id>/workspace-files` | GET | 获取行动任务的项目文件列表 |

### 会话管理 (Conversations)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/action-tasks/<task_id>/conversations` | GET | 获取行动任务的会话列表 |
| `/action-tasks/<task_id>/conversations` | POST | 创建新会话 |
| `/action-tasks/<task_id>/conversations/<conversation_id>` | GET | 获取特定会话详情 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/messages` | GET | 获取会话的消息列表 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/messages` | POST | 在会话中发送新消息，支持`stream=1`参数启用流式响应 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/auto-discussion` | POST | 启动自动讨论（支持多种模式，支持`stream=1`） |
| `/action-tasks/<task_id>/conversations/<conversation_id>/cancel-stream` | POST | 取消当前流式响应 |
| `/action-tasks/<task_id>/autonomous-tasks` | GET | 获取行动任务的所有自主任务记录 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/autonomous-tasks` | GET | 获取会话的自主任务记录 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/autonomous-tasks/<autonomous_task_id>/stop` | POST | 停止指定的自主任务 |
| `/action-tasks/<task_id>/conversations/<conversation_id>/autonomous-scheduling` | POST | 启动自主调度模式（支持流式） |

### 消息管理 (Messages)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/messages/<message_id>` | GET | 获取特定消息详情 |
| `/messages/<message_id>` | PUT | 更新消息内容 |
| `/messages/<message_id>` | DELETE | 删除消息 |

### 智能体管理 (Agents)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/agents` | GET | 获取所有智能体列表，支持`status=active`参数 |
| `/agents/<agent_id>` | GET | 获取特定智能体详情 |
| `/agents` | POST | 创建新智能体 |
| `/agents/<agent_id>` | PUT | 更新智能体信息 |
| `/agents/<agent_id>` | DELETE | 删除智能体 |
| `/agents/from-role/<role_id>` | POST | 从角色创建智能体 |

| `/agents/model-configs` | GET | 获取智能体可用的模型配置 |


### 智能体变量管理 (Agent Variables)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/agents/<agent_id>/variables` | GET | 获取智能体的所有变量 |
| `/agents/<agent_id>/variables/<name>` | GET | 获取智能体的指定变量 |
| `/agents/<agent_id>/variables` | POST | 创建智能体变量 |
| `/agents/<agent_id>/variables/<name>` | PUT, PATCH | 更新智能体变量 |
| `/agents/<agent_id>/variables/<name>` | DELETE | 删除智能体变量 |
| `/agents/<agent_id>/variables/<name>/history` | GET | 获取智能体变量的历史记录 |

### 角色管理 (Roles)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/roles` | GET | 获取所有角色列表 |
| `/roles/<role_id>` | GET | 获取特定角色详情 |
| `/roles` | POST | 创建新角色 |
| `/roles/<role_id>` | PUT | 更新角色信息 |
| `/roles/<role_id>` | DELETE | 删除角色 |
| `/roles/<role_id>/tools` | GET | 获取角色的工具列表 |
| `/roles/<role_id>/knowledges` | GET | 获取角色的知识库列表 |
| `/roles/model-configs` | GET | 获取角色可用的模型配置 |
| `/roles/predefined` | GET | 获取预定义角色列表 |
| `/roles/recent` | GET | 获取最近使用的角色列表 |
| `/roles/most-used` | GET | 获取最常用的角色列表 |
| `/roles/<role_id>/duplicate` | POST | 复制角色 |
| `/roles/<role_id>/test` | POST | 测试角色响应，支持流式响应 |
| `/roles/<role_id>/increment-usage` | POST | 增加角色使用次数 |
| `/roles/from-predefined/<predefined_id>` | POST | 从预定义角色创建角色 |
| `/roles/<role_id>/agents` | GET | 获取角色创建的智能体 |

### 行动空间管理 (Action Spaces)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/action-spaces` | GET | 获取所有行动空间列表 |
| `/action-spaces/<space_id>` | GET | 获取特定行动空间详情 |
| `/action-spaces` | POST | 创建新行动空间 |
| `/action-spaces/<space_id>` | PUT | 更新行动空间信息 |
| `/action-spaces/<space_id>` | DELETE | 删除行动空间 |
| `/action-spaces/<space_id>/rule-sets` | GET | 获取行动空间的规则集列表 |
| `/action-spaces/<space_id>/rule-sets` | POST | 创建行动空间规则集 |
| `/action-spaces/from-template/<template_id>` | POST | 从模板创建行动空间 |
| `/action-spaces/<space_id>/roles` | GET | 获取行动空间的角色列表 |
| `/action-spaces/<space_id>/roles` | POST | 为行动空间添加角色 |
| `/action-spaces/<space_id>/roles/<role_id>` | PUT | 更新行动空间中的角色设置 |
| `/action-spaces/<space_id>/roles/<role_id>` | DELETE | 从行动空间中移除角色 |
| `/action-spaces/<space_id>/detail` | GET | 获取行动空间的详细信息 |
| `/action-spaces/<space_id>/rule-sets/<rule_set_id>/rules` | GET | 获取行动空间规则集的规则列表 |
| `/action-spaces/<space_id>/rule-sets/<rule_set_id>/rules` | POST | 向行动空间规则集添加规则 |
| `/action-spaces/<space_id>/rule-sets/<rule_set_id>/rules/<rule_id>` | DELETE | 从行动空间规则集移除规则 |
| `/action-spaces/<space_id>/rule-sets/<rule_set_id>/rules/<rule_id>/priority` | PUT | 更新行动空间规则集中规则的优先级 |
| `/action-spaces/<space_id>/available-rules` | GET | 获取行动空间可添加的规则列表 |
| `/action-spaces/<space_id>/environment-variables` | GET | 获取行动空间的环境变量列表 |
| `/action-spaces/<space_id>/environment-variables` | POST | 创建行动空间环境变量 |
| `/action-spaces/<space_id>/environment-variables/<variable_id>` | PUT | 更新行动空间环境变量 |
| `/action-spaces/<space_id>/environment-variables/<variable_id>` | DELETE | 删除行动空间环境变量 |

### 标签管理 (Tags)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/tags` | GET | 获取所有标签列表 |

### 规则管理 (Rules)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/rules` | GET | 获取所有规则列表 |
| `/rules/<rule_id>` | GET | 获取特定规则详情 |
| `/rules` | POST | 创建新规则 |
| `/rules/<rule_id>` | PUT | 更新规则信息 |
| `/rules/<rule_id>` | DELETE | 删除规则 |
| `/rules/test` | POST | 测试规则 |
| `/rule-sets` | GET | 获取所有规则集列表 |
| `/rule-sets/<rule_set_id>` | GET | 获取特定规则集详情 |
| `/rule-sets` | POST | 创建新规则集 |
| `/rule-sets/<rule_set_id>` | PUT | 更新规则集信息 |
| `/rule-sets/<rule_set_id>` | DELETE | 删除规则集 |
| `/rule-sets/<rule_set_id>/rules` | GET | 获取规则集中的所有规则 |
| `/rule-sets/<rule_set_id>/rules` | POST | 向规则集添加规则 |
| `/rule-sets/<rule_set_id>/rules/<rule_id>` | DELETE | 从规则集移除规则 |
| `/rule-sets/<rule_set_id>/rules/<rule_id>/priority` | PUT | 更新规则在规则集中的优先级 |

### 能力管理 (Capabilities)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/capabilities` | GET | 获取所有能力列表 |
| `/capabilities/<capability_id>` | GET | 获取特定能力详情 |
| `/capabilities` | POST | 创建新能力 |
| `/capabilities/<capability_id>` | PUT | 更新能力信息 |
| `/capabilities/<capability_id>` | DELETE | 删除能力 |
| `/capabilities/with_roles` | GET | 获取所有能力及其关联角色的信息 |
| `/roles/<role_id>/capabilities` | GET | 获取指定角色的所有能力 |
| `/roles/<role_id>/capabilities/<capability_id>` | POST | 为角色添加能力 |
| `/roles/<role_id>/capabilities/<capability_id>` | DELETE | 从角色中移除能力 |

### 工具管理 (Tools)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/tools` | GET | 获取所有工具列表 |
| `/tools/<tool_id>` | GET | 获取特定工具详情 |
| `/tools` | POST | 创建新工具 |
| `/tools/<tool_id>` | PUT | 更新工具信息 |
| `/tools/<tool_id>` | DELETE | 删除工具 |
| `/roles/<role_id>/tools` | GET | 获取指定角色的所有工具 |
| `/roles/<role_id>/tools/<tool_id>` | POST | 为角色添加工具 |
| `/roles/<role_id>/tools/<tool_id>` | DELETE | 从角色中移除工具 |

### 模型配置管理 (Model Configs)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/model-configs` | GET | 获取所有模型配置列表 |
| `/model-configs/<config_id>` | GET | 获取特定模型配置详情 |
| `/model-configs` | POST | 创建新模型配置 |
| `/model-configs/<config_id>` | PUT | 更新模型配置信息 |
| `/model-configs/<config_id>` | DELETE | 删除模型配置 |
| `/model-configs/<config_id>/set-default` | POST | 设置默认模型配置 |
| `/model-configs/<config_id>/test-stream` | POST | 流式测试模型配置 |
| `/model-configs/<config_id>/test` | POST | 测试模型配置 |
| `/model-configs/<config_id>/has-api-key` | GET | 检查模型配置是否有API密钥 |
| `/model-configs/detect-provider` | POST | 检测模型提供商 |
| `/model-configs/provider/<provider>/models` | GET | 获取指定提供商的模型列表 |
| `/model-configs/default` | GET | 获取默认模型配置 |


| `/model-configs/anthropic/models` | POST | 获取Anthropic模型列表 |
| `/model-configs/google/models` | POST | 获取Google模型列表 |

| `/model-configs/ollama/models` | POST | 获取Ollama模型列表 |





| `/model-configs/xai/models` | POST | 获取X.ai模型列表 |
| `/model-configs/test-connection` | POST | 测试模型服务连接 |

### 系统设置管理 (Settings)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/settings` | GET | 获取所有系统设置 |
| `/settings/<key>` | GET | 获取特定系统设置 |
| `/settings` | POST | 创建或更新系统设置 |
| `/settings/<key>` | DELETE | 删除系统设置 |
| `/settings/category/<category>` | GET | 获取特定分类的系统设置 |
| `/settings/prompt-templates` | GET | 获取提示词模板 |
| `/settings/prompt-templates` | POST | 更新提示词模板 |

### 环境变量管理 (Environment Variables)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/environment-variables/tasks/<task_id>` | GET | 获取任务的所有环境变量 |
| `/action-tasks/<task_id>/environment-variables` | GET | 获取任务的所有环境变量 |
| `/action-tasks/<task_id>/environment-variables/<variable_id>` | GET | 获取任务的特定环境变量 |
| `/action-tasks/<task_id>/environment-variables/<variable_id>` | PUT | 设置任务的环境变量 |

### 外部变量管理 (External Variables)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/external-variables` | GET | 获取所有外部环境变量 |
| `/external-variables` | POST | 创建外部环境变量 |
| `/external-variables/<variable_id>` | PUT | 更新外部环境变量 |
| `/external-variables/<variable_id>` | DELETE | 删除外部环境变量 |
| `/external-variables/<variable_id>/sync` | POST | 手动同步外部环境变量 |

### 日志管理 (Logs)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/logs` | GET | 获取系统日志文件内容 |
| `/logs/tail` | GET | 获取日志文件的最后几行 |

### 统计信息 (Statistics)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/statistics/overview` | GET | 获取系统概览统计 |
| `/statistics/tasks` | GET | 获取任务统计数据 |
| `/statistics/roles` | GET | 获取角色统计数据 |
| `/statistics/action-spaces` | GET | 获取行动空间统计数据 |
| `/statistics/activity-trends` | GET | 获取活动趋势统计 |
| `/statistics/interactions` | GET | 获取交互统计数据 |
| `/statistics/ecosystem` | GET | 获取生态系统统计 |
| `/statistics/resources` | GET | 获取系统资源统计 |
| `/statistics/users` | GET | 获取用户统计数据 |
| `/statistics/autonomous-tasks` | GET | 获取自主任务统计数据 |
| `/statistics/dashboard` | GET | 获取仪表盘统计数据 |

### 记忆管理 (Memory)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/action-tasks/<task_id>/workspace-files` | GET | 获取行动任务的所有项目文件列表 |
| `/action-tasks/<task_id>/workspace-files/<file_path>` | GET | 获取特定项目文件内容 |
| `/action-tasks/<task_id>/workspace-files/<file_path>` | PUT | 更新项目文件内容 |
| `/workspace-management/task/<task_id>/workspaces` | GET | 获取指定任务的所有项目空间信息 |
| `/workspace-management/task/<task_id>/shared-workspace` | GET | 获取任务的共享工作区 |
| `/workspace-management/task/<task_id>/shared-workspace` | PUT | 更新任务的共享工作区 |
| `/workspace-management/task/<task_id>/workspace-index` | GET | 获取任务的项目索引 |
| `/workspace-management/task/<task_id>/workspace-index` | PUT | 更新任务的项目索引 |
| `/workspace-management/task/<task_id>/project-summary` | GET | 获取项目总结 |
| `/workspace-management/task/<task_id>/project-summary` | PUT | 更新项目总结 |
| `/workspace-management/task/<task_id>/agent/<agent_id>/workspace` | GET | 获取智能体工作空间 |
| `/workspace-management/task/<task_id>/agent/<agent_id>/workspace` | PUT | 更新智能体工作空间 |
| `/workspace-management/tasks-with-agents` | GET | 获取所有行动任务及其智能体信息 |

### 外部知识库管理 (External Knowledge)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/external-kb/connections` | GET | 获取所有外部知识库连接 |
| `/external-kb/connections` | POST | 创建外部知识库连接 |
| `/external-kb/connections/<connection_id>` | GET | 获取特定外部知识库连接详情 |
| `/external-kb/connections/<connection_id>` | PUT | 更新外部知识库连接 |
| `/external-kb/connections/<connection_id>` | DELETE | 删除外部知识库连接 |
| `/external-kb/connections/<connection_id>/test` | POST | 测试外部知识库连接 |
| `/external-kb/connections/<connection_id>/sync` | POST | 同步外部知识库 |
| `/external-kb/connections/<connection_id>/documents` | GET | 获取外部知识库文档列表 |
| `/external-kb/query` | POST | 查询外部知识库 |
| `/external-kb/stats` | GET | 获取外部知识库使用统计 |
| `/external-kb/query-logs` | GET | 获取查询日志 |

### 知识库管理 (Knowledge Base)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/knowledges` | GET | 获取所有知识库列表 |
| `/knowledges/<knowledge_id>` | GET | 获取特定知识库详情 |
| `/knowledges` | POST | 创建新知识库 |
| `/knowledges/<knowledge_id>` | PUT | 更新知识库信息 |
| `/knowledges/<knowledge_id>` | DELETE | 删除知识库 |
| `/knowledges/<knowledge_id>/files` | GET | 获取知识库文件列表（包含转换状态和嵌入状态） |
| `/knowledges/all-files` | GET | 获取所有知识库的文件列表（包含转换状态和嵌入状态） |
| `/knowledges/<knowledge_id>/files` | POST | 上传文件到知识库 |
| `/knowledges/<knowledge_id>/files/<file_id>` | DELETE | 删除知识库文件 |
| `/knowledges/<knowledge_id>/files/convert` | POST | 转换知识库文件为 Markdown（异步任务） |
| `/knowledges/<knowledge_id>/files/conversion-status` | GET | 获取文件转换状态（查询参数：`file_path`） |
| `/knowledges/<knowledge_id>/files/markdown` | GET | 获取转换后的 Markdown 内容（查询参数：`file_path`） |
| `/knowledges/<knowledge_id>/search` | POST | 在知识库中搜索 |
| `/knowledges/<knowledge_id>/stats` | GET | 获取知识库统计信息 |

#### 文件转换状态说明

文件转换状态包括：
- `not_converted` - 未转换
- `converting` - 转换中（对应数据库状态 `pending` 或 `processing`）
- `converted` - 已转换（对应数据库状态 `completed`）
- `conversion_failed` - 转换失败（对应数据库状态 `failed`）

嵌入状态包括：
- `not_embedded` - 未嵌入
- `embedding` - 嵌入中
- `embedded` - 已嵌入
- `embedding_failed` - 嵌入失败

### 文档解析器管理 (Document Parser)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/document-parser/test` | POST | 测试文档解析器（可选参数：`parser_name`） |
| `/document-parser/info` | GET | 获取文档解析器信息（当前启用的解析器、支持的格式等） |

#### 测试文档解析器请求示例

```json
{
  "parser_name": "mineru"  // 可选，默认使用当前配置的解析器
}
```

#### 测试文档解析器响应示例

```json
{
  "success": true,
  "data": {
    "parser_name": "mineru",
    "duration": 3.2,
    "message": "测试成功",
    "details": {
      "execution_time": 3.1,
      "output_files": 5,
      "output_size": 102400,
      "markdown_files": 1
    },
    "output_preview": "# 文档标题\n\n内容预览..."
  }
}
```

### 向量数据库管理 (Vector Database)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/vector-db/test-connection` | POST | 测试模型/向量数据库服务连接 |
| `/vector-db/validate-config` | POST | 校验向量数据库配置 |
| `/vector-db/providers` | GET | 获取所有向量数据库提供商 |
| `/vector-db/providers/<provider>/template` | GET | 获取指定提供商的配置模板 |
| `/vector-db/health` | POST | 向量数据库健康检查 |

### 许可证管理 (License)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/license` | GET | 获取当前许可证信息 |
| `/license/expired` | GET | 获取到期许可证信息 |
| `/license/activate` | POST | 通过密钥激活许可证 |
| `/license/activate-file` | POST | 通过上传文件激活许可证 |
| `/license/check-feature` | GET | 检查功能可用性 |
| `/license/check-limit` | GET | 检查资源限制 |
| `/license/system-key` | GET | 获取系统唯一标识 |
| `/license/check-limit` | GET | 检查资源限制 |

### 工具模式缓存 (Tool Schema Cache)

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/tool-schema-cache` | GET | 获取所有已缓存的服务器ID列表 |
| `/tool-schema-cache/<server_id>` | GET | 获取指定服务器的工具模式缓存 |
| `/tool-schema-cache/<server_id>` | DELETE | 移除指定服务器的工具模式缓存 |
| `/tool-schema-cache` | DELETE | 清空所有工具模式缓存 |
| `/tool-schema-cache/<server_id>/refresh` | POST | 刷新指定服务器的工具模式缓存 |
| `/tool-schema-cache/refresh-all` | POST | 刷新所有服务器的工具模式缓存 |

### MCP协议接口 (Model Context Protocol)

**说明**：所有 MCP 协议接口均使用 `/api/mcp` 前缀。

| 路径 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/api/mcp/variables` | POST | MCP变量服务端点（聚合），支持环境变量和智能体变量操作 |
| `/api/mcp/knowledge-base` | POST | MCP知识库服务端点（查询/管理） |
| `/api/mcp/env-vars` | POST | MCP环境变量服务端点，支持任务环境变量操作 |
| `/api/mcp/agent-vars` | POST | MCP智能体变量服务端点，支持智能体变量操作 |
| `/api/mcp/graph-tools` | GET | 图谱增强MCP工具列表 |
| `/api/mcp/graph-tools/call` | POST | 调用图谱增强MCP工具 |
| `/api/mcp/servers` | GET | 获取所有MCP服务器列表 |
| `/api/mcp/servers/<server_id>` | GET/PUT/DELETE | 获取/更新/删除MCP服务器配置 |
| `/api/mcp/servers/<server_id>/enable` | POST | 启用MCP服务器 |
| `/api/mcp/servers/<server_id>/disable` | POST | 禁用MCP服务器 |
| `/api/mcp/servers/config` | GET/POST | 获取/更新MCP配置文件 |
| `/api/mcp/tools/<server_id>` | GET/POST | 获取MCP服务器的工具列表 |


### 用户管理 (Users)

- GET `/api/users` — 获取用户列表（管理员）
- POST `/api/users` — 创建用户（管理员）
- GET `/api/users/<user_id>` — 获取用户详情（本人或管理员）
- PUT `/api/users/<user_id>` — 更新用户信息（本人或管理员；根用户限制）
- DELETE `/api/users/<user_id>` — 删除用户（管理员；禁止删除根用户/自己）
- POST `/api/users/<user_id>/password` — 重置用户密码（本人或管理员）
- PUT `/api/users/<user_id>/status` — 切换用户启用状态（管理员）
- GET `/api/users/current` — 获取当前登录用户信息
- GET `/api/users/permissions` — 获取当前用户权限摘要

说明：受JWT与RBAC控制；邮箱可为空；部分字段仅管理员可改，根用户保护规则已内置。

### 权限与角色 (Permissions & Roles)

- GET `/api/user-roles` — 列出角色（管理员）
- POST `/api/user-roles` — 创建角色（管理员）
- GET `/api/user-permissions` — 列出权限（管理员；含分组）
- GET `/api/user-roles/<user_role_id>/permissions` — 获取角色权限（管理员）
- POST `/api/user-roles/<user_role_id>/permissions` — 设置角色权限（管理员；系统角色只读）
- GET `/api/users/<user_id>/roles` — 获取用户的角色（管理员）
- POST `/api/users/<user_id>/roles` — 为用户分配角色（管理员，含超级管理员自改限制）
- DELETE `/api/users/<user_id>/roles/<user_role_id>` — 移除用户角色（管理员）
- GET `/api/users/<user_id>/permissions` — 获取用户聚合权限（管理员）
- GET `/api/current-user/permissions` — 获取当前用户权限
- POST `/api/permissions/initialize` — 初始化默认权限/角色/绑定（管理员）

### 图像上传与处理 (Image Upload)

- POST `/api/images/upload` — 表单文件上传，返回base64与图像信息
- POST `/api/images/process` — 统一处理入口（validate/info/resize）
- GET `/api/images/formats` — 支持的格式与限制

响应统一结构：`{ success, message, data }`；错误统一：`{ success: false, message }`。

### OnlyOffice 集成

- GET `/api/workspace-files/content?path=...` — 为OnlyOffice读取工作区文件内容
- POST `/api/onlyoffice/callback` — OnlyOffice保存回调（按官方规范写回工作区）
- POST `/api/onlyoffice/config` — 生成编辑器配置（含JWT，可配置autosave/forcesave）

路径安全校验确保仅访问`backend/agent-workspace`内文件。

### 一键生成 (One-Click Generation)

- POST `/api/one-click-generation/generate-role` — 基于需求生成角色方案
- POST `/api/one-click-generation/generate-action-space` — 生成行动空间配置
- POST `/api/one-click-generation/generate-rules` — 生成规则配置
- POST `/api/one-click-generation/generate-task` — 生成任务配置
- POST `/api/one-click-generation/generate-all` — 一次性生成完整方案
- POST `/api/one-click-generation/create-all` — 将生成方案落库并联结：角色→行动空间→规则集→任务→智能体；初始化会话与工作区

### 并行实验室 (Parallel Experiments)

- POST `/api/parallel-experiments` — 创建实验（管理员）
- GET `/api/parallel-experiments` — 列出实验
- GET `/api/parallel-experiments/<experiment_id>` — 实验详情
- GET `/api/parallel-experiments/<experiment_id>/runs` — 实验运行列表
- GET `/api/parallel-experiments/<experiment_id>/status` — 状态摘要与进度
- POST `/api/parallel-experiments/<experiment_id>/stop` — 停止实验（管理员）
- DELETE `/api/parallel-experiments/<experiment_id>` — 删除实验（管理员）
- POST `/api/parallel-experiments/validate-config` — 校验实验配置

### 记忆分区管理 (Memory Partitions)

- GET `/api/memory/partition-config` — 获取分区配置
- POST `/api/memory/partition-config` — 更新分区配置
- GET `/api/memory/partition-strategies` — 可用策略列表
- GET `/api/memory/partitions` — 分区列表
- GET `/api/memory/partition/<partition_id>/graph` — 分区图谱数据（limit、node_types）
- POST `/api/memory/partition/<partition_id>/search` — 分区内搜索（semantic/…）
- GET `/api/memory/partition/<partition_id>/stats` — 分区统计
- GET `/api/memory/overview` — 记忆系统总览
- POST `/api/memory/partition/<partition_id>/clear` — 清空分区

### 实体应用市场 (Market)

- GET `/api/market/apps` — 应用列表（category/featured/search/enabled_only）
- GET `/api/market/apps/<app_id>` — 应用详情
- POST `/api/market/apps/<app_id>/toggle` — 启用/禁用
- POST `/api/market/apps/<app_id>/launch` — 启动并记统计
- GET `/api/market/categories` — 所有分类
- POST `/api/market/apps` — 创建应用（管理员）
- PUT `/api/market/apps/<app_id>` — 更新应用（管理员）
- DELETE `/api/market/apps/<app_id>` — 删除应用（管理员）
- POST `/api/market/apps/<app_id>/bind-spaces` — 绑定到行动空间
- GET `/api/market/apps/<app_id>/bound-spaces` — 查看绑定空间
- GET `/api/market/action-spaces` — 行动空间列表（用于绑定）
- GET `/api/market/action-spaces/<space_id>/apps` — 某空间内启用的应用列表

### TiDB 向量数据库 (TiDB Vector)

前缀：`/api/vector-db/tidb`

- POST `/config/validate` — 校验连接字符串
- POST `/connection/test` — 测试连接
- POST `/connection/test-vector` — 测试向量能力（初始化/清理连接）
- POST `/config/parse` — 解析连接字符串
- GET `/info` — 依赖/默认配置/能力概览
- GET `/health` — 运行健康检查
- GET `/embedding/models` — 嵌入模型列表与默认模型
- POST `/embedding/generate` — 批量生成嵌入
- POST `/embedding/test` — 单条测试
- GET `/tables` — 列表
- POST `/tables/<table_name>` — 创建表（维度/度量/描述）
- DELETE `/tables/<table_name>` — 删除表
- GET `/tables/<table_name>/info` — 表信息
- POST `/tables/<table_name>/search` — 语义搜索（limit/metric/filters/model_id）

### 图谱增强接口

**图谱增强 MCP 工具**：请参考上面的 [MCP协议接口](#mcp协议接口-model-context-protocol) 章节，路径为 `/api/mcp/graph-tools` 和 `/api/mcp/graph-tools/call`。

服务受`GraphEnhancement`配置与开关控制；查询参数示例：`mode=hybrid, top_k=60, chunk_top_k=10`。

## 前端 API

前端主要通过以上后端REST API进行数据交互。前端的主要功能模块包括：

### 页面路由

| 路径 | 组件 | 描述 |
| ---- | ---- | ---- |
| `/` | Dashboard | 系统仪表盘 |
| `/action-tasks` | ActionTaskList | 行动任务列表 |
| `/action-tasks/:id` | ActionTaskDetail | 行动任务详情 |
| `/action-tasks/:id/conversation/:conversationId` | ConversationView | 会话界面 |
| `/action-spaces` | ActionSpaceList | 行动空间列表 |
| `/action-spaces/:id` | ActionSpaceDetail | 行动空间详情 |
| `/roles` | RoleList | 角色列表 |
| `/roles/:id` | RoleDetail | 角色详情 |
| `/agents` | AgentList | 智能体列表 |
| `/agents/:id` | AgentDetail | 智能体详情 |
| `/model-configs` | ModelConfigList | 模型配置列表 |
| `/settings` | Settings | 系统设置 |
| `/logs` | LogViewer | 日志查看器 |
| `/statistics` | Statistics | 统计信息 |
| `/workspace-management` | WorkspaceManagement | 项目空间管理 |
| `/knowledgebase` | KnowledgeBase | 知识库管理 |
| `/knowledgebase/external` | ExternalIntegration | 外部知识库集成 |
| `/action-tasks/:id/conversations/:conversationId` | ConversationView | 会话界面 |
| `/agents` | AgentList | 智能体列表 |
| `/agents/:id` | AgentDetail | 智能体详情 |
| `/roles` | RoleList | 角色列表 |
| `/roles/:id` | RoleDetail | 角色详情 |
| `/action-spaces` | ActionSpaceList | 行动空间列表 |
| `/action-spaces/:id` | ActionSpaceDetail | 行动空间详情 |
| `/rules` | RuleList | 规则列表 |
| `/rules/:id` | RuleDetail | 规则详情 |
| `/model-configs` | ModelConfigList | 模型配置列表 |
| `/settings` | Settings | 系统设置 |
| `/logs` | LogViewer | 日志查看器 |
| `/workspace/browser` | PartitionWorkspaceTab | 工作空间浏览器 |
| `/roles/memories` | WorkspaceManagement | 分区记忆管理 |
| `/statistics` | Statistics | 统计信息 |

### 主要组件

| 组件名称 | 功能描述 |
| ---- | ---- |
| `ConversationView` | 会话界面，支持实时消息流 |
| `MessageList` | 消息列表组件 |
| `AgentSelector` | 智能体选择器 |
| `ModelConfigSelector` | 模型配置选择器 |
| `RuleEditor` | 规则编辑器 |
| `MemoryViewer` | 记忆文件查看器 |
| `StatisticsChart` | 统计图表组件 |
| `LogViewer` | 日志查看器 |

## 流式响应 API (Server-Sent Events)

系统支持流式响应，用于实时传输智能体消息和模型响应。流式响应通过Server-Sent Events (SSE)实现。

### 流式消息传输

| 端点 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/action-tasks/<task_id>/conversations/<conversation_id>/messages?stream=1` | POST | 发送消息并接收流式响应 |
| `/conversations/<conversation_id>/messages?stream=1` | POST | 在会话中发送消息并接收流式响应 |
| `/roles/<role_id>/test?stream=1` | POST | 测试角色并接收流式响应 |

### 流式响应格式

流式响应使用SSE格式，每个事件包含以下字段：

```
data: {"type": "content", "content": "消息内容片段"}

data: {"type": "meta", "agentId": "123", "agentName": "智能体名称", "status": "processing"}

data: {"type": "done", "message": "响应完成"}
```

### 连接管理

系统提供连接管理功能，支持取消正在进行的流式请求：

| 端点 | 方法 | 描述 |
| ---- | ---- | ---- |
| `/action-tasks/<task_id>/conversations/<conversation_id>/cancel-stream` | POST | 取消当前流式响应 |



## 前后端API对接指南

### API请求配置

1. **API前缀**: 所有API都以`/api`为前缀
   ```javascript
   // 正确的请求URL示例
   const response = await fetch('/api/model-configs');

   // 使用axios时，确保路径中包含/api前缀
   const response = await axios.get('/api/model-configs');
   ```

2. **Content-Type**: 所有请求和响应均使用JSON格式
   ```javascript
   // 请求头设置
   headers: {
     'Content-Type': 'application/json'
   }
   ```

3. **认证**: 需要认证的API请求需要包含JWT令牌
   ```javascript
   // 在请求头中包含JWT令牌
   headers: {
     'Content-Type': 'application/json',
     'Authorization': `Bearer ${token}`
   }
   ```

4. **基础URL配置**: 建议在环境变量中配置API基础URL
   ```javascript
   // 环境变量配置
   const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

   // 使用配置
   const response = await fetch(`${API_BASE_URL}/action-tasks`);
   ```



### 错误处理策略

#### 处理404错误

当API请求返回404错误时，可能有以下原因：

1. **API路径错误**: 请检查请求URL是否正确，特别是前缀和路径拼写
   ```javascript
   // 错误示例：缺少/api前缀
   fetch('/action-tasks')  // 错误

   // 正确示例
   fetch('/api/action-tasks')  // 正确
   ```

2. **后端未实现该API**: 对于未实现的API，前端应实现回退到模拟数据的机制
   ```javascript
   try {
     const response = await api.get('/api/action-tasks');
     return response.data;
   } catch (error) {
     if (error.response && error.response.status === 404) {
       console.warn('API未实现，使用模拟数据');
       return mockData;
     }
     throw error;
   }
   ```

3. **资源不存在**: 如请求不存在的ID
   ```javascript
   try {
     const response = await api.get(`/api/model-configs/${id}`);
     return response.data;
   } catch (error) {
     if (error.response && error.response.status === 404) {
       message.error('请求的资源不存在');
     }
     throw error;
   }
   ```

### 常见API响应状态码

| 状态码 | 描述 | 处理建议 |
|------|------|---------|
| 200 | 成功 | 正常处理返回数据 |
| 201 | 创建成功 | 资源创建成功，可获取新资源ID |
| 400 | 请求错误 | 检查请求参数是否完整/正确 |
| 401 | 未授权 | 用户未登录或token已过期，需要重新登录 |
| 403 | 禁止访问 | 用户无权访问该资源，检查权限设置 |
| 404 | 资源不存在 | 检查请求路径和资源ID |
| 422 | 数据验证失败 | 检查提交的数据格式和内容 |
| 429 | 请求过于频繁 | 实施请求限流，稍后重试 |
| 500 | 服务器错误 | 后端处理出错，可查看服务器日志 |
| 502 | 网关错误 | 服务器暂时不可用 |
| 503 | 服务不可用 | 服务器维护中或过载 |

### API响应格式规范

#### 成功响应格式
```javascript
// 单个资源
{
  "id": 1,
  "name": "示例资源",
  "created_at": "2023-12-01T10:00:00Z"
}

// 资源列表
{
  "items": [...],
  "total": 100,
  "page": 1,
  "per_page": 10
}

// 操作成功
{
  "success": true,
  "message": "操作成功",
  "data": {...}
}
```

#### 错误响应格式
```javascript
// 一般错误
{
  "error": "错误描述",
  "code": "ERROR_CODE",
  "details": {...}
}

// 验证错误
{
  "error": "数据验证失败",
  "validation_errors": {
    "field_name": ["错误信息1", "错误信息2"]
  }
}
```

### 分页请求规范

对于支持分页的接口，前端应传递以下参数：

```javascript
// 分页请求示例
const response = await api.get('/api/action-tasks', {
  params: {
    page: 1,        // 当前页码，从1开始
    per_page: 10,   // 每页记录数
    sort_by: 'created_at',  // 排序字段
    sort_dir: 'desc'        // 排序方向：asc或desc
  }
});

// 后端返回的分页数据结构
{
  "items": [...],  // 当前页的数据项
  "total": 100,    // 总记录数
  "page": 1,       // 当前页码
  "per_page": 10,  // 每页记录数
  "pages": 10      // 总页数
}
```

### 过滤和搜索规范

```javascript
// 过滤和搜索请求示例
const response = await api.get('/api/action-tasks', {
  params: {
    name: '搜索关键词',     // 名称搜索
    status: 'active',      // 状态过滤
    created_after: '2023-01-01',  // 创建时间过滤
    include_agents: 'true' // 包含关联数据
  }
});
```

### 批量操作规范

```javascript
// 批量删除示例
const response = await api.delete('/api/action-tasks/batch', {
  data: {
    ids: [1, 2, 3, 4, 5]
  }
});

// 批量更新示例
const response = await api.put('/api/agents/batch', {
  data: {
    updates: [
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' }
    ]
  }
});
```

## MCP工具列表

系统提供符合Model Context Protocol (MCP)规范的工具集，可以通过MCP客户端（如Claude、Cursor等）使用。

### 环境变量管理工具

| 工具名称 | 描述 | 参数 | 返回值 |
| ---- | ---- | ---- | ---- |
| `get_task_var` | 获取任务环境变量的值 | `{task_id, var_name}` | 变量值（字符串） |
| `set_task_var` | 设置任务环境变量的值 | `{task_id, var_name, var_value}` | 设置后的变量值 |
| `list_task_vars` | 列出任务的所有环境变量 | `{task_id}` | 变量名值对象 |

### 智能体变量管理工具

| 工具名称 | 描述 | 参数 | 返回值 |
| ---- | ---- | ---- | ---- |
| `get_agent_var` | 获取智能体变量的值 | `{agent_id, var_name}` | 变量值（字符串） |
| `set_agent_var` | 设置智能体变量的值 | `{agent_id, var_name, var_value}` | 设置后的变量值 |
| `list_agent_vars` | 列出智能体的所有变量 | `{agent_id}` | 变量名值对象 |

### MCP服务器配置

#### 连接信息
- **服务器地址**: `http://localhost:8080`
- **环境变量端点**: `/mcp/env-vars`
- **智能体变量端点**: `/mcp/agent-vars`
- **变量服务端点**: `/api/mcp/variables`

#### 使用示例
```json
// MCP工具调用示例
{
  "name": "get_task_var",
  "input": {
    "task_id": 1,
    "var_name": "current_status"
  }
}

// MCP工具响应示例
{
  "type": "tool_result",
  "tool_use_id": "call_123",
  "content": "active",
  "is_error": false
}
```

### 错误处理

MCP工具调用可能返回以下错误：

| 错误类型 | 描述 | 处理建议 |
| ---- | ---- | ---- |
| `TASK_NOT_FOUND` | 任务不存在 | 检查任务ID是否正确 |
| `AGENT_NOT_FOUND` | 智能体不存在 | 检查智能体ID是否正确 |
| `VARIABLE_NOT_FOUND` | 变量不存在 | 检查变量名是否正确 |
| `PERMISSION_DENIED` | 权限不足 | 检查访问权限设置 |
| `VALIDATION_ERROR` | 数据验证失败 | 检查输入参数格式 |

## API更新日志

### 最新更新 (2025-10-03)

#### 新增API模块
- **文档解析器管理（Document Parser）**
  - `POST /api/document-parser/test` - 测试文档解析器配置
  - `GET /api/document-parser/info` - 获取文档解析器信息
  - 支持 MinerU、OlmOCR、MarkItDown 等多种解析器
  - 提供测试结果预览和详细信息

#### 增强的API功能
- **知识库管理（Knowledge Base）**
  - `POST /api/knowledges/<knowledge_id>/files/convert` - 转换文件为 Markdown（异步任务）
  - `GET /api/knowledges/<knowledge_id>/files/conversion-status` - 查询文件转换状态
  - `GET /api/knowledges/<knowledge_id>/files/markdown` - 获取转换后的 Markdown 内容
  - `GET /api/knowledges/all-files` - 获取所有知识库的文件列表
  - 文件列表接口增加 `conversion_status` 和 `embedding_status` 字段
  - 支持文件转换状态跟踪（未转换、转换中、已转换、转换失败）
  - 支持嵌入状态跟踪（未嵌入、嵌入中、已嵌入、嵌入失败）

#### 配置管理增强
- **基本设置（Settings）**
  - 新增内置向量数据库配置选项
    - `builtin_vector_db_host` - 内置向量数据库主机地址
    - `builtin_vector_db_port` - 内置向量数据库端口
  - 文档解析器配置扁平化
    - `document_parser_tool` - 当前启用的解析器
    - `document_parser_mineru_config` - MinerU 配置
    - `document_parser_olmocr_config` - OlmOCR 配置
    - `document_parser_markitdown_config` - MarkItDown 配置

#### 数据库变更
- 新增 `knowledge_file_conversions` 表，用于跟踪文档转换任务
  - `id` - 主键
  - `knowledge_id` - 知识库ID
  - `file_path` - 文件路径
  - `status` - 转换状态（pending, processing, completed, failed）
  - `error_message` - 错误信息
  - `created_at` - 创建时间
  - `updated_at` - 更新时间

#### 技术改进
- 修复 Flask URL 编码问题（UTF-8 vs Latin-1）
- 统一状态映射格式（数据库状态 → 前端状态）
- 优化配置读取逻辑（优先从数据库读取，回退到 app.config）
- 使用后台线程处理文档转换任务，避免阻塞主线程
- 添加文件路径安全校验

### 最新更新 (2025-09-29)

#### 新增API模块
- 用户管理（Users）与 权限/角色（Permissions & Roles）
- 图像上传与处理（Image Upload）
- OnlyOffice 集成（文件内容提供、保存回调、编辑器配置）
- 一键生成（One-Click Generation）端到端生成与落库
- 并行实验室（Parallel Experiments）创建/状态/运行/校验
- 记忆分区管理（Memory Partitions）配置/图谱/搜索/统计
- 实体应用市场（Market）应用与行动空间绑定
- TiDB 向量数据库（TiDB Vector）配置/连接/嵌入/表/语义搜索（路径：`/api/vector-db/tidb/*`）
- 图谱增强 OpenAI 兼容 + MCP 工具（/v1/* 与 /mcp/*）

#### 重要变更
- 文档已注明例外：部分接口无 `/api` 前缀（OpenAI兼容 `/v1/*`、MCP `/mcp/*`）。
- TiDB Vector 已统一到向量数据库命名空间：`/api/vector-db/tidb/*`。

### 最新更新 (2024-12-19)

#### 新增API模块
- **认证管理**: 用户登录、登出、令牌验证
- **日志管理**: 系统日志查看和尾部读取
- **统计信息**: 系统各模块统计数据
- **记忆管理**: 行动任务记忆文件管理
- **许可证管理**: 许可证激活和验证
- **外部变量管理**: 外部API数据同步
- **工具模式缓存**: MCP工具模式缓存管理

#### 增强的API功能
- **行动任务**: 添加启动、停止、暂停、恢复等状态控制
- **会话管理**: 添加自主任务管理功能
- **智能体管理**: 添加状态控制和测试功能
- **角色管理**: 添加预定义角色、最近使用、测试等功能
- **规则管理**: 添加规则测试功能
- **系统设置**: 添加提示词模板管理



#### MCP协议支持
- 完整的环境变量和智能体变量管理工具
- 标准化的MCP工具调用格式
- 详细的错误处理机制

## 开发指南

### 前端开发建议

1. **状态管理**: 使用Redux或Zustand管理全局状态
2. **API封装**: 创建统一的API客户端，处理认证和错误
3. **实时更新**: 利用Server-Sent Events (SSE)实现实时数据更新
4. **错误处理**: 实现统一的错误处理和用户提示机制
5. **缓存策略**: 合理使用缓存减少不必要的API请求

### 后端开发建议

1. **API版本控制**: 为重大更新预留版本控制机制
2. **数据验证**: 严格验证所有输入数据
3. **权限控制**: 实现细粒度的权限控制
4. **日志记录**: 记录所有重要操作和错误
5. **性能优化**: 优化数据库查询和API响应时间

### 测试建议

1. **单元测试**: 为所有API端点编写单元测试
2. **集成测试**: 测试前后端集成功能
3. **性能测试**: 测试高并发场景下的系统性能
4. **安全测试**: 验证认证和权限控制机制

---

**文档版本**: v2.0
**最后更新**: 2024-12-19
**维护者**: 开发团队