"""Tes T-20: batas token harian (NFR-COST-01, deviasi: token, bukan USD).

Jam di-inject lewat `create_app(clock=...)`. Semua nama fiktif (NFR-COMP-02/03).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.config import DEFAULT_DAILY_TOKEN_BUDGET, Settings, parse_daily_token_budget
from app.guards import DailyTokenBudget, wib_day
from app.main import create_app
from app.routes.caption import NOTE_BUDGET
from providers import InvalidOutput, Usage
from test_caption import POLITIK_CAPTION, TELEGRAM_OCR, FakeProvider, layers, llm_finding, post

PER_CALL = 321 + 45  # usage FakeProvider


class Clock:
    def __init__(self, iso_utc: str) -> None:
        self.now = datetime.fromisoformat(iso_utc).replace(tzinfo=UTC).timestamp()

    def __call__(self) -> float:
        return self.now


def make(budget: int, clock: Clock | None = None, provider: FakeProvider | None = None):
    provider = provider or FakeProvider({"findings": [llm_finding("coblos nomor urut 9")]})
    app = create_app(Settings(daily_token_budget=budget, rate_limit="1000/minute"),
                     text_provider=provider, clock=clock or Clock("2026-11-15T03:00:00"))
    return TestClient(app, raise_server_exceptions=False), provider, app.state.llm_guard


def test_usage_increments_counter() -> None:
    client, _, guard = make(10_000)
    assert guard.budget.used == 0
    layers(post(client, POLITIK_CAPTION, "satu"))
    assert guard.budget.used == PER_CALL
    layers(post(client, POLITIK_CAPTION, "dua"))
    assert guard.budget.used == 2 * PER_CALL


def test_failed_call_usage_still_counted() -> None:
    provider = FakeProvider(exc=InvalidOutput(http_status=200, usage=Usage(tokens_in=500, tokens_out=100)))
    client, _, guard = make(10_000, provider=provider)
    _, _, llm = layers(post(client, POLITIK_CAPTION))
    assert llm["status"] == "error"
    assert guard.budget.used == 600


def test_over_budget_skips_llm_but_rules_run(caplog: pytest.LogCaptureFixture) -> None:
    client, provider, guard = make(PER_CALL)  # habis setelah satu panggilan
    layers(post(client, POLITIK_CAPTION, "pertama"))
    assert len(provider.calls) == 1

    with caplog.at_level(logging.INFO, logger="tilik.llm"):
        l3, l4_rule, llm = layers(post(client, POLITIK_CAPTION, TELEGRAM_OCR))
    assert len(provider.calls) == 1  # provider tidak dipanggil
    assert (llm["status"], llm["provider"], llm["findings"]) == ("unavailable", None, [])
    assert llm["note"] == NOTE_BUDGET
    assert (l3["status"], l4_rule["status"]) == ("ok", "ok")
    assert {f["category"] for f in l3["findings"]} >= {"surat_telegram"}
    assert [f["rule_ref"] for f in l4_rule["findings"]] == ["R-L4-004"]
    assert "budget=skipped" in caplog.text
    assert guard.budget.used == PER_CALL


def test_budget_resets_at_wib_midnight() -> None:
    clock = Clock("2026-11-15T16:59:00")  # 23.59 WIB
    client, provider, guard = make(PER_CALL, clock=clock)
    layers(post(client, POLITIK_CAPTION, "a"))
    _, _, llm = layers(post(client, POLITIK_CAPTION, "b"))
    assert llm["status"] == "unavailable"

    clock.now += 120  # 00.01 WIB hari berikutnya (masih 15 Nov UTC)
    _, _, llm = layers(post(client, POLITIK_CAPTION, "c"))
    assert (llm["status"], llm["provider"]) == ("ok", "fireworks")
    assert len(provider.calls) == 2
    assert guard.budget.used == PER_CALL


def test_wib_day_boundary() -> None:
    at = lambda iso: datetime.fromisoformat(iso).replace(tzinfo=UTC).timestamp()  # noqa: E731
    assert wib_day(at("2026-11-15T16:59:59")) == "2026-11-15"
    assert wib_day(at("2026-11-15T17:00:00")) == "2026-11-16"


def test_budget_counter_unit() -> None:
    now = [0.0]
    budget = DailyTokenBudget(100, clock=lambda: now[0])
    budget.add(60, None)
    assert not budget.exhausted()
    budget.add(30, 10)
    assert budget.exhausted() and budget.used == 100
    now[0] += 24 * 3600
    assert budget.used == 0 and not budget.exhausted()


def test_parse_daily_token_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    assert parse_daily_token_budget(None) == DEFAULT_DAILY_TOKEN_BUDGET == 2_000_000
    assert parse_daily_token_budget(" 500 ") == 500
    for raw in ("0", "-1", "dua juta", "1.5"):
        monkeypatch.setenv("DAILY_TOKEN_BUDGET", raw)
        with pytest.raises(ValueError, match="DAILY_TOKEN_BUDGET"):
            Settings.from_env()
