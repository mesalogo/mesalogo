# NextRPA VNC 前端展示方案

## 1. 概述

用户点击 NextRPA "启动" 后，在行动空间详情页右侧新增 Tab，展示 VNC 缩略图（只读）。点击缩略图弹出 Modal 进行交互。

## 2. UI 设计

### 2.1 Tab 布局（缩略图 - 只读）

```
┌─────────────────────────────────────────────────────────────────┐
│ [基本信息] [角色] [监督者] [环境变量] [规则] [NextRPA]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  VNC: 192.0.2.22:5901 | MCP: http://192.0.2.22:3232/sse        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │                  [VNC 缩略图 - 只读]                       │  │
│  │                   点击进入交互模式                         │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  状态: ● 已连接                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Modal（点击缩略图后 - 可交互）

```
┌─────────────────────────────────────────────────────────────────┐
│ VNC 控制台                                                  [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      [VNC 可交互画面]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 实现

### 3.1 文件

```
frontend/src/pages/actionspace/AppMarket/
├── NextRPAApp.tsx     # 现有配置组件
└── NextRPATab.tsx     # 新增：Tab 内容
```

### 3.2 核心代码

```tsx
// NextRPATab.tsx
const NextRPATab = ({ appConfig }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [wsPort, setWsPort] = useState<number>(6080);
  const [status, setStatus] = useState<'disconnected' | 'connected'>('disconnected');

  const vncAddress = appConfig?.connection?.localConfig?.vncUrl || '';
  const mcpAddress = appConfig?.connection?.localConfig?.sseUrl || '';
  const vncPassword = appConfig?.connection?.localConfig?.vncPassword || '';

  // 启动 VNC 代理
  useEffect(() => {
    if (!vncAddress) return;
    
    const target = vncAddress.replace(/^wss?:\/\//, '');
    vncProxyService.start(target).then(({ token, ws_port }) => {
      setToken(token);
      setWsPort(ws_port);
      setStatus('connected');
    });
    
    return () => {
      if (token) vncProxyService.stop(token);
    };
  }, [vncAddress]);

  const wsUrl = token ? vncProxyService.getProxyUrl(wsPort, token) : '';

  if (!vncAddress) {
    return <Empty description="请先配置 VNC 地址" />;
  }

  return (
    <div>
      {/* Info Bar */}
      <div style={{ marginBottom: 8, color: '#666' }}>
        VNC: {vncAddress} | MCP: {mcpAddress}
      </div>

      {/* 缩略图 - 只读 */}
      <div 
        style={{ cursor: 'pointer' }}
        onClick={() => setModalVisible(true)}
      >
        {wsUrl && (
          <VncScreen
            u}
            scaleViewport
            viewOnly={true}
            rfbOptions={{ credentials: { password: vncPassword } }}
          />
        )}
      </div>

      {/* 状态 */}
      <Badge status={status === 'connected' ? 'success' : 'default'} text={status === 'connected' ? '已连接' : '未连接'} />

      {/* Modal - 可交互 */}
      <Modal
        title="VNC 控制台"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width="80vw"
        footer={null}
      >
        {wsUrl && (
          <VncScreen
            url={wsUrl}
            scaleViewp
            viewOnly={false}
            rfbOptions={{ credentials: { password: vncPassword } }}
          />
        )}
      </Modal>
    </div>
  );
};
```

### 3.3 ActionSpaceDetail 修改

```tsx
// 在 Tabs items 中添加
{
  key: 'nextrpa',
  label: 'NextRPA',
  children: <NextRPATab appConfig={nextRPAAppConfig} />
}
```

## 4. 依赖

```bash
npm install react-vnc
```

## 5. 后续迭代（按需添加）

- 多 VNC 支持
- 全屏 / 快捷键 / 截图
- 断线重连

---

**文档版本**: v1.1  
**更新日期**: 2025-12-31
