# 编排模式（Workflow Graph）设计方案

## 概述

在**行动空间（ActionSpace）详情页**新增"编排"Tab，支持通过 ReactFlow 可视化定义智能体协作流程。编排模式是 ActionSpace 级别的功能，定义的流程可被多次执行。

## 战略定位：对标 NVIDIA 生态

### NVIDIA 收购逻辑分析

根据 NVIDIA 2024-2025 年收购策略：
- **OctoAI ($250M)**: AI模型优化和部署
- **Run:ai ($700M)**: GPU资源编排和AI工作负载管理
- **Gretel**: 合成数据生成
- **Solver**: AI编码智能体

**NVIDIA 核心关注点**：
1. **AI Agent 编排**：Nemotron 模型家族 + Agent Blueprints
2. **数字人/Avatar**：ACE (Avatar Cloud Engine) + NIM 微服务
3. **机器人仿真**：Isaac Sim + Omniverse 多智能体仿真
4. **企业级 AI 基础设施**：NIM 微服务 + AI Enterprise

### ABM-LLM 的战略价值

```
┌─────────────────────────────────────────────────────────────────┐
│                    NVIDIA 生态缺口                               │
├─────────────────────────────────────────────────────────────────┤
│  Isaac Sim: 物理机器人仿真 ←→ ABM-LLM: 认知智能体仿真           │
│  ACE: 单个数字人 ←→ ABM-LLM: 多智能体协作系统                   │
│  NIM: 模型推理 ←→ ABM-LLM: 智能体编排和决策                     │
│  Omniverse: 3D场景 ←→ ABM-LLM: 社会/经济/组织仿真               │
└─────────────────────────────────────────────────────────────────┘
```

**我们填补的空白**：NVIDIA 有物理仿真（Isaac Sim）和数字人（ACE），但缺少**认知层面的多智能体协作和社会仿真**能力。

## 产品定位与竞争力分析

### 三层竞争格局

| 层级 | 竞品 | ABM-LLM 差异化 |
|------|------|---------------|
| **编排层** | Dify, RAGFlow, FastGPT, Langflow, n8n | 多智能体原生 + 角色扮演 + 监督者机制 |
| **仿真层** | NetLogo, Mesa, GAMA, Repast | LLM驱动认知 + 自然语言时决策 |
| **数字人层** | NVIDIA ACE, Soul Machines, Synthesia | 多角色协作 + 组织仿真 + 决策支持 |

### 与 NVIDIA 技术栈的集成机会

| NVIDIA 技术 | 集成方式 | 价值 |
|-------------|---------|------|
| **NIM 微服务** | 作为 LLM 推理后端 | 高性能推理 + 企业级部署 |
| **ACE Agent** | 智能体可视化前端 | 数字人界面 + 语音交互 |
| **Isaac Sim** | 物理仿真后端 | 机器人 + 物理环境仿真 |
| **Omniverse** | 3D 场景渲染 | 可视化 + 数字孪生 |
| **Nemotron** | 推理模型 | Agent 专用模型 |

### 差异化竞争力（对标收购价值）

| 特性 | 竞品现状 | ABM-LLM 优势 | 收购价值 |
|------|---------|-------------|---------|
| **多智能体认知仿真** | 无 | ✅ 独创 | 填补 NVIDIA 认知仿真空白 |
| **组织/社会建模** | 学术工具为主 | ✅ 企业级 | 企业决策支持市场 |
| **LLM + ABM 融合** | 无成熟方案 | ✅ 深度集成 | 新兴技术领先 |
| **监督者机制** | 无 | ✅ 独创 | 可控 AI 系统 |
| **NIM 兼容** | 部分 | 🔄 规划中 | 生态整合 |

## 增强特性：提升收购吸引力

### 1. NVIDIA NIM 深度集成

```python
# 支持 NIM 微服务作为推理后端
class NIMModelClient:
    """NVIDIA NIM 微服务客户端"""
    
    def __init__(self, nim_endpoint: str, api_key: str):
        self.endpoint = nim_endpoint
        self.api_key = api_key
    
    async def chat(self, messages: List[dict], model: str = "nemotron-mini"):
        """调用 NIM 推理服务"""
        # 支持 Nemotron 系列模型
        # 支持本地部署和云端 API
        pass
```

**价值**：成为 NIM 生态的多智能体应用层

### 2. Isaac Sim / Omniverse 桥接

```python
# ABM-LLM ←→ Isaac Sim 双向通信
class Isaacn    """Isaac Sim 仿真桥接"""
    
    async def sync_agent_state(self, agent_id: str, physical_state: dict):
        """同步物理状态到认知智能体"""
        pass
    
    async def send_decision(self, agent_id: str, action: dict):
        """发送认知决策到物理仿真"""
        pass
```

**场景**：
- 仓库物流：Isaac Sim 仿真机器人移动 + ABM-LLM 仿真调度决策
- 自动驾驶：Isaac Sim 仿真车辆 + ABM-LLM 仿真交通参与者行为
- 智能工厂：Isaac Sim 仿真产线 + ABM-LLM 仿真工人协作

### 3. ACE 数字人集成

```python
# 智能体可视化为数字人
class ACEAvatarAdapter:
    """NVIDIA ACE 数字人适配器"""
    
    async def render_agent_response(self, agent: Agent, response: str):
        """将智能体响应渲染为数字人"""
        # 调用 ACE Audio2Face
        # 调用 ACE Riva TTS
        pass
```

**场景**：
- 多人会议仿真：每个智能体对应一个数字人
- 客服培训：客户/客服/主管都是可视化数字人
- 虚拟董事会：高管角色以数字人形式呈现

### 4. 企业级特性（对标 Run:ai 收购）

```python
# GPU 资源编排（类似 Run:ai）
class GPUResourceManager:
    """GPU 资源管理"""
    
    def allocate_for_simulation(self, num_agents: int, model_size: str):
        """为仿真分配 GPU 资源"""
        pass
    
    def scale_inference(self, load: float):
        """动态扩缩推理资源"""
        pass
```

### 5. 合成数据生成（对标 Gretel 收购）

```python
# 通过仿真生成训练数据
class SimulationDataGenerator:
    """仿真数据生成器"""
    
    async def generate_conversation_dataset(
        self, 
        scenario: str, 
        num_samples: int,
        variation_params: dict
    ):
        """生成对话数据集"""
        # 运行多次仿真
        # 变化参数生成多样性数据
        # 输出标准格式训练数据
        pass
```

**价值**：用仿真生成高质量、多样化的 AI 训练数据

## 重新定义产品愿景

### 从"编排工具"到"认知仿真平台"

```
┌─────────────────────────────────────────────────────────────────┐
│                 ABM-LLM: 认知智能体仿真平台                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   编排层    │  │   仿真层    │  │   可视化层   │             │
│  │  Workflow   │  │  Simulation │  │ Visualization│             │
│  │  ReactFlow  │  │  ABM Engine │  │  ACE/3D/2D  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────┐             │
│  │              智能体运行时 (Agent Runtime)      │             │
│  │  - 多角色协作    - 监督者机制    - MCP工具     │             │
│  │  - 环境变量      - 规则引擎      - 记忆系统    │             │
│  └───────────────────────────────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────┐             │
│  │              推理层 (Inference Layer)          │             │
│  │  - NVIDIA NIM    - OpenAI    - 本地模型       │             │
│  └───────────────────────────────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────┐             │
│  │              集成层 (Integration Layer)        │             │
│  │  - Isaac Sim     - Omniverse   - 企业系统     │             │
│  └───────────────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 核心价值主张

**"ABM-LLM 是连接 NVIDIA 物理仿真（Isaac Sim）和认知 AI（NIM/Nemotron）的桥梁，
为企业提供完整的智能体仿真和决策支持能力。"**

## 与竞品的重新对比

| 维度 | Dify/RAGFlow/FastGPT | NetLogo/Mesa | NVIDIA ACE | **ABM-LLM** |
|------|---------------------|--------------|------------|-------------|
| **定位** | LLM 应用开发 | 学术仿真 | 数字人 | **认知仿真平台** |
| **智能体数量** | 单个为主 | 大规模 | 单个 | **多智能体协作** |
| **认知能力** | LLM 调用 | 规则/简单 | LLM 对话 | **LLM + 角色 + 记忆** |
| **物理仿真** | 无 | 简单 | 无 | **Isaac Sim 集成** |
| **可视化** | 流程图 | 2D 网格 | 3D 数字人 | **多模态** |
| **企业级** | 部分 | 弱 | 强 | **强** |
| **NVIDIA 生态** | 无 | 无 | 原生 | **深度集成** |

## 与现有功能的深度融合

### 1. 跨行动空间编排（联合空间）

基于现有的 `JointSpaceManagement` 功能，编排模式可以**跨越多个行动空间**，实现更复杂的仿真场景。

```
┌─────────────────────────────────────────────────────────────────┐
│                    跨空间编排示例：供应链仿真                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ 矿产资源空间 │───▶│半导体制造空间│───▶│ 手机制造空间 │        │
│  │  原材料供应  │    │  芯片生产   │    │  终端组装   │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                 │                  │                 │
│         ▼                 ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │              跨空间编排流程                          │      │
│  │  1. 矿产空间.采购员 → 评估原材料供应                 │      │
│  │  2. [条件] 如果供应紧张 → 触发半导体空间.风控专家    │      │
│  │  3. 半导体空间.生产经理 → 调整产能计划               │      │
│  │  4. [并行] 通知手机空间.供应链经理 + 汽车空间.采购   │      │
│  │  5. 各空间.决策者 → 制定应对策略                     │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 跨空间编排配置

```json
{
  "type": "cross_space_orchestration",
  "spaces": [
    {"id": "space_mineral", "name": "矿产资源空间,
    {"id": "space_semiconductor", "name": "半导体制造空间"},
    {"id": "space_phone", "name": "手机制造空间"}
  ],
  "flow": [
    {
      "type": "agent",
      "space": "space_mineral",
      "agent": "采购分析师",
      "prompt": "评估当前原材料供应状况",
      "output_var": "supply_status"
    },
    {
      "type": "condition",
      "if": "{{supply_status}} contains '紧张'",
      "then": [
        {
          "type": "cross_space_trigger",
          "target_space": "space_semiconductor",
      "event": "supply_alert",
          "data": "{{supply_status}}"
        }
      ]
    },
    {
      "type": "parallel",
      "branches": [
        {
          "space": "space_semiconductor",
          "agent": "生产经理",
          "prompt": "根据原材料供应情况调整产能"
        },
        {
          "space": "space_phone",
          "agent": "供应链经理",
          "prompt": "评估芯片供应风险并制定备选方案"
        }
      ]
    }
  ],
  "variable_propagation": {
    "supply_status": {
      "from": "space_mineral",
      "to": ["space_semiconductor", "space_phone"],
      "transform": "direct"
    }
  }
}
```

#### 跨空间变量传播

利用现有的联合空间变量影响机制：

```python
class CrossSpaceVariablePropagator:
    """跨空间变量传播器"""
    
    async def propagate_variable(
        self,
        source_space_id: str,
        target_space_ids: List[str],
        variable_name: str,
        value: Any,
        propagation_rule: str = "direct"
    ):
        """
        传播变量到关联空间
        
        propagation_rule:
        - direct: 直接传递
        - delayed: 延迟传递（模拟供应链延迟）
        - transformed: 经过转换函数
        - attenuated: 衰减传递（距离越远影响越小）
        """
        pass
```

### 2. 与实体应用市场集成

编排流程可以调用实体应用市场中的工具，实现**仿真 + 实际操作**的闭环。

```
┌─────────────────────────────────────────────────────────────────┐
│                    编排 + 实体应用集成                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  编排流程                        实体应用市场                    │
│  ┌─────────────┐                ┌─────────────┐                │
│  │ 智能体决策  │───────────────▶│ VSCode      │ 代码生成/修改  │
│  └─────────────┘                └─────────────┘                │
│         │                                                       │
│         ▼                       ┌─────────────┐                │
│  ┌─────────────┐               │ NetLogo     │ ABM仿真验证    │
│  │ 条件判断    │───────────────▶│ Galapagos   │                │
│  └─────────────┘                └─────────────┘                │
│         │                                                       │
│         ▼                       ┌─────────────┐                │
│  ┌─────────────┐               │ GIS工具     │ 地理数据分析   │
│  │ 并行执行    │───────────────▶│             │                │
│  └─────────────┘                └─────────────┘                │
│         │                                                       │
│         ▼                       ┌─────────────┐                │
│  ┌─────────────┐               │ NextRPA     │ 自动化执行     │
│  │ 结果汇总    │───────────────▶│             │                │
│  └─────────────┘                └─────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 应用节点类型

```json
{
  "type": "app_invoke",
  "app_id": "netlogo-modeling",
  "action": "run_simulation",
  "params": {
    "model": "supply-chain.nlogo",
    "ticks": 100,
    "variables": {
      "supply-rate": "{{supply_status.rate}}",
      "demand-rate": "{{market_demand}}"
    }
  },
  "output_var": "simulation_result"
}
```

#### 支持的应用集成

| 应用 | 集成方式 | 编排中的用途 |
|------|---------|-------------|
| **NetLogo/Galapagos** | 原生集成 | ABM仿真验证、参数扫描 |
| **VSCode Server** | API调用 | 代码生成、配置修改 |
| **GIS工具** | 数据接口 | 地理空间分析、可视化 |
| **NextRPA** | 任务触发 | 自动化执行、系统集成 |
| **OnlyOffice** | 文档API | 报告生成、数据导出 |

### 3. 编排模板市场

将编排流程作为可复用的模板，在实体应用市场中发布和共享。

```typescript
interface OrchestrationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;  // 供应链、金融、医疗等
  
  // 模板定义
  flow: FlowNode[];
  
  // 所需资源
  required_roles: string[];      // 需要的角色类型
  required_apps: string[];       // 需要的实体应用
  required_spaces?: number;      // 需要的行动空间数量（跨空间模板）
  
  // 参数化配置
  parameters: {
    name: string;
    type: 'string' | 'number' | 'select';
    default?: any;
    options?: any[];
    description: string;
  }[];
  
  // 元数据
  author: string;
  version: string;
  downloads: number;
  rating: number;
}
```

#### 模板市场分类

```
实体应用市场
├── 开发工具
│   ├── VSCode Server
│   └── ...
├── 建模工具
│   ├── NetLogo/Galapagos
│   └── ...
├── 编排模板 ← 新增
│   ├── 供应链仿真
│   │   ├── 多级供应链协调
│   │   ├── 库存优化决策
│   │   └── 风险传导分析
│   ├── 金融分析
│   │   ├── 投资组合优化
│   │   ├── 风险评估流程
│   │   └── 合规审查流程
│   ├── 组织管理
│   │   ├── 项目评审流程
│   │   ├── 招聘决策流程
│   │   └── 绩效评估流程
│   └── 自定义模板
└── 其他工具
```

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    ActionSpace 详情页                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    编排 Tab                          │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │         ReactFlow 编排编辑器                 │    │   │
│  │  │  - 节点面板（左）                            │    │   │
│  │  │  - 画布（中）                               │    │   │
│  │  │  - 配置面板（右）                           │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 保存/执行
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端服务                                │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │ ActionSpace     │    │ TaskScheduler               │    │
│  │ orchestration   │───▶│ execution_mode:orchestration│    │
│  │ _config (JSON)  │    └─────────────────────────────┘    │
│  └─────────────────┘                  │                     │
└───────────────────────────────────────│─────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      executor.py                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ sequential  │ │   dynamic   │ │   orchestration     │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 数据模型扩展

```python
# ActionSpace 表新增字段
class ActionSpace(db.Model):
    # ... 现有字段 ...
    
    # 编排配置（JSON）
    orchestration_config = db.Column(JSON, nullable=True)
    # {
    #   "flow": [...],           # 流程定义
    #   "variables": {...},      # 输入变量定义
    #   "reactflow": {...}       # ReactFlow 画布状态（节点位置等）
    # }
```

### UI 入口（与现有 Tab 风格一致）

```
ActionSpace 详情页（参考 ActionSpaceDetail.tsx）
├── Tab: 基本信息 (basic)
├── Tab: 角色管理 (roles)
├── Tab: 监督者 (observer)
├── Tab: 环境变量 (environment)
├── Tab: 规则关联 (rules)
└── Tab: 编排 (orchestration) ← 新增
    ├── 工具栏：[保存] [运行] [导入] [导出] [从模板创建]
    ├── 左侧：节点面板（拖拽源）
    │   ├── 开始/结束
    │   ├── 智能体节点（从角色管理中选择）
    │   ├── 条件分支
    │   ├── 并行执行
    │   ├── 循环
    │   └── 变量操作
    ├── 中间：ReactFlow 画布
    └── 右侧：节点配置面板（Drawer）
```

### 与现有功能的深度集成

#### 1. 与角色管理联动
```tsx
// 智能体节点只能选择该 ActionSpace 已关联的角色
const agentOptions = selectedSpace.roles.map(role => ({
  id: role.id,
  name: role.name,
  description: role.description,
  additional_prompt: role.additional_prompt
}));
```

#### 2. 与环境变量联动
```tsx
// 节点可读写空间级和角色级变量
const variableOptions = [
  // 空间级变量
  ...selectedSpace.environment_variables.map(v => ({
    name: v.name,
    label: v.label,
    scope: 'space'
  })),
  // 角色级变量
  ...selectedSpace.roles.flatMap(role => 
    role.environment_variables.map(v => ({
      name: `${role.name}.${v.name}`,
      label: `${role.name} - ${v.label}`,
      scope: 'role'
    }))
  )
];
```

#### 3. 与监督者联动
```tsx
// 编排执行时，监督者可以：
// - 监控当前执行到哪个节点
// - 在条件节点处进行干预
// - 暂停/恢复/终止流程
```

#### 4. 与并行实验室联动
```tsx
// 编排流程可作为并行实验的执行模板
// 实验时扫描不同的输入变量，对比输出结果
```

### 流程节点类型

| 节点类型 | 说明 | 配置示例 |
|---------|------|---------|
| `agent` | 单个智能体执行 | `{"type": "agent", "agent": "分析师", "prompt": "..."}` |
| `condition` | 条件分支 | `{"type": "condition", "if": "...", "then": [...], "else": [...]}` |
| `parallel` | 并行执行 | `{"type": "parallel", "agents": ["A", "B"]}` |
| `loop` | 循环执行 | `{"type": "loop", "until": "...", "max": 10, "steps": [...]}` |
| `variable` | 设置/读取变量 | `{"type": "variable", "set": {"key": "value"}}` |

## 数据结构

### Flow 配置 JSON Schema

```json
{
  "flow": [
    {
      "type": "agent",
      "agent": "分析师",
      "prompt": "分析市场数据：{{input.market_data}}",
      "output_var": "analysis_result"
    },
    {
      "type": "condition",
      "if": "{{analysis_result}} contains '风险'",
      "then": [
        {
          "type": "agent",
          "agent": "风控专家",
          "prompt": "评估风险：{{analysis_result}}"
        }
      ],
      "else": [
        {
          "type": "agent",
          "agent": "执行者",
          "prompt": "执行策略：{{analysis_result}}"
        }
      ]
    },
    {
      "type": "parallel",
      "agents": ["审核员A", "审核员B"],
      "prompt": "审核上述决策",
      "wait_all": true
    },
    {
      "type": "agent",
      "agent": "总结者",
      "prompt": "汇总所有结果"
    }
  ],
  "variables": {
    "input": {
      "market_data": "{{task_var.market_data}}"
    }
  }
}
```

### 变量模板语法

| 语法 | 说明 | 示例 |
|------|------|------|
| `{{input.xxx}}` | 输入变量 | `{{input.topic}}` |
| `{{prev_output}}` | 上一步输出 | `{{prev_output}}` |
| `{{step_N_output}}` | 第N步输出 | `{{step_1_output}}` |
| `{{agent_xxx_output}}` | 指定智能体输出 | `{{agent_分析师_output}}` |
| `{{task_var.xxx}}` | 任务环境变量 | `{{task_var.nextAgent}}` |

### 条件表达式

支持简单的条件判断：

```
# 包含判断
"{{prev_output}} contains '风险'"

# 变量比较
"{{task_var.score}} > 80"

# 逻辑组合
"{{prev_output}} contains '风险' AND {{task_var.level}} == 'high'"
```

## 后端实现

### 1. 新增执行函数 `_execute_orchestration()`

位置：`backend/app/services/scheduler/executor.py`

```python
async def _execute_orchestration(task: 'Task') -> None:
    """
    编排模式执行
    
    按照 flow 配置顺序执行节点，支持条件分支和并行
    """
    cfg = task.execution_config or {}
    flow = cfg.get('flow', [])
    variables = cfg.get('variables', {})
    
    # 初始化执行上下文
    context = OrchestrationContext(task, variables)
    
    for i, node in enumerate(flow):
        if task.cancel_event and task.cancel_event.is_set():
            break
        
        await task.pause_event.wait()
        
        node_type = node.get('type', 'agent')
        
        if node_type == 'agent':
            await _execute_agent_node(task, node, context)
        elif node_type == 'condition':
            await _execute_condition_node(task, node, context)
        elif node_type == 'parallel':
            await _execute_parallel_node(task, node, context)
        elif node_type == 'loop':
            await _execute_loop_node(task, node, context)
        elif node_type == 'variable':
            _execute_variable_node(node, context)
```

### 2. 节点执行器

```python
async def _execute_agent_node(task: 'Task', node: dict, context: 'OrchestrationContext'):
    """执行单个智能体节点"""
    agent_name = node.get('agent')
    prompt_template = node.get('prompt', '')
    output_var = node.get('output_var')
    
    # 解析模板变量
    prompt = context.render_template(prompt_template)
    
    # 查找智能体
    agent = await _find_agent_by_name(task, agent_name)
    if not agent:
        raise ValueError(f"Agent not found: {agent_name}")
    
    # 设置动态提示
    task.context['dynamic_prompt'] = prompt
    
    # 发送节点信息
    _send_node_info(task, node, context.current_step)
    
    # 执行智能体
    await _process_agent_response(task, agent)
    
    # 保存输出
    if output_var:
        context.set_variable(output_var, context.last_output)
    
    context.current_step += 1


async def _execute_condition_node(task: 'Task', node: dict, context: 'OrchestrationContext'):
    """执行条件分支节点"""
    condition = node.get('if', '')
    then_branch = node.get('then', [])
    else_branch = node.get('else', [])
    
    # 评估条件
    result = context.evaluate_condition(condition)
    
    # 执行对应分支
    branch = then_branch if result else else_branch
    for sub_node in branch:
        if task.cancel_event and task.cancel_event.is_set():
            break
        await _execut, sub_node, context)


async def _execute_parallel_node(task: 'Task', node: dict, context: 'OrchestrationContext'):
    """执行并行节点"""
    agent_names = node.get('agents', [])
    prompt = context.render_template(node.get('prompt', ''))
    wait_all = node.get('wait_all', True)
    
    agents = []
    for name in agent_names:
        agent = await _find_agent_by_name(task, name)
        if agent:
            agents.append(agent)
    
    if wait_all:
        # 等待所有完成
        await asyncio.gather(*[
            _process_agent_with_prompt(task, agent, prompt)
            for agent in agents
        ])
    else:
        # 任一完成即可
        done, pending = await asyncio.wait(
            [_process_agent_with_prompt(task, agent, prompt) for agent in agents],
            return_when=asyncio.FIRST_COMPLETED
        )
        for p in pending:
            p.cancel()
```

### 3. 执行上下文类

```python
@dataclass
class OrchestrationContext:
    """编排执行上下文"""
    task: 'Task'
    variables: Dict[str, Any]
    outputs: Dict[str, str] = field(default_factory=dict)
    current_step: int = 0
    last_output: str = ""
    
    def render_template(self, template: str) -> str:
        """渲染模板变量"""
        result = template
        
        # 替换 {{prev_output}}
        result = result.replace('{{prev_output}}', self.last_output)
        
        # 替换 {{step_N_output}}
        for key, value in self.outputs.items():
            result = result.replace(f'{{{{{key}}}}}', str(value))
        
        # 替换 {{input.xxx}}
        for key, value in self.variables.items():
            if isinstance(value, dict):
                for k, v in value.items():
                    result = result.replace(f'{{{{input.{k}}}}}', str(v))
            else:
                result = result.replace(f'{{{{input.{key}}}}}', str(value))
        
        # 替换 {{task_var.xxx}}
        result = self._replace_task_vars(result)
        
        return result
    
    def evaluate_condition(self, condition: str) -> bool:
        """评估条件表达式"""
        rendered = self.render_template(condition)
        
        # 简单的条件解析
        if ' contains ' in rendered:
            parts = rendered.split(' contains ')
            return parts[1].strip("'\"") in parts[0]
        
        if ' > ' in rendered:
            parts = rendered.split(' > ')
            return float(parts[0]) > float(parts[1])
        
        if ' == ' in rendered:
            parts = rendered.split(' == ')
            return parts[0].strip() == parts[1].strip("'\"")
        
        return bool(rendered)
    
    def set_variable(self, name: str, value: Any):
        """设置变量"""
        self.outputs[name] = value
        self.variables[name] = value
```

### 4. 修改 `execute_round()` 分发

```python
async def execute_round(task: 'Task') -> None:
    mode = task.execution_mode
    
    if mode == "sequential" or mode == "loop":
        await _execute_sequential(task)
    elif mode == "dynamic":
        await _execute_dynamic(task)
    elif mode == "parallel":
        await _execute_parallel(task)
    elif mode == "orchestration":  # 新增
        await _execute_orchestration(task)
    else:
        logger.warning(f"Unknown execution mode: {mode}, using sequential")
        await _execute_sequential(task)
```

## 前端实现（ReactFlow）

### 技术选型

使用 **@xyflow/react**（ReactFlow v12）作为可视化编排组件：

```bash
npm install @xyflow/react
```

**选择理由**：
- 社区活跃，文档完善
- 支持自定义节点和边
- 内置缩放、拖拽、选择等交互
- TypeScript 支持良好
- 与 React 19 兼容

### 目录结构

```
frontend/src/pages/actiontask/orchestration/
├── OrchestrationEditor.tsx      # 主编辑器组件
├── OrchestrationEditor.css      # 样式
├── nodes/                       # 自定义节点
│   ├── AgentNode.tsx           # 智能体节点
│   ├── ConditionNode.tsx       # 条件分支节点
│   ├── ParallelNode.tsx        # 并行节点
│   ├── LoopNode.tsx            # 循环节点
│   ├── StartNode.tsx           # 开始节点
│   └── EndNode.tsx             # 结束节点
├── edges/                       # 自定义边
│   └── ConditionalEdge.tsx     # 条件边（带标签）
├── panels/                      # 面板组件
│   ├── NodePalette.tsx         # 节点面板（左侧拖拽）
│   ├── NodeConfigPanel.tsx     # 节点配置面板（右侧）
│   └── ToolbarPanel.tsx        # 工具栏
├── hooks/
│   ├── useFlowState.ts         # 流程状态管理
│   └── useFlowValidation.ts    # 流程验证
├── utils/
│   ├── flowToJson.ts           # ReactFlow → JSON 转换
│   ├── jsonToFlow.ts           # JSON → ReactFlow 转换
│   └── flowValidation.ts       # 流程验证逻辑
└── types.ts                     # 类型定义
```

### 核心组件实现

#### 1. 主编辑器组件

```tsx
// OrchestrationEditor.tsx
import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode, ConditionNode, ParallelNode, StartNode, EndNode } from './nodes';
import { ConditionalEdge } from './edges';
import { NodePalette } from './panels/NodePalette';
import { NodeConfigPanel } from './panels/NodeConfigPanel';
import { ToolbarPanel } from './panels/ToolbarPanel';
import { flowToJson, jsonToFlow } from './utils';

const nodeTypes = {
  agent: AgentNode,
  condition: ConditionNode,
  parallel: ParallelNode,
  loop: LoopNode,
  start: StartNode,
  end: EndNode,
};

const edgeTypes = {
  conditional: ConditionalEdge,
};

interface OrchestrationEditorProps {
  initialFlow?: FlowConfig;
  agents: Agent[];
  onSave: (flow: FlowConfig) => void;
  onRun: (flow: FlowConfig) => void;
}

export const OrchestrationEditor: React.FC<OrchestrationEditorProps> = ({
  initialFlow,
  agents,
  onSave,
  onRun,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialFlow ? jsonToFlow(initialFlow).nodes : []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialFlow ? jsonToFlow(initialFlow).edges : []
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: { label: getDefaultLabel(type) },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleSave = () => {
    const flowConfig = flowToJson(nodes, edges);
    onSave(flowConfig);
  };

  const handleRun = () => {
    const flowConfig = flowToJson(nodes, edges);
    onRun(flowConfig);
  };

  return (
    <div style={{ width: '100%', height: '600px', display: 'flex' }}>
      {/* 左侧节点面板 */}
      <NodePalette />

      {/* 中间画布 */}
      <div style={{ flex: 1 }} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-right">
            <ToolbarPanel onSave={handleSave} onRun={handleRun} />
          </Panel>
        </ReactFlow>
      </div>

      {/* 右侧配置面板 */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          agents={agents}
          onUpdate={(data) => {
            setNodes((nds) =>
              nds.map((n) => (n.id === selectedNode.id ? { ...n, data } : n))
            );
          }}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};
```

#### 2. 自定义节点示例

```tsx
// nodes/AgentNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Avatar, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';

interface AgentNodeData {
  agent?: string;
  agentId?: string;
  prompt?: string;
  outputVar?: string;
}

export const AgentNode: React.FC<NodeProps<AgentNodeData>> = ({ data, selected }) => {
  return (
    <Card
      size="small"
      style={{
        width: 180,
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
        <Typography.Text strong ellipsis style={{ flex: 1 }}>
          {data.agent || '选择智能体'}
        </Typography.Text>
      </div>
      
      {data.prompt && (
        <Typography.Paragraph
          ellipsis={{ rows: 2 }}
          style={{ fontSize: 12, color: '#666', marginTop: 4, marginBottom: 0 }}
        >
          {data.prompt}
        </Typography.Paragraph>
      )}
      
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};

// nodes/ConditionNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Typography } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';

interface ConditionNodeData {
  condition?: string;
}

export const ConditionNode: React.FC<NodeProps<ConditionNodeData>> = ({ data, selected }) => {
  return (
    <Card
      size="small"
      style={{
        width: 160,
        border: selected ? '2px solid #faad14' : '1px solid #d9d9d9',
        backgroundColor: '#fffbe6',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BranchesOutlined style={{ color: '#faad14' }} />
        <Typography.Text strong>条件分支</Typography.Text>
      </div>
      
      {data.condition && (
        <Typography.Text
          ellipsis
          style={{ fontSize: 11, color: '#666', display: 'block', marginTop: 4 }}
        >
          {data.condition}
        </Typography.Text>
      )}
      
      {/* 两个输出：true/false */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '30%', background: '#52c41a' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '70%', background: '#ff4d4f' }}
      />
    </Card>
  );
};

// nodes/ParallelNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Typography, Tag } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';

interface ParallelNodeData {
  agents?: string[];
  prompt?: string;
  waitAll?: boolean;
}

export const ParallelNode: React.FC<NodeProps<ParallelNodeData>> = ({ data, selected }) => {
  return (
    <Card
      size="small"
      style={{
        width: 200,
        border: selected ? '2px solid #722ed1' : '1px solid #d9d9d9',
        backgroundColor: '#f9f0ff',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ApartmentOutlined style={{ color: '#722ed1' }} />
        <Typography.Text strong>并行执行</Typography.Text>
      </div>
      
      <div style={{ marginTop: 8 }}>
        {data.agents?.map((agent) => (
          <Tag key={agent} color="purple" style={{ marginBottom: 4 }}>
            {agent}
          </Tag>
        ))}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
```

#### 3. 节点面板（拖拽源）

```tsx
// panels/NodePalette.tsx
import { Card, Typography } from 'antd';
import {
  UserOutlined,
  BranchesOutlined,
  ApartmentOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';

const nodeItems = [
  { type: 'start', label: '开始', icon: <PlayCircleOutlined />, color: '#52c41a' },
  { type: 'agent', label: '智能体', icon: <UserOutlined />, color: '#1890ff' },
  { type: 'condition', label: '条件分支', icon: <BranchesOutlined />, color: '#faad14' },
  { type: 'parallel', label: '并行执行', icon: <ApartmentOutlined />, color: '#722ed1' },
  { type: 'loop', label: '循环', icon: <ReloadOutlined />, color: '#13c2c2' },
  { type: 'end', label: '结束', icon: <StopOutlined />, color: '#ff4d4f' },
];

export const NodePalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{ width: 120, padding: 8, borderRight: '1px solid #f0f0f0' }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
        节点
      </Typography.Text>
      
      {nodeItems.map((item) => (
        <Card
          key={item.type}
          size="small"
          style={{ marginBottom: 8, cursor: 'grab' }}
          draggable
          onDragStart={(e) => onDragStart(e, item.type)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: item.color }}>{item.icon}</span>
            <Typography.Text style={{ fontSize: 12 }}>{item.label}</Typography.Text>
          </div>
        </Card>
      ))}
    </div>
  );
};
```

#### 4. 节点配置面板

```tsx
// panels/NodeConfigPanel.tsx
import { Drawer, Form, Input, Select, Switch, Button } from 'antd';
import { Node } from '@xyflow/react';

interface NodeConfigPanelProps {
  node: Node;
  agents: Agent[];
  onUpdate: (data: any) => void;
  onClose: () => void;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  agents,
  onUpdate,
  onClose,
}) => {
  const [form] = Form.useForm();

  const handleValuesChange = (_: any, allValues: any) => {
    onUpdate({ ...node.data, ...allValues });
  };

  const renderFields = () => {
    switch (node.type) {
      case 'agent':
        return (
          <>
            <Form.Item name="agent" label="智能体">
              <Select placeholder="选择智能体">
                {agents.map((a) => (
                  <Select.Option key={a.id} value={a.name}>
                    {a.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="prompt" label="提示词">
              <Input.TextArea rows={4} placeholder="输入提示词，支持 {{变量}}" />
            </Form.Item>
            <Form.Item name="outputVar" label="输出变量名">
              <Input placeholder="可选，用于后续节点引用" />
            </Form.Item>
          </>
        );

      case 'condition':
        return (
          <Form.Item name="condition" label="条件表达式">
            <Input.TextArea
              rows={3}
              placeholder="例如：{{prev_output}} contains '风险'"
            />
          </Form.Item>
        );

      case 'parallel':
        return (
          <>
            <Form.Item name="agents" label="并行智能体">
              <Select mode="multiple" placeholder="选择多个智能体">
                {agents.map((a) => (
                  <Select.Option key={a.id} value={a.name}>
                    {a.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="prompt" label="统一提示词">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="waitAll" label="等待全部完成" valuePropName="checked">
              <Switch defaultChecked />
            </Form.Item>
          </>
        );

      case 'loop':
        return (
          <>
            <Form.Item name="until" label="终止条件">
              <Input placeholder="例如：{{task_var.approved}} == 'true'" />
            </Form.Item>
            <Form.Item name="max" label="最大循环次数">
              <Input type="number" defaultValue={5} />
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Drawer
      title="节点配置"
      placement="right"
      width={320}
      open={!!node}
      onClose={onClose}
      mask={false}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={node.data}
        onValuesChange={handleValuesChange}
      >
        {renderFields()}
      </Form>
    </Drawer>
  );
};
```

#### 5. 流程转换工具

```tsx
// utils/flowToJson.ts
import { Node, Edge } from '@xyflow/react';
import { FlowConfig, FlowNode } from '../types';

export function flowToJson(nodes: Node[], edges: Edge[]): FlowConfig {
  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) {
    throw new Error('流程必须有开始节点');
  }

  const flow: FlowNode[] = [];
  const visited = new Set<string>();

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type === 'end') return;

    if (node.type !== 'start') {
      flow.push(nodeToFlowNode(node));
    }

    // 找到下一个节点
    const outEdges = edges.filter((e) => e.source === nodeId);
    
    if (node.type === 'condition') {
      // 条件节点：分别处理 true/false 分支
      const trueEdge = outEdges.find((e) => e.sourceHandle === 'true');
      const falseEdge = outEdges.find((e) => e.sourceHandle === 'false');
      
      const flowNode = flow[flow.length - 1];
      flowNode.then = [];
      flowNode.else = [];
      
      if (trueEdge) {
        // 递归处理 true 分支...
      }
      if (falseEdge) {
        // 递归处理 false 分支...
      }
    } else {
      // 普通节点：继续下一个
      for (const edge of outEdges) {
        traverse(edge.target);
      }
    }
  }

  // 从开始节点遍历
  const startEdges = edges.filter((e) => e.source === startNode.id);
  for (const edge of startEdges) {
    traverse(edge.target);
  }

  return { flow };
}

function nodeToFlowNode(node: Node): FlowNode {
  switch (node.type) {
    case 'agent':
      return {
        type: 'agent',
        agent: node.data.agent,
        prompt: node.data.prompt,
        output_var: node.data.outputVar,
      };
    case 'condition':
      return {
        type: 'condition',
        if: node.data.condition,
        then: [],
        else: [],
      };
    case 'parallel':
      return {
        type: 'parallel',
        agents: node.data.agents,
        prompt: node.data.prompt,
        wait_all: node.data.waitAll,
      };
    case 'loop':
      return {
        type: 'loop',
        until: node.data.until,
        max: node.data.max,
        steps: [],
      };
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

// utils/jsonToFlow.ts
export function jsonToFlow(config: FlowConfig): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let y = 0;

  // 添加开始节点
  nodes.push({
    id: 'start',
    type: 'start',
    position: { x: 250, y: 0 },
    data: {},
  });

  let prevNodeId = 'start';

  for (const flowNode of config.flow) {
    const nodeId = `node_${nodes.length}`;
    y += 120;

    nodes.push({
      id: nodeId,
      type: flowNode.type,
      position: { x: 250, y },
      data: flowNodeToData(flowNode),
    });

    edges.push({
      id: `edge_${edges.length}`,
      source: prevNodeId,
      target: nodeId,
    });

    prevNodeId = nodeId;
  }

  // 添加结束节点
  y += 120;
  nodes.push({
    id: 'end',
    type: 'end',
    position: { x: 250, y },
    data: {},
  });
  edges.push({
    id: `edge_${edges.length}`,
    source: prevNodeId,
    target: 'end',
  });

  return { nodes, edges };
}
```

### 集成到 ActionSpace 详情页

```tsx
// ActionSpaceDetail.tsx 中新增编排 Tab
import { OrchestrationEditor } from './orchestration/OrchestrationEditor';

// Tab 配置
const tabs = [
  { key: 'overview', label: '概览', children: <Overview /> },
  { key: 'tasks', label: '任务', children: <TaskList /> },
  { key: 'orchestration', label: '编排', children: <OrchestrationTab /> },  // 新增
  { key: 'agents', label: '智能体', children: <AgentList /> },
  { key: 'variables', label: '变量', children: <VariableList /> },
  { key: 'settings', label: '设置', children: <Settings /> },
];

// OrchestrationTab.tsx
const OrchestrationTab: React.FC<{ actionSpaceId: string }> = ({ actionSpaceId }) => {
  const { data: actionSpace } = useActionSpace(actionSpaceId);
  const { data: agents } = useActionSpaceAgents(actionSpaceId);
  
  const handleSave = async (flow: FlowConfig) => {
    await updateActionSpace(actionSpaceId, {
      orchestration_config: flow
    });
    message.success('编排配置已保存');
  };
  
  const handleRun = async (flow: FlowConfig) => {
    // 创建新的 ActionTask 并执行编排
    const task = await createOrchestrationTask(actionSpaceId, flow);
    message.success('编排任务已启动');
    // 跳转到任务详情页查看执行过程
    navigate(`/actiontask/${task.id}`);
  };
  
  return (
    <OrchestrationEditor
      initialFlow={actionSpace?.orchestration_config}
      agents={agents || []}
      onSave={handleSave}
      onRun={handleRun}
    />
  );
};
```

### 后端 API

```python
# 新增 API 路由
# PUT /api/action-spaces/{id}/orchestration
@action_space_bp.route('/<action_space_id>/orchestration', methods=['PUT'])
def update_orchestration(action_space_id):
    """更新编排配置"""
    data = request.get_json()
    action_space = ActionSpace.query.get_or_404(action_space_id)
    action_space.orchestration_config = data.get('orchestration_config')
    db.session.commit()
    return jsonify({'success': True})

# POST /api/action-spaces/{id}/orchestration/run
@action_space_bp.route('/<action_space_id>/orchestration/run', methods=['POST'])
def run_orchestration(action_space_id):
    """执行编排流程"""
    action_space = ActionSpace.query.get_or_404(action_space_id)
    
    if not action_space.orchestration_config:
        return jsonify({'error': '未配置编排流程'}), 400
    
    # 创建 ActionTask
    action_task = ActionTaskService.create_task(
        action_space_id=action_space_id,
        name=f"编排执行 - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
        task_type='orchestration'
    )
    
    # 创建 Conversation 并启动编排任务
    conversation = ConversationService.create_conversation(action_task.id)
    
    # 提交到调度器
    task = Task(
        id=str(uuid.uuid4()),
        action_task_id=action_task.id,
        conversation_id=conversation.id,
        execution_mode='orchestration',
        execution_config=action_space.orchestration_config
    )
    
    scheduler = TaskScheduler.get_instance()
    asyncio.create_task(scheduler.submit_and_start(task))
    
    return jsonify({
        'success': True,
        'action_task_id': action_task.id,
        'conversation_id': conversation.id
    })
```

## 实现计划

### Phase 1: 数据模型和后端（2天）

- [ ] ActionSpace 表新增 `orchestration_config` 字段
- [ ] 数据库迁移
- [ ] 新增 API 路由（保存/执行编排）
- [ ] 实现 `OrchestrationContext` 类
- [ ] 实现 `_execute_orchestration()` 函数
- [ ] 实现各节点执行器（agent/condition/parallel）

### Phase 2: 前端 ReactFlow 编辑器（3-4天）

- [ ] 安装 @xyflow/react 依赖
- [ ] 实现 OrchestrationEditor 主组件
- [ ] 实现自定义节点（Agent/Condition/Parallel/Loop/Start/End）
- [ ] 实现节点面板（NodePalette）
- [ ] 实现节点配置面板（NodeConfigPanel）
- [ ] 实现 flowToJson / jsonToFlow 转换工具
- [ ] 集成到 ActionSpace 详情页新增"编排"Tab

### Phase 3: 增强功能（可选）

- [ ] loop 节点支持
- [ ] 更复杂的条件表达式
- [ ] 流程模板库
- [ ] 执行历史记录
- [ ] 实时执行状态可视化（高亮当前节点）

## 示例场景

### 场景1：市场分析流程

```json
{
  "flow": [
    {
      "type": "agent",
      "agent": "数据分析师",
      "prompt": "分析最新的市场数据，识别趋势和异常",
      "output_var": "analysis"
    },
    {
      "type": "condition",
      "if": "{{analysis}} contains '风险'",
      "then": [
        {
          "type": "agent",
          "agent": "风控专家",
          "prompt": "评估以下分析中的风险：{{analysis}}"
        }
      ],
      "else": [
        {
          "type": "agent",
          "agent": "投资顾问",
          "prompt": "基于分析制定投资建议：{{analysis}}"
        }
      ]
    },
    {
      "type": "agent",
      "agent": "报告撰写员",
      "prompt": "汇总上述分析，生成最终报告"
    }
  ]
}
```

### 场景2：多人审核流程

```json
{
  "flow": [
    {
      "type": "agent",
      "agent": "申请处理员",
      "prompt": "处理申请：{{input.application}}"
    },
    {
      "type": "parallel",
      "agents": ["合规审核员", "技术审核员", "财务审核员"],
      "prompt": "审核上述申请处理结果",
      "wait_all": true
    },
    {
      "type": "agent",
      "agent": "最终审批人",
      "prompt": "综合所有审核意见，做出最终决定"
    }
  ]
}
```

### 场景3：迭代优化流程

```json
{
  "flow": [
    {
      "type": "agent",
      "agent": "方案设计师",
      "prompt": "设计初始方案：{{input.requirement}}"
    },
    {
      "type": "loop",
      "until": "{{task_var.approved}} == 'true'",
      "max": 5,
      "steps": [
        {
          "type": "agent",
          "agent": "评审专家",
          "prompt": "评审当前方案，提出改进建议"
        },
        {
          "type": "agent",
          "agent": "方案设计师",
          "prompt": "根据评审意见优化方案"
        }
      ]
    }
  ]
}
```

## 与现有功能的对比

| 特性 | sequential | dynamic | orchestration |
|------|------------|---------|---------------|
| 执行顺序 | 固定（所有Agent轮流） | 动态（nextAgent变量） | 配置定义 |
| 条件分支 | 不支持 | 智能体自主决定 | 显式配置 |
| 并行执行 | 不支持 | 不支持 | 支持 |
| 循环 | 不支持 | 智能体自主决定 | 显式配置 |
| 变量传递 | 环境变量 | nextAgentTODO | 模板变量 |
| 适用场景 | 简单讨论 | 复杂自主任务 | 结构化流程 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 配置复杂度高 | 提供模板库和示例 |
| 条件表达式解析错误 | 严格的 JSON Schema 验证 |
| 无限循环 | loop 节点强制 max 限制 |
| 智能体找不到 | 启动前验证所有智能体存在 |

## 参考资源

- 现有调度器：`backend/app/services/scheduler/`
- 执行器：`backend/app/services/scheduler/executor.py`
- 触发器：`backend/app/services/scheduler/triggers.py`
- 类似项目：Flowise, Langflow, n8n
