# 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 配置阿里云npm源并安装pnpm
# 钉死 pnpm 版本，避免镜像构建时拉到浮动最新版导致行为漂移（与本地一致）
RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm@11.5.3 \
    && pnpm config set registry https://registry.npmmirror.com

# 复制依赖文件
COPY frontend/package.json frontend/pnpm-lock.yaml* ./

# 安装依赖
# strict-dep-builds=false：package.json 已将 core-js 列入 ignoredBuiltDependencies，
# 但 pnpm 10+ 在 frozen 安装下仍会因 ERR_PNPM_IGNORED_BUILDS 返回非零退出码，
# 这里显式关闭该严格行为，使被忽略的构建脚本不致中断镜像构建。
RUN pnpm install --frozen-lockfile --config.strict-dep-builds=false

# 复制源代码
COPY frontend/ .

# 构建生产版本
# CI=true + verify-deps-before-run=false：宿主 frontend/ 经 COPY 覆盖后，其
# node_modules 可能与容器内 pnpm install 的状态不一致，pnpm 11 会在 run 前尝试
# 交互式删除/重装 node_modules，但容器无 TTY 会报 ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY。
# 关闭该 run 前校验即可（依赖已在上一步用 frozen-lockfile 装好）。
ENV CI=true
ENV DISABLE_ESLINT_PLUGIN=true
ENV REACT_APP_API_URL=/api
ENV PUBLIC_URL=/
RUN pnpm run --config.verify-deps-before-run=false build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/build /usr/share/nginx/html

# 复制nginx配置
COPY abm-docker/nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
# 用 127.0.0.1 而非 localhost：容器内 localhost 可能解析到 IPv6 ::1，而 nginx
# 仅监听 IPv4 0.0.0.0:80，会导致 wget 连接被拒、healthcheck 误报 unhealthy。
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
