# IM 集成功能实现计划

## 概述
实现 IM 机器人集成，支持用户通过 IM 平台与 Agent 对话交互。

**核心思路**: IM 集成本质上是 openai_export 的另一个入口。openai_export 已经解决了
"外部请求 → 获取/创建 Conversation → 调用 ConversationService → 返回结果" 的完整链路，
IM 集成只需要在前面加一层 "IM 消息解析 + 平台回复" 即可。

**KISS 原则**: 先用 Telegram 跑通，再扩展其他平台。

### 平台优先级

| 平台 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| Telegram | **NOW** | 待开发 | Bot API 最简单，无需 SDK，纯 requests |
| 钉钉 (DingTalk) | NEXT | 待开发 | 国内企业主流 |
| 企业微信 (WeCom) | NEXT | 待开发 | 国内企业主流 |
| 飞书 (Feishu/Lark) | NEXT | 待开发 | 国内企业，API 优秀 |
| Slack | FUTURE | - | 国际企业主流 |
| Discord | FUTURE | - | 国际社区 |
| Microsoft Teams | FUTURE | - | 国际企业 |

## 架构设计

### 与 openai_export 的关系

```
openai_export (已实现):
  HTTP 请求 → 解析 model/messages → _get_or_create_conversation_for_*()
           → ConversationService.add_message_to_conversation()
           → 格式化为 OpenAI 响应

im_integration (新增，复用同一链路):
  IM Webhook → 解析平台消息 → _get_or_create_conversation_for_agent()  ← 复用 chat_service.py
            → ConversationService.add_message_to_conversation()         ← 完全相同
            → 格式化为平台消息 → 回复 IM
```

**关键**: 不需要新建 im_conversation_manager.py，直接复用 `openai_export/chat_service.py`
中的 `_get_or_create_conversation_for_role` / `_get_conversation_for_agent` 逻辑。

### 数据模型

只需一张表：`IMBotConfig`（记录 bot 配置和关联的 Agent）。
会话管理完全复用现有的 `Conversation` + `ConversationAgent` 体系。

```python
class IMBotConfig(BaseMixin, db.Model):
    __tablename__ = 'im_bot_configs'
    
    name = Column(String(128), nullable=False)
    platform = Column(String(32), nullable=False)        # telegram | dingtalk | wecom | feishu | ...
    
    # 凭证（JSON，按平台不同）
    credentials = Column(JSON, default=dict)
    # telegram: { "bot_token": "123456:ABC-..." }
    # dingtalk: { "app_key": "...", "app_secret": "...", "webhook_url": "..." }
    # wecom:    { "corp_id": "...", "corp_secret": "...", "token": "...", "aes_key": "..." }
    # feishu:   { "app_id": "...", "app_secret": "...", "verification_token": "...", "encrypt_key": "..." }
    
    # 关联的 Agent（IM 消息由这个 Agent 处理）
    agent_id = Column(String(36), ForeignKey('agents.id'))
    user_id = Column(String(36), ForeignKey('users.id'))
    
    # 配置
    config = Column(JSON, default=dict)
    # {
    #   "trigger_mode": "all",              # all | command | mention
    #   "enable_context": true,
    #   "context_timeout": 600,
    #   "max_context_messages": 10,
    # }
    
    is_active = Column(Boolean, default=True)
```

**不需要 IMConversation 表** -- 用 Conversation.title 做 session 映射（与 openai_export 相同模式）：
```python
# openai_export 的做法:
title = f"openai-export-session:{session_id}"

# im_integration 同样:
title = f"im-{platform}-{chat_id}"   # 如 "im-telegram-123456789"
```

### 服务层

```
backend/app/services/im_integration/
├── __init__.py
├── base_im_service.py          # 抽象基类（parse_message + send_reply）
└── telegram_service.py         # Telegram 实现（纯 requests）
```

不需要 message_adapter.py / im_conversation_manager.py / webhook_validator.py，
因为对话管理完全复用 openai_export 的 chat_service 链路。

### API 路由

```
backend/app/api/routes/
├── im_webhook.py               # POST /api/webhooks/telegram/:bot_id
└── im_bot_config.py            # CRUD /api/im-bots
```

## Telegram 实现（Phase 1）

### 为什么先做 Telegram
- **零 SDK 依赖**: 纯 HTTP API，只需 requests
- **零认证复杂度**: 一个 Bot Token 搞定一切
- **零公网要求**: 支持 polling 模式（开发阶段不需要公网 URL）
- **即时可测**: @BotFather 创建 bot，秒级可用

### 核心流程（复用 openai_export 链路）

```python
from app.api.routes.openai_export.chat_service import _get_conversation_for_agent, handle_chat_completion

@bp.route('/webhooks/telegram/<bot_id>', methods=['POST'])
def telegram_webhook(bot_id):
    update = request.json
    message = update.get('message', {})
    text = message.get('text', '')
    chat_id = str(message['chat']['id'])
    
    # 1. 查找 bot 配置
    bot_config = IMBotConfig.query.get(bot_id)
    if not bot_config or not bot_config.is_active:
        return jsonify({'ok': True})
    
    bot_token = bot_config.credentials.get('bot_token')
    
    # 2. 复用 openai_export 的会话管理
    #    用 chat_id 作为 session 标识，与 openai_export 用 session_id 完全一致
    conv, task, agent, err = _get_conversation_for_agent(
        bot_config.agent_id, bot_config.user_id,
        conversation_id=_find_im_conversation(chat_id)  # 按 title="im-telegram-{chat_id}" 查找
    )
    if err:
        _send_telegram_reply(bot_token, chat_id, "Error: bot not configured properly")
        return jsonify({'ok': True})
    
    # 3. 复用 ConversationService 处理消息（与 openai_export 完全相同）
    human_msg, agent_msg = ConversationService.add_message_to_conversation(
        conv.id, {
            'content': text,
            'target_agent_id': agent.id,
            'user_id': bot_config.user_id,
            'send_target': 'task',
        }
    )
    
    # 4. 回复 Telegram（唯一的平台特定逻辑）
    if agent_msg:
        _send_telegram_reply(bot_token, chat_id, agent_msg.content)
    
    return jsonify({'ok': True})


def _find_im_conversation(chat_id):
    """按 title 查找已有会话（与 openai_export 的 session 查找一致）"""
    conv = Conversation.query.filter_by(title=f"im-telegram-{chat_id}").first()
    return conv.id if conv else None


def _send_telegram_reply(bot_token, chat_id, text):
    """发送 Telegram 回复"""
    requests.post(
        f'https://api.telegram.org/bot{bot_token}/sendMessage',
        json={'chat_id': chat_id, 'text': text, 'parse_mode': 'Markdown'}
    )
```

### 设置 Webhook
```python
requests.post(
    f'https://api.telegram.org/bot{token}/setWebhook',
    json={'url': f'https://your-domain.com/api/webhooks/telegram/{bot_id}'}
)
```

## 实现步骤

### Phase 1: Telegram 跑通 (3-5天)

#### 1a: 后端 (1-2天)
- [ ] 添加 IMBotConfig 模型到 models.py
- [ ] 数据库迁移脚本
- [ ] TelegramService（parse_message + send_reply，纯 requests）
- [ ] im_webhook.py（Webhook 路由，调用 openai_export 的会话链路）
- [ ] im_bot_config.py（CRUD API）
- [ ] 在 routes/__init__.py 注册蓝图

#### 1b: 前端设置页 (1-2天)
- [ ] /settings/im-integration 页面
- [ ] Bot 列表表格（名称、平台、Agent、状态、操作）
- [ ] 创建/编辑 Bot Modal（Telegram: 只需填 Bot Token）
- [ ] 测试按钮（发送测试消息）

#### 1c: 测试验证 (1天)
- [ ] 用真实 Telegram Bot 测试完整流程
- [ ] 入站：用户发消息 → Agent 回复
- [ ] 出站：Agent 主动推送消息

### Phase 2: 国内平台 (NEXT，按需)
- [ ] 钉钉 DingTalkService（继承 BaseIMService，只需实现 parse + reply）
- [ ] 企微 WeComService
- [ ] 飞书 FeishuService

### Phase 3: 更多国际平台 (FUTURE)
- [ ] Slack
- [ ] Discord
- [ ] Microsoft Teams

## 前端设置页设计

### Bot 列表页 (/settings/im-integration)
```
┌─────────────────────────────────────────────────────────┐
│  IM Integration                          [+ Add Bot]    │
├─────────────────────────────────────────────────────────┤
│  Name        Platform    Agent       Status   Actions   │
│  ─────────── ─────────── ─────────── ──────── ───────── │
│  客服Bot     Telegram    客服助手    ●Active  ✏️🧪🗑️    │
│  通知Bot     Telegram    通知Agent   ○Off     ✏️🧪🗑️    │
└─────────────────────────────────────────────────────────┘
```

### 创建 Bot Modal
```
┌─────────────────────────────────────┐
│  Add IM Bot                         │
├─────────────────────────────────────┤
│  Name:     [________________]       │
│                                     │
│  Platform: ◉ Telegram               │
│            ○ DingTalk (coming soon) │
│            ○ WeCom (coming soon)    │
│            ○ Feishu (coming soon)   │
│                                     │
│  Bot Token: [________________]      │
│                                     │
│  Agent:    [▼ Select Agent    ]     │
│                                     │
│  Trigger:  ◉ All messages           │
│            ○ Commands only (/ask)   │
│            ○ @mention only          │
│                                     │
│  Context:  [✓] Enable               │
│  Timeout:  [600] seconds            │
│                                     │
│        [Cancel]  [Save & Test]      │
└─────────────────────────────────────┘
```

## API

```
POST   /api/im-bots              # 创建 bot
GET    /api/im-bots              # 列表
GET    /api/im-bots/:id          # 详情
PUT    /api/im-bots/:id          # 更新
DELETE /api/im-bots/:id          # 删除
POST   /api/im-bots/:id/test     # 测试（发送测试消息）
POST   /api/webhooks/telegram/:bot_id  # Telegram webhook
```

## 依赖

```
# 无新依赖！Telegram Bot API 只需 requests（已有）
# 后续平台按需添加:
# lark-oapi (飞书), slack-sdk (Slack), PyNaCl (Discord)
```

## 时间估算

| 阶段 | 内容 | 时间 |
|------|------|------|
| Phase 1 | Telegram 完整流程 | 3-5 天 |
| Phase 2 | 国内平台（按需） | 每个 2-3 天 |
| Phase 3 | 国际平台（按需） | 每个 2-3 天 |
