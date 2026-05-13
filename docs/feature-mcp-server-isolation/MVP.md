# MCP 服务器隔离 MVP 测试

本文档用于验证 MCP 服务器多级隔离功能是否正常工作。

## 1. 测试前提

### 1.1 环境要求

- Docker 已安装并运行
- `mcp-excalidraw-abm` 镜像已构建
- 后端服务已启动
- 至少两个测试用户账号

### 1.2 配置变更

在 `backend/mcp_config.json` 中添加隔离配置：

```json
{
  "mcpServers": {
    "excalidraw": {
      "isolation_level": "task",
      "internal": false,
      "comm_type": "stdio",
      "enabled": true,
      "command": "docker",
      "args": ["run", "-i", "--rm", "-p", "${PORT}:3000", "mcp-excalidraw-abm"],
      "port_range": [3030, 3100],
      "lifecycle": {
        "lazy_start": true,
        "idle_timeout_seconds": 1800,
        "max_instances_per_user": 5,
        "max_instances_global": 50
      }
    },
    "Office-Word-MCP-Server": {
      "isolation_level": "user",
      "internal": false,
      "comm_type": "stdio",
      "enabled": true,
      "command": "uvx",
      "args": ["--directory", "./agent-workspace/${USER_ID}", "--from", "office-word-mcp-server", "word_mcp_server"]
    },
    "variables-server": {
      "isolation_level": "system",
      "internal": true,
      "comm_type": "stdio",
      "enabled": true,
      "command": "curl",
      "args": ["-s", "-X", "POST", "http://localhost:8080/api/mcp/variables"]
    }
  }
}
```

---

## 2. 测试用例

### 2.1 任务级隔离 - Excalidraw

**目标**：验证不同任务使用独立的 Excalidraw 实例，数据互不可见。

#### 测试步骤

1. **创建任务 A**
   - 登录用户 1
   - 创建新的行动任务，命名为 "测试任务A"
   - 记录 task_id_A

2. **任务 A 中创建图形**
   - 在任务 A 的对话中，让 Agent 调用 Excalidraw：
   ```
   请使用 Excalidraw 创建一个红色的矩形，标注文字 "Task A"
   ```
   - 预期：Agent 调用 `create_element` 工具
   - 记录分配的端口（如 3030）

3. **创建任务 B**
   - 同一用户创建另一个任务，命名为 "测试任务B"
   - 记录 task_id_B

4. **任务 B 中创建图形**
   - 在任务 B 的对话中：
   ```
   请使用 Excalidraw 创建一个蓝色的圆形，标注文字 "Task B"
   ```
   - 预期：Agent 启动新的 Excalidraw 实例
   - 记录分配的端口（如 3031）

5. **验证隔离**
   - 访问 `http://localhost:3030` → 只有红色矩形 "Task A"
   - 访问 `http://localhost:3031` → 只有蓝色圆形 "Task B"

#### 验证命令

```bash
# 检查运行中的 Excalidraw 容器
docker ps --filter "ancestor=mcp-excalidraw-abm"

# 预期输出：两个容器，分别映射不同端口
CONTAINER ID   IMAGE                 PORTS                    NAMES
abc123         mcp-excalidraw-abm    0.0.0.0:3030->3000/tcp   mcp-excalidraw-task_A
def456         mcp-excalidraw-abm    0.0.0.0:3031->3000/tcp   mcp-excalidraw-task_B
```

#### 预期结果

| 检查项 | 预期 |
|--------|------|
| 容器数量 | 2 个独立容器 |
| 端口分配 | 不同端口（3030, 3031） |
| 数据隔离 | 任务 A 看不到任务 B 的图形 |
| Session Key | `excalidraw:task_A`, `excalidraw:task_B` |

---

### 2.2 用户级隔离 - Office Word

**目标**：验证不同用户使用独立的工作目录。

#### 测试步骤

1. **用户 1 创建文档**
   - 登录用户 1（user_id = "user1"）
   - 创建任务，让 Agent 创建 Word 文档：
   ```
   请创建一个 Word 文档，文件名为 report.docx，内容是 "用户1的报告"
   ```

2. **用户 2 创建文档**
   - 登录用户 2（user_id = "user2"）
   - 创建任务，让 Agent 创建同名文档：
   ```
   请创建一个 Word 文档，文件名为 report.docx，内容是 "用户2的报告"
   ```

3. **验证隔离**
   - 检查文件系统：
   ```bash
   ls -la ./agent-workspace/user1/report.docx
   ls -la ./agent-workspace/user2/report.docx
   ```

#### 预期结果

| 检查项 | 预期 |
|--------|------|
| 文件路径 | `./agent-workspace/user1/report.docx` 和 `./agent-workspace/user2/report.docx` |
| 文件内容 | 各自独立，互不覆盖 |
| Session Key | `Office-Word-MCP-Server:user1`, `Office-Word-MCP-Server:user2` |

---

### 2.3 系统级共享 - Variables Server

**目标**：验证系统级服务共享实例，通过参数实现数据面隔离。

#### 测试步骤

1. **任务 A 设置变量**
   - 在任务 A 中：
   ```
   请设置一个变量 project_name，值为 "Project Alpha"
   ```

2. **任务 B 设置同名变量**
   - 在任务 B 中：
   ```
   请设置一个变量 project_name，值为 "Project Beta"
   ```

3. **验证数据面隔离**
   - 任务 A 读取变量：
   ```
   请读取变量 project_name 的值
   ```
   - 预期返回：`"Project Alpha"`
   
   - 任务 B 读取变量：
   ```
   请读取变量 project_name 的值
   ```
   - 预期返回：`"Project Beta"`

#### 预期结果

| 检查项 | 预期 |
|--------|------|
| 实例数量 | 1 个共享实例 |
| Session Key | `variables-server`（无后缀） |
| 数据隔离 | 通过 `task_id` 参数区分（由 `inject_partition_identifier` 处理） |

---

## 3. 归档资源释放测试

**目标**：验证任务归档时释放关联的 MCP 实例。

#### 测试步骤

1. **确认任务 A 的 Excalidraw 实例运行中**
   ```bash
   docker ps --filter "name=mcp-excalidraw-task_A"
   ```

2. **归档任务 A**
   - 在前端将任务 A 标记为已完成
   - 点击"归档"按钮

3. **验证资源释放**
   ```bash
   # 容器应已停止
   docker ps --filter "name=mcp-excalidraw-task_A"
   # 预期：无输出（容器已删除）
   
   # 端口应已释放
   lsof -i :3030
   # 预期：无输出（端口空闲）
   ```

#### 预期结果

| 检查项 | 归档前 | 归档后 |
|--------|--------|--------|
| 容器状态 | 运行中 | 已删除 |
| 端口 3030 | 占用 | 空闲 |
| Session 缓存 | 存在 | 已清理 |

---

## 4. 问题排查

### 4.1 容器启动失败

```bash
# 检查 Docker 服务
docker info

# 检查镜像是否存在
docker images | grep mcp-excalidraw-abm

# 手动测试容器启动
docker run -i --rm -p 3030:3000 mcp-excalidraw-abm
```

### 4.2 端口冲突

```bash
# 检查端口占用
lsof -i :3030-3100

# 清理孤儿容器
docker ps -a --filter "name=mcp-" -q | xargs docker rm -f
```

### 4.3 Session 未创建

检查后端日志：
```bash
# 查看 MCP 相关日志
tail -f backend/logs/app.log | grep -E "(MCPServerManager|session_key|isolation)"
```

### 4.4 数据面隔离失效

检查 `tool_handler.py` 中的参数注入：
```python
# 确认 inject_partition_identifier 被调用
# 确认 task_id 正确传递到工具参数
```

---

## 5. 测试结果记录模板

| 测试项 | 日期 | 测试人 | 结果 | 备注 |
|--------|------|--------|------|------|
| 任务级隔离 - Excalidraw | | | PASS/FAIL | |
| 用户级隔离 - Office Word | | | PASS/FAIL | |
| 系统级共享 - Variables | | | PASS/FAIL | |
| 归档资源释放 | | | PASS/FAIL | |

---

## 6. 相关文档

- [PLAN.md](./PLAN.md) - 详细设计方案
- [mcp_config.json](../../backend/mcp_config.json) - MCP 服务器配置
