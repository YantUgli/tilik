"""Prompt LLM berversi. Caption dan teks OCR adalah data tak tepercaya (NFR-SEC-02).

Teks pengguna hanya masuk pesan `user`, di dalam delimiter acak per request yang
tidak muncul di teks pengguna (jadi tidak bisa ditebak atau dipalsukan).
"""

from __future__ import annotations

import json
import secrets
from functools import cache
from pathlib import Path

from app.llm_schema import LLM_TEXT_OUTPUT_JSON_SCHEMA

CAPTION_PROMPT_VERSION = "caption_v1"
_DIR = Path(__file__).resolve().parent


@cache
def _template(version: str) -> str:
    return (_DIR / f"{version}.txt").read_text(encoding="utf-8")


def _new_token(*texts: str) -> str:
    while True:
        token = secrets.token_hex(4)
        if not any(token in t for t in texts):
            return token


def build_caption_messages(caption: str | None, ocr_text: str | None) -> tuple[list[dict], str]:
    """Pesan chat completions untuk klasifikasi L4; mengembalikan (messages, token)."""
    caption = caption or ""
    ocr_text = ocr_text or ""
    token = _new_token(caption, ocr_text)
    system = (
        _template(CAPTION_PROMPT_VERSION)
        .replace("{{TOKEN}}", token)
        .replace("{{SCHEMA}}", json.dumps(LLM_TEXT_OUTPUT_JSON_SCHEMA, ensure_ascii=False))
    )
    start, end = f"<<<DATA-{token}>>>", f"<<<END-{token}>>>"
    user = f"CAPTION:\n{start}\n{caption}\n{end}\n\nTEKS OCR:\n{start}\n{ocr_text}\n{end}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}], token
