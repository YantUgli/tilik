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


DEFAULT_TEXT_MAX_TOKENS = 400  # NFR-COST-03


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


@dataclass(frozen=True)
class Settings:
    """Default tanpa key/model: `Settings(...)` di tes tidak pernah membaca env.

    Key tidak ikut `repr` supaya tidak bocor bila objek ini tercetak (NFR-SEC-01).
    """

    allowed_origins: list[str] = field(default_factory=list)
    fireworks_api_key: str | None = field(default=None, repr=False)
    fireworks_text_model: str | None = None
    text_max_tokens: int = DEFAULT_TEXT_MAX_TOKENS

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            allowed_origins=parse_allowed_origins(os.environ.get("ALLOWED_ORIGINS")),
            fireworks_api_key=_blank_to_none(os.environ.get("FIREWORKS_API_KEY")),
            fireworks_text_model=_blank_to_none(os.environ.get("FIREWORKS_TEXT_MODEL")),
            text_max_tokens=parse_max_tokens(os.environ.get("TEXT_MAX_TOKENS")),
        )
