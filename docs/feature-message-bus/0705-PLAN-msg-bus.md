# 基于消息总线的会话控制系统 PRD

## 1. 产品概述

### 1.1 背景
当前ABM-LLM系统的会话模块存在以下问题：
- **模块耦合严重**：conversation_service.py、auto_conversation.py、sequential_conversation.py之间存在循环依赖
- **功能重复**：智能体响应处理、流式处理、状态管理等逻辑在多个模块中重复
- **扩展困难**：新增会话模式需要修改多个文件，维护成本高
- **控制不灵活**：无法动态组合不同的会话处理逻辑

### 1.2 产品目标
设计并实现基于消息总线的会话控制系统，通过消息驱动的架构实现：
- **完全解耦**：各组件通过消息通信，消除直接依赖
- **灵活控制**：支持多种消息类型和发送者控制策略
- **易于扩展**：新功能只需注册新的处理器
- **向后兼容**：保持现有API接口不变

## 2. 核心概念设计

### 2.1 消息类型分层
```
MessageType:
├── REAL (真实消息)     - 用户可见，存储到数据库
├── VIRTUAL (虚拟消息)  - 用户不可见，仅用于内部处理
└── BANNER (横幅消息)   - 用户可见，不存储，显示状态信息
```

### 2.2 发送者控制层
```
SenderController:
├── SequentialController (顺序控制器)
├── AutoDiscussionController (自动讨论控制器)
├── TimeTriggerController (时间触发控制器)
└── VariableStopController (变量停止控制器)
```

### 2.3 消息总线架构
```
MessageBus:
├── MessageRouter (消息路由器)
├── HandlerRegistry (处理器注册表)
└── EventDispatcher (事件分发器)
```

## 3. 功能需求

### 3.1 核心功能

#### 3.1.1 消息类型管理
- **真实消息处理**：用户输入和智能体回复，需要存储和显示
- **虚拟消息处理**：系统内部触发消息，不显示给用户
- **横幅消息处理**：状态提示消息，显示但不存储

#### 3.1.2 发送者控制
- **顺序模式**：智能体按预定顺序发言
- **自动讨论模式**：智能体自主轮流发言，支持多轮讨论
- **时间触发模式**：按时间间隔自动触发智能体发言
- **变量停止模式**：基于条件变量控制停止

#### 3.1.3 消息路由
- **基于类型路由**：不同消息类型路由到对应处理器
- **基于模式路由**：根据会话模式选择处理策略
- **动态路由**：支持运行时修改路由规则

### 3.2 扩展功能

#### 3.2.1 配置驱动
- **模式配置**：通过配置文件定义新的会话模式
- **处理器配置**：动态注册和配置消息处理器
- **路由配置**：灵活配置消息路由规则

#### 3.2.2 监控调试
- **消息追踪**：记录消息流转路径和处理时间
- **状态监控**：实时监控各处理器状态
- **性能分析**：统计消息处理性能指标

## 4. 技术方案

### 4.1 消息结构设计
```python
class Message:
    id: str
    type: MessageType  # REAL, VIRTUAL, BANNER
    content: str
    sender_id: Optional[str]
    target_id: Optional[str]
    metadata: Dict[str, Any]
    timestamp: datetime
```

### 4.2 处理器接口
```python
class MessageHandler:
    def can_handle(self, message: Message) -> bool
    def handle(self, message: Message) -> List[Message]
    def get_priority(self) -> int
```

### 4.3 控制器接口
```python
class SenderController:
    def get_next_sender(self, context: ConversationContext) -> Optional[int]
    def create_prompt_message(self, agent_id: int, context: ConversationContext) -> Message
    def create_status_banner(self, status_info: Dict) -> Message
```

## 5. API设计

### 5.1 现有API兼容
保持现有API接口不变，在内部使用消息总线实现：
- `POST /api/action-tasks/{task_id}/conversations/{conversation_id}/messages`
- `POST /api/conversations/{conversation_id}/autonomous-tasks`

### 5.2 新增管理API
```
# 消息总线管理
GET    /api/message-bus/handlers          # 获取已注册处理器
POST   /api/message-bus/handlers          # 注册新处理器
DELETE /api/message-bus/handlers/{id}     # 注销处理器

# 会话模式管理
GET    /api/conversation-modes            # 获取可用模式
POST   /api/conversation-modes            # 创建自定义模式
PUT    /api/conversation-modes/{id}       # 更新模式配置

# 消息追踪
GET    /api/message-trace/{conversation_id}  # 获取消息流转记录
```

## 6. 数据模型

### 6.1 扩展现有模型
```sql
-- 扩展Conversation表
ALTER TABLE conversations ADD COLUMN message_bus_config JSON;

-- 新增消息追踪表
CREATE TABLE message_traces (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    message_id VARCHAR(255),
    handler_name VARCHAR(100),
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 配置存储
```json
{
  "mode": "enhanced_sequential",
  "controllers": {
    "sender": "SequentialController",
    "flow": "LinearFlowController"
  },
  "message_types": [
    {
      "type": "turn_banner",
      "template": "轮到 {agent_name} 发言",
      "display_duration": 5000
    }
  ]
}
```

## 7. 用户界面

### 7.1 现有界面保持不变
- 会话界面继续显示真实消息和横幅消息
- 自动讨论配置界面保持现有功能
- 虚拟消息对用户完全透明

### 7.2 新增管理界面
- **模式配置界面**：可视化配置会话模式
- **消息监控界面**：实时查看消息流转状态
- **性能分析界面**：展示处理器性能指标

## 8. 实施计划

### 8.1 第一阶段：基础架构（2周）
- 实现消息总线核心组件
- 创建基础消息类型和处理器
- 实现顺序模式的消息总线版本
- 确保与现有API兼容

### 8.2 第二阶段：模式迁移（2周）
- 将自动讨论模式迁移到消息总线
- 实现时间触发和变量停止模式
- 添加配置驱动功能
- 完善错误处理和监控

### 8.3 第三阶段：优化扩展（1周）
- 性能优化和压力测试
- 添加管理界面
- 完善文档和示例
- 用户验收测试

## 9. 风险评估

### 9.1 技术风险
- **性能影响**：消息总线可能增加处理延迟
  - 缓解：异步处理，性能监控
- **复杂度增加**：新架构学习成本
  - 缓解：详细文档，渐进迁移

### 9.2 业务风险
- **功能回归**：重构可能影响现有功能
  - 缓解：充分测试，灰度发布
- **用户体验**：界面变化可能影响用户
  - 缓解：保持界面不变，向后兼容

## 10. 成功指标

### 10.1 技术指标
- 模块耦合度降低90%以上
- 新增会话模式开发时间减少70%
- 系统响应时间不增加超过10%
- 代码重复率降低80%

### 10.2 业务指标
- 现有功能100%兼容
- 用户界面体验无变化
- 新功能开发效率提升50%
- 系统稳定性保持现有水平

## 11. 详细设计规范

### 11.1 消息流转示例

#### 11.1.1 顺序模式消息流
```
用户输入 → REAL消息 → SequentialController
    ↓
为每个智能体创建：
    BANNER消息("轮到智能体X发言") → BannerHandler → 前端显示
    VIRTUAL消息(提示内容) → AgentResponseHandler → 智能体响应
    REAL消息(智能体回复) → RealMessageHandler → 存储+显示
```

#### 11.1.2 自动讨论消息流
```
启动讨论 → AutoDiscussionController
    ↓
创建系统消息 → REAL消息("开始讨论") → 存储+显示
    ↓
循环处理：
    BANNER消息("第X轮讨论") → 前端显示
    VIRTUAL消息(智能体提示) → 智能体响应
    REAL消息(智能体回复) → 存储+显示
```

### 11.2 配置示例

#### 11.2.1 顺序模式配置
```yaml
sequential_mode:
  name: "顺序响应模式"
  controller: "SequentialController"
  handlers:
    - "RealMessageHandler"
    - "VirtualMessageHandler"
    - "BannerMessageHandler"
  message_templates:
    turn_banner: "轮到智能体 {agent_name}({role_name}) 发言"
    agent_prompt: "请基于上下文回复用户"
  routing_rules:
    - from: "user_input"
      to: "SequentialController"
      condition: "mode == 'sequential'"
```

#### 11.2.2 自动讨论配置
```yaml
auto_discussion_mode:
  name: "自动讨论模式"
  controller: "AutoDiscussionController"
  handlers:
    - "RealMessageHandler"
    - "VirtualMessageHandler"
    - "BannerMessageHandler"
    - "SystemMessageHandler"
  message_templates:
    start_banner: "开始自主讨论，共{rounds}轮"
    round_banner: "第{current_round}轮讨论开始"
    agent_prompt: "基于讨论主题：{topic}，继续你的发言"
    end_banner: "讨论结束，共进行{total_rounds}轮"
```

### 11.3 扩展点设计

#### 11.3.1 自定义处理器
```python
class CustomMessageHandler(MessageHandler):
    def can_handle(self, message: Message) -> bool:
        return message.type == MessageType.CUSTOM

    def handle(self, message: Message) -> List[Message]:
        # 自定义处理逻辑
        return [processed_message]

    def get_priority(self) -> int:
        return 100  # 优先级
```

#### 11.3.2 插件注册机制
```python
# 插件注册
message_bus.register_handler("custom_handler", CustomMessageHandler())
message_bus.register_controller("custom_controller", CustomController())

# 动态配置
message_bus.update_routing_rules({
    "custom_route": {
        "from": "custom_message",
        "to": "custom_handler",
        "condition": "message.metadata.get('custom_flag') == True"
    }
})
```

## 12. 测试策略

### 12.1 单元测试
- 消息总线核心组件测试
- 各类处理器功能测试
- 控制器逻辑测试
- 消息路由规则测试

### 12.2 集成测试
- 端到端消息流转测试
- 多模式切换测试
- 并发处理测试
- 错误恢复测试

### 12.3 性能测试
- 消息处理延迟测试
- 高并发场景测试
- 内存使用监控
- 长时间运行稳定性测试

## 13. 监控指标

### 13.1 业务指标
- 消息处理成功率
- 平均响应时间
- 会话完成率
- 用户满意度

### 13.2 技术指标
- 消息队列长度
- 处理器响应时间
- 内存使用率
- CPU使用率

## 14. 后续规划

### 14.1 短期扩展
- 支持更多消息类型（进度消息、错误消息等）
- 实现消息持久化和重放功能
- 添加消息过滤和转换机制

### 14.2 长期愿景
- 支持分布式消息总线
- 实现跨会话消息通信
- 构建可视化流程设计器
- 支持第三方插件扩展

---

**文档版本**: v1.0
**编写日期**: 2024-12-19
**预计实施**: 2024-12-20 - 2025-01-15
