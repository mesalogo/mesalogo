# Streamed tool identity was overwritten by null deltas

## Incident

An OpenAI-compatible gateway streamed a tool call in multiple chunks. The first
chunk contained the exact `id` and `function.name`; later argument chunks sent
those same fields as `null`.

The stream accumulator replaced the valid identity with the later null values.
An older fallback hid this parser bug by guessing a tool name from argument
keys, sometimes choosing the wrong operation. Once guessing was correctly
removed, every affected call looked nameless, no `ToolCallAction` reached the
frontend, and protocol-error retries repeated.

## Root cause

The accumulator updated `id`, `type`, and `function.name` whenever a key was
present, even when its value was null. In a streamed protocol, omitted or null
continuation fields mean “no update”; they must not erase state collected from
an earlier chunk.

## Prevention

- Preserve the last non-empty tool `id`, `type`, and `function.name` while
  accumulating stream deltas.
- Never infer a missing tool name from arguments.
- Never execute a genuinely nameless tool call; return the exact protocol error
  to the model through the follow-up context so it can self-correct.
- Regression tests must reproduce the real first-chunk/continuation-chunk
  sequence and assert that the frontend `ToolCallAction` is emitted.
