"""Kelas error probe, meniru hierarki SPEC §5.6, dan pemetaan kegagalan HTTP.

Sengaja didefinisikan ulang di sini (bukan diimpor dari kode aplikasi): skrip probe
berdiri sendiri, dan abstraksi provider produksi baru dibuat di T-19. Hasil probe
(`docs/quota.md` bagian "Bentuk error") menjadi dasar pemetaan T-19.

Sumber kode status (dicek 9 Nov 2026):
- Groq:      https://console.groq.com/docs/errors
- Fireworks: https://docs.fireworks.ai/troubleshooting/status_error_codes/inference_error_code
"""

from __future__ import annotations

import json


class ProviderError(Exception):
    """Kegagalan tingkat HTTP/transport. `kind` adalah label ringkas untuk laporan."""

    def __init__(self, kind: str, status: int | None = None) -> None:
        super().__init__(f"{kind} (status={status})")
        self.kind = kind
        self.status = status


class RateLimited(ProviderError):
    """429: kena limit/kuota provider → provider berikutnya."""


class BudgetExceeded(ProviderError):
    """NFR-COST-01: batas belanja harian TILIK sendiri. Tidak pernah dari classify_error."""


class InvalidOutput(ProviderError):
    """Output model gagal skema setelah 1 retry. Diukur di P3, bukan di classify_error."""


class ProviderTimeout(ProviderError):
    """Klien kehabisan waktu menunggu provider (subkelas ProviderError)."""


_KIND_BY_STATUS = {
    400: "bad_request",
    401: "auth",
    402: "billing",       # Fireworks: belum paid plan / lewat batas pemakaian
    403: "forbidden",
    404: "not_found",     # termasuk model ID salah
    408: "server_timeout",
    413: "too_large",
    422: "unprocessable",
    498: "capacity",      # Groq: flex tier penuh
}


def classify_error(
    status: int | None,
    body: str | bytes | None,
    *,
    timed_out: bool = False,
) -> ProviderError | None:
    """Petakan hasil HTTP ke kelas error SPEC §5.6, atau `None` bila respons sehat.

    Hanya menilai kegagalan tingkat HTTP: status, dan apakah body 2xx berbentuk
    respons chat completions (`{"choices": [...]}`). Isi `message.content` yang tidak
    lolos skema bukan urusan fungsi ini; fungsi ini tidak pernah mengembalikan
    `InvalidOutput`.
    """
    if timed_out:
        return ProviderTimeout("timeout", status)
    if status is None:
        return ProviderError("no_response", None)
    if status == 429:
        return RateLimited("rate_limited", status)
    if 200 <= status < 300:
        parsed = _parse_json(body)
        if not isinstance(parsed, dict) or not isinstance(parsed.get("choices"), list):
            return ProviderError("bad_body", status)
        return None
    if status in _KIND_BY_STATUS:
        return ProviderError(_KIND_BY_STATUS[status], status)
    if status >= 500:
        return ProviderError("server", status)
    return ProviderError("http_error", status)


def _parse_json(body: str | bytes | None) -> object:
    if body is None:
        return None
    try:
        return json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return None
