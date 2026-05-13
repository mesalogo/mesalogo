# 页面布局规范

## 列表页面标准布局

以行动任务管理页面 (`ActionTaskOverview.tsx`) 为模板，定义列表类页面的标准布局结构。

### 布局结构

```
┌─────────────────────────────────────────────────────────────────┐
│  页面头部 (Page Header)                                          │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │ 标题 (Title)            │  │ 搜索框 | 操作按钮           │   │
│  │ 副标题 (Subtitle)       │  │ (Search) (Actions)          │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  工具栏 (Toolbar)                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Tabs 标签切换                      视图切换 (Segmented) │    │
│  │ [全部] [进行中] [已完成]           [卡片] [列表]        │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  内容区 (Content Area) - 无外层 Card 包裹                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │  Card   │ │  Card   │ │  Card   │ │  Card   │               │
│  │         │ │         │ │         │ │         │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │  Card   │ │  Card   │ │  Card   │ │ + 新建  │               │
│  │         │ │         │ │         │ │  Card   │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 代码结构示例

```tsx
return (
  <div className="page-container">
    {/* 1. 页面头部 */}
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        {/* 左侧：标题区 */}
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>页面标题</Title>
          <Text type="secondary">页面描述说明文字</Text>
        </div>
        {/* 右侧：操作区 */}
        <Space>
          <Input
            placeholder="搜索..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            size="large"
          />
          <Button type="primary" size="large" icon={<PlusOutlined />}>
            新建
          </Button>
        </Space>
      </div>
    </div>

    {/* 2. 工具栏 + 内容区（直接展示，无 Card 包裹） */}
    {loading ? (
      <SkeletonContent />
    ) : (
      <Tabs
        defaultActiveKey="all"
        tabBarExtraContent={
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: '卡片视图', value: 'card', icon: <AppstoreOutlined /> },
              { label: '列表视图', value: 'table', icon: rderedListOutlined /> }
            ]}
          />
        }
        items={tabItems}
      />
    )}

    {/* 3. 弹窗等其他组件 */}
    <Modal>...</Modal>
  </div>
);
```

### 设计原则

1. **简洁纯净**：内容区不使用外层 Card 包裹，减少视觉层级
2. **功能分区**：头部（标题+操作）、工具栏（筛选+视图）、内容区 三层分明
3. **响应式网格**：卡片使用 `Row` + `Col` 布局，支持不同屏幕尺寸
4. **统一间距**：页面头部 `marginBottom: 24px`，工具栏与内容自然衔接

---

## 改造进度

### 已完成改造的页面

| 页面 | 文件路径 | 改造内容 |
|------|----------|----------|
| 行动任务管理 | `actiontask/ActionTaskOverview.tsx` | 移除外层 Card 包裹 |
| 行动空间管理 | `actionspace/ActionSpaceOverview/index.tsx` | 移除外层 Card 包裹，工具栏右对齐 |
| 实体应用市场 | `actionspace/AppMarket/MarketPage.tsx` | 移除搜索栏 Card 包裹，改为简洁工具栏 |
| 并行实验列表 | `actiontask/parallellab/ExperimentListPage.tsx` | 移除搜索筛选栏 Card 包裹 |
| 知识库主页 | `knowledgebase/KnowledgeBaseMain.tsx` | 移除每个 Tab 内容的 Card 包裹 |
| 内部知识库 | `knowledgebase/InternalKnowledge.tsx` | 移除外层 Card，按钮移到头部右侧 |
| 内部知识库列表 | `knowledgebase/KnowledgeList.tsx` | 改为 forwardRef，支持 hideCreateButton |
| 外部知识库 | `knowledgebase/ExternalKnowledge.tsx` | 移除 Card 包裹，按钮移到头部右侧 |
| 外部提供商 | `knowledgebase/external/ExternalProviders.tsx` | 改为 forwardRef，支持 hideCreateButton |
| 外部知识库列表 | `knowledgebase/external/ExternalKnowledges.tsx` | 改为 forwardRef，支持 hidateButton |
| 角色绑定 | `knowledgebase/RoleBindings.tsx` | 移除外层 Card 包裹 |
| RAGAS 评测 | `knowledgebase/RagasEvaluation.tsx` | 移除外层 padding，工具栏右对齐 |
| 实验设计页面 | `actiontask/parallellab/ExperimentDesignPage.tsx` | 移除骨架屏 Card 包裹 |
| 执行监控页面 | `actiontask/parallellab/ExecutionMonitoringPage.tsx` | 移除骨架屏和实验选择器 Card 包裹 |
| 并行实验室主页 | `actiontask/parallellab/ParallelLab.tsx` | 移除骨架屏 Card 包裹 |
| 分析报告页面 | `actiontask/parallellab/AnalysisReportPage.tsx` | 移除骨架屏 Card 包裹 |
| 实验列表页面 | `actiontask/parallellab/ExperimentListPage.tsx` | 移除骨架屏搜索栏 Card 包裹 |
| 工作空间管理 | `workspace/WorkspaceManagement.tsx` | 移除 Tab 内容 Card 包裹 |
| RAGAS评测包装器 | `knowledgebase/RagasEvaluationWrapper.tsx` | 移除外层 Card 包裹 |
| 观察者管理 | `actionspace/ObserverManagement.tsx` | 移除外层 Card 包裹，改为标题+描述布局 |

### 待改造的页面

暂无

---

## 卡片网格规范

```tsx
// 响应式列配置
<Col xs={24} sm={12} md={8} lg={6}>

const gridCardStyle = {
  height: '100%',
  minHeight: '300px',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column'
};

// 新建卡片样式
const addCardStyle = {
  ...gridCardStyle,
  border: '2px dashed var(--custom-border)',
  backgroundColor: 'var(--custom-header-bg)',
  alignItems: 'center',
  justifyContent: 'center'
};
```

## 骨架屏规范

加载状态使用骨架屏，保持与实际内容相同的布局结构：

```tsx
{loading && (
  <Row gutter={[16, 16]}>
    {[1, 2, 3, 4, 5, 6].map(item => (
      <Col xs={24} sm={12} md={8} lg={6} key={item}>
        <Card {gridCardStyle}>
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        </Card>
      </Col>
    ))}
  </Row>
)}
```

## 子组件 forwardRef 模式

当父页面需要控制子组件的操作按钮时，使用 forwardRef 模式：

```tsx
// 子组件
const ChildList = forwardRef(({ hideCreateButton = false }, ref) => {
  const showCreateModal = () => { /* ... */ };
  
  useImperativeHandle(ref, () => ({
    showCreateModal
  }));
  
  return (
    <div>
      {!hideCreateButton && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <Button type="primary" onClick={showCreateModal}>新建</Button>
        </div>
      )}
      {/* 内容 */}
    </div>
  );
});

// 父页面
const ParentPage = () => {
  const childRef = useRef();
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Title>页面标题</Title>
        <Button onClick={() => childRef.current?.showCreateModal()}>新建</Button>
      </div>
      <ChildList ref={childRef} hideCreateButton />
    </div>
  );
};
```
