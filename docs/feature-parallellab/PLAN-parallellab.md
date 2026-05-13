# 并行实验室 PRD (Product Requirements Document)

## 1. 完整用户故事

### 场景
用户有一个"客服培训"行动空间，包含 3 个角色（客户、客服、主管），有一个变量 `response_temperature`（响应温度），用户想找到最佳的温度值使得 `customer_satisfaction`（客户满意度）最高。

---

### Step 1: 进入并行实验室

**用户操作**: 点击侧边栏"并行实验室"

**前端**:
```
GET /api/parallel-experiments?page=1&limit=20
```

**后端**:
```python
# 返回实验列表（包含模板和用户实验）
[
  {
    "id": "exp-tpl-001",
    "name": "社交网络涌现实验",
    "description": "探索不同社交参数下的群体行为涌现",
    "is_template": true,
    "status": "template",
    "source_action_space_name": "社交模拟场景",
    "total_runs": 0,
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "exp-tpl-002",
    "name": "客服满意度优化实验",
    "description": "寻找最佳 temperature 使客户满意度最高",
    "is_template": true,
    "status": "template",
    "source_action_space_name": "客服培训",
    "total_runs": 0,
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "exp-001",
    "name": "温度优化实验 #1",
    "description": "基于客服培训场景的参数扫描",
    "is_template": false,
    "status": "completed",
    "source_action_space_name": "客服培训",
    "total_runs": 4,
    "completed_runs": 4,
    "created_at": "2024-01-15T10:00:00Z"
  }
]
```

**界面**: 
```
┌─────────────────────────────────────────────────────────────┐
│  并行实验室                                    [+ 创建实验]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏷️模板  社交网络涌现实验                   [复制]   │   │
│  │ 探索不同社交参数下的群体行为涌现                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏷️模板  客服满意度优化实验                 [复制]   │   │
│  │ 寻找最佳 temperature 使客户满意度最高               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 温度优化实验 #1                  已完成 4/4  [复制]  │   │
│  │ 基于客服培训任务                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**操作说明**：
- 模板实验带有"🏷️模板"标签，由系统预置（seed_data）
- 所有实验都可以点击"复制"创建副本
- 模板实验不能直接运行，需先复制

---

### Step 2: 创建实验 - 选择行动空间

**用户操作**: 点击"创建实验"按钮

**前端**:
```
GET /api/action-spaces
```

**后端**:
```python
# 返回行动空间列表（场景模板）
[
  {
    "id": "space-001",
    "name": "客服培训",
    "description": "客服场景模拟训练",
    "roles": [
      {"id": "role-1", "name": "客户"},
      {"id": "role-2", "name": "客服"},
      {"id": "role-3", "name": "主管"}
    ],
    "shared_variables": [
      {"name": "response_temperature", "value": 0.7, "type": "number"},
      {"name": "customer_satisfaction", "value": 0, "type": "number"},
      {"name": "response_count", "value": 0, "type": "number"}
    ]
  }
]
```

**界面**: 显示行动空间选择下拉框

**用户操作**: 选择"客服培训"

---

### Step 3: 配置参数扫描

**界面**: 显示"客服培训"的所有变量，用户可以选择哪些变量要扫描

**用户操作**: 
1. 勾选 `response_temperature` 作为扫描变量
2. 选择扫描方式：枚举值
3. 输入值：`[0.3, 0.5, 0.7, 0.9]`

**前端状态**:
```javascript
{
  source_action_space_id: "space-001",
  variables: {
    "response_temperature": {
      type: "enumerated",
      values: [0.3, 0.5, 0.7, 0.9]
    }
  }
}
```

---

### Step 4: 配置目标变量和停止条件

**界面**: 显示可选的目标变量（输出变量）

**用户操作**:
1. 选择目标变量：`customer_satisfaction`
2. 选择优化方向：最大化
3. （可选）设置提前停止条件：`customer_satisfaction > 0.9`

**前端状态**:
```javascript
{
  // ... 之前的配置
  objectives: [{
    variable: "customer_satisfaction",
    type: "maximize"
  }],
  stop_conditions: [{
    expression: "customer_satisfaction > 0.9"
  }]
}
```

---

### Step 5: 配置任务执行方式

**界面**: 选择自主任务的执行方式

**用户操作**:
1. 选择任务类型：`discussion`（讨论模式）
2. 设置轮数：`3` 轮
3. 设置主题：`处理客户投诉`

**前端状态**:
```javascript
{
  // ... 之前的配置
  task_config: {
    type: "discussion",
    rounds: 3,
    topic: "处理客户投诉"
  }
}
```

---

### Step 6: 启动实验

**用户操作**: 点击"启动实验"按钮

**前端**:
```
POST /api/parallel-experiments
{
  "name": "温度优化实验",
  "source_action_space_id": "space-001",
  "variables": {
    "response_temperature": {
      "type": "enumerated",
      "values": [0.3, 0.5, 0.7, 0.9]
    }
  },
  "objectives": [{
    "variable": "customer_satisfaction",
    "type": "maximize"
  }],
  "stop_conditions": [{
    "expression": "customer_satisfaction > 0.9"
  }],
  "task_config": {
    "type": "discussion",
    "rounds": 3,
    "topic": "处理客户投诉"
  }
}
```

**后端处理流程**:
```python
def create_experiment(config):
    # 1. 创建实验记录
    experiment = ParallelExperiment(
        name=config['name'],
        source_action_space_id=config['source_action_space_id'],
        config=config,
        status='created'
    )
    db.session.add(experiment)
    
    # 2. 生成参数组合
    combinations = [
        {"response_temperature": 0.3},
        {"response_temperature": 0.5},
        {"response_temperature": 0.7},
        {"response_temperature": 0.9}
    ]
    
    # 3. 从 ActionSpace 创建 ActionTask 克隆
    cloned_ids = []
    for i, params in enumerate(combinations):
        # 从 ActionSpace 创建 ActionTask
        cloned_task = create_action_task_from_space(
            action_space_id="space-001",
            params=params,
            name_suffix=f"实验{experiment.id[:8]}-Run{i+1}"
        )
        cloned_ids.append(cloned_task.id)
        
        # create_action_task_from_space 内部:
        # - 从 ActionSpace 创建 ActionTask (is_experiment_clone=True)
        # - 从 Role 创建 Agent
        # - 复制 SharedVariable → EnvironmentVariable (应用 params 中的值)
        # - 创建默认 Conversation
    
    experiment.cloned_action_task_ids = cloned_ids
    experiment.total_runs = len(cloned_ids)
    experiment.status = 'running'
    db.session.commit()
    
    # 4. 启动每个克隆任务的自主任务
    for cloned_id in cloned_ids:
        conversation = get_default_conversation(cloned_id)
        start_task(
            task_id=cloned_id,
            conversation_id=conversation.id,
            task_type='discussion',
            config={
                'rounds': 3,
                'topic': '处理客户投诉',
                'stop_conditions': config['stop_conditions']
            }
        )
        # start_task 会创建 AutonomousTask 并由 TaskScheduler 执行
    
    return experiment.id
```

**后端返回**:
```json
{
  "id": "exp-002",
  "status": "running",
  "total_runs": 4,
  "message": "实验已启动，正在并行执行 4 个任务"
}
```

**前端**: 跳转到实验监控页面

---

### Step 7: 监控实验进度

**前端**: 轮询状态（每 5-10 秒）
```
GET /api/parallel-experiments/exp-002/status
```

**后端状态查询**:
```python
def get_experiment_status(experiment_id):
    experiment = ParallelExperiment.query.get(experiment_id)
    
    runs = []
    for action_task_id in experiment.cloned_action_task_ids:
        action_task = ActionTask.query.get(action_task_id)
        conversation = Conversation.query.filter_by(
            action_task_id=action_task_id
        ).first()
        autonomous_task = AutonomousTask.query.filter_by(
            conversation_id=conversation.id
        ).order_by(AutonomousTask.created_at.desc()).first()
        
        # 获取当前变量值
        variables = {v.name: v.value for v in action_task.environment_variables}
        
        # 获取消息列表（用于 Timeline）
        messages = Message.query.filter_by(
            conversation_id=conversation.id
        ).order_by(Message.created_at).all()
        
        runs.append({
            "run_number": i + 1,
            "action_task_id": action_task_id,
            "status": autonomous_task.status,  # pending/running/completed/failed
            "parameters": {"response_temperature": variables['response_temperature']},
            "current_metrics": {
                "customer_satisfaction": variables.get('customer_satisfaction', 0)
            },
            "messages": [{
                "id": m.id,
                "agent_name": m.agent.name,
                "content_preview": m.content[:50],
                "created_at": m.created_at
            } for m in messages]
        })
    
    return {
        "experiment_id": experiment_id,
        "name": experiment.name,
        "status": experiment.status,
        "total_runs": experiment.total_runs,
        "completed_runs": sum(1 for r in runs if r['status'] == 'completed'),
        "runs": runs
    }
```

**前端返回示例**:
```json
{
  "experiment_id": "exp-002",
  "name": "温度优化实验",
  "status": "running",
  "total_runs": 4,
  "completed_runs": 2,
  "runs": [
    {
      "run_number": 1,
      "status": "completed",
      "parameters": {"response_temperature": 0.3},
      "current_metrics": {"customer_satisfaction": 0.72},
      "messages": [...]
    },
    {
      "run_number": 2,
      "status": "completed",
      "parameters": {"response_temperature": 0.5},
      "current_metrics": {"customer_satisfaction": 0.85},
      "messages": [...]
    },
    {
      "run_number": 3,
      "status": "running",
      "parameters": {"response_temperature": 0.7},
      "current_metrics": {"customer_satisfaction": 0.45},
      "messages": [...]
    },
    {
      "run_number": 4,
      "status": "running",
      "parameters": {"response_temperature": 0.9},
      "current_metrics": {"customer_satisfaction": 0.30},
      "messages": [...]
    }
  ]
}
```

**界面**: 
- 显示总体进度条 (2/4 完成)
- 表格显示每个 run 的状态和指标
- 轮询更新（无需实时流式）

---

### Step 8: 实验完成 - 查看结果

**后端**: 所有 run 完成后，计算最佳结果
```python
def finalize_experiment(experiment_id):
    experiment = ParallelExperiment.query.get(experiment_id)
    
    results = []
    for action_task_id in experiment.cloned_action_task_ids:
        action_task = ActionTask.query.get(action_task_id)
        variables = {v.name: v.value for v in action_task.environment_variables}
        results.append({
            "action_task_id": action_task_id,
            "parameters": {"response_temperature": variables['response_temperature']},
            "metrics": {"customer_satisfaction": variables['customer_satisfaction']}
        })
    
    # 按目标变量排序，找到最佳结果
    best = max(results, key=lambda r: r['metrics']['customer_satisfaction'])
    
    experiment.status = 'completed'
    experiment.results_summary = {
        "best_run": best,
        "all_results": results
    }
    db.session.commit()
```

**前端返回**:
```json
{
  "experiment_id": "exp-002",
  "status": "completed",
  "results_summary": {
    "best_run": {
      "parameters": {"response_temperature": 0.5},
      "metrics": {"customer_satisfaction": 0.85}
    },
    "all_results": [
      {"parameters": {"response_temperature": 0.3}, "metrics": {"customer_satisfaction": 0.72}},
      {"parameters": {"response_temperature": 0.5}, "metrics": {"customer_satisfaction": 0.85}},
      {"parameters": {"response_temperature": 0.7}, "metrics": {"customer_satisfaction": 0.68}},
      {"parameters": {"response_temperature": 0.9}, "metrics": {"customer_satisfaction": 0.55}}
    ]
  }
}
```

**界面**:
- 结果对比表格，高亮最佳行
- 可视化图表（参数 vs 指标）
- "使用最佳参数创建任务"按钮

---

### Step 9: 使用最佳参数创建任务（可选）

**用户操作**: 点击"使用最佳参数创建任务"

**前端**:
```
POST /api/parallel-experiments/exp-002/create-best-task
```

**后端**:
```python
def create_task_with_best_parameters(experiment_id):
    experiment = ParallelExperiment.query.get(experiment_id)
    action_space = ActionSpace.query.get(experiment.source_action_space_id)
    best_params = experiment.results_summary['best_run']['parameters']
    
    # 从 ActionSpace 创建新任务，应用最佳参数
    new_task = create_action_task_from_space(
        action_space_id=action_space.id,
        params=best_params,
        name_suffix="(最佳参数)"
    )
    
    db.session.commit()
    return {"message": "已创建新任务", "action_task_id": new_task.id}
```

**界面**: 显示成功提示，跳转到新创建的任务（`response_temperature=0.5`）

---

### 完整数据流总结

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户界面                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  [实验列表] → [创建实验] → [配置参数] → [监控进度] → [查看结果]            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API 层                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  GET /experiments          获取实验列表                                  │
│  GET /action-spaces        获取行动空间列表（场景模板）                   │
│  POST /experiments         创建实验                                      │
│  GET /experiments/:id      获取实验状态（轮询）                           │
│  POST /experiments/:id/pause|resume|cancel  实验管理                     │
│  POST /experiments/:id/create-best-task  使用最佳参数创建任务            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ParallelExperimentService                         │
├─────────────────────────────────────────────────────────────────────────┤
│  create_experiment()       生成参数组合 → 从 ActionSpace 创建任务 → 启动 │
│  get_experiment_status()   聚合所有 run 的状态                           │
│  create_best_task()        使用最佳参数创建新任务                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ ActionTask 克隆1 │    │ ActionTask 克隆2 │    │ ActionTask 克隆3 │
│ temp=0.3        │    │ temp=0.5        │    │ temp=0.7        │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Conversation    │    │ Conversation    │    │ Conversation    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ AutonomousTask  │    │ AutonomousTask  │    │ AutonomousTask  │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
                    ┌─────────────────────┐
                    │    TaskScheduler    │
                    │    （不需要修改）     │
                    └─────────────────────┘
```

---

## 2. 产品概述

### 2.1 设计理念
参考成熟仿真平台的实验设计，创建一个参数扫描实验平台：

**NetLogo BehaviorSpace**:
- 参数空间系统性探索，支持枚举值和步进值
- 笛卡尔积组合生成，重复运行获得统计意义

**AnyLogic实验框架**:
- Monte Carlo实验：随机参数变化
- Parameter Variation：系统性参数扫描
- 多核并行执行，自动检测CPU核心数

**Simul8 OptQuest**:
- 目标优化：最大化/最小化特定指标
- 约束条件：复杂的参数约束
- 决策变量：连续/离散变量控制

### 2.2 核心功能
- **参数扫描**: 系统性变化参数，探索解空间
- **并行执行**: 多实例同时运行，提高效率
- **智能停止**: 基于目标达成或条件满足自动停止
- **结果优化**: 找到最优参数组合

---

## 3. 实验设计功能

### 3.1 参数配置

#### 变量类型
```javascript
// 枚举值 (NetLogo: ["variable" value1 value2 value3])
{
  "variable": "learning_rate",
  "type": "enumerated",
  "values": [0.01, 0.05, 0.1]
}

// 步进值 (NetLogo: ["variable" [start step end]])
{
  "variable": "population_size",
  "type": "stepped",
  "start": 100,
  "step": 50,
  "end": 1000
}

// 随机分布 (AnyLogic: uniform(0,10), normal(5,1))
{
  "variable": "noise_level",
  "type": "random",
  "distribution": "uniform",
  "min": 0,
  "max": 10
}
```

### 3.2 目标和约束

#### 优化目标
```javascript
{
  "objectives": [
    {
      "name": "success_rate",
      "type": "maximize",
      "weight": 0.7
    },
    {
      "name": "execution_time",
      "type": "minimize",
      "weight": 0.3
    }
  ]
}
```

### 3.3 停止条件
- **时间限制**: 最大运行时间
- **目标达成**: 当目标指标达到阈值时停止
- **收敛检测**: 当结果不再显著改善时停止

---

## 4. 简化架构：并行实验 = 批量克隆 ActionTask

### 4.1 核心洞察

**并行实验的本质问题：变量隔离**

```
❌ 错误设计：多个会话共享一个 ActionTask
ActionTask (一个)
    ├── Variables (共享，会相互影响！)
    ├── Conversation 1 (run#1)
    ├── Conversation 2 (run#2)
    └── Conversation 3 (run#3)

✅ 正确设计：每个并行实例有独立的 ActionTask
ParallelExperiment
    ├── ActionTask 1 (克隆，独立变量 lr=0.01)
    │   └── 默认 Conversation → AutonomousTask
    ├── ActionTask 2 (克隆，独立变量 lr=0.05)
    │   └── 默认 Conversation → AutonomousTask
    └── ActionTask 3 (克隆，独立变量 lr=0.1)
        └── 默认 Conversation → AutonomousTask
```

### 4.2 设计原则

1. **统一绑定 ActionSpace**：所有实验都绑定场景模板，`is_template` 只是标记
2. **变量隔离**：每个并行实例有独立的 ActionTask 和变量空间
3. **复用现有机制**：直接使用 ActionTask + 默认会话 + AutonomousTask
4. **不修改调度器**：TaskScheduler 完全不感知并行实验
5. **前端隔离**：实验创建的 ActionTask 不在行动任务列表中显示，只在并行实验监控界面可见

### 4.3 实现流程

```
用户点击"启动实验"
       │
       ▼
ParallelExperimentService.create_experiment(config)
       │
       ├─1. 生成参数组合 [{lr:0.01}, {lr:0.05}, {lr:0.1}]
       │
       ├─2. 循环：从 ActionSpace 创建 ActionTask
       │       │
       │       ├── 从 ActionSpace 创建 ActionTask (is_experiment_clone=True)
       │       ├── 从 Role 创建 Agent
       │       ├── 复制 SharedVariable → EnvironmentVariable（修改参数值）
       │       └── 创建默认 Conversation
       │
       ├─3. 保存 cloned_action_task_ids
       │
       └─4. 循环：启动自主任务
               │
               └── start_task(action_task_id, conversation_id)
                       │
                       ▼
               TaskScheduler（现有，不修改）
                       │
                       ▼
               AutonomousTask（自动创建）
```

### 4.4 数据模型

```python
# ActionTask 增加字段
class ActionTask(BaseMixin, db.Model):
    # ... 现有字段 ...
    is_experiment_clone = Column(Boolean, default=False)  # 用于前端过滤，不在列表中显示


# ParallelExperiment 简化
class ParallelExperiment(BaseMixin, db.Model):
    __tablename__ = 'parallel_experiments'
    
    name = Column(String(200), nullable=False)
    description = Column(Text)
    
    # 统一绑定 ActionSpace（场景模板）
    # is_template 只是标记是否系统预置，不影响数据结构
    source_action_space_id = Column(String(36), ForeignKey('action_spaces.id'), nullable=False)
    
    config = Column(JSON)
    status = Column(String(20), default='created')  # template/created/running/completed/failed
    
    # 模板标识
    is_template = Column(Boolean, default=False)  # 是否为系统预置模板
    
    # 关联的克隆 ActionTask IDs
    cloned_action_task_ids = Column(JSON)
    
    total_runs = Column(Integer, default=0)
    completed_runs = Column(Integer, default=0)
    failed_runs = Column(Integer, default=0)
    results_summary = Column(JSON)
```

### 4.5 核心服务实现

```python
class ParallelExperimentService:
    """并行实验服务"""
    
    @staticmethod
    def create_experiment(config: dict) -> str:
        """创建并启动实验"""
        # 1. 创建实验记录
        experiment = ParallelExperiment(...)
        
        # 2. 生成参数组合
        combinations = _generate_combinations(config['variables'])
        
        # 3. 从 ActionSpace 创建 ActionTask
        cloned_ids = []
        for i, params in enumerate(combinations):
            task = _create_action_task_from_space(action_space_id, params, suffix)
            cloned_ids.append(task.id)
        
        # 4. 启动每个任务的自主任务
        for task_id in cloned_ids:
            _start_autonomous_task(task_id, config)
        
        return experiment.id
    
    @staticmethod
    def _create_action_task_from_space(action_space_id: str, params: dict, suffix: str):
        """从 ActionSpace 创建 ActionTask"""
        # 从 ActionSpace 创建 ActionTask (is_experiment_clone=True)
        # 从 Role 创建 Agent
        # 复制 SharedVariable → EnvironmentVariable（应用参数值）
        # 创建默认 Conversation
    
    @staticmethod
    def get_experiment_status(experiment_id: str) -> dict:
        """获取实验状态（直接从 AutonomousTask 读取）"""
        # 遍历 cloned_action_task_ids
        # 查询对应的 AutonomousTask 状态
        # 聚合统计数据
    
    @staticmethod
    def clone_experiment(experiment_id: str, new_name: str = None) -> str:
        """复制实验（包括模板实验）"""
        source = ParallelExperiment.query.get(experiment_id)
        
        # 创建副本
        new_experiment = ParallelExperiment(
            name=new_name or f"{source.name} (副本)",
            description=source.description,
            source_action_space_id=source.source_action_space_id,
            config=source.config.copy(),  # 深拷贝配置
            status='created',
            is_template=False,  # 副本不是模板
        )
        db.session.add(new_experiment)
        db.session.commit()
        
        return new_experiment.id
```

### 4.6 实验复制 API

```
POST /api/parallel-experiments/:id/clone
{
  "name": "我的实验 #1"  // 可选，不填则自动生成
}
```

**返回**:
```json
{
  "id": "exp-003",
  "name": "我的实验 #1",
  "status": "created",
  "message": "实验复制成功，可以修改配置后启动"
}
```

---

## 5. 实现计划

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | ActionTask 增加克隆相关字段 | 0.5h |
| 2 | 简化 ParallelExperiment 模型 | 0.5h |
| 3 | 实现 ActionTask 克隆逻辑 | 2h |
| 4 | 实现状态查询和实验管理 API | 1.5h |
| 5 | 前端对接（轮询） | 2h |
| 6 | 测试和调试 | 2h |

**总计**: 约 8.5 小时（1 天）

---

## 6. 长时间运行支持

实验可能持续数小时甚至数天，需要支持：

### 6.1 状态恢复

用户关闭浏览器后再回来，前端重新请求状态即可：

```
GET /api/parallel-experiments/exp-002/status
```

后端直接从数据库读取 `ParallelExperiment` + `AutonomousTask` 状态，无需内存缓存。

### 6.2 实验管理

```
POST /api/parallel-experiments/exp-002/pause   # 暂停所有 run
POST /api/parallel-experiments/exp-002/resume  # 恢复所有 run  
POST /api/parallel-experiments/exp-002/cancel  # 取消实验
```

**后端实现**：调用 TaskScheduler 的 pause/resume/cancel 方法

```python
def pause_experiment(experiment_id):
    experiment = ParallelExperiment.query.get(experiment_id)
    for action_task_id in experiment.cloned_action_task_ids:
        conversation = get_default_conversation(action_task_id)
        autonomous_task = get_autonomous_task(conversation.id)
        if autonomous_task and autonomous_task.status == 'running':
            TaskScheduler.pause_task(autonomous_task.id)
    experiment.status = 'paused'
    db.session.commit()
```

### 6.3 变量历史记录（按 Step）

每一轮 agent 输出为一个 **Step**，记录该轮结束后的变量快照。

**数据模型**：

```python
class ExperimentStep(BaseMixin, db.Model):
    """实验步骤记录"""
    __tablename__ = 'experiment_steps'
    
    conversation_id = Column(String(36), ForeignKey('conversations.id'))
    step_number = Column(Integer, nullable=False)  # 1, 2, 3...
    variables_snapshot = Column(JSON)  # {"satisfaction": 0.5, "temperature": 0.7}
    created_at = Column(DateTime, default=datetime.utcnow)
```

**记录时机**：每轮对话结束后，由调度器自动记录

**查询 API**：
```
GET /api/parallel-experiments/:id/steps
```

返回所有 run 的 step 数据，用户可自行拉取后画图分析

### 6.4 进度持久化

每个 run 的进度由 `AutonomousTask` 自动记录：
- `current_round` - 当前轮数
- `total_rounds` - 总轮数
- `status` - pending/running/paused/completed/failed
- `error_message` - 失败原因

前端可以显示详细进度：

```
Run 1: [=====>    ] 2/5 轮 (running)
Run 2: [=========>] 4/5 轮 (running)
Run 3: [==========] 完成 (satisfaction=0.85)
Run 4: [X] 失败 (API 超时)
```

---

## 7. 架构优势

1. **变量隔离**：每个并行实例有独立的 ActionTask 和变量空间
2. **极简设计**：复用现有的 ActionTask + AutonomousTask 机制
3. **调度器零侵入**：TaskScheduler 完全不需要修改
4. **状态天然同步**：直接从 AutonomousTask 读取状态，无需额外同步
5. **断点续传**：状态完全持久化，支持长时间运行
6. **易于清理**：实验结束后可以删除克隆的 ActionTask

---

## 8. 市场定位与竞品分析

### 8.1 当前 LLM + ABM 领域主要玩家

| 项目 | 来源 | 特点 | 规模 | 参数扫描 |
|------|------|------|------|----------|
| **Stanford Generative Agents (Smallville)** | Stanford + Google | 记忆-规划-反思架构，涌现社交行为 | 25 agents | ❌ |
| **GenSim** | 学术 | 通用社会模拟平台，场景可定制 | 10万 agents | ❌ |
| **AgentTorch** | MIT Media Lab | "LLM Archetypes"解决大规模问题 | 840万 agents | ❌ |
| **清华 LLM-ABM** | 清华FIB Lab | 开源平台，Nature子刊发表 | 中等规模 | ❌ |

### 8.2 Multi-Agent 工程框架对比

| 框架 | 维护方 | 核心理念 | 参数扫描 | 实验复现 |
|------|--------|----------|----------|----------|
| **AutoGen** | Microsoft | Actor模型，异步对话 | ❌ | ❌ |
| **CrewAI** | 开源 | 角色分工协作 | ❌ | ❌ |
| **LangGraph** | LangChain | DAG图工作流 | ❌ | ❌ |
| **OpenAI Swarm** | OpenAI | 模块化agent编排 | ❌ | ❌ |
| **ParallelLab (我们)** | - | 参数扫描+目标优化 | ✅ | ✅ |

### 8.3 我们的差异化定位

**核心卖点**：
1. **"LLM-ABM 的 BehaviorSpace"** - 对标 NetLogo，系统性参数空间探索
2. **"可复现的 AI 社会实验平台"** - 克隆+Step快照解决 validation 核心挑战
3. **"参数-结果因果推断"** - 不是黑盒，而是可量化优化

**市场空白**：
- 竞品聚焦 "如何让 agents 协作"
- 我们聚焦 "如何系统性实验和优化 agent 参数"
- 学术界(Springer 2025)指出 validation 是 LLM-ABM 核心挑战，但工程工具还没跟上

### 8.4 功能对比矩阵

| 能力 | Stanford | AgentTorch | AutoGen | CrewAI | **ParallelLab** |
|------|----------|------------|---------|--------|-----------------|
| 多Agent协作 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 大规模支持 | ❌ | ✅ | ❌ | ❌ | 🔄 (roadmap) |
| 参数扫描 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 目标优化 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 实验复现 | ❌ | 部分 | ❌ | ❌ | ✅ |
| 提前停止 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 变量历史记录 | ❌ | 部分 | ❌ | ❌ | ✅ |

### 8.5 未来可借鉴方向

| 能力 | 竞品做法 | 建议 |
|------|----------|------|
| **大规模支持** | AgentTorch 用 "LLM Archetypes"（同类agent共享LLM调用） | 引入archetype概念，降低API成本 |
| **记忆架构** | Stanford 三层：观察-规划-反思 | 考虑标准化 Agent 记忆模块 |
| **涌现行为检测** | Stanford 手动观察+用户评估 | 可加自动涌现模式检测 |
| **验证框架** | 学术界提出多层验证方法 | 内置 validation metrics |

### 8.6 参考资料

- [Stanford Generative Agents](https://github.com/joonspk-research/generative_agents) - 25 agents 小镇模拟
- [AgentTorch](https://github.com/AgentTorch/AgentTorch) - MIT 大规模 LLM-ABM
- [清华 LLM-ABM](https://github.com/tsinghua-fib-lab/LLM-Agent-Based-Modeling-and-Simulation)
- [Nature: LLM empowered ABM Survey](https://www.nature.com/articles/s41599-024-03611-3) - 2024综述
- [Springer: Validation Challenge](https://link.springer.com/article/10.1007/s10462-025-11412-6) - 验证是核心挑战

---

## 9. 实验模板设计 (Seed Data)

### 9.1 模板数据结构

模板实验通过 `seed_data/seed_data_parallel_experiments.json` 预置。

**设计原则**：
- 模板必须绑定一个 `source_action_space_id`（对应预置的模板行动空间）
- ActionSpace 是模板层，ActionTask 是实例层，模板应引用模板
- 不使用 tags 筛选（模板数量少，直接列表展示）
- 配置结构与普通实验一致，无额外字段

```json
[
  {
    "id": "exp-tpl-001",
    "name": "客服满意度优化实验",
    "description": "寻找最佳 temperature 使客户满意度最高",
    "is_template": true,
    "source_action_space_id": "space-tpl-customer-service",
    "config": {
      "variables": {
        "response_temperature": {
          "type": "enumerated",
          "values": [0.3, 0.5, 0.7, 0.9]
        }
      },
      "objectives": [
        {"variable": "customer_satisfaction", "type": "maximize"}
      ],
      "stop_conditions": [
        {"expression": "customer_satisfaction > 0.9"}
      ],
      "task_config": {
        "type": "discussion",
        "rounds": 5
      }
    }
  },
  {
    "id": "exp-tpl-002",
    "name": "社交网络涌现实验",
    "description": "探索不同社交参数下的群体行为涌现",
    "is_template": true,
    "source_action_space_id": "space-tpl-social-network",
    "config": {
      "variables": {
        "interaction_frequency": {
          "type": "enumerated",
          "values": [1, 3, 5, 10]
        },
        "opinion_flexibility": {
          "type": "stepped",
          "start": 0.1,
          "step": 0.2,
          "end": 0.9
        }
      },
      "objectives": [
        {"variable": "group_consensus", "type": "maximize"}
      ],
      "task_config": {
        "type": "discussion",
        "rounds": 10
      }
    }
  },
  {
    "id": "exp-tpl-003",
    "name": "团队协作效率实验",
    "description": "优化多 Agent 团队的协作参数",
    "is_template": true,
    "source_action_space_id": "space-tpl-team-collaboration",
    "config": {
      "variables": {
        "communication_style": {
          "type": "enumerated",
          "values": ["formal", "casual", "mixed"]
        },
        "decision_mode": {
          "type": "enumerated",
          "values": ["consensus", "leader_driven", "voting"]
        }
      },
      "objectives": [
        {"variable": "task_completion_rate", "type": "maximize"}
      ],
      "task_config": {
        "type": "discussion",
        "rounds": 8
      }
    }
  }
]
```

### 9.2 前端交互流程

```
┌─────────────────────────────────────────────────────────────┐
│  实验列表                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户点击模板的 [复制] 按钮                                  │
│           ↓                                                 │
│  弹窗：输入新实验名称                                        │
│           ↓                                                 │
│  POST /api/parallel-experiments/:id/clone                   │
│           ↓                                                 │
│  跳转到实验设计器（编辑复制后的实验）                         │
│           ↓                                                 │
│  用户可调整参数、可选换行动空间                              │
│           ↓                                                 │
│  点击 [启动实验]                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 更新实现计划

在原有实现计划基础上增加：

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 7 | 创建 seed_data_parallel_experiments.json | 0.5h |
| 8 | 实现实验复制 API | 0.5h |
| 9 | 前端实验列表页面 | 1.5h |
| 10 | 前端复制流程对接 | 1h |

**新增总计**: 3.5 小时

---

## 10. 前端实现差距分析与待办

### 10.1 已实现功能 ✅

| 功能 | 文件 | 状态 |
|------|------|------|
| 实验列表页面（卡片展示、搜索筛选） | `ExperimentListPage.tsx` | ✅ 完成 |
| 创建实验（选择行动空间、配置参数扫描、目标变量、停止条件） | `ExperimentDesign.tsx` | ✅ 完成 |
| 执行监控（进度、状态、运行详情表格） | `ExecutionMonitoring.tsx` | ✅ 完成 |
| 分析报告（最佳结果、结果对比表格） | `AnalysisReport.tsx` | ✅ 完成 |
| 实验复制/暂停/恢复/停止/删除 | `ExperimentListPage.tsx` | ✅ 完成 |
| 模板实验支持 | `ExperimentListPage.tsx` | ✅ 完成 |
| Timeline 轨道视图组件 | `TimelineTrackView.tsx` | ✅ 组件已实现 |

### 10.2 待修复问题 🐛

#### 10.2.1 实验设计器只读模式数据传递错误 ✅ 已修复

**问题**: `ExperimentListPage.tsx` 传递的数据路径错误

**已修复**: 现在使用正确的路径 `selectedExperiment.config?.variables` 等

### 10.3 待实现功能 ⚠️

#### 10.3.1 Timeline 视图集成 ✅ 已完成

**PRD 描述**: Step 7 监控实验进度时，显示 messages Timeline

**当前状态**: 
- `TimelineTrackView.tsx` 组件已实现
- `ExecutionMonitoring.tsx` 已集成 Timeline 视图切换
- 支持真实消息数据，无消息时显示模拟数据

#### 10.3.2 变量历史记录图表 ✅ 已完成

**PRD 描述**: 6.3 节提到 `ExperimentStep` 按 Step 记录变量快照，用户可拉取后画图分析

**实现**:
- 在 `AnalysisReport.tsx` 中新增 `VariableHistoryChart` 组件
- 调用 `getExperimentSteps` API 获取步骤数据
- 使用 ECharts 绘制多条折线图（每个 Run 一条线）
- X 轴: Step 编号，Y 轴: 变量值
- 支持下拉选择不同变量查看
- 图例显示参数组合信息
- 后端调度器 `scheduler.py` 在每轮对话结束后自动记录步骤

#### 10.3.3 参数 vs 指标可视化图表 ✅ 已完成

**实现**: 
- 使用 ECharts 柱状图展示参数与指标的关系
- X 轴显示参数值，Y 轴显示目标指标值
- 自动从实验配置中提取第一个参数和第一个目标变量

#### 10.3.4 导出功能 ✅ 已完成

**实现**:
- CSV 导出：包含运行序号、所有参数、所有指标
- JSON 导出：包含实验信息、当前轮次、最佳结果、所有结果

### 10.4 更新实现计划

在原有计划基础上增加前端完善任务：

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 11 | 修复实验设计器只读模式数据传递 | 0.5h |
| 12 | 集成 Timeline 视图到执行监控 | 1h |
| 13 | 实现变量历史记录图表 | 2h |
| 14 | 实现参数 vs 指标可视化图表 | 1.5h |
| 15 | 实现导出功能（CSV/JSON） | 1h |

**前端完善总计**: 6 小时

---

## 11. 后续优化 (Future)

### 11.1 ActionTask 一键创建实验

类似 ActionTask 的"一键创建"功能，在 ActionTask 详情页增加"创建并行实验"入口：

```
ActionTask 详情页
    │
    └── [创建并行实验] 按钮
            │
            ↓
        自动填充 source_action_space_id（从该任务的 action_space_id 获取）
            │
            ↓
        跳转到实验设计器
```

**优势**：用户无需离开当前任务，直接基于当前场景创建实验，提高易用性。

### 11.2 TimelineTrackView 使用真实数据 ✅ 已完成

**当前状态**: 
- `TimelineTrackView.tsx` 已支持真实消息数据
- `ExecutionMonitoring.tsx` 传递 `run.messages` 给组件
- 组件优先使用真实数据，无数据时降级为模拟数据
- 消息详情弹窗使用 `ConversationExtraction` 组件渲染

### 11.3 实验对比功能

**描述**: 支持选择多个已完成实验进行横向对比

**待办**:
- 在分析报告页面添加多选实验功能
- 对比不同实验的最佳参数和结果
- 生成对比图表

### 11.4 实验模板管理

**描述**: 允许用户将自己的实验保存为模板

**待办**:
- 添加"保存为模板"按钮
- 实现 `POST /api/parallel-experiments/:id/save-as-template` API
- 用户模板与系统模板区分显示

---

## 12. Bug 修复记录 (2024-01)

### 12.1 AnalysisReport 多轮次结果显示问题 ✅

**问题**: 当实验有多轮次时，`results_summary` 是按轮次存储的（如 `{"1": {...}, "2": {...}}`），但前端直接读取 `results_summary.best_run`，无法正确获取多轮次数据。

**修复方案**:
- 添加轮次选择器，让用户选择查看哪一轮的结果
- 根据选中轮次从 `results_summary[iteration]` 获取数据

### 12.2 ExecutionMonitoring 轮次选择器类型问题 ✅

**问题**: `allIterations` 返回的是字符串数组（如 `["1", "2"]`），但 Select.Option 的 value 使用 `Number(iter)` 转换，可能导致类型不匹配。

**修复方案**:
- 统一使用数字类型处理轮次

### 12.3 暂停/恢复逻辑不完整 ✅

**问题**: 
- `pause_experiment` 将任务状态设为 `stopped`，但暂停和停止使用相同的状态，无法区分
- 恢复时无法正确识别哪些任务是被暂停的

**修复方案**:
- 使用 `paused` 状态区分暂停和停止
- 修改 `resume_experiment` 检查 `paused` 状态的任务

### 12.4 ExperimentStep 记录未被调用 ✅

**问题**: `record_step` 方法已实现，但在代码中没有调用点。PRD 中提到"由调度器在每轮对话结束后调用"。

**修复方案**:
- 在 `_finalize_experiment` 中记录最终步骤
- 在任务完成回调中记录步骤（需要调度器支持）

### 12.5 停止条件未实现 ✅

**问题**: 配置中支持 `stop_conditions`，但实际执行时没有检查停止条件是否满足。

**修复方案**:
- 在 `get_experiment_status` 中检查停止条件
- 如果满足停止条件，自动停止实验

### 12.6 轮次结果查询参数 ✅

**问题**: 前端需要按轮次查看结果，但 API 没有提供按轮次筛选的参数。

**修复方案**:
- `get_experiment` API 添加 `iteration` 参数
- 返回指定轮次的结果摘要

---

## 13. 实验行为协议 (Experiment Behavior Protocol)

### 13.1 问题背景

当前并行实验启动后，agent 收到的系统提示词存在以下问题：

1. **任务描述技术化**：`Task Description: 并行实验自动创建: xxx` 只是内部标识，agent 不知道要做什么
2. **变量无语义**：环境变量只是 `name: value` 形式，agent 不知道如何根据变量调整行为
3. **目标变量无指导**：agent 不知道何时、如何、按什么标准更新目标变量
4. **缺少实验上下文**：agent 不知道自己在参与一个参数化模拟实验

**对比传统 ABM（如 NetLogo）**：
- 传统 ABM：参数 → 代码逻辑 → 行为（确定性映射）
- LLM-ABM：参数 → 提示词 → LLM推理 → 行为（需要明确的行为指令）

### 13.2 解决方案：实验行为协议

在实验设计阶段，基于用户配置**自动生成**一段结构化的**实验行为协议文本**，注入到 agent 的系统提示词中。

**核心思路**：
- 不增加复杂的数据模型
- 利用 AI 辅助生成（复用现有辅助生成架构）
- 用户可预览、可编辑
- 存储为 `config.experiment_protocol` 字符串字段

### 13.3 协议内容结构

```markdown
## 实验行为协议

你正在参与「{experiment_name}」模拟实验。请严格按照以下协议执行。

### 实验主题
{topic}

### 输入参数（行为约束）
以下参数控制你的行为方式，请严格遵守：

**{variable_name} = {value}**
- 含义：{semantic_description}
- 行为要求：{behavior_instruction}
- ⚠️ 这是实验控制变量，请勿偏离

### 输出指标（评估与更新）
以下变量需要你在模拟过程中评估和更新：

**{objective_variable}**（当前值：{current_value}）
- 含义：{description}
- 评估标准：{evaluation_criteria}
- 更新时机：{update_timing}
- 更新方式：调用 set_task_var("{variable_name}", 值)

### 模拟要求
1. 根据你的角色定义，与其他参与者自然互动
2. 严格遵守输入参数的行为约束
3. 在适当时机更新输出指标
4. 保持角色一致性，不要跳出模拟情境
```

### 13.4 生成流程

```
┌─────────────────────────────────────────────────────────────────┐
│  实验设计器                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: 选择行动空间 ✓                                         │
│  Step 2: 配置扫描变量 ✓                                         │
│  Step 3: 配置目标变量 ✓                                         │
│  Step 4: 配置任务参数（topic、轮数等）✓                          │
│                                                                 │
│  Step 5: 生成实验协议  ← 新增                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  [✨ 自动生成协议]                                          ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ ## 实验行为协议                                      │   ││
│  │  │                                                     │   ││
│  │  │ 你正在参与「教育学习效果优化实验」...                 │   ││
│  │  │                                                     │   ││
│  │  │ ### 输入参数                                        │   ││
│  │  │ **explanation_style = concise**                     │   ││
│  │  │ - 行为要求：用简短语言解释，每次不超过2句话           │   ││
│  │  │ ...                                                 │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │                                                             ││
│  │  [重新生成]  [手动编辑]                                     ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                        [启动实验]               │
└─────────────────────────────────────────────────────────────────┘
```

### 13.5 系统设置集成

参考现有的辅助生成设置（`AssistantSettings.tsx`），在系统设置中添加：

**设置 → 辅助生成 → 实验协议生成**

```
┌─────────────────────────────────────────────────────────────────┐
│  实验协议生成设置                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🤖 启用自动生成                              [开关]            │
│     启用后，创建实验时可自动生成行为协议                         │
│                                                                 │
│  📝 生成模型                                                    │
│     [默认文本生成模型 ▼]                                        │
│                                                                 │
│  📋 协议模板                                  [编辑模板]         │
│     自定义协议生成的提示词模板                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**系统设置字段**：
```json
{
  "enable_experiment_protocol_generation": true,
  "experiment_protocol_model": "default",
  "experiment_protocol_template": "..."
}
```

### 13.6 数据模型

**无需新增数据库字段**，只在现有 `config` JSON 中添加：

```python
experiment.config = {
    "variables": {...},
    "objectives": [...],
    "task_config": {...},
    # 新增：实验行为协议
    "experiment_protocol": "## 实验行为协议\n\n你正在参与..."
}
```

### 13.7 协议注入时机

在 `_create_action_task_from_space` 创建 ActionTask 时，或在提示词构建时：

```python
# 方案1：写入 ActionTask.description
task = ActionTask(
    title=f"{action_space.name} - {name_suffix}",
    description=experiment_protocol,  # 使用协议作为描述
    ...
)

# 方案2：在系统提示词模板中添加 experiment_protocol 占位符
# systemPromptTemplate.md 中添加：
# {experiment_protocol}
```

**推荐方案2**：在系统提示词模板中添加专门的实验协议区块，与 actionTask 部分并列。

### 13.8 生成 API

```
POST /api/parallel-experiments/generate-protocol
{
  "action_space_id": "space-001",
  "variables": {
    "explanation_style": {
      "type": "enumerated", 
      "values": ["concise", "detailed"]
    }
  },
  "objectives": [
    {"variable": "learning_score", "type": "maximize"}
  ],
  "task_config": {
    "topic": "辅导学生学习二次函数"
  }
}
```

**返回**：
```json
{
  "protocol": "## 实验行为协议\n\n你正在参与..."
}
```

### 13.9 默认协议模板

```markdown
你是一个专业的实验协议生成助手。请根据以下实验配置，生成一份清晰的实验行为协议。

## 实验信息
- 行动空间：{action_space_name}
- 行动空间描述：{action_space_description}
- 参与角色：{roles}
- 实验主题：{topic}

## 扫描变量
{variables_json}

## 目标变量
{objectives_json}

## 要求
1. 为每个扫描变量生成语义描述和具体的行为指令
2. 为每个目标变量生成评估标准和更新时机
3. 使用 Markdown 格式
4. 语言简洁明确，便于 LLM 理解和执行
5. 强调这是实验控制变量，agent 必须严格遵守

请生成实验行为协议：
```

### 13.10 实现计划更新

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 16 | 后端：添加协议生成 API | 1h |
| 17 | 后端：系统设置字段（enable/model/template） | 0.5h |
| 18 | 后端：协议注入到系统提示词 | 1h |
| 19 | 前端：实验设计器添加协议生成步骤 | 2h |
| 20 | 前端：系统设置页面添加协议生成配置 | 1h |
| 21 | 测试和调试 | 1.5h |

**实验行为协议总计**: 7 小时

### 13.11 预期效果

**改进前**（agent 收到的提示词）：
```
Task Description: 并行实验自动创建: 074c5e71-3513-4d91-991d-0db6a031db98

### Task Environment Variables
- explanation_style: concise
- feedback_frequency: low
- learning_score: 0
```

**改进后**：
```
## 实验行为协议

你正在参与「教育学习效果优化实验」模拟实验。

### 实验主题
辅导学生学习二次函数的图像性质

### 输入参数（行为约束）

**explanation_style = concise**
- 含义：控制你解释概念时的详细程度
- 行为要求：用简短语言解释，每次解释不超过2句话，直击要点，避免展开背景知识
- ⚠️ 这是实验控制变量，请严格遵守

**feedback_frequency = low**
- 含义：控制你提供反馈的频率
- 行为要求：只在学生明确请求或出现重大错误时才提供反馈，避免频繁打断

### 输出指标（评估与更新）

**learning_score**（当前值：0）
- 含义：学习效果评分
- 评估标准：
  - 90-100：学生完全理解并能举一反三
  - 70-89：基本理解核心概念
  - 50-69：部分理解但有困惑
  - 0-49：未能理解
- 更新时机：每轮对话结束后
- 更新方式：调用 set_task_var("learning_score", 分数)
- 评估者：测评专家角色负责评估和更新

### 模拟要求
1. 根据你的角色定义，与其他参与者自然互动
2. 严格遵守输入参数的行为约束
3. 在适当时机更新输出指标
```

这样 agent 就能像执行代码一样，明确知道参数如何影响行为、目标变量如何评估更新。

---

## 14. 涌现行为检测 (Emergent Behavior Detection)

### 14.1 设计理念

利用现有的 **Observer（监督者）** 和 **Graphiti 知识图谱** 能力，实现涌现行为的自动检测。

```
┌─────────────────────────────────────────────────────────────┐
│                    涌现行为检测架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Graphiti 知识图谱          Observer 监督者                │
│   ┌─────────────┐           ┌─────────────┐                │
│   │ 实体节点    │           │ 全局视角    │                │
│   │ 关系边      │  ←─────→  │ 模式识别    │                │
│   │ 时序事件    │           │ 异常检测    │                │
│   └─────────────┘           └─────────────┘                │
│          │                         │                        │
│          └─────────┬───────────────┘                        │
│                    ▼                                        │
│          ┌─────────────────┐                               │
│          │  涌现行为检测器  │                               │
│          │  - 群体形成      │                               │
│          │  - 观点极化      │                               │
│          │  - 信息级联      │                               │
│          │  - 协作涌现      │                               │
│          └─────────────────┘                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 检测的涌现行为类型

| 类型 | 描述 | 检测方法 |
|------|------|----------|
| **群体形成** | 多个 agent 形成小团体，互动频繁 | 图社区检测算法 |
| **观点极化** | agent 分成对立阵营，立场越来越极端 | 观点聚类分析 |
| **信息级联** | 某个观点/信息快速在多个 agent 间传播 | 时序传播路径追踪 |
| **协作涌现** | agent 自发形成分工协作模式 | 角色行为模式分析 |
| **规范形成** | agent 自发形成某种行为规范或共识 | 行为一致性检测 |

### 14.3 实现方案

#### 方案一：基于 Graphiti 图结构分析（低成本）

```python
class GraphitiEmergenceDetector:
    """基于 Graphiti 的涌现行为检测器"""
    
    def __init__(self, graphiti_client):
        self.graphiti = graphiti_client
    
    async def detect_group_formation(self, conversation_id: str) -> List[Dict]:
        """检测群体形成（小团体、派系）
        
        原理：分析 agent 间的互动关系，检测社区结构
        """
        # 从 Graphiti 查询互动关系
        edges = await self.graphiti.search(
            query=f"conversation:{conversation_id} type:interaction",
            edge_types=["mentioned", "replied_to", "agreed_with", "disagreed_with"]
        )
        
        # 构建互动图，使用社区检测算法（Louvain）
        communities = self._detect_communities(edges)
        
        return [{
            "type": "group_formation",
            "groups": communities,
            "description": f"检测到 {len(communities)} 个互动群体"
        }]
    
    async def detect_opinion_polarization(self, conversation_id: str, topic: str) -> Dict:
        """检测观点极化
        
        原理：追踪 agent 对特定话题的立场变化
        """
        # 查询与话题相关的观点节点
        opinions = await self.graphiti.search(
            query=f"topic:{topic} conversation:{conversation_id}",
            node_types=["opinion", "stance", "belief"]
        )
        
        # 分析观点分布，计算极化指数
        polarization_index = self._calculate_polarization(opinions)
        
        return {
            "type": "opinion_polarization",
            "topic": topic,
            "polarization_index": polarization_index,  # 0-1, 越高越极化
            "clusters": self._cluster_opinions(opinions)
        }
    
    async def detect_information_cascade(self, conversation_id: str) -> List[Dict]:
        """检测信息级联（如谣言传播、观点传染）
        
        原理：追踪特定信息/观点在 agent 间的传播路径
        """
        # 查询时序事件
        events = await self.graphiti.get_episodes(
            conversation_id=conversation_id,
            include_relations=True
        )
        
        # 检测传播模式：A说了X → B引用X → C也开始说X
        cascades = []
        for pattern in self._find_spread_patterns(events):
            if pattern['spread_count'] >= 3:  # 至少3个agent传播
                cascades.append({
                    "type": "information_cascade",
                    "origin_agent": pattern['origin'],
                    "content": pattern['content'],
                    "spread_path": pattern['path'],
                    "spread_count": pattern['spread_count']
                })
        
        return cascades
```

#### 方案二：Observer 主动检测（高精度）

```python
class ObserverEmergenceDetector:
    """让 Observer 角色主动检测涌现行为"""
    
    DETECTION_PROMPT = """你是一个社会行为观察者。请分析以下对话，检测是否出现了涌现行为。

涌现行为类型：
1. **群体形成**：多个 agent 形成小团体，互动频繁
2. **观点极化**：agent 分成对立阵营，立场越来越极端
3. **信息级联**：某个观点/信息快速在多个 agent 间传播
4. **协作涌现**：agent 自发形成分工协作模式
5. **规范形成**：agent 自发形成某种行为规范或共识

对话记录：
{conversation_history}

请输出 JSON 格式的检测结果：
```json
{
  "detected_patterns": [
    {
      "type": "pattern_type",
      "description": "描述",
      "involved_agents": ["agent1", "agent2"],
      "evidence": "支持证据",
      "confidence": 0.8
    }
  ],
  "overall_dynamics": "整体动态描述"
}
```"""
    
    async def detect_with_observer(self, conversation_id: str) -> Dict:
        """使用 Observer 的 LLM 能力检测涌现行为"""
        messages = await self.get_conversation_history(conversation_id)
        
        prompt = self.DETECTION_PROMPT.format(
            conversation_history=self._format_messages(messages)
        )
        
        result = await self.llm.generate(prompt, response_format="json")
        return result
```

#### 方案三：混合检测（推荐）

```python
class HybridEmergenceDetector:
    """混合检测：图分析（快速筛选） + LLM（深入确认）"""
    
    def __init__(self, graphiti_client, observer_service):
        self.graph_detector = GraphitiEmergenceDetector(graphiti_client)
        self.observer_detector = ObserverEmergenceDetector(observer_service)
    
    async def detect(self, conversation_id: str) -> Dict:
        # 1. 先用图分析做快速筛选（低成本）
        graph_signals = await detector.quick_scan(conversation_id)
        
        # 2. 对有信号的模式，用 LLM 深入分析（高精度）
        confirmed_patterns = []
        for signal in graph_signals:
            if signal['confidence'] > 0.5:
                # 让 Observer 确认并解释
                confirmation = await self.observer_detector.confirm_pattern(
                    conversation_id, signal
                )
                if confirmation['confirmed']:
                    confirmed_patterns.append({
                        **signal,
                        'explanation': confirmation['explanation']
                    })
        
        return {
            'patterns': confirmed_patterns,
            'raw_signals':h_signals
        }
```

### 14.4 与并行实验集成

```python
# 实验配置中添加涌现检测
experiment_config = {
    "variables": {...},
    "objectives": [
        {"variable": "customer_satisfaction", "type": "maximize"},
        # 涌现行为作为观测指标
        {"variable": "group_formation_count", "type": "observe"},
        {"variable": "polarization_index", "type": "minimize"}
    ],
    "emergence_detection": {
        "enabled": True,
        "detect_types": ["group_formation", "opinion_polarization", "information_cascade"],
        "detection_interval": "per_round",  # 每轮检测一次
        "use_observer": True  是否使用 Observer 确认
    }
}
```

### 14.5 数据模型

```python
class EmergenceEvent(BaseMixin, db.Model):
    """涌现事件记录"""
    __tablename__ = 'emergence_events'
    
    experiment_id = Column(String(36), ForeignKey('parallel_experiments.id'))
    conversation_id = Column(String(36), ForeignKey('conversations.id'))
    action_task_id = Column(String(36), ForeignKey('action_tasks.id'))
    
    event_type = Column(String(50))  # group_formation/polarization/cascade/...
    description = Column(Text)
    involved_agents = Column(JSON)  # ["agent1", "agent2"]
    evidence = Column(Text)
    confidence = Column(Float)
    
    # 检测元数据
    detection_method = Column(String(20))  # graph/observer/hybrid
    detected_at_round = Column(Integer)
    raw_data = Column(JSON)  # 原始检测数据
    
    created_at = Column(DateTime, default=datetime.utcnow)
```

### 14.6 API 设计

```
# 获取实验的涌现事件
GET /api/parallel-experiments/:id/emergence-events

# 手动触发涌现检测
POST /api/parallel-experiments/:id/detect-emergence
{
  "detect_types": ["group_formation", "opinion_polarization"],
  "use_observer": true
}

# 获取单个 run 的涌现事件
GET /api/parallel-experiments/:id/runs/:task_id/emergence-events
```

### 14.7 前端展示

```
┌───────────────────────────────────────────────────
│  涌现行为检测                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔵 群体形成                          置信度: 0.85    │   │
│  │ 检测到 2 个互动群体                                  │   │
│  │ 群体1: Agent-A, Agent-B, Agent-C                    │   │
│  │ 群体2: Agent-D, Agent-E                             │   │
│  │ 证据: Agent-A 与 Agent-B 互动 12 次...              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 观点极化                          置信度: 0.72    │   │
│  │ 话题「价格策略」出现观点分化                         │   │
│  │ 阵营1 (支持涨价): Agent-A, Agent-C                  │   │
│  │ 阵营2 (反对涨价): Agent-B, Agent-D, Agent-E         │   │
│  │ 极化指数: 0.68                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────┐   │
│  │ 🟡 信息级联                          置信度: 0.91    │   │
│  │ 「用户体验优先」观点快速传播                         │   │
│  │ 传播路径: Agent-A → Agent-B → Agent-C → Agent-D     │   │
│  │ 传播轮次: 第2轮 → 第5轮                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 14.8 实现计划

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 22 | 数据模型：EmergenceEvent | 0.5h |
| 23 | Graphiti 图分析检测器 | 2h |
| 24 | Observer 检测器（扩展 Observer 角色） | 1h |
| 25 | 混合检测器整合 | 1h |
| 26 | API 实现 | 1h |
| 27 | 前端涌现事件展示组件 | 2h |
| 28 | 与 ParallelLab 集成 | 1h |
| 29 | 测试和调试 | 1h |

**涌现行为检测总计**: 9.5 小时

### 14.9 核心优势

1. **复用现有能力**：Graphiti 提供图结构，Observer 提供全局视角，无需从零开始
2. **成本可控**：图分析低成本快速筛选，LLM 仅用于确认高置信度信号
3. **可解释性**：每个检测结果都有证据和解释
4. **与实验集成**：涌现指标可作为实验的观测变量，支持参数-涌现因果分析
