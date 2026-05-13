# 统一 RAG API 整理计划

## 背景

当前 LightRAG 相关代码存在以下问题：

1. **代码分散**：LightRAG 代码散落在多个位置
2. **设计冲突**：旧的嵌入式设计 vs 新的容器化设计并存
3. **API 路径不统一**：部分在 `/graph-enhancement`，部分在 `/settings/lightrag`
4. **死代码**：`lightrag_service.py` 是嵌入式占位代码，从未使用
5. **职责混乱**：`graph_enhancement.py` 同时处理 Graphiti 和 LightRAG

## 现状分析

### 当前目录结构

```
backend/app/
├── services/
│   ├── graph_enhancement/
│   │   ├── main.py                  # 统一入口（支持 graphiti/lightrag/graphrag）
│   │   ├── graphiti_service.py      # Graphiti MCP 客户端 ✅
│   │   ├── lightrag_service.py      # 嵌入式 LightRAG ❌ 占位代码
│   │   └── base.py                  # 基类
│   │
│   └── lightrag_config_service.py   # 容器化配置同步 ✅
│
├── api/routes/
│   ├── graph_enhancement.py         # /graph-enhancement/* （混合处理）
│   └── settings.py                  # /settings/lightrag/* （新增的容器控制）
```

### 当前 API 路由

| API 路径 | 功能 | 问题 |
|----------|------|------|
| `GET /graph-enhancement/config` | 获取配置 | 混合处理两种框架 |
| `POST /graph-enhancement/config` | 保存配置 | 混合处理两种框架 |
| `GET /graph-enhancement/status` | 获取状态 | LightRAG 部分调用无效的本地代码 |
| `POST /graph-enhancement/test-query` | 测试查询 | LightRAG 部分调用无效的本地代码 |
| `GET /settings/lightrag/config` | 获取 LightRAG 配置 | 新 API，正确 |
| `POST /settings/lightrag/sync` | 同步配置到容器 | 新 API，正确 |
| `GET /settings/lightrag/health` | 健康检查 | 新 API，正确 |
| `POST /settings/lightrag/service-control` | 服务控制 | 新 API，正确 |

### 前端调用情况

`LightragTab.tsx` 混合使用两套 API：
- `useGraphEnhancement` hook → 调用 `/graph-enhancement/*`
- 直接调用 → `/settings/lightrag/*`

---

## 整理目标

### 设计原则

1. **Graphiti 和 LightRAG 分离**：两者是独立系统（记忆 vs 知识库），不共用框架
2. **LightRAG 统一为容器化方案**：删除嵌入式占位代码
3. **API 路径统一**：LightRAG 所有 API 在 `/lightrag/*` 下
4. **前端独立 hook**：`useLightRAG` 专门处理 LightRAG

### 目标目录结构

```
backend/app/
├── services/
│   ├── graphiti/                    # Graphiti 记忆系统
│   │   ├── __init__.py
│   │   └── graphiti_service.py      # MCP 客户端
│   │
│   └── lightrag/                    # LightRAG 知识库系统
│       ├── __init__.py
│       ├── lightrag_service.py      # 容器 API 客户端
│       └── lightrag_config.py       # 配置同步（原 lightrag_config_service.py）
│
├── api/routes/
│   ├── graphiti.py                  # /graphiti/* API（重命名自 graph_enhancement.py）
│   └── lightrag.py                  # /lightrag/* API（新建）
```

### 目标 API 设计

#### Graphiti API（记忆系统）- 保持现有

| 路径 | 方法 | 功能 |
|------|------|------|
| `/graphiti/config` | GET | 获取 Graphiti 配置 |
| `/graphiti/config` | POST | 保存 Graphiti 配置 |
| `/graphiti/status` | GET | 获取服务状态 |
| `/graphiti/test-query` | POST | 测试查询 |
| `/graphiti/service-control` | POST | 服务控制 |
| `/graphiti/visualization/*` | GET | 可视化接口 |

#### LightRAG API（知识库系统）- 新建

| 路径 | 方法 | 功能 |
|------|------|------|
| `/lightrag/config` | GET | 获取 LightRAG 配置 |
| `/lightrag/config` | POST | 保存 LightRAG 配置 |
| `/lightrag/status` | GET | 获取服务状态（调用容器 /health） |
| `/lightrag/sync` | POST | 同步配置到容器 |
| `/lightrag/service-control` | POST | 启动/停止容器 |
| `/lightrag/query` | POST | 测试查询（代理到容器 /query） |
| `/lightrag/documents` | POST | 上传文档（代理到容器） |
| `/lightrag/workspaces` | GET | 获取知识库列表 |

### 前端目标结构

```
frontend/src/
├── services/api/
│   ├── graphiti.ts                  # Graphiti API（重命名）
│   └── lightrag.ts                  # LightRAG API（新建）
│
├── pages/settings/GraphEnhancementSettingsPage/
│   ├── GraphitiTab.tsx              # 使用 useGraphiti hook
│   ├── LightragTab.tsx              # 使用 useLightRAG hook
│   ├── useGraphiti.tsx              # Graphiti hook（重命名）
│   └── useLightRAG.tsx              # LightRAG hook（新建）
```

---

## 实施步骤

### 阶段 1：后端重构 ✅ 完成

#### 1.1 创建 LightRAG 服务模块 ✅
- [x] 创建 `backend/app/services/lightrag/` 目录
- [x] 移动 `lightrag_config_service.py` → `lightrag/lightrag_config.py`
- [x] 创建 `lightrag/lightrag_service.py`（容器 API 客户端）
- [x] 创建 `lightrag/__init__.py`

#### 1.2 创建 LightRAG API 路由 ✅
- [x] 创建 `backend/app/api/routes/lightrag.py`
- [x] 实现 `/lightrag/config` GET/POST
- [x] 实现 `/lightrag/status` GET（调用容器健康检查）
- [x] 实现 `/lightrag/sync` POST
- [x] 实现 `/lightrag/service-control` POST
- [x] 实现 `/lightrag/query` POST（代理到容器）
- [x] 注册蓝图到 app

#### 1.3 清理旧代码 ✅
- [x] 删除 `services/graph_enhancement/lightrag_service.py`（嵌入式占位代码）
- [x] 从 `services/graph_enhancement/main.py` 移除 LightRAG 相关逻辑
- [x] 从 `api/routes/settings.py` 移除 LightRAG API（已迁移）
- [ ] 重命名 `graph_enhancement.py` → `graphiti.py`（可选，保持兼容）

### 阶段 2：前端重构 ✅ 完成

#### 2.1 创建 LightRAG API 服务 ✅
- [x] 创建 `frontend/src/services/api/lightrag.ts`
- [x] 实现所有 LightRAG API 调用方法

#### 2.2 创建 useLightRAG hook ✅
- [x] 创建 `useLightRAG.tsx`
- [x] 实现配置加载/保存
- [x] 实现状态查询
- [x] 实现服务控制
- [x] 实现测试查询

#### 2.3 修改 LightragTab ✅
- [x] 替换 `useGraphEnhancement` 为 `useLightRAG`
- [x] 移除直接的 fetch 调用
- [x] 统一使用新 hook

#### 2.4 清理旧代码（可选）
- [ ] 从 `useGraphEnhancement.tsx` 移除 LightRAG 相关逻辑（如有）
- [ ] 重命名 `useGraphEnhancement.tsx` → `useGraphiti.tsx`（可选）

### 阶段 3：数据库调整 ✅ 无需修改

#### 3.1 配置存储方案
- [x] 继续使用 `GraphEnhancement` 表存储配置
- [x] 通过 `framework` 字段区分：`graphiti` vs `lightrag`

---

## 详细实现

### LightRAG 服务类设计

```python
# backend/app/services/lightrag/lightrag_service.py

class LightRAGService:
    """LightRAG 容器化服务客户端"""
    
    def __init__(self, service_url: str = "http://localhost:9621"):
        self.service_url = service_url
    
    def health_check(self) -> dict:
        """检查服务健康状态"""
        response = requests.get(f"{self.service_url}/health", timeout=5)
        return response.json()
    
    def query(self, query: str, workspace: str, mode: str = "hybrid", **kwargs) -> dict:
        """执行查询"""
        headers = {"LIGHTRAG-WORKSPACE": workspace}
        response = requests.post(
            f"{self.service_url}/query",
            headers=headers,
            json={"query": query, "mode": mode, **kwargs}
        )
        return response.json()
    
    def upload_document(self, workspace: str, content: str, filename: str) -> dict:
        """上传文档"""
        headers = {"LIGHTRAG-WORKSPACE": workspace}
        response = requests.post(
            f"{self.service_url}/documents/text",
            headers=headers,
            json={"content": content, "filename": filename}
        )
        return response.json()
    
    def get_workspaces(self) -> list:
        """获取所有知识库（workspace）列表"""
        response = requests.get(f"{self.service_url}/workspaces")
        return response.json()
```

### 前端 API 服务设计

```typescript
// frontend/src/services/api/lightrag.ts

const lightragAPI = {
  // 配置管理
  getConfig: () => api.get('/lightrag/config'),
  saveConfig: (data) => api.post('/lightrag/config', data),
  
  // 服务状态
  getStatus: () => api.get('/lightrag/status'),
  
  // 配置同步
  syncConfig: () => api.post('/lightrag/sync'),
  
  // 服务控制
  controlService: (action: 'start' | 'stop') => 
    api.post('/lightrag/service-control', { action }),
  
  // 查询测试
  testQuery: (data) => api.post('/lightrag/query', data),
  
  // 知识库管理
  getWorkspaces: () => api.get('/lightrag/workspaces'),
};

export default lightragAPI;
```

---

## 兼容性考虑

### API 路径兼容

暂时保留旧的 `/graph-enhancement/*` 路径作为别名，避免其他地方调用出错：

```python
# 保留旧路径的重定向（可选）
@graph_enhancement_bp.route('/graph-enhancement/config', methods=['GET'])
def get_config_compat():
    # 根据 framework 参数重定向到对应 API
    ...
```

### 数据库兼容

`GraphEnhancement` 表结构保持不变，通过 `framework` 字段区分配置类型。

---

## 时间估计

| 阶段 | 任务 | 预计 |
|------|------|------|
| 阶段 1 | 后端重构 | - |
| 阶段 2 | 前端重构 | - |
| 阶段 3 | 测试验证 | - |

---

## 检查清单

- [x] 后端 LightRAG 服务模块创建完成 (2026-01-19)
- [x] 后端 LightRAG API 路由创建完成 (2026-01-19)
- [x] 后端旧代码清理完成 (2026-01-19)
- [x] 前端 LightRAG API 服务创建完成 (2026-01-19)
- [x] 前端 useLightRAG hook 创建完成 (2026-01-19)
- [x] 前端 LightragTab 修改完成 (2026-01-19)
- [ ] 功能测试通过
- [x] 文档更新 (2026-01-19)

## 完成总结 (2026-01-19)

### 新建文件
- `backend/app/services/lightrag/__init__.py`
- `backend/app/services/lightrag/lightrag_config.py`
- `backend/app/services/lightrag/lightrag_service.py`
- `backend/app/api/routes/lightrag.py`
- `frontend/src/services/api/lightrag.ts`
- `frontend/src/pages/settings/GraphEnhancementSettingsPage/useLightRAG.tsx`

### 删除文件
- `backend/app/services/lightrag_config_service.py`（已移动到新位置）
- `backend/app/services/graph_enhancement/lightrag_service.py`（嵌入式占位代码）

### 修改文件
- `backend/app/api/routes/__init__.py` - 注册 lightrag_bp
- `backend/app/api/routes/settings.py` - 移除 LightRAG API
- `backend/app/services/graph_enhancement/main.py` - 移除 LightRAG 支持
- `backend/app/services/graph_enhancement/__init__.py` - 更新注释
- `frontend/src/pages/settings/GraphEnhancementSettingsPage/LightragTab.tsx` - 使用新 hook

### API 路径变更
| 旧路径 | 新路径 |
|--------|--------|
| `/api/settings/lightrag/config` | `/api/lightrag/config` |
| `/api/settings/lightrag/sync` | `/api/lightrag/sync` |
| `/api/settings/lightrag/health` | `/api/lightrag/health` |
| `/api/settings/lightrag/service-control` | `/api/lightrag/service-control` |
| `/api/graph-enhancement/test-query` (LightRAG) | `/api/lightrag/query` |
