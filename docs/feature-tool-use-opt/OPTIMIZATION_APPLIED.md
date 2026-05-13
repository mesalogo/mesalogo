# 工具调用优化 - 已应用修改

## 修改摘要

**文件:** `backend/app/services/conversation/stream_handler.py`  
**函数:** `call_llm_with_tool_results`  
**修改时间:** 2025-11-25  

## 核心优化

### 1. 最小上下文策略

**修改前:**
```python
updated_messages = original_messages.copy()  # 复制所有历史消息
```

**修改后:**
```python
# 只保留:
# 1. 系统提示词
# 2. 最近2轮对话(4条消息)
# 3. 本轮工具调用+结果
minimal_messages = [system_msg] + recent_conversation + [tool_calls, tool_results]
```

### 2. 工具结果压缩

**修改前:**
```python
result_content = tool_result.get("result", "")  # 直接使用原始结果
```

**修改后:**
```python
# 超过2000字符自动压缩:
if len(result_content) > 2000:
    # JSON: 只保留关键字段
    # 文本: 截断并标注原始长度
    result_content = compress(result_content)
```

### 3. 详细日志记录

```python
logger.info(f"[工具调用优化] 原始消息: {original_msg_count}条 -> 优化后: {minimal_msg_count}条")
logger.info(f"[工具结果压缩] 工具:{tool_name}, 原始:{original_length}字符 -> 压缩后:{compressed_length}字符")
```

## 预期效果

### Token节省

| 场景 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| 10轮对话 + 1次工具调用 | 6,000 tokens | 3,000 tokens | 50% |
| 10轮对话 + 5次工具调用 | 38,000 tokens | 8,000 tokens | **79%** |
| 10轮对话 + 10次工具调用 | 76,000 tokens | 15,000 tokens | **80%** |

### 响应时间

- 每次工具调用节省: 1-2秒
- 5次连续调用总节省: 5-10秒

### 成本

- 工具密集场景: 节省70-80%成本

## 测试验证

### 测试场景

1. **单次工具调用**
   - 10轮对话历史
   - 调用1个工具
   - 验证消息数量减少

2. **连续多次工具调用**
   - 10轮对话历史
   - 连续调用5次工具
   - 验证累积优化效果

3. **大型工具结果**
   - 工具返回5000字符JSON
   - 验证自动压缩
   - 验证关键字段保留

### 验证步骤

1. **启用调试日志**
   ```python
   # config.py
   DEBUG_LLM_RESPONSE = True
   ```

2. **观察日志输出**
   ```
   [工具调用优化] 原始消息: 23条 -> 优化后: 7条 (减少16条)
   [工具结果压缩] 工具:query_knowledge, 原始:5234字符 -> 压缩后:2000字符
   ```

3. **对比API调用**
   - 查看实际发送给LLM的消息数量
   - 计算token使用量
   - 测量响应时间

### 日志关键字

搜索以下关键字验证优化效果:
- `[工具调用优化]` - 消息数量优化
- `[工具结果压缩]` - 结果压缩日志
- `优化后的消息历史` - 详细消息内容

## 配置选项

虽然当前实现硬编码了配置值,但可以轻松改为系统设置:

```python
# 可配置项
recent_count = 2  # 保留最近N轮对话
max_result_length = 2000  # 工具结果最大长度
```

**未来扩展:** 可以在 `seed_data_system_settings.json` 中添加:
```json
{
  "key": "tool_call_recent_messages",
  "value": "2",
  "value_type": "number",
  "description": "工具调用时保留的最近对话轮数"
}
```

## 注意事项

### 1. 上下文连贯性

**风险:** 只保留2轮对话可能丢失早期重要信息

**缓解措施:**
- 系统提示词包含角色定义和能力
- 2轮对话通常足够完成大多数工具调用任务
- 如果需要更多上下文,可以调整 `recent_count`

### 2. JSON压缩

**保留字段:** `status`, `result`, `data`, `summary`, `error`, `message`

**测试建议:**
- 验证常用工具的结果格式
- 确保关键字段被保留
- 必要时添加更多保留字段

### 3. 文本截断

**处理方式:** 直接截断 + 添加说明

**改进空间:**
- 可以使用LLM进行智能摘要
- 可以提取关键句子而非简单截断

## 监控指标

建议添加以下监控:

```python
# 性能指标
metrics = {
    'tool_call_context_reduction': '上下文减少比例',
    'tool_result_compression_ratio': '工具结果压缩比',
    'avg_response_time_improvement': '平均响应时间改进',
    'token_cost_savings': 'Token成本节省'
}
```

## 回滚方案

如果出现问题,可以快速回滚:

```python
# 恢复原始实现
def call_llm_with_tool_results(...):
    # 临时禁用优化
    use_optimization = False
    
    if use_optimization:
        minimal_messages = build_minimal_context(...)
    else:
        minimal_messages = original_messages.copy()  # 回滚到原始逻辑
```

## 相关文档

- [完整优化方案](./PLAN.md)
- [性能基准测试](./BENCHMARK.md) (待创建)
- [配置指南](./CONFIG.md) (待创建)

---

**状态:** ✅ 已应用  
**验证:** 🔄 待测试  
**下一步:** 
1. 在开发环境测试
2. 收集性能数据
3. 验证功能正确性
4. 逐步推广到生产环境
