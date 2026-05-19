"""Unit tests for async embedding HTTP generation."""

from __future__ import annotations

import inspect
from types import SimpleNamespace

import httpx
import pytest

from app.services.embedding import EmbeddingService

REAL_ASYNC_CLIENT = httpx.AsyncClient


def _model(**overrides):
    base = {
        "name": "Embeddings",
        "model_id": "text-embedding-3-small",
        "provider": "openai",
        "base_url": "https://example.test/v1",
        "api_key": "secret",
        "request_timeout": 12,
        "additional_params": {},
        "custom_headers": {},
        "custom_body": {},
        "modalities": ["vector_output"],
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_embedding_generation_api_is_async():
    assert inspect.iscoroutinefunction(EmbeddingService.generate_embeddings)
    assert inspect.iscoroutinefunction(EmbeddingService.generate_single_embedding)
    assert inspect.iscoroutinefunction(EmbeddingService.batch_generate_embeddings)


@pytest.mark.anyio
async def test_openai_embedding_uses_httpx_async_client(monkeypatch):
    captured = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["json"] = request.read().decode()
        return httpx.Response(
            200,
            json={"data": [{"embedding": [0.1, 0.2, 0.3]}]},
        )

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handler)),
    )

    service = EmbeddingService()
    success, embeddings, meta = await service.generate_embeddings(
        ["hello"],
        _model(
            additional_params={"dimensions": 3},
            custom_headers={"X-Provider": "test"},
            custom_body={"encoding_format": "float"},
        ),
    )

    assert success is True
    assert embeddings == [[0.1, 0.2, 0.3]]
    assert meta["vector_dimension"] == 3
    assert captured["url"] == "https://example.test/v1/embeddings"
    assert "x-provider" in captured["headers"]
    assert '"dimensions":3' in captured["json"].replace(" ", "")
    assert '"encoding_format":"float"' in captured["json"].replace(" ", "")


@pytest.mark.anyio
async def test_ollama_embedding_parses_async_response(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "http://ollama.test/api/embed"
        return httpx.Response(200, json={"embeddings": [[0.4, 0.5]]})

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handler)),
    )

    service = EmbeddingService()
    success, embedding, meta = await service.generate_single_embedding(
        "hello",
        _model(
            provider="ollama",
            base_url="http://ollama.test/v1",
            model_id="nomic-embed-text",
        ),
    )

    assert success is True
    assert embedding == [0.4, 0.5]
    assert meta["vector_dimension"] == 2
