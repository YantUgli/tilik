"""Daftar hitam nama satuan/pejabat/nomor nyata (daftar_hitam.txt)."""

from __future__ import annotations

import re
from pathlib import Path

DEFAULT_PATH = Path(__file__).with_name("daftar_hitam.txt")


def _norm(text: str) -> str:
    """Huruf kecil, semua non-alfanumerik jadi spasi, spasi tunggal, diapit spasi."""
    return " " + " ".join(re.sub(r"[^0-9a-z]+", " ", text.casefold()).split()) + " "


def load(path: Path = DEFAULT_PATH) -> list[str]:
    entries = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            entries.append(line)
    return entries


def find(text: str, entries: list[str]) -> list[str]:
    """Entri daftar hitam yang muncul utuh-per-kata di `text`."""
    hay = _norm(text)
    return [e for e in entries if _norm(e) in hay]
