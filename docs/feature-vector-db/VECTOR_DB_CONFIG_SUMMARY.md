# 向量数据库配置修复总结

## 完成的工作

### 1. 修复前后端字段名不一致
- **问题**: 前端使用 `vectorDBConfig`，后端期望 `vector_db_config`
- **解决**: 统一使用下划线命名 `vector_db_config`
- **影响**: 修复了向量数据库配置无法保存的问题

### 2. 添加内置数据库配置
- 新增 `builtin_vector_db_host` 配置（默认：localhost）
- 新增 `builtin_vector_db_port` 配置（默认：19530）
- 更新 `BuiltinVectorAdapter` 使用配置连接 Milvus

### 3. 前端响应式显示
- 内置数据库配置仅在启用内置数据库时显示
- 使用 `Form.Item` 的 `shouldUpdate` 实现动态显示/隐藏
- 添加 `text` 类型表单项支持

### 4. 用户体验优化
- 在"使用内置向量数据库"的 tooltip 中添加警告信息
- 提示用户不要轻易修改配置

## 修改的文件

### 后端
1. `backend/app/api/routes/settings.py` - 添加配置映射和默认值
2. `backend/app/services/vector_db_service.py` - 更新适配器实现
3. `backend/app/seed_data_system_settings.json` - 添加种子数据
4. `backend/test_vector_db_config.py` - 测试脚本

### 前端
1. `frontend/src/pages/settings/GeneralSettingsPage.js` - 修复字段名、添加响应式配置项

### 文档
1. `CHANGELOG.md` - 更新日志

## 配置说明

### 默认配置
```json
{
  "use_builtin_vector_db": true,
  "builtin_vector_db_host": "localhost",
  "builtin_vector_db_port": 19530,
  "vector_db_provider": "aliyun",
  "vector_db_config": {}
}
```

### 使用方式
1. 打开系统设置 → 向量数据库标签页
2. 启用"使用内置向量数据库"开关
3. 查看并修改（如需要）内置数据库地址和端口
4. 保存设置

## 测试验证

运行测试：
```bash
cd backend
python test_vector_db_config.py
```

预期输出：
- ✓ 默认配置正确: localhost:19530
- ✓ 自定义配置正确
- ✓ 所有字段名验证通过

## 技术要点

### 响应式表单项
```javascript
// 使用 shouldUpdate 实现响应式显示
<Form.Item
  noStyle
  shouldUpdate={(prevValues, currentValues) => 
    prevValues[item.dependsOn] !== currentValues[item.dependsOn]
  }
>
  {() => {
    const dependsOnValue = form.getFieldValue(item.dependsOn);
    if (dependsOnValue !== item.dependsValue) {
      return null;
    }
    return <div>{renderSettingItem(item, group)}</div>;
  }}
</Form.Item>
```

### 配置加载流程
1. 前端：用户修改配置
2. API：`POST /api/settings` 保存配置
3. 数据库：保存到 `system_settings` 表
4. 服务：`VectorDBService` 读取配置并初始化适配器

## 注意事项

1. 确保 Milvus 服务已启动并监听在配置的地址和端口
2. 建议保持默认配置（localhost:19530）
3. 生产环境可能需要配置独立的 Milvus 服务器

