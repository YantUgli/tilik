"""Sensor key dari laporan dan log (NFR-SEC-01).

Lapis utama: key tidak pernah dimasukkan ke laporan/log sejak awal (header request
tidak dicatat; dari header respons hanya `retry-after`, `x-ratelimit-*`, dan
`x-request-id`). Lapis kedua di sini: setiap teks yang keluar disaring dari nilai
key di env, potongan awal/akhirnya, dan pola `Bearer ...`.
"""

from __future__ import annotations

import logging
import re

MASK = "***"
_BEARER = re.compile(r"(?i)bearer\s+[^\s\"',}]+")
_FRAGMENT = 8


class Redactor:
    def __init__(self, secrets: tuple[str, ...]) -> None:
        needles: set[str] = set()
        for s in secrets:
            if not s:
                continue
            needles.add(s)
            if len(s) >= 2 * _FRAGMENT:
                needles.add(s[:_FRAGMENT])
                needles.add(s[-_FRAGMENT:])
        # terpanjang dulu supaya key utuh tersensor sebelum potongannya
        self._needles = sorted(needles, key=len, reverse=True)

    def scrub(self, text: str) -> str:
        text = _BEARER.sub(f"Bearer {MASK}", text)
        for n in self._needles:
            text = text.replace(n, MASK)
        return text


class RedactingFilter(logging.Filter):
    def __init__(self, redactor: Redactor) -> None:
        super().__init__()
        self._r = redactor

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = self._r.scrub(record.getMessage())
        record.args = None
        return True
