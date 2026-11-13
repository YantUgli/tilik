"""Output LLM (`LlmTextOutput`) → `Finding` L4 (SPEC §5.4).

Kutipan (`evidence_text`) wajib ada di input setelah normalisasi spasi dan huruf
kecil; bila tidak ada, temuan dibuang (cegah kutipan halusinasi). Bila kutipan
hanya ada di sumber lain, `where` dikoreksi ke sumber itu.
"""

from __future__ import annotations

from app.llm_schema import LlmTextOutput

LLM_MESSAGES = {
    "jadwal_pergerakan": "Tampak ada informasi jadwal atau pergerakan.",
    "lokasi_penugasan": "Tampak ada informasi lokasi penugasan.",
    "politik_praktis": "Tampak ada muatan politik praktis.",
    "provokasi": "Tampak ada muatan yang bisa memprovokasi.",
    "info_pribadi": "Tampak ada data pribadi.",
}


def normalize(text: str) -> str:
    return " ".join(text.split()).lower()


def map_llm_findings(
    output: LlmTextOutput,
    caption: str | None,
    ocr_text: str | None,
    first_index: int,
) -> list[dict]:
    """Temuan kontrak `Finding` dengan id `c-<first_index>`, `c-<first_index+1>`, …"""
    sources = {"caption": normalize(caption or ""), "ocr": normalize(ocr_text or "")}
    findings: list[dict] = []
    for item in output.findings:
        quote = normalize(item.evidence_text)
        if not quote:
            continue
        other = "ocr" if item.where == "caption" else "caption"
        if quote in sources[item.where]:
            where = item.where
        elif quote in sources[other]:
            where = other
        else:
            continue
        findings.append({
            "id": f"c-{first_index + len(findings)}",
            "layer": "L4",
            "category": item.category,
            "severity": item.severity,
            "source": "llm",
            "message": LLM_MESSAGES[item.category],
            "explanation": item.explanation,
            "evidence": {"text": item.evidence_text, "where": where},
            "redactable": False,
            "experimental": False,
        })
    return findings
