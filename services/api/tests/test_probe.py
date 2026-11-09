"""Tes skrip probe provider (T-07).

Semua tes memakai mode --dry-run (transport httpx di-mock); tidak ada panggilan jaringan.
Cakupan setelah T-21 dipotong (9 Nov): hanya teks. P2 (visual) tidak ada, P3 hanya
untuk `llm-text-output`, P5 hanya endpoint teks.
"""

from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
from pathlib import Path

import httpx
import pytest

from scripts.probe.config import PROVIDERS, ConfigError, load_config
from scripts.probe.errors import (
    InvalidOutput,
    ProviderError,
    ProviderTimeout,
    RateLimited,
    classify_error,
)
from scripts.probe.mock import make_mock_transport
from scripts.probe.prompt import (
    SAMPLE_CAPTION,
    SAMPLE_OCR,
    build_messages,
    response_format_for,
)
from scripts.probe.runner import run_probe

API_ROOT = Path(__file__).resolve().parents[1]
PROBE_DIR = API_ROOT / "scripts" / "probe"

KEY_ENVS = ("FIREWORKS_EVAL_API_KEY", "GROQ_EVAL_API_KEY")
MODEL_ENVS = ("FIREWORKS_TEXT_MODEL", "GROQ_TEXT_MODEL")
FAKE_KEY = "FAKEKEY-1234567890abcdef"


def _clean_env(**extra: str) -> dict[str, str]:
    """Env subprocess tanpa key/model apa pun dari shell pemanggil, plus `extra`."""
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("FIREWORKS_", "GROQ_"))}
    env.update(extra)
    return env


def _run_cli(args: list[str], env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "scripts.probe", *args],
        cwd=API_ROOT, env=env, capture_output=True, text=True, timeout=120,
    )


# ---------------------------------------------------------------------------
# Kriteria terima
# ---------------------------------------------------------------------------
def test_dry_run_produces_report(tmp_path: Path) -> None:
    out = tmp_path / "probe-report.json"
    proc = _run_cli(["--dry-run", "--out", str(out)], _clean_env())
    assert proc.returncode == 0, proc.stderr
    report = json.loads(out.read_text(encoding="utf-8"))

    for key in ("P1", "P3", "P4", "P5"):
        assert key in report, f"kunci {key} hilang"
    assert "P2" not in report  # visual dibuang (T-21 dipotong)
    assert report["meta"]["dry_run"] is True

    for prov in ("fireworks", "groq"):
        p1 = report["P1"][prov]
        assert p1["n"] == 5
        assert len(p1["calls"]) == 5
        for field in ("prompt_tokens_median", "completion_tokens_median",
                      "latency_p50_s", "latency_max_s"):
            assert isinstance(p1[field], (int, float)), field

        p3 = report["P3"][prov]
        assert p3["n"] == 10
        assert p3["schema"] == "llm-text-output.schema.json"
        assert p3["json_mode"] in ("json_schema", "json_schema_strict", "json_object")
        assert 0 <= p3["valid_direct_pct"] <= p3["valid_after_retry_pct"] <= 100
        # mock sengaja mengirim satu output tak valid yang lolos setelah retry
        assert p3["valid_direct_pct"] < p3["valid_after_retry_pct"] == 100

        p5 = report["P5"][prov]
        assert p5["wrong_key"]["status"] == 401
        assert p5["wrong_key"]["error_class"] == "ProviderError"
        assert p5["wrong_model"]["status"] == 404
        assert p5["wrong_model"]["error_class"] == "ProviderError"
        assert p5["timeout"]["error_class"] == "ProviderTimeout"

    # P4 hanya Groq; Fireworks tidak di-burst (billing prabayar)
    assert set(report["P4"]) == {"groq"}
    p4 = report["P4"]["groq"]
    assert p4["n_sent"] == 35
    assert p4["first_429_at"] == 31
    assert p4["first_429"]["error_class"] == "RateLimited"
    assert "retry-after" in p4["first_429"]["headers"]
    assert any(h.startswith("x-ratelimit-") for h in p4["first_429"]["headers"])

    # ringkasan markdown untuk ditempel ke docs/quota.md ikut ditulis
    summary = out.with_suffix(".md")
    assert summary.exists()
    assert "DRY-RUN" in summary.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    ("status", "body", "kwargs", "expected"),
    [
        (429, '{"error": {"message": "Rate limit reached", "type": "requests"}}', {}, RateLimited),
        (429, "", {}, RateLimited),
        (401, '{"error": {"message": "Invalid API Key"}}', {}, ProviderError),
        (403, '{"error": {"message": "forbidden"}}', {}, ProviderError),
        (404, '{"error": {"message": "model not found"}}', {}, ProviderError),
        (400, '{"error": {"code": "json_validate_failed"}}', {}, ProviderError),
        (500, '{"error": {"message": "internal"}}', {}, ProviderError),
        (502, "<html><body>502 Bad Gateway</body></html>", {}, ProviderError),
        (503, "", {}, ProviderError),
        (504, "upstream timeout", {}, ProviderError),
        (None, None, {"timed_out": True}, ProviderTimeout),
        (200, "<html>maintenance</html>", {}, ProviderError),  # 2xx tapi body bukan JSON
        (200, '{"no_choices": true}', {}, ProviderError),
    ],
)
def test_error_mapping(status, body, kwargs, expected) -> None:
    err = classify_error(status, body, **kwargs)
    assert type(err) is expected
    assert isinstance(err, ProviderError)
    assert not isinstance(err, InvalidOutput)


def test_error_mapping_success_is_none() -> None:
    body = json.dumps({"choices": [{"message": {"content": "{}"}}]})
    assert classify_error(200, body) is None


def test_error_mapping_never_invalid_output() -> None:
    """Kegagalan skema output model bukan urusan classify_error (diukur di P3)."""
    bodies = [None, "", "x", "{}", "[]", '{"choices": []}', '{"findings": "bukan list"}',
              '{"error": {"code": "json_validate_failed"}}']
    for status in [None, 200, 201, 204, 400, 401, 402, 403, 404, 408, 413, 422,
                   429, 498, 500, 502, 503, 504, 520]:
        for body in bodies:
            for timed_out in (False, True):
                err = classify_error(status, body, timed_out=timed_out)
                assert not isinstance(err, InvalidOutput), (status, body, timed_out)


def test_no_key_in_report(tmp_path: Path) -> None:
    out = tmp_path / "probe-report.json"
    env = _clean_env(**{k: FAKE_KEY for k in KEY_ENVS})
    proc = _run_cli(["--dry-run", "--out", str(out), "-v"], env)
    assert proc.returncode == 0, proc.stderr

    texts = {
        "report": out.read_text(encoding="utf-8"),
        "summary": out.with_suffix(".md").read_text(encoding="utf-8"),
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }
    assert proc.stderr.strip(), "log progres seharusnya ada di stderr"
    for name, text in texts.items():
        assert FAKE_KEY not in text, f"key bocor ke {name}"
        assert FAKE_KEY[-8:] not in text, f"potongan key bocor ke {name}"
    # dry-run memakai key dari env bila ada (jadi tes di atas bermakna)
    assert json.loads(texts["report"])["meta"]["keys_from_env"] == {
        "fireworks": True, "groq": True}


def test_only_chat_completions_endpoint() -> None:
    """NFR-PRIV-03: hanya chat completions; Response API tidak pernah dipanggil."""
    for spec in PROVIDERS.values():
        assert spec.chat_url.endswith("/v1/chat/completions")
        assert "responses" not in spec.chat_url

    seen: list[httpx.URL] = []

    def factory(provider: str, key: str) -> httpx.BaseTransport:
        inner = make_mock_transport(provider, key)

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request.url)
            return inner.handle_request(request)

        return httpx.MockTransport(handler)

    cfg = load_config({}, providers=["fireworks", "groq"], dry_run=True)
    run_probe(cfg, tests=["P1", "P3", "P4", "P5"], transport_factory=factory)

    assert seen, "tidak ada request tercatat"
    for url in seen:
        assert url.path.endswith("/v1/chat/completions"), url
        assert "responses" not in str(url)
    assert {u.host for u in seen} == {"api.fireworks.ai", "api.groq.com"}


# ---------------------------------------------------------------------------
# Tambahan: konfigurasi, prompt, isolasi
# ---------------------------------------------------------------------------
def test_missing_env_exits_clearly(tmp_path: Path) -> None:
    proc = _run_cli(["--out", str(tmp_path / "r.json")], _clean_env())
    assert proc.returncode == 2
    for name in (*KEY_ENVS, *MODEL_ENVS):
        assert name in proc.stderr
    assert "VISION" not in proc.stderr  # env visual tidak lagi diwajibkan
    assert "Traceback" not in proc.stderr
    assert not (tmp_path / "r.json").exists()


def test_missing_env_only_for_selected_provider() -> None:
    env = {"GROQ_EVAL_API_KEY": "x", "GROQ_TEXT_MODEL": "m"}
    cfg = load_config(env, providers=["groq"], dry_run=False)
    assert list(cfg.providers) == ["groq"]
    with pytest.raises(ConfigError) as exc:
        load_config(env, providers=["fireworks", "groq"], dry_run=False)
    assert "FIREWORKS_EVAL_API_KEY" in str(exc.value)
    assert "GROQ_EVAL_API_KEY" not in str(exc.value)


def test_blank_env_counts_as_missing() -> None:
    env = {"GROQ_EVAL_API_KEY": "  ", "GROQ_TEXT_MODEL": "m"}
    with pytest.raises(ConfigError, match="GROQ_EVAL_API_KEY"):
        load_config(env, providers=["groq"], dry_run=False)


def test_prompt_wraps_untrusted_data() -> None:
    """Invarian 6: caption/OCR hanya muncul di dalam delimiter, dengan instruksi eksplisit."""
    messages = build_messages(SAMPLE_CAPTION, SAMPLE_OCR)
    system, user = messages[0], messages[1]
    assert system["role"] == "system" and user["role"] == "user"
    assert SAMPLE_CAPTION not in system["content"]
    assert SAMPLE_OCR not in system["content"]
    assert "jangan" in system["content"].lower() and "instruksi" in system["content"].lower()

    u = user["content"]
    cap_open, cap_close = u.index("<<<CAPTION>>>"), u.index("<<<END_CAPTION>>>")
    ocr_open, ocr_close = u.index("<<<OCR>>>"), u.index("<<<END_OCR>>>")
    assert cap_open < u.index(SAMPLE_CAPTION) < cap_close
    assert ocr_open < u.index(SAMPLE_OCR) < ocr_close


def test_sample_input_is_synthetic() -> None:
    """NFR-COMP-02: satuan fiktif, ditandai sintetis; ukuran ≈ 300 kata."""
    text = SAMPLE_CAPTION + "\n" + SAMPLE_OCR
    assert "Yonif 999/Contoh" in text
    assert "SINTETIS" in text
    assert 250 <= len(text.split()) <= 400


def test_response_format_shapes() -> None:
    from scripts.probe.prompt import load_text_schema

    schema = load_text_schema()
    rf, mode = response_format_for("fireworks", "accounts/fireworks/models/x", None)
    assert mode == "json_schema"
    assert rf["type"] == "json_schema"
    assert rf["json_schema"]["schema"]["required"] == ["findings"]
    assert "$id" not in rf["json_schema"]["schema"]

    rf, mode = response_format_for("groq", "meta-llama/llama-4-scout-17b-16e-instruct", None)
    assert (mode, rf) == ("json_object", {"type": "json_object"})

    rf, mode = response_format_for("groq", "openai/gpt-oss-120b", None)
    assert mode == "json_schema_strict"
    assert rf["json_schema"]["strict"] is True

    rf, mode = response_format_for("groq", "openai/gpt-oss-120b", "json_object")
    assert mode == "json_object"
    assert schema["$id"] == "llm-text-output.schema.json"


def test_requests_use_temperature_zero_and_max_tokens() -> None:
    bodies: list[dict] = []

    def factory(provider: str, key: str) -> httpx.BaseTransport:
        inner = make_mock_transport(provider, key)

        def handler(request: httpx.Request) -> httpx.Response:
            bodies.append(json.loads(request.content))
            return inner.handle_request(request)

        return httpx.MockTransport(handler)

    cfg = load_config({}, providers=["fireworks"], dry_run=True, max_tokens=321)
    run_probe(cfg, tests=["P1", "P3"], transport_factory=factory)
    assert bodies
    for b in bodies:
        assert b["temperature"] == 0
        assert b["max_tokens"] == 321
        assert b.get("stream") in (None, False)


def test_probe_isolated_from_app_code() -> None:
    """Skrip probe tidak mengimpor kode aplikasi, dan kode aplikasi tidak mengimpor probe."""
    app_pkgs = {"rules_engine", "providers", "app"}
    for path in PROBE_DIR.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0:
                names = [node.module or ""]
            else:
                continue
            for n in names:
                assert n.split(".")[0] not in app_pkgs, f"{path.name} mengimpor {n}"

    for pkg in app_pkgs:
        root = API_ROOT / pkg
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            src = path.read_text(encoding="utf-8")
            assert "scripts.probe" not in src, f"{path} mengimpor skrip probe"


def test_redactor_scrubs_key_and_fragments() -> None:
    """Lapis kedua: body error yang menggemakan key (atau potongannya) tetap tersensor."""
    import logging

    from scripts.probe.redact import Redactor, RedactingFilter

    r = Redactor((FAKE_KEY,))
    text = (f'{{"error": "Incorrect API key provided: {FAKE_KEY}", '
            f'"hint": "...{FAKE_KEY[-8:]}", "h": "Authorization: Bearer abc.def"}}')
    out = r.scrub(text)
    assert FAKE_KEY not in out and FAKE_KEY[-8:] not in out
    assert "abc.def" not in out

    record = logging.LogRecord("probe", logging.INFO, __file__, 1, "key=%s", (FAKE_KEY,), None)
    RedactingFilter(r).filter(record)
    assert FAKE_KEY not in record.getMessage()
