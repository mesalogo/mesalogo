# 文档解析器配置说明

## 概述

文档解析器配置采用**扁平化结构**，使配置更清晰、易于管理。

## 配置结构

### 前端表单字段

```javascript
{
  // 当前启用的解析器工具
  document_parser_tool: "mineru",  // 可选值: "mineru" | "olmocr" | "markitdown"
  
  // MinerU 配置
  document_parser_mineru_config: {
    backend_type: "local",  // "local" | "remote"
    executable_path: "/path/to/mineru",
    server_url: "http://127.0.0.1:30000",  // 仅在 remote 模式下使用
    timeout: 300  // 秒
  },
  
  // OlmOCR 配置
  document_parser_olmocr_config: {
    executable_path: "/path/to/olmocr",
    language: "auto",
    timeout: 60  // 秒
  },
  
  // MarkItDown 配置
  document_parser_markitdown_config: {
    executable_path: "/path/to/markitdown",
    timeout: 120  // 秒
  }
}
```

### 后端数据库字段

在 `system_settings` 表中存储：

| key | value | value_type |
|-----|-------|------------|
| `document_parser_tool` | `"mineru"` | `string` |
| `document_parser_mineru_config` | `{"executable_path": "...", "timeout": 300}` | `json` |
| `document_parser_olmocr_config` | `{"executable_path": "...", "language": "auto", "timeout": 60}` | `json` |
| `document_parser_markitdown_config` | `{"executable_path": "...", "timeout": 120}` | `json` |

### 后端 Flask Config

```python
app.config['DOCUMENT_PARSER_TOOL'] = 'mineru'
app.config['DOCUMENT_PARSER_MINERU_CONFIG'] = {...}
app.config['DOCUMENT_PARSER_OLMOCR_CONFIG'] = {...}
app.config['DOCUMENT_PARSER_MARKITDOWN_CONFIG'] = {...}
```

## 设计优势

### 1. 清晰的选择器
- `document_parser_tool` 明确表示当前启用的工具
- 一目了然，无需遍历数组查找 `enabled: true`

### 2. 独立的配置
- 每个工具的配置独立存储
- 不会互相干扰
- 易于查询和更新

### 3. 扁平化结构
- 避免嵌套数组
- 数据库查询更简单
- 前端表单绑定更直观

### 4. 预配置支持
- 即使工具未启用，配置也可以预先设置
- 切换工具时无需重新配置
- 支持快速切换和测试

## 使用示例

### MinerU 命令行调用示例

#### 本地模式
```bash
/opt/homebrew/.../mineru \
  --path /path/to/input.pdf \
  --output /path/to/output \
  --backend pipeline \
  --method auto
```

#### 远程模式
```bash
/opt/homebrew/.../mineru \
  --path /path/to/input.pdf \
  --output /path/to/output \
  --backend vlm-http-client \
  --url http://127.0.0.1:30000
```

### 前端：获取当前工具配置

```javascript
const selectedTool = Form.useWatch('document_parser_tool', form);
const currentConfig = Form.useWatch(`document_parser_${selectedTool}_config`, form);
```

### 后端：获取当前工具配置

```python
from app.utils.document_parser_config import (
    get_active_document_parser,
    get_document_parser_config,
    get_mineru_config
)

# 获取当前启用的解析器名称
parser_name = get_active_document_parser()  # 返回 "mineru"

# 获取当前启用的解析器配置
config = get_document_parser_config()  # 返回当前工具的配置

# 获取特定解析器的配置
mineru_config = get_mineru_config()  # 返回 MinerU 的完整配置（包含内部默认值）
```

### 后端：检查文件格式支持

```python
from app.utils.document_parser_config import (
    is_format_supported,
    get_supported_formats
)

# 检查是否支持某个格式
if is_format_supported('.pdf'):
    # 处理 PDF 文件
    pass

# 获取所有支持的格式
formats = get_supported_formats()  # 返回 ['.pdf', '.doc', ...]
```

## 解析器元数据

### MinerU
- **状态**: `available` (可用)
- **支持格式**: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.jpg`, `.jpeg`, `.png`
- **配置项**:
  - `backend_type`: 后端类型
    - `"local"`: 本地模式，使用本地 MinerU 可执行文件
    - `"remote"`: 远程模式，连接到远程 VLM HTTP 服务
  - `executable_path`: mineru 可执行文件路径
    - 本地模式示例: `/opt/homebrew/Caskroom/miniconda/base/envs/mineru/bin/mineru`
    - 远程模式也需要本地 mineru 命令来调用远程服务
  - `server_url`: 远程服务器 URL（仅在 `backend_type="remote"` 时使用）
    - 示例: `http://127.0.0.1:30000`
  - `timeout`: 解析超时时间（秒）
- **内部配置**（不暴露给前端，由系统根据 backend_type 自动设置）:
  - `backend`:
    - 本地模式: `"pipeline"`
    - 远程模式: `"vlm-http-client"`
  - `output_format`: `"markdown"` | `"text"` | `"json"`
  - `extract_images`: `true`
  - `extract_tables`: `true`
  - `extract_formulas`: `true`

### OlmOCR
- **状态**: `pending` (待实现)
- **支持格式**: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.tiff`
- **配置项**:
  - `executable_path`: olmocr 可执行文件路径
  - `language`: 识别语言（默认 `"auto"`）
  - `timeout`: 解析超时时间（秒）

### MarkItDown
- **状态**: `pending` (待实现)
- **支持格式**: `.docx`, `.pptx`, `.xlsx`, `.pdf`, `.html`, `.xml`
- **配置项**:
  - `executable_path`: markitdown 可执行文件路径
  - `timeout`: 解析超时时间（秒）

## API 接口

### GET /api/settings
返回所有系统设置，包括文档解析器配置：

```json
{
  "document_parser_tool": "mineru",
  "document_parser_mineru_config": {
    "executable_path": "/usr/local/bin/magic-pdf",
    "timeout": 300
  },
  "document_parser_olmocr_config": {
    "executable_path": "",
    "language": "auto",
    "timeout": 60
  },
  "document_parser_markitdown_config": {
    "executable_path": "",
    "timeout": 120
  }
}
```

### POST /api/settings
更新系统设置：

```json
{
  "document_parser_tool": "mineru",
  "document_parser_mineru_config": {
    "executable_path": "/usr/local/bin/magic-pdf",
    "timeout": 300
  }
}
```

## 前端 UI 组件

### 解析器选择器
- 下拉菜单显示所有可用的解析器
- 显示解析器状态标签（可用/待实现）
- 选择后自动切换配置面板

### 配置面板
- 根据选择的解析器动态显示配置项
- 待实现的解析器配置项会被禁用但仍然可见
- 显示支持的文件格式列表

### 表单验证
- 可执行文件路径为必填项（当解析器可用时）
- 超时时间必须为正整数
- 语言代码格式验证（OlmOCR）

## 迁移指南

### 从旧配置迁移

如果你的数据库中有旧的 `document_parsers` 数组配置：

```json
{
  "document_parsers": [
    {
      "name": "mineru",
      "enabled": true,
      "config": {"executable_path": "...", "timeout": 300}
    }
  ]
}
```

需要迁移为新的扁平化结构：

```json
{
  "document_parser_tool": "mineru",
  "document_parser_mineru_config": {"executable_path": "...", "timeout": 300}
}
```

迁移脚本示例：

```python
# 待实现：backend/migrations/migrate_document_parser_config.py
```

## 注意事项

1. **向后兼容**: 旧的 `document_parsers` 配置已被废弃，请尽快迁移
2. **默认值**: 如果未配置，系统默认使用 MinerU 解析器
3. **状态检查**: 使用前请检查解析器状态，避免调用未实现的解析器
4. **路径验证**: 可执行文件路径应该是绝对路径，系统会在使用前验证文件是否存在
5. **超时设置**: 根据文档大小和复杂度合理设置超时时间

## 相关文件

- 前端组件: `frontend/src/pages/settings/GeneralSettingsPage.js`
- 后端配置: `backend/app/api/routes/settings.py`
- 工具函数: `backend/app/utils/document_parser_config.py`
- 文档处理: `backend/app/services/document_processor.py`

