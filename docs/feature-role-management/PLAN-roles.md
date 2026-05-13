# 角色与智能体管理系统 - 开发计划

## 功能模块概述

为智能体管理菜单升级为角色与智能体系统，增强角色管理能力，实现智能体多样化配置，包括知识库挂载、工具使用、记忆管理等高级功能。

## 后端开发计划

### 数据模型调整

- [ ] 重构Agent模型为Role模型
  - [ ] 迁移现有数据结构
  - [ ] 添加知识库关联字段
  - [ ] 添加工具关联字段
  - [ ] 添加记忆模块相关字段
- [ ] 创建Knowledge模型（知识库）
  - [ ] 基础信息：名称、描述、类型
  - [ ] 内容存储：文本/向量/结构化数据
  - [ ] 权限控制
- [ ] 创建Tool模型（工具能力）
  - [ ] 基础信息：名称、描述、类型
  - [ ] 配置参数
  - [ ] 使用权限
- [ ] 创建Memory模型（记忆分区）
  - [ ] 基础信息：名称、关联角色
  - [ ] 记忆类型：短期/长期/情感等
  - [ ] 记忆内容存储
  - [ ] 知识转化机制
- [ ] 创建RoleTool关联模型
- [ ] 创建RoleKnowledge关联模型
- [ ] 数据库迁移脚本：将agent数据迁移到role

### API开发

#### 角色配置API

- [x] 获取所有角色 (GET /api/roles)
- [x] 获取角色详情 (GET /api/roles/:id)
- [x] 创建角色 (POST /api/roles)
- [x] 更新角色 (PUT /api/roles/:id)
- [x] 删除角色 (DELETE /api/roles/:id)
- [x] 获取预定义角色列表 (GET /api/roles/predefined)
- [x] 从预定义角色创建 (POST /api/roles/from-predefined/:id)
- [ ] 获取角色OpenAI兼容的接口 (GET /api/roles/:role_id/openai)
- [ ] 使用角色OpenAI兼容接口 (POST /api/roles/:role_id/openai/chat)

#### 知识库管理API

- [ ] 获取所有知识库 (GET /api/knowledges)
- [ ] 获取知识库详情 (GET /api/knowledges/:id)
- [ ] 创建知识库 (POST /api/knowledges)
- [ ] 更新知识库 (PUT /api/knowledges/:id)
- [ ] 删除知识库 (DELETE /api/knowledges/:id)
- [ ] 为角色挂载知识库 (POST /api/roles/:role_id/knowledges/:knowledge_id)
- [ ] 为角色解除知识库 (DELETE /api/roles/:role_id/knowledges/:knowledge_id)
- [ ] 获取角色挂载的知识库 (GET /api/roles/:role_id/knowledges)

#### 能力与工具API

- [ ] 获取所有工具 (GET /api/tools)
- [ ] 获取工具详情 (GET /api/tools/:id)
- [ ] 创建工具 (POST /api/tools)
- [ ] 更新工具 (PUT /api/tools/:id)
- [ ] 删除工具 (DELETE /api/tools/:id)
- [ ] 为角色分配工具 (POST /api/roles/:role_id/tools/:tool_id)
- [ ] 为角色移除工具 (DELETE /api/roles/:role_id/tools/:tool_id)
- [ ] 获取角色可用工具 (GET /api/roles/:role_id/tools)
- [ ] 使用工具 (POST /api/tools/:id/execute)

#### 智能体观测API

- [ ] 获取角色创建的智能体 (GET /api/roles/:role_id/agents)
- [ ] 创建智能体 (POST /api/roles/:role_id/agents)
- [ ] 获取智能体详情 (GET /api/agents/:id)
- [ ] 删除智能体 (DELETE /api/agents/:id)
- [ ] 获取智能体状态 (GET /api/agents/:id/status)
- [ ] 获取智能体记忆 (GET /api/agents/:id/memories)
- [ ] 更新智能体状态 (PUT /api/agents/:id/status)

#### 记忆管理API

- [ ] 获取所有记忆分区 (GET /api/memories)
- [ ] 创建记忆分区 (POST /api/memories)
- [ ] 获取记忆分区详情 (GET /api/memories/:id)
- [ ] 更新记忆分区 (PUT /api/memories/:id)
- [ ] 删除记忆分区 (DELETE /api/memories/:id)
- [ ] 获取角色的记忆分区 (GET /api/roles/:role_id/memories)
- [ ] 为角色添加记忆 (POST /api/roles/:role_id/memories/:memory_id/entries)
- [ ] 获取角色记忆内容 (GET /api/roles/:role_id/memories/:memory_id/entries)
- [ ] 将记忆转化为知识库 (POST /api/memories/:id/to-knowledge)

### 服务层开发

- [x] RoleService（角色服务）
  - [x] 基本CRUD操作
  - [ ] 角色能力管理
  - [ ] 关联关系管理
  - [ ] OpenAI兼容接口
- [ ] KnowledgeService（知识库服务）
  - [ ] 知识库CRUD
  - [ ] 知识内容管理
  - [ ] 知识检索功能
- [ ] ToolService（工具服务）
  - [ ] 工具CRUD
  - [ ] 工具执行能力
  - [ ] 安全控制
- [ ] AgentService（智能体服务）
  - [ ] 智能体创建
  - [ ] 角色特性继承
  - [ ] 状态管理
  - [ ] 记忆管理
- [ ] MemoryService（记忆服务）
  - [ ] 记忆CRUD
  - [ ] 记忆内容管理
  - [ ] 记忆到知识转化

## 前端开发计划

### 页面组件开发

#### 角色配置页面

- [x] 将Agents页面改造为Roles页面
- [x] 角色管理界面
  - [x] 角色列表组件
  - [x] 角色创建/编辑模态框
  - [ ] 预定义角色选择组件
  - [x] 角色详情展示
  - [ ] OpenAI兼容接口配置组件

#### 知识库管理页面

- [ ] 知识库列表组件
- [ ] 知识库创建/编辑模态框
- [ ] 知识内容查看组件
- [ ] 知识库挂载组件

#### 能力与工具页面

- [ ] 工具列表组件
- [ ] 工具创建/编辑模态框
- [ ] 工具配置界面
- [ ] 权限分配组件

#### 智能体查看页面

- [ ] 智能体列表组件
- [ ] 智能体创建组件
- [ ] 智能体状态监控

#### 记忆管理页面

- [ ] 记忆分区列表组件
- [ ] 记忆创建/编辑模态框
- [ ] 记忆内容浏览组件
- [ ] 记忆知识转化组件

### 前端服务层

- [x] rolesAPI
  - [x] 基本CRUD操作
  - [ ] 角色关联操作
  - [ ] OpenAI兼容接口操作
- [ ] knowledgeAPI
  - [ ] 知识库操作
  - [ ] 知识内容管理
- [ ] toolsAPI
  - [ ] 工具操作
  - [ ] 工具执行
- [ ] agentsAPI
  - [ ] 智能体操作
- [ ] memoryAPI
  - [ ] 记忆操作
  - [ ] 记忆内容管理

### 路由配置

- [x] 更新路由配置
  - [x] 将"/agents"路由改为"/roles"
  - [x] 添加新的路由：
    - [x] "/roles/management"
    - [ ] "/roles/knowledges"
    - [ ] "/roles/tools"
    - [ ] "/roles/agents"
    - [ ] "/roles/memories"

## 测试计划

### 单元测试

- [ ] Role模型测试
- [ ] Knowledge模型测试
- [ ] Tool模型测试
- [ ] Memory模型测试
- [ ] 服务层测试

### API测试

- [ ] 角色API测试
- [ ] 知识库API测试
- [ ] 工具API测试
- [ ] 智能体API测试
- [ ] 记忆API测试

### 集成测试

- [ ] 角色-知识库关联测试
- [ ] 角色-工具关联测试
- [ ] 角色-记忆关联测试
- [ ] 角色创建智能体测试

### 前端测试

- [ ] 组件渲染测试
- [ ] 用户交互测试
- [ ] API调用测试

## 文档

- [ ] 更新API.md，记录所有新API
- [ ] 更新README.md，添加新功能介绍
- [ ] 编写开发文档
- [ ] 编写用户使用文档

## 部署

- [ ] 数据库迁移脚本
- [ ] 升级指南
- [ ] 备份与恢复方案 