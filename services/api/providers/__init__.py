"""Abstraksi provider LLM (SPEC §5.6).

Pesan exception provider tidak pernah memuat teks pengguna, body respons, atau key:
hanya kelas, status HTTP, dan pemakaian token (NFR-PRIV-01, NFR-SEC-01).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.llm_schema import LlmTextOutput


@dataclass(frozen=True)
class Usage:
    tokens_in: int | None = None
    tokens_out: int | None = None
    http_status: int | None = None


class ProviderError(Exception):
    """Kegagalan provider. `http_status` dan `usage` hanya metadata, tanpa isi."""

    def __init__(self, *, http_status: int | None = None, usage: Usage | None = None) -> None:
        self.http_status = http_status
        self.usage = usage
        super().__init__(f"{type(self).__name__} http_status={http_status}")


class RateLimited(ProviderError):
    """429 / kuota → (T-19) pindah ke provider berikutnya."""


class BudgetExceeded(ProviderError):
    """NFR-COST-01 → (T-20) lewati Fireworks."""


class ProviderTimeout(ProviderError):
    """Timeout jaringan ke provider."""


class InvalidOutput(ProviderError):
    """Output gagal skema setelah satu kali coba ulang. Tidak memicu provider berikutnya."""


class TextProvider(Protocol):
    name: str

    async def classify(self, caption: str | None, ocr_text: str | None) -> tuple[LlmTextOutput, Usage]: ...


__all__ = [
    "BudgetExceeded",
    "InvalidOutput",
    "ProviderError",
    "ProviderTimeout",
    "RateLimited",
    "TextProvider",
    "Usage",
]
