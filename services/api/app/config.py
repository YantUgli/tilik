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


@dataclass(frozen=True)
class Settings:
    allowed_origins: list[str] = field(default_factory=list)

    @classmethod
    def from_env(cls) -> Settings:
        return cls(allowed_origins=parse_allowed_origins(os.environ.get("ALLOWED_ORIGINS")))
