"""RuleEngine: menjalankan semua aturan ke caption dan teks OCR → daftar `Finding`.

Tidak memanggil LLM dan tidak mengimpor modul provider (NFR-SEC-02). Teks masukan
diperlakukan sebagai data: tidak ada isi teks yang bisa mengubah perilaku engine.
Engine tidak mencatat isi teks ke log (NFR-PRIV-01).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .combine import combine_l3
from .limits import OCR_TEXT_MAX_CHARS
from .matcher import MASK_CHAR, match_rule
from .models import OcrWord, RawFinding, Rule, RuleInput

MIN_WORD_CONF = 50          # FR-OCR-02
EVIDENCE_MAX_CHARS = 200    # Finding.evidence.text maxLength
ID_PREFIXES = ("b", "c", "v")
_SOURCE_ORDER = {"caption": 0, "ocr": 1}


_WordSpan = tuple[int, int, OcrWord]


@dataclass(frozen=True)
class _OcrSource:
    text: str
    words: list[tuple[int, int, OcrWord]]   # (start, end, kata) untuk kata ber-conf cukup


class RuleEngine:
    def __init__(self, rules: list[Rule]):
        ids = [r.id for r in rules]
        duplicates = {i for i in ids if ids.count(i) > 1}
        if duplicates:
            raise ValueError(f"id aturan duplikat: {sorted(duplicates)}")
        self.rules = list(rules)

    def run(self, inp: RuleInput, id_prefix: str = "c") -> list[dict]:
        """Temuan berbentuk kontrak `Finding` (dict), sudah melalui `combine_l3`.

        `id` = `<id_prefix>-<n>`, mulai dari 1, urut `rule_ref` → sumber (caption, ocr)
        → posisi. `/analyze/caption` memakai prefiks `c` (data-model R15).
        """
        if id_prefix not in ID_PREFIXES:
            raise ValueError(f"id_prefix harus salah satu dari {ID_PREFIXES}")
        raw = combine_l3(self.match_all(inp))
        return [_to_finding(f, f"{id_prefix}-{i}") for i, f in enumerate(raw, start=1)]

    def match_all(self, inp: RuleInput) -> list[RawFinding]:
        """Temuan mentah sebelum penggabungan sinyal, urut deterministik."""
        ocr = _prepare_ocr(inp.ocr_text, inp.ocr_words)
        texts = {"caption": inp.caption or None, "ocr": ocr.text if ocr else None}

        found: list[RawFinding] = []
        for rule in self.rules:
            for where in rule.applies_to:
                text = texts[where]
                if not text:
                    continue
                for start, end in match_rule(rule, text):
                    bboxes = None
                    if where == "ocr" and rule.redact == "matched_words" and ocr and ocr.words:
                        bboxes = tuple(_to_xywh(w.bbox) for s, e, w in ocr.words if s < end and e > start) or None
                    found.append(RawFinding(
                        rule_ref=rule.id,
                        layer=rule.layer,
                        category=rule.category,
                        severity=rule.severity,
                        signal=rule.signal,
                        where=where,
                        start=start,
                        end=end,
                        text=_evidence_text(text[start:end]),
                        message=rule.message,
                        explanation=rule.explanation,
                        basis=rule.basis,
                        redactable=where == "ocr" and rule.redact == "matched_words",
                        bboxes=bboxes,
                    ))
        found.sort(key=lambda f: (f.rule_ref, _SOURCE_ORDER[f.where], f.start, f.end))
        return found


def _prepare_ocr(ocr_text: str | None, words: list[OcrWord] | None) -> _OcrSource | None:
    """Menyiapkan teks OCR untuk aturan (FR-OCR-02).

    Tanpa daftar kata: `ocr_text` dipakai apa adanya. Dengan daftar kata: setiap kata
    disejajarkan berurutan ke `ocr_text`; kata ber-conf < 50 ditutup dengan MASK_CHAR
    (offset dan baris tetap). `ocr_text` boleh terpotong (route memotong di
    OCR_TEXT_MAX_CHARS): kata setelah titik potong diabaikan, dan kata yang terpotong
    di tengah tidak diberi bbox. Bila ada kata yang tidak sejajar di tengah teks (atau
    `ocr_text` kosong), teks dibangun ulang dari kata ber-conf cukup, dipisah spasi,
    dan dipotong di OCR_TEXT_MAX_CHARS.
    """
    if not words:
        return _OcrSource(ocr_text, []) if ocr_text else None

    usable = [w for w in words if isinstance(w.text, str) and w.text.strip()]
    alignment = _align(ocr_text, usable) if ocr_text else None
    if alignment is None:
        return _rebuild_from_words(usable)

    aligned, partial = alignment
    chars = list(ocr_text)
    kept: list[_WordSpan] = []
    for start, end, w in aligned:
        if w.conf < MIN_WORD_CONF:
            chars[start:end] = MASK_CHAR * (end - start)
        elif _valid_bbox(w.bbox):
            kept.append((start, end, w))
    if partial is not None and partial[2].conf < MIN_WORD_CONF:
        start, end, _ = partial
        chars[start:end] = MASK_CHAR * (end - start)
    return _OcrSource("".join(chars), kept)


def _rebuild_from_words(words: list[OcrWord]) -> _OcrSource | None:
    """Jalur cadangan: kata ber-conf cukup dipisah spasi, maksimal OCR_TEXT_MAX_CHARS."""
    parts: list[str] = []
    spans: list[_WordSpan] = []
    cursor = 0
    for w in words:
        if w.conf < MIN_WORD_CONF:
            continue
        if parts:
            cursor += 1
        if cursor >= OCR_TEXT_MAX_CHARS:
            break
        token = w.text.strip()
        parts.append(token)
        spans.append((cursor, cursor + len(token), w))
        cursor += len(token)
    text = " ".join(parts)[:OCR_TEXT_MAX_CHARS]
    if not text:
        return None
    kept = [(s, e, w) for s, e, w in spans if e <= len(text) and _valid_bbox(w.bbox)]
    return _OcrSource(text, kept)


def _align(text: str, words: list[OcrWord]) -> tuple[list[_WordSpan], _WordSpan | None] | None:
    """Menyejajarkan kata ke teks secara berurutan; hanya spasi yang boleh di antaranya.

    Mengembalikan `(kata_sejajar, kata_terpotong)`. Bila teks habis sebelum kata habis
    (`ocr_text` dipotong), penyejajaran berhenti dengan sukses saat sisa teks hanya
    spasi atau merupakan awalan kata berikutnya (`kata_terpotong` = rentang awalan itu);
    kata sesudahnya dibuang. Ketidaksejajaran lain → None.
    """
    out: list[_WordSpan] = []
    cursor = 0
    for w in words:
        token = w.text.strip()
        index = text.find(token, cursor)
        if index >= 0 and not text[cursor:index].strip():
            out.append((index, index + len(token), w))
            cursor = index + len(token)
            continue
        rest = text[cursor:]
        tail = rest.lstrip()
        if not tail:
            return out, None
        if token.startswith(tail):
            start = len(text) - len(tail)
            return out, (start, len(text), w)
        return None
    return out, None


def _valid_bbox(bbox) -> bool:
    """bbox masukan [x0, y0, x1, y1]: empat angka 0..1 dengan x1 >= x0 dan y1 >= y0."""
    try:
        values = [float(v) for v in bbox]
    except (TypeError, ValueError):
        return False
    if len(values) != 4 or not all(math.isfinite(v) and 0.0 <= v <= 1.0 for v in values):
        return False
    x0, y0, x1, y1 = values
    return x1 >= x0 and y1 >= y0


def _to_xywh(bbox) -> tuple[float, float, float, float]:
    """[x0, y0, x1, y1] (kata OCR) → [x, y, w, h] (Finding.evidence.bboxes)."""
    x0, y0, x1, y1 = (float(v) for v in bbox)
    return (x0, y0, x1 - x0, y1 - y0)


def _evidence_text(text: str) -> str:
    cleaned = text.replace(MASK_CHAR, "").strip()
    if len(cleaned) > EVIDENCE_MAX_CHARS:
        cleaned = cleaned[: EVIDENCE_MAX_CHARS - 1].rstrip() + "…"
    return cleaned


def _to_finding(f: RawFinding, finding_id: str) -> dict:
    evidence: dict = {"text": f.text, "where": f.where}
    if f.bboxes:
        evidence["bboxes"] = [[float(v) for v in b] for b in f.bboxes]
    finding = {
        "id": finding_id,
        "layer": f.layer,
        "category": f.category,
        "severity": f.severity,
        "source": "rule",
        "message": f.message,
        "rule_ref": f.rule_ref,
        "evidence": evidence,
        "redactable": f.redactable,
        "experimental": False,
    }
    if f.explanation:
        finding["explanation"] = f.explanation
    if f.basis:
        finding["basis"] = f.basis
    return finding
