# TODO任务分类与优先级

## 已完成任务
- [x] 前端解析think、markdown
- [x] AGENT发送流式输出后结束时会闪现完整内容，但是讨论模式却没有闪现完整输出
- [x] 角色管理中，温度滑块没有默认值在提交的时候没有
- [x] 在行动空间中添加角色的时候，可以指定额外提示词，比如"你与谁一起是辩论中的甲方"，"你要扮演坏人，不要暴露自己，给出误导"
- [x] MCP server npx好像都没有生效
- [x] MCP 外部server管理要在程序启动后加载

## 行动空间与任务的全局设置
- [ ] 增加一个任务配置页面，增加一个是否随机姓名，即可以在创建行动任务的时候，赋予agent随机姓名
- [ ] 行动空间中，可以指定角色数量，以及姓名
- [ ] 行动空间添加角色时，应可以批量添加
- [ ] 自动讨论主题应该是个长文本框
- [ ] 自动讨论时，应可以指定固定总结人
- [x] 角色身份有时有混乱——在上下文中增加了ID
- [ ] 在基本设置中，增加seed_data_system_settings中的配置
- [ ] 角色的能力和工具的关系，应该是这样，角色->工具，现有角色再有工具，修改一下message_processor.py中的提示词

## SSE数据协议

- [x] 【重点】前端的ConversationExtraction，要从meta中读取，也就是前端的解析要从meta中读取
- [x] 【重点】梳理SSE数据协议
- [x] FORMAT的消息格式，应该前后端统一
- [ ] 应该可以支持非流式输出，在全局配置中控制
- [ ] 处理OPR分开的过程，PLAN放进虚拟消息
- [x] tool被调用的过程要单独展示出来，参考 ant design x
- [x] 拆分actionspace页面
- [ ] agent回复时，消息框的时间戳应该以响应时间为准固定下来，不应该是一直变化的实时时间
- [x] 整理所有后端->前端的路径，生产者和消费者(包括数据包)

## Agent记忆（未来功能）
- [ ] 真正的智能体记忆使用向量数据库+RAG实现
- [ ] 每个agent应该有自己的记忆存储
- [ ] 记忆检索应支持语义搜索

## 观察者
- [ ] 观察者应该是LLM规则+逻辑规则的检查者

## 消息
- [ ]消息界面中，应可以实时渲染think标签内容

## 会话
- [ ] 实现OPR过程，观察 计划 推理
- [x] 能力与工具有关联关系，需要单独维护一个表
- [x] 角色界面的工具能力要实现
- [x] 工具的导入执行，要支持python uv
- [x] 调用工具，要增加一个环境变量（searxng）
- [ ] 自动会话开始后，很多提示都应该归集，状态提示可以常驻在会话上方，但是系统发来的请求要展示在会话界面的系统消息里，包括虚拟消息、turnprompt、系统提示......
- [ ] 轮到智能体 物理学教授(物理学教授) 发言 这类发言应该是系统消息，不应该混在智能体的回复消息框中
- [x] 自动会话时，不要刷新整个页面，体验不好
- [] 如果agent在回复，那么下面的中断并发送按钮，在输入框没有内容的时候，可以变成中断，从而中断当前agent的前后端回复，也就是增加一个流请求管理器
- [x] 性能优化，参考PLAN-PERF.md
- [x] 会话框的agent回复宽度，应该一直保持默认的最大宽度，不应该动态变化
- [x] 调用结果默认可以收起（Extraction中collapsed删掉）
- [x] 看一下其中获取变量的部分，能不能做成批量的，提高性能。
- [ ] 当agent在会话框中输出时，用户可以往前拉来取消页面自动滚动到最新内容，当用户再下拉到最底部时，再继续自动滚动
- [ ] 在actiontaskdetail中，每当有工具调用发生时，actiontaskConversation前端的环境变量和智能体变量要更新

- [ ] 界面刷新后，讨论任务的状态应该维持
- [x] 你先把conversation.py的文件做拆分，把自动化会话和顺序会话分开，注意不要更改功能实现。

- [ ] 状态管理：应该实现一个完整的自动会话状态管理
  1. 取消任务后端就不会继续执行任务了
  2. 界面刷新后，自动讨论任务的状态应该维持，你可以在浏览器中使用本地存储，这样用户刷新以后可以看到自动讨论的任务状态等内容，可能看不到agent输出但是能保证他知道正在运行任务。
- [ ] 自动讨论中，对应的主题应该在右侧展示出来。
- [ ] 讨论
- [x] 前端：自动会话，创建的时候，应该是这样
  运行方式
    单步模式：可以指定轮数
    自动模式：无线轮数
  停止条件：
    环境变量 > >= = <= <
    智能体变量 > >= = <= <
  智能体行动方式：
    顺序发言：会按照添加角色顺序发言，考虑前者的上下文
    随机发言：会
    由监督者安排
    需要总结？总结人？
- [ ] 自动会话应当有一个后台管理，即便浏览器刷新，也可以手动恢复状态
- [ ] 一起讨论和谐、辩论是属于规则的
- [x] agent查询工具用法可能应该做个单独的外部提示词，供agent使用
- [ ] 页面刷新后，界面可以感知到自动会话，虽然没有流式输出，但是刷新页面即可得到新消息，由此我认为可以让前端与后端建立新的联系
- [ ] 如果是公开变量，别的智能体可以查看，如果不是，则不可以(比如放到systemprompts里)
- [x] **message中增加一个message_without_thinking，以节省上下文**
- [ ] **停止讨论功能要生效**
- [ ] 会话要增加一个并行模式【注意：将产生大量消耗】

你们做一个游戏，第一个人可以创建变量，比如市场情况、美元金额等等建立一个市场所需的各种环境变量，每个人都可以自己先创建一个金钱变量，接下来每个人从市场公开交易，同时修改对应的变量。注意，你们都可以修改环境变量以及个人变量，而且每一步行动都要给出解释。

你们在一个真实的市场中，你们需要持续不断的进行外汇交易，以持续化最大收入，最后一轮中，最后一个行动者要卖掉所有的订单。
你们可以通过工具来查看新闻、汇率等，比如使用Searxng来搜索新闻，使用metatrader进行平台交易查询等。
如果是交易策略或者你们自己的想法，或者与人共享的东西，可以记录环境变量与个人变量中。
注意，每一次你们的回应中，都要通过metatrader的工具进行市场查询与交易。
注意，每一次你们的回应中，交易的币种为EURUSD，查询交易蜡烛图或者价格使用candles_latest_api_v1_market_candles_latest_get，下单使用place_market_api_v1_orders_market_post。


## 代码优化（中优先级）
- [ ] service/routes文件要重新组合
- [ ] 合并流式与非流式的python代码，太冗余了
- [ ] 创建一个通用的处理函数，接受一个回调参数，根据是否提供回调来决定是流式还是普通响应
- [ ] 将 add_message_to_conversation 和 _process_single_agent_response 合并
- [ ] 将 start_auto_discussion 和 start_auto_discussion_stream 合并为一个函数
- [ ] 添加一个参数控制是否使用流式处理
- [ ] 抽象响应处理逻辑：创建统一的响应处理接口，根据需要执行流式或非流式操作
- [ ] 中断消息或者会话时，需要真正的中断服务器响应同时
- [ ] cmd+f搜索meta，要好好定义这个wrapper，标准化掉，尽可能的都放meta中



## MCP相关
- [ ] variable的mcp server已经用fastmcp单独实现了，后续可以继续用fastmcp，包括客户端也是
- [x] 聊完后，MCP闪现的问题需要修复
- [ ] 区分内部mcp和外部mcp的配置文件，编辑是外部，启动的时候两个配置文件都读
- [x] MCP的工具调用方式应该存储到数据库中，否则每次都要读一下，同时，工具可以拥有单独的调用说明。已经放进缓存里了。
- [x] 要兼容DeepSeek的工具格式{}
- [x] 如果是action类型（即ToolCallAction），单独等待结果
- [x] *（已经去掉了xml_call的前端解析）*如果是xml_call类型，以卡片形式展示
- [x] 工具调用后要再调用一次同一个agent带结果
- [x] 工具的调用结果判断应该以isError为准
- [ ] 工具调用前,完整内容会多出来一份,在流式输出中
- [ ] 找一个长期记忆的MCP，文档总结类的
- [ ] **把MetaTrader的MCP（好几个）导进来作为磨炼功能的场景**
- [ ] **工具的调用后端解析方式ToolcallAction ToolCallResult，不要输出到content中了，放进meta里即可，content中的内容统一设置为<tool_call>，否则会影响agent再次调用工具**
- [ ] 如果是Markdown格式里的工具，就不要调用了
- [ ] **提供外部API的MCP服务器化界面** 用户可以把普通的API Call在界面内暴露为stdio/http的MCP服务器

## license资源应用
- [ ] 时间限制
- [ ] 资源限制

## 功能扩展（低优先级）
- [ ] 加一个驱动方式，时间和时间趋动
- [ ] 行动任务可以重置，恢复所有变量的默认值
- [ ] 增加一个外部变量，可以通过mcp curl获取或读写带权限
- [ ] 虚拟消息，要有个接口可以让外部触发
- [ ] 全局变量里加一个沙盒配置，不同的行动空间可以绑定同一个沙盒，或者是区分开，对勾，沙盒用于工具运行
- [ ] 彩页里加一个运营策略面向内部
- [ ] 会话页面agent增加一个，查看项目空间
- [ ] 变量页面增加个可视化配置，可以查看环境变量和agent变量
- [ ] qwen2.5 1m 上下文
- [ ] 模拟-知识-执行
- [ ] 虚拟提示词要可以设置

## 维护类（持续进行）
- 查看所有后端的数据库相关内容，定期更新DB.md
- 查看所有后端API，定期更新API.md
- 定期查找硬编码的链接，比如localhost 3000 8080，定义分别使用前端环境变量frontend/.env和后端config.conf

# 功能需求

- [ ] 智能体记忆：MCP原生RAG、Cognee、GraphRAG（MS）
- [ ] 知识库：RAGFlow有MCP
- [ ] 增加一个能力，动态环境变量：允许AGENT自己设置不存在的变量，创建一个freewill的高级角色能力，并在seed_data中关联，它允许agent在没有环境变量或智能体的时候，可自主创建环境、智能体变量。
- [ ] 提示词优化，参考prompts[https://github.com/elder-plinius/CL4R1T4S/blob/main/CURSOR/Cursor_Prompt.md]中的cursor和manus等
- [ ] 增加一个自动提示词的功能



# 流式取消
## 目标
1. 点击"停止"按钮后立即停止LLM的生成过程
2. 在顺序对话中取消当前智能体后，能平滑切换到下一个智能体
3. 降低系统资源消耗，提高响应效率
4. 改善用户体验，使停止操作更加可靠和即时 

## 原则
1. 不要引入乱起八遭不在文档内的内容
2. 尊重以前的代码实现，不要自己再另行创建
3. 关注后端conversation目录中的以及conversation_servcie.py
4. 监督者尚未实现，你只要预留接口即可
5. 注意不要影响其他的功能



## 参考
目前的关联关系是这样：行动任务->会话（子任务）->会话调度（单个会话、顺序会话、自动会话）->智能体->消息（流式）。

## 参考（抽象会话）
目前的关联关系是这样：行动任务->会话（子任务）->会话调度（单个会话、顺序会话、自动会话）->智能体->消息（流式）。
现在，我们先处理第一个事情，即实现会话调度，可以抽象单个会话、顺序会话、自动会话，你先从后端入手，做代码的拆分，以支持未来更灵活的调度策略，实现会话中增加任意流程节点的目标，比如监督者机制、自定义自动会话中的总结着、外部触发会话等。
把单个会话、顺序会话、自动会话的会话调度放进conversation_scheduler.py中。@app/services/conversation_scheduler.py
*注意* 你要清楚其中每个函数的目的，改动的实现不要影响其他功能。
后端代码在@app/services，前端代码在@frontend/里的conversation、ActionTaskDetail、ActionTaskConversation中

## Goals
In the sequential or auto task, when user click "停止" in the conversation bottom, there should be goals like this:
1. cancel the current streaming agent output in the frontend and backend, disconnect with the llm.
2. send a agentinfo like the agent normal llm output done, so the next agent(if have) will continue.
3. the agent streamed output should leave as it is, system may send a message in the conversation that the agent's streaming is cancelled.

To do this, you should checkout the cancel streaming functions in the frontend conversation.js, ActionTaskConversation.js and other, in the backend mainly stream_handler.py and others, I think.

If you wanna build a streaming register function, do remember that: the streaming has too much content and there will be so many streaming at same time, you should register the streaming in the memory. 

The streaming register/cancel data structure I think it should be actiontask->conversation->agentid will be engough, so that you can find and cancel the streaming agent precisely by agent id or cancel all the streaming in the conversation by conversation id.

To achieve that, you can rewrite the old streaming register/cancel functions, do not think about compatibility, because it does not work now.

Current relationship: 行动任务->会话（子任务）->会话调度（单个会话、顺序会话、自动会话）->智能体->消息（流式）。

Here's some problems we may meet in the future:
1. The cancel did not cancel the backend llm output really.
2. The "停止" button should be available if the conversation has streaming agents.the frontend alreay knows which agents is streaming, like responding status in the "智能体列表".
3. The "停止" button in the conversation bottom affects current streaming agent only, which will cancel the current agents streaming job(means cancel by agent id). Use cancel by id instead of uuid, mean search the agent's id steaming job, and stop it. While "停止讨论" works on the whole conversation, which will cancel all the agent schedule in the sequential/audo conversation.
4. After cancel the current agents' streaming, the next agent should be able to continue the conversation just like agent's normal done status.
5. You can build a function named format_agent_cancel_done in the message_formater.py, like format_agent_error_done which will notify the system that the agent done in the current sequential/auto converstation, so that the next agent continue the conversation.
6. DO NOT CHANGE UNRELATED CODE.

BTW, 流式连接错误: 流式请求被用户中断 in the frontend log is too serious, I think it should be a warning.

**Now, give me your solution**
**And do the auto test, write and excute the test at every step you make, do not stop until you achive our goals**

The file you may need:
@app/services/conversation/stream_handler.py
@app/services/conversation/message_formater.py
@app/services/conversation/message_processor.py
@app/services/conversation/model_client.py
@app/services/conversation_service.py
@app/api/routes/conversations.py
@app/services/conversation/sequential_conversation.py
@app/services/conversation/auto_conversation.py
@frontend/src/services/api/conversation.js
@frontend/src/pages/actiontask/components/ActionTaskConversation.js
@frontend/src/services/api/conversation.js
@frontend/src/pages/actiontask/ActionTaskDetail.js
@frontend/src/pages/actiontask/ActionTaskOverview.js

## Solution 1:
You can just change from the model_client.py, to notify it streaming job with agent id to cancel.
So it will be like this:
Frontend->conversation->"停止"(with current agent id)->stream_handler->model_client->cancel the streaming job.
Then the  model client return with format_agent_cancel_done message, and the stream_handler will send it to the frontend.
Then the backend and frontend change will be very easy.

## Solution 2:
Now let's do this in step.
### Delete old cancel streaming function in the frontend and backend.
1. Delete the old cancel streaming function in the frontend and backend.
2. Make the "停止" button available in the conversation bottom, when there are still agent in responding status or streaming.

### Cancel without streaming manager, make cancel directly in the model_client, act cancel as normal agent_error_done
1. Remove old stream register and cancel in the stream handler
2. Make sure that sending request from stream_handler, add the agent id in the request, so the model_client know how many streaming and who they are.
3. When user click "停止" in the conversation bottom, the frontend will send a request to the backend, the backend will cancel the streaming job in the model_client, and the model_client will return a format_agent_cancel_done message, and the stream_handler will send it to the frontend.


Syntax error in text
mermaid version 11.6.0
Syntax error in text
mermaid version 11.6.0
Syntax error in text
mermaid version 11.6.0
Syntax error in text
