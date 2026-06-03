"""Unit tests for Responses-API tool-definition conversion.

ToolFormatConverter.to_provider_tools(tools, 'openai-responses') must flatten
the Chat-Completions {"type":"function","function":{...}} shape into the
Responses shape {"type":"function","name",...} while leaving the
openai / anthropic targets untouched.
"""

from __future__ import annotations

from app.services.conversation.tool_format_converter import ToolFormatConverter


_CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]


def test_responses_tools_flatten_function_to_top_level():
    out = ToolFormatConverter.to_provider_tools(_CHAT_TOOLS, "openai-responses")
    assert out == [
        {
            "type": "function",
            "name": "get_weather",
            "description": "Get weather",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        }
    ]
    assert "function" not in out[0]


def test_responses_tools_skip_non_function_entries():
    tools = [{"type": "web_search"}] + _CHAT_TOOLS
    out = ToolFormatConverter.to_provider_tools(tools, "openai-responses")
    assert len(out) == 1
    assert out[0]["name"] == "get_weather"


def test_openai_compatible_target_is_passthrough():
    out = ToolFormatConverter.to_provider_tools(_CHAT_TOOLS, "openai")
    assert out == _CHAT_TOOLS


def test_anthropic_target_uses_input_schema():
    out = ToolFormatConverter.to_provider_tools(_CHAT_TOOLS, "anthropic")
    assert out[0]["name"] == "get_weather"
    assert "input_schema" in out[0]
    assert "parameters" not in out[0]
