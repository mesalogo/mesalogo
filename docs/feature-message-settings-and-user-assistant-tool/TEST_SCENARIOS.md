# 多智能体消息分组 - 测试场景

## 核心逻辑

### 识别"连续消息" vs "插入式消息"

**从后往前查找**：
- 从最新的消息开始倒序遍历
- 如果是当前agent的消息且连续 → 归为"连续消息"（作为assistant角色）
- 遇到其他agent或user消息 → 停止，前面的作为"历史"（放入system prompt）

---

## 测试场景

### 场景1: agent-C首次发言（无历史）
```
对话流程: A → B → (C要发言)

C看到的消息:
system: [历史]
  User: q1
  Agent-A: r1
  User: q2
  Agent-B: r2
user: current question

✅ 预期: C没有自己的历史消息
```

### 场景2: agent-C插入式发言后再次发言（ACB → C）
```
对话流程: A → C → B → (C要发言)

C看到的消息:
system: [历史]
  User: q1
  Agent-A: r1
  User: q2
  Agent-C: my previous response  ← C之前的消息在历史中
  User: q3
  Agent-B: r2
user: current question

✅ 预期: C之前的消息在system history中
```

### 场景3: agent-C连续发言（ABCCC → C）
```
对话流程: A → B → C → C → C → (C要发言)

C看到的消息:
system: [历史]
  User: q1
  Agent-A: r1
  User: q2
  Agent-B: r2
assistant: C's response 1  ← C的连续消息
assistant: C's response 2
assistant: C's response 3
user: current question

✅ 预期: C的最后3条连续消息作为assistant角色
```

### 场景4: agent-C混合模式（ACBCC → C）
```
对话流程: A → C → B → C → C → (C要发言)

C看到的消息:
system: [历史]
  User: q1
  Agent-A: r1
  User: q2
  Agent-C: first response  ← 插入式，在历史中
  User: q3
  Agent-B: r2
assistant: C's response 2  ← 连续消息开始
assistant: C's response 3
user: current question

✅ 预期: 插入式的在历史，连续的作为assistant
```

### 场景5: agent-C在user消息后连续发言（ABUC → C）
```
对话流程: A → B → User → C → (C要发言)

C看到的消息:
system: [历史]
  User: q1
  Agent-A: r1
  User: q2
  Agent-B: r2
  User: q3
assistant: C's response 1  ← user消息后的C消息仍是连续
user: current question

✅ 预期: user消息会中断连续性，user后的C消息作为assistant
```

### 场景6: 只有agent-C自己的消息（CCC → C）
```
对话流程: C → C → C → (C要发言)

C看到的消息:
system: [你的角色定义]
assistant: C's response 1
assistant: C's response 2
assistant: C's response 3
user: current question

✅ 预期: 所有C的消息都是连续的
```

### 场景7: agent-C插入在最前面（CAB → C）
```
对话流程: C → A → B → (C要发言)

C看到的消息:
system: [历史]
  User: q1
  Agent-C: first response  ← 插入式
  User: q2
  Agent-A: r1
  User: q3
  Agent-B: r2
user: current question

✅ 预期: C的第一条消息在历史中
```

---

## 代码逻辑说明

### 连续消息识别算法

```python
# 从后往前遍历
for i in range(len(temp_messages) - 1, -1, -1):
    msg = temp_messages[i]
    
    if msg是当前agent的消息:
        continuous_own_messages.insert(0, msg)  # 添加到连续消息
    elif msg是其他agent的消息 or msg是user消息:
        break  # 停止，前面的都是历史
```

### 关键点

1. **倒序查找**: 从最新的消息开始
2. **遇到中断就停**: 其他agent或user消息都会中断连续性
3. **插入式识别**: 被中断的own messages会包含在历史中

---

## 测试验证清单

### 单元测试
- [ ] 场景1: 首次发言
- [ ] 场景2: 插入式发言（ACB→C）
- [ ] 场景3: 连续发言（ABCCC→C）
- [ ] 场景4: 混合模式（ACBCC→C）
- [ ] 场景5: user消息中断（ABUC→C）
- [ ] 场景6: 纯连续（CCC→C）
- [ ] 场景7: 插入在最前（CAB→C）

### 集成测试
- [ ] 真实3-agent对话测试
- [ ] 验证system prompt中的历史格式
- [ ] 验证assistant消息的顺序
- [ ] 验证日志输出的准确性

### 边界情况
- [ ] 只有1条own消息
- [ ] 历史消息为空
- [ ] 所有消息都是own消息
- [ ] 隔离模式仍然正常工作

---

## 预期日志输出

### 场景3示例（ABCCC→C）
```
[多Agent模式] 准备对话历史上下文，target_agent_id=3
[多Agent模式] 识别出 3 条连续own消息，2 条历史消息
[多Agent模式] 格式化了对话历史，共 2 条消息
[System Prompt] 添加了对话历史上下文，长度: xxx
[多Agent模式] 只添加当前agent的连续消息作为assistant
[多Agent模式] 添加了 3 条连续assistant消息
```

### 场景4示例（ACBCC→C）
```
[多Agent模式] 准备对话历史上下文，target_agent_id=3
[多Agent模式] 识别出 2 条连续own消息，3 条历史消息  <- 包括插入式的C
[多Agent模式] 格式化了对话历史，共 3 条消息
[System Prompt] 添加了对话历史上下文，长度: xxx
[多Agent模式] 只添加当前agent的连续消息作为assistant
[多Agent模式] 添加了 2 条连续assistant消息
```

---

## 关键改进总结

### Before（旧逻辑）
- 所有own消息都作为assistant角色
- 或者所有own消息都在system history中
- 无法区分连续和插入式

### After（新逻辑）
✅ **连续消息** → assistant角色（LLM理解为"我刚说的"）
✅ **插入式消息** → system history（LLM理解为"我之前参与过"）
✅ **完整对话流程** → 包含所有user和agent消息
✅ **时间顺序保持** → 按实际对话顺序展示
