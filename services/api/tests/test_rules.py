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
