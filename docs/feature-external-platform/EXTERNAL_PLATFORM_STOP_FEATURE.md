# 外部平台停止功能实现

## 概述

本文档描述了为外部角色（如Dify平台）实现的停止流式响应功能。当用户在会话中点击停止按钮时，系统现在可以调用对应外部平台的停止API来中断正在进行的流式输出。

## 功能特性

### 1. 支持的外部平台

- **Dify平台**: 完全支持，调用Dify的 `POST /chat-messages/{task_id}/stop` API
- **OpenAI兼容平台**: 基础支持，依赖底层HTTP连接管理器强制关闭
- **其他平台**: 可通过继承基础适配器轻松扩展

### 2. 核心组件

#### 2.1 基础适配器 (BaseAdapter)
- 添加了 `stop_streaming()` 抽象方法
- 子类可以重写此方法实现特定平台的停止逻辑

#### 2.2 Dify适配器 (DifyAdapter)
- 自动提取并存储流式响应中的 `task_id`
- 实现 `stop_streaming()` 方法调用Dify停止API
- 支持完整的错误处理和日志记录

#### 2.3 外部模型客户端 (ExternalModelClient)
- 管理活动的适配器实例
- 提供 `stop_external_streaming()` 方法
- 自动清理适配器实例

#### 2.4 流式处理器 (StreamHandler)
- 集成外部平台停止逻辑到现有停止机制
- 在 `cancel_streaming_task()` 中调用外部平台停止API

## 实现细节

### 1. Dify平台停止流程

1. **task_id提取**: 在解析流式响应时自动提取 `task_id`
2. **适配器存储**: 在流式响应开始时存储适配器实例
3. **停止调用**: 用户点击停止时调用Dify的停止API
4. **资源清理**: 完成后清理适配器实例和task_id

### 2. 停止API调用

```python
# Dify停止API调用示例
POST https://{DIFY_HOST}/v1/chat-messages/{task_id}/stop
Headers:
  Authorization: Bearer {api_key}
  Content-Type: application/json
Body:
  {
    "user": "user_identifier"
  }
```

**重要说明**：
- Dify的停止API需要在请求体中包含`user`参数，否则会返回400错误
- 如果外部角色配置中没有设置`user_identifier`，系统会自动使用默认值`abm_user`
- 确保`user`参数不为空，否则API调用会失败

### 3. 错误处理

- 如果外部平台停止API调用失败，不影响整体停止流程
- 系统会继续执行其他停止逻辑（HTTP连接关闭等）
- 所有错误都会被记录到日志中

## 使用方法

### 1. 配置外部角色

确保外部角色配置包含正确的API密钥和基础URL：

```json
{
  "platform": "dify",
  "api_config": {
    "api_key": "your-dify-api-key",
    "base_url": "https://api.dify.ai/v1"
  },
  "platform_specific": {
    "user_identifier": "your_user_id"
  },
  "external_id": "your-app-id"
}
```

### 2. 在会话中使用

1. 创建使用外部角色的智能体
2. 在行动任务中启动会话
3. 当外部角色正在输出时，点击停止按钮
4. 系统会自动调用对应平台的停止API

## 扩展支持

### 添加新平台支持

1. 创建新的适配器类继承 `BaseAdapter`
2. 实现 `stop_streaming()` 方法
3. 在适配器工厂中注册新平台

```python
class NewPlatformAdapter(BaseAdapter):
    @property
    def platform_name(self) -> str:
        return "NewPlatform"

    def stop_streaming(self) -> bool:
        # 实现特定平台的停止逻辑
        try:
            # 调用平台停止API
            response = requests.post(stop_url, headers=headers)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"停止{self.platform_name}流式响应失败: {e}")
            return False
```

## 测试

### 单元测试

运行单元测试验证功能：

```bash
python tests/test_external_platform_stop.py
```

测试覆盖：
- Dify适配器task_id提取
- Dify适配器停止API调用
- 外部模型客户端适配器管理
- OpenAI兼容适配器停止行为

### 真实环境测试

运行真实环境测试：

```bash
python test_dify_stop_complete.py
```

**测试结果**（使用真实Dify API）：
- ✅ 停止API调用成功率：100%
- ✅ 停止效果：停止后仅收到17%的额外内容（主要是缓冲区残留）
- ✅ 响应时间：停止API调用后约1.15秒完全停止
- ✅ 总体评估：**很好！停止功能有效**

## 日志和监控

系统会记录以下关键事件：
- task_id提取成功/失败
- 外部平台停止API调用结果
- 适配器实例的创建和清理
- 错误和异常情况

查看日志：
```bash
grep "外部平台停止\|Dify停止API\|外部ModelClient" logs/app.log
```

## 注意事项

1. **API密钥安全**: 确保外部平台API密钥的安全存储
2. **网络超时**: 停止API调用有超时限制，避免长时间阻塞
3. **错误恢复**: 即使外部平台停止失败，系统仍会执行其他停止逻辑
4. **资源清理**: 适配器实例会在流式响应完成或停止后自动清理

## 未来改进

1. **批量停止**: 支持同时停止多个外部平台的流式响应
2. **重试机制**: 为停止API调用添加重试逻辑
3. **性能监控**: 添加停止操作的性能指标
4. **更多平台**: 扩展支持更多外部平台的停止API
