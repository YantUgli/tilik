"""Runner tes per aturan, berparameter dari services/api/rules/*.yaml (SPEC §8).

Setiap contoh `tests.positive` harus menyala dan setiap `tests.negative` tidak menyala.
Contoh diuji per aturan (sebelum penggabungan sinyal L3), sehingga satu aturan tidak
bergantung pada aturan lain.
"""

from __future__ import annotations

import pytest

from rules_engine import load_rules, match_rule

RULES = load_rules()

CASES = [
    pytest.param(rule, kind, example, id=f"{rule.id}-{kind}-{i}")
    for rule in RULES
    for kind in ("positive", "negative")
    for i, example in enumerate(getattr(rule.tests, kind))
]


def test_rule_set_not_empty():
    assert RULES


@pytest.mark.parametrize(("rule", "kind", "example"), CASES)
def test_rule_example(rule, kind, example):
    # Semantik pencocokan sama untuk caption dan ocr; cukup diuji sekali.
    spans = match_rule(rule, example)
    if kind == "positive":
        assert spans, f"{rule.id} tidak menyala untuk: {example!r}"
    else:
        assert not spans, f"{rule.id} menyala untuk contoh negatif: {example!r} → {spans}"


# ---------------------------------------------------------------------------
# Rule set v1 (T-17)
# ---------------------------------------------------------------------------

from rules_engine import RuleEngine, RuleInput  # noqa: E402

ENGINE = RuleEngine(RULES)
L3_IDS = [f"R-L3-{n:03d}" for n in range(1, 9)]
L4_IDS = [f"R-L4-{n:03d}" for n in range(1, 8)]
RANK = {"info": 0, "perhatian": 1, "tinggi": 2}

# Surat Telegram sintetis lengkap: kop + judul + nomor + klasifikasi. Semua fiktif.
ST_LENGKAP = """\
KOMANDO DAERAH MILITER IX/CONTOH
KOMANDO DISTRIK MILITER 9999/FIKTIF

SURAT TELEGRAM
NOMOR : R/ST/123/2026
KLASIFIKASI : RAHASIA
DERAJAT : KILAT
DARI : DANDIM 9999/FIKTIF
KEPADA : DANRAMIL 9999-01/CONTOH
TEMBUSAN : KASDIM 9999/FIKTIF
SESUAI REF DI ATAS KMA DISAMPAIKAN BAHWA TTK
DUA KMA LAKSANAKAN TTK
"""

# Surat kampus fiktif: struktur naskah dinas sipil, tanpa kop militer.
SURAT_KAMPUS = """\
UNIVERSITAS CONTOH NUSANTARA
FAKULTAS ILMU FIKTIF
NOMOR : 123/UN99/TU/2026
KLASIFIKASI : TERBATAS
DERAJAT : SEGERA
PERIHAL : UNDANGAN RAPAT
KEPADA : DEKAN FAKULTAS ILMU FIKTIF
DARI : KETUA PANITIA
TEMBUSAN : REKTOR UNIVERSITAS CONTOH NUSANTARA
"""


def test_rule_set_v1_complete():
    ids = sorted(r.id for r in RULES)
    assert ids == L3_IDS + L4_IDS


@pytest.mark.parametrize("rule", RULES, ids=lambda r: r.id)
def test_rule_has_two_examples_each(rule):
    assert len(rule.tests.positive) >= 2, rule.id
    assert len(rule.tests.negative) >= 2, rule.id


@pytest.mark.parametrize("rule", RULES, ids=lambda r: r.id)
def test_rule_metadata(rule):
    assert rule.severity == "perhatian"
    assert rule.explanation and rule.message
    if rule.layer == "L3":
        assert rule.applies_to == ("ocr",)
        assert rule.basis
    else:
        assert set(rule.applies_to) == {"caption", "ocr"}


def test_st_lengkap_semua_l3_tinggi():
    found = ENGINE.run(RuleInput(caption=None, ocr_text=ST_LENGKAP, ocr_words=None))
    l3 = [f for f in found if f["layer"] == "L3"]
    assert {f["rule_ref"] for f in l3} == set(L3_IDS)
    assert {f["severity"] for f in l3} == {"tinggi"}


def test_surat_kampus_maksimal_perhatian():
    found = ENGINE.run(RuleInput(caption=None, ocr_text=SURAT_KAMPUS, ocr_words=None))
    refs = {f["rule_ref"] for f in found}
    assert {"R-L3-002", "R-L3-006", "R-L3-007"} <= refs
    assert max(RANK[f["severity"]] for f in found) == RANK["perhatian"]


def test_l3_tidak_menyala_di_caption():
    found = ENGINE.run(RuleInput(caption=ST_LENGKAP, ocr_text=None, ocr_words=None))
    assert not [f for f in found if f["layer"] == "L3"]


def test_kata_lepas_tidak_mematikan_aturan():
    """Kata penyusun negative_context di tempat lain tidak mematikan temuan asli."""
    text = ST_LENGKAP + "CATATAN : RESEP, PROMO, DISKON, GRUP, APLIKASI, EDISI\n"
    found = ENGINE.run(RuleInput(caption=None, ocr_text=text, ocr_words=None))
    assert {f["rule_ref"] for f in found if f["layer"] == "L3"} == set(L3_IDS)

    caption = "Satgas Yonif 999/Contoh berangkat besok dari pelabuhan. Adik ke sekolah, mama ke kantor"
    found = ENGINE.run(RuleInput(caption=caption, ocr_text=None, ocr_words=None))
    assert "R-L4-001" in {f["rule_ref"] for f in found}
