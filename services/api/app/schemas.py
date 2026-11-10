"""Model request, diturunkan dari contracts/caption-request.schema.json (baca saja)."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

CAPTION_MAX_CHARS = 2200
OCR_WORDS_MAX = 2000

UnitFloat = Annotated[float, Field(ge=0, le=1)]


class OcrWord(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    text: str = Field(max_length=64)
    conf: float = Field(ge=0, le=100)
    bbox: list[UnitFloat] = Field(min_length=4, max_length=4)


class CaptionRequest(BaseModel):
    """caption, ocr_text, dan ocr_words adalah data tak tepercaya (NFR-SEC-02).

    ocr_text sengaja tanpa batas panjang: > 8.000 karakter dipotong, bukan ditolak (SPEC §5.1).
    """

    model_config = ConfigDict(strict=True)

    caption: str | None = Field(max_length=CAPTION_MAX_CHARS)
    ocr_text: str | None
    ocr_words: list[OcrWord] | None = Field(default=None, max_length=OCR_WORDS_MAX)
    lang: Literal["id"]
