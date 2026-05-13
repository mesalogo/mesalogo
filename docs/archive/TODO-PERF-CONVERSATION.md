# ActionTaskDetails 页面性能优化计划

## 问题分析

通过对 ActionTaskDetails 页面代码的分析，我们发现以下性能瓶颈：

### 1. 数据加载和处理问题

1. **多重嵌套的异步请求**：在 `ActionTaskDetail.js` 中，`fetchTaskData` 函数包含多层嵌套的异步请求，包括获取任务详情、环境变量、智能体变量和消息历史等。

2. **大量的 API 调用**：每个智能体都会单独发起 API 请求获取变量，当智能体数量较多时会导致大量并发请求。

3. **重复的数据获取**：在多个地方都会触发变量刷新，如 `refreshVariables` 函数在消息更新和智能体响应结束时都会被调用。

### 2. 渲染性能问题

1. **复杂的组件结构**：页面包含多个嵌套的组件，如 `ActionTaskConversation`、`ActionTaskEnvironment` 等，每个组件都有自己的状态和渲染逻辑。

2. **大量的条件渲染**：代码中存在大量的条件渲染逻辑，特别是在 `ActionTaskConversation.js` 中的消息渲染部分。

3. **未优化的列表渲染**：消息列表和智能体列表没有使用虚拟滚动或分页加载，当数据量大时会导致性能问题。

### 3. 工具调用解析问题

1. **复杂的正则表达式处理**：`ConversationExtraction.js` 中使用了多个复杂的正则表达式来解析工具调用，这在处理大量文本时可能会导致性能问题。

2. **重复的 JSON 解析**：多次尝试解析 JSON 数据，特别是在处理工具调用结果时。

### 4. 状态管理问题

1. **频繁的状态更新**：多个组件中存在频繁的状态更新，特别是在处理流式响应时。

2. **大量的状态变量**：`ActionTaskConversation.js` 中定义了大量的状态变量，这会增加 React 的渲染负担。

## 优化方案

### 1. 数据加载优化

```jsx
// 优化 fetchTaskData 函数，使用 Promise.all 并行加载数据
const fetchTaskData = async () => {
  setLoading(true);
  try {
    // 并行请求任务详情和会话列表
    const [taskData, conversationsData] = await Promise.all([
      actionTaskAPI.getById(taskId),
      conversationAPI.getConversations(taskId)
    ]);

    // 设置会话数据
    setConversations(conversationsData);

    // 并行请求环境变量和智能体变量
    const [globalEnvVars, firstConversationMessages] = await Promise.all([
      actionTaskAPI.getEnvironmentVariables(taskId),
      conversationsData.length > 0 ?
        conversationAPI.getConversationMessages(taskId, conversationsData[0].id) :
        Promise.resolve([])
    ]);

    // 过滤全局变量
    const taskGlobalVars = globalEnvVars.filter(v => v.source === 'task');

    // 批量请求智能体变量
    if (taskData.agents && taskData.agents.length > 0) {
      const agentVarsPromises = taskData.agents.map(agent =>
        actionTaskAPI.getAgentVariables(taskId, agent.id)
          .then(vars => vars.map(v => ({
            ...v,
            agent_id: agent.id,
            agent_name: agent.name,
            source: 'agent'
          })))
          .catch(() => [])
      );

      const agentVarsResults = await Promise.all(agentVarsPromises);
      const allAgentVars = agentVarsResults.flat();

      // 更新任务数据
      taskData.environment_variables = taskGlobalVars;
      taskData.agent_variables = allAgentVars;
    }

    setTask(taskData);
    setMessages(firstConversationMessages.length > 0 ?
      firstConversationMessages :
      createMockMessages(taskData)
    );
  } catch (error) {
    console.error('获取任务详情失败:', error);
    message.error('加载任务详情失败: ' + error.message);

    // 创建模拟数据
    const mockTask = createMockTaskData();
    setTask(mockTask);
  } finally {
    setLoading(false);
  }
};
```

### 2. 渲染优化

#### 2.1 消息加载优化方案

以下是几种消息渲染优化方案的比较和实现：

##### 方案1：仅加载最近10条消息，滚动加载更多（推荐）

**优点：**
- 初始加载速度快，减少首次渲染时间
- 减少内存占用
- 用户体验良好，符合大多数聊天应用的交互模式

**缺点：**
- 需要修改前端和后端代码
- 需要处理滚动事件和加载状态

**实现示例：**

```jsx
// 在 ActionTaskConversation.js 中实现滚动加载

// 添加状态变量
const [hasMoreMessages, setHasMoreMessages] = useState(true);
const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
const [oldestMessageId, setOldestMessageId] = useState(null);
const messagesContainerRef = useRef(null);

// 初始加载最近10条消息
const fetchInitialMessages = async (taskId, conversationId) => {
  try {
    const messagesData = await conversationAPI.getConversationMessages(
      taskId,
      conversationId,
      { limit: 10 }
    );

    if (messagesData.length > 0) {
      setMessages(messagesData);
      setOldestMessageId(messagesData[0].id);
      setHasMoreMessages(messagesData.length >= 10);
    } else {
      setMessages([]);
      setHasMoreMessages(false);
    }

    if (onMessagesUpdated) {
      onMessagesUpdated(messagesData);
    }
  } catch (error) {
    console.error('获取消息失败:', error);
    message.error('获取消息失败: ' + error.message);
  }
};

// 加载更多历史消息
const loadMoreMessages = async () => {
  if (!hasMoreMessages || loadingMoreMessages || !oldestMessageId) return;

  setLoadingMoreMessages(true);
  try {
    const olderMessages = await conversationAPI.getConversationMessages(
      task.id,
      activeConversationId,
      {
        before_id: oldestMessageId,
        limit: 10
      }
    );

    if (olderMessages.length > 0) {
      // 保存滚动位置
      const container = messagesContainerRef.current;
      const scrollHeight = container.scrollHeight;

      // 更新消息列表和最早消息ID
      setMessages(prev => [...olderMessages, ...prev]);
      setOldestMessageId(olderMessages[0].id);
      setHasMoreMessages(olderMessages.length >= 10);

      // 恢复滚动位置
      setTimeout(() => {
        container.scrollTop = container.scrollHeight - scrollHeight;
      }, 0);

      if (onMessagesUpdated) {
        onMessagesUpdated([...olderMessages, ...messages]);
      }
    } else {
      setHasMoreMessages(false);
    }
  } catch (error) {
    console.error('加载更多消息失败:', error);
    message.error('加载更多消息失败: ' + error.message);
  } finally {
    setLoadingMoreMessages(false);
  }
};

// 监听滚动事件
const handleScroll = () => {
  const container = messagesContainerRef.current;
  if (!container) return;

  // 当滚动到顶部附近时加载更多消息
  if (container.scrollTop < 100 && hasMoreMessages && !loadingMoreMessages) {
    loadMoreMessages();
  }
};

// 在组件挂载时添加滚动监听
useEffect(() => {
  const container = messagesContainerRef.current;
  if (container) {
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }
}, [hasMoreMessages, loadingMoreMessages, oldestMessageId]);

// 消息历史区域
<div
  ref={messagesContainerRef}
  className="message-history"
  style={{
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  }}
>
  {/* 加载更多指示器 */}
  {loadingMoreMessages && (
    <div style={{ textAlign: 'center', padding: '8px' }}>
      <Spin size="small" />
      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
        加载更多消息...
      </div>
    </div>
  )}

  {/* 没有更多消息提示 */}
  {!hasMoreMessages && messages.length > 0 && (
    <div style={{ textAlign: 'center', padding: '8px', fontSize: '12px', color: '#999' }}>
      没有更多历史消息了
    </div>
  )}

  {/* 消息列表 */}
  {messages.length === 0 ? (
    <Empty
      description="暂无消息"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ margin: 'auto' }}
    />
  ) : (
    messages.map(renderMessage)
  )}

  {/* 流式响应和滚动引用 */}
  <div ref={messagesEndRef} />
</div>
```

##### 方案2：使用虚拟滚动（Virtual Scrolling）

**优点：**
- 可以一次性加载所有消息数据，但只渲染可视区域的消息
- 滚动性能好，即使有大量消息也不会卡顿
- 不需要修改后端API

**缺点：**
- 实现相对复杂
- 需要估算每条消息的高度，或使用固定高度（可能导致布局问题）
- 对于复杂消息内容（如工具调用结果）可能不太适用

**实现示例：**

```jsx
// 在 ActionTaskConversation.js 中使用虚拟滚动
import { List as VirtualList } from 'react-virtualized';

// 消息历史区域
<div className="message-history" style={{
  flex: 1,
  padding: '16px',
  position: 'relative'
}}>
  {messages.length === 0 ? (
    <Empty
      description="暂无消息"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ margin: 'auto' }}
    />
  ) : (
    <VirtualList
      width={Infinity}
      height={600}
      rowCount={messages.length}
      rowHeight={({ index }) => {
        // 根据消息内容估算高度
        const msg = messages[index];
        const contentLength = msg.content ? msg.content.length : 0;
        return Math.max(100, Math.min(300, 80 + contentLength / 10));
      }}
      rowRenderer={({ index, key, style }) => (
        <div key={key} style={style}>
          {renderMessage(messages[index], index)}
        </div>
      )}
    />
  )}

  {/* 流式响应和滚动引用 */}
</div>
```

##### 方案3：分页加载 + 虚拟滚动结合

**优点：**
- 结合了两种方案的优点
- 初始加载快，滚动性能好
- 适用于有大量历史消息的场景

**缺点：**
- 实现最复杂
- 需要同时修改前端和后端代码

**实现示例：**

```jsx
// 在 ActionTaskConversation.js 中结合分页加载和虚拟滚动
import { InfiniteLoader, List as VirtualList } from 'react-virtualized';

// 添加状态变量
const [hasMoreMessages, setHasMoreMessages] = useState(true);
const [loadingRows, setLoadingRows] = useState({});
const [messageCache, setMessageCache] = useState({});
const [totalCount, setTotalCount] = useState(0);

// 加载消息行
const loadMoreRows = async ({ startIndex, stopIndex }) => {
  // 计算需要加载的页码
  const pageSize = 10;
  const startPage = Math.floor(startIndex / pageSize);
  const stopPage = Math.floor(stopIndex / pageSize);

  // 创建加载Promise
  const promises = [];
  for (let page = startPage; page <= stopPage; page++) {
    if (!messageCache[page]) {
      promises.push(
        conversationAPI.getConversationMessages(
          task.id,
          activeConversationId,
          {
            page: page,
            limit: pageSize
          }
        ).then(data => {
          setMessageCache(prev => ({
            ...prev,
            [page]: data
          }));
          return data;
        })
      );
    }
  }

  return Promise.all(promises);
};

// 判断行是否已加载
const isRowLoaded = ({ index }) => {
  const pageSize = 10;
  const page = Math.floor(index / pageSize);
  const pageOffset = index % pageSize;

  return !!messageCache[page] && !!messageCache[page][pageOffset];
};

// 获取行数据
const getRow = ({ index }) => {
  const pageSize = 10;
  const page = Math.floor(index / pageSize);
  const pageOffset = index % pageSize;

  return messageCache[page] && messageCache[page][pageOffset];
};

// 消息历史区域
<div className="message-history" style={{
  flex: 1,
  padding: '16px',
  position: 'relative'
}}>
  {totalCount === 0 ? (
    <Empty
      description="暂无消息"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ margin: 'auto' }}
    />
  ) : (
    <InfiniteLoader
      isRowLoaded={isRowLoaded}
      loadMoreRows={loadMoreRows}
      rowCount={totalCount}
      threshold={10}
    >
      {({ onRowsRendered, registerChild }) => (
        <VirtualList
          ref={registerChild}
          width={Infinity}
          height={600}
          onRowsRendered={onRowsRendered}
          rowCount={totalCount}
          rowHeight={({ index }) => {
            const msg = getRow({ index });
            if (!msg) return 100;

            const contentLength = msg.content ? msg.content.length : 0;
            return Math.max(100, Math.min(300, 80 + contentLength / 10));
          }}
          rowRenderer={({ index, key, style }) => {
            const msg = getRow({ index });
            if (!msg) {
              return (
                <div key={key} style={style}>
                  <Spin size="small" />
                </div>
              );
            }

            return (
              <div key={key} style={style}>
                {renderMessage(msg, index)}
              </div>
            );
          }}
        />
      )}
    </InfiniteLoader>
  )}
</div>
```

#### 2.2 优化条件渲染

```jsx
// 在 ActionTaskConversation.js 中优化条件渲染
const renderMessage = React.useCallback((msg, index) => {
  // 提取思考内容
  let displayContent = msg.content;
  let thinkingContent = msg.thinking;

  // 使用 useMemo 缓存提取结果
  const extractedContent = React.useMemo(() => {
    if (msg.role === 'assistant' || msg.role === 'agent') {
      return extractThinking(msg.content);
    }
    return { cleanContent: msg.content, thinking: null };
  }, [msg.content, msg.role]);

  if (msg.role === 'assistant' || msg.role === 'agent') {
    displayContent = extractedContent.cleanContent;
    thinkingContent = extractedContent.thinking;
  }

  // 其余渲染逻辑...
}, [task.agents]);
```

#### 2.3 使用 React.memo 优化组件

```jsx
// 将消息项抽取为独立组件并使用 React.memo 优化
const MessageItem = React.memo(({ message, isResponding, streamingAgentId }) => {
  // 消息渲染逻辑
  return (
    <div className={`message-item ${message.role === 'human' ? 'sent' : 'received'}`}>
      {/* 消息内容 */}
    </div>
  );
});

// 在 ActionTaskConversation 中使用
{messages.map((msg, index) => (
  <MessageItem
    key={msg.id || index}
    message={msg}
    isResponding={isResponding}
    streamingAgentId={streamingAgentId}
  />
))}
```

### 3. 工具调用解析优化

#### 3.1 优化 ConversationExtraction 组件

```jsx
// 在 ConversationExtraction.js 中优化解析逻辑
const parseToolCalls = React.useCallback((text) => {
  if (!text) return { cleanContent: '', toolCalls: [] };

  // 使用缓存避免重复解析
  const cacheKey = text.substring(0, 100); // 使用前100个字符作为缓存键
  if (parseCache.has(cacheKey)) {
    return parseCache.get(cacheKey);
  }

  let cleanContent = text;
  const toolCalls = [];

  try {
    // 优化正则表达式匹配
    // ...现有解析逻辑...
  } catch (error) {
    console.error('工具调用解析失败:', error);
  }

  const result = { cleanContent, toolCalls };
  parseCache.set(cacheKey, result);
  return result;
}, []);

// 使用 useMemo 缓存解析结果
const { toolCalls } = React.useMemo(() =>
  parseToolCalls(content || ''),
  [content, parseToolCalls]
);
```

#### 3.2 延迟加载 ConversationExtraction 组件

```jsx
// 在 ActionTaskConversation.js 中延迟加载工具调用解析
const LazyConversationExtraction = React.lazy(() =>
  import('./ConversationExtraction')
);

// 在渲染消息时按需加载
{displayContent.includes('ToolCallAction') || displayContent.includes('ToolCallResult') ? (
  <React.Suspense fallback={<div>加载工具调用解析...</div>}>
    <LazyConversationExtraction content={displayContent} />
  </React.Suspense>
) : null}
```

### 4. 状态管理优化

#### 4.1 减少状态更新频率

```jsx
// 在 ActionTaskConversation.js 中使用防抖优化状态更新
import { debounce } from 'lodash';

// 创建防抖函数
const debouncedSetMessages = useRef(
  debounce((newMessages) => {
    setMessages(newMessages);
    if (onMessagesUpdated) {
      onMessagesUpdated(newMessages);
    }
  }, 100)
).current;

// 在处理流式响应时使用
const handleStreamResponse = (content, meta) => {
  // ...现有逻辑...

  // 使用防抖更新消息
  if (meta.connectionStatus === 'done' && meta.responseObj && meta.responseObj.response) {
    const completeResponse = meta.responseObj.response;
    const agentResponse = {
      // ...响应对象...
    };

    debouncedSetMessages([...messages, agentResponse]);
  }
};
```

#### 4.2 合并相关状态

```jsx
// 在 ActionTaskConversation.js 中合并相关状态
const [streamState, setStreamState] = useState({
  isResponding: false,
  streamingAgentId: null,
  currentStreamingResponse: '',
  currentObservingContent: '',
  isObserving: false
});

// 更新状态时一次性更新
const updateStreamState = (updates) => {
  setStreamState(prev => ({
    ...prev,
    ...updates
  }));
};

// 在处理流式响应时使用
if (meta.type === 'agentInfo' && meta.agentId) {
  updateStreamState({
    streamingAgentId: String(meta.agentId),
    isResponding: true
  });
}
```

### 5. 代码分割和懒加载

```jsx
// 在 ActionTaskDetail.js 中使用代码分割和懒加载
const ActionTaskConversation = React.lazy(() => import('./components/ActionTaskConversation'));
const ActionTaskEnvironment = React.lazy(() => import('./components/ActionTaskEnvironment'));
const ActionTaskRules = React.lazy(() => import('./components/ActionTaskRules'));
const ActionTaskSupervisor = React.lazy(() => import('./components/ActionTaskSupervisor'));
const ActionTaskConclusion = React.lazy(() => import('./components/ActionTaskConclusion'));

// 在渲染时使用 Suspense
<React.Suspense fallback={<Spin tip="加载组件..." />}>
  <ActionTaskConversation
    task={task}
    messages={messages}
    setMessages={setMessages}
    key={`interaction-${refreshKey}`}
    onMessagesUpdated={handleMessagesUpdated}
    onAgentRespondingChange={handleAgentRespondingChange}
    onUserMessageSent={refreshVariables}
  />
</React.Suspense>
```

## 实施计划

我们将按照以下步骤进行优化：

1. **优化数据加载**：重构 `fetchTaskData` 函数，使用 Promise.all 并行加载数据。

2. **消息渲染优化**：
   - [ ] 修改后端API，支持分页和限制消息数量的参数
   - [ ] 实现前端滚动加载历史消息功能
   - [ ] 初始只加载最近10条消息，向上滚动时加载更多

3. **优化组件渲染**：
   - [x] 使用 React.memo 和 useMemo 优化消息组件渲染
   - [ ] 优化条件渲染逻辑，减少不必要的计算

4. **优化工具调用解析**：
   - [ ] 重构 ConversationExtraction 组件，添加缓存机制
   - [ ] 对复杂消息内容实现懒加载

5. **实现代码分割**：
   - [ ] 对大型组件进行代码分割和懒加载
   - [ ] 使用 React.lazy 和 Suspense 延迟加载非关键组件

6. **优化状态管理**：
   - [ ] 合并相关状态，减少状态更新频率
   - [ ] 使用防抖和节流技术优化滚动事件处理

## 预期效果

通过以上优化措施，我们预期能够：

1. **提升初始加载性能**：
   - 减少页面初始加载时间 50% 以上
   - 初始只加载10条消息，大幅减少首次渲染时间
   - 并行数据加载减少等待时间

2. **改善用户体验**：
   - 提高消息列表滚动流畅度
   - 向上滚动时平滑加载历史消息
   - 保持滚动位置，避免加载时的跳动

3. **优化资源使用**：
   - 降低内存占用，特别是对于长对话
   - 减少不必要的DOM节点数量
   - 减轻浏览器渲染负担

4. **提高响应速度**：
   - 减少工具调用解析时的卡顿
   - 优化状态更新，减少不必要的重渲染
   - 提高整体页面响应速度

## 性能指标监控

为了验证优化效果，我们将监控以下性能指标：

1. 页面加载时间
2. 首次内容绘制 (FCP)
3. 交互到绘制延迟 (TTI)
4. 内存使用情况
5. 长任务执行时间
6. 组件渲染时间

我们将使用 React DevTools Profiler 和 Chrome Performance 面板来收集这些指标，并在优化前后进行对比分析。
