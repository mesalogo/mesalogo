# Coze智能体导入计划 (KISS版本)

## 目标
让用户能够导入Coze智能体作为外部角色使用。

## 核心任务

### 1. 创建Coze适配器 (1天)
**文件**: `backend/app/services/conversation/adapters/coze_adapter.py`

**最小实现**:
```python
class CozeAdapter(BaseAdapter):
    platform_name = "Coze"

    def get_api_endpoint(self):
        return f"{self.base_url}/v1/chat"

    def get_headers(self):
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def format_request(self, messages, model, **kwargs):
        return {
            "bot_id": self.external_id,
            "user_id": self.api_config.get('user_id', 'default'),
            "query": messages[-1]['content'],
            "stream": kwargs.get('is_stream', False)
        }

    def parse_response(self, response_data):
        return response_data.get('messages', [{}])[-1].get('content', '')
```

### 2. 注册适配器 (10分钟)
在 `AdapterFactory` 中添加:
```python
'coze': CozeAdapter,
```

### 3. 前端配置表单 (半天)
在角色创建页面添加Coze选项:
- API Key 输入框
- Bot ID 输入框
- User ID 输入框

### 4. 测试 (半天)
- 创建测试角色
- 发送测试消息
- 验证响应正确

## 配置格式
```json
{
  "external_config": {
    "platform": "coze",
    "external_id": "bot_12345",
    "api_config": {
      "api_key": "your_api_key",
      "base_url": "https://api.coze.com",
      "user_id": "user_123"
    }
  }
}
```

## 总工作量: 2天

## 后续可选优化
- 流式响应支持
- 对话历史管理
- 错误处理增强
- 批量导入功能

---
*保持简单，先让基本功能工作*
