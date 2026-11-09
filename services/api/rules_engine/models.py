"""Struktur data rule engine. Tidak ada I/O di modul ini."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class OcrWord:
    text: str
    bbox: tuple[float, float, float, float]  # [x, y, w, h] relatif 0..1 terhadap gambar asli
    conf: float


@dataclass(frozen=True)
class RuleInput:
    caption: str | None
    ocr_text: str | None              # teks gabungan (baris dipisah \n)
    ocr_words: list[OcrWord] | None   # opsional; tanpa ini, redaksi bbox dilewati


@dataclass(frozen=True)
class RuleTests:
    positive: tuple[str, ...]
    negative: tuple[str, ...]


@dataclass(frozen=True)
class Rule:
    """Aturan yang sudah divalidasi dan regex-nya sudah dicompile (sekali, saat load)."""

    id: str
    layer: str
    category: str
    severity: str
    signal: str
    applies_to: tuple[str, ...]
    any_regex: tuple[re.Pattern[str], ...]
    require_context: tuple[re.Pattern[str], ...]
    negative_context: tuple[re.Pattern[str], ...]
    redact: str | None
    message: str
    explanation: str | None
    basis: str | None
    tests: RuleTests
    source_file: str


@dataclass(frozen=True)
class RawFinding:
    """Temuan sebelum diberi `id` dan diubah ke bentuk kontrak `Finding`.

    Menyimpan `signal` (tidak ada di kontrak) supaya `combine_l3` bisa bekerja
    tanpa melihat aturan lagi.
    """

    rule_ref: str
    layer: str
    category: str
    severity: str
    signal: str
    where: str          # "caption" | "ocr"
    start: int
    end: int
    text: str
    message: str
    explanation: str | None
    basis: str | None
    redactable: bool
    bboxes: tuple[tuple[float, float, float, float], ...] | None
