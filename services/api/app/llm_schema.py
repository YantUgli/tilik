"""Salinan kontrak `contracts/llm-text-output.schema.json` untuk runtime.

`contracts/` tidak ikut ke image/deploy (build context = services/api), jadi skema
disalin di sini dua kali: sebagai model Pydantic (validasi output LLM) dan sebagai
dict JSON Schema (dikirim lewat `response_format` dan ditulis di prompt). Kesetaraan
keduanya dengan kontrak dijaga oleh tests/test_caption.py.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

L4_CATEGORIES = ("jadwal_pergerakan", "lokasi_penugasan", "politik_praktis", "provokasi", "info_pribadi")


class LlmTextFinding(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    category: Literal["jadwal_pergerakan", "lokasi_penugasan", "politik_praktis", "provokasi", "info_pribadi"]
    severity: Literal["perhatian", "tinggi"]
    evidence_text: str = Field(max_length=200)
    where: Literal["caption", "ocr"]
    explanation: str = Field(max_length=400)


class LlmTextOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    findings: list[LlmTextFinding]


LLM_TEXT_OUTPUT_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": ["findings"],
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["category", "severity", "evidence_text", "where", "explanation"],
                "properties": {
                    "category": {"enum": list(L4_CATEGORIES)},
                    "severity": {"enum": ["perhatian", "tinggi"]},
                    "evidence_text": {"type": "string", "maxLength": 200},
                    "where": {"enum": ["caption", "ocr"]},
                    "explanation": {"type": "string", "maxLength": 400},
                },
            },
        }
    },
}
