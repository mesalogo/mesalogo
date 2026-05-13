# 多智能体对话历史管理 - 修改日志

## 消息格式总览

### 多Agent模式 - 消息流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           多Agent模式 - 首次调用LLM                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  数据库中的历史消息:                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ [1] user: "帮我分析这个合同"                                              │   │
│  │ [2] agent-A (法律顾问): "好的，我来分析..."                               │   │
│  │ [3] agent-B (财务顾问): "从财务角度看..."                                 │   │
│  │ [4] user: "有什么风险？"                                                  │   │
│  │ [5] agent-A (法律顾问): "主要风险有..." + [工具调用: search_law]          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│                                      ▼                                           │
│  发送给 agent-C (技术顾问) 的 messages:                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  [0] role: "system"                                                       │   │
│  │      content: "你是技术顾问...                                            │   │
│  │                                                                           │   │
│  │               # Previous Conversation History                             │   │
│  │                                                                           │   │
│  │               **User said:**                                              │   │
│  │               帮我分析这个合同                                             │   │
│  │                                                                           │   │
│  │               **法律顾问 [Agent] said:**                                  │   │
│  │               好的，我来分析...                                            │   │
│  │                                                                           │   │
│  │               **财务顾问 [Agent] said:**                                  │   │
│  │               从财务角度看...                                              │   │
│  │                                                                           │   │
│  │               **User said:**                                              │   │
│  │               有什么风险？                                                 │   │
│  │                                                                           │   │
│  │               **法律顾问 [Agent] said:**                                  │   │
│  │               主要风险有...                                                │   │
│  │               [Called tool: search_law]                                   │   │
│  │               [Result: 相关法律条文...]"                                  │   │
│  │                                                                           │   │
│  │  [1] role: "user"                                                         │   │
│  │      content: "当前用户的新问题"                                          │   │
│  │                                                                           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ✅ 只有 2 条消息: [system, user]                                                │
│  ✅ 所有历史都在 system prompt 中                                                │
│  ✅ 兼容 OpenAI 和 Claude                                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                      多Agent模式 - 工具调用后二次调用LLM                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  agent-C 首次响应时调用了工具:                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ streaming输出: "我来检查技术细节..." + tool_use(check_api)                │   │
│  │                                       │                                   │   │
│  │                                       ▼                                   │   │
│  │                              执行工具，得到结果                            │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│                                      ▼                                           │
│  二次调用 LLM 的 messages (OpenAI格式):                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  [0] role: "system"                                                       │   │
│  │      content: "你是技术顾问... # Previous Conversation History ..."       │   │
│  │                                                                           │   │
│  │  [1] role: "user"                                                         │   │
│  │      content: "当前用户的问题"                                            │   │
│  │                                                                           │   │
│  │  [2] role: "assistant"                        ◄── 当前轮次的工具调用       │   │
│  │      content: "我来检查技术细节..."                                       │   │
│  │      tool_calls: [{id: "call_xxx", function: {name: "check_api", ...}}]   │   │
│  │                                                                           │   │
│  │  [3] role: "tool"                             ◄── 工具执行结果             │   │
│  │      tool_call_id: "call_xxx"                                             │   │
│  │      content: "API检查结果: 正常"                                         │   │
│  │                                                                           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  二次调用 LLM 的 messages (Claude格式):                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  [0] role: "system"                                                       │   │
│  │      content: "你是技术顾问... # Previous Conversation History ..."       │   │
│  │                                                                           │   │
│  │  [1] role: "user"                                                         │   │
│  │      content: "当前用户的问题"                                            │   │
│  │                                                                           │   │
│  │  [2] role: "assistant"                        ◄── 当前轮次的工具调用       │   │
│  │      content: [{type: "tool_use", id: "toolu_xxx", name: "check_api"}]    │   │
│  │                                                                           │   │
│  │  [3] role: "user"                             ◄── Claude: tool_result在user中
│  │      content: [{type: "tool_result", tool_use_id: "toolu_xxx",            │   │
│  │                 content: "API检查结果: 正常"}]                             │   │
│  │                                                                           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ⚠️ 关键: original_messages 不包含当前轮次的 assistant 消息                      │
│  ⚠️ 当前轮次的 tool_use + tool_result 在 call_llm_with_tool_results 中追加       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 核心原则

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  原则1: 当前轮次的 agent 消息在 agentDone 之前不作为 history                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  时间线:                                                                         │
│  ────────────────────────────────────────────────────────────────────────────►  │
│                                                                                  │
│  [历史消息]              [当前轮次 - streaming中]           [agentDone后]        │
│  ┌─────────┐            ┌─────────────────────┐           ┌─────────────┐       │
│  │ 已存入  │            │ 正在输出，未存入DB   │           │ 存入DB，    │       │
│  │ 数据库  │            │ 不在 history 中     │           │ 成为历史    │       │
│  └─────────┘            └─────────────────────┘           └─────────────┘       │
│       │                          │                                               │
│       ▼                          ▼                                               │
│  original_messages          当前轮次动态追加:                                     │
│  (从DB加载)                 assistant(tool_use) + tool_result                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  原则2: 多Agent模式下，messages 数组只有 [system, user]                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ❌ 错误 (v3.0之前):                                                             │
│  messages = [system] → [assistant] → [user]                                     │
│             ↑ Claude报错: 必须以user开头                                         │
│                                                                                  │
│  ✅ 正确 (v4.0):                                                                 │
│  messages = [system (包含所有历史)] → [user]                                     │
│             ↑ 兼容所有提供商                                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2025-12-02 - Final Version

### ✅ 完成的功能

#### 1. 智能消息分组逻辑
**实现位置**: `process_message_common()` 第489-533行

**功能**:
- 从后往前识别当前agent的连续消息
- 连续消息 → assistant角色
- 插入式消息 → system history
- 完整user消息也包含在历史中

**场景示例**:
- `A → C → B → C → C`: 最后2个C是连续，中间的C在历史
- `A → B → C → C → C`: 最后3个C都是连续
- `C → A → B`: C在历史中

**日志输出**:
```
[多Agent模式] 识别出 X 条连续own消息，Y 条历史消息
```

---

#### 2. 保留工具调用原始格式
**实现位置**: `_format_message_with_tool_calls()` 第1404-1436行

**修改前** (❌ 错误):
```html
<!--Tool Call: list_task_vars-->
<!--Parameters: {...}-->
<!--Result: {...}-->
```

**修改后** (✅ 正确):
```
[Called tool: list_task_vars]
[Parameters: {...}]
[Result: {...}]
```

**原因**: 
- HTML注释破坏了LLM学习模式
- 方括号格式清晰，易于LLM理解
- 保留结构化信息

---

#### 3. 移除所有HTML注释标记
**实现位置**: `_expand_assistant_message_with_tool_calls()` 多处

**移除的标记**:
```html
<!--The following is a reply from 财务顾问[财务顾问][Agent][ID: xxx]-->
```

**移除位置**:
- Line 1212-1216: split模式，第一个assistant消息
- Line 1235-1239: split模式，后续assistant消息
- Line 1260-1264: 保留完整内容模式
- Line 1270-1274: 无工具调用模式

**原因**: 这些HTML注释会干扰LLM学习和理解

---

#### 4. 完整对话历史在system prompt
**实现位置**: `_format_conversation_history()` 第1331-1401行

**格式**:
```markdown
# Previous Conversation History

**User said:**
question 1

**Agent-A [Developer] [Agent] [ID: 1] said:**
I'll check the variables.

[Called tool: list_task_vars]
[Parameters: {"task_id": "..."}]
[Result: {...}]

Based on the results, ...

**User said:**
question 2

**Agent-B [Tester] [Agent] [ID: 2] said:**
response 2
```

**特点**:
- ✅ 完整的时间顺序
- ✅ User + Agent消息交错
- ✅ 工具调用保留结构
- ✅ 清晰的角色标识

---

### 🔧 修改的函数

#### 1. `process_message_common()`
- 新增连续消息识别逻辑（从后往前遍历）
- 分离continuous_own_messages和history_messages
- 传递continuous_own_messages给format_messages()

#### 2. `format_messages()`
- 新增参数：`continuous_own_messages`
- 使用continuous_own_messages而非全部own messages
- 历史消息完全在system prompt中

#### 3. `build_system_prompt()`
- 新增参数：`other_agents_context`
- 添加"Previous Conversation History"章节
- 明确身份警告

#### 4. `_format_conversation_history()`
- 调用`_format_message_with_tool_calls()`保留工具调用
- 不再调用`_convert_tool_calls_to_inline()`
- 传入`current_agent_id=None`包含所有历史

#### 5. `_format_message_with_tool_calls()` (新增)
- 解析工具调用
- 格式化为方括号标记
- 截断超长结果（500字符）

#### 6. `_expand_assistant_message_with_tool_calls()`
- 移除所有HTML注释添加代码（4处）
- 保持原始消息内容

---

### 📊 预期效果

#### 解决的问题
✅ **身份混淆**: agent-C不会说"我之前说过..."引用其他agents
✅ **对话理解**: agent-C能看到完整的对话流程
✅ **工具学习**: LLM能正确学习工具调用模式
✅ **时间顺序**: 完整的user-agent对话流

#### 性能影响
- **Token消耗**: 预期持平或略减（移除HTML注释）
- **可读性**: system prompt更清晰
- **学习效果**: LLM能更好地学习工具使用

---

### 🧪 测试清单

#### 基本场景
- [ ] A → B → C（C首次发言）
- [ ] A → C → B → C（插入式）
- [ ] A → B → C → C → C（连续）
- [ ] A → C → B → C → C（混合）

#### 边界情况
- [ ] 只有C自己的消息
- [ ] C插入在最前面
- [ ] 包含工具调用的消息
- [ ] 隔离模式仍正常

#### 验证点
- [ ] 日志：`[多Agent模式] 识别出 X 条连续own消息`
- [ ] system prompt中无HTML注释
- [ ] assistant消息中无HTML注释
- [ ] 工具调用格式为`[Called tool: xxx]`

---

### 🐛 已修复的Bug

#### Bug #1: 参数名不匹配
**错误**: 
```python
_format_conversation_history(messages, target_agent_id=None, ...)
```

**原因**: 函数定义是`current_agent_id`

**修复**: 
```python
_format_conversation_history(messages, current_agent_id=None, ...)
```

#### Bug #2: HTML注释仍出现
**错误**: assistant消息中有`<!--The following is a reply from...-->`

**原因**: `_expand_assistant_message_with_tool_calls()`的4处添加了HTML

**修复**: 移除所有4处HTML注释添加代码

---

### 📝 文档清单

- ✅ `PLAN.md` - 详细设计文档
- ✅ `RESEARCH-FINDINGS.md` - 行业最佳实践
- ✅ `TEST_SUMMARY.md` - 测试总结
- ✅ `TEST_SCENARIOS.md` - 7个测试场景
- ✅ `FINAL_SUMMARY.md` - 最终总结
- ✅ `CHANGELOG.md` - 本文档

---

### 🚀 部署建议

1. **备份当前代码**
2. **部署修改后的代码**
3. **观察关键日志**:
   - `[多Agent模式] 识别出 X 条连续own消息`
   - `[格式化对话历史] 共格式化 N 条消息`
4. **验证3个agent对话**
5. **确认无HTML注释出现**
6. **监控token消耗变化**

---

## 版本历史

### v1.0 - 初始版本
- 将其他agents的消息放入system prompt

### v2.0 - 包含user消息
- 用户反馈：需要user消息才能理解对话流程
- 完整对话历史（user + agents）

### v3.0 - 智能分组（最终版）
- 区分连续消息和插入式消息
- 保留工具调用原始格式
- 移除所有HTML注释

---

## 待办事项

- [ ] 实际环境测试
- [ ] 性能监控
- [ ] 用户反馈收集
- [ ] 可选：添加系统设置开关
- [ ] 可选：长对话历史摘要

---

## 2026-01-03 - v4.0 统一消息格式

### 🎯 问题背景

**Claude API 报错**: `"Improperly formed request"`

**原因分析**:
- Claude 要求 messages 数组**必须以 user 角色开头**
- Claude 要求 user/assistant **必须交替出现**
- 当前 v3.0 设计在非隔离模式下，messages 可能变成：`[system] → [assistant] → [user]`
- 这对 OpenAI 没问题，但违反了 Claude 的要求

### ✅ 解决方案

**统一所有提供商的消息格式**：将所有历史消息（包括当前 agent 自己的历史回复）都放入 system prompt。

**修改前 (v3.0)**:
```
messages: [system] → [assistant (连续own消息)] → [user (最新)]
```

**修改后 (v4.0)**:
```
messages: [system (包含所有历史)] → [user (最新消息)]
```

### 🔧 修改内容

#### 1. `format_messages()` 函数
- 非隔离模式下，不再添加 `continuous_own_messages` 作为 assistant 角色
- messages 数组只包含 `[system, user]`

#### 2. `process_message_common()` 函数
- 将所有历史消息（包括当前 agent 的连续消息）都合并到 `other_agents_context`
- 在 system prompt 中区分"你的历史回复"和"其他 agent 的回复"

### 📊 优点

1. **统一逻辑** - 不需要为不同提供商维护不同的消息组装逻辑
2. **代码简化** - 移除 `continuous_own_messages` 的特殊处理
3. **兼容性好** - OpenAI 和 Claude 都支持这种格式
4. **与多智能体设计一致** - 扩展现有的历史合并逻辑
5. **避免消息顺序问题** - 不再有 assistant 开头的风险

### ⚠️ 不影响的功能

- **隔离模式**: 保持原有的 user/assistant 交替逻辑，不受影响
- 隔离模式下只有一个智能体，消息天然交替，无需修改

### 🧪 测试清单

- [ ] Claude API 带工具调用正常工作
- [ ] OpenAI API 正常工作
- [ ] 多智能体对话正常
- [ ] 隔离模式正常
- [ ] 工具调用历史正确显示在 system prompt 中
