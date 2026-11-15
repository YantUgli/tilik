"""Tes T-20: cache hasil L4 LLM (NFR-COST-02). Jam di-inject lewat `create_app(clock=...)`."""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.guards import CACHE_TTL_S, ResultCache, cache_key
from app.llm_schema import LlmTextOutput
from app.main import create_app
from providers import InvalidOutput, ProviderError
from test_caption import POLITIK_CAPTION, TELEGRAM_OCR, FakeProvider, layers, llm_finding, post


class Clock:
    def __init__(self) -> None:
        self.now = 1_800_000_000.0

    def __call__(self) -> float:
        return self.now


def make(provider: FakeProvider | None = None, clock: Clock | None = None):
    provider = provider or FakeProvider({"findings": [llm_finding("coblos nomor urut 9")]})
    app = create_app(Settings(rate_limit="1000/minute"), text_provider=provider, clock=clock or Clock())
    return TestClient(app, raise_server_exceptions=False), provider, app.state.llm_guard


def test_identical_request_calls_provider_once() -> None:
    client, provider, guard = make()
    r1, r2 = post(client, POLITIK_CAPTION, TELEGRAM_OCR), post(client, POLITIK_CAPTION, TELEGRAM_OCR)
    a, b = layers(r1), layers(r2)
    assert len(provider.calls) == 1
    assert [x["findings"] for x in a] == [x["findings"] for x in b]
    assert a[2]["findings"]  # temuan LLM memang ada
    assert (b[2]["status"], b[2]["provider"]) == ("ok", "fireworks")
    assert r1.json()["request_id"] != r2.json()["request_id"]
    assert guard.budget.used == 321 + 45  # hit tidak menghitung token


def test_cache_hit_has_own_latency_and_request_id() -> None:
    client, _, _ = make(FakeProvider({"findings": [llm_finding("coblos nomor urut 9")]}, delay=0.05))
    first = layers(post(client, POLITIK_CAPTION))[2]
    second = layers(post(client, POLITIK_CAPTION))[2]
    assert first["latency_ms"] >= 50
    assert second["latency_ms"] < first["latency_ms"]


def test_whitespace_normalized_caption_hits() -> None:
    client, provider, _ = make()
    layers(post(client, POLITIK_CAPTION))
    layers(post(client, "  " + POLITIK_CAPTION.replace(" ", "   ") + "\n"))
    assert len(provider.calls) == 1


def test_different_caption_misses() -> None:
    client, provider, _ = make()
    layers(post(client, POLITIK_CAPTION))
    layers(post(client, POLITIK_CAPTION + " Ayo!"))
    layers(post(client, POLITIK_CAPTION, "teks lain"))
    assert len(provider.calls) == 3


@pytest.mark.parametrize("exc", [InvalidOutput(http_status=200), ProviderError(http_status=503)])
def test_error_and_unavailable_not_cached(exc: Exception) -> None:
    provider = FakeProvider(exc=exc)
    client, _, guard = make(provider)
    for _ in range(2):
        assert layers(post(client, POLITIK_CAPTION))[2]["status"] in ("error", "unavailable")
    assert len(provider.calls) == 2
    assert len(guard.cache) == 0


def test_ttl_expiry_misses() -> None:
    clock = Clock()
    client, provider, _ = make(clock=clock)
    layers(post(client, POLITIK_CAPTION))
    clock.now += CACHE_TTL_S - 1
    layers(post(client, POLITIK_CAPTION))
    assert len(provider.calls) == 1
    clock.now += 2
    layers(post(client, POLITIK_CAPTION))
    assert len(provider.calls) == 2


def test_rules_recomputed_on_hit() -> None:
    client, _, _ = make()
    first = layers(post(client, POLITIK_CAPTION))
    second = layers(post(client, POLITIK_CAPTION, TELEGRAM_OCR))  # OCR beda → miss, bukan uji ini
    third = layers(post(client, POLITIK_CAPTION))  # hit
    assert third[0] == first[0] and third[1]["findings"] == first[1]["findings"]
    assert second[0]["findings"] and not first[0]["findings"]


def test_log_has_cache_flag_but_no_caption(caplog: pytest.LogCaptureFixture) -> None:
    client, _, _ = make()
    with caplog.at_level(logging.DEBUG):
        layers(post(client, POLITIK_CAPTION, TELEGRAM_OCR))
        layers(post(client, POLITIK_CAPTION, TELEGRAM_OCR))
    text = caplog.text
    assert "cache=miss" in text and "cache=hit" in text
    for secret in ("coblos", "nomor urut", "TELEGRAM", "ST/12/2026", cache_key("fireworks:-", POLITIK_CAPTION, TELEGRAM_OCR)):
        assert secret not in text


def test_lru_evicts_oldest() -> None:
    cache = ResultCache(max_entries=2, clock=lambda: 0.0)
    out = LlmTextOutput.model_validate({"findings": []})
    cache.put("a", "fireworks", out)
    cache.put("b", "fireworks", out)
    assert cache.get("a") is not None  # a jadi terbaru
    cache.put("c", "fireworks", out)
    assert cache.get("b") is None and cache.get("a") is not None and cache.get("c") is not None


def test_cache_key_depends_on_model() -> None:
    assert cache_key("fireworks:m1", "x", None) != cache_key("fireworks:m2", "x", None)
    assert cache_key("m", "a", "b") != cache_key("m", "a\x00b", "")
