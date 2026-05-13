# 消息处理设置 UI 改进方案

## 目标

将消息处理相关的系统设置集中到一个独立 Tab，并增加实时预览功能，让用户直观理解各参数的作用。

## 当前状态

- ✅ 已实现：消息处理设置集中到独立 Tab `MessageProcessingSettings`
- ✅ 已实现：左右分栏布局（预览区 + 参数设置）
- ✅ 已实现：模式切换、参数生效范围提示、Token 估算
- ❌ 已移除：原 `ConversationSettings.tsx` Tab（功能合并）

## 设计方案

### 1. 布局结构

```
┌─────────────────────────────────────────────────────────────────────────┐
│  消息处理设置                                                            │
├─────────────────────────────────┬───────────────────────────────────────┤
│                                 │                                       │
│  📋 实时预览                     │  ⚙️ 参数设置                          │
│  ┌───────────────────────────┐  │                                       │
│  │ 模式: [多Agent ▼]         │  │  ── 历史消息 ──                       │
│  ├───────────────────────────┤  │  历史消息长度    [30]                 │
│  │ [system]                  │  │  ☑ 自动总结上下文                     │
│  │ 你是法律顾问...           │  │  ☑ 自主任务自动总结                   │
│  │                           │  │                                       │
│  │ ## 对话历史 (3/30条)      │  │  ── 工具调用 ──                       │
│  │ ┌─────────────────────┐   │  │  工具结果最大长度  [2000]             │
│  │ │ User: 帮我查看文件   │   │  │  工具上下文轮数    [5] (仅隔离模式)   │
│  │ │ Agent A: 好的...     │   │  │  ☑ 拆分工具调用 (仅隔离模式)         │
│  │ │  [Called tool: xxx]  │   │  │  ☐ 压缩工具定义                      │
│  │ │  [Result: 文件列表...│   │  │                                       │
│  │ │   ...(truncated)]    │   │  │  ── 其他 ──                          │
│  │ │ User: 读取doc1       │   │  │  ☐ 包含思考内容                      │
│  │ └─────────────────────┘   │  │  ☑ 存储错误消息                       │
│  │                           │  │  ☑ 流式输出                           │
│  │ [user] 读取doc1           │  │                                       │
│  └───────────────────────────┘  │                                       │
│                                 │                                       │
│  📊 Token 估算: ~2,500          │  [保存] [重置]                        │
│  💡 提示: 当前模式下xxx不生效    │                                       │
│                                 │                                       │
└─────────────────────────────────┴───────────────────────────────────────┘
```

### 2. 预览区功能

#### 2.1 模式切换
- 下拉框切换「多Agent模式」和「隔离模式」
- 切换后预览区显示不同的消息结构
- 右侧参数根据模式显示是否生效

#### 2.2 多Agent模式预览
```
[system] 你是法律顾问...

## 对话历史
**User said:** 帮我查看文件
**Agent A [法律顾问] said:**
  好的，我来查看。
  <!--Tool Call: list_directory-->
  <!--Result: [FILE] doc1.md, doc2.md...(truncated)-->  ← tool_result_max_length 截断
  文件列表如上。
**User said:** 读取doc1

[user] 读取doc1
```

#### 2.3 隔离模式预览
```
[system] 你是法律顾问...
[user] 帮我查看文件
[assistant] 好的，我来查看。
  tool_calls: [{name: "list_directory", ...}]
[tool] [FILE] doc1.md, doc2.md
[assistant] 文件列表如上。
[user] 读取doc1
```

### 3. 参数分组

| 分组 | 参数 | 说明 |
|------|------|------|
| **历史消息** | `max_conversation_history_length` | 历史消息条数 |
| | `auto_summarize_context` | 自动总结上下文 |
| | `auto_summarize_context_autonomous` | 自主任务自动总结 |
| **工具调用** | `tool_result_max_length` | 工具结果截断长度 |
| | `tool_call_context_rounds` | 工具上下文轮数 |
| | `split_tool_calls_in_history` | 拆分工具调用 (仅隔离模式) |
| | `compress_tool_definitions` | 压缩工具定义 |
| **其他** | `include_thinking_content_in_context` | 包含思考内容 |
| | `store_llm_error_messages` | 存储错误消息 |
| | `streaming_enabled` | 流式输出 |

### 4. 交互效果

| 参数变化 | 预览区响应 |
|----------|-----------|
| 调整历史消息长度 | 显示/隐藏历史消息，标注 (N/M条) |
| 调整工具结果长度 | 工具结果实时截断，显示 `...(truncated)` |
| 切换压缩工具定义 | 显示工具定义压缩前后对比 |
| 切换模式 | 整体消息结构变化 |
| 参数不生效时 | 参数项显示灰色 + 提示标签 |

### 5. Token 估算

预览区底部显示当前配置下的 Token 估算：
- 基于静态示例数据计算
- 分项显示：system prompt / 历史消息 / 工具定义
- 调整参数时实时更新

## 实现步骤

### Phase 1: 基础结构 ✅
1. 创建新组件 `MessageProcessingSettings.tsx`
2. 实现左右分栏布局
3. 迁移现有参数设置到右侧

### Phase 2: 静态预览 ✅
4. 创建静态示例数据 `mockData.ts`
5. 实现预览区组件 `MessagePreview.tsx`
6. 根据参数渲染预览内容

### Phase 3: 交互效果 ✅
7. 实现模式切换
8. 实现参数变化时的预览更新
9. 实现 Token 估算显示

### Phase 4: 清理 ✅
10. 添加参数生效范围提示
11. 移除重复的 ConversationSettings Tab
12. 同步后端代码默认值

## 文件结构

```
frontend/src/pages/settings/GeneralSettingsPage/
├── tabs/
│   └── MessageProcessingSettings/
│       ├── index.tsx              # 主组件
│       ├── MessagePreview.tsx     # 预览区组件
│       ├── SettingsPanel.tsx      # 参数设置面板
│       └── mockData.ts            # 静态示例数据 + Token估算
```

## 静态示例数据

```typescript
// mockData.ts
export const mockConversation = {
  systemPrompt: "你是一位专业的法律顾问，擅长合同审查和法律咨询...",
  messages: [
    { role: "user", content: "帮我查看一下工作目录的文件" },
    { 
      role: "agent", 
      agentName: "法律顾问",
      content: "好的，我来查看当前工作目录的文件列表。",
      toolCalls: [{
        name: "list_directory",
        arguments: { path: "/workspace" },
        result: "[FILE] contract_v1.docx\n[FILE] contract_v2.docx\n[FILE] legal_opinion.pdf\n[DIR] attachments\n[FILE] meeting_notes.md\n[FILE] client_requirements.txt\n[FILE] draft_agreement.docx\n[FILE] revision_history.xlsx"
      }],
      contentAfterTool: "工作目录中有以下文件：\n- 2个合同文件 (contract_v1.docx, contract_v2.docx)\n- 1个法律意见书 (legal_opinion.pdf)\n- 1个附件目录\n- 其他辅助文件\n\n请问您需要我查看哪个文件？"
    },
    { role: "user", content: "读取 contract_v1.docx 的内容" },
    {
      role: "agent",
      agentName: "法律顾问", 
      content: "好的，我来读取合同文件。",
      toolCalls: [{
        name: "read_file",
        arguments: { path: "/workspace/contract_v1.docx" },
        result: "# 合伙人协议\n\n## 第一条 总则\n\n本协议由以下各方签订，旨在明确合伙经营的基本原则和各方权利义务...\n\n## 第二条 合伙人信息\n\n甲方：张三，身份证号：xxx\n乙方：李四，身份证号：xxx\n\n## 第三条 出资方式与比例\n\n甲方出资人民币100万元，占股60%\n乙方出资人民币50万元，占股40%\n\n## 第四条 利润分配\n\n按照出资比例分配利润，每季度结算一次..."
      }],
      contentAfterTool: "这是一份合伙人协议，主要内容包括：\n1. 合伙人为张三和李四\n2. 出资比例为 60:40\n3. 利润按出资比例分配\n\n需要我对合同条款进行详细分析吗？"
    },
    { role: "user", content: "分析一下这份合同有什么风险点" }
  ]
};

export const mockToolDefinitions = [
  {
    name: "list_directory",
    description: "列出指定目录下的所有文件和子目录，返回文件名、类型和大小信息",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要列出的目录路径，支持相对路径和绝对路径"
        },
        recursive: {
          type: "boolean",
          description: "是否递归列出子目录内容",
          default: false
        }
      },
      required: ["path"]
    }
  },
  {
    name: "read_file",
    description: "读取指定路径的文件内容，支持文本文件和二进制文件的读取操作",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要读取的文件的完整路径，支持相对路径和绝对路径"
        },
        encoding: {
          type: "string",
          description: "文件编码格式，默认为utf-8",
          default: "utf-8"
        }
      },
      required: ["path"]
    }
  }
];
```

## 预期效果

1. **直观理解** - 用户可以直接看到参数变化对消息结构的影响
2. **模式对比** - 清晰展示多Agent模式和隔离模式的差异
3. **参数生效范围** - 明确标注哪些参数在哪种模式下生效
4. **Token 感知** - 帮助用户理解配置对 Token 消耗的影响
5. **推荐配置** - 提供不同场景的推荐配置快捷选项
