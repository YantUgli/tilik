"""Uji P1, P3, P4, P5 dan perakitan laporan.

P2 (visual) tidak ada: T-21 dipotong (9 Nov 2026).

Laporan hanya berisi angka, status, header allowlist, dan ringkasan bentuk body error.
Prompt dan output model tidak disalin, kecuali cuplikan pendek output yang gagal
skema di P3 (input contoh sepenuhnya sintetis, jadi tidak ada data pengguna).
"""

from __future__ import annotations

import json
import logging
import statistics
from collections import Counter
from collections.abc import Callable, Iterable
from datetime import datetime, timedelta, timezone

import httpx
from jsonschema import Draft202012Validator

from .client import CallResult, ChatClient
from .config import ALL_TESTS, WRONG_KEY, WRONG_MODEL, ProbeConfig, ProviderRun
from .errors import ProviderError
from .prompt import (
    SAMPLE_CAPTION,
    SAMPLE_OCR,
    TEXT_SCHEMA_FILE,
    build_messages,
    load_text_schema,
    response_format_for,
)

log = logging.getLogger("probe")

TransportFactory = Callable[[str, str], httpx.BaseTransport | None]

WIB = timezone(timedelta(hours=7))
BURST_PROVIDERS = ("groq",)  # P4 tidak ke Fireworks: billing prabayar, limit dibaca di console


def _call_summary(r: CallResult) -> dict:
    return {
        "status": r.status,
        "latency_s": round(r.latency_s, 3),
        "prompt_tokens": r.prompt_tokens,
        "completion_tokens": r.completion_tokens,
        "finish_reason": r.finish_reason,
        "error_class": type(r.error).__name__ if r.error else None,
    }


def _error_summary(r: CallResult) -> dict:
    return {
        "status": r.status,
        "latency_s": round(r.latency_s, 3),
        "error_class": type(r.error).__name__ if r.error else None,
        "error_kind": r.error.kind if r.error else None,
        "body": r.body_shape,
        "headers": r.headers,
    }


def _median(values: Iterable[int | float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    return statistics.median(vals) if vals else None


def _log_call(prov: str, test: str, i: int, r: CallResult) -> None:
    log.debug("%s %s #%d status=%s latency=%.2fs tokens=%s/%s%s", prov, test, i, r.status,
             r.latency_s, r.prompt_tokens, r.completion_tokens,
             f" error={type(r.error).__name__}:{r.error.kind}" if r.error else "")


# ---------------------------------------------------------------------------
# P1 — token dan latensi
# ---------------------------------------------------------------------------
def run_p1(client: ChatClient, run: ProviderRun, cfg: ProbeConfig) -> dict:
    rf, mode = response_format_for(run.spec.name, run.model, cfg.json_modes.get(run.spec.name))
    messages = build_messages(SAMPLE_CAPTION, SAMPLE_OCR)
    calls = []
    for i in range(1, cfg.p1_n + 1):
        r = client.chat(key=run.key, model=run.model, messages=messages, max_tokens=cfg.max_tokens,
                        timeout=cfg.timeout_s, response_format=rf)
        _log_call(run.spec.name, "P1", i, r)
        calls.append(r)
    ok = [c for c in calls if c.ok]
    lat = [c.latency_s for c in ok]
    return {
        "n": len(calls),
        "n_ok": len(ok),
        "json_mode": mode,
        "max_tokens": cfg.max_tokens,
        "prompt_tokens_median": _median(c.prompt_tokens for c in ok),
        "completion_tokens_median": _median(c.completion_tokens for c in ok),
        "completion_tokens_max": max((c.completion_tokens or 0 for c in ok), default=None),
        "latency_p50_s": round(statistics.median(lat), 3) if lat else None,
        "latency_max_s": round(max(lat), 3) if lat else None,
        "finish_reasons": dict(Counter(c.finish_reason for c in ok)),
        "calls": [_call_summary(c) for c in calls],
    }


# ---------------------------------------------------------------------------
# P3 — kepatuhan JSON terhadap llm-text-output
# ---------------------------------------------------------------------------
def _validate(content: str | None, validator: Draft202012Validator) -> str | None:
    """`None` bila valid; selain itu alasan singkat."""
    if content is None:
        return "no_content"
    try:
        data = json.loads(content)
    except ValueError:
        return "not_json"
    err = next(iter(validator.iter_errors(data)), None)
    if err is None:
        return None
    path = "/".join(str(p) for p in err.absolute_path) or "(root)"
    return f"schema:{path}:{err.validator}"


def _attempt(client: ChatClient, run: ProviderRun, cfg: ProbeConfig, messages: list[dict],
             rf: dict, validator: Draft202012Validator) -> tuple[CallResult, str | None]:
    r = client.chat(key=run.key, model=run.model, messages=messages, max_tokens=cfg.max_tokens,
                    timeout=cfg.timeout_s, response_format=rf)
    if r.error is not None:
        # Groq best-effort json_schema bisa menolak dengan 400 json_validate_failed:
        # dihitung sebagai output tidak valid, bukan kegagalan HTTP biasa.
        if r.error_code == "json_validate_failed":
            return r, "http400:json_validate_failed"
        return r, f"http_error:{r.error.kind}"
    return r, _validate(r.content, validator)


def run_p3(client: ChatClient, run: ProviderRun, cfg: ProbeConfig) -> dict:
    rf, mode = response_format_for(run.spec.name, run.model, cfg.json_modes.get(run.spec.name))
    validator = Draft202012Validator(load_text_schema())
    base = build_messages(SAMPLE_CAPTION, SAMPLE_OCR)

    direct = after_retry = 0
    reasons_first: Counter[str] = Counter()
    reasons_retry: Counter[str] = Counter()
    samples: list[str] = []
    retry_tokens: list[int] = []
    for i in range(1, cfg.p3_n + 1):
        r1, why1 = _attempt(client, run, cfg, base, rf, validator)
        _log_call(run.spec.name, "P3", i, r1)
        if why1 is None:
            direct += 1
            after_retry += 1
            continue
        reasons_first[why1.split(":")[0] if why1.startswith("schema") else why1] += 1
        if r1.content and len(samples) < 3:
            samples.append(r1.content[:300])
        if why1.startswith("http_error"):
            continue  # kegagalan HTTP bukan soal kepatuhan JSON; tidak di-retry

        # Satu kali coba ulang (SPEC §5.6), dengan umpan balik singkat.
        retry_msgs = list(base)
        if r1.content:
            retry_msgs.append({"role": "assistant", "content": r1.content})
        retry_msgs.append({
            "role": "user",
            "content": f"Output sebelumnya tidak valid ({why1}). Kirim ulang HANYA satu objek "
                       "JSON yang sesuai skema, tanpa blok kode markdown.",
        })
        r2, why2 = _attempt(client, run, cfg, retry_msgs, rf, validator)
        _log_call(run.spec.name, "P3-retry", i, r2)
        if r2.prompt_tokens is not None:
            retry_tokens.append(r2.prompt_tokens)
        if why2 is None:
            after_retry += 1
        else:
            reasons_retry[why2.split(":")[0] if why2.startswith("schema") else why2] += 1

    n = cfg.p3_n
    return {
        "n": n,
        "schema": TEXT_SCHEMA_FILE,
        "json_mode": mode,
        "response_format_type": rf["type"],
        "valid_direct_pct": round(100 * direct / n, 1),
        "valid_after_retry_pct": round(100 * after_retry / n, 1),
        "invalid_reasons_first": dict(reasons_first),
        "invalid_reasons_after_retry": dict(reasons_retry),
        "retry_prompt_tokens_median": _median(retry_tokens),
        "invalid_samples": samples,
    }


# ---------------------------------------------------------------------------
# P4 — burst (Groq saja)
# ---------------------------------------------------------------------------
def run_p4(client: ChatClient, run: ProviderRun, cfg: ProbeConfig) -> dict:
    # Request sekecil mungkin (tanpa response_format, max_tokens 1) supaya yang diukur RPM, bukan TPM.
    messages = [{"role": "user", "content": "Balas dengan satu kata: ok"}]
    statuses: list[int | None] = []
    first_429_at = None
    first_429 = None
    last_ok_headers: dict[str, str] = {}
    for i in range(1, cfg.burst_n + 1):
        r = client.chat(key=run.key, model=run.model, messages=messages, max_tokens=1,
                        timeout=cfg.timeout_s)
        _log_call(run.spec.name, "P4", i, r)
        statuses.append(r.status)
        if r.ok:
            last_ok_headers = r.headers
        elif r.status == 429 and first_429_at is None:
            first_429_at = i
            first_429 = _error_summary(r)
    return {
        "n_sent": len(statuses),
        "first_429_at": first_429_at,
        "first_429": first_429,
        "status_counts": {str(k): v for k, v in Counter(statuses).items()},
        "statuses": statuses,
        "last_ok_headers": last_ok_headers,
    }


# ---------------------------------------------------------------------------
# P5 — bentuk error
# ---------------------------------------------------------------------------
def run_p5(client: ChatClient, run: ProviderRun, cfg: ProbeConfig) -> dict:
    messages = [{"role": "user", "content": "Balas dengan satu kata: ok"}]
    cases = {
        "wrong_key": dict(key=WRONG_KEY, model=run.model, timeout=cfg.timeout_s),
        "wrong_model": dict(key=run.key, model=WRONG_MODEL, timeout=cfg.timeout_s),
        # timeout: prompt penuh + max_tokens penuh supaya respons cukup lama untuk klien 1 detik
        "timeout": dict(key=run.key, model=run.model, timeout=cfg.timeout_probe_s),
    }
    out = {}
    for name, kw in cases.items():
        msgs = build_messages(SAMPLE_CAPTION, SAMPLE_OCR) if name == "timeout" else messages
        r = client.chat(messages=msgs, max_tokens=cfg.max_tokens if name == "timeout" else 1, **kw)
        _log_call(run.spec.name, f"P5-{name}", 1, r)
        summary = _error_summary(r)
        if name == "timeout":
            summary["client_timeout_s"] = cfg.timeout_probe_s
            summary["timeout_triggered"] = r.error is not None and r.error.kind == "timeout"
        out[name] = summary
    return out


# ---------------------------------------------------------------------------
_RUNNERS = {"P1": run_p1, "P3": run_p3, "P4": run_p4, "P5": run_p5}


def run_probe(
    cfg: ProbeConfig,
    *,
    tests: Iterable[str] = ALL_TESTS,
    transport_factory: TransportFactory | None = None,
) -> dict:
    """Jalankan uji terpilih dan kembalikan laporan (dict). Tidak menulis file."""
    tests = [t for t in ALL_TESTS if t in set(tests)]
    report: dict = {
        "meta": {
            "generated_at_wib": datetime.now(WIB).strftime("%Y-%m-%d %H:%M WIB"),
            "dry_run": cfg.dry_run,
            "tests": tests,
            "providers": {n: {"text_model": r.model, "endpoint": r.spec.chat_url}
                          for n, r in cfg.providers.items()},
            "keys_from_env": {n: r.key_from_env for n, r in cfg.providers.items()},
            "temperature": 0,
            "max_tokens": cfg.max_tokens,
            "timeout_s": cfg.timeout_s,
            "scope_note": "Teks saja; P2 visual dibuang karena T-21 dipotong (9 Nov 2026).",
        },
    }
    for test in tests:
        section: dict = {}
        for name, run in cfg.providers.items():
            if test == "P4" and name not in BURST_PROVIDERS:
                continue
            transport = transport_factory(name, run.key) if transport_factory else None
            with ChatClient(run.spec, transport=transport) as client:
                try:
                    section[name] = _RUNNERS[test](client, run, cfg)
                except ProviderError as exc:  # pragma: no cover - jaring pengaman
                    section[name] = {"aborted": f"{type(exc).__name__}:{exc.kind}"}
        report[test] = section
    return report


# ---------------------------------------------------------------------------
# Ringkasan markdown (untuk ditempel ke docs/quota.md)
# ---------------------------------------------------------------------------
def _fmt(v: object) -> str:
    return "–" if v is None else str(v)


def render_summary_md(report: dict) -> str:
    meta = report["meta"]
    lines = []
    if meta["dry_run"]:
        lines.append("> **DRY-RUN — angka di bawah dari respons tiruan, JANGAN ditempel ke docs/quota.md.**\n")
    lines.append(f"Probe {meta['generated_at_wib']} · max_tokens {meta['max_tokens']} · temperature 0\n")
    lines.append("| Provider | Model ID | Uji | Token in / out (median) | Latensi p50 / maks | "
                 "JSON valid langsung / +retry | Catatan |")
    lines.append("|---|---|---|---|---|---|---|")
    for prov, info in meta["providers"].items():
        model = info["text_model"]
        p1 = report.get("P1", {}).get(prov)
        p3 = report.get("P3", {}).get(prov)
        if p1:
            note = f"n_ok {p1['n_ok']}/{p1['n']}; finish {p1['finish_reasons']}; out maks {p1['completion_tokens_max']}"
            lines.append(
                f"| {prov} | `{model}` | P1 teks | {_fmt(p1['prompt_tokens_median'])} / "
                f"{_fmt(p1['completion_tokens_median'])} | {_fmt(p1['latency_p50_s'])} s / "
                f"{_fmt(p1['latency_max_s'])} s | – | {note} |")
        if p3:
            note = f"mode {p3['json_mode']}; gagal awal {p3['invalid_reasons_first'] or '-'}"
            lines.append(
                f"| {prov} | `{model}` | P3 JSON | – | – | {p3['valid_direct_pct']}% / "
                f"{p3['valid_after_retry_pct']}% | {note} |")

    p4 = report.get("P4", {}).get("groq")
    if p4:
        lines.append("\n**P4 burst Groq:** " + (
            f"429 pertama di request ke-{p4['first_429_at']} dari {p4['n_sent']}; "
            f"header: `{json.dumps(p4['first_429']['headers'], ensure_ascii=False)}`; "
            f"body: `{json.dumps(p4['first_429']['body'], ensure_ascii=False)}`"
            if p4["first_429_at"] else f"tidak kena 429 dalam {p4['n_sent']} request"))

    if report.get("P5"):
        lines.append("\n**P5 bentuk error:**\n")
        lines.append("| Provider | Kasus | Status | Kelas | Body |")
        lines.append("|---|---|---|---|---|")
        for prov, cases in report["P5"].items():
            for case, s in cases.items():
                body = json.dumps(s.get("body"), ensure_ascii=False) if s.get("body") else "–"
                extra = ""
                if case == "timeout" and not s.get("timeout_triggered"):
                    extra = " (timeout tidak terpicu)"
                lines.append(f"| {prov} | {case}{extra} | {_fmt(s['status'])} | "
                             f"{_fmt(s['error_class'])} | `{body}` |")
    return "\n".join(lines) + "\n"
