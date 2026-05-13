# volumes 目录

此目录用于存放 Docker 容器的持久化数据卷。

## 目录结构

```
volumes/
├── backend-data/           # 后端应用数据
├── backend-logs/           # 后端日志
├── backend-workspace/      # Agent 工作空间
├── backend-knowledgebase/  # 知识库文件
├── milvus-data/            # Milvus 向量数据库数据
├── milvus-etcd/            # Milvus etcd 元数据
└── milvus-minio/           # Milvus MinIO 对象存储
```

## 离线部署

此目录可单独打包用于离线部署或数据迁移：

```bash
# 停止服务
docker compose down

# 打包 volumes 目录
tar -czvf volumes-backup.tar.gz volumes/

# 在目标环境中解压
tar -xzvf volumes-backup.tar.gz -C /path/to/abm-docker/
```

## 注意事项

- 此目录下的内容（除本 README.md 外）已被 .gitignore 忽略
- 首次启动容器时会自动创建子目录
- 删除子目录会导致数据丢失，请谨慎操作
- 建议定期备份重要数据
