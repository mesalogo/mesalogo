# 新会话自动总结功能 - 实现计划

## 功能概述

当用户在当前会话中创建新会话时，系统将自动使用默认文本模型对当前会话的所有消息进行总结，并将总结内容作为新会话的第一条消息，让新会话能够理解之前的讨论上下文。

## 核心价值

1. **上下文连续性**：新会话能够基于之前的讨论继续深入
2. **Token 优化**：通过总结压缩历史信息，避免直接复制大量消息
3. **用户体验**：无需手动复制粘贴或重复描述之前的讨论内容
4. **智能衔接**：AI 总结保证关键信息的提取和传递

## 架构设计

### 1. 数据流

```
用户点击"创建新会话" 
  ↓
前端触发创建流程
  ↓
后端API接收请求（包含可选的 `source_conversation_id` 参数）
  ↓
后端检测到 source_conversation_id 存在
  ↓
调用总结服务（SummaryService）
  ↓
获取源会话的所有消息
  ↓
使用默认文本模型生成总结
  ↓
创建新会话
  ↓
将总结作为系统消息插入新会话
  ↓
返回新会话信息
```

### 2. 模型选择策略

#### 默认模型获取
- **从全局设置获取**：读取系统设置中配置的默认文本模型
- **未配置时**：前端禁用总结选项，提示用户"需要先配置默认模型"

#### 总结提示词模板
```
你是一个会话总结助手。请仔细阅读以下对话内容，提取关键信息并生成一个简洁的总结。

总结应包括：
1. 主要讨论的话题和目标
2. 已达成的共识或决定
3. 待解决的问题或下一步行动
4. 重要的数据、结论或参考信息

请用 2-3 段文字进行总结，保持专业和客观。

---
对话历史：

{conversation_messages}

---
请开始总结：
```

### 3. 数据模型

#### Message 表扩展（可选）
当前 Message 模型已经包含所需字段，无需修改：
- `role`: 'system' / 'user' / 'assistant'
- `content`: 消息内容
- `conversation_id`: 所属会话

#### Conversation 表扩展（可选）
可选添加字段记录会话来源：
```python
# 可选字段
source_conversation_id = Column(String(36), ForeignKey('conversations.id'), nullable=True)
has_summary = Column(Boolean, default=False)  # 标记是否包含总结消息
```

## 实现细节

### 后端实现

#### 1. 新增 SummaryService 服务

**文件位置**: `backend/app/services/summary_service.py`

**核心方法**:
```python
class SummaryService:
    @staticmethod
    def summarize_conversation(conversation_id: str, model_config: dict = None) -> str:
        """
        总结会话内容
        
        Args:
            conversation_id: 会话ID
            model_config: 模型配置（可选，不提供则使用默认）
            
        Returns:
            总结文本
        """
        pass
    
    @staticmethod
    def get_default_summary_model() -> Optional[dict]:
        """
        获取默认的总结模型配置
        
        Returns:
            包含 model_id, api_url, api_key 等的字典，未配置时返回 None
        """
        pass
    
    @staticmethod
    def format_messages_for_summary(messages: List[Message]) -> str:
        """
        格式化消息列表为适合总结的文本格式
        
        Args:
            messages: 消息列表
            
        Returns:
            格式化后的文本
        """
        pass
```

#### 2. 修改 ConversationService

**文件位置**: `backend/app/services/conversation_service.py`

**修改内容**:
```python
@staticmethod
def create_conversation(task_id: int, data: Dict[str, Any]) -> Dict:
    """创建新会话，支持从现有会话总结"""
    
    # 原有逻辑...
    
    # 新增：检查是否需要从源会话总结
    source_conversation_id = data.get('source_conversation_id')
    if source_conversation_id:
        # 检查是否配置了默认模型
        default_model = SummaryService.get_default_summary_model()
        if not default_model:
            logger.warning(f"未配置默认总结模型，跳过总结生成")
        else:
            try:
                # 调用总结服务
                summary = SummaryService.summarize_conversation(source_conversation_id)
                
                # 创建系统消息
                summary_message = Message(
                    conversation_id=conversation.id,
                    role='system',
                    content=f"**[上一会话总结]**\n\n{summary}",
                    created_at=get_current_time_with_timezone()
                )
                db.session.add(summary_message)
                db.session.commit()
                
                logger.info(f"已为新会话 {conversation.id} 生成总结消息，源会话: {source_conversation_id}")
            except Exception as e:
                logger.error(f"生成会话总结失败: {str(e)}")
                # 不影响会话创建，总结失败只记录日志
    
    return result
```

#### 3. 修改 API 路由

**文件位置**: `backend/app/api/routes/conversations.py`

**修改内容**:
```python
@conversation_bp.route('/action-tasks/<string:task_id>/conversations', methods=['POST'])
def create_action_task_conversation(task_id):
    """创建新的行动任务会话"""
    data = request.get_json()
    
    # 验证必填字段
    if 'title' not in data:
        return jsonify({'error': '缺少必填字段: title'}), 400
    
    # 新增：验证 source_conversation_id（如果提供）
    source_conversation_id = data.get('source_conversation_id')
    if source_conversation_id:
        source_conv = Conversation.query.get(source_conversation_id)
        if not source_conv:
            return jsonify({'error': '源会话不存在'}), 404
        if source_conv.action_task_id != task_id:
            return jsonify({'error': '源会话不属于该行动任务'}), 400
    
    # 调用服务创建会话（服务内部会处理总结逻辑）
    result = ConversationService.create_conversation(task_id, data)
    return jsonify(result), 201
```

### 前端实现

#### 1. 修改创建会话的 UI

**文件位置**: `frontend/src/pages/actiontask/components/ActionTaskConversation.js`

**修改内容**:

在创建会话的模态框中添加一个选项：

```jsx
const [enableSummary, setEnableSummary] = useState(false);  // 默认不启用总结
const [hasDefaultModel, setHasDefaultModel] = useState(false);  // 是否配置了默认模型

// 组件加载时检查是否配置了默认模型
useEffect(() => {
  const checkDefaultModel = async () => {
    try {
      const settings = await settingsAPI.getGlobalSettings();
      setHasDefaultModel(!!settings.defaultTextModel);
    } catch (error) {
      console.error('检查默认模型配置失败:', error);
    }
  };
  checkDefaultModel();
}, []);

// 在模态框的表单中添加
<Modal
  title={t('conversation.createNewConversation')}
  open={showNewConversationModal}
  onOk={handleCreateConversation}
  onCancel={() => setShowNewConversationModal(false)}
  confirmLoading={creatingConversation}
>
  <Form layout="vertical">
    <Form.Item label={t('conversation.conversationTitle')}>
      <Input
        value={newConversationTitle}
        onChange={(e) => setNewConversationTitle(e.target.value)}
        placeholder={t('conversation.enterConversationTitle')}
      />
    </Form.Item>
    
    {/* 新增：总结选项 */}
    {activeConversationId && messages.length > 0 && (
      <Form.Item>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Switch
            checked={enableSummary && hasDefaultModel}
            onChange={setEnableSummary}
            disabled={!hasDefaultModel}
            checkedChildren={t('conversation.enableSummary')}
            unCheckedChildren={t('conversation.disableSummary')}
          />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {hasDefaultModel 
              ? t('conversation.summaryHint')
              : t('conversation.noDefaultModelHint')
            }
          </Text>
        </Space>
      </Form.Item>
    )}
  </Form>
</Modal>
```

#### 2. 修改创建会话的 API 调用

```jsx
const handleCreateConversation = async () => {
  if (!newConversationTitle.trim()) {
    setShowCreateValidation(true);
    return;
  }

  setCreatingConversation(true);
  try {
    const conversationData = {
      title: newConversationTitle.trim(),
      description: '',
    };
    
    // 新增：如果启用总结且当前有活跃会话，传递源会话ID
    if (enableSummary && activeConversationId && messages.length > 0) {
      conversationData.source_conversation_id = activeConversationId;
    }
    
    const newConversation = await conversationAPI.createConversation(task.id, conversationData);
    
    message.success(t('conversation.conversationCreated'));
    setShowNewConversationModal(false);
    setNewConversationTitle('');
    setEnableSummary(false);  // 重置为默认值（不勾选）
    
    // 刷新会话列表
    await loadConversations();
    
    // 切换到新会话
    setActiveConversationId(newConversation.id);
    
    // 通知父组件
    if (onConversationCreated) {
      onConversationCreated(newConversation);
    }
  } catch (error) {
    console.error('创建会话失败:', error);
    message.error(t('conversation.createConversationFailed'));
  } finally {
    setCreatingConversation(false);
  }
};
```

#### 3. 添加国际化文本

**文件位置**: 
- `frontend/src/locales/zh-CN.js`
- `frontend/src/locales/en-US.js`

```javascript
// zh-CN.js
conversation: {
  // ... 现有的键 ...
  enableSummary: '总结当前会话',
  disableSummary: '不总结',
  summaryHint: '启用后，将使用 AI 总结当前会话内容并作为新会话的背景',
  noDefaultModelHint: '需要先在系统设置中配置默认文本模型',
  previousConversationSummary: '上一会话总结',
}

// en-US.js
conversation: {
  // ... existing keys ...
  enableSummary: 'Summarize Current Conversation',
  disableSummary: 'No Summary',
  summaryHint: 'When enabled, AI will summarize the current conversation as context for the new conversation',
  noDefaultModelHint: 'Please configure a default text model in system settings first',
  previousConversationSummary: 'Previous Conversation Summary',
}
```

## 用户交互流程

### 场景 1：创建带总结的新会话

1. 用户在当前会话中进行了多轮对话
2. 用户点击"创建新会话"按钮
3. 弹出创建会话对话框
4. 对话框显示"总结当前会话"开关（默认关闭）
5. 用户手动开启"总结当前会话"开关
6. 用户输入新会话标题，确认创建
7. 系统显示加载状态（"正在总结会话..."）
8. 后端生成总结并创建新会话
9. 前端切换到新会话，第一条消息显示总结内容（带特殊标记）
10. 用户可以在新会话中基于总结继续对话

### 场景 2：创建不带总结的新会话

1. 用户在当前会话中进行了多轮对话
2. 用户点击"创建新会话"按钮
3. 弹出创建会话对话框
4. 用户关闭"总结当前会话"开关
5. 用户输入新会话标题，确认创建
6. 系统创建空白新会话（无总结）
7. 前端切换到新会话

### 场景 3：从空会话创建新会话

1. 当前会话没有任何消息
2. 用户点击"创建新会话"按钮
3. 对话框中不显示"总结当前会话"选项
4. 用户直接创建新会话

### 场景 4：未配置默认模型

1. 系统未配置默认文本模型
2. 用户点击"创建新会话"按钮
3. 对话框显示"总结当前会话"开关，但处于禁用状态
4. 提示文字显示"需要先在系统设置中配置默认文本模型"
5. 用户只能创建不带总结的新会话

## UI/UX 设计

### 总结消息的显示样式

在会话消息列表中，总结消息应该有特殊的视觉样式：

```jsx
{message.role === 'system' && message.content.includes('[上一会话总结]') && (
  <div className="summary-message">
    <div className="summary-header">
      <InfoCircleOutlined />
      <Text strong>{t('conversation.previousConversationSummary')}</Text>
    </div>
    <div className="summary-content">
      {/* 渲染 Markdown 内容 */}
      <ReactMarkdown>{message.content.replace('**[上一会话总结]**\n\n', '')}</ReactMarkdown>
    </div>
  </div>
)}
```

**CSS 样式**:
```css
.summary-message {
  background: #f6f8fa;
  border-left: 4px solid #1890ff;
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #1890ff;
  font-weight: 500;
}

.summary-content {
  color: #595959;
  line-height: 1.6;
}
```

## 错误处理

### 1. 总结生成失败
- **场景**: 模型 API 调用失败、超时等
- **处理**: 记录错误日志，但不影响新会话创建
- **用户体验**: 创建会话成功，但没有总结消息

### 2. 未配置默认模型
- **场景**: 系统未配置默认文本模型
- **处理**: 前端禁用总结选项并提示，后端跳过总结
- **用户体验**: 创建会话成功，但没有总结消息

### 3. 源会话不存在或无权访问
- **场景**: 传递的 source_conversation_id 无效
- **处理**: 返回 404 错误
- **用户体验**: 提示"无法访问源会话"

### 4. 源会话无消息
- **场景**: 源会话为空
- **处理**: 跳过总结，直接创建空白会话
- **用户体验**: 正常创建会话

## 性能优化

### 1. 消息数量限制
- 如果会话消息超过一定数量（如 100 条），只总结最近的消息
- 配置项：`MAX_MESSAGES_FOR_SUMMARY = 100`

### 2. 同步生成
- 总结生成完成后再返回新会话
- 用户体验：创建时显示"正在生成总结..."加载状态
- 超时设置：30 秒

## 配置选项

### 系统设置

在系统设置中添加总结相关配置：

```python
# config.py 或数据库设置表
SUMMARY_CONFIG = {
    'enabled': True,  # 是否启用总结功能
    'default_model': None,  # 默认总结模型（None 则自动选择）
    'max_messages': 100,  # 最多总结的消息数量
    'timeout': 30,  # 总结生成超时时间（秒）
    'prompt_template': '...',  # 总结提示词模板
}
```

## 测试计划

### 单元测试

1. **SummaryService.summarize_conversation()**
   - 测试正常总结流程
   - 测试空会话
   - 测试超长会话
   - 测试模型调用失败

2. **SummaryService.get_default_summary_model()**
   - 测试获取全局默认模型
   - 测试降级策略

3. **ConversationService.create_conversation()**
   - 测试带 source_conversation_id 创建
   - 测试不带 source_conversation_id 创建
   - 测试无效的 source_conversation_id

### 集成测试

1. 完整流程测试：创建会话 → 发送消息 → 创建新会话（带总结） → 验证总结内容
2. 多用户并发创建会话测试
3. 不同模型配置下的总结生成测试

### 前端测试

1. UI 交互测试：开关总结选项
2. 网络异常测试：后端超时、错误响应
3. 边界条件测试：空会话、超长会话

## 实施步骤

### Phase 1: 后端基础（第 1-2 天）
- [ ] 创建 `SummaryService`
- [ ] 实现总结提示词模板
- [ ] 实现默认模型获取逻辑
- [ ] 实现消息格式化方法

### Phase 2: 后端集成（第 2-3 天）
- [ ] 修改 `ConversationService.create_conversation()`
- [ ] 修改 API 路由验证逻辑
- [ ] 添加错误处理
- [ ] 编写单元测试

### Phase 3: 前端实现（第 3-4 天）
- [ ] 修改创建会话 UI（添加开关）
- [ ] 修改 API 调用（传递 source_conversation_id）
- [ ] 实现总结消息的特殊显示样式
- [ ] 添加国际化文本

### Phase 4: 测试与优化（第 4-5 天）
- [ ] 集成测试
- [ ] 性能测试
- [ ] UI/UX 调整
- [ ] 文档更新

## 潜在扩展

1. **多会话联合总结**：从多个相关会话生成总结
2. **总结历史记录**：记录每次总结的版本，支持查看历史
3. **自定义总结模板**：允许用户自定义总结的风格和侧重点
4. **智能推荐**：基于总结内容，推荐下一步行动或相关资源
5. **总结质量评估**：允许用户对总结质量进行评分，优化提示词

## 附录

### A. 总结提示词模板示例

```markdown
你是一个专业的会话总结助手。请仔细分析以下多智能体对话，提取核心信息并生成结构化总结。

**总结要求**：
1. **对话主题**：概括讨论的核心话题（1-2 句话）
2. **关键结论**：列出达成的共识、做出的决定或发现的问题（3-5 点）
3. **重要信息**：提取关键数据、参考资料或技术细节
4. **下一步行动**：总结待办事项或后续计划（如有）

**对话历史**：
{conversation_messages}

**输出格式**：
使用 Markdown 格式，层次清晰，要点简洁。

---
请开始总结：
```

### B. 消息格式化示例

```python
def format_messages_for_summary(messages: List[Message]) -> str:
    """
    格式化消息列表
    
    示例输出：
    [用户]: 我们来讨论一下项目计划
    [智能体-策划]: 好的，建议从需求分析开始
    [智能体-开发]: 我同意，我们需要先明确技术栈
    """
    formatted = []
    for msg in messages:
        speaker = msg.sender_name or ('用户' if msg.role == 'user' else '智能体')
        formatted.append(f"[{speaker}]: {msg.content}")
    return '\n'.join(formatted)
```

---

## 总结

本功能通过在会话之间自动传递上下文总结，显著提升了多会话工作流的连续性和效率。实现上遵循最小侵入原则，不破坏现有架构，同时为未来的智能化功能（如自动分类、推荐、知识图谱构建）奠定基础。
