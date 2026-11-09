"""Pencocokan satu aturan ke satu teks sumber (SPEC §5.5).

Semantik:
- `negative_context` cocok di mana pun dalam teks sumber → aturan tidak menyala.
- `any_regex` dicocokkan ke teks utuh (pola multibaris didukung, flag MULTILINE).
- `require_context`: minimal satu pola cocok dalam jendela ±3 baris dari baris
  awal kecocokan (termasuk baris itu sendiri).
- Kecocokan yang tumpang tindih (dari regex mana pun di aturan yang sama) digabung.
"""

from __future__ import annotations

from bisect import bisect_right

from .models import Rule

CONTEXT_WINDOW_LINES = 3

# Pengganti karakter kata OCR ber-confidence rendah: bukan spasi dan bukan karakter
# kata, sehingga `\s+` tidak bisa melompatinya dan `\b` tetap berlaku. Offset tetap.
MASK_CHAR = "\x00"

Span = tuple[int, int]


def match_rule(rule: Rule, text: str | None) -> list[Span]:
    """Rentang karakter (start, end) tempat aturan menyala di `text`, urut posisi."""
    if not text:
        return []
    if any(p.search(text) for p in rule.negative_context):
        return []

    line_starts = _line_starts(text) if rule.require_context else None
    spans: list[Span] = []
    for pattern in rule.any_regex:
        for m in pattern.finditer(text):
            if m.end() == m.start():
                continue
            if line_starts is not None and not _context_ok(rule, text, line_starts, m.start()):
                continue
            spans.append((m.start(), m.end()))
    return _merge(spans)


def _line_starts(text: str) -> list[int]:
    starts = [0]
    index = text.find("\n")
    while index != -1:
        starts.append(index + 1)
        index = text.find("\n", index + 1)
    return starts


def _context_ok(rule: Rule, text: str, line_starts: list[int], pos: int) -> bool:
    line = bisect_right(line_starts, pos) - 1
    first = max(0, line - CONTEXT_WINDOW_LINES)
    last = line + CONTEXT_WINDOW_LINES
    start = line_starts[first]
    end = line_starts[last + 1] - 1 if last + 1 < len(line_starts) else len(text)
    window = text[start:end]
    return any(p.search(window) for p in rule.require_context)


def _merge(spans: list[Span]) -> list[Span]:
    merged: list[Span] = []
    for start, end in sorted(spans):
        if merged and start < merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
