# FAQ

## Model Related

### [Guide] 在sglang中启用Qwen3的工具调用
```
python3 -m sglang.launch_server --model-path Qwen/Qwen3-4B --tool-call-parser qwen25 --host 0.0.0.0 --port 30000 --reasoning-parser qwen3
```

### [Issue] Ollama qwen3 带 tool call 时无法流式输出

已知问题，可以把角色的工具能力（tool_use、function_call）去掉。否则就会变成阻塞式输出。