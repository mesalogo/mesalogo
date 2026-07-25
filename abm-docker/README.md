# ABM-LLM-V2 Docker 部署指南

遵循KISS原则的容器化部署方案：前后端分离，单一职责，简单高效。

## 架构说明

- **Backend**: Python Flask应用，独立容器运行
- **Frontend**: React应用构建后由Nginx托管
- **网络**: 容器间通过`abm-network`通信

## 文件说明

- `docker-compose.yml` - 服务编排配置
- `docker-compose.service-control.yml` - 服务控制可选覆盖层（Docker Socket）
- `backend.Dockerfile` - 后端镜像
- `frontend.Dockerfile` - 前端镜像（多阶段构建）
- `nginx.conf` - Nginx配置
- `Makefile` - 简化命令
- `.dockerignore` - 构建忽略文件

## 快速开始

### 1. 准备工作

确保已安装Docker和Docker Compose：

```bash
docker --version
docker compose version
```

### 2. 构建并启动

```bash
cd docker
make build  # 构建镜像
make up     # 启动服务
```

### 3. 访问应用

- **前端**: http://localhost:16000
- **后端API**: http://localhost:16001

> **端口约定**：所有宿主暴露端口统一在 16000 段。核心 16000(前端)/16001(后端)；
> Redis 16010、MariaDB 16011；Milvus 16020-16024；OnlyOffice 16030/16031；
> Graphiti/Neo4j 16040-16043；LightRAG 16050；Galapagos 16060；PaddleOCR 16070；VSCode 16080。
> 容器内端口与容器间通信不受影响。

## Makefile命令

### 基础命令
```bash
make help      # 显示帮助
make build     # 构建镜像
make up        # 启动核心服务 (backend, frontend)
make down      # 停止服务
make restart   # 重启服务
make logs      # 查看日志
make status    # 查看状态
make clean     # 清理所有
```

### 可选服务（Profile）
```bash
make up-milvus      # 启动 Milvus (向量数据库)
make up-graphiti    # 启动 Graphiti/Neo4j (记忆系统)
make up-lightrag    # 启动 LightRAG (知识库系统)
make up-onlyoffice  # 启动 OnlyOffice (文档编辑)
make up-galapagos   # 启动 Galapagos (NetLogo)
make up-vscode      # 启动 VSCode Server (代码编辑)
make up-paddleocr   # 启动 PaddleOCR-VL (OCR，需要GPU)
make up-all         # 启动所有服务（包含核心）
```

**注意**：
- `make up` - 只启动核心服务（backend, frontend）
- `make up-xxx` - 只启动对应的独立服务
- 如需同时使用，请分别运行或使用 `make up-all`

### 服务启停控制（显式启用）

系统管理中的“服务中心”可以对明确白名单内的可选容器执行启动、停止和重启。
这项能力默认关闭；启用时会把宿主机的 Docker Socket 绑定到后端容器：

```bash
make up-control
```

等价的原生命令是：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.service-control.yml \
  --profile core up -d --no-deps --force-recreate backend
```

> **高风险权限**：访问 `/var/run/docker.sock` 基本等同于拥有宿主机 root
> 控制权。只有受信任的管理员和受控网络才能访问后台；不要在多租户或不受信任的
> 部署中启用，也不要把 Socket 暴露成宿主 TCP 端口。

`up-control` 仅重新创建 `backend`，不会停止或重新创建已运行的 Milvus、Graphiti、
LightRAG 等可选服务，因此可以与 `.env` 中完整的 `COMPOSE_FILE` 服务集合共存。
后端还会核对容器的 Compose 项目归属标签；若部署使用自定义项目名，请在 `.env`
设置 `COMPOSE_PROJECT_NAME`，不要只在命令行临时传入 `docker compose -p`。
若之后执行会重新创建核心服务的命令（例如 `make up`、`make up-core` 或
`make up-all`），请在最后再次执行 `make up-control`，确保覆盖层仍然生效。

服务中心只控制已由 Docker Compose 创建、且位于后端固定白名单中的可选容器；
backend、frontend、MariaDB 和 Redis 不允许通过页面停止。首次安装或创建某个可选
服务仍需先执行对应命令，例如：

```bash
make up-milvus
make up-graphiti
make up-lightrag
```

服务目录刷新时也会并发检查这些可选服务所需的本地 Docker 镜像，并区分“全部存在”、
“部分存在”和“缺失”，展开服务可查看具体镜像引用。该检查完全只读，不会自动 pull、
build、tag、prune 或创建容器；镜像安装仍由上述 Compose/Makefile 命令负责。

关闭控制能力并移除 Socket 挂载：

```bash
make disable-control
```

等价的原生命令是：

```bash
docker compose \
  -f docker-compose.yml \
  --profile core up -d --no-deps --force-recreate backend
```

`docker-compose.service-control.yml` 故意没有加入 `.env.example` 的默认
`COMPOSE_FILE`；Compose 覆盖层一旦参与合并，Socket 挂载就会生效，不能仅靠 profile
安全地“隐藏”该挂载。

### 服务说明
- **Graphiti**: 智能体记忆系统，用于对话历史和上下文记忆
- **LightRAG**: 知识库系统，用于文档检索和RAG增强
- **Milvus**: 向量数据库，用于向量检索
- **OnlyOffice**: 在线文档编辑器
- **Galapagos**: NetLogo Web 运行环境
- **VSCode Server**: 在线代码编辑器
- **PaddleOCR-VL**: 视觉语言OCR服务

## 原生Docker命令

如果不使用Makefile：

```bash
# 构建
docker compose build

# 启动
docker compose up -d

# 停止
docker compose down

# 查看日志
docker compose logs -f

# 查看状态
docker compose ps
```

## 数据持久化

后端数据挂载在`../backend`目录下：

- `data/` - 应用数据
- `logs/` - 日志文件
- `config.conf` - 配置文件
- `mcp_config.json` - MCP配置
- `agent-workspace/` - Agent工作空间

## 健康检查

- **Backend**: 检查`/api/health`端点（每30s）
- **Frontend**: 检查Nginx根路径（每30s）
- 失败3次后自动重启

## 故障排除

### 端口冲突

```bash
# 检查端口占用
lsof -i :80
lsof -i :8080

# 修改docker-compose.yml中的端口映射
ports:
  - "8081:8080"  # 改为其他端口
```

### 构建失败

```bash
# 清理缓存重新构建
docker compose build --no-cache

# 清理所有
make clean
```

### 查看容器日志

```bash
# 查看特定服务
docker compose logs backend
docker compose logs frontend

# 实时跟踪
docker compose logs -f backend
```

### 进入容器调试

```bash
# 后端
docker compose exec backend bash

# 前端
docker compose exec frontend sh
```

## 生产部署建议

1. **HTTPS配置**: 在nginx.conf中配置SSL证书
2. **资源限制**: 在docker-compose.yml中添加内存/CPU限制
3. **日志管理**: 配置日志轮转，避免磁盘占满
4. **备份策略**: 定期备份`backend/data`目录
5. **监控告警**: 接入监控系统（Prometheus、Grafana等）

## 更新部署

```bash
git pull                # 拉取最新代码
cd docker
make down              # 停止服务
make build             # 重新构建
make up                # 启动服务
```

## 扩展配置

### 添加数据库服务

在`docker-compose.yml`中添加：

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=yourpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - abm-network

volumes:
  postgres_data:
```

### 配置环境变量

在`docker-compose.yml`的backend服务中添加：

```yaml
environment:
  - DATABASE_URL=postgresql://user:pass@postgres:5432/db
  - REDIS_URL=redis://redis:6379
```
