# Dify平台集成说明

## 概述

本系统现在支持Dify平台的外部角色集成，允许在对话中使用Dify应用作为智能体。

## 实现架构

### 核心组件

1. **适配器模式**
   - `BaseAdapter`: 外部平台适配器基类
   - `DifyAdapter`: Dify平台专用适配器
   - `AdapterFactory`: 适配器工厂，负责创建相应的适配器实例

2. **外部ModelClient**
   - `ExternalModelClient`: 专门处理外部平台角色的模型客户端
   - 使用适配器模式处理不同外部平台的API调用

3. **消息处理器增强**
   - `message_processor.py`: 增加了外部角色配置提取逻辑
   - 支持从角色的`settings.external_config`中获取外部平台配置

## 外部角色与内部角色的区别

### 配置获取方式

**内部角色：**
- 从`ModelConfig`表获取模型配置
- 使用标准的OpenAI兼容API格式

**外部角色：**
- 从角色的`settings.external_config`获取配置
- 使用平台特定的API格式（如Dify的chat-messages端点）

### API调用流程

**内部角色：**
```
用户消息 → MessageProcessor → ModelClient → OpenAI兼容API → 响应
```

**外部角色：**
```
用户消息 → MessageProcessor → ExternalModelClient → DifyAdapter → Dify API → 响应
```

### 配置结构

**外部角色配置示例：**
```json
{
  "source": "external",
  "settings": {
    "external_config": {
      "platform": "dify",
      "external_id": "dify-app-id",
      "api_config": {
        "api_key": "app-xxx",
        "base_url": "https://api.dify.ai/v1",
        "model": "dify-model"
      },
      "platform_specific": {
        "user_identifier": "abm_user",
        "timeout": 60,
        "response_mode": "blocking"
      }
    }
  }
}
```

## Dify API适配

### 请求格式转换

**标准消息格式：**
```json
{
  "messages": [
    {"role": "system", "content": "你是一个有用的助手"},
    {"role": "user", "content": "你好"},
    {"role": "assistant", "content": "你好！我是AI助手。"},
    {"role": "user", "content": "你能做什么？"}
  ]
}
```

**Dify API格式：**
```json
{
  "inputs": {},
  "query": "<!--系统提示词\n你是一个有用的助手-->\n<!--历史消息\n助手: 你好！我是AI助手。-->\n<!--以下为用户请求-->\n你能做什么？",
  "response_mode": "streaming",
  "conversation_id": "",
  "user": "abm_user"
}
```

**消息组织规则：**
1. **系统提示词**：包装在`<!--系统提示词\n...-->`注释中
2. **历史消息**：包装在`<!--历史消息\n...-->`注释中，格式为`助手: 内容`
3. **用户请求**：在`<!--以下为用户请求-->`标记后直接放置
4. **user字段**：必须提供，从`platform_specific.user_identifier`获取，默认为`abm_user`

### 响应格式处理

**Dify响应格式：**
```json
{
  "answer": "回复内容",
  "conversation_id": "会话ID",
  "message_id": "消息ID"
}
```

**流式响应格式：**
```
data: {"event": "message", "answer": "内容块", "message_id": "xxx"}
data: {"event": "message_end", "message_id": "xxx"}
```

## 使用方法

1. **创建Dify外部角色**
   - 在角色管理中选择"外部角色"
   - 选择平台类型为"Dify"
   - 配置API密钥和应用URL

2. **在行动空间中使用**
   - 将Dify外部角色添加到行动空间
   - 创建智能体时选择该外部角色
   - 在对话中正常使用

## 技术细节

### 错误处理

- 网络错误：自动重试和超时处理
- API错误：解析Dify错误响应并转换为标准格式
- 配置错误：验证必要的配置项

### 流式响应

- 支持Dify的流式响应格式
- 实时传输内容块到前端
- 正确处理流式响应的结束信号

### 日志记录

- 详细的调试日志用于问题排查
- 区分不同平台的日志前缀
- 记录API调用的详细信息

## 扩展性

当前架构支持轻松添加其他外部平台：

1. 创建新的适配器类（继承`BaseAdapter`）
2. 在`AdapterFactory`中注册新适配器
3. 实现平台特定的API格式转换逻辑

支持的平台可以包括：
- OpenAI Assistant API
- Coze
- 其他自定义API平台
