# [2026-05] additional_params 当垃圾桶

> 错误模式（anti-pattern）记录，而不是某一次线上事故。代价是产品体验里的暗坑 + 未来 refactor 成本。
> 触发 commit：2026-05-19 的"拆 custom_headers / custom_body"PR 在做 grep 时盘出。

## 发生了什么

`ModelConfig.additional_params`（JSON dict）被设计成"通用附加参数"，并在前端模型设置页以一个 JSON TextArea 直接暴露给用户。表面上是 OpenAI 风格的"扩展字段"。

实际上 4 个完全不同的用法挤在这一个字段里：

| 调用点 | 读出来的 key | 真实用途 | 是否进入网络请求 |
|---|---|---|---|
| `embedding_service.py` | `dimensions` | 拼到 embedding HTTP body | ✅ |
| `reranker_service.py` | `use_fp16`, `batch_size` | 本地 `FlagReranker(...)` 构造器参数 | ❌ |
| `lightrag_config.py` | `embedding_dim` | LightRAG 子进程的 env var `EMBEDDING_DIM` | ❌ |
| `summary_service.py`（已废弃用法） | 任意 key | 整体 `**` 展开进 chat completion 的 SDK kwargs | ✅ |

更糟糕的是：用户在一个 embedding 模型上"附加参数"框里写 `temperature` 不会有任何报错——但永远不会生效。是一个**沉默失败**的暗坑。

## 根因

历史演化：早期为某个 vendor 临时加扩展字段，便宜的做法是"再加个 JSON dict 兜一下"。每次再有新需求都往里塞。结果一个**用户可编辑的字段**承担了**至少 4 种不同语义**：HTTP body / SDK kwargs / 本地构造器参数 / 子进程 env var。

这违反了"一个字段一种用途"的最基本原则。

## 为什么 Agent / 我们没早发现

- [x] AGENTS.md 没规定"用户可编辑的 ModelConfig 字段必须语义单一"
- [x] 没有 lint / 测试限制 `model_config.additional_params` 的读取面
- [x] 错误信息不存在——用户写错 key 静默丢弃
- [x] `additional_params` 这个名字本身就是垃圾桶诱因（"附加"="想塞啥塞啥"）
- [ ] supervisor 不适用，这是配置面而非运行面

Agent 之前不会自动重构是因为：每次只看到自己手头那一种使用方式，没有横向 grep 全部读出点的视角。这次是用户主动追问"按模型类型区分吧？"才暴露出来。

## 怎么改掉（已做）

代码修复（2026-05-19 PR1）：

- `ModelConfig` 增加 `custom_headers` / `custom_body` 两列，分别合并到出站 HTTP 请求的 headers / body。
- 新建 `app/services/llm_http` 模块提供 `merge_custom_headers` / `merge_custom_body`，集中合并语义（Content-Type 保护 + 按 `modalities` 软警告）。
- 7 个 chat 入口 + embedding 服务的两个分支都接通新字段。
- `summary_service.py` 移除危险的 `**(model_config.additional_params or {})` 展开。
- 前端 `ModelFormModal.tsx` 拆为：自定义请求头 (JSON) / 自定义请求体 (JSON) / 折叠的"本地参数（高级）"。
- 文档 `docs/agents/model-config-custom-params.md` 写明三类字段的边界。
- AGENTS.md §4 表新增一行指向上面那篇文档。

但是**没有彻底把 `additional_params` 移除**——本次 PR 只完成"split"，不做"灭活"，避免一次 PR 干两件事（违反 AGENTS.md §3.3 "no one-shot mode"）。

## 怎么防止再犯（长期）

- [x] AGENTS.md §4 上游检索表加入 `model-config-custom-params.md`：未来碰这块代码必须先读。
- [ ] **PR4（TODO.md §历史债）灭活 `additional_params`**：把 4 个错位用法分别迁到正确归属（`custom_body` / `SystemSetting` / LightRAG 自己的配置），Alembic 删列。这是真正的根治。
- [ ] 加一条产品级规范（写进 `docs/agents/`）：**用户可编辑的 JSON 字段，必须有明确的"接收方+作用域"标签**（如 "outbound HTTP body"、"local-process env"），不允许暧昧"通用附加"。
- [ ] 给 `app/services/llm_http/` helper 加 strict mode（未来）：在非 dev 环境下，body 出现"完全不属于该 modality 字段族"的 key 时直接拒绝而不是 warn。
- [ ] 给 ModelConfig 任何新加的 JSON 字段加 PR review checklist：必须回答"这个字段被读出来后去哪？header? body? 本地?"

## 错误模式 (anti-pattern) 抽象

> 给所有 agent / 同事的可复用规则：
>
> **任何"扩展参数 / 附加参数 / extra / additional / extras / metadata"型 JSON 字段，如果暴露给最终用户编辑、且被两处以上代码读取并用于不同目的，必视为定时炸弹。**
>
> 修复时优先级是：先 split（拆字段，让每处去拿自己的），后 deactivate（数据迁完老字段可以删）。不要试图"加文档让用户别用错"——文档无法补偿沉默失败。

## 延伸阅读

- TODO.md §历史债 PR4
- `docs/agents/model-config-custom-params.md`
- `backend-fastapi/AGENTS.md §4 "No silent fallbacks"`（同一精神：让错误尽早冒出）
- Mitchell Hashimoto, *Engineering with AI* (2026)：fields with multiple owners decay; pin one owner per field
