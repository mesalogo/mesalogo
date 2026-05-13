# SaaS 订阅计划功能设计

> 创建日期: 2026-01-15

## 概述

为 C 端用户引入订阅计划功能，支持资源配额限制和付费升级。采用最小改动方案，在现有用户体系上扩展。

## 设计原则

1. **最小侵入** - 不改动现有权限和资源隔离逻辑
2. **运营灵活** - 计划名称、价格、限额全部可配置
3. **渐进实施** - 分阶段上线，先配额后计费

---

## 数据模型

### 新增表

```python
class SubscriptionPlan(BaseMixin, db.Model):
    """订阅计划定义 - 运营可配置"""
    __tablename__ = 'subscription_plans'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 基本信息
    name = Column(String(50), unique=True, nullable=False)  # 内部标识: free, pro
    display_name = Column(String(100), nullable=False)      # 显示名称: 免费版, 专业版
    description = Column(Text)                              # 计划描述
    badge_color = Column(String(20), default='#666666')     # 徽章颜色
    
    # 价格
    price_monthly = Column(Numeric(10, 2), default=0)       # 月价
    price_yearly = Column(Numeric(10, 2), default=0)        # 年价
    currency = Column(String(10), default='CNY')            # 货币
    
    # 资源限额 (JSON, 灵活配置)
    limits = Column(JSON, default={})
    # 示例:
    # {
    #     "max_tasks": 10,
    #     "max_agents": 3,
    #     "max_spaces": 2,
    #     "max_knowledge_bases": 1,
    #     "max_storage_mb": 512,
    #     "max_daily_conversations": 50,
    #     "max_monthly_tokens": 100000
    # }
    
    # 功能开关 (JSON, 灵活配置)
    features = Column(JSON, default={})
    # 示例:
    # {
    #     "parallel_experiment": false,
    #     "custom_model": false,
    #     "api_access": false,
    #     "priority_support": false
    # }
    
    # 状态
    sort_order = Column(Integer, default=0)                 # 显示顺序
    is_active = Column(Boolean, default=True)               # 是否启用
    is_default = Column(Boolean, default=False)             # 新用户默认计划
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)


class UsageRecord(BaseMixin, db.Model):
    """用量统计表 - 支持多维度统计 (平台/租户/用户)"""
    __tablename__ = 'usage_records'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 统计维度
    scope = Column(String(20), nullable=False)              # platform, tenant, user
    scope_id = Column(String(36), nullable=False)           # 对应 ID (平台用 'global')
    period = Column(String(10), nullable=False)             # 2026-01 (月) 或 2026-01-15 (日)
    period_type = Column(String(10), default='monthly')     # daily, monthly
    
    # 资源类型和用量
    resource_type = Column(String(50), nullable=False)      # tasks, agents, tokens, storage...
    usage_count = Column(BigInteger, default=0)             # 用量数值
    
    # 复合唯一键
    __table_args__ = (
        UniqueConstraint('scope', 'scope_id', 'period', 'resource_type', 
                         name='uq_usage_record'),
        Index('ix_usage_scope_period', 'scope', 'scope_id', 'period'),
    )
```

**用量统计示例数据:**

| scope | scope_id | period | period_type | resource_type | usage_count |
|-------|----------|--------|-------------|---------------|-------------|
| platform | global | 2026-01 | monthly | tasks | 15000 |
| platform | global | 2026-01 | monthly | tokens | 50000000 |
| tenant | tenant-abc | 2026-01 | monthly | tasks | 500 |
| user | user-123 | 2026-01 | monthly | tasks | 45 |
| user | user-123 | 2026-01 | monthly | tokens | 450000 |
| user | user-123 | 2026-01-15 | daily | conversations | 23 |

class UserSubscription(BaseMixin, db.Model):
    """用户订阅记录 - 独立表，支持订阅历史"""
    __tablename__ = 'user_subscriptions'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    plan_id = Column(String(36), ForeignKey('subscription_plans.id'), nullable=False)
    
    # 订阅状态
    status = Column(String(20), default='active')           # active, expired, cancelled
    is_current = Column(Boolean, default=True)              # 是否为当前生效订阅
    
    # 计费周期
    billing_cycle = Column(String(20), default='monthly')   # monthly, yearly, lifetime
    
    # 时间
    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)                           # NULL = 永不过期
    cancelled_at = Column(DateTime)
    
    # 支付信息 (可选)
    order_id = Column(String(100))                          # 关联订单号
    amount_paid = Column(Numeric(10, 2))                    # 实付金额
    
    # 操作追溯
    source = Column(String(20), default='system_default')   # user_purchase, admin_assign, system_default, promotion
    created_by = Column(String(36))                         # 操作人 ID (管理员分配时记录)
    notes = Column(Text)                                    # 备注 (如"VIP客户赠送3个月")
    
    # 关联
    plan = relationship('SubscriptionPlan')
    user = relationship('User', backref='subscriptions')
    
    # 索引
    __table_args__ = (
        Index('ix_user_subscription_current', 'user_id', 'is_current'),
    )
```

### 修改现有表

```python
class User(BaseMixin, db.Model):
    # ... 现有字段保持不变 ...
    # 无需修改，通过 UserSubscription.is_current=True 获取当前订阅
```

### 新增表: Stripe 配置

```python
class StripeConfig(BaseMixin, db.Model):
    """Stripe 支付配置 - 全局单例"""
    __tablename__ = 'stripe_config'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 启用状态
    enabled = Column(Boolean, default=False)
    
    # 运行模式
    mode = Column(String(10), default='test')               # test, live
    
    # API 密钥 (加密存储)
    publishable_key = Column(String(255))                   # pk_test_* 或 pk_live_*
    secret_key_encrypted = Column(Text)                     # 加密存储
    
    # Webhook 配置
    webhook_secret_encrypted = Column(Text)                 # 加密存储
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

### 新增表: 支付记录

```python
class PaymentRecord(BaseMixin, db.Model):
    """支付记录表"""
    __tablename__ = 'payment_records'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 关联用户
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'))
    
    # 支付类型
    type = Column(String(20), nullable=False)               # subscription, upgrade, renewal, refund
    
    # 金额信息
    amount = Column(Numeric(10, 2), nullable=False)         # 金额 (退款为负数)
    currency = Column(String(10), default='CNY')
    
    # 状态
    status = Column(String(20), default='pending')          # pending, succeeded, failed, refunded
    
    # Stripe 信息
    stripe_payment_intent_id = Column(String(100))          # pi_xxx
    stripe_charge_id = Column(String(100))                  # ch_xxx
    stripe_invoice_id = Column(String(100))                 # in_xxx
    
    # 关联订阅
    subscription_id = Column(String(36), ForeignKey('user_subscriptions.id'))
    plan_id = Column(String(36), ForeignKey('subscription_plans.id'))
    
    # 元数据
    metadata = Column(JSON, default={})                     # 额外信息
    failure_reason = Column(Text)                           # 失败原因
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # 关联
    user = relationship('User')
    plan = relationship('SubscriptionPlan')
    
    # 索引
    __table_args__ = (
        Index('ix_payment_user_created', 'user_id', 'created_at'),
        Index('ix_payment_status', 'status'),
    )
```

### 数据模型总结

```
改动量:
├── 新增表: 5 张
│   ├── subscription_plans  (计划定义，运营可配置)
│   ├── user_subscriptions  (用户订阅，支持历史记录)
│   ├── usage_records       (用量统计，支持多维度)
│   ├── stripe_config       (Stripe 配置，全局单例) [新增]
│   └── payment_records     (支付记录) [新增]
└── User 表: 无改动
```

### 订阅历史示例

| user_id | plan_id | status | is_current | started_at | expires_at |
|---------|---------|--------|------------|------------|------------|
| user-123 | free | expired | false | 2025-01-01 | 2025-06-01 |
| user-123 | pro | expired | false | 2025-06-01 | 2026-01-01 |
| user-123 | team | active | **true** | 2026-01-01 | 2027-01-01 |

---

## 默认计划配置

```json
[
  {
    "name": "free",
    "display_name": "免费版",
    "description": "适合个人体验和学习",
    "badge_color": "#999999",
    "price_monthly": 0,
    "price_yearly": 0,
    "is_default": true,
    "limits": {
      "max_tasks": 10,
      "max_agents": 3,
      "max_spaces": 2,
      "max_knowledge_bases": 1,
      "max_storage_mb": 512,
      "max_daily_conversations": 50,
      "max_monthly_tokens": 100000
    },
    "features": {
      "parallel_experiment": false,
      "custom_model": false,
      "api_access": false
    }
  },
  {
    "name": "pro",
    "display_name": "专业版",
    "description": "适合个人深度使用",
    "badge_color": "#1890ff",
    "price_monthly": 49,
    "price_yearly": 490,
    "limits": {
      "max_tasks": 100,
      "max_agents": 20,
      "max_spaces": 10,
      "max_knowledge_bases": 5,
      "max_storage_mb": 5120,
      "max_daily_conversations": 500,
      "max_monthly_tokens": 1000000
    },
    "features": {
      "parallel_experiment": true,
      "custom_model": true,
      "api_access": false
    }
  },
  {
    "name": "team",
    "display_name": "团队版",
    "description": "适合小团队协作",
    "badge_color": "#722ed1",
    "price_monthly": 199,
    "price_yearly": 1990,
    "limits": {
      "max_tasks": 500,
      "max_agents": 100,
      "max_spaces": 50,
      "max_knowledge_bases": 20,
      "max_storage_mb": 51200,
      "max_daily_conversations": 5000,
      "max_monthly_tokens": 10000000
    },
    "features": {
      "parallel_experiment": true,
      "custom_model": true,
      "api_access": true
    }
  }
]
```

---

## API 设计

### 订阅计划管理 (管理员)

```
GET    /api/admin/subscription-plans          # 获取所有计划
POST   /api/admin/subscription-plans          # 创建计划
PUT    /api/admin/subscription-plans/:id      # 更新计划
DELETE /api/admin/subscription-plans/:id      # 删除计划
```

### 用户订阅 (用户)

```
GET    /api/subscription/current              # 获取当前订阅
GET    /api/subscription/plans                # 获取可用计划列表
GET    /api/subscription/usage                # 获取当前用量
GET    /api/subscription/payments             # 获取个人支付历史 (分页)
GET    /api/subscription/payments/:id         # 获取支付详情
POST   /api/subscription/upgrade              # 升级计划 (对接支付)
POST   /api/subscription/cancel               # 取消订阅
```

### 管理员操作用户订阅

```
GET    /api/admin/users/:id/subscription      # 获取用户订阅详情
PUT    /api/admin/users/:id/subscription      # 设置用户订阅 (计划/到期时间/状态)
POST   /api/admin/users/:id/subscription/extend  # 延长订阅
```

### Stripe 配置管理 (管理员)

```
GET    /api/admin/stripe/config               # 获取 Stripe 配置 (敏感字段脱敏)
PUT    /api/admin/stripe/config               # 更新 Stripe 配置
POST   /api/admin/stripe/test                 # 测试 Stripe 连接
```

### 支付历史 (管理员)

```
GET    /api/admin/payments                    # 获取支付记录列表 (分页/筛选)
GET    /api/admin/payments/:id                # 获取支付详情
GET    /api/admin/payments/stats              # 获取支付统计 (本月收入/订单数等)
```

### Stripe Webhook

```
POST   /api/webhooks/stripe                   # Stripe 回调处理
```

### 配额检查 (内部)

```python
# 服务层方法
class SubscriptionService:
    
    @staticmethod
    def check_quota(user_id: str, resource_type: str, increment: int = 1) -> bool:
        """检查是否超出配额"""
        pass
    
    @staticmethod
    def get_remaining_quota(user_id: str, resource_type: str) -> int:
        """获取剩余配额"""
        pass
    
    @staticmethod
    def has_feature(user_id: str, feature_name: str) -> bool:
        """检查是否有某功能权限"""
        pass
```

---

## 前端界面

### 1. 设置页 - 订阅管理 Tab

```
路径: /settings/subscription

┌─────────────────────────────────────────────────────────────┐
│ 订阅管理                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  当前计划: [专业版] ●                                        │
│  有效期至: 2026-02-15                                       │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  本月用量                                                    │
│  ┌─────────────────┬─────────────┬──────────┐              │
│  │ 资源类型         │ 已用/限额    │ 进度     │              │
│  ├─────────────────┼─────────────┼──────────┤              │
│  │ 行动任务         │ 45 / 100    │ ████░░░░ │              │
│  │ 智能体           │ 12 / 20     │ █████░░░ │              │
│  │ 知识库           │ 3 / 5       │ █████░░░ │              │
│  │ 存储空间         │ 2.1 / 5 GB  │ ███░░░░░ │              │
│  │ 本月 Token       │ 450K / 1M   │ ████░░░░ │              │
│  └─────────────────┴─────────────┴──────────┘              │
│                                                             │
│  [升级计划]  [查看账单]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 账户中心 - 支付历史 (所有用户可见)

```
路径: /account/payments (所有用户可见，仅显示自己的支付记录)

┌─────────────────────────────────────────────────────────────┐
│ 支付历史                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  时间              类型      金额      状态      详情        │
│  ────────────────────────────────────────────────────────   │
│  2026-01-15 14:30  订阅      ¥49.00   成功      查看        │
│  2025-12-15 10:22  续费      ¥490.00  成功      查看        │
│  2025-06-01 16:45  升级      ¥150.00  成功      查看        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  共 3 条记录                                < 1 >           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

点击「查看」显示详情弹窗:
┌─────────────────────────────────────────────────────────────┐
│ 支付详情                                          [×]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  订单编号:  PAY-20260115-XXXX                               │
│  支付时间:  2026-01-15 14:30:25                             │
│  支付方式:  Stripe (Visa **** 4242)                         │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  订阅计划:  专业版                                           │
│  计费周期:  月付                                             │
│  金额:      ¥49.00                                          │
│  状态:      ✓ 支付成功                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. 升级计划弹窗

```
┌─────────────────────────────────────────────────────────────┐
│ 选择计划                                          [×]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   免费版    │  │  专业版 ✓   │  │   团队版    │         │
│  │             │  │   当前      │  │             │         │
│  │    ¥0      │  │   ¥49/月   │  │  ¥199/月   │         │
│  │             │  │             │  │             │         │
│  │ · 10 任务   │  │ · 100 任务  │  │ · 500 任务  │         │
│  │ · 3 智能体  │  │ · 20 智能体 │  │ · 100 智能体│         │
│  │ · 512MB    │  │ · 5GB      │  │ · 50GB     │         │
│  │             │  │ · 并行实验  │  │ · API 访问  │         │
│  │             │  │             │  │             │         │
│  │  [当前]     │  │  [当前]     │  │  [升级]     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  💡 年付享 8 折优惠                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. 管理员设置 - 订阅管理页 (仅管理员可见，Tabs 结构)

```
路径: /settings/subscription-management (仅管理员可见，显示所有用户的支付记录)

┌─────────────────────────────────────────────────────────────┐
│ 订阅管理                                                     │
├─────────────────────────────────────────────────────────────┤
│  [套餐管理]  [支付历史]  [Stripe 配置]                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ... Tab 内容 ...                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Tab 1: 套餐管理 (现有功能)

```
┌─────────────────────────────────────────────────────────────┐
│                                            [+ 新建计划]      │
│                                                             │
│  名称      显示名称    月价    年价    状态    操作          │
│  ────────────────────────────────────────────────────────   │
│  free      免费版      ¥0      ¥0     启用    编辑          │
│  pro       专业版      ¥49     ¥490   启用    编辑 删除     │
│  team      团队版      ¥199    ¥1990  启用    编辑 删除     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Tab 2: 支付历史

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  筛选: [全部状态 ▼] [全部类型 ▼] [日期范围 📅]  [搜索...]    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  时间          用户      类型      金额      状态    详情    │
│  ────────────────────────────────────────────────────────   │
│  01-15 14:30  张三      订阅      ¥49.00   成功     查看    │
│  01-14 10:22  李四      升级      ¥150.00  成功     查看    │
│  01-13 16:45  王五      订阅      ¥199.00  失败     查看    │
│  01-12 09:10  赵六      退款      -¥49.00  已退款   查看    │
│  01-10 11:30  张三      续费      ¥490.00  成功     查看    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  共 156 条记录                          < 1 2 3 ... 16 >    │
│                                                             │
│  本月统计:                                                   │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ 总收入    │ 成功订单  │ 失败订单  │ 退款金额  │             │
│  │ ¥12,580  │ 89 笔    │ 3 笔     │ ¥147.00  │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│                                                             │
│                                        [导出 CSV]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**支付历史字段说明:**

| 字段 | 说明 |
|------|------|
| created_at | 支付时间 |
| user | 用户名/邮箱 |
| type | subscription(订阅)/upgrade(升级)/renewal(续费)/refund(退款) |
| amount | 金额 (退款为负数) |
| status | succeeded/failed/pending/refunded |
| stripe_payment_id | Stripe 支付 ID (详情中显示) |
| plan_name | 关联的订阅计划 |

#### Tab 3: Stripe 配置

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  启用 Stripe 支付                              [开关]        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  运行模式                                                    │
│  ○ 测试模式 (Test Mode)    ● 生产模式 (Live Mode)           │
│                                                             │
│  API 密钥                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Publishable Key                                      │   │
│  │ [pk_live_xxxxxxxxxxxxxxxxxxxxx________________]      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Secret Key                                           │   │
│  │ [••••••••••••••••••••••••••••••]  👁                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Webhook 配置                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Webhook Secret                                       │   │
│  │ [••••••••••••••••••••••••••••••••••••••••••]  👁     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Webhook URL (只读)                            📋     │   │
│  │ https://your-domain.com/api/webhooks/stripe         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 请在 Stripe Dashboard 中配置此 Webhook URL              │
│                                                             │
│                          [测试连接]  [保存配置]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Stripe 配置字段说明:**

| 字段 | 说明 | 安全性 |
|------|------|--------|
| enabled | 是否启用 Stripe 支付 | - |
| mode | test / live | - |
| publishable_key | 前端使用，pk_test_* 或 pk_live_* | 可明文显示 |
| secret_key | 后端使用，sk_test_* 或 sk_live_* | 密码框，保存后显示 sk_****xxx |
| webhook_secret | Webhook 签名验证，whsec_* | 密码框 |

---

### 4. 管理员 - 计划管理页 (旧设计，已合并到 Tab 1)

```
路径: /admin/subscription-plans (仅平台管理员可见)

┌─────────────────────────────────────────────────────────────┐
│ 订阅计划管理                              [+ 新建计划]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  名称      显示名称    月价    年价    状态    操作          │
│  ────────────────────────────────────────────────────────   │
│  free      免费版      ¥0      ¥0     启用    编辑          │
│  pro       专业版      ¥49     ¥490   启用    编辑 删除     │
│  team      团队版      ¥199    ¥1990  启用    编辑 删除     │
│  promo     双11特惠    ¥39     -      停用    编辑 删除     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. 配额超限提示

```
创建资源时如超出配额，显示:

┌─────────────────────────────────────────────────────────────┐
│ ⚠️ 已达到计划限额                                            │
│                                                             │
│ 您的「免费版」计划最多可创建 10 个行动任务，当前已有 10 个。   │
│                                                             │
│ 升级到「专业版」可创建 100 个任务，还能解锁更多功能。          │
│                                                             │
│                              [稍后再说]  [立即升级]          │
└─────────────────────────────────────────────────────────────┘
```

### 5. 管理员 - 用户订阅管理

```
路径: /settings/users (现有用户管理页扩展)

用户列表增加订阅列:
┌─────────────────────────────────────────────────────────────┐
│ 用户管理                                      [+ 新建用户]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户名     邮箱              订阅计划    到期时间    操作    │
│  ─────────────────────────────────────────────────────────  │
│  张三       zhang@xx.com     [专业版]    2026-06-01  编辑    │
│  李四       li@xx.com        [免费版]    -           编辑    │
│  王五       wang@xx.com      [团队版]    2026-03-15  编辑    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

点击「编辑」打开用户编辑弹窗，新增订阅管理区域:
┌─────────────────────────────────────────────────────────────┐
│ 编辑用户: 张三                                     [×]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  基本信息                                                    │
│  ─────────────────────────────────────────────────────────  │
│  用户名:  [张三_________]                                    │
│  邮箱:    [zhang@xx.com_]                                    │
│  角色:    [普通用户 ▼]                                       │
│                                                             │
│  订阅管理                                                    │
│  ─────────────────────────────────────────────────────────  │
│  当前计划:  [专业版 ▼]        ← 下拉选择计划                  │
│  到期时间:  [2026-06-01 📅]   ← 日期选择器                   │
│  订阅状态:  ● 生效中  ○ 已过期  ○ 已取消                     │
│                                                             │
│  快捷操作:                                                   │
│  [延长30天]  [延长1年]  [设为永久]  [取消订阅]               │
│                                                             │
│  订阅历史                                        [展开 ▼]    │
│                                                             │
│                              [取消]  [保存]                  │
└─────────────────────────────────────────────────────────────┘

展开订阅历史:
┌─────────────────────────────────────────────────────────────┐
│  订阅历史                                                    │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────┐ │
│  │ 计划      │ 开始时间  │ 结束时间  │ 状态     │ 操作来源   │ │
│  ├──────────┼──────────┼──────────┼──────────┼───────────┤ │
│  │ 免费版    │ 2025-01  │ 2025-06  │ 已过期   │ 系统分配   │ │
│  │ 专业版    │ 2025-06  │ 2026-06  │ 生效中   │ 管理员设置 │ │
│  └──────────┴──────────┴──────────┴──────────┴───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6. 管理员 - 批量订阅管理

```
路径: /admin/subscriptions (独立页面，仅平台管理员)

┌─────────────────────────────────────────────────────────────┐
│ 订阅管理                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  筛选: [所有计划 ▼] [所有状态 ▼] [搜索用户...]  [批量操作 ▼] │
│                                                             │
│  ☐ 用户名     计划      状态      到期时间    用量      操作 │
│  ─────────────────────────────────────────────────────────  │
│  ☐ 张三      专业版    生效中    2026-06-01  45%       编辑 │
│  ☐ 李四      免费版    生效中    -           80%       编辑 │
│  ☐ 王五      团队版    即将到期  2026-01-20  30%       编辑 │
│  ☐ 赵六      专业版    已过期    2026-01-10  -         编辑 │
│                                                             │
│  批量操作:                                                   │
│  - 批量升级到指定计划                                        │
│  - 批量延长有效期                                            │
│  - 批量导出订阅数据                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 配额检查集成点

在以下 API 创建资源时检查配额:

| API | 检查项 |
|-----|--------|
| `POST /api/action-tasks` | `max_tasks` |
| `POST /api/roles` | `max_agents` |
| `POST /api/action-spaces` | `max_spaces` |
| `POST /api/knowledge` | `max_knowledge_bases` |
| `POST /api/conversations/:id/messages` | `max_daily_conversations` |
| 文件上传 | `max_storage_mb` |
| LLM 调用 | `max_monthly_tokens` |

---

## 实施计划

### Phase 1: 基础框架 (1 周) - P0 必须 ✅ 已完成

- [x] 创建数据库表 (subscription_plans, user_subscriptions, usage_records)
- [x] 实现 SubscriptionService 基础方法
- [x] 初始化默认计划数据 (seed_data_subscription_plans.json)
- [x] 新用户注册时自动分配免费计划

### Phase 2: 配额检查 (1 周) - P0 必须 ✅ 已完成

- [x] 实现 check_quota() 方法
- [x] 实现 get_usage_with_limits() 方法
- [x] 在资源创建 API 集成配额检查
  - [x] action-tasks (行动任务)
  - [x] roles (智能体/角色)
  - [x] action-spaces (行动空间)
  - [x] knowledges (知识库)
- [x] 前端显示配额超限提示（简单 message.error 通知）

### Phase 3: 用户界面 (1 周) - P1 重要 ✅ 已完成

- [x] 设置页新增「订阅管理」菜单项
- [x] 实现用量统计展示 (SubscriptionPage.tsx)
- [x] 实现计划对比展示
- [x] 新增「账户中心」菜单（所有用户可见）
  - [x] 个人资料页 (ProfilePage.tsx)
  - [x] 我的订阅页（复用 SubscriptionPage）
  - [x] 团队设置页 (TeamSettingsPage.tsx，占位)
- [x] 菜单配置统一化（MainLayout 使用 menuConfig.ts）
- [ ] 实现升级弹窗和支付流程 (待实现)

### Phase 4: 管理后台 (1 周) - P1 重要 ✅ 已完成

- [x] 管理员计划管理页面 (SubscriptionManagementPage.tsx)
- [x] 计划 CRUD API
- [x] 用户订阅状态管理 API
- [x] 在用户编辑弹窗中集成订阅管理 (UserForm.tsx)
- [x] 后端用户资料 API
  - [x] PUT /users/profile - 更新用户资料
  - [x] POST /users/change-password - 修改密码

### Phase 5: 支付集成 (按需) - P2 可选 🚧 进行中

- [x] Stripe 支付对接
  - [x] 后端 Stripe 配置存储和验证 API (StripeConfig 模型 + 管理 API)
  - [x] 前端 Stripe 配置管理 Tab (StripeConfigTab.tsx)
  - [ ] 创建支付会话 API (create-checkout-session)
  - [ ] Webhook 处理 (支付成功/失败/退款)
- [x] 支付历史记录
  - [x] 后端支付记录表和 API (PaymentRecord 模型 + 查询 API)
  - [x] 前端支付历史 Tab (PaymentsTab.tsx)
  - [x] 用户个人支付历史页面 (PaymentsPage.tsx)
- [ ] 支付流程集成
  - [ ] 前端升级按钮点击逻辑
  - [ ] 跳转到 Stripe Checkout
  - [ ] 支付成功/失败回调处理
- [ ] 订单和账单管理
- [ ] 自动续费逻辑
- [ ] 对接国内支付渠道 (微信/支付宝) - 可选

### Phase 6: 运营增强 (按需) - P3 低优先级

- [ ] 订阅到期提醒 (7天/3天/1天)
- [ ] 优惠码/促销码支持
- [ ] 批量订阅管理页面

### Phase 7: 租户模式 (按需) - P3 低优先级

- [ ] 新增 tenants 表
- [ ] 新增 tenant_subscriptions 表
- [ ] User 表增加 tenant_id 字段
- [ ] SubscriptionPlan.limits 增加 max_users
- [ ] 配额检查支持租户维度
- [ ] 租户管理界面

---

## 注意事项

1. **向后兼容** - 现有用户默认分配免费计划，不影响使用
2. **软限制** - 初期可只提示不阻断，观察用户反馈
3. **缓存** - 用户配额信息应缓存，避免频繁查库
4. **Token 统计** - 需要在 LLM 调用处埋点统计

### 配额检查边界情况

| 场景 | 处理方式 |
|------|----------|
| 订阅过期 | 允许查看已有资源，禁止新建 |
| 降级后超出配额 | 保留已有资源，禁止新建直到低于配额 |
| 管理员手动调整 | 记录操作来源和备注 |

---

## 未来扩展：租户模式

当前设计支持未来扩展为团队/租户模式，**无需重构，只需增量扩展**。

### 扩展路径

```
现在 (单用户订阅):
User → UserSubscription → SubscriptionPlan
              ↓
       UsageRecord (scope=user)

未来 (租户模式):
Tenant → TenantSubscription → SubscriptionPlan
   ↓              ↓
 Users      UsageRecord (scope=tenant)
```

### 扩展时改动

| 改动项 | 内容 |
|--------|------|
| 新增表 | `tenants`, `tenant_subscriptions` |
| User 表 | 增加 `tenant_id` 字段 |
| SubscriptionPlan | limits 增加 `max_users` (团队人数) |
| UsageRecord | 已支持 `scope=tenant` |
| 配额检查 | `check_quota(tenant_id, 'tasks')` |

### 租户模式数据示例

```
Tenant (企业A)
├── plan: 团队版 (max_users=10, max_tasks=500)
├── users: [张三, 李四, 王五]
└── usage_records:
    - scope=tenant, resource=tasks, count=120
    - scope=tenant, resource=users, count=3
```

### 设计要点

- **SubscriptionPlan 复用** - 同一套计划定义，租户和个人都能用
- **UsageRecord 已预留** - scope 字段支持 platform/tenant/user 三级
- **配额检查逻辑** - 租户模式下检查租户总配额，而非单用户

---

## 相关文档

- [多租户资源隔离](../feature-multi-tenancy/RESOURCE-ISOLATION-STATUS.md)
- [用户权限系统](../key-arch/API.md)
- [OAuth 登录](../feature-oauth/PLAN.md)
