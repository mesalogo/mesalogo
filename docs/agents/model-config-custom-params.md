# Model Config: custom_headers / custom_body / additional_params

> Reading time: 5 minutes. Skim before adding new fields to `ModelConfig` or
> touching any outbound HTTP call to an upstream LLM / embedding / rerank
> service.

The `ModelConfig` table carries **three** semantically distinct user-editable
parameter bags. They are deliberately split because mixing them caused
real bugs (most notably: `additional_params` was being spread into both
`send_request(**kwargs)` *and* into local Python constructors, which meant
e.g. `reranker_service`'s `use_fp16` would leak into an LLM chat payload
if the user ever set it on a chat model).

## The three fields

| Column | Where it ends up | Edited by user as | Typical examples |
|---|---|---|---|
| `custom_headers` (JSON dict) | Outbound HTTP **headers** when calling the upstream model API | Top JSON box on the model form, label "自定义请求头 / Custom Headers" | `{"HTTP-Referer": "https://example.com"}`, `{"api-key": "..."}` (Azure), `{"X-Title": "MyApp"}` (OpenRouter) |
| `custom_body` (JSON dict) | Outbound HTTP **request body** (chat/embedding/rerank — whichever this model is) | Second JSON box, label "自定义请求体 / Custom Body". Placeholder/tooltip switches by `modalities`. | chat: `{"reasoning_effort": "high"}`; embedding: `{"encoding_format": "float"}`; rerank: `{"top_n": 5}` |
| `additional_params` (JSON dict) | **Local-process** parameters only — never sent over the network | Collapsed "Local Parameters (Advanced)" section | reranker `{"use_fp16": true, "batch_size": 32}`, embedding `{"dimensions": 1536, "embedding_dim": 1024}` |

### Why `additional_params` is preserved separately

Three current call sites read `additional_params` *as Python kwargs / env
values* and never put them on the wire:

* `app/services/knowledge_base/reranker_service.py` — `use_fp16`, `batch_size`
  feed `FlagReranker(...)`.
* `app/services/vector_db_tidb/embedding_service.py` —
  `additional_params['dimensions']` is also copied into the embedding HTTP
  body (legacy, kept for back-compat); new writers should put it in
  `custom_body` instead.
* `app/services/lightrag/lightrag_config.py` — `embedding_dim` becomes the
  `EMBEDDING_DIM` env var for the LightRAG process.

Renaming this column to `local_params` would be the right move long term,
but is out of scope for the split. **Do not add new "would be sent
upstream" keys to `additional_params`.** Use `custom_body` instead.

## How merging actually happens

There is a single pair of helpers:

```python
from app.services.llm_http import merge_custom_headers, merge_custom_body
```

Both helpers:

* Return a shallow copy of `base` when `custom` is `None` or `{}`.
* Raise `TypeError` if `custom` is provided but not a `dict` — see
  `backend-fastapi/AGENTS.md §4 "No silent fallbacks"`.
* Custom keys **win** over base keys (last-write-wins), which is the
  whole point: this is how a user overrides `Authorization` with their
  own Azure `api-key` scheme on a generic openai-compatible base URL.

Header-specific:

* `Content-Type` is on a tiny protected list and *cannot* be overridden;
  attempts log `WARNING` and the entry is dropped.

Body-specific:

* `merge_custom_body(base, custom, modalities=...)` will log a `WARNING`
  if the user supplied a key obviously from the wrong model family
  (e.g. `temperature` on a `vector_output` model). This is a soft hint
  — the key still passes through, because per-vendor extensions are too
  varied to whitelist.

## How call sites invoke it

### Chat / completion path (most calls)

`app/services/conversation/model_client.py::ModelClient.send_request`
recognises three reserved kwargs:

* `__custom_headers__`
* `__custom_body__`
* `__modalities__`

They are listed in `excluded_keys` so they cannot leak into the OpenAI /
Anthropic payload as sampling parameters. After the standard
provider-aware payload is built, `merge_custom_headers` /
`merge_custom_body` run once and produce the final `headers` / `payload`
passed to `httpx`.

Every business entry that creates a chat call already threads through
`ModelClient` and *should* be passing these kwargs. The current entries
that do so are:

* `summary_service.py` (×2 — replaces the previous
  `**(model_config.additional_params or {})` spread)
* `subagent/executor.py`
* `one_click_generation_service.py`
* `smart_dispatch_service.py`
* `supervisor_rule_checker.py`
* `conversation_service.py` (×2 — internal-role chat, both stream and
  non-stream paths)
* `ModelClient.test_model` / `test_model_stream` — the internal test path
  used by `role_service.test_role` and the SSE test endpoint in
  `api/routes/model_configs.py`. Because both go through these two
  methods, they pick up `custom_headers` / `custom_body` automatically.

The `stream_handler.py` tool-call follow-up call does not need explicit
plumbing: it inherits its kwargs from `api_config` dict the parent passes
in, so as long as the parent passed `__custom_headers__` etc. they ride
through.

### Embedding path

`app/services/vector_db_tidb/embedding_service.py` calls
`requests.post(...)` directly (not through `ModelClient`). Both the
OpenAI-compatible branch (`_generate_embeddings_openai_api`) and the
Ollama branch call the same `merge_custom_headers` / `merge_custom_body`
helpers explicitly, reading from `model_config.custom_headers` and
`model_config.custom_body`. `model_config.additional_params['dimensions']`
is still respected for back-compat as documented above.

### Rerank path

`app/services/knowledge_base/reranker_service.py` does not perform an
outbound HTTP call — it constructs a local `FlagReranker`. It only reads
`additional_params['use_fp16']` / `['batch_size']`. `custom_headers` /
`custom_body` are intentionally not consulted here.

## Frontend

`ModelFormModal.tsx` exposes three controls:

1. **Custom Headers (JSON)** — always visible.
2. **Custom Request Body (JSON)** — always visible; placeholder and
   tooltip switch based on `modalities`:
   * contains `rerank_output` → rerank placeholder
   * contains `vector_output` → embedding placeholder
   * otherwise → chat placeholder
3. **Local Parameters (Advanced)** — collapsed by default; this is where
   `additional_params` lives now.

Save-time validation (`ModelConfigsPage.tsx`):

* Each box is parsed independently.
* Empty / whitespace = `{}`.
* JSON parse error → toast `modelConfig.form.jsonParseError`.
* Parsed value not an object (array, string, number) → toast
  `modelConfig.form.jsonNotObjectError`.

## Migration history

`alembic/versions/20260519_1000_add_custom_headers_body_to_model_configs.py`
adds the two JSON columns with `server_default='{}'`. No data is moved
out of `additional_params`. If you previously stored e.g.
`reasoning_effort` in `additional_params` and relied on
`summary_service` spreading it into the OpenAI request, that path is now
broken on purpose — move the key into `custom_body`.

## Anti-patterns (don't do this)

* ❌ Add a new "would-be-sent-upstream" key to `additional_params`. It is
  for local Python state, period.
* ❌ Manually build `headers = {...}` / `payload = {...}` in a service
  and ship it without going through `merge_custom_headers` /
  `merge_custom_body`. Either route through `ModelClient.send_request`
  or call the helpers explicitly.
* ❌ Wrap a non-dict input to either helper in `try/except` and fall
  back to `{}`. The contract is "fail loud" — see
  `backend-fastapi/AGENTS.md §4`.
* ❌ Add a separate `chat_custom_body` / `embedding_custom_body` column
  set "to be safe". One `ModelConfig` row serves one modality (its
  `modalities` field), so a per-modality split is dead weight.
