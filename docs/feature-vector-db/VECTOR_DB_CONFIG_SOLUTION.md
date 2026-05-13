# TiDB向量数据库配置保存问题解决方案

## 问题描述

用户反映在向量数据库配置页面保存TiDB连接字符串后，页面刷新时配置会丢失。

## 问题分析

1. **前端问题**: 向量数据库配置只保存在前端状态中，没有调用后端API持久化
2. **后端缺失**: 缺少JSON类型配置的处理逻辑
3. **数据加载**: 页面加载时没有从后端恢复向量数据库配置

## 解决方案

### 1. 后端修改

#### 1.1 添加JSON类型支持 (backend/app/api/routes/settings.py)

```python
# 在settings_map中添加向量数据库配置
'vectorDBConfig': {'db_key': 'vector_db_config', 'config_key': 'VECTOR_DB_CONFIG', 'value_type': 'json'},

# 在默认值处理中添加
if "vectorDBConfig" not in settings_dict:
    settings_dict["vectorDBConfig"] = current_app.config.get("VECTOR_DB_CONFIG", {})

# 在值类型转换中添加JSON处理
elif value_type == 'json':
    # JSON类型：序列化为字符串存储到数据库
    import json
    db_value = json.dumps(value, ensure_ascii=False)
    # 保持原始对象存储到app.config
    config_value = value

# 在读取时添加JSON解析
elif setting.value_type == 'json':
    try:
        import json
        settings_dict[frontend_key] = json.loads(setting.value)
    except (ValueError, TypeError):
        settings_dict[frontend_key] = {}
```

#### 1.2 创建TiDB向量数据库API服务 (frontend/src/services/api/tidbVector.js)

提供完整的TiDB向量数据库API接口，包括：
- 配置验证
- 连接测试
- 向量操作测试
- 嵌入模型管理
- 向量表管理

### 2. 前端修改

#### 2.1 修复配置保存逻辑 (frontend/src/pages/settings/GeneralSettingsPage.js)

```javascript
// 修改handleVectorDBConfigSave函数
const handleVectorDBConfigSave = async () => {
  try {
    const values = await vectorDBConfigForm.validateFields();
    setVectorDBConfigLoading(true);

    const { provider, ...config } = values;
    const newConfig = {
      ...currentVectorDBConfig,
      [provider]: config
    };

    setCurrentVectorDBConfig(newConfig);

    // 保存配置到后端 - 关键修改
    await settingsAPI.updateSettings({
      vectorDBConfig: newConfig
    });

    message.success('向量数据库配置保存成功');
    setVectorDBConfigVisible(false);
  } catch (error) {
    console.error('保存向量数据库配置失败:', error);
    message.error('保存向量数据库配置失败');
  } finally {
    setVectorDBConfigLoading(false);
  }
};
```

#### 2.2 添加配置加载逻辑

```javascript
// 在fetchSettings函数中添加
// 加载向量数据库配置
if (data.vectorDBConfig) {
  setCurrentVectorDBConfig(data.vectorDBConfig);
}
```

#### 2.3 添加测试连接功能

```javascript
// 添加测试连接状态
const [testConnectionLoading, setTestConnectionLoading] = useState(false);

// 添加测试连接函数
const handleTestTiDBConnection = async () => {
  try {
    const currentProvider = form.getFieldValue('vectorDBProvider') || 'tidb';
    const currentConfig = currentVectorDBConfig[currentProvider] || {};
    
    if (!currentConfig.connectionString) {
      message.warning('请先配置TiDB连接字符串');
      return;
    }

    setTestConnectionLoading(true);
    
    const result = await tidbVectorAPI.testConnection(currentConfig.connectionString);
    
    if (result.success) {
      message.success(`连接测试成功！${result.message}`);
    } else {
      message.error(`连接测试失败：${result.message}`);
    }
  } catch (error) {
    console.error('测试TiDB连接失败:', error);
    message.error('连接测试失败，请检查网络和配置');
  } finally {
    setTestConnectionLoading(false);
  }
};
```

#### 2.4 添加测试连接按钮

```javascript
{/* 在向量数据库卡片底部添加测试连接按钮 */}
{!useBuiltinVectorDB && form.getFieldValue('vectorDBProvider') === 'tidb' && (
  <Button
    type="primary"
    icon={<ApiOutlined />}
    onClick={handleTestTiDBConnection}
    loading={testConnectionLoading}
    size="small"
    style={{
      width: '100%',
      borderRadius: '6px',
      height: '32px'
    }}
  >
    测试TiDB连接
  </Button>
)}
```

## 功能特性

### 1. 配置持久化
- ✅ 向量数据库配置保存到数据库
- ✅ 页面刷新后配置不丢失
- ✅ 支持多种向量数据库提供商配置

### 2. TiDB连接测试
- ✅ 一键测试TiDB连接
- ✅ 显示连接状态和错误信息
- ✅ 仅在选择TiDB时显示测试按钮

### 3. 用户体验
- ✅ 实时保存配置
- ✅ 友好的错误提示
- ✅ 加载状态指示
- ✅ 配置验证

## 使用方法

### 1. 配置TiDB向量数据库

1. 进入系统设置页面
2. 在"向量数据库"卡片中：
   - 关闭"使用内置向量数据库"
   - 选择"TiDB Cloud"作为提供商
3. 点击"配置向量数据库连接"按钮
4. 在弹出的对话框中输入TiDB连接字符串
5. 点击"确定"保存配置

### 2. 测试连接

1. 配置完成后，会显示"测试TiDB连接"按钮
2. 点击按钮测试连接
3. 查看测试结果和连接信息

### 3. 连接字符串格式

```
mysql://username:password@host:port/database
```

示例：
```
mysql://3WYw82L9THMvuY5.root:bDEm4mk2ygRD2cFH@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/test
```

## 技术实现

### 数据流程

1. **保存配置**: 前端 → settingsAPI.updateSettings → 后端settings路由 → SystemSetting模型 → 数据库
2. **加载配置**: 数据库 → SystemSetting模型 → 后端settings路由 → settingsAPI.getSettings → 前端状态
3. **测试连接**: 前端 → tidbVectorAPI.testConnection → 后端tidb_vector路由 → TiDB连接测试

### 数据格式

```json
{
  "vectorDBConfig": {
    "tidb": {
      "connectionString": "mysql://user:pass@host:port/db"
    },
    "aliyun": {
      "apiKey": "xxx",
      "endpoint": "https://xxx"
    }
  }
}
```

## 测试验证

### 1. 配置保存测试
- [x] 保存TiDB连接字符串
- [x] 页面刷新后配置保持
- [x] 切换提供商配置正确加载

### 2. 连接测试
- [x] 有效连接字符串测试成功
- [x] 无效连接字符串显示错误
- [x] 网络错误处理

### 3. 用户界面
- [x] 按钮状态正确显示
- [x] 加载状态指示
- [x] 错误消息友好

## 后续优化

1. **批量测试**: 支持测试多个向量数据库配置
2. **配置导入导出**: 支持配置的导入和导出
3. **连接池监控**: 显示连接池状态和性能指标
4. **自动重连**: 连接失败时自动重试机制

## 总结

通过以上修改，成功解决了TiDB向量数据库配置保存丢失的问题，并添加了便捷的连接测试功能。用户现在可以：

1. ✅ 持久化保存向量数据库配置
2. ✅ 一键测试TiDB连接状态
3. ✅ 享受更好的用户体验

所有修改都已完成并可以立即使用。
