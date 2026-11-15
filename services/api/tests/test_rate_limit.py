"""Tes T-20: rate limit per IP (NFR-SEC-06) dan kunci IP di belakang proxy.

State limiter in-memory per `create_app`, jadi tiap tes mulai dari kuota penuh.
Semua IP dari blok dokumentasi (RFC 5737).
"""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from app.config import DEFAULT_RATE_LIMIT, Settings, parse_rate_limit
from app.main import RATE_LIMITED_MESSAGE, create_app
from contract_validation import errors

BODY = {"caption": "tes", "ocr_text": None, "lang": "id"}


def make_client(rate_limit: str = DEFAULT_RATE_LIMIT) -> TestClient:
    return TestClient(create_app(Settings(rate_limit=rate_limit)), raise_server_exceptions=False)


def post(client: TestClient, xff: str | None = None, path: str = "/analyze/caption"):
    headers = {"X-Forwarded-For": xff} if xff is not None else {}
    if path == "/analyze/visual":
        return client.post(path, headers=headers, files={"image": ("a.jpg", b"\xff\xd8\xff", "image/jpeg")})
    return client.post(path, json=BODY, headers=headers)


@pytest.mark.parametrize("path", ["/analyze/caption", "/analyze/visual"])
def test_eleventh_request_in_a_minute_is_429_contract(path: str) -> None:
    client = make_client()
    codes = [post(client, path=path).status_code for _ in range(10)]
    assert codes == [200] * 10

    res = post(client, path=path)
    assert res.status_code == 429
    body = res.json()
    assert errors("error", body) == []
    assert body == {"error": {"code": "RATE_LIMITED", "message": RATE_LIMITED_MESSAGE}}
    assert int(res.headers["Retry-After"]) >= 1
    assert res.headers.get("X-Request-ID")


def test_health_never_limited() -> None:
    client = make_client("2/minute")
    assert all(client.get("/health").status_code == 200 for _ in range(30))
    # /health juga tidak menghabiskan kuota /analyze/*
    assert [post(client).status_code for _ in range(3)] == [200, 200, 429]


def test_endpoints_have_separate_quotas() -> None:
    client = make_client("2/minute")
    assert [post(client).status_code for _ in range(3)] == [200, 200, 429]
    assert post(client, path="/analyze/visual").status_code == 200


def test_rightmost_forwarded_for_separates_quota() -> None:
    client = make_client("2/minute")
    a, b = "203.0.113.1", "203.0.113.2"
    assert [post(client, a).status_code for _ in range(3)] == [200, 200, 429]
    assert [post(client, b).status_code for _ in range(2)] == [200, 200]
    # Proxy menambahkan IP klien di kanan: rantai berbeda di kanan → kuota berbeda.
    assert post(client, f"{a}, 198.51.100.7").status_code == 200


def test_spoofed_left_entries_do_not_change_key() -> None:
    client = make_client("2/minute")
    real = "203.0.113.9"
    codes = [post(client, f"10.0.0.{i}, 192.0.2.{i}, {real}").status_code for i in range(3)]
    assert codes == [200, 200, 429]
    assert post(client, real).status_code == 429


def test_no_forwarded_for_uses_connection_ip() -> None:
    client = make_client("1/minute")
    assert [post(client).status_code for _ in range(2)] == [200, 429]
    assert post(client, "203.0.113.50").status_code == 200


def test_day_limit_applies() -> None:
    client = make_client("100/minute;3/day")
    assert [post(client).status_code for _ in range(4)] == [200, 200, 200, 429]


def test_ip_never_logged(caplog: pytest.LogCaptureFixture) -> None:
    client = make_client("1/minute")
    ip = "203.0.113.77"
    with caplog.at_level(logging.DEBUG):
        post(client, ip)
        assert post(client, ip).status_code == 429
    assert ip not in caplog.text
    assert "status=429" in caplog.text


@pytest.mark.parametrize("raw,expected", [(None, DEFAULT_RATE_LIMIT), ("", DEFAULT_RATE_LIMIT),
                                          ("20/minute;300/day", "20/minute;300/day")])
def test_rate_limit_parsing(raw, expected) -> None:
    assert parse_rate_limit(raw) == expected


@pytest.mark.parametrize("raw", ["banyak", "10 per kadang", "/minute"])
def test_invalid_rate_limit_fails_start(raw: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RATE_LIMIT", raw)
    with pytest.raises(ValueError, match="RATE_LIMIT"):
        Settings.from_env()
