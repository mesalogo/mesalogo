FROM python:3.12-slim

WORKDIR /app

# 配置阿里云apt源
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 配置阿里云pip源
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
    && pip config set install.trusted-host mirrors.aliyun.com

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    git \
    gcc \
    zlib1g-dev \
    ca-certificates \
    xz-utils \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js 22 (从阿里云镜像下载)
ARG NODE_VERSION=22.12.0
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then ARCH="x64"; fi && \
    if [ "$ARCH" = "arm64" ]; then ARCH="arm64"; fi && \
    curl -fsSL https://npmmirror.com/mirrors/node/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz | tar -xJ -C /usr/local --strip-components=1 && \
    npm config set registry https://registry.npmmirror.com

# 复制并安装Python依赖
COPY backend-fastapi/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend-fastapi/ .

# 创建数据目录
RUN mkdir -p logs data knowledgebase agent-workspace

# 健康检查
# 用 /api/health/live：进程级存活探针，由 liveness_router 在 Setup 模式与正常
# 模式下都无条件挂载，且不依赖 DB、不受许可证中间件与业务授权状态影响。
# 探活只回答“进程活着吗”，不能因许可证过期把健康容器判为 unhealthy。
# 用 127.0.0.1 避免容器内 localhost 解析到 IPv6 的问题。
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/api/health/live || exit 1

EXPOSE 8080

# --prod：生产模式（关闭 uvicorn reload）。容器挂载的 data/logs 卷在 /app 下持续
# 写入会触发 watchfiles 无限热重载，必须用生产模式避免。
CMD ["python", "run_app.py", "--prod"]
