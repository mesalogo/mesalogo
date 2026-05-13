# 图谱社区构建功能实现方案

## 概述
在图谱增强页面中增加社区构建功能，包括手动构建和自动构建两种模式，以提升知识图谱的语义聚合能力。

## 功能需求

### 1. 前端界面改造
**位置：图谱增强页面**

#### 1.1 UI组件设计
- 在图谱增强页面添加"社区管理"区域
- 包含两个功能：
  - **手动构建按钮**：立即触发一次社区构建
  - **自动构建开关**：控制是否在每次添加episode时自动构建社区

#### 1.2 界面布局
```
图谱增强页面
├── 现有功能区域
└── 社区管理区域
    ├── 手动构建社区 [构建按钮]
    ├── 自动构建社区 [开关] (默认关闭)
    └── 状态显示 (构建中/完成/失败)
```

### 2. 后端API扩展

#### 2.1 配置管理
- 添加环境变量：`AUTO_BUILD_COMMUNITY` (boolean, 默认false)
- 在GraphEnhancement模型的framework_config字段中存储自动构建开关状态
- 提供API接口管理自动构建配置

#### 2.2 API端点扩展
```
POST /api/graph-enhancement/build-communities     # 手动构建社区（新增）
GET  /api/graph-enhancement/config                # 获取图谱增强配置（扩展返回社区配置）
POST /api/graph-enhancement/config                # 更新图谱增强配置（扩展支持社区配置）
```

### 3. MCP Server改造

#### 3.1 graphiti_mcp_server2.py修改
- 读取`AUTO_BUILD_COMMUNITY`环境变量
- 在`add_episode`调用中根据配置设置`update_communities`参数
- 添加构建状态日志记录

#### 3.2 新增端点
- 添加`/build-communities`端点
- 实现手动构建社区的API接口
- 添加构建进度和状态反馈

### 4. 数据库设计

#### 4.1 配置存储方案
社区构建配置将存储在现有的`GraphEnhancement`模型的`framework_config`字段中：

```json
// framework_config 字段中的社区配置结构
{
  // 现有的框架配置...
  "community_config": {
    "auto_build_enabled": false,
    "last_build_time": null,
    "build_status": "idle",  // 'idle', 'building', 'completed', 'failed'
    "build_history": []  // 构建历史记录（可选）
  }
}
```

无需修改数据库表结构，直接使用现有的JSON字段存储配置。

## 实现步骤规划

### Phase 1: 基础设施 (1-2天)
1. **环境变量配置**
   - 添加`AUTO_BUILD_COMMUNITY`环境变量
   - 更新`docker/docker-compose.yml`配置文件
   - 更新部署脚本和文档

2. **配置结构设计**
   - 设计framework_config中的community_config结构
   - 确保与现有图谱增强配置的兼容性

### Phase 2: 后端API开发 (2-3天)
1. **MCP Server扩展**
   - 修改`graphiti_mcp_server2.py`
   - 添加`/build-communities`端点
   - 实现环境变量读取逻辑
   
2. **后端API开发**
   - 扩展现有图谱增强配置API支持社区配置
   - 添加手动构建触发API
   - 实现状态查询和更新

### Phase 3: 前端界面开发 (2-3天)
1. **UI组件开发**
   - 设计社区管理界面
   - 实现手动构建按钮
   - 实现自动构建开关
   
2. **状态管理**
   - 添加构建状态显示
   - 实现实时状态更新
   - 添加错误处理和用户反馈

### Phase 4: 集成测试 (1-2天)
1. **功能测试**
   - 测试手动构建流程
   - 测试自动构建开关
   - 验证配置持久化
   
2. **性能测试**
   - 测试大数据量下的构建性能
   - 验证构建过程不影响其他功能

## 技术实现细节

### 6.1 关键代码结构

#### MCP Server修改
```python
# graphiti_mcp_server2.py
class GraphitiMCPServer:
    def __init__(self):
        self.auto_build_community = os.getenv('AUTO_BUILD_COMMUNITY', 'false').lower() == 'true'
    
    async def add_episode(self, episode_data):
        # 现有逻辑
        result = await self.graphiti.add_episode(
            episode_data, 
            update_communities=self.auto_build_community
        )
        return result
    
    async def build_communities(self):
        # 新增手动构建方法
        return await self.graphiti.build_communities()
```

#### 前端状态管理
```javascript
// 在现有的图谱增强配置状态中添加社区配置
const [config, setConfig] = useState({
    // ... 现有配置字段
    community_config: {
        auto_build_enabled: false,
        build_status: 'idle', // 'idle', 'building', 'completed', 'failed'
        last_build_time: null
    }
});

// 手动构建处理
const handleManualBuild = async () => {
    // 更新本地状态
    setConfig(prev => ({
        ...prev,
        community_config: {
            ...prev.community_config,
            build_status: 'building'
        }
    }));

    try {
        const response = await api.post('/api/graph-enhancement/build-communities');
        // 重新获取配置以获取最新状态
        await fetchConfig();
    } catch (error) {
        setConfig(prev => ({
            ...prev,
            community_config: {
                ...prev.community_config,
                build_status: 'failed'
            }
        }));
    }
};

// 自动构建开关处理
const handleAutoToggle = async (enabled) => {
    const updatedConfig = {
        ...config,
        community_config: {
            ...config.community_config,
            auto_build_enabled: enabled
        }
    };

    try {
        await api.post('/api/graph-enhancement/config', updatedConfig);
        setConfig(updatedConfig);
    } catch (error) {
        message.error('更新自动构建配置失败');
    }
};
```

#### 后端API实现

##### 扩展现有配置API
```python
# 修改现有的 get_graph_enhancement_config 方法
@graph_enhancement_bp.route('/graph-enhancement/config', methods=['GET'])
def get_graph_enhancement_config():
    """获取图谱增强配置（包含社区配置）"""
    try:
        config = GraphEnhancement.query.first()
        if not config:
            # 创建默认配置...

        # 获取社区配置
        community_config = config.framework_config.get('community_config', {
            'auto_build_enabled': False,
            'build_status': 'idle',
            'last_build_time': None
        })

        return jsonify({
            'success': True,
            'data': {
                'id': config.id,
                'enabled': config.enabled,
                'framework': config.framework,
                'name': config.name,
                'description': config.description,
                'framework_config': config.framework_config or {},
                'community_config': community_config,  # 新增社区配置
                'created_at': config.created_at.isoformat() if config.created_at else None,
                'updated_at': config.updated_at.isoformat() if config.updated_at else None
            }
        })

# 修改现有的 update_graph_enhancement_config 方法
@graph_enhancement_bp.route('/graph-enhancement/config', methods=['POST'])
def update_graph_enhancement_config():
    """更新图谱增强配置（包含社区配置）"""
    try:
        data = request.get_json()
        config = GraphEnhancement.query.first()
        # ... 现有逻辑 ...

        # 更新框架配置 - 包含社区配置
        if 'framework_config' in data:
            config.framework_config = data['framework_config']

        # 单独处理社区配置更新
        if 'community_config' in data:
            framework_config = config.framework_config or {}
            framework_config['community_config'] = data['community_config']
            config.framework_config = framework_config

        db.session.commit()
        # ... 其余现有逻辑 ...

# 新增手动构建社区端点
@graph_enhancement_bp.route('/graph-enhancement/build-communities', methods=['POST'])
def build_communities():
    """手动构建社区"""
    try:
        config = GraphEnhancement.query.first()
        if not config or not config.enabled:
            return jsonify({
                'success': False,
                'message': '图谱增强未启用'
            }), 400

        # 更新构建状态
        framework_config = config.framework_config or {}
        community_config = framework_config.get('community_config', {})
        community_config['build_status'] = 'building'
        framework_config['community_config'] = community_config
        config.framework_config = framework_config
        db.session.commit()

        # 调用MCP Server的build-communities端点
        response = requests.post(f"{MCP_SERVER_URL}/build-communities")

        # 更新构建结果状态
        if response.status_code == 200:
            community_config['build_status'] = 'completed'
            community_config['last_build_time'] = datetime.now().isoformat()
        else:
            community_config['build_status'] = 'failed'

        framework_config['community_config'] = community_config
        config.framework_config = framework_config
        db.session.commit()

        return response.json()

    except Exception as e:
        # 更新失败状态
        try:
            framework_config = config.framework_config or {}
            community_config = framework_config.get('community_config', {})
            community_config['build_status'] = 'failed'
            framework_config['community_config'] = community_config
            config.framework_config = framework_config
            db.session.commit()
        except:
            pass

        return jsonify({
            'success': False,
            'message': f'构建社区失败: {str(e)}'
        }), 500
```

## 风险评估与注意事项

### 7.1 性能考虑
- 社区构建可能是计算密集型操作
- 需要考虑大图的构建时间
- 建议添加构建进度指示器
- 避免在高峰期自动构建

### 7.2 用户体验
- 构建过程中的状态反馈
- 构建失败时的错误信息展示
- 避免重复构建的防护机制
- 提供构建历史记录

### 7.3 系统稳定性
- 构建过程的异常处理
- 资源使用监控
- 构建任务的超时处理
- 数据库事务一致性保证

## 配置说明

### 环境变量
- `AUTO_BUILD_COMMUNITY`: 控制是否在添加episode时自动构建社区 (true/false, 默认false)

### Framework Config字段说明
在`GraphEnhancement.framework_config`的`community_config`对象中：
- `auto_build_enabled`: 自动构建开关状态 (boolean)
- `last_build_time`: 最后一次构建时间 (timestamp)
- `build_status`: 当前构建状态 ('idle', 'building', 'completed', 'failed')
- `build_history`: 构建历史记录 (array, 可选)

## 测试计划

### 单元测试
- MCP Server新增方法测试
- 扩展现有API端点的社区配置功能测试
- 配置管理逻辑测试

### 集成测试
- 前后端交互测试
- 图谱增强配置与社区配置的集成测试
- 错误处理测试

### 性能测试
- 大规模图数据构建测试
- 并发访问测试
- 资源使用监控

## 部署注意事项

1. **环境变量配置**：确保在所有环境中正确设置`AUTO_BUILD_COMMUNITY`
2. **Docker配置更新**：更新`docker/docker-compose.yml`文件添加环境变量
3. **配置兼容性**：确保现有的图谱增强配置不受影响
4. **服务重启**：更新MCP Server和后端服务
5. **监控配置**：添加社区构建相关的监控指标

### Docker配置更新
需要在`docker/docker-compose.yml`的environment部分添加：
```yaml
environment:
  - PYTHONIOENCODING=utf-8
  - LC_ALL=C.UTF-8
  - LANG=C.UTF-8
  - FLASK_ENV=production
  - NODE_ENV=development
  - AUTO_BUILD_COMMUNITY=${AUTO_BUILD_COMMUNITY:-false}  # 新增
```

## 后续优化方向

1. **智能调度**：根据图数据变化程度决定是否需要重建社区
2. **增量构建**：实现部分社区的增量更新
3. **可视化展示**：在前端展示社区结构和统计信息
4. **性能优化**：针对大规模图数据的构建优化
