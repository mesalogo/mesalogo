"""
Mock LLM — 测试用的"假大模型"。

契约见 tests/AGENTS.md §5。

设计原则:
- 通过依赖注入用,不要去 patch OpenAI SDK 内部。
- 行为可预设(reply_with) + 调用历史可断言(calls)。
- async 接口,跟生产代码一致。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class _Call:
    messages: list[dict[str, Any]]
    kwargs: dict[str, Any] = field(default_factory=dict)


class MockLLM:
    """
    用法:
        async def test_x(mock_llm, agent):
            mock_llm.reply_with("hello!")
            out = await agent.run("hi")
            assert out == "hello!"
            assert mock_llm.calls[-1].messages[-1]["content"] == "hi"

    支持的接口:
        - chat(messages, **kwargs) -> str
        - stream(messages, **kwargs) -> async iterator of str
    """

    def __init__(self) -> None:
        self.responses: list[str] = []
        self.calls: list[_Call] = []
        self.default_response: str = "<MOCK_LLM_EMPTY>"

    # ─── 设置 ───

    def reply_with(self, text: str) -> "MockLLM":
        self.responses.append(text)
        return self

    def reply_with_many(self, texts: list[str]) -> "MockLLM":
        self.responses.extend(texts)
        return self

    def set_default(self, text: str) -> "MockLLM":
        self.default_response = text
        return self

    # ─── 调用 ───

    async def chat(self, messages: list[dict[str, Any]], **kwargs: Any) -> str:
        self.calls.append(_Call(messages=list(messages), kwargs=dict(kwargs)))
        if self.responses:
            return self.responses.pop(0)
        return self.default_response

    async def stream(self, messages: list[dict[str, Any]], **kwargs: Any):
        full = await self.chat(messages, **kwargs)
        for ch in full:
            yield ch

    # ─── 断言辅助 ───

    @property
    def call_count(self) -> int:
        return len(self.calls)

    def last_user_message(self) -> str | None:
        if not self.calls:
            return None
        for m in reversed(self.calls[-1].messages):
            if m.get("role") == "user":
                return m.get("content")
        return None

    def reset(self) -> None:
        self.responses.clear()
        self.calls.clear()
