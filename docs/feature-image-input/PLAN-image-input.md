# 图像输入功能实现计划

## 项目概述

为ABM-LLM-v2系统添加完整的图像输入支持，实现多模态对话能力。用户可以上传图像并与支持视觉的大模型进行交互。

## 目标模型

**测试环境：**
- 服务器：http://10.7.0.22:11434 (Ollama)
- 模型：mistral-small3.2:24b
- 格式：Ollama API格式

**后续扩展支持：**
- OpenAI GPT-4 Vision
- Anthropic Claude 3/3.5 Vision
- Google Gemini Vision
- GPUStack 视觉模型

## 技术架构

### 1. 消息格式设计

#### 统一内部格式
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "请描述这张图片"
    },
    {
      "type": "image",
      "source": {
        "type": "base64",
        "media_type": "image/jpeg",
        "data": "iVBORw0KGgoAAAANSUhEUgAA..."
      }
    }
  ]
}
```

#### 供应商格式适配
- **Ollama**: 转换为 `images` 数组格式
- **OpenAI**: 转换为 `image_url` 格式
- **Anthropic**: 保持内部格式
- **Google**: 转换为 Gemini 格式

### 2. 核心组件 (简化版)

```
backend/
├── app/services/conversation/
│   ├── vision_adapter.py           # 统一视觉适配器 (处理所有供应商)
│   └── image_processor.py          # 图像处理工具
├── app/api/routes/
│   └── image_upload.py             # 图像上传API
└── app/utils/
    └── image_utils.py              # 图像工具函数

frontend/
├── src/components/
│   ├── ImageUpload.js              # 图像上传组件
│   └── MultimodalInput.js          # 多模态输入组件 (集成预览)
└── src/utils/
    └── imageUtils.js               # 前端图像工具
```

**简化说明：**
- **统一适配器**: `vision_adapter.py` 处理所有供应商的图像格式转换
- **合并组件**: 图像预览功能集成到 `MultimodalInput.js` 中
- **减少文件**: 移除独立的消息格式转换器，集成到适配器中

## 实施计划

### 阶段一：基础架构 (第1-2周)

#### 1.1 统一视觉适配器
**文件：** `backend/app/services/conversation/vision_adapter.py`

**功能：**
- 检测消息中的图像内容
- 根据供应商转换消息格式
- 集成到现有的ModelClient中

**接口：**
```python
class VisionAdapter:
    def has_images(self, messages: List[dict]) -> bool
    def format_for_provider(self, messages: List[dict], provider: str) -> List[dict]
    def extract_images_from_content(self, content: Any) -> List[str]
```

#### 1.2 图像处理工具
**文件：** `backend/app/services/conversation/image_processor.py`

**功能：**
- Base64编码/解码
- 图像格式验证
- 图像大小限制

**接口：**
```python
class ImageProcessor:
    def validate_image(self, file_data: bytes) -> bool
    def encode_to_base64(self, file_data: bytes) -> str
    def get_image_info(self, file_data: bytes) -> dict
```

#### 1.3 图像上传API
**文件：** `backend/app/api/routes/image_upload.py`

**端点：**
- `POST /api/images/upload` - 上传图像文件
- `POST /api/images/validate` - 验证图像格式
- `GET /api/images/info` - 获取图像信息

### 阶段二：视觉适配器实现 (第3周)

#### 2.1 VisionAdapter实现
**文件：** `backend/app/services/conversation/vision_adapter.py`

**核心逻辑：**
```python
class VisionAdapter:
    def format_for_provider(self, messages: List[dict], provider: str) -> List[dict]:
        """根据供应商转换消息格式"""
        if provider == 'ollama':
            return self._format_for_ollama(messages)
        elif provider == 'openai':
            return self._format_for_openai(messages)
        elif provider == 'anthropic':
            return self._format_for_anthropic(messages)
        # ... 其他供应商

    def _format_for_ollama(self, messages):
        """转换为Ollama格式: images数组"""
        # 实现Ollama特定的格式转换

    def _format_for_openai(self, messages):
        """转换为OpenAI格式: image_url"""
        # 实现OpenAI特定的格式转换
```

#### 2.2 ModelClient集成
**文件：** `backend/app/services/conversation/model_client.py`

**修改点：**
- 在send_request方法中集成VisionAdapter
- 检测图像内容并转换格式
- 保持现有代码结构不变

### 阶段三：前端图像上传 (第4周)

#### 3.1 图像上传组件
**文件：** `frontend/src/components/ImageUpload.js`

**功能：**
- 拖拽上传支持
- 文件格式验证
- 上传进度显示
- 错误处理

#### 3.2 多模态输入组件 (集成预览)
**文件：** `frontend/src/components/MultimodalInput.js`

**功能：**
- 集成文本和图像输入
- 图像预览和删除
- 消息组合和发送
- 拖拽上传支持

### 阶段四：测试和优化 (第5周)

#### 4.1 单元测试
- 图像处理函数测试
- 消息格式转换测试
- API端点测试

#### 4.2 集成测试
- 端到端图像上传流程
- 与 Ollama 服务器集成测试
- 多种图像格式测试

#### 4.3 性能优化
- 图像压缩优化
- 上传速度优化
- 内存使用优化

### 阶段五：扩展支持 (第6-7周)

#### 5.1 扩展VisionAdapter
**文件：** `backend/app/services/conversation/vision_adapter.py`

**新增方法：**
- `_format_for_openai()` - OpenAI格式转换
- `_format_for_anthropic()` - Anthropic格式转换
- `_format_for_gpustack()` - GPUStack格式转换

**优势：**
- 所有格式转换逻辑集中在一个文件
- 易于维护和测试
- 减少代码重复

## 技术规范

### 1. 支持的图像格式
- **JPEG** (.jpg, .jpeg) - 主要格式
- **PNG** (.png) - 支持透明度
- **WebP** (.webp) - 现代格式
- **GIF** (.gif) - 静态图像

### 2. 图像限制
- **文件大小：** 最大 10MB
- **尺寸：** 最大 4096x4096 像素
- **Base64编码：** 自动处理

### 3. 安全考虑
- 文件类型验证
- 恶意文件检测
- 上传速率限制
- 存储空间管理

### 4. 错误处理
- 图像格式不支持
- 文件过大
- 网络传输错误
- 模型处理错误

## 配置管理

### 1. 环境变量
```bash
# 图像处理配置
IMAGE_MAX_SIZE=10485760          # 10MB
IMAGE_MAX_DIMENSION=4096         # 4K分辨率
IMAGE_QUALITY=85                 # JPEG质量
IMAGE_STORAGE_PATH=/tmp/images   # 临时存储路径

# Ollama配置
OLLAMA_BASE_URL=http://10.7.0.22:11434
OLLAMA_VISION_MODEL=mistral-small3.2:24b
```

### 2. 模型配置
```json
{
  "name": "Mistral Small Vision",
  "provider": "ollama",
  "model_id": "mistral-small3.2:24b",
  "base_url": "http://10.7.0.22:11434",
  "modalities": ["text_input", "text_output", "image_input"],
  "capabilities": ["vision", "reasoning"],
  "additional_params": {
    "max_image_size": "10MB",
    "supported_formats": ["jpeg", "png", "webp"]
  }
}
```

## 测试计划

### 1. 功能测试
- [ ] 图像上传功能
- [ ] 格式转换正确性
- [ ] Ollama API调用
- [ ] 错误处理机制

### 2. 性能测试
- [ ] 大图像处理速度
- [ ] 并发上传处理
- [ ] 内存使用情况
- [ ] 网络传输效率

### 3. 兼容性测试
- [ ] 不同浏览器支持
- [ ] 移动设备适配
- [ ] 各种图像格式
- [ ] 网络环境适应

## 部署计划

### 1. 开发环境
- 本地 Ollama 服务器设置
- 测试图像素材准备
- 开发工具配置

### 2. 测试环境
- 集成测试环境部署
- 自动化测试配置
- 性能监控设置

### 3. 生产环境
- 渐进式发布
- 功能开关控制
- 监控和日志

## 风险评估

### 1. 技术风险
- **图像处理性能：** 大图像可能影响响应速度
- **内存使用：** Base64编码增加内存消耗
- **网络传输：** 图像数据增加带宽需求

### 2. 兼容性风险
- **模型支持：** 不同模型的图像处理能力差异
- **API变更：** 供应商API格式可能变化
- **浏览器兼容：** 旧版浏览器可能不支持某些功能

### 3. 安全风险
- **恶意文件：** 需要严格的文件验证
- **存储安全：** 临时文件的安全清理
- **隐私保护：** 图像数据的处理和存储

## 成功指标

### 1. 功能指标
- [ ] 支持主流图像格式 (JPEG, PNG, WebP)
- [ ] 图像上传成功率 > 99%
- [ ] 与 Ollama 模型集成成功
- [ ] 错误处理覆盖率 > 95%

### 2. 性能指标
- [ ] 图像上传响应时间 < 3秒
- [ ] 图像处理时间 < 5秒
- [ ] 内存使用增长 < 50%
- [ ] 并发处理能力 > 10个用户

### 3. 用户体验指标
- [ ] 界面响应流畅
- [ ] 错误提示清晰
- [ ] 操作流程简单
- [ ] 多设备兼容

## 后续扩展

### 1. 高级功能
- 图像编辑和标注
- 批量图像处理
- 图像历史记录
- 图像搜索功能

### 2. 性能优化
- 图像缓存机制
- CDN集成
- 压缩算法优化
- 异步处理队列

### 3. 更多模态
- 音频输入支持
- 视频输入支持
- 文档解析支持
- 3D模型支持

## 实现优先级

### P0 (必须实现)
1. 基础图像上传功能
2. Ollama适配器实现
3. 前端图像预览组件
4. 基本错误处理

### P1 (重要功能)
1. 图像格式转换优化
2. 性能监控和日志
3. 完整的单元测试
4. 用户体验优化

### P2 (增强功能)
1. 其他供应商适配器
2. 高级图像处理
3. 批量上传功能
4. 图像历史管理

## 开发规范

### 1. 代码规范
- 遵循项目现有代码风格
- 添加完整的类型注解
- 编写详细的文档字符串
- 实现全面的错误处理

### 2. 测试规范
- 单元测试覆盖率 > 90%
- 集成测试覆盖主要流程
- 性能测试验证关键指标
- 安全测试防范常见漏洞

### 3. 文档规范
- API文档自动生成
- 用户使用指南
- 开发者文档
- 故障排除指南

---

**项目负责人：** 开发团队
**预计完成时间：** 7周
**优先级：** 高
**状态：** 计划中

**下一步行动：**
1. 确认 Ollama 服务器连接和模型可用性
2. 创建开发分支 `feature/image-input`
3. 开始实施阶段一的基础架构
