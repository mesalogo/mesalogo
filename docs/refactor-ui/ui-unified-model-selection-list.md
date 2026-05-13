# UI统一：模型选择下拉列表改进

## 问题描述

1. 分段设置（ChunkSettings）中的LLM分段方法的模型选择下拉列表，在选择"默认文本生成模型"选项时，不显示具体的模型名称，而基本设置（AssistantSettings）中的辅助生成模型下拉列表可以正常显示。

2. 基本设置中的辅助生成模型列表错误地显示了所有模型，而不是仅显示文本生成模型。

## 原因分析

### 基本设置（正常显示）
- 使用 `useGeneralSettings` Hook，通过 `modelConfigAPI.getDefaults()` 获取完整的默认模型信息
- 直接从 `defaultModels.text_model` 对象中获取模型名称
- 数据结构清晰，包含完整的模型信息（name, provider, model_id等）

### 分段设置（显示异常）
- 只调用 `modelConfigAPI.getAll()`，通过 `is_default_text` 字段查找默认模型
- 使用 IIFE 函数动态生成 label，增加了复杂性
- 在 `optionRender` 中又尝试显示模型名称，造成重复逻辑

## 解决方案

### 1. 数据获取优化
```javascript
// 原代码：只获取模型列表
const configs = await modelConfigAPI.getAll();
const defaultText = configs.find(model => model.is_default_text);

// 修改后：同时获取模型列表和默认模型配置
const [configs, defaults] = await Promise.all([
  modelConfigAPI.getAll(),
  modelConfigAPI.getDefaults()
]);

// 使用专门的默认模型信息
if (defaults?.text_model) {
  setDefaultTextModel(defaults.text_model.id);
  setDefaultTextModelInfo(defaults.text_model);
}
```

### 2. 状态管理优化
```javascript
// 新增状态存储完整的默认模型信息
const [defaultTextModelInfo, setDefaultTextModelInfo] = useState(null);
```

### 3. 选项配置简化
```javascript
// 原代码：使用 IIFE 函数动态生成
label: (() => {
  const defaultModel = textModels.find(m => m.id === defaultTextModel);
  return `默认文本生成模型${defaultModel ? ` (${defaultModel.name} - ${defaultModel.provider})` : ''}`;
})()

// 修改后：直接使用状态中的模型信息
label: `默认文本生成模型${defaultTextModelInfo ? ` (${defaultTextModelInfo.name})` : ''}`
```

### 4. 渲染逻辑统一
```javascript
// optionRender 中不再显示重复的模型名称
if (option.data.isDefault) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'bold' }}>默认文本生成模型</span>
        <Tag color="blue" size="small">默认</Tag>
      </div>
      {option.data.model && (
        <div style={{ fontSize: '12px', color: '#666' }}>
          {option.data.model.provider} - {option.data.model.model_id}
        </div>
      )}
    </div>
  );
}
```

## 代码变更文件

- `/frontend/src/pages/knowledgebase/components/ChunkSettings.js`
  - 新增 `defaultTextModelInfo` 状态
  - 修改 `loadModelConfigs` 函数，使用 `getDefaults()` API
  - 简化下拉列表选项配置
  - 统一 `optionRender` 渲染逻辑

## 最佳实践建议

1. **统一数据获取方式**：推荐使用 `modelConfigAPI.getDefaults()` 获取默认模型信息，而不是从列表中查找
2. **避免动态计算**：选项的 label 应该基于状态直接生成，避免使用 IIFE 或复杂的计算逻辑
3. **保持渲染一致性**：选项的显示名称和下拉框渲染应该保持一致，避免重复显示信息
4. **代码复用**：可以考虑将模型选择下拉列表抽取为公共组件，统一管理模型选择逻辑

## 效果对比

### 修改前
- 默认模型选项只显示"默认文本生成模型"，没有具体模型名称
- 选中后下拉框显示不完整

### 修改后
- 默认模型选项显示"默认文本生成模型 (具体模型名称)"
- 选中后下拉框正确显示完整信息
- 与基本设置页面的辅助生成模型选择保持一致的用户体验
