# 文档转换使用指南

## 快速开始

### 1. 配置解析器

进入"设置" > "通用设置" > "文档解析器配置"：

1. 选择解析器：**MinerU**（推荐）
2. 填写可执行文件路径：
   ```bash
   # 查找路径
   which magic-pdf  # macOS/Linux
   where magic-pdf  # Windows
   ```
3. 选择后端类型：**本地**
4. 设置超时时间：**300** 秒（大文件建议 600 秒）
5. 点击"保存"

### 2. 转换文档

1. 进入"知识库管理" > 选择知识库
2. 在文档列表中找到要转换的文件
3. 点击"转换"按钮（🔄 图标）
4. 等待转换完成（状态变为"已转换"）
5. 点击"查看 Markdown"按钮查看结果

## 状态说明

### 转换状态
- **未转换**（灰色）- 文档尚未转换
- **转换中**（蓝色）- 正在转换，请等待
- **已转换**（绿色）- 转换成功，可查看 Markdown
- **转换失败**（红色）- 转换失败，查看日志排查

### 嵌入状态（未来功能）
- **未嵌入**（灰色）- 尚未向量化
- **嵌入中**（蓝色）- 正在向量化
- **已嵌入**（绿色）- 已向量化，可用于检索
- **嵌入失败**（红色）- 向量化失败

## 支持的格式

- PDF
- Word (docx)
- PowerPoint (pptx)
- Excel (xlsx)
- 图片 (jpg, png)

## 故障排查

### 转换失败

1. **检查可执行文件**
   ```bash
   ls -l /path/to/magic-pdf
   /path/to/magic-pdf --help
   ```

2. **检查权限**
   ```bash
   chmod +x /path/to/magic-pdf
   ```

3. **查看日志**
   - 后端日志：`backend/logs/app.log`
   - 系统日志：设置 > 系统日志

### 转换超时

增加超时时间：设置 > 文档解析器配置 > 超时时间（建议 600 秒）

### 结果为空

1. 检查 MinerU 配置文件（`magic-pdf.json`）
2. 验证环境变量
3. 手动运行 MinerU 测试：
   ```bash
   magic-pdf -p input.pdf -o output/
   ```

## API 使用

```bash
# 创建转换任务
curl -X POST "http://localhost:8080/api/knowledges/{kb_id}/files/convert?file_path=doc.pdf"

# 查询状态
curl -X GET "http://localhost:8080/api/knowledges/{kb_id}/files/conversion-status?file_path=doc.pdf"

# 获取 Markdown
curl -X GET "http://localhost:8080/api/knowledges/{kb_id}/files/markdown?file_path=doc.pdf"
```

## 目录结构

```
knowledgebase/
├── {KB-UUID}/files/              # 原始文件
│   └── document.pdf
└── {KB-UUID}-markdown/           # 转换结果
    └── document.pdf/
        └── document.pdf/auto/
            ├── document.pdf.md   # Markdown 文件
            └── images/           # 提取的图片
```

## 更多信息

- [配置说明](./DOCUMENT_PARSER_CONFIG.md) - 详细的配置结构说明
- [更新日志](../CHANGELOG.md) - 功能更新记录
- [MinerU 官方文档](https://github.com/opendatalab/MinerU)

