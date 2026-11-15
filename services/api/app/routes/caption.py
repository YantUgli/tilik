"""POST /analyze/caption (T-18): aturan dulu, lalu LLM.

Respons selalu tiga LayerResult: L3 aturan, L4 aturan, L4 LLM. Kegagalan LLM hanya
mengubah lapis ketiga; temuan aturan tidak pernah dihapus atau diturunkan oleh LLM
(FR-L4-03, FR-RISK-02, NFR-SEC-02). Teks pengguna tidak masuk log, exception, atau note.
"""

from __future__ import annotations

import asyncio
import time

from fastapi import APIRouter, Request
from slowapi import Limiter

from app.guards import LlmGuard, cache_key
from app.logs import log_llm
from app.mapping import map_llm_findings
from app.schemas import CaptionRequest
from providers import InvalidOutput, ProviderError, TextProvider
from rules_engine import OCR_TEXT_MAX_CHARS, OcrWord, RuleEngine, RuleInput

# Anggaran waktu lapis L4 LLM, termasuk satu kali coba ulang (interpretasi NFR-PERF-02;
# anggaran per provider di rantai diputuskan di T-19).
LLM_LAYER_TIMEOUT_S = 12

NOTE_TRUNCATED = f"ocr_text dipotong ke {OCR_TEXT_MAX_CHARS} karakter"
NOTE_NOT_CONFIGURED = "LLM belum dikonfigurasi"
NOTE_UNAVAILABLE = "Provider LLM tidak tersedia"
NOTE_TIMEOUT = "Waktu tunggu LLM habis"
NOTE_INVALID = "Output LLM tidak valid setelah coba ulang"
NOTE_INTERNAL = "Kesalahan internal saat memanggil LLM"
NOTE_RULE_ERROR = "Kesalahan internal pada rule engine"
NOTE_BUDGET = "Pemeriksaan AI dijeda sementara karena batas harian; aturan tetap berjalan."


def _layer(layer: str, status: str, provider: str | None, latency_ms: int, findings: list, *notes: str | None) -> dict:
    note = "; ".join(n for n in notes if n) or None
    return {
        "layer": layer,
        "status": status,
        "provider": provider,
        "latency_ms": max(0, latency_ms),
        "findings": findings,
        "note": note,
    }


def _ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def _is_blank(text: str | None) -> bool:
    return not (text or "").strip()


def build_caption_router(
    engine: RuleEngine,
    provider: TextProvider | None,
    guard: LlmGuard,
    limiter: Limiter,
    rate_limit: str,
) -> APIRouter:
    router = APIRouter()

    @router.post("/analyze/caption")
    @limiter.limit(rate_limit)  # NFR-SEC-06; kunci = IP klien (app/guards.py)
    async def analyze_caption(body: CaptionRequest, request: Request) -> dict:
        request_id = request.state.request_id
        caption = body.caption
        ocr_text = body.ocr_text
        truncated = ocr_text is not None and len(ocr_text) > OCR_TEXT_MAX_CHARS
        if truncated:
            ocr_text = ocr_text[:OCR_TEXT_MAX_CHARS]
        trunc_note = NOTE_TRUNCATED if truncated else None

        if _is_blank(caption) and _is_blank(ocr_text):
            return {
                "request_id": request_id,
                "layers": [
                    _layer("L3", "ok", "rule", 0, []),
                    _layer("L4", "ok", "rule", 0, []),
                    _layer("L4", "skipped", None, 0, []),
                ],
            }

        # 1. Aturan: selalu, tanpa LLM.
        start = time.perf_counter()
        words = (
            [OcrWord(text=w.text, bbox=tuple(w.bbox), conf=w.conf) for w in body.ocr_words]
            if body.ocr_words is not None
            else None
        )
        try:
            rule_findings = engine.run(RuleInput(caption=caption, ocr_text=ocr_text, ocr_words=words), "c")
            rule_status, rule_note = "ok", None
        except Exception:  # noqa: BLE001 — NFR-AVAIL-01: lapis LLM tetap jalan
            rule_findings, rule_status, rule_note = [], "error", NOTE_RULE_ERROR
        rule_ms = _ms(start)
        l3 = [f for f in rule_findings if f["layer"] == "L3"]
        l4 = [f for f in rule_findings if f["layer"] == "L4"]

        # 2. LLM: lapis terpisah; kegagalannya tidak menyentuh hasil aturan.
        llm = await _llm_layer(provider, guard, caption, ocr_text, request_id, len(rule_findings) + 1, trunc_note)

        return {
            "request_id": request_id,
            "layers": [
                _layer("L3", rule_status, "rule", rule_ms, l3, trunc_note, rule_note),
                _layer("L4", rule_status, "rule", rule_ms, l4, trunc_note, rule_note),
                llm,
            ],
        }

    return router


async def _llm_layer(
    provider: TextProvider | None,
    guard: LlmGuard,
    caption: str | None,
    ocr_text: str | None,
    request_id: str,
    first_index: int,
    trunc_note: str | None,
) -> dict:
    if provider is None:
        log_llm(request_id, None, "unavailable", 0, None, None, None)
        return _layer("L4", "unavailable", None, 0, [], trunc_note, NOTE_NOT_CONFIGURED)

    start = time.perf_counter()

    # Cache (NFR-COST-02): hit → tanpa provider dan tanpa token. Pemetaan diulang karena
    # id temuan dan sumber kutipan bergantung pada request ini.
    key = cache_key(guard.model, caption, ocr_text)
    cached = guard.cache.get(key)
    if cached is not None:
        cached_provider, cached_output = cached
        try:
            findings = map_llm_findings(cached_output, caption, ocr_text, first_index)
        except Exception:  # noqa: BLE001
            log_llm(request_id, None, "error", _ms(start), None, None, None, cache="hit")
            return _layer("L4", "error", None, _ms(start), [], trunc_note, NOTE_INTERNAL)
        latency = _ms(start)
        log_llm(request_id, cached_provider, "ok", latency, None, None, None, cache="hit")
        return _layer("L4", "ok", cached_provider, latency, findings, trunc_note)

    # Batas token harian (NFR-COST-01, deviasi T-20): LLM dilewati, aturan sudah berjalan.
    if guard.budget.exhausted():
        log_llm(request_id, None, "unavailable", 0, None, None, None, cache="miss", budget="skipped")
        return _layer("L4", "unavailable", None, 0, [], trunc_note, NOTE_BUDGET)

    try:
        output, usage = await asyncio.wait_for(provider.classify(caption, ocr_text), LLM_LAYER_TIMEOUT_S)
    except InvalidOutput as exc:  # sebelum ProviderError: tidak memicu provider berikutnya (SPEC §5.6)
        usage = exc.usage
        if usage:
            guard.budget.add(usage.tokens_in, usage.tokens_out)
        log_llm(request_id, provider.name, "error", _ms(start),
                usage and usage.tokens_in, usage and usage.tokens_out, exc.http_status, cache="miss")
        return _layer("L4", "error", provider.name, _ms(start), [], trunc_note, NOTE_INVALID)
    except ProviderError as exc:
        usage = exc.usage
        if usage:
            guard.budget.add(usage.tokens_in, usage.tokens_out)
        log_llm(request_id, provider.name, "unavailable", _ms(start),
                usage and usage.tokens_in, usage and usage.tokens_out, exc.http_status, cache="miss")
        return _layer("L4", "unavailable", None, _ms(start), [], trunc_note, NOTE_UNAVAILABLE)
    except TimeoutError:
        # Token panggilan yang terputus tidak diketahui, jadi tidak terhitung.
        log_llm(request_id, provider.name, "unavailable", _ms(start), None, None, None, cache="miss")
        return _layer("L4", "unavailable", None, _ms(start), [], trunc_note, NOTE_TIMEOUT)
    except Exception:  # noqa: BLE001 — bug di kode TILIK sebelum provider menjawab
        log_llm(request_id, None, "error", _ms(start), None, None, None, cache="miss")
        return _layer("L4", "error", None, _ms(start), [], trunc_note, NOTE_INTERNAL)

    guard.budget.add(usage.tokens_in, usage.tokens_out)
    try:
        findings = map_llm_findings(output, caption, ocr_text, first_index)
    except Exception:  # noqa: BLE001 — provider sudah menjawab; error tercatat atas namanya
        log_llm(request_id, provider.name, "error", _ms(start), usage.tokens_in, usage.tokens_out,
                usage.http_status, cache="miss")
        return _layer("L4", "error", provider.name, _ms(start), [], trunc_note, NOTE_INTERNAL)

    guard.cache.put(key, provider.name, output)  # hanya hasil `ok`
    latency = _ms(start)
    log_llm(request_id, provider.name, "ok", latency, usage.tokens_in, usage.tokens_out, usage.http_status,
            cache="miss")
    return _layer("L4", "ok", provider.name, latency, findings, trunc_note)
