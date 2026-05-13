# LightRAG 知识库集成 - 数据库迁移说明

## 迁移文件

- **升级脚本**: `20260126_add_lightrag_fields.sql`
- **回滚脚本**: `20260126_rollback_lightrag_fields.sql`

## 执行迁移

### 方式 1：手动执行 SQL（推荐）

```bash
# 1. 备份数据库
cd /Volumes/NVME_1T_ORI/my_git/abm-llm-v2/backend
cp data/app.db data/app.db.backup_$(date +%Y%m%d_%H%M%S)

# 2. 执行迁移
sqlite3 data/app.db < migrations/20260126_add_lightrag_fields.sql

# 3. 验证迁移
sqlite3 data/app.db "PRAGMA table_info(knowledges);"
sqlite3 data/app.db "PRAGMA table_info(knowledge_documents);"
```

### 方式 2：使用 Python 脚本

```python
# 在 backend 目录下执行
python3 << 'EOF'
import sqlite3
import os

db_path = 'data/app.db'
migration_file = 'migrations/20260126_add_lightrag_fields.sql'

# 读取迁移脚本
with open(migration_file, 'r') as f:
    sql_script = f.read()

# 执行迁移
conn = sqlite3.connect(db_path)
try:
    conn.executescript(sql_script)
    conn.commit()
    print("✓ 迁移成功")
except Exception as e:
    conn.rollback()
    print(f"✗ 迁移失败: {e}")
finally:
    conn.close()
EOF
```

## 回滚迁移

如果需要回滚：

```bash
sqlite3 data/app.db < migrations/20260126_rollback_lightrag_fields.sql
```

## 验证迁移结果

```bash
# 检查 knowledges 表新增字段
sqlite3 data/app.db "SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledges';"

# 检查 knowledge_documents 表新增字段
sqlite3 data/app.db "SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledge_documents';"

# 检查索引
sqlite3 data/app.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('knowledges', 'knowledge_documents');"
```

## 新增字段说明

### knowledges 表

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| kb_type | VARCHAR(20) | 'vector' | 知识库类型：vector 或 lightrag |
| lightrag_workspace | VARCHAR(100) | NULL | LightRAG workspace 标识符 |
| lightrag_config | JSON | NULL | LightRAG 特定配置 |

### knowledge_documents 表

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| lightrag_synced | BOOLEAN | FALSE | 是否已同步到 LightRAG |
| lightrag_workspace | VARCHAR(100) | NULL | LightRAG workspace |
| lightrag_sync_job_id | VARCHAR(36) | NULL | 关联的 Job ID |

## 注意事项

1. **备份数据库**：执行迁移前务必备份数据库
2. **停止服务**：建议在服务停止时执行迁移
3. **验证结果**：迁移后验证表结构和索引是否正确创建
4. **兼容性**：现有数据不受影响，新字段都有默认值
