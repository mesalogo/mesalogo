# FastGPT 外部智能体集成计划 (简化版)

## 核心原则: KISS + 奥卡姆剃刀

**最简实现**: FastGPT使用OpenAI兼容格式，实现应该比Dify更简单，不是更复杂。

## 关键洞察

**FastGPT = OpenAI格式 + 少量定制参数**
- 端点: `/api/v1/chat/completions`
- 格式: 标准OpenAI messages数组
- 认证: Bearer Token
- 额外参数: `chatId`(可选), `variables`(可选)

**最小化修改原则**: 复用现有代码，只添加必要的差异化处理。

## 简化实现方案

### 核心实现 (总计3小时)

#### 步骤1: 创建FastGPT适配器 (1.5小时)
**文件**: `backend/app/services/conversation/adapters/fastgpt_adapter.py`

**关键简化**: FastGPT使用OpenAI格式，大部分逻辑可以复用

```python
class FastGPTAdapter(BaseAdapter):
    @property
    def platform_name(self) -> str:
        return "FastGPT"

    def get_api_endpoint(self) -> str:
        # FastGPT使用标准的/api/v1/chat/completions端点
        # AppID通过Authorization header中的API Key来关联，不在URL中
        return f"{self.base_url.rstrip('/')}/api/v1/chat/completions"

    def format_request(self, messages, model, agent_info=None, is_stream=False, **kwargs):
        # 最简实现：直接使用OpenAI格式
        request_data = {
            "messages": messages,  # 无需转换！
            "stream": is_stream
        }

        # FastGPT可选参数
        if self.platform_specific.get('chat_id'):
            request_data["chatId"] = self.platform_specific['chat_id']

        # 注意：AppID通过API Key关联，每个应用有独立的API Key
        # external_id存储AppID用于标识，但不直接用于API调用

        return request_data

    def parse_response(self, response_data):
        # 标准OpenAI格式，直接提取
        return response_data["choices"][0]["message"]["content"]

    def parse_streaming_chunk(self, chunk):
        # 标准OpenAI流式格式，复用现有逻辑
        # (可以参考其他OpenAI兼容适配器的实现)
```

#### 步骤2: 注册适配器 (15分钟)
**文件**: `backend/app/services/conversation/adapters/adapter_factory.py`

```python
# 只需添加一行
'fastgpt': FastGPTAdapter,
```

#### 步骤3: 前端最小修改 (1小时)
**文件**: `frontend/src/pages/roles/RoleManagement.js`

```javascript
// 1. 添加平台选项 (2分钟)
<Option value="fastgpt">FastGPT</Option>

// 2. 添加配置表单 (30分钟) - 复用Dify的表单结构
case 'fastgpt':
  return (
    <>
      <Form.Item name="apiServer" label="API服务器地址" required>
        <Input placeholder="https://cloud.fastgpt.cn" />
      </Form.Item>
      <Form.Item name="apiKey" label="API密钥" required>
        <Input.Password placeholder="fastgpt-xxxxxx" />
      </Form.Item>
      <Form.Item name="assistantId" label="应用ID" required>
        <Input placeholder="6752884ba42075b220241c0c" />
      </Form.Item>
    </>
  );

// 3. 更新连接测试 (20分钟) - 复用现有逻辑
else if (platform === 'fastgpt') {
  fieldsToValidate.push('apiKey', 'apiServer', 'assistantId'); // AppID是必需的
}
```

#### 步骤4: 基础测试 (30分钟)
- 创建外部角色
- 测试对话功能
- 验证流式响应

## 为什么这样简化？

### 1. FastGPT ≈ OpenAI + 少量参数
- **消息格式**: 完全相同，无需转换
- **响应格式**: 完全相同，无需解析
- **流式格式**: 完全相同，可复用代码

### 2. 避免过度工程化
- **不需要**: 复杂的消息转换逻辑
- **不需要**: 自定义响应解析器
- **不需要**: 特殊的错误处理
- **只需要**: 修改API端点和添加可选参数

### 3. 配置最小化
```json
{
  "platform": "fastgpt",
  "api_config": {
    "api_key": "fastgpt-xxx",
    "base_url": "https://cloud.fastgpt.cn"
  },
  "external_id": "6752884ba42075b220241c0c"
}
```

**必需参数**: API密钥 + 服务地址 + AppID，其他都是可选的。

## 风险评估

### 低风险
- FastGPT API相对简单，兼容OpenAI格式
- 现有架构已经支持适配器模式
- 有完整的测试API Key

### 中等风险
- 需要验证chatId的生成和管理逻辑
- 变量替换功能需要仔细测试
- 流式响应格式可能有细微差异

### 缓解措施
- 详细的单元测试覆盖
- 使用真实API进行集成测试
- 参考OpenAI官方文档确保兼容性

## 实际需要修改的文件

### 后端 (2个文件)
1. **新建**: `backend/app/services/conversation/adapters/fastgpt_adapter.py` (50行代码)
2. **修改**: `backend/app/services/conversation/adapters/adapter_factory.py` (1行代码)

### 前端 (1个文件)
1. **修改**: `frontend/src/pages/roles/RoleManagement.js` (25行代码)

### 测试配置说明
⚠️ **重要**: FastGPT需要使用**应用特定的API密钥**，而不是账户密钥。

**如何获取应用API密钥**:
1. 登录FastGPT控制台
2. 进入具体应用的详情页面
3. 在应用设置中找到"API密钥"部分
4. 生成或复制应用专用的API密钥

**测试配置**:
- **API Key**: `fastgpt-unC2IrOLVvDvOmkWkyDx7aL6jV4iLU5rq8DvtbROD4M3n13HAGtCnTBM2`
- **Base URL**: `https://cloud.fastgpt.cn`
- **App ID**: `6752884ba42075b220241c0c`

**总计**: 3个文件，76行代码。就这么简单！

## 简化后的时间估算

| 任务 | 时间 | 说明 |
|------|------|------|
| 后端适配器 | 1.5小时 | 复用OpenAI格式，极简实现 |
| 注册适配器 | 15分钟 | 一行代码 |
| 前端表单 | 1小时 | 复用现有组件 |
| 基础测试 | 30分钟 | 手动验证核心功能 |
| **总计** | **3小时** | 半个工作日 |

## 简化验收标准

1. ✅ 能创建FastGPT外部角色
2. ✅ 能正常发送消息并收到回复
3. ✅ 流式响应工作正常
4. ✅ 错误情况有合理提示

**就这4条！** 其他都是锦上添花。

## 立即开始实施？

基于KISS原则，我们现在就可以开始实施：
1. 先实现最小可用版本 (3小时)
2. 验证核心功能可用
3. 后续根据实际需要逐步优化

你觉得这个简化方案如何？要不要现在就开始实施？
