# ToolManagement.js 代码清理计划

> 目标: 删除未使用的代码，保持页面专注于"能力管理"  
> 原则: 保留能力-工具关联所需的最小代码集

---

## 📋 背景说明

### 当前情况
- **ToolManagement.js**: 主要功能是"能力管理"
- **MCPServersPage.js**: 已有单独的MCP服务器管理界面（在 `/mcp-servers` 路由）
- **未使用代码**: 约222行（12.6%）未被充分使用

### 清理原则
1. ✅ **保留**: 能力管理核心功能
2. ✅ **保留**: 能力-工具关联（TreeSelect需要MCP服务器和工具数据）
3. ❌ **删除**: MCP服务器管理功能（启动/停止/服务器能力关联）
4. ❌ **删除**: 自定义工具管理功能（完全未使用）
5. ❌ **删除**: 未使用的状态变量和函数

---

## 🗑️ 待删除代码清单

### 1️⃣ 自定义工具管理（完全删除）

#### 删除的状态变量
```javascript
// 行61: 工具Modal状态
❌ const [modalVisible, setModalVisible] = useState(false);

// 行76: 工具编辑ID
❌ const [editingId, setEditingId] = useState(null);

// 行70: 工具表单
❌ const [form] = Form.useForm();

// 行87-90: 工具分页状态
❌ const [toolPagination, setToolPagination] = useState({
  current: 1,
  pageSize: 10,
});

// 行45: tools状态（获取但不显示）
❌ const [tools, setTools] = useState([]);

// 行58: loading状态（用于fetchTools）
❌ const [loading, setLoading] = useState(false);
```

#### 删除的函数
```javascript
// 行92-102: 获取工具列表
❌ const fetchTools = async () => {
  // ...
};

// 行415-445: 创建/编辑工具
❌ const handleSubmitTool = async (values) => {
  // ...
};

// 行511-518: 删除工具
❌ const handleDeleteTool = async (id) => {
  // ...
};

// 行540-549: 显示创建工具Modal
❌ const showCreateToolModal = () => {
  // ...
};

// 行552-560: 显示编辑工具Modal
❌ const showEditToolModal = (record) => {
  // ...
};
```

**删除原因**: 页面中没有自定义工具的UI，功能完全未使用

---

### 2️⃣ MCP服务器管理功能（删除管理部分，保留数据获取）

#### 删除的函数
```javascript
// 行225-237: 启动MCP服务器
❌ const startServer = async (serverId) => {
  // ...
};

// 行239-250: 停止MCP服务器
❌ const stopServer = async (serverId) => {
  // ...
};

// 行882-889: 处理展开行
❌ const handleExpand = (expanded, record) => {
  // ...
};

// 行893-920: 渲染工具参数
❌ const renderToolParams = (schema) => {
  // ...
};

// 行925-933: 显示服务器关联能力Modal
❌ const showAssignCapabilityModal = (record) => {
  // ...
};

// 行936-963: 处理关联能力
❌ const handleAssignCapabilities = async (values) => {
  // ...
};
```

#### 删除的状态变量
```javascript
// 行57: 展开行keys
❌ const [expandedRowKeys, setExpandedRowKeys] = useState([]);

// 行65: 服务器能力关联Modal状态
❌ const [assignServerModalVisible, setAssignServerModalVisible] = useState(false);

// 行67: 选中的服务器
❌ const [selectedServer, setSelectedServer] = useState(null);

// 行69: 选中的能力列表
❌ const [selectedCapabilities, setSelectedCapabilities] = useState([]);

// 行75: 服务器能力关联表单
❌ const [assignServerForm] = Form.useForm();

// 行56: 服务器能力映射（仅用于服务器管理）
❌ const [serverCapabilityMap, setServerCapabilityMap] = useState({});
```

#### 删除的UI
```javascript
// 行1659-1696: 服务器关联能力模态框
❌ <Modal
  title={`关联能力 - ${selectedServer?.id || ''}`}
  open={assignServerModalVisible}
  // ...
>
  {/* 完整的表单UI */}
</Modal>
```

**删除原因**: MCPServersPage.js已有完整的服务器管理界面

---

### 3️⃣ 保留但需要调整的代码

#### ✅ 保留的MCP相关代码（用于TreeSelect）
```javascript
// 这些是能力-工具关联必需的
✅ const [mcpServers, setMcpServers] = useState([]);
✅ const [serverTools, setServerTools] = useState({});
✅ const [loadingServerTools, setLoadingServerTools] = useState({});
✅ const [mcpServersLoading, setMcpServersLoading] = useState(false);

✅ const fetchMcpServers = async () => { ... };
✅ const fetchServerTools = async (serverId) => { ... };
✅ const fetchAllServerTools = async () => { ... };

✅ const convertToTreeData = () => { ... };
✅ const handleTreeSelectChange = (value, form) => { ... };
✅ const renderTreeSelectTags = (props) => { ... };
✅ const getTreeSelectProps = () => { ... };
```

**保留原因**: 
- 能力编辑Modal中的"关联工具"TreeSelect需要这些数据
- 工具关联Modal需要这些函数

#### ⚠️ 需要调整的初始化代码
```javascript
// 行370-376: useEffect
useEffect(() => {
  fetchCapabilities();
  fetchCategories();
  fetchCapabilityTools();
  fetchMcpServers(); // ✅ 保留
}, []);
```

**调整**: 移除 `fetchTools()` 调用（如果有）

---

## 📊 删除统计

| 类别 | 删除项 | 代码行数 | 说明 |
|------|-------|---------|------|
| **自定义工具管理** | | |
| - 状态变量 | 6个 | ~20行 | modalVisible, editingId, form, toolPagination, tools, loading |
| - 函数 | 5个 | ~80行 | fetchTools, handleSubmitTool, handleDeleteTool, showCreateToolModal, showEditToolModal |
| **MCP服务器管理** | | |
| - 状态变量 | 6个 | ~15行 | expandedRowKeys, assignServerModalVisible, selectedServer, selectedCapabilities, assignServerForm, serverCapabilityMap |
| - 函数 | 6个 | ~120行 | startServer, stopServer, handleExpand, renderToolParams, showAssignCapabilityModal, handleAssignCapabilities |
| - UI组件 | 1个Modal | ~40行 | 服务器关联能力Modal |
| **总计** | | **~275行** | **约15.6%的代码** |

---

## ✅ 清理后的代码结构

### 保留的核心功能

```javascript
const ToolManagement = () => {
  // ============ 能力管理状态 ============
  const [capabilities, setCapabilities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tempCategories, setTempCategories] = useState([]);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [capabilityPagination, setCapabilityPagination] = useState({ current: 1, pageSize: 10 });
  
  // ============ 能力Modal状态 ============
  const [capabilityModalVisible, setCapabilityModalVisible] = useState(false);
  const [editingCapabilityId, setEditingCapabilityId] = useState(null);
  const [selectedCapability, setSelectedCapability] = useState(null);
  const [capabilityForm] = Form.useForm();
  
  // ============ 角色关联状态 ============
  const [roles, setRoles] = useState([]);
  const [roleCapabilityMap, setRoleCapabilityMap] = useState({});
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [assignForm] = Form.useForm();
  
  // ============ 工具关联状态 ============
  const [capabilityToolsMap, setCapabilityToolsMap] = useState({});
  const [assignToolsModalVisible, setAssignToolsModalVisible] = useState(false);
  const [selectedTools, setSelectedTools] = useState([]);
  const [assignToolsForm] = Form.useForm();
  
  // ============ MCP数据（仅用于TreeSelect）============
  const [mcpServers, setMcpServers] = useState([]);
  const [serverTools, setServerTools] = useState({});
  const [loadingServerTools, setLoadingServerTools] = useState({});
  const [mcpServersLoading, setMcpServersLoading] = useState(false);
  
  // ============ 分类管理状态 ============
  const [customCategoryName, setCustomCategoryName] = useState('');
  
  // ============ 能力CRUD函数 ============
  const fetchCapabilities = async () => { ... };
  const handleSubmitCapability = async (values) => { ... };
  const handleDeleteCapability = (record) => { ... };
  
  // ============ 角色关联函数 ============
  const fetchRoles = async () => { ... };
  const handleAssignRoles = async (values) => { ... };
  
  // ============ 工具关联函数 ============
  const fetchCapabilityTools = async () => { ... };
  const handleAssignTools = async (values) => { ... };
  
  // ============ MCP数据获取（仅用于TreeSelect）============
  const fetchMcpServers = async () => { ... };
  const fetchServerTools = async (serverId) => { ... };
  const fetchAllServerTools = async () => { ... };
  
  // ============ TreeSelect辅助函数 ============
  const convertToTreeData = () => { ... };
  const handleTreeSelectChange = (value, form) => { ... };
  const renderTreeSelectTags = (props) => { ... };
  const getTreeSelectProps = () => { ... };
  
  // ============ 分类管理函数 ============
  const fetchCategories = async () => { ... };
  const addCustomCategory = async (categoryName) => { ... };
  const handleCustomCategoryInput = (value) => { ... };
  const handleCustomCategorySelect = (value) => { ... };
  
  // ============ Modal显示函数 ============
  const showCreateCapabilityModal = async () => { ... };
  const showEditCapabilityModal = async (record) => { ... };
  const showAssignRoleModal = (record) => { ... };
  const showAssignToolsModal = async (record) => { ... };
  
  // ============ 初始化 ============
  useEffect(() => {
    fetchCapabilities();
    fetchCategories();
    fetchCapabilityTools();
    fetchMcpServers();
  }, []);
  
  // ============ UI渲染 ============
  return (
    <div>
      {/* 页面标题 */}
      {/* 能力表格 */}
      {/* 能力编辑Modal */}
      {/* 角色关联Modal */}
      {/* 工具关联Modal */}
    </div>
  );
};
```

---

## 🔧 实施步骤

### Step 1: 备份原文件
```bash
cd /Users/lofyer/my_git/abm-llm-v2/frontend/src/pages/roles
cp ToolManagement.js ToolManagement.js.before-cleanup
```

### Step 2: 删除自定义工具管理代码

#### 2.1 删除状态变量
```javascript
// 删除行61
- const [modalVisible, setModalVisible] = useState(false);

// 删除行76
- const [editingId, setEditingId] = useState(null);

// 删除行70
- const [form] = Form.useForm();

// 删除行87-90
- const [toolPagination, setToolPagination] = useState({
-   current: 1,
-   pageSize: 10,
- });

// 删除行45
- const [tools, setTools] = useState([]);

// 删除行58（如果loading只用于fetchTools）
- const [loading, setLoading] = useState(false);
```

#### 2.2 删除函数
```javascript
// 删除 fetchTools
// 删除 handleSubmitTool
// 删除 handleDeleteTool
// 删除 showCreateToolModal
// 删除 showEditToolModal
```

### Step 3: 删除MCP服务器管理代码

#### 3.1 删除状态变量
```javascript
// 删除行57
- const [expandedRowKeys, setExpandedRowKeys] = useState([]);

// 删除行65
- const [assignServerModalVisible, setAssignServerModalVisible] = useState(false);

// 删除行67
- const [selectedServer, setSelectedServer] = useState(null);

// 删除行69
- const [selectedCapabilities, setSelectedCapabilities] = useState([]);

// 删除行75
- const [assignServerForm] = Form.useForm();

// 删除行56
- const [serverCapabilityMap, setServerCapabilityMap] = useState({});
```

#### 3.2 删除函数
```javascript
// 删除 startServer
// 删除 stopServer
// 删除 handleExpand
// 删除 renderToolParams
// 删除 showAssignCapabilityModal
// 删除 handleAssignCapabilities
```

#### 3.3 删除UI
```javascript
// 删除服务器关联能力模态框（整个Modal组件）
```

#### 3.4 调整fetchMcpServers函数
```javascript
// 移除服务器能力映射的初始化代码
const fetchMcpServers = async () => {
  try {
    setMcpServersLoading(true);
    const apiUrl = `${getApiBaseUrl()}/mcp/servers`;
    const response = await axios.get(apiUrl);
    setMcpServers(response.data);
    
    // ❌ 删除这段代码
    // 初始化服务器与能力的映射关系
    // const serverCapMap = {};
    // response.data.forEach(server => {
    //   serverCapMap[server.id] = server.required_capabilities || ['tool_use', 'external_api', 'web_browsing'];
    // });
    // setServerCapabilityMap(serverCapMap);
  } catch (error) {
    console.error('获取MCP服务器列表失败:', error);
    message.error('获取MCP服务器列表失败');
  } finally {
    setMcpServersLoading(false);
  }
};
```

### Step 4: 清理导入
```javascript
// 检查是否有未使用的导入
// 例如: Collapse, Panel, List, Descriptions 等
```

### Step 5: 验证

#### 5.1 语法检查
```bash
cd frontend
npm run lint
```

#### 5.2 构建测试
```bash
npm run build
```

#### 5.3 功能测试
- [ ] 能力列表加载正常
- [ ] 创建能力正常
- [ ] 编辑能力正常
- [ ] 删除能力正常
- [ ] 关联角色正常
- [ ] 关联工具正常（TreeSelect显示MCP服务器和工具）
- [ ] 自定义分类正常

---

## 📊 清理前后对比

| 指标 | 清理前 | 清理后 | 变化 |
|-----|-------|-------|------|
| **总行数** | 1760行 | ~1485行 | -275行 (-15.6%) |
| **状态变量** | 30个 | 18个 | -12个 |
| **函数** | 45个 | 33个 | -12个 |
| **Modal组件** | 4个 | 3个 | -1个 |
| **代码利用率** | 87.4% | 100% | +12.6% |
| **功能完整度** | | | |
| - 能力管理 | ✅ 100% | ✅ 100% | 不变 |
| - 能力-角色关联 | ✅ 100% | ✅ 100% | 不变 |
| - 能力-工具关联 | ✅ 100% | ✅ 100% | 不变 |
| - MCP服务器管理 | ⚠️ 30% | ❌ 0% | 移至MCPServersPage |
| - 自定义工具管理 | ⚠️ 60% | ❌ 0% | 删除未完成功能 |

---

## ✅ 清理后的收益

1. **代码更简洁**: 减少15.6%的代码量
2. **职责更清晰**: 专注于"能力管理"
3. **维护更容易**: 无冗余代码干扰
4. **性能更好**: 减少不必要的状态和计算
5. **符合单一职责原则**: 一个页面一个核心功能

---

## 🚨 注意事项

1. **保留MCP数据获取**: TreeSelect需要这些数据
2. **不影响现有功能**: 能力管理的所有功能保持不变
3. **备份原文件**: 确保可以回滚
4. **充分测试**: 特别是工具关联的TreeSelect功能

---

## 📝 清理后的页面定位

**ToolManagement.js → 实际上是 CapabilityManagement**

**核心功能**：
1. ✅ 能力CRUD
2. ✅ 能力分类管理
3. ✅ 能力与角色关联
4. ✅ 能力与工具关联（使用MCP服务器和工具数据）

**不包含的功能**：
- ❌ MCP服务器管理（在 MCPServersPage.js）
- ❌ 自定义工具管理（功能未完成，已删除）

---

**下一步**: 执行清理，需要我创建清理后的完整代码吗？
