# 本地知识库文档解析工具计划 (KISS版本)

## 1. 目标
在现有文档处理器基础上，添加MinerU支持多种文档格式解析，其他工具标记待实现。

## 2. 现状
- 现有 `DocumentProcessor` 只支持 `.txt`, `.md`, `.json`
- TODO注释已提到需要PDF、Word支持
- 知识库系统和向量化流程已完备

## 3. 简单方案

### 3.1 MinerU集成 (优先)
- **配置**：仅需 `~/magic-pdf.json` 路径
- **功能**：多格式文档 → 文本/表格/图片
- **支持格式**：PDF、Word(.doc/.docx)、PowerPoint(.ppt/.pptx)、Excel(.xls/.xlsx)、图片(.jpg/.png)
- **集成**：扩展现有 `DocumentProcessor.extract_text()` 方法

### 3.2 其他工具 (待实现)
- OlmOCR: 独立图片OCR
- 其他专用解析器

## 4. 实现方案

### 4.1 直接扩展现有代码
```python
# 在 DocumentProcessor 中添加多格式文档支持
class DocumentProcessor:
    def __init__(self):
        # 扩展支持的文件格式
        self.supported_extensions = {
            '.txt', '.md', '.json',  # 原有格式
            '.pdf',                   # PDF文档
            '.doc', '.docx',         # Word文档
            '.ppt', '.pptx',         # PowerPoint文档
            '.xls', '.xlsx',         # Excel表格
            '.jpg', '.jpeg', '.png'  # 图片文件
        }
        self.mineru_config_path = "~/magic-pdf.json"  # 唯一配置

    def extract_text(self, file_path: str):
        ext = os.path.splitext(file_path)[1].lower()

        if ext in {'.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'}:
            return self._extract_file_with_mineru(file_path)  # 统一方法
        # 其他格式保持不变...
```

### 4.2 MinerU集成
```python
def _extract_file_with_mineru(self, file_path: str):
    """使用MinerU解析多种文档格式"""
    try:
        # 检查配置文件
        config_path = os.path.expanduser(self.mineru_config_path)
        if not os.path.exists(config_path):
            return False, "MinerU配置文件不存在", {}

        # 获取文件类型
        ext = os.path.splitext(file_path)[1].lower()
        file_type_map = {
            '.pdf': 'pdf',
            '.doc': 'word', '.docx': 'word',
            '.ppt': 'powerpoint', '.pptx': 'powerpoint',
            '.xls': 'excel', '.xlsx': 'excel',
            '.jpg': 'image', '.jpeg': 'image', '.png': 'image'
        }

        # 调用MinerU Dataset API (根据官方文档)
        from mineru import Dataset
        dataset = Dataset(file_path)
        # 注意：Excel等表格格式将解析为结构化数据（如表格、单元格、工作表元数据）
        result = dataset.process()

        return True, result['content'], {
            'file_type': file_type_map.get(ext, 'unknown'),
            'parser': 'mineru',
            'char_count': len(result['content']),
            'tables_count': len(result.get('tables', [])),
            'images_count': len(result.get('images', []))
        }
    except Exception as e:
        return False, f"文档解析失败: {str(e)}", {}
```

### 4.3 配置管理 (简化)
- 系统设置表添加一个字段：`document_parsers` (JSON类型)
- 存储解析器列表配置，包含MinerU、OLMOCR、MarkItDown等
- 前端提供解析器管理界面，每个解析器可单独启用/禁用和配置

## 5. 实现步骤 (KISS)

### 5.1 第一步：添加文档解析器依赖
```bash
# 在 requirements.txt 添加（可选，也可以使用外部可执行文件）
mineru[core]>=2.0.0  # MinerU
# 其他解析器根据需要添加
```

### 5.2 第二步：扩展DocumentProcessor
- 修改 `backend/app/services/document_processor.py`
- 添加 `_extract_file_with_mineru()` 方法
- 更新 `supported_extensions` 包含多种格式：`.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.jpg`, `.jpeg`, `.png`

### 5.3 第三步：添加配置
- 在系统设置中添加 `document_parsers` 字段（JSON类型）
- 前端添加解析器管理界面

### 5.4 第四步：其他工具占位
- 在代码中添加注释标记其他工具为"待实现"
- 为未来扩展预留接口

## 6. 文件结构

### 6.1 需要修改的文件
```
backend/
├── requirements.txt                    # 添加 mineru[core]
├── app/services/document_processor.py  # 扩展多格式文档支持
├── app/models.py                      # 添加配置字段(可选)
└── config.py                          # 添加默认配置(可选)

frontend/
└── src/components/KnowledgeBase/      # 添加配置界面(可选)
```

### 6.2 核心代码示例
```python
# 在 DocumentProcessor 中添加
def _extract_file_with_mineru(self, file_path: str):
    """使用MinerU解析多种文档格式 - 保持简单"""
    try:
        # 检查依赖
        try:
            from mineru import Dataset
        except ImportError:
            return False, "MinerU未安装", {}

        # 检查配置文件
        config_path = os.path.expanduser("~/magic-pdf.json")
        if not os.path.exists(config_path):
            return False, "配置文件不存在: ~/magic-pdf.json", {}

        # 获取文件类型
        ext = os.path.splitext(file_path)[1].lower()
        file_type_map = {
            '.pdf': 'pdf',
            '.doc': 'word', '.docx': 'word',
            '.ppt': 'powerpoint', '.pptx': 'powerpoint',
            '.jpg': 'image', '.jpeg': 'image', '.png': 'image'
        }

        # 使用MinerU Dataset API解析文档
        dataset = Dataset(file_path)
        result = dataset.process()
        content = result.get('content', '')

        return True, content, {
            'file_type': file_type_map.get(ext, 'unknown'),
            'parser': 'mineru',
            'char_count': len(content),
            'tables_count': len(result.get('tables', [])),
            'images_count': len(result.get('images', []))
        }

    except Exception as e:
        logger.error(f"MinerU解析失败: {e}")
        return False, f"文档解析失败: {str(e)}", {}
```

## 7. API接口设计

### 7.1 解析器管理接口

#### 7.1.1 获取可用解析器
```
GET /api/document-parsers
Response: {
    "parsers": [
        {
            "name": "mineru",
            "display_name": "MinerU",
            "description": "基于AI的多格式文档解析工具",
            "status": "enabled",
            "supported_formats": [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png"],
            "config_schema": {...}
        },
        {
            "name": "olmocr",
            "display_name": "OlmOCR",
            "description": "开源OCR文字识别工具",
            "status": "pending",
            "supported_formats": [".png", ".jpg", ".jpeg"],
            "config_schema": {...}
        }
    ]
}
```

#### 7.1.2 配置解析器
```
POST /api/document-parsers/{parser_name}/config
Request: {
    "config": {
        "magic_pdf_config_path": "~/magic-pdf.json",
        "extract_images": true,
        "extract_tables": true
    }
}
```

### 7.2 文档解析接口

#### 7.2.1 解析单个文档
```
POST /api/documents/parse
Request: {
    "file_path": "/path/to/document.pdf",  // 支持 PDF, Word, PPT, Excel, 图片等
    "parser_name": "mineru",
    "config": {...}
}
Response: {
    "success": true,
    "content": "解析后的文本内容",
    "metadata": {
        "file_type": "pdf|word|powerpoint|image",
        "parser": "mineru",
        "char_count": 1234,
        "tables_count": 5,
        "images_count": 3
    },
    "images": [...],
    "tables": [...],
    "processing_time": 2.5
}
```

#### 7.2.2 批量解析
```
POST /api/documents/batch-parse
Request: {
    "files": [
        {"path": "/path/to/doc1.pdf", "parser": "mineru"},
        {"path": "/path/to/doc2.docx", "parser": "mineru"},
        {"path": "/path/to/presentation.pptx", "parser": "mineru"},
        {"path": "/path/to/spreadsheet.xlsx", "parser": "mineru"},
        {"path": "/path/to/image.jpg", "parser": "mineru"}
    ],
    "config": {...}
}
```

## 8. 前端界面设计

### 8.1 解析器配置界面

#### 8.1.1 解析器列表
- 显示所有可用解析器
- 状态标识（已实现/待实现）
- 支持格式显示
- 配置按钮

#### 8.1.2 MinerU配置面板
```jsx
const MinerUConfig = () => {
  return (
    <Form layout="vertical">
      <Form.Item label="配置文件路径" name="config_path">
        <Input placeholder="~/magic-pdf.json" />
      </Form.Item>
      
      <Form.Item label="输出格式" name="output_format">
        <Select>
          <Option value="markdown">Markdown</Option>
          <Option value="text">纯文本</Option>
        </Select>
      </Form.Item>
      
      <Form.Item name="extract_images" valuePropName="checked">
        <Checkbox>提取图片</Checkbox>
      </Form.Item>
      
      <Form.Item name="extract_tables" valuePropName="checked">
        <Checkbox>提取表格</Checkbox>
      </Form.Item>
    </Form>
  );
};
```

### 8.2 知识库解析配置

#### 8.2.1 解析器选择
- 为每个知识库配置默认解析器
- 支持多解析器组合
- 优先级设置

#### 8.2.2 解析进度显示
- 实时解析进度
- 解析结果预览
- 错误信息显示

## 9. 测试计划

### 9.1 单元测试
- [ ] 解析器适配器测试
- [ ] 配置管理测试
- [ ] 结果处理测试
- [ ] 错误处理测试

### 9.2 集成测试
- [ ] 知识库集成测试
- [ ] API接口测试
- [ ] 前端界面测试
- [ ] 性能测试

### 9.3 文档测试
- [ ] PDF文档解析测试
- [ ] Word文档(.doc/.docx)解析测试
- [ ] PowerPoint文档(.ppt/.pptx)解析测试
- [ ] Excel表格(.xls/.xlsx)解析测试
- [ ] 图片文件(.jpg/.png)OCR测试
- [ ] 多格式文档混合测试
- [ ] 大文件处理测试
- [ ] 并发解析测试

## 10. 部署和运维

### 10.1 依赖管理
- 更新requirements.txt
- Docker镜像构建
- 环境变量配置
- 配置文件管理

### 10.2 监控和日志
- 解析性能监控
- 错误率统计
- 资源使用监控
- 解析质量评估

## 11. 风险评估

### 11.1 技术风险
- **MinerU依赖**：可能存在版本兼容性问题
- **GPU要求**：某些功能可能需要GPU支持
- **内存占用**：大文件解析可能消耗大量内存

### 11.2 实施风险
- **配置复杂性**：MinerU配置可能较为复杂
- **格式兼容性**：不同文档格式的兼容性问题
- **性能影响**：多格式解析过程可能影响系统性能
- **资源消耗**：处理大型文档和图片可能消耗更多资源

### 11.3 缓解措施
- 提供详细的安装和配置文档
- 实现优雅的错误处理和降级机制
- 添加资源使用限制和监控
- 提供多种解析工具选择

## 12. 后续扩展

### 12.1 短期扩展
- 实现OlmOCR集成（独立图片OCR）
- 添加Excel文档支持
- 优化多格式解析性能
- 增强错误处理和格式检测

### 12.2 长期规划
- AI驱动的文档理解
- 多模态内容处理
- 实时文档更新检测
- 云端解析服务集成

## 13. 总结

本计划旨在为ABM-LLM系统构建一个强大而灵活的文档解析系统，以MinerU为核心，支持多种文档格式的智能解析。通过模块化设计和插件化架构，系统可以轻松扩展支持更多解析工具，为知识库系统提供强大的文档处理能力。

关键特点：
- **优先实现MinerU**：支持PDF、Word、PowerPoint、图片等多种格式
- **统一解析接口**：一个工具处理多种文档类型
- **可扩展架构**：支持更多解析工具集成
- **统一接口**：简化使用和维护
- **本地处理**：保证数据安全和隐私
- **渐进式实现**：先实现核心功能，再逐步扩展
