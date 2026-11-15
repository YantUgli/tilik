"""Konfigurasi dari environment. Secret hanya dibaca di server (NFR-SEC-01)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def parse_allowed_origins(raw: str | None) -> list[str]:
    """Pecah ALLOWED_ORIGINS (dipisah koma). Wildcard ditolak (NFR-SEC-05)."""
    origins: list[str] = []
    for part in (raw or "").split(","):
        origin = part.strip().rstrip("/")
        if not origin:
            continue
        if "*" in origin:
            raise ValueError("ALLOWED_ORIGINS tidak boleh memuat wildcard '*'")
        origins.append(origin)
    return origins


DEFAULT_TEXT_MAX_TOKENS = 1000  # NFR-COST-03 (SPEC 0.8)


def _blank_to_none(raw: str | None) -> str | None:
    value = (raw or "").strip()
    return value or None


def parse_max_tokens(raw: str | None) -> int:
    value = _blank_to_none(raw)
    if value is None:
        return DEFAULT_TEXT_MAX_TOKENS
    tokens = int(value)
    if tokens <= 0:
        raise ValueError("TEXT_MAX_TOKENS harus bilangan bulat positif")
    return tokens


DEFAULT_RATE_LIMIT = "10/minute;60/day"  # NFR-SEC-06 (SPEC §6)
DEFAULT_DAILY_TOKEN_BUDGET = 2_000_000  # NFR-COST-01, deviasi: token, bukan USD (T-20)


def parse_rate_limit(raw: str | None) -> str:
    """Notasi `limits` dipisah `;`, mis. `10/minute;60/day`. Tidak valid → ValueError saat start."""
    from limits import parse_many  # dependensi slowapi

    value = _blank_to_none(raw)
    if value is None:
        return DEFAULT_RATE_LIMIT
    try:
        parsed = parse_many(value)
    except ValueError:
        parsed = []
    if not parsed:
        raise ValueError("RATE_LIMIT tidak valid; contoh: 10/minute;60/day")
    return value


def parse_daily_token_budget(raw: str | None) -> int:
    value = _blank_to_none(raw)
    if value is None:
        return DEFAULT_DAILY_TOKEN_BUDGET
    try:
        tokens = int(value)
    except ValueError:
        tokens = 0
    if tokens <= 0:
        raise ValueError("DAILY_TOKEN_BUDGET harus bilangan bulat positif")
    return tokens


@dataclass(frozen=True)
class Settings:
    """Default tanpa key/model: `Settings(...)` di tes tidak pernah membaca env.

    Key tidak ikut `repr` supaya tidak bocor bila objek ini tercetak (NFR-SEC-01).
    """

    allowed_origins: list[str] = field(default_factory=list)
    fireworks_api_key: str | None = field(default=None, repr=False)
    fireworks_text_model: str | None = None
    text_max_tokens: int = DEFAULT_TEXT_MAX_TOKENS
    # Dikirim sebagai `reasoning_effort` bila diisi; None → tidak dikirim (model non-reasoning).
    # Tidak divalidasi di sini: nilai yang ditolak provider terlihat sebagai http_status=400 di log.
    text_reasoning_effort: str | None = None
    rate_limit: str = DEFAULT_RATE_LIMIT
    daily_token_budget: int = DEFAULT_DAILY_TOKEN_BUDGET

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            allowed_origins=parse_allowed_origins(os.environ.get("ALLOWED_ORIGINS")),
            fireworks_api_key=_blank_to_none(os.environ.get("FIREWORKS_API_KEY")),
            fireworks_text_model=_blank_to_none(os.environ.get("FIREWORKS_TEXT_MODEL")),
            text_max_tokens=parse_max_tokens(os.environ.get("TEXT_MAX_TOKENS")),
            text_reasoning_effort=_blank_to_none(os.environ.get("TEXT_REASONING_EFFORT")),
            rate_limit=parse_rate_limit(os.environ.get("RATE_LIMIT")),
            daily_token_budget=parse_daily_token_budget(os.environ.get("DAILY_TOKEN_BUDGET")),
        )
