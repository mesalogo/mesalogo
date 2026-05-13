# dir2map 目录

此目录用于存放 Docker 容器的持久化映射数据，避免每次启动容器时重新下载。

## 目录结构

```
dir2map/
├── cache/    -> /root/.cache           # HuggingFace、torch 等模型缓存
├── hanlp/    -> /root/.hanlp           # HanLP NLP 模型
├── uv/       -> /root/.local/share/uv  # uvx 安装的 MCP 服务器
└── npm/      -> /root/.npm             # npm/npx 包缓存
```

## 离线部署

此目录可单独打包用于离线部署，避免在无网络环境下重新下载模型和工具：

```bash
# 在联网环境下运行一次，确保所有模型和工具已下载
docker compose up -d backend
# 等待所有模型下载完成后停止
docker compose down

# 打包 dir2map 目录
tar -czvf dir2map-offline.tar.gz dir2map/

# 在离线环境中解压到 abm-docker 目录下
tar -xzvf dir2map-offline.tar.gz -C /path/to/abm-docker/
```

## 注意事项

- 此目录下的内容（除本 README.md 外）已被 .gitignore 忽略
- 首次启动容器时会自动创建子目录
- 删除子目录内容会导致相关模型/工具重新下载
