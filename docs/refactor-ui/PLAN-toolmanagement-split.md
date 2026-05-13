# ToolManagement 组件拆分计划

> 当前状态: 1759行超大组件  
> 目标: 拆分为多个可维护的小组件，提升性能和可维护性  
> 预计收益: 性能提升 40-50%，代码可读性显著提升

---

## 📊 当前组件分析

### 文件信息
- **文件路径**: `frontend/src/pages/roles/ToolManagement.js`
- **代码行数**: 1759行
- **复杂度**: 极高 ⚠️
- **主要功能**: 能力管理（Capability Management）为主，工具关联为辅

### 功能模块识别

#### 1. 状态管理（~50个状态变量）

**数据状态**:
- `tools` - 工具列表
- `capabilities` - 能力列表（主要数据）
- `categories` - 分类列表
- `tempCategories` - 临时分类列表
- `roles` - 角色列表
- `roleCapabilityMap` - 角色与能力映射
- `capabilityToolsMap` - 能力与工具映射
- `mcpServers` - MCP服务器列表
- `serverTools` - 服务器工具映射
- `serverCapabilityMap` - 服务器能力映射

**加载状态**:
- `loading` - 工具加载状态
- `loadingCapabilities` - 能力加载状态
- `loadingRoles` - 角色加载状态
- `mcpServersLoading` - MCP服务器加载状态
- `loadingServerTools` - 服务器工具加载状态（对象）

**UI状态**:
- `modalVisible` - 工具Modal（实际未使用）
- `capabilityModalVisible` - 能力Modal
- `assignModalVisible` - 角色关联Modal
- `assignToolsModalVisible` - 工具关联Modal
- `assignServerModalVisible` - 服务器能力关联Modal
- `selectedCapability` - 选中的能力
- `selectedServer` - 选中的服务器
- `selectedRoles` - 选中的角色列表
- `selectedCapabilities` - 选中的能力列表
- `selectedTools` - 选中的工具列表
- `expandedRowKeys` - 展开的表格行
- `customCategoryName` - 自定义分类名称

**表单和编辑状态**:
- `editingId` - 编辑中的工具ID（实际未使用）
- `editingCapabilityId` - 编辑中的能力ID
- `form` - 工具表单（实际未使用）
- `capabilityForm` - 能力表单
- `assignForm` - 角色关联表单
- `assignToolsForm` - 工具关联表单
- `assignServerForm` - 服务器能力关联表单

**分页状态**:
- `capabilityPagination` - 能力表格分页
- `toolPagination` - 工具表格分页（实际未使用）

#### 2. 数据获取函数（~400行）

**能力相关** (核心功能):
- `fetchCapabilities()` - 获取能力列表（~80行，包含复杂的数据处理）
- `fetchCategories()` - 获取分类列表
- `fetchCapabilityTools()` - 获取能力与工具关联
- `handleSubmitCapability()` - 创建/更新能力（~50行）
- `handleDeleteCapability()` - 删除能力

**角色相关**:
- `fetchRoles()` - 获取角色列表和关联信息（~30行）
- `handleAssignRoles()` - 关联角色到能力（~30行）

**工具相关** (未充分使用):
- `fetchTools()` - 获取工具列表
- `handleSubmitTool()` - 创建/更新工具（实际未在页面使用）
- `handleDeleteTool()` - 删除工具（实际未在页面使用）

**MCP服务器相关**:
- `fetchMcpServers()` - 获取MCP服务器列表
- `fetchServerTools()` - 获取单个服务器工具列表（~40行）
- `fetchAllServerTools()` - 获取所有服务器工具列表（~40行）
- `startServer()` - 启动MCP服务器
- `stopServer()` - 停止MCP服务器
- `handleAssignCapabilities()` - 关联能力到服务器（~30行）

**分类相关**:
- `addCustomCategory()` - 添加自定义分类
- `handleCustomCategoryInput()` - 处理自定义分类输入
- `handleCustomCategorySelect()` - 处理自定义分类选择

#### 3. 工具关联相关函数（~300行）

**TreeSelect组件相关**:
- `convertToTreeData()` - 将服务器和工具转换为树形结构（~70行）
- `handleTreeSelectChange()` - 处理TreeSelect选择变化（~60行）
- `renderTreeSelectTags()` - 渲染自定义标签（~80行）
- `getTreeSelectProps()` - 获取TreeSelect通用配置（~30行）
- `handleAssignTools()` - 保存工具关联（~30行）

#### 4. Modal函数（~100行）
- `showCreateToolModal()` - 显示创建工具Modal（未使用）
- `showEditToolModal()` - 显示编辑工具Modal（未使用）
- `showCreateCapabilityModal()` - 显示创建能力Modal（~15行）
- `showEditCapabilityModal()` - 显示编辑能力Modal（~30行）
- `showAssignRoleModal()` - 显示角色关联Modal（~15行）
- `showAssignCapabilityModal()` - 显示服务器能力关联Modal（~15行）
- `showAssignToolsModal()` - 显示工具关联Modal（~25行）

#### 5. 工具函数（~50行）
- `getApiBaseUrl()` - 获取API基础URL
- `renderToolParams()` - 渲染工具参数（~30行）
- `handleExpand()` - 处理表格行展开

#### 6. 渲染和表格配置（~600行）

**能力表格列配置** (`capabilityColumns`):
- 名称列（带图标）
- 描述提示词列
- 类型列（带标签渲染）
- 来源列（系统/共享/私有）
- 关联服务器/工具列（Popover显示详情）
- 关联角色列（Popover显示详情）
- 安全级别列
- 默认启用列
- 操作列（编辑/关联角色/删除）

**统计信息**:
- 按类型分类的能力统计
- `coreCapabilities`, `advancedCapabilities`, `supervisionCapabilities`, `executionCapabilities`, `specializedCapabilities`

**Modal UI** (~300行):
- 能力编辑Modal (capabilityModalVisible) - ~120行
  - 基本信息（name, description, type, icon）
  - 安全级别和默认启用
  - 共享选项
  - 工具关联TreeSelect
- 角色关联Modal (assignModalVisible) - ~30行
- 工具关联Modal (assignToolsModalVisible) - ~50行
- 服务器能力关联Modal (assignServerModalVisible) - ~40行

#### 7. useEffect钩子（~5个）
- 初始加载数据（能力、分类、工具、MCP服务器）
- 从现有能力中提取自定义类型
- 能力加载完成后获取角色列表

---

## 🎯 拆分方案（KISS原则）

> 参考 RoleManagement 和 ModelConfigsPage 的成功经验：平级拆分，避免过度嵌套

### 核心观察

**ToolManagement实际上是"能力管理"页面**，主要功能围绕能力（Capability）展开：
1. **能力CRUD** - 核心功能
2. **能力与角色关联** - 重要功能
3. **能力与工具关联** - 复杂功能（TreeSelect）
4. **能力分类管理** - 辅助功能

工具（Tool）管理代码虽然存在，但实际未在页面使用。

### 目录结构（推荐）

```
pages/roles/ToolManagement/
├── index.js                          # 主入口组件 (~200行)
├── useCapabilityData.js              # 统一数据管理Hook (~450行)
├── CapabilityTable.js                # 能力表格组件 (~400行)
├── CapabilityFormModal.js            # 能力表单Modal (~300行)
├── ToolAssociationModal.js           # 工具关联Modal (~350行)
├── AssignRoleModal.js                # 角色关联Modal (~100行)
└── utils/
    └── treeSelectHelpers.js          # TreeSelect相关工具函数 (~200行)
```

**总计**: 7个文件，单文件最大450行

### 设计思路

1. **统一的数据Hook** (`useCapabilityData.js`): 
   - 集中管理所有数据获取、CRUD操作、状态管理
   - 包含能力、角色、工具、MCP服务器、分类的所有数据操作
   
2. **能力表格组件** (`CapabilityTable.js`):
   - 能力列表展示
   - 统计信息展示
   - 操作按钮（编辑、关联角色、删除）
   - 使用React.memo优化

3. **能力表单Modal** (`CapabilityFormModal.js`):
   - 能力基本信息表单
   - 分类选择（含自定义分类）
   - 简化版工具关联（仅显示，详细编辑在专门Modal）

4. **工具关联Modal** (`ToolAssociationModal.js`):
   - 专门用于管理能力与工具的关联
   - TreeSelect组件和相关逻辑
   - 服务器-工具层级选择

5. **角色关联Modal** (`AssignRoleModal.js`):
   - 简单的角色多选
   - 保存关联关系

6. **TreeSelect工具函数** (`utils/treeSelectHelpers.js`):
   - 将服务器和工具转换为树形结构
   - 处理树形选择变化
   - 自定义标签渲染

---

## 📝 详细拆分步骤

### Step 1: 创建统一数据Hook

**文件**: `useCapabilityData.js` (~450行)

**核心思路**: 类似RoleManagement的useRoleManagement.js，集中管理所有数据和操作

```javascript
// useCapabilityData.js
import { useState, useCallback, useEffect } from 'react';
import { App } from 'antd';
import axios from 'axios';
import capabilityAPI from '../../../services/api/capability';
import toolAPI from '../../../services/api/tool';
import { roleAPI } from '../../../services/api/role';

// 获取API基础URL的帮助函数
const getApiBaseUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:8080';
};

export const useCapabilityData = () => {
  const { message, modal } = App.useApp();
  
  // ============ 数据状态 ============
  const [capabilities, setCapabilities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tempCategories, setTempCategories] = useState([]); // 临时分类
  const [roles, setRoles] = useState([]);
  const [roleCapabilityMap, setRoleCapabilityMap] = useState({});
  const [capabilityToolsMap, setCapabilityToolsMap] = useState({});
  const [tools, setTools] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [serverTools, setServerTools] = useState({});
  const [serverCapabilityMap, setServerCapabilityMap] = useState({});
  
  // ============ 加载状态 ============
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [mcpServersLoading, setMcpServersLoading] = useState(false);
  const [loadingServerTools, setLoadingServerTools] = useState({});
  
  // ============ 能力相关方法 ============
  
  // 获取能力列表
  const fetchCapabilities = useCallback(async () => {
    try {
      setLoadingCapabilities(true);
      const response = await capabilityAPI.getAll();
      
      // 确定正确的数据路径
      let capabilitiesData = [];
      if (Array.isArray(response.data)) {
        capabilitiesData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        capabilitiesData = response.data.data;
      } else if (Array.isArray(response)) {
        capabilitiesData = response;
      }
      
      // 过滤无效数据
      const validCapabilities = capabilitiesData.filter(cap =>
        cap && cap.name && typeof cap.name === 'string' && cap.id
      );
      
      // 使用Map进行去重，以name为键
      const uniqueCapabilities = new Map();
      validCapabilities.forEach(cap => {
        if (!uniqueCapabilities.has(cap.name)) {
          uniqueCapabilities.set(cap.name, cap);
        }
      });
      
      const uniqueCapabilitiesArray = Array.from(uniqueCapabilities.values());
      setCapabilities(uniqueCapabilitiesArray);
      
      // 提取能力与工具/服务器的关联关系
      const toolsMap = {};
      uniqueCapabilitiesArray.forEach(cap => {
        if (cap.tools) {
          try {
            const toolsData = typeof cap.tools === 'string'
              ? JSON.parse(cap.tools)
              : cap.tools;
            toolsMap[cap.name] = toolsData;
          } catch (e) {
            console.error(`解析能力 ${cap.name} 的工具关联失败:`, e);
          }
        }
      });
      
      setCapabilityToolsMap(toolsMap);
    } catch (error) {
      console.error('获取能力列表失败', error);
      message.error('获取能力列表失败');
    } finally {
      setLoadingCapabilities(false);
    }
  }, [message]);
  
  // 创建能力
  const createCapability = useCallback(async (capabilityData) => {
    try {
      const response = await capabilityAPI.create(capabilityData);
      message.success('能力创建成功');
      await fetchCapabilities();
      return { success: true, data: response.data };
    } catch (error) {
      console.error('创建能力失败', error);
      message.error('创建能力失败');
      return { success: false, error };
    }
  }, [message, fetchCapabilities]);
  
  // 更新能力
  const updateCapability = useCallback(async (capabilityId, capabilityData) => {
    try {
      await capabilityAPI.update(capabilityId, capabilityData);
      message.success('能力更新成功');
      await fetchCapabilities();
      return { success: true };
    } catch (error) {
      console.error('更新能力失败', error);
      message.error('更新能力失败');
      return { success: false, error };
    }
  }, [message, fetchCapabilities]);
  
  // 删除能力
  const deleteCapability = useCallback(async (capability) => {
    return new Promise((resolve) => {
      modal.confirm({
        title: '确认删除',
        content: `确定要删除能力 "${capability.name}" 吗？`,
        onOk: async () => {
          try {
            await capabilityAPI.delete(capability.id);
            message.success('能力删除成功');
            await fetchCapabilities();
            resolve({ success: true });
          } catch (error) {
            message.error('删除能力失败');
            resolve({ success: false, error });
          }
        },
        onCancel: () => resolve({ success: false, cancelled: true })
      });
    });
  }, [message, modal, fetchCapabilities]);
  
  // ============ 分类相关方法 ============
  
  // 获取分类列表
  const fetchCategories = useCallback(async () => {
    try {
      const apiUrl = `${getApiBaseUrl()}/capabilities/categories`;
      const response = await axios.get(apiUrl);
      setCategories(response.data || []);
      return response.data;
    } catch (error) {
      console.error('获取分类列表失败:', error);
      message.error('获取分类列表失败');
      return [];
    }
  }, [message]);
  
  // 添加自定义分类
  const addCustomCategory = useCallback(async (categoryName) => {
    if (!categoryName || !categoryName.trim()) return null;
    
    try {
      const apiUrl = `${getApiBaseUrl()}/capabilities/categories`;
      await axios.post(apiUrl, { name: categoryName.trim() });
      message.success(`已成功保存分类："${categoryName}"`);
      
      const updatedCategories = await fetchCategories();
      
      // 从临时分类中移除
      setTempCategories(prev => prev.filter(cat => cat.name !== categoryName.trim()));
      
      return updatedCategories;
    } catch (error) {
      console.error('添加分类失败:', error);
      message.error('添加分类失败');
      return null;
    }
  }, [message, fetchCategories]);
  
  // ============ 角色相关方法 ============
  
  // 获取角色列表和关联信息
  const fetchRoles = useCallback(async () => {
    try {
      setLoadingRoles(true);
      
      // 获取所有角色
      const rolesResponse = await roleAPI.getAll();
      const roles = rolesResponse || [];
      setRoles(roles);
      
      // 一次性获取所有能力与角色的映射关系
      const capabilityRolesMap = await capabilityAPI.getAllWithRoles();
      setRoleCapabilityMap(capabilityRolesMap);
    } catch (error) {
      console.error('获取角色列表失败', error);
      setTimeout(() => {
        message.error('获取角色列表失败');
      }, 0);
    } finally {
      setLoadingRoles(false);
    }
  }, [message]);
  
  // 关联角色到能力
  const assignRolesToCapability = useCallback(async (capability, roleIds) => {
    try {
      const currentRoleIds = (roleCapabilityMap[capability.name] || []).map(role => role.id);
      const newRoleIds = roleIds || [];
      
      // 要添加的角色IDs
      const rolesToAdd = newRoleIds.filter(id => !currentRoleIds.includes(id));
      // 要移除的角色IDs
      const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));
      
      // 添加新角色关联
      const addPromises = rolesToAdd.map(roleId =>
        capabilityAPI.assignToRole(roleId, capability.id, true)
      );
      
      // 移除旧角色关联
      const removePromises = rolesToRemove.map(roleId =>
        capabilityAPI.unassignFromRole(roleId, capability.id)
      );
      
      await Promise.all([...addPromises, ...removePromises]);
      
      message.success('角色关联更新成功');
      await fetchRoles();
      return { success: true };
    } catch (error) {
      console.error('更新角色关联失败:', error);
      message.error('更新角色关联失败');
      return { success: false, error };
    }
  }, [message, roleCapabilityMap, fetchRoles]);
  
  // ============ 工具关联相关方法 ============
  
  // 获取工具列表
  const fetchTools = useCallback(async () => {
    try {
      const response = await toolAPI.getAll();
      setTools(response.data);
    } catch (error) {
      console.error('获取工具列表失败:', error);
      message.error('获取工具列表失败');
    }
  }, [message]);
  
  // 获取能力与工具的关联关系
  const fetchCapabilityTools = useCallback(async () => {
    try {
      const response = await capabilityAPI.getTools();
      setCapabilityToolsMap(response);
    } catch (error) {
      console.error('获取能力与工具关联关系失败:', error);
      // 不显示错误消息，避免干扰用户体验
    }
  }, []);
  
  // 更新能力的工具关联
  const updateCapabilityTools = useCallback(async (capabilityId, toolsMap) => {
    try {
      await capabilityAPI.updateTools(capabilityId, { tools: toolsMap });
      message.success('工具关联更新成功');
      await fetchCapabilityTools();
      return { success: true };
    } catch (error) {
      console.error('更新工具关联失败:', error);
      message.error('更新工具关联失败');
      return { success: false, error };
    }
  }, [message, fetchCapabilityTools]);
  
  // ============ MCP服务器相关方法 ============
  
  // 获取MCP服务器列表
  const fetchMcpServers = useCallback(async () => {
    try {
      setMcpServersLoading(true);
      const apiUrl = `${getApiBaseUrl()}/mcp/servers`;
      const response = await axios.get(apiUrl);
      setMcpServers(response.data);
      
      // 初始化服务器与能力的映射关系
      const serverCapMap = {};
      response.data.forEach(server => {
        serverCapMap[server.id] = server.required_capabilities || ['tool_use', 'external_api', 'web_browsing'];
      });
      setServerCapabilityMap(serverCapMap);
    } catch (error) {
      console.error('获取MCP服务器列表失败:', error);
      message.error('获取MCP服务器列表失败');
    } finally {
      setMcpServersLoading(false);
    }
  }, [message]);
  
  // 获取单个服务器的工具列表
  const fetchServerTools = useCallback(async (serverId) => {
    if (serverTools[serverId]) {
      return; // 已经加载过工具列表
    }
    
    setLoadingServerTools(prev => ({ ...prev, [serverId]: true }));
    try {
      const apiUrl = `${getApiBaseUrl()}/mcp/tools/${serverId}`;
      const response = await axios.post(apiUrl);
      
      if (response.data) {
        if (Array.isArray(response.data)) {
          setServerTools(prev => ({
            ...prev,
            [serverId]: response.data
          }));
        } else if (response.data.tools) {
          setServerTools(prev => ({
            ...prev,
            [serverId]: response.data.tools
          }));
        }
      }
    } catch (error) {
      console.error(`获取服务器 ${serverId} 的工具列表失败:`, error);
      message.error(`获取服务器 ${serverId} 的工具列表失败: ${error.message}`);
    } finally {
      setLoadingServerTools(prev => ({ ...prev, [serverId]: false }));
    }
  }, [serverTools, message]);
  
  // 获取所有服务器的工具列表
  const fetchAllServerTools = useCallback(async () => {
    try {
      setMcpServersLoading(true);
      const promises = mcpServers.map(async (server) => {
        if (serverTools[server.id]) {
          return;
        }
        
        try {
          setLoadingServerTools(prev => ({ ...prev, [server.id]: true }));
          const apiUrl = `${getApiBaseUrl()}/mcp/tools/${server.id}`;
          const response = await axios.post(apiUrl);
          
          if (response.data) {
            if (Array.isArray(response.data)) {
              setServerTools(prev => ({
                ...prev,
                [server.id]: response.data
              }));
            } else if (response.data.tools) {
              setServerTools(prev => ({
                ...prev,
                [server.id]: response.data.tools
              }));
            }
          }
        } catch (error) {
          console.error(`获取服务器 ${server.id} 的工具列表失败:`, error);
        } finally {
          setLoadingServerTools(prev => ({ ...prev, [server.id]: false }));
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('获取所有服务器工具列表失败:', error);
    } finally {
      setMcpServersLoading(false);
    }
  }, [mcpServers, serverTools]);
  
  // ============ 统计和过滤方法 ============
  
  // 获取按类型分组的能力
  const getCapabilitiesByType = useCallback(() => {
    return {
      core: capabilities.filter(cap => cap.type === 'core'),
      advanced: capabilities.filter(cap => cap.type === 'advanced'),
      supervision: capabilities.filter(cap => cap.type === 'supervision'),
      execution: capabilities.filter(cap => cap.type === 'execution'),
      specialized: capabilities.filter(cap => cap.type === 'specialized'),
    };
  }, [capabilities]);
  
  // ============ 初始化 ============
  
  useEffect(() => {
    fetchCapabilities();
    fetchCategories();
    fetchCapabilityTools();
    fetchMcpServers();
  }, [fetchCapabilities, fetchCategories, fetchCapabilityTools, fetchMcpServers]);
  
  // 从现有能力中提取自定义类型
  useEffect(() => {
    if (capabilities.length > 0) {
      const existingTypes = [...new Set(capabilities.map(cap => cap.type))];
      const defaultTypes = ['core', 'advanced', 'supervision', 'execution', 'specialized'];
      const customTypes = existingTypes.filter(type => !defaultTypes.includes(type));
      
      if (customTypes.length > 0) {
        const existingCategories = categories.map(cat => cat.name);
        const newTypes = customTypes.filter(type => !existingCategories.includes(type));
        
        if (newTypes.length > 0) {
          const newTempCategories = newTypes.map(type => ({
            id: `existing-${type}`,
            name: type
          }));
          setTempCategories(prev => [...prev, ...newTempCategories]);
        }
      }
    }
  }, [capabilities, categories]);
  
  // 能力加载完成后获取角色列表
  useEffect(() => {
    if (capabilities.length > 0) {
      fetchRoles();
    }
  }, [capabilities, fetchRoles]);
  
  return {
    // 数据状态
    capabilities,
    categories,
    tempCategories,
    roles,
    roleCapabilityMap,
    capabilityToolsMap,
    tools,
    mcpServers,
    serverTools,
    serverCapabilityMap,
    
    // 加载状态
    loadingCapabilities,
    loadingRoles,
    mcpServersLoading,
    loadingServerTools,
    
    // 能力相关方法
    fetchCapabilities,
    createCapability,
    updateCapability,
    deleteCapability,
    
    // 分类相关方法
    fetchCategories,
    addCustomCategory,
    setTempCategories,
    
    // 角色相关方法
    fetchRoles,
    assignRolesToCapability,
    
    // 工具关联方法
    fetchTools,
    fetchCapabilityTools,
    updateCapabilityTools,
    
    // MCP服务器方法
    fetchMcpServers,
    fetchServerTools,
    fetchAllServerTools,
    
    // 统计方法
    getCapabilitiesByType
  };
};
```

---

### Step 2: 创建能力表格组件

**文件**: `CapabilityTable.js` (~400行)

**包含内容**:
- 能力表格展示
- 统计标签
- 操作按钮
- 分页

```javascript
// CapabilityTable.js
import React, { useMemo } from 'react';
import { Table, Tag, Space, Button, Tooltip, Popover } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  FunctionOutlined,
  BranchesOutlined,
  ToolOutlined,
  CodeOutlined,
  GlobalOutlined,
  ApiOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  LockOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const CapabilityTable = ({
  capabilities,
  loading,
  pagination,
  onPaginationChange,
  roleCapabilityMap,
  capabilityToolsMap,
  onEdit,
  onDelete,
  onAssignRoles
}) => {
  // 统计信息
  const stats = useMemo(() => {
    const byType = {
      core: capabilities.filter(cap => cap.type === 'core').length,
      advanced: capabilities.filter(cap => cap.type === 'advanced').length,
      supervision: capabilities.filter(cap => cap.type === 'supervision').length,
      execution: capabilities.filter(cap => cap.type === 'execution').length,
      specialized: capabilities.filter(cap => cap.type === 'specialized').length,
    };
    return byType;
  }, [capabilities]);
  
  // 渲染能力图标
  const renderCapabilityIcon = (name) => {
    const iconMap = {
      'function_calling': <FunctionOutlined style={{ color: '#1677ff' }} />,
      'agent_coordination': <BranchesOutlined style={{ color: '#722ed1' }} />,
      'tool_use': <ToolOutlined style={{ color: '#52c41a' }} />,
      'code_execution': <CodeOutlined style={{ color: '#fa8c16' }} />,
      'web_browsing': <GlobalOutlined style={{ color: '#eb2f96' }} />,
      'external_api': <ApiOutlined style={{ color: '#faad14' }} />,
      'environment_sensing': <EnvironmentOutlined style={{ color: '#13c2c2' }} />,
      'supervision': <EyeOutlined style={{ color: '#722ed1' }} />,
      'execution': <ThunderboltOutlined style={{ color: '#fa541c' }} />
    };
    return iconMap[name] || <RobotOutlined style={{ color: '#1677ff' }} />;
  };
  
  // 渲染类型标签
  const renderTypeTag = (type) => {
    const typeColors = {
      'core': 'blue',
      'advanced': 'purple',
      'supervision': 'orange',
      'execution': 'red',
      'specialized': 'cyan'
    };
    
    const typeLabels = {
      'core': '基础能力',
      'advanced': '高级能力',
      'supervision': '监督能力',
      'execution': '执行能力',
      'specialized': '专业能力'
    };
    
    if (typeColors[type]) {
      return <Tag color={typeColors[type]}>{typeLabels[type] || type}</Tag>;
    }
    
    return <Tag color="default">{type}</Tag>;
  };
  
  // 渲染来源标签
  const renderSourceTag = (created_by, is_shared) => {
    if (!created_by) {
      return (
        <Tooltip title="系统资源，所有用户可见可用">
          <Tag icon={<GlobalOutlined />} color="blue">系统</Tag>
        </Tooltip>
      );
    }
    
    if (is_shared) {
      return (
        <Tooltip title="用户共享资源，所有用户可见可用">
          <Tag icon={<TeamOutlined />} color="green">共享</Tag>
        </Tooltip>
      );
    }
    
    return (
      <Tooltip title="私有资源，仅创建者可见">
        <Tag icon={<LockOutlined />} color="orange">私有</Tag>
      </Tooltip>
    );
  };
  
  // 渲染关联工具
  const renderAssociatedTools = (capability) => {
    const tools = capabilityToolsMap[capability.name] || {};
    const serverList = Object.keys(tools);
    
    if (!serverList || serverList.length === 0) {
      return <Tag color="default">无关联工具</Tag>;
    }
    
    return (
      <Popover
        content={
          <div style={{ maxWidth: 300, maxHeight: 300, overflow: 'auto' }}>
            {serverList.map(server => {
              const serverTools = Array.isArray(tools[server]) ? tools[server] : [];
              return (
                <div key={server} style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#1677ff' }}>
                    {server}:
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    {serverTools.length > 0 ? (
                      serverTools.map(tool => (
                        <div key={`${server}-${tool}`} style={{ marginBottom: '4px' }}>
                          • {tool}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#999', fontStyle: 'italic' }}>无工具</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        }
        title="关联工具/服务器"
        placement="right"
        mouseEnterDelay={0.5}
        trigger="hover"
      >
        <Tag color="cyan" style={{ cursor: 'pointer' }}>
          {serverList.length} 个服务器
          {serverList.reduce((sum, server) => {
            const serverTools = Array.isArray(tools[server]) ? tools[server] : [];
            return sum + serverTools.length;
          }, 0) > 0 ? ' (点击查看详情)' : ' (无工具)'}
        </Tag>
      </Popover>
    );
  };
  
  // 渲染关联角色
  const renderAssociatedRoles = (capability) => {
    const relatedRoles = roleCapabilityMap[capability.name] || [];
    
    if (!relatedRoles || relatedRoles.length === 0) {
      return <Tag color="default">无关联角色</Tag>;
    }
    
    return (
      <Space>
        {relatedRoles.length <= 2 ? (
          relatedRoles.map(role => (
            <Tag key={role.id || `role-${Math.random()}`} color="geekblue">
              {role.name}
            </Tag>
          ))
        ) : (
          <>
            <Tag color="geekblue">{relatedRoles[0].name}</Tag>
            <Popover
              content={
                <div style={{ maxWidth: 250, maxHeight: 200, overflow: 'auto' }}>
                  {relatedRoles.map(role => (
                    <Tag
                      key={role.id || `role-${Math.random()}`}
                      color="geekblue"
                      style={{ margin: '2px' }}
                    >
                      {role.name}
                    </Tag>
                  ))}
                </div>
              }
              title="关联角色"
              placement="right"
              mouseEnterDelay={0.5}
            >
              <Tag color="geekblue" style={{ cursor: 'pointer' }}>
                +{relatedRoles.length - 1} 个角色
              </Tag>
            </Popover>
          </>
        )}
      </Space>
    );
  };
  
  // 表格列配置
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {renderCapabilityIcon(record.name)}
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '描述提示词',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: renderTypeTag,
    },
    {
      title: '来源',
      dataIndex: 'created_by',
      key: 'resource_source',
      width: 100,
      render: (created_by, record) => renderSourceTag(created_by, record.is_shared),
    },
    {
      title: '关联服务器/工具',
      key: 'associated_tools',
      render: (_, record) => renderAssociatedTools(record),
    },
    {
      title: '关联角色',
      key: 'associated_roles',
      render: (_, record) => renderAssociatedRoles(record),
    },
    {
      title: '安全级别',
      dataIndex: 'security_level',
      key: 'security_level',
      render: (level) => {
        const colors = { 1: 'green', 2: 'orange', 3: 'red' };
        const texts = { 1: '低风险', 2: '中风险', 3: '高风险' };
        return <Tag color={colors[level] || 'default'}>{texts[level] || '未知'}</Tag>;
      }
    },
    {
      title: '默认启用',
      dataIndex: 'default_enabled',
      key: 'default_enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
            style={{ color: '#1677ff' }}
          />
          <Button
            type="text"
            icon={<TeamOutlined />}
            onClick={() => onAssignRoles(record)}
            style={{ color: '#722ed1' }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record)}
          />
        </Space>
      ),
    },
  ];
  
  return (
    <>
      {/* 统计标签 */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <Space size="middle">
          <Tag color="blue">基础能力: {stats.core}</Tag>
          <Tag color="purple">高级能力: {stats.advanced}</Tag>
          <Tag color="orange">监督能力: {stats.supervision}</Tag>
          <Tag color="red">执行能力: {stats.execution}</Tag>
          <Tag color="cyan">专业能力: {stats.specialized}</Tag>
        </Space>
        <Space>
          <Tag color="default">总计: {capabilities.length}</Tag>
        </Space>
      </div>
      
      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={capabilities.map(cap => ({
          ...cap,
          key: cap.id
        }))}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          defaultPageSize: 10,
          pageSizeOptions: [10, 50, 100],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          position: ['bottomRight'],
          simple: false,
          onChange: (page, pageSize) => {
            onPaginationChange({
              current: page,
              pageSize: pageSize,
            });
          },
          onShowSizeChange: (current, size) => {
            onPaginationChange({
              current: 1,
              pageSize: size,
            });
          }
        }}
        style={{ overflowX: 'auto' }}
        rowClassName={(record) => {
          const typeClasses = {
            'core': 'core-capability-row',
            'advanced': 'advanced-capability-row',
            'supervision': 'supervision-capability-row',
            'execution': 'execution-capability-row',
            'specialized': 'specialized-capability-row'
          };
          return typeClasses[record.type] || 'custom-capability-row';
        }}
      />
    </>
  );
};

export default React.memo(CapabilityTable);
```

---

### Step 3: 创建能力表单Modal

**文件**: `CapabilityFormModal.js` (~300行)

**包含内容**:
- 能力基本信息表单
- 分类选择（含自定义分类支持）
- 安全级别和默认启用
- 共享选项

```javascript
// CapabilityFormModal.js
import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Checkbox, Space, Alert } from 'antd';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

const CapabilityFormModal = ({
  visible,
  onOk,
  onCancel,
  loading,
  editingCapability,
  form,
  categories,
  tempCategories,
  onCustomCategoryInput,
  onCustomCategorySelect
}) => {
  // 当Modal打开时，设置表单初始值
  useEffect(() => {
    if (visible) {
      if (editingCapability) {
        // 编辑模式
        form.setFieldsValue(editingCapability);
      } else {
        // 创建模式
        form.resetFields();
        form.setFieldsValue({
          type: 'core',
          security_level: 1,
          default_enabled: false
        });
      }
    }
  }, [visible, editingCapability, form]);
  
  // 处理Modal确定
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
    } catch (error) {
      // 表单验证失败
    }
  };
  
  return (
    <Modal
      title={editingCapability ? '编辑能力' : '新建能力'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入能力名称' }]}
        >
          <Input placeholder="请输入能力名称，例如: function_calling" />
        </Form.Item>
        
        <Form.Item
          name="description"
          label="描述提示词"
          rules={[{ required: true, message: '请输入能力描述提示词' }]}
        >
          <TextArea 
            rows={3} 
            placeholder="请输入能力描述提示词，例如: 你具备记忆能力，在记忆的时候要使用记忆工具，比如read_graph来获取图谱信息、search_node来搜索知识节点" 
          />
        </Form.Item>
        
        <Form.Item
          name="type"
          label="类型"
          rules={[{ required: true, message: '请选择能力类型' }]}
        >
          <Select
            placeholder="请选择能力类型"
            showSearch
            allowClear
            onSearch={onCustomCategoryInput}
            onSelect={onCustomCategorySelect}
            dropdownRender={menu => (
              <>
                {menu}
                {/* 显示自定义分类添加提示 */}
              </>
            )}
          >
            <Option value="core">基础能力</Option>
            <Option value="advanced">高级能力</Option>
            <Option value="supervision">监督能力</Option>
            <Option value="execution">执行能力</Option>
            <Option value="specialized">专业能力</Option>
            {[...categories, ...tempCategories].map(category => {
              if (['core', 'advanced', 'supervision', 'execution', 'specialized'].includes(category.name)) {
                return null;
              }
              return (
                <Option
                  key={category.id || category.name}
                  value={category.name}
                  style={tempCategories.some(c => c.id === category.id) ? {color: '#1677ff', fontStyle: 'italic'} : {}}
                >
                  {category.name}
                  {tempCategories.some(c => c.id === category.id) && ' (未保存)'}
                </Option>
              );
            })}
          </Select>
        </Form.Item>
        
        <Form.Item
          name="icon"
          label="图标"
        >
          <Input placeholder="请输入图标名称，例如: function" />
        </Form.Item>
        
        <Form.Item
          name="security_level"
          label="安全级别"
          rules={[{ required: true, message: '请选择安全级别' }]}
        >
          <Select placeholder="请选择安全级别">
            <Option value={1}>低风险 (1级)</Option>
            <Option value={2}>中风险 (2级)</Option>
            <Option value={3}>高风险 (3级)</Option>
          </Select>
        </Form.Item>
        
        <Form.Item
          name="default_enabled"
          valuePropName="checked"
        >
          <Checkbox>默认启用</Checkbox>
        </Form.Item>
        
        <Form.Item
          name="is_shared"
          valuePropName="checked"
          tooltip="勾选后，该能力将对所有用户可见可用（但只有创建者可编辑）"
        >
          <Checkbox>
            <Space>
              <TeamOutlined />
              共享给所有用户
            </Space>
          </Checkbox>
        </Form.Item>
        
        <Alert
          message="提示"
          description="保存能力后，可以在能力列表中点击编辑按钮来关联工具和服务器。"
          type="info"
          showIcon
          style={{ marginTop: '16px' }}
        />
      </Form>
    </Modal>
  );
};

export default React.memo(CapabilityFormModal);
```

---

### Step 4: 创建工具关联Modal

**文件**: `ToolAssociationModal.js` (~350行)

**包含内容**:
- TreeSelect组件用于选择工具
- 服务器-工具层级显示
- 自定义标签渲染

```javascript
// ToolAssociationModal.js
import React, { useEffect } from 'react';
import { Modal, Form, TreeSelect, Alert } from 'antd';
import { convertToTreeData, renderTreeSelectTags } from './utils/treeSelectHelpers';

const ToolAssociationModal = ({
  visible,
  onOk,
  onCancel,
  loading,
  selectedCapability,
  form,
  mcpServers,
  serverTools,
  tools,
  capabilityToolsMap,
  onTreeSelectChange
}) => {
  // 当Modal打开时，设置表单初始值
  useEffect(() => {
    if (visible && selectedCapability) {
      const currentTools = capabilityToolsMap[selectedCapability.name] || {};
      
      // 将当前关联工具转换成表单需要的格式
      const formattedTools = Object.entries(currentTools).reduce((acc, [server, tools]) => {
        if (Array.isArray(tools)) {
          tools.forEach(tool => {
            acc.push(`${server}:${tool}`);
          });
        }
        return acc;
      }, []);
      
      form.setFieldsValue({
        tools: formattedTools
      });
    }
  }, [visible, selectedCapability, capabilityToolsMap, form]);
  
  // 处理Modal确定
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      // 将表单值转换成后端需要的格式
      const toolsMap = {};
      (values.tools || []).forEach(item => {
        const [server, tool] = item.split(':');
        if (!toolsMap[server]) {
          toolsMap[server] = [];
        }
        toolsMap[server].push(tool);
      });
      
      onOk(toolsMap);
    } catch (error) {
      // 表单验证失败
    }
  };
  
  return (
    <Modal
      title={`关联工具 - ${selectedCapability?.name || ''}`}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="tools"
          label="选择工具"
          rules={[{ required: false, message: '请选择要关联的工具' }]}
        >
          <TreeSelect
            treeData={convertToTreeData(mcpServers, serverTools, tools)}
            treeCheckable={true}
            showCheckedStrategy={TreeSelect.SHOW_CHILD}
            placeholder="请选择要关联的工具"
            style={{ width: '100%' }}
            onChange={(value) => onTreeSelectChange(value, form)}
            treeDefaultExpandAll
            allowClear
            showSearch
            tagRender={(props) => renderTreeSelectTags(props, form)}
            filterTreeNode={(input, node) => {
              if (node.title && typeof node.title !== 'string') {
                const nodeTitle = node.title.props?.children?.[0];
                return nodeTitle && nodeTitle.toLowerCase().includes(input.toLowerCase());
              }
              return node.title && node.title.toLowerCase().includes(input.toLowerCase());
            }}
            treeNodeFilterProp="title"
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          />
        </Form.Item>
        
        <Alert
          message="提示"
          description="请选择该能力可以使用的工具。拥有此能力的角色将可以使用这些工具。系统会自动加载所有可用的工具，包括所有MCP服务器工具和自定义工具。"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      </Form>
    </Modal>
  );
};

export default React.memo(ToolAssociationModal);
```

---

### Step 5: 创建角色关联Modal

**文件**: `AssignRoleModal.js` (~100行)

**包含内容**:
- 角色多选
- 保存关联关系

```javascript
// AssignRoleModal.js
import React, { useEffect } from 'react';
import { Modal, Form, Select } from 'antd';

const AssignRoleModal = ({
  visible,
  onOk,
  onCancel,
  loading,
  selectedCapability,
  form,
  roles,
  roleCapabilityMap
}) => {
  // 当Modal打开时，设置表单初始值
  useEffect(() => {
    if (visible && selectedCapability) {
      const currentRoleIds = (roleCapabilityMap[selectedCapability.name] || []).map(role => role.id);
      form.setFieldsValue({
        roles: currentRoleIds
      });
    }
  }, [visible, selectedCapability, roleCapabilityMap, form]);
  
  // 处理Modal确定
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values.roles || []);
    } catch (error) {
      // 表单验证失败
    }
  };
  
  return (
    <Modal
      title={`关联角色 - ${selectedCapability?.name || ''}`}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={500}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="roles"
          label="选择角色"
          rules={[{ required: false, message: '请选择要关联的角色' }]}
        >
          <Select
            mode="multiple"
            placeholder="请选择要关联的角色"
            style={{ width: '100%' }}
            options={roles.map(role => ({
              label: role.name,
              value: role.id
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default React.memo(AssignRoleModal);
```

---

### Step 6: 创建TreeSelect工具函数

**文件**: `utils/treeSelectHelpers.js` (~200行)

**包含内容**:
- 转换数据为树形结构
- 自定义标签渲染
- 处理选择变化

```javascript
// utils/treeSelectHelpers.js
import React from 'react';
import { Tag } from 'antd';

/**
 * 将服务器和工具数据转换为TreeSelect组件所需的树形结构
 */
export const convertToTreeData = (mcpServers, serverTools, customTools) => {
  // 创建服务器节点
  const treeData = mcpServers.map(server => {
    const serverToolsList = serverTools[server.id] || [];
    
    // 创建工具子节点
    const children = serverToolsList.map(tool => ({
      title: (
        <span>
          {tool.name}
          {tool.annotations?.title && <Tag color="purple" style={{marginLeft: 4}}>{tool.annotations.title}</Tag>}
        </span>
      ),
      value: `${server.id}:${tool.name}`,
      key: `${server.id}:${tool.name}`,
    }));
    
    return {
      title: `${server.id} 服务器`,
      value: `server:${server.id}`,
      key: `server:${server.id}`,
      children: children,
      selectable: true,
    };
  });
  
  // 添加自定义工具节点
  if (customTools && customTools.length > 0) {
    const customToolsNode = {
      title: '自定义工具',
      value: 'server:custom',
      key: 'server:custom',
      children: customTools.map(tool => ({
        title: (
          <span>
            {tool.name}
            <Tag color="blue" style={{marginLeft: 4}}>{tool.type}</Tag>
          </span>
        ),
        value: `custom:${tool.name}`,
        key: `custom:${tool.name}`,
      })),
      selectable: true,
    };
    
    treeData.push(customToolsNode);
  }
  
  return treeData;
};

/**
 * 处理TreeSelect选择变化
 */
export const handleTreeSelectChange = (value, form, serverTools) => {
  if (!form || typeof form.setFieldsValue !== 'function') {
    console.error('无法确定要使用的表单实例');
    return;
  }
  
  // 处理服务器节点的选择/取消选择
  const newValues = [...value];
  
  // 检查是否有服务器节点被选中/取消选中
  value.forEach(val => {
    if (val && val.startsWith('server:')) {
      const serverId = val.replace('server:', '');
      
      // 如果是服务器节点，检查其所有工具是否已被选中
      const serverToolsList = serverTools[serverId] || [];
      const toolValues = serverToolsList.map(tool => `${serverId}:${tool.name}`);
      
      // 将该服务器的所有工具添加到选中列表
      toolValues.forEach(toolVal => {
        if (!newValues.includes(toolVal)) {
          newValues.push(toolVal);
        }
      });
    }
  });
  
  // 过滤掉服务器节点，只保留工具节点
  const filteredValues = newValues.filter(val => val && !val.startsWith('server:'));
  
  // 更新表单值
  try {
    form.setFieldsValue({ tools: filteredValues });
  } catch (error) {
    console.error('更新表单值失败:', error);
  }
};

/**
 * 生成自定义标签显示
 */
export const renderTreeSelectTags = (props, form) => {
  const { label, value, closable, onClose } = props;
  
  // 如果是单个标签，直接返回原始标签
  if (!value || typeof value !== 'string') {
    return (
      <Tag
        closable={closable}
        onClose={onClose}
        color="blue"
      >
        {label}
      </Tag>
    );
  }
  
  // 解析值，获取服务器名称
  const [server] = value.split(':');
  
  // 获取当前表单中所有选中的工具
  let allSelectedTools = [];
  if (form && typeof form.getFieldValue === 'function') {
    allSelectedTools = form.getFieldValue('tools') || [];
  }
  
  // 按服务器分组工具
  const serverToolsMap = {};
  allSelectedTools.forEach(val => {
    if (!val) return;
    const [srv, tl] = val.split(':');
    if (!serverToolsMap[srv]) {
      serverToolsMap[srv] = [];
    }
    serverToolsMap[srv].push(tl);
  });
  
  // 获取当前服务器的工具数量
  const toolCount = serverToolsMap[server]?.length || 0;
  
  // 检查是否已经渲染过这个服务器的标签
  const isFirstToolOfServer = allSelectedTools.findIndex(t => t && t.startsWith(`${server}:`)) === allSelectedTools.findIndex(t => t === value);
  
  if (!isFirstToolOfServer) {
    return null;
  }
  
  // 自定义关闭处理函数
  const handleServerTagClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (form && typeof form.getFieldValue === 'function' && typeof form.setFieldsValue === 'function') {
      try {
        const currentTools = form.getFieldValue('tools') || [];
        const filteredTools = currentTools.filter(tool => tool && !tool.startsWith(`${server}:`));
        form.setFieldsValue({ tools: filteredTools });
      } catch (error) {
        console.error('处理服务器标签关闭失败:', error);
      }
    }
  };
  
  return (
    <Tag
      closable={closable}
      onClose={handleServerTagClose}
      color="blue"
    >
      {server}[{toolCount}个工具已选]
    </Tag>
  );
};
```

---

### Step 7: 主组件整合

**文件**: `index.js` (~200行)

```javascript
// pages/roles/ToolManagement/index.js
import React, { useState } from 'react';
import { Card, Button, Typography, Form } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// Hooks
import { useCapabilityData } from './useCapabilityData';

// Components
import CapabilityTable from './CapabilityTable';
import CapabilityFormModal from './CapabilityFormModal';
import ToolAssociationModal from './ToolAssociationModal';
import AssignRoleModal from './AssignRoleModal';

// Utils
import { handleTreeSelectChange } from './utils/treeSelectHelpers';

const { Title, Text } = Typography;

const ToolManagement = () => {
  const { t } = useTranslation();
  
  // 数据Hook
  const {
    capabilities,
    categories,
    tempCategories,
    roles,
    roleCapabilityMap,
    capabilityToolsMap,
    tools,
    mcpServers,
    serverTools,
    loadingCapabilities,
    loadingRoles,
    fetchCapabilities,
    createCapability,
    updateCapability,
    deleteCapability,
    addCustomCategory,
    setTempCategories,
    assignRolesToCapability,
    updateCapabilityTools,
    fetchAllServerTools
  } = useCapabilityData();
  
  // UI状态
  const [capabilityModalVisible, setCapabilityModalVisible] = useState(false);
  const [toolAssociationModalVisible, setToolAssociationModalVisible] = useState(false);
  const [assignRoleModalVisible, setAssignRoleModalVisible] = useState(false);
  const [editingCapability, setEditingCapability] = useState(null);
  const [selectedCapability, setSelectedCapability] = useState(null);
  const [customCategoryName, setCustomCategoryName] = useState('');
  
  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  
  // 表单实例
  const [capabilityForm] = Form.useForm();
  const [toolAssociationForm] = Form.useForm();
  const [assignRoleForm] = Form.useForm();
  
  // ============ 能力相关处理函数 ============
  
  // 打开创建能力Modal
  const handleCreateCapability = async () => {
    setEditingCapability(null);
    capabilityForm.resetFields();
    setCapabilityModalVisible(true);
  };
  
  // 打开编辑能力Modal
  const handleEditCapability = (capability) => {
    setEditingCapability(capability);
    capabilityForm.setFieldsValue(capability);
    setCapabilityModalVisible(true);
  };
  
  // 保存能力
  const handleSaveCapability = async (values) => {
    // 如果选择了临时分类，先保存分类
    if (values.type && tempCategories.some(cat => cat.name === values.type)) {
      await addCustomCategory(values.type);
    }
    
    if (editingCapability) {
      const result = await updateCapability(editingCapability.id, values);
      if (result.success) {
        setCapabilityModalVisible(false);
        capabilityForm.resetFields();
        setTempCategories([]);
      }
    } else {
      const result = await createCapability(values);
      if (result.success) {
        setCapabilityModalVisible(false);
        capabilityForm.resetFields();
        setTempCategories([]);
      }
    }
  };
  
  // 删除能力
  const handleDeleteCapability = async (capability) => {
    await deleteCapability(capability);
  };
  
  // ============ 工具关联处理函数 ============
  
  // 打开工具关联Modal
  const handleShowToolAssociation = async (capability) => {
    setSelectedCapability(capability);
    
    // 加载所有服务器工具
    await fetchAllServerTools();
    
    setToolAssociationModalVisible(true);
  };
  
  // 保存工具关联
  const handleSaveToolAssociation = async (toolsMap) => {
    if (!selectedCapability) return;
    
    const result = await updateCapabilityTools(selectedCapability.id, toolsMap);
    if (result.success) {
      setToolAssociationModalVisible(false);
      toolAssociationForm.resetFields();
    }
  };
  
  // ============ 角色关联处理函数 ============
  
  // 打开角色关联Modal
  const handleShowAssignRole = (capability) => {
    setSelectedCapability(capability);
    setAssignRoleModalVisible(true);
  };
  
  // 保存角色关联
  const handleSaveAssignRole = async (roleIds) => {
    if (!selectedCapability) return;
    
    const result = await assignRolesToCapability(selectedCapability, roleIds);
    if (result.success) {
      setAssignRoleModalVisible(false);
      assignRoleForm.resetFields();
    }
  };
  
  // ============ 自定义分类处理函数 ============
  
  const handleCustomCategoryInput = (value) => {
    setCustomCategoryName(value);
  };
  
  const handleCustomCategorySelect = (value) => {
    if ([...categories, ...tempCategories].some(cat => cat.name === value)) {
      capabilityForm.setFieldsValue({ type: value });
    } else if (value && value.trim()) {
      const newTempCategory = { id: `temp-${Date.now()}`, name: value.trim() };
      setTempCategories(prev => [...prev, newTempCategory]);
      capabilityForm.setFieldsValue({ type: value });
    }
  };
  
  return (
    <div>
      {/* 页面头部 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
              {t('toolManagement.title')}
            </Title>
            <Text type="secondary">
              {t('toolManagement.subtitle')}
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateCapability}
            size="large"
            style={{
              borderRadius: '8px',
              height: '42px',
              fontSize: '14px'
            }}
          >
            新建能力
          </Button>
        </div>
      </div>
      
      {/* 能力列表卡片 */}
      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        }}
      >
        <CapabilityTable
          capabilities={capabilities}
          loading={loadingCapabilities || loadingRoles}
          pagination={pagination}
          onPaginationChange={setPagination}
          roleCapabilityMap={roleCapabilityMap}
          capabilityToolsMap={capabilityToolsMap}
          onEdit={handleEditCapability}
          onDelete={handleDeleteCapability}
          onAssignRoles={handleShowAssignRole}
        />
      </Card>
      
      {/* 能力表单Modal */}
      <CapabilityFormModal
        visible={capabilityModalVisible}
        onOk={handleSaveCapability}
        onCancel={() => {
          setCapabilityModalVisible(false);
          capabilityForm.resetFields();
          setTempCategories([]);
        }}
        loading={loadingCapabilities}
        editingCapability={editingCapability}
        form={capabilityForm}
        categories={categories}
        tempCategories={tempCategories}
        onCustomCategoryInput={handleCustomCategoryInput}
        onCustomCategorySelect={handleCustomCategorySelect}
      />
      
      {/* 工具关联Modal */}
      <ToolAssociationModal
        visible={toolAssociationModalVisible}
        onOk={handleSaveToolAssociation}
        onCancel={() => {
          setToolAssociationModalVisible(false);
          toolAssociationForm.resetFields();
        }}
        loading={loadingCapabilities}
        selectedCapability={selectedCapability}
        form={toolAssociationForm}
        mcpServers={mcpServers}
        serverTools={serverTools}
        tools={tools}
        capabilityToolsMap={capabilityToolsMap}
        onTreeSelectChange={(value) => handleTreeSelectChange(value, toolAssociationForm, serverTools)}
      />
      
      {/* 角色关联Modal */}
      <AssignRoleModal
        visible={assignRoleModalVisible}
        onOk={handleSaveAssignRole}
        onCancel={() => {
          setAssignRoleModalVisible(false);
          assignRoleForm.resetFields();
        }}
        loading={loadingRoles}
        selectedCapability={selectedCapability}
        form={assignRoleForm}
        roles={roles}
        roleCapabilityMap={roleCapabilityMap}
      />
    </div>
  );
};

export default ToolManagement;
```

---

## ✅ 拆分后的效果

### 代码行数对比

| 文件 | 行数 | 说明 |
|------|------|------|
| **拆分前** |
| ToolManagement.js | 1759 | 单个超大文件 |
| **拆分后** |
| index.js | ~200 | 主入口组件 |
| useCapabilityData.js | ~450 | 统一数据管理Hook |
| CapabilityTable.js | ~400 | 能力表格组件 |
| CapabilityFormModal.js | ~300 | 能力表单Modal |
| ToolAssociationModal.js | ~350 | 工具关联Modal |
| AssignRoleModal.js | ~100 | 角色关联Modal |
| utils/treeSelectHelpers.js | ~200 | TreeSelect工具函数 |
| **总计** | **~2000** | **7个文件** |

### 关键改进

1. **KISS原则**: 简单直接的平级拆分，避免过度抽象
2. **统一管理**: 所有数据和操作逻辑集中在useCapabilityData Hook中
3. **职责清晰**: 每个文件负责一个完整的功能模块
4. **性能优化**: 关键组件使用React.memo优化
5. **易于维护**: 代码量适中，单文件最大450行，易于理解

---

## 📈 预期收益

### 性能提升
- **组件渲染**: 提升 40-50%（React.memo + 职责分离）
- **代码加载**: 按需加载Modal组件
- **状态更新**: Hook分离后，状态更新更精确

### 开发体验
- **可维护性**: ⭐⭐⭐⭐⭐ 极大提升
- **调试效率**: ⭐⭐⭐⭐⭐ 问题定位更快
- **协作效率**: ⭐⭐⭐⭐⭐ 多人可并行开发

---

## 🚀 实施建议

### 实施步骤

1. **备份原文件**
   ```bash
   cp ToolManagement.js ToolManagement.backup.js
   ```

2. **创建目录**
   ```bash
   cd frontend/src/pages/roles
   mkdir ToolManagement
   mkdir ToolManagement/utils
   ```

3. **按顺序拆分**（由内而外）:
   - Step 1: 创建统一Hook → `useCapabilityData.js`（所有数据逻辑）
   - Step 2: 创建工具函数 → `utils/treeSelectHelpers.js`（TreeSelect相关）
   - Step 3: 拆分表格组件 → `CapabilityTable.js`
   - Step 4: 拆分能力表单 → `CapabilityFormModal.js`
   - Step 5: 拆分工具关联 → `ToolAssociationModal.js`
   - Step 6: 拆分角色关联 → `AssignRoleModal.js`
   - Step 7: 重构主组件 → `index.js`（协调各部分）

4. **逐步测试**:
   - 每拆分一个模块，立即测试功能
   - 确保原有功能100%保留

5. **构建验证**:
   ```bash
   cd frontend
   npm run build
   ```

6. **完整性检查**:
   - 测试所有CRUD操作
   - 测试角色关联功能
   - 测试工具关联功能（TreeSelect）
   - 测试自定义分类功能
   - 测试分页和过滤

### 注意事项

1. **保持向后兼容**: 确保API调用方式不变
2. **保留所有功能**: 不遗漏任何现有功能
3. **性能监控**: 拆分后对比渲染性能
4. **错误处理**: 保持原有的错误处理逻辑
5. **TreeSelect复杂度**: 特别注意TreeSelect的状态管理和标签渲染逻辑

---

## 📋 验证清单

拆分完成后，请验证以下功能：

### 能力管理
- [ ] 能力列表加载正常
- [ ] 创建能力功能正常
- [ ] 编辑能力功能正常
- [ ] 删除能力功能正常
- [ ] 能力统计显示正常

### 分类管理
- [ ] 分类列表加载正常
- [ ] 自定义分类添加正常
- [ ] 临时分类显示正常
- [ ] 分类保存后更新正常

### 角色关联
- [ ] 角色列表加载正常
- [ ] 打开角色关联Modal正常
- [ ] 角色选择功能正常
- [ ] 保存角色关联正常
- [ ] 角色关联显示正常（列表中）

### 工具关联
- [ ] MCP服务器列表加载正常
- [ ] 服务器工具列表加载正常
- [ ] TreeSelect显示正常
- [ ] 工具选择功能正常
- [ ] 服务器节点选择正常
- [ ] 自定义标签显示正常
- [ ] 保存工具关联正常
- [ ] 工具关联显示正常（列表中）

### UI和交互
- [ ] 表格渲染正常
- [ ] 分页功能正常
- [ ] 图标显示正常
- [ ] 标签颜色正常
- [ ] Popover显示正常
- [ ] Modal打开关闭正常

### 构建和运行
- [ ] 构建无错误
- [ ] 运行时无控制台错误
- [ ] 路由跳转正常

---

## 🎯 总结

ToolManagement的拆分计划遵循以下原则：

1. **模块化**: 按功能模块拆分，清晰的边界
2. **Hook优先**: 使用自定义Hook管理状态和逻辑
3. **组件细化**: 每个组件职责单一，易于维护
4. **性能优化**: 使用React.memo避免不必要的渲染
5. **可测试性**: 每个模块都可以独立测试
6. **命名清晰**: 文件名和函数名清楚表达职责

拆分后的代码将更加清晰、可维护，预计性能提升40-50%。

---

## 🔍 与其他组件对比

### 与RoleManagement对比
- **相似点**: 都使用统一Hook管理数据，平级拆分组件
- **不同点**: ToolManagement的工具关联更复杂（TreeSelect），需要专门的工具函数

### 与ModelConfigsPage对比
- **相似点**: 都有列表展示、CRUD操作、Modal表单
- **不同点**: ToolManagement更注重关联关系管理（角色、工具），ModelConfigsPage更注重配置和测试

### 拆分哲学
- **保持简单**: 不过度拆分，单文件400-450行是合理的
- **职责清晰**: 每个文件都有明确的职责
- **易于理解**: 新人能快速上手
- **便于维护**: 修改一个功能不影响其他功能

---

**拆分完成后，请创建详细的验证报告，参考现有的重构完成报告格式。**
