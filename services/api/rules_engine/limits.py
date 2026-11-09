"""Batas input yang dipakai bersama oleh rule engine dan route HTTP (SPEC §5.1).

Route `/analyze/caption` (T-18) memotong `ocr_text` dengan konstanta yang sama,
supaya teks untuk aturan tidak pernah melebihi batas kontrak.
"""

OCR_TEXT_MAX_CHARS = 8000   # ocr_text lebih panjang dipotong (bukan ditolak), note diisi
