"""Tes T-08: stub FastAPI valid kontrak, CORS ketat, dan log tanpa isi request."""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, parse_allowed_origins
from app.main import create_app
from contract_validation import EXAMPLES, errors, load_json

ALLOWED = "https://tilik-contoh.vercel.app"
EVIL = "https://contoh-jahat.test"

SAMPLE_CAPTION = {
    "caption": "Uji koneksi TILIK: selamat pagi dari Yonif 999/Contoh.",
    "ocr_text": None,
    "lang": "id",
}


@pytest.fixture
def client() -> TestClient:
    app = create_app(Settings(allowed_origins=[ALLOWED, "http://localhost:3000"]))
    return TestClient(app, raise_server_exceptions=False)


# --- Kontrak respons ---------------------------------------------------------


def test_health_contract(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert errors("health", res.json()) == []


def test_visual_stub_contract(client: TestClient) -> None:
    res = client.post(
        "/analyze/visual", files={"image": ("x.png", b"\x89PNG\r\n\x1a\n", "image/png")}
    )
    assert res.status_code == 200
    body = res.json()
    assert errors("visual-response", body) == []
    assert body["layers"][0]["status"] == "skipped"
    assert body["has_text_document"] is None


def test_request_id_matches_header(client: TestClient) -> None:
    res = client.post("/analyze/caption", json=SAMPLE_CAPTION)
    assert res.headers["x-request-id"] == res.json()["request_id"]
    other = client.post("/analyze/caption", json=SAMPLE_CAPTION)
    assert other.json()["request_id"] != res.json()["request_id"]


# --- Validasi request: contoh kontrak caption-request ------------------------


@pytest.mark.parametrize(
    "example",
    sorted(EXAMPLES.glob("caption-request.valid*.json")),
    ids=lambda p: p.name,
)
def test_caption_request_valid_examples_accepted(client: TestClient, example) -> None:
    res = client.post("/analyze/caption", json=load_json(example))
    assert res.status_code == 200, res.text
    assert errors("caption-response", res.json()) == []


@pytest.mark.parametrize(
    "example",
    sorted(EXAMPLES.glob("caption-request.invalid*.json")),
    ids=lambda p: p.name,
)
def test_caption_request_invalid_examples_rejected(client: TestClient, example) -> None:
    res = client.post("/analyze/caption", json=load_json(example))
    assert res.status_code == 400
    assert errors("error", res.json()) == []
    assert res.json()["error"]["code"] == "INVALID_INPUT"


def test_caption_too_long_is_400_without_echo(client: TestClient) -> None:
    marker = "PENANDA-PANJANG-7f3a"
    caption = (marker + " ") * 200  # > 2.200 karakter
    res = client.post("/analyze/caption", json={**SAMPLE_CAPTION, "caption": caption})
    assert res.status_code == 400
    assert errors("error", res.json()) == []
    assert marker not in res.text


def test_ocr_text_over_limit_is_not_rejected(client: TestClient) -> None:
    """ocr_text > 8.000 karakter dipotong di T-18, bukan ditolak (SPEC §5.1)."""
    res = client.post("/analyze/caption", json={**SAMPLE_CAPTION, "ocr_text": "a" * 9000})
    assert res.status_code == 200


def test_malformed_json_is_400(client: TestClient) -> None:
    res = client.post(
        "/analyze/caption", content=b"{bukan json", headers={"content-type": "application/json"}
    )
    assert res.status_code == 400
    assert errors("error", res.json()) == []


# --- CORS ------------------------------------------------------------------


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    simple = client.get("/health", headers={"Origin": EVIL})
    assert "access-control-allow-origin" not in simple.headers

    preflight = client.options(
        "/analyze/caption",
        headers={
            "Origin": EVIL,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert "access-control-allow-origin" not in preflight.headers


def test_cors_allows_configured_origin(client: TestClient) -> None:
    preflight = client.options(
        "/analyze/caption",
        headers={
            "Origin": ALLOWED,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == ALLOWED
    methods = {m.strip() for m in preflight.headers["access-control-allow-methods"].split(",")}
    assert methods <= {"GET", "POST", "OPTIONS"}
    assert "DELETE" not in methods


def test_cors_disallows_other_methods(client: TestClient) -> None:
    preflight = client.options(
        "/analyze/caption",
        headers={"Origin": ALLOWED, "Access-Control-Request-Method": "DELETE"},
    )
    assert preflight.status_code == 400


def test_allowed_origins_parsing() -> None:
    assert parse_allowed_origins(" https://a.test/ , http://localhost:3000,,") == [
        "https://a.test",
        "http://localhost:3000",
    ]
    assert parse_allowed_origins(None) == []
    assert parse_allowed_origins("") == []


@pytest.mark.parametrize("raw", ["*", "https://a.test,*", "https://*.vercel.app"])
def test_wildcard_origin_rejected(raw: str) -> None:
    with pytest.raises(ValueError):
        parse_allowed_origins(raw)


# --- Logging (NFR-PRIV-01) ---------------------------------------------------


def test_logs_have_no_body(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    caption_marker = "RAHASIA-CAPTION-9c1e2b"
    ocr_marker = "RAHASIA-OCR-41d7aa"
    caplog.set_level(logging.DEBUG)

    ok = client.post(
        "/analyze/caption",
        json={"caption": caption_marker, "ocr_text": ocr_marker, "lang": "id"},
    )
    bad = client.post(
        "/analyze/caption",
        json={"caption": caption_marker * 200, "ocr_text": ocr_marker, "lang": "id"},
    )
    assert ok.status_code == 200 and bad.status_code == 400

    assert caption_marker not in caplog.text
    assert ocr_marker not in caplog.text
    # Baris akses tetap ada dan hanya berisi metadata.
    access = [r.getMessage() for r in caplog.records if r.name == "tilik.access"]
    assert len(access) == 2
    assert f"request_id={ok.json()['request_id']}" in access[0]
    assert "path=/analyze/caption" in access[0] and "status=200" in access[0]
    assert "status=400" in access[1]
    assert all("latency_ms=" in line for line in access)


def test_uvicorn_access_log_disabled() -> None:
    """`fastapi run` (FastAPI Cloud) menyalakan access log uvicorn: IP klien + query string."""
    access = logging.getLogger("uvicorn.access")
    access.disabled = False
    create_app(Settings())
    assert access.disabled is True


def test_fastapi_cloud_entrypoint() -> None:
    import tomllib
    from pathlib import Path

    pyproject = tomllib.loads((Path(__file__).parents[1] / "pyproject.toml").read_text())
    assert pyproject["tool"]["fastapi"]["entrypoint"] == "app.main:app"


def test_unhandled_error_is_500_contract_and_not_logged(caplog: pytest.LogCaptureFixture) -> None:
    secret = "RAHASIA-EXCEPTION-55aa01"
    app = create_app(Settings(allowed_origins=[ALLOWED]))

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError(secret)

    caplog.set_level(logging.DEBUG)
    res = TestClient(app, raise_server_exceptions=False).get("/boom", headers={"Origin": ALLOWED})
    assert res.status_code == 500
    assert errors("error", res.json()) == []
    assert res.json()["error"]["code"] == "INTERNAL"
    assert secret not in res.text
    assert secret not in caplog.text
    assert res.headers.get("access-control-allow-origin") == ALLOWED
