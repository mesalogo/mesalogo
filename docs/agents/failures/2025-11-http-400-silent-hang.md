# [2025-11] Error 400 后前端卡死,无法中止

> 来源:`TODO.md` > `## BUG` > "Error processing response: Request failed with status code 400,报错后没有直接返回报错,而且无法中止"
> 状态:🔴 Open

## 发生了什么

LLM 请求返回 HTTP 400(例:上下文超长 / API key 错 / payload 非法)。
预期:前端立即显示错误、允许用户重试或关闭。
实际:后端 log 有异常,前端 spinner 永久转,"停止"按钮也不生效(见姊妹篇 `2025-11-autonomous-task-no-stop.md`)。

## 根因(疑似)

经典 SSE 异常处理漏洞。代码形状类似:

```python
# ❌ 错误范式
async def stream():
    async for chunk in agent.run():   # ← 这里 raise HTTPException
        yield sse("message", chunk)
    yield sse("done", {})   # ← 被 raise 跳过,前端收不到 done
```

FastAPI 在 SSE 中途 raise 之后,连接被粗暴关闭,前端的 `EventSource` 收不到任何"此流已结束"信号,所以:
- spinner 一直转(因为"流还可能再来数据")
- 停止按钮发出的 DELETE 请求,后端已把 task 标 finished,返回 404,前端再次 stuck

## 为什么 Agent / 我们没早发现

- [x] `backend-fastapi/AGENTS.md` 在起草时已加入"SSE 必须 emit done"规则(第 3.2 节),但编写本 bug 时该文件还不存在
- [x] 没有"故意触发 400 然后看前端"的冒烟测试
- [x] LLM SDK 的错误没有被归一化:有的抛 `httpx.HTTPStatusError`,有的抛自定义异常,handler 遗漏了分支

## 怎么改掉(推荐范式)

```python
async def stream():
    try:
        async for chunk in agent.run():
            yield sse("message", chunk)
    except httpx.HTTPStatusError as e:
        yield sse("error", {
            "code": e.response.status_code,
            "message": str(e),
            "agent_hint": "LLM 服务返回 HTTP 错误,可能是 key / quota / context 过长",
        })
    except Exception as e:
        logger.exception("agent stream failed")
        yield sse("error", {"message": str(e)})
    finally:
        yield sse("done", {})   # ← 无论如何都发
```

前端 `EventSource.onmessage` 收到 `type === 'error'` 也视为流结束,展示错误并释放 spinner。

## 怎么防止再犯

- [ ] 给 `SSEResponse` 做一个统一 wrapper,自动 try/except/finally
- [ ] `docs/agents/sse-streaming.md` 明确写出模板
- [ ] 加一个冒烟测试:mock LLM 抛 HTTP 400,断言前端收到 `error` + `done` 两个事件
- [ ] AGENTS.md 根文件第 5 节已提到这一点,保留

## 延伸阅读

- FastAPI StreamingResponse 文档的"client disconnection"一节
- 姊妹 bug:`2025-11-autonomous-task-no-stop.md`
