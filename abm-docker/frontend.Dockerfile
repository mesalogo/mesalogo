# 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 配置阿里云npm源并安装pnpm
RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm \
    && pnpm config set registry https://registry.npmmirror.com

# 复制依赖文件
COPY frontend/package.json frontend/pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY frontend/ .

# 构建生产版本
ENV DISABLE_ESLINT_PLUGIN=true
ENV REACT_APP_API_URL=/api
ENV PUBLIC_URL=/
RUN pnpm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/build /usr/share/nginx/html

# 复制nginx配置
COPY abm-docker/nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
