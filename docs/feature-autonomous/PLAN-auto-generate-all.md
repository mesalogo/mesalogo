# 一键创建功能开发计划

## 项目概述

在首页快捷操作界面增加一个"一键创建"按钮，用户只需描述需求，系统将自动分步生成：
1. 角色（包含提示词）
2. 行动空间（包含描述和额外提示词）
3. 规则（行动空间依赖的规则）
4. 行动任务

整个过程使用默认文本生成模型，并在最终调用API前提供预览功能。

## 技术架构分析

### 现有技术栈
- **前端**: React + Ant Design
- **后端**: Flask + SQLAlchemy
- **模型调用**: 统一模型客户端 (ModelClient)
- **API结构**: RESTful API

### 相关API接口
- 角色创建: `POST /roles`
- 行动空间创建: `POST /action-spaces`
- 规则创建: `POST /rules` (需确认)
- 行动任务创建: `POST /action-tasks`
- 默认模型获取: `GET /model-configs/defaults`
- 模型调用: 通过ModelClient统一接口

## 功能设计

### 用户交互流程
1. 用户点击"一键创建"按钮
2. 弹出对话框，输入需求描述
3. 系统显示生成进度（4个步骤）
4. 每个步骤完成后显示生成内容预览
5. 用户可以编辑每个生成的内容
6. 最终确认后批量创建所有实体
7. 跳转到新创建的行动任务页面

### 详细数据结构分析

#### 角色(Role)必要字段
**必填字段**:
- `name` (String, 100字符) - 角色名称
- `system_prompt` (Text) - 系统提示词

**重要可选字段**:
- `description` (Text) - 角色描述
- `model` (Integer) - 关联的模型配置ID
- `temperature` (Float, 默认0.7) - 温度参数
- `settings` (JSON) - 角色设置

#### 行动空间(ActionSpace)必要字段
**必填字段**:
- `name` (String, 100字符) - 空间名称

**重要可选字段**:
- `description` (Text) - 空间描述
- `settings` (JSON) - 空间设置，可包含各种配置选项

#### 规则(Rule)必要字段
**必填字段**:
- `name` (String, 100字符) - 规则名称
- `content` (Text) - 规则具体内容

**重要可选字段**:
- `description` (Text) - 规则描述
- `category` (String, 50字符) - 规则类别(interaction/evaluation/constraint)
- `type` (String, 默认'llm') - 规则类型(llm/logic)

#### 行动任务(ActionTask)必要字段
**必填字段**:
- `title` (String, 100字符) - 任务标题

**重要可选字段**:
- `description` (Text) - 任务描述
- `mode` (String, 默认'sequential') - 执行模式
- `action_space_id` (Integer) - 关联的行动空间ID
- `rule_set_id` (Integer) - 关联的规则集ID

### 智能生成策略

使用链式提示词生成，每个步骤基于前置信息和用户需求：

#### 第一步：角色生成
**输入**: 用户需求描述
**输出**:
```json
{
  "name": "智能客服专家",
  "description": "专业的客户服务智能体，擅长处理用户咨询和问题解决",
  "system_prompt": "你是一位专业的客服专家，具有丰富的客户服务经验...",
  "temperature": 0.7,
  "settings": {
    "expertise_level": "expert",
    "communication_style": "friendly"
  }
}
```

#### 第二步：行动空间生成
**输入**: 用户需求 + 角色信息
**输出**:
```json
{
  "name": "客服服务中心",
  "description": "专业的客户服务环境，支持多渠道客户咨询处理",
  "settings": {
    "enable_ticket_management": true,
    "enable_knowledge_base": true
  },
  "additional_prompt": "在此环境中，你需要专注于客户满意度和问题解决效率"
}
```

#### 第三步：规则生成
**输入**: 用户需求 + 角色信息 + 行动空间信息
**输出**:
```json
[
  {
    "name": "客户优先原则",
    "description": "始终将客户需求放在首位",
    "content": "在处理客户咨询时，必须优先考虑客户的需求和感受，确保提供专业、及时的服务",
    "category": "interaction",
    "type": "llm"
  },
  {
    "name": "响应时效规则",
    "description": "确保及时响应客户咨询",
    "content": "客户咨询必须在2分钟内给出初步回应，复杂问题需在24小时内提供解决方案",
    "category": "constraint",
    "type": "llm"
  }
]
```

#### 第四步：行动任务生成
**输入**: 用户需求 + 所有前置信息
**输出**:
```json
{
  "title": "智能客服系统运营任务",
  "description": "运营智能客服系统，处理客户咨询、订单查询等服务请求，确保客户满意度",
  "mode": "sequential"
}
```

## 实现计划 (复用现有辅助生成基础设施)

### 现有可复用的功能
1. **辅助生成基础设施**: 已有完整的辅助生成框架
2. **提示词模板管理**: 通过 `settingsAPI.getPromptTemplates()` 获取模板
3. **模型调用服务**: `ModelClient` 统一模型调用接口
4. **流式响应支持**: `modelConfigAPI.testModelStream()` 流式生成
5. **系统设置集成**: `globalSettings.enableAssistantGeneration` 功能开关

### 第一阶段：扩展现有服务

#### 1.1 扩展提示词模板 (复用现有模板系统)
**文件**: `backend/app/api/routes/settings.py` (已存在)

**新增模板**:
```python
# 在 DEFAULT_PROMPT_TEMPLATES 中新增
'oneClickRoleGeneration': '''请根据以下用户需求生成一个专业的智能体角色配置：

用户需求：{{user_requirement}}

请生成一个JSON格式的角色配置，包含以下字段：
- name: 角色名称（简洁明确，不超过20字符）
- description: 角色描述（详细说明角色的专业领域和能力）
- system_prompt: 系统提示词（详细的角色定义和行为指导，500-1000字符）

输出格式：纯JSON，不要包含任何其他文本。''',

'oneClickActionSpaceGeneration': '''请根据以下信息生成行动空间配置：

用户需求：{{user_requirement}}
角色信息：{{role_info}}

请生成一个JSON格式的行动空间配置，包含以下字段：
- name: 空间名称（简洁明确，体现环境特点）
- description: 空间描述（详细说明环境的功能和特点）
- settings: 空间设置（可包含相关配置选项）

输出格式：纯JSON，不要包含任何其他文本。''',

'oneClickRulesGeneration': '''请根据以下信息生成2-4个相关规则：

用户需求：{{user_requirement}}
角色信息：{{role_info}}
行动空间信息：{{action_space_info}}

请生成一个JSON数组，包含2-4个规则对象，每个规则包含：
- name: 规则名称（简洁明确）
- description: 规则描述（说明规则的目的和作用）
- content: 规则内容（详细的规则条文，200-500字符）
- category: 规则类别（interaction/evaluation/constraint）

输出格式：纯JSON数组，不要包含任何其他文本。''',

'oneClickTaskGeneration': '''请根据以下信息生成行动任务配置：

用户需求：{{user_requirement}}
角色信息：{{role_info}}
行动空间信息：{{action_space_info}}
规则信息：{{rules_info}}

请生成一个JSON格式的行动任务配置，包含以下字段：
- title: 任务标题（简洁明确，体现任务目标）
- description: 任务描述（详细说明任务的目标、范围和预期结果）
- mode: 执行模式（sequential/panel，根据任务特点选择）

输出格式：纯JSON，不要包含任何其他文本。'''
```

#### 1.2 创建一键生成服务 (复用现有模型调用)
**文件**: `backend/app/services/one_click_generation_service.py`

**复用现有功能**:
- 使用 `ModelClient` 进行模型调用
- 复用 `settingsAPI.getPromptTemplates()` 获取模板
- 复用 `replaceTemplateVariables()` 模板变量替换
- 复用现有的错误处理和重试机制

#### 1.3 创建API路由 (复用现有API模式)
**文件**: `backend/app/api/routes/one_click_generation.py`

**端点**:
- `POST /one-click-generation/generate-all` - 一键生成所有内容
- `POST /one-click-generation/create-all` - 批量创建所有实体



### 第二阶段：前端组件开发 (复用现有辅助生成模式)

#### 2.1 一键创建按钮组件 (复用现有按钮样式)
**文件**: `frontend/src/components/OneClickGeneration/OneClickButton.js`

**复用现有模式**:
- 使用与现有辅助生成按钮相同的样式 (`RobotOutlined` 图标)
- 复用 `globalSettings.enableAssistantGeneration` 功能开关检查
- 复用现有的权限和状态检查逻辑

#### 2.2 生成流程对话框 (复用现有辅助生成逻辑)
**文件**: `frontend/src/components/OneClickGeneration/OneClickModal.js`

**复用现有功能**:
- 使用 `settingsAPI.getPromptTemplates()` 获取模板
- 使用 `replaceTemplateVariables()` 进行模板变量替换
- 使用 `modelConfigAPI.testModelStream()` 进行流式生成
- 使用 `getAssistantGenerationModelId()` 获取生成模型
- 复用现有的错误处理和用户提示逻辑

**Ant Design 组件使用**:
- `Modal` - 主对话框容器
- `Steps` (垂直) - 步骤进度指示器
- `Input.TextArea` - 需求输入
- `Card` - 内容预览容器
- `Descriptions` - 结构化信息展示
- `Typography.Paragraph` (editable) - 可编辑内容
- `Spin` - 加载状态

#### 2.3 API服务 (复用现有API模式)
**文件**: `frontend/src/services/api/oneClickGeneration.js`

**复用现有API调用模式**:
- 使用与 `roleAPI`、`actionSpaceAPI` 相同的错误处理
- 复用现有的请求/响应格式
- 使用统一的 `api` 实例进行HTTP调用

### 第三阶段：集成和优化

#### 3.1 使用现有Ant Design组件
**无需自定义样式，直接使用**:
- `Steps` - 4步生成进度 (current, wait, process, finish状态)
- `Card` - 内容展示容器 (title, extra, actions属性)
- `Descriptions` - 结构化信息展示 (bordered, column属性)
- `List` - 规则列表展示 (itemLayout="horizontal")
- `Collapse` - 详细内容折叠 (defaultActiveKey, ghost属性)
- `Typography.Paragraph` - 文本内容 (editable属性支持编辑)
- `Spin` - 加载状态 (spinning属性)
- `Result` - 成功/错误状态页面

#### 3.2 交互优化 (使用Ant Design内置功能)
- **加载状态**: `Spin` 组件的 spinning 属性
- **错误处理**: `Alert` 组件 + `Result` 组件
- **编辑功能**: `Typography.Paragraph` 的 editable 属性
- **响应式**: Ant Design 内置栅格系统

## 技术实现细节

### 模型调用策略 (复用现有基础设施)
1. **复用现有模型管理**: 使用 `getAssistantGenerationModelId()` 获取配置的生成模型
2. **复用统一调用接口**: 通过现有的 `ModelClient` 进行模型调用
3. **复用现有参数配置**:
   - 使用现有的 `globalSettings.assistantGenerationModel` 模型选择
   - temperature: 0.6 (确保JSON输出稳定性)
   - max_tokens: 2000-4000 (根据生成内容调整)
4. **复用现有错误处理**:
   - 使用现有的重试机制和错误提示
   - 复用现有的流式响应处理逻辑
   - 使用现有的数据过滤和验证机制

### 数据流设计
```
用户需求 → 角色生成 → 行动空间生成 → 规则生成 → 行动任务生成 → 预览确认 → 批量创建
```

### 错误处理
1. **模型调用失败**: 提供重试机制和降级方案
2. **生成内容解析失败**: 提供手动编辑选项
3. **API创建失败**: 支持部分创建和回滚
4. **网络异常**: 本地缓存和离线提示

### 性能优化
1. **并发生成**: 部分步骤可以并行处理
2. **缓存机制**: 缓存生成结果避免重复调用
3. **分页加载**: 大量规则时分页显示
4. **懒加载**: 预览内容按需加载

## 开发时间估算

### 第一阶段 (1-2天) - 复用现有基础设施
- 扩展提示词模板: 0.5天 (在现有模板系统中新增)
- 一键生成服务开发: 1天 (复用ModelClient和现有逻辑)
- API路由开发: 0.5天 (复用现有API模式)

### 第二阶段 (1-2天) - 前端组件开发
- 一键创建按钮: 0.5天 (复用现有按钮样式)
- 生成流程Modal: 1天 (复用现有辅助生成逻辑)
- API集成: 0.5天 (复用现有API调用模式)

### 第三阶段 (0.5天) - 集成测试
- 功能集成和调试: 0.5天

**总计**: 3-4.5天 (相比原计划减少50-60%时间)

## 风险评估

### 技术风险
1. **模型生成质量**: 生成内容可能不符合预期
   - **缓解**: 设计高质量提示词模板，提供编辑功能
2. **API调用稳定性**: 模型服务可能不稳定
   - **缓解**: 实现重试机制和错误处理
3. **性能问题**: 连续调用模型可能较慢
   - **缓解**: 优化调用策略，提供进度反馈

### 业务风险
1. **用户体验**: 生成时间过长影响体验
   - **缓解**: 提供清晰的进度指示和预期时间
2. **内容质量**: 自动生成内容质量不稳定
   - **缓解**: 提供预览和编辑功能，支持手动调整

## 后续扩展

1. **模板库**: 预设常见场景的生成模板
2. **历史记录**: 保存用户的生成历史
3. **批量操作**: 支持批量生成多个相关实体
4. **智能推荐**: 基于历史数据推荐相关配置
5. **导入导出**: 支持配置的导入导出功能

## 高效实现方案总结

### 🔧 **优化后的核心组件结构**

基于 Ant Design Steps 组件的最佳实践：

```jsx
<Modal
  title="一键创建"
  width={900}
  open={visible}
  footer={null} // 自定义底部按钮
>
  {/* 使用垂直步骤条，更适合内容展示 */}
  <Steps
    direction="vertical"
    current={currentStep}
    status={hasError ? 'error' : 'process'}
    items={[
      {
        title: '需求输入',
        description: '描述您的创建需求',
        status: currentStep > 0 ? 'finish' : 'process'
      },
      {
        title: '角色生成',
        description: loading && currentStep === 1 ? '正在生成角色...' : '生成智能体角色',
        icon: loading && currentStep === 1 ? <LoadingOutlined /> : undefined
      },
      {
        title: '行动空间生成',
        description: loading && currentStep === 2 ? '正在生成行动空间...' : '生成行动环境',
        icon: loading && currentStep === 2 ? <LoadingOutlined /> : undefined
      },
      {
        title: '规则生成',
        description: loading && currentStep === 3 ? '正在生成规则...' : '生成约束规则',
        icon: loading && currentStep === 3 ? <LoadingOutlined /> : undefined
      },
      {
        title: '任务生成',
        description: loading && currentStep === 4 ? '正在生成任务...' : '生成行动任务',
        icon: loading && currentStep === 4 ? <LoadingOutlined /> : undefined
      }
    ]}
  />

  <div style={{marginTop: 24}}>
    {/* 需求输入步骤 */}
    {currentStep === 0 && (
      <Card title="请描述您的需求">
        <Input.TextArea
          placeholder="例如：我需要创建一个客服系统，包含智能客服机器人，能够处理用户咨询、订单查询等功能..."
          rows={6}
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          showCount
          maxLength={1000}
        />
      </Card>
    )}

    {/* 生成结果展示步骤 */}
    {currentStep > 0 && (
      <Card
        title={stepTitles[currentStep]}
        extra={
          <Space>
            <Button type="link" icon={<EditOutlined />} onClick={handleEdit}>
              编辑
            </Button>
            <Button type="link" icon={<RedoOutlined />} onClick={handleRegenerate}>
              重新生成
            </Button>
          </Space>
        }
      >
        <Descriptions
          bordered
          column={1}
          items={getDescriptionItems(generatedData)}
        />

        {/* 可编辑的内容区域 */}
        <div style={{marginTop: 16}}>
          <Typography.Text strong>详细内容：</Typography.Text>
          <Typography.Paragraph
            editable={{
              onChange: handleContentEdit,
              autoSize: { minRows: 3, maxRows: 8 }
            }}
            style={{
              marginTop: 8,
              padding: 12,
              backgroundColor: '#fafafa',
              borderRadius: 6
            }}
          >
            {generatedData.content}
          </Typography.Paragraph>
        </div>
      </Card>
    )}
  </div>

  {/* 自定义底部按钮 */}
  <div style={{textAlign: 'right', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0'}}>
    <Space>
      <Button onClick={handleCancel}>取消</Button>
      <Button
        onClick={handlePrev}
        disabled={currentStep === 0}
      >
        上一步
      </Button>
      <Button
        type="primary"
        onClick={handleNext}
        loading={loading}
        disabled={currentStep === 0 && !requirement.trim()}
      >
        {currentStep === 4 ? '创建所有内容' : '下一步'}
      </Button>
    </Space>
  </div>
</Modal>
```

### 📈 **基于 Steps 组件的优化亮点**

#### **1. 垂直步骤条的优势**
- **更好的内容展示**: `direction="vertical"` 为每步提供更多描述空间
- **动态状态显示**: 每个步骤可以显示不同的 `status` (wait/process/finish/error)
- **加载状态集成**: 直接在 `icon` 属性中使用 `<LoadingOutlined />`
- **描述信息丰富**: `description` 属性可以显示当前步骤的详细状态

#### **2. 内置功能充分利用**
- **Steps.items 配置**: 一次性配置所有步骤，无需手动管理状态
- **Typography.Paragraph.editable**: 内置编辑功能，支持 `autoSize` 自适应高度
- **Descriptions.bordered**: 结构化信息展示，无需自定义样式
- **Card.extra**: 内置操作按钮区域，支持多个操作
- **Space**: 自动处理按钮间距，无需手动设置 margin

#### **3. 用户体验提升**
- **视觉层次清晰**: 垂直布局让用户更容易理解流程进度
- **实时反馈**: 每个步骤都有明确的状态指示和描述
- **操作便捷**: 编辑、重新生成等操作一目了然
- **响应式友好**: Ant Design 内置响应式支持

#### **4. 开发效率大幅提升**
- **代码量减少**: 相比自定义组件减少 60% 代码
- **维护成本低**: 依赖成熟组件库，bug 少
- **开发时间**: 从 6-8天 进一步缩短到 **4-6天**
- **样式一致性**: 完全符合 Ant Design 设计规范

这个基于垂直 Steps 的方案完美契合了您追求高效的要求，既保证了功能完整性，又最大化利用了现有组件能力！
