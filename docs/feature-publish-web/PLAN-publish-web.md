# 行动任务Web发布功能 - SaaS化方案

## 1. 需求背景

### 1.1 业务目标
将平台的部分功能（如交易行动任务）封装成独立的SaaS服务模式，使其可以：
- 通过链接分享给其他用户访问
- 通过iframe嵌入到第三方网站
- 无需登录即可查看和使用（可选配置）
- 支持多租户隔离和权限控制

### 1.2 应用场景
1. **公开展示**：将某个行动任务作为Demo展示给潜在客户
2. **协作共享**：团队成员通过链接访问共享的任务
3. **嵌入集成**：将任务嵌入到企业内部系统或第三方平台
4. **SaaS服务**：将特定功能打包成独立的应用服务

### 1.3 核心需求
- ✅ 生成可分享的公开链接
- ✅ 支持iframe嵌入模式
- ✅ 访问权限控制（公开/私有/密码保护）
- ✅ 独立的访问统计
- ✅ 自定义品牌和样式（可选）

## 2. 技术方案

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    主平台系统                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │         行动任务详情页                              │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  [发布] 按钮 → 发布配置Modal                 │  │   │
│  │  │  - 访问权限设置                              │  │   │
│  │  │  - 生成分享链接                              │  │   │
│  │  │  - 生成嵌入代码                              │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              发布的Web应用访问层                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  /public/task/:shareToken                        │   │
│  │  - 简化的UI界面                                    │   │
│  │  - 只读或交互模式                                  │   │
│  │  - 访问权限验证                                    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据模型设计

#### 2.2.1 新增表：PublishedTask（发布任务表）

```python
class PublishedTask(BaseMixin, db.Model):
    """发布的任务配置"""
    __tablename__ = 'published_tasks'
    
    # 基本信息
    action_task_id = Column(String(36), ForeignKey('action_tasks.id'), nullable=False)
    share_token = Column(String(64), unique=True, nullable=False, index=True)  # 分享令牌
    
    # 发布配置
    title = Column(String(200))  # 自定义标题（可选，默认使用任务标题）
    description = Column(Text)   # 自定义描述
    
    # 访问控制
    access_type = Column(String(20), default='public')  # public/private/password
    access_password = Column(String(128))  # 密码保护（加密存储）
    allowed_domains = Column(JSON)  # 允许嵌入的域名白名单
    
    # 功能配置
    mode = Column(String(20), default='readonly')  # readonly/interactive
    show_agents = Column(Boolean, default=True)  # 是否显示智能体列表
    show_messages = Column(Boolean, default=True)  # 是否显示消息历史
    allow_chat = Column(Boolean, default=False)  # 是否允许发送消息
    
    # 样式配置
    theme = Column(JSON)  # 自定义主题配置
    branding = Column(JSON)  # 品牌配置（logo、标题等）
    
    # 统计信息
    view_count = Column(Integer, default=0)  # 访问次数
    last_viewed_at = Column(DateTime)  # 最后访问时间
    
    # 状态
    is_active = Column(Boolean, default=True)  # 是否启用
    expires_at = Column(DateTime)  # 过期时间（可选）
    
    # 多租户
    user_id = Column(String(36), ForeignKey('users.id'))  # 发布者
    
    # 关联关系
    action_task = relationship("ActionTask", backref="published_versions")
    user = relationship("User")
```

### 2.3 后端API设计

#### 2.3.1 发布管理API

```python
# backend/app/api/routes/published_tasks.py

@published_task_bp.route('/action-tasks/<task_id>/publish', methods=['POST'])
@login_required
def publish_task(task_id):
    """
    发布行动任务
    
    请求体:
    {
        "title": "自定义标题",
        "description": "自定义描述",
        "access_type": "public|private|password",
        "access_password": "密码",
        "mode": "readonly|interactive",
        "show_agents": true,
        "show_messages": true,
        "allow_chat": false,
        "expires_at": "2025-12-31T23:59:59Z"
    }
    
    响应:
    {
        "success": true,
        "share_url": "https://domain.com/public/task/abc123xyz",
        "embed_code": "<iframe src='...' />",
        "share_token": "abc123xyz"
    }
    """
    pass

@published_task_bp.route('/action-tasks/<task_id>/publish', methods=['GET'])
@login_required
def get_publish_config(task_id):
    """获取任务的发布配置"""
    pass

@published_task_bp.route('/action-tasks/<task_id>/publish', methods=['PUT'])
@login_required
def update_publish_config(task_id):
    """更新发布配置"""
    pass

@published_task_bp.route('/action-tasks/<task_id>/publish', methods=['DELETE'])
@login_required
def unpublish_task(task_id):
    """取消发布"""
    pass

@published_task_bp.route('/action-tasks/<task_id>/publish/stats', methods=['GET'])
@login_required
def get_publish_stats(task_id):
    """获取发布统计信息"""
    pass
```

#### 2.3.2 公开访问API

```python
# backend/app/api/routes/public_tasks.py

@public_task_bp.route('/public/task/<share_token>', methods=['GET'])
def get_published_task(share_token):
    """
    获取发布的任务信息（公开访问，无需登录）
    
    查询参数:
    - password: 访问密码（如果需要）
    
    响应:
    {
        "task": {
            "id": "task_id",
            "title": "任务标题",
            "description": "任务描述",
            "mode": "readonly",
            "config": {...}
        },
        "agents": [...],  # 如果show_agents=true
        "conversations": [...]  # 如果show_messages=true
    }
    """
    pass

@public_task_bp.route('/public/task/<share_token>/messages', methods=['GET'])
def get_published_task_messages(share_token):
    """获取发布任务的消息列表"""
    pass

@public_task_bp.route('/public/task/<share_token>/send', methods=['POST'])
def send_message_to_published_task(share_token):
    """向发布的任务发送消息（如果allow_chat=true）"""
    pass
```

### 2.4 前端实现

#### 2.4.1 发布配置组件

```jsx
// frontend/src/pages/actiontask/components/PublishModal.js

const PublishModal = ({ visible, onCancel, task }) => {
  const [publishConfig, setPublishConfig] = useState({
    access_type: 'public',
    mode: 'readonly',
    show_agents: true,
    show_messages: true,
    allow_chat: false
  });
  
  const [publishResult, setPublishResult] = useState(null);
  
  const handlePublish = async () => {
    // 调用发布API
    const result = await publishTaskAPI.publish(task.id, publishConfig);
    setPublishResult(result);
  };
  
  return (
    <Modal
      title="发布任务"
      visible={visible}
      onCancel={onCancel}
      width={800}
    >
      {!publishResult ? (
        <Form>
          <Form.Item label="访问权限">
            <Radio.Group value={publishConfig.access_type}>
              <Radio value="public">公开访问</Radio>
              <Radio value="password">密码保护</Radio>
              <Radio value="private">仅限授权</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item label="访问模式">
            <Radio.Group value={publishConfig.mode}>
              <Radio value="readonly">只读模式</Radio>
              <Radio value="interactive">交互模式</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item label="显示选项">
            <Checkbox checked={publishConfig.show_agents}>显示智能体</Checkbox>
            <Checkbox checked={publishConfig.show_messages}>显示消息</Checkbox>
            <Checkbox checked={publishConfig.allow_chat}>允许发送消息</Checkbox>
          </Form.Item>
          
          <Button type="primary" onClick={handlePublish}>
            生成分享链接
          </Button>
        </Form>
      ) : (
        <div>
          <Alert message="发布成功！" type="success" />
          
          <Divider>分享链接</Divider>
          <Input.TextArea
            value={publishResult.share_url}
            readOnly
            autoSize
          />
          <Button icon={<CopyOutlined />}>复制链接</Button>
          
          <Divider>嵌入代码</Divider>
          <Input.TextArea
            value={publishResult.embed_code}
            readOnly
            autoSize
          />
          <Button icon={<CopyOutlined />}>复制代码</Button>
        </div>
      )}
    </Modal>
  );
};
```

#### 2.4.2 公开访问页面

```jsx
// frontend/src/pages/public/PublicTaskView.js

const PublicTaskView = () => {
  const { shareToken } = useParams();
  const [task, setTask] = useState(null);
  const [needPassword, setNeedPassword] = useState(false);
  
  useEffect(() => {
    loadPublishedTask();
  }, [shareToken]);
  
  const loadPublishedTask = async () => {
    try {
      const data = await publicTaskAPI.getTask(shareToken);
      setTask(data);
    } catch (error) {
      if (error.status === 401) {
        setNeedPassword(true);
      }
    }
  };
  
  if (needPassword) {
    return <PasswordPrompt onSubmit={handlePasswordSubmit} />;
  }
  
  if (!task) {
    return <Loading />;
  }
  
  return (
    <div className="public-task-view">
      {/* 简化的任务展示界面 */}
      <TaskHeader task={task} />
      
      {task.config.show_agents && (
        <AgentList agents={task.agents} />
      )}
      
      {task.config.show_messages && (
        <MessageList messages={task.messages} />
      )}
      
      {task.config.allow_chat && (
        <ChatInput onSend={handleSendMessage} />
      )}
    </div>
  );
};
```

### 2.5 路由配置

```jsx
// frontend/src/App.js

// 公开路由（无需登录）
<Route path="/public/task/:shareToken" element={<PublicTaskView />} />

// 嵌入模式路由
<Route path="/embed/task/:shareToken" element={<EmbedTaskView />} />
```

## 3. 实现步骤

### Phase 1: 数据模型和基础API（2天）
- [ ] 创建PublishedTask数据模型
- [ ] 实现发布管理API（CRUD）
- [ ] 实现share_token生成逻辑
- [ ] 添加访问权限验证中间件

### Phase 2: 发布配置界面（2天）
- [ ] 创建PublishModal组件
- [ ] 实现发布配置表单
- [ ] 实现分享链接和嵌入代码生成
- [ ] 在ActionTaskDetail中集成发布按钮

### Phase 3: 公开访问页面（3天）
- [ ] 创建PublicTaskView页面
- [ ] 实现密码验证界面
- [ ] 实现只读模式展示
- [ ] 实现交互模式（可选）
- [ ] 优化移动端适配

### Phase 4: 嵌入模式支持（2天）
- [ ] 创建EmbedTaskView页面
- [ ] 实现iframe通信机制
- [ ] 添加域名白名单验证
- [ ] 实现响应式布局

### Phase 5: 统计和管理（1天）
- [ ] 实现访问统计
- [ ] 创建发布管理列表页
- [ ] 添加发布状态监控

## 4. 安全考虑

### 4.1 访问控制
- share_token使用加密随机字符串（64位）
- 密码使用bcrypt加密存储
- 支持访问次数限制
- 支持过期时间设置

### 4.2 iframe安全
- CSP（Content Security Policy）配置
- X-Frame-Options控制
- 域名白名单验证
- 防止点击劫持

### 4.3 数据隔离
- 只暴露配置允许的数据
- 敏感信息过滤
- 操作日志记录

## 5. 扩展功能（可选）

### 5.1 高级功能
- [ ] 自定义域名绑定
- [ ] 访问分析Dashboard
- [ ] 多语言支持
- [ ] 主题自定义
- [ ] 水印添加

### 5.2 集成功能
- [ ] 与应用市场集成
- [ ] 作为独立App发布
- [ ] API密钥访问模式
- [ ] Webhook通知

## 6. 使用流程示例

### 6.1 发布流程
1. 用户在行动任务详情页点击"发布"按钮
2. 配置发布选项（权限、模式、显示内容）
3. 点击"生成分享链接"
4. 获得分享URL和嵌入代码
5. 复制链接分享或嵌入到网站

### 6.2 访问流程
1. 访客打开分享链接
2. 如需密码，输入访问密码
3. 查看任务信息和消息历史
4. 如允许交互，可发送消息与智能体对话

## 7. API接口清单

### 7.1 管理端API（需要登录）
- `POST /api/action-tasks/:id/publish` - 发布任务
- `GET /api/action-tasks/:id/publish` - 获取发布配置
- `PUT /api/action-tasks/:id/publish` - 更新发布配置
- `DELETE /api/action-tasks/:id/publish` - 取消发布
- `GET /api/action-tasks/:id/publish/stats` - 获取统计

### 7.2 公开访问API（无需登录）
- `GET /api/public/task/:token` - 获取发布任务
- `POST /api/public/task/:token/verify` - 验证访问密码
- `GET /api/public/task/:token/messages` - 获取消息
- `POST /api/public/task/:token/send` - 发送消息（如允许）

## 8. 数据库迁移

```python
# migrations/versions/xxx_add_published_tasks.py

def upgrade():
    op.create_table(
        'published_tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('action_task_id', sa.String(36), nullable=False),
        sa.Column('share_token', sa.String(64), unique=True, nullable=False),
        sa.Column('access_type', sa.String(20), default='public'),
        sa.Column('access_password', sa.String(128)),
        sa.Column('mode', sa.String(20), default='readonly'),
        sa.Column('config', sa.JSON),
        sa.Column('view_count', sa.Integer, default=0),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime),
        sa.Column('updated_at', sa.DateTime),
        # ... 其他字段
    )
    op.create_index('idx_share_token', 'published_tasks', ['share_token'])
```

## 9. 总结

这个方案提供了一个完整的行动任务Web发布功能，支持：
- ✅ 灵活的访问控制（公开/密码/私有）
- ✅ 多种展示模式（只读/交互）
- ✅ iframe嵌入支持
- ✅ 访问统计和管理
- ✅ 安全性保障

通过这个功能，可以将平台的核心能力以SaaS服务的形式对外提供，为后续的应用市场和独立App打下基础。

