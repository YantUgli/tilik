"""Kebijakan penggabungan sinyal L3 (FR-L3-05, data-model R8, keputusan U-1).

Dipisah dari matcher supaya bisa disetel di T-36 tanpa menyentuh pencocokan.
"""

from __future__ import annotations

from dataclasses import replace

from .models import RawFinding

L3_CAP = "perhatian"
L3_COMBINED = "tinggi"
_RANK = {"info": 0, "perhatian": 1, "tinggi": 2}


def combine_l3(findings: list[RawFinding]) -> list[RawFinding]:
    """Menyesuaikan severity temuan L3; temuan layer lain dikembalikan apa adanya.

    - Ada >= 1 temuan L3 `specific` dan temuan L3 berasal dari >= 2 aturan berbeda
      → semua temuan L3 menjadi `tinggi`.
    - Selain itu, setiap temuan L3 tetap pada severity aturannya, maksimal `perhatian`.

    Tidak mengubah list masukan; urutan dipertahankan.
    """
    l3 = [f for f in findings if f.layer == "L3"]
    has_specific = any(f.signal == "specific" for f in l3)
    distinct_rules = {f.rule_ref for f in l3}
    escalate = has_specific and len(distinct_rules) >= 2

    out: list[RawFinding] = []
    for f in findings:
        if f.layer != "L3":
            out.append(f)
        elif escalate:
            out.append(replace(f, severity=L3_COMBINED))
        elif _RANK[f.severity] > _RANK[L3_CAP]:
            out.append(replace(f, severity=L3_CAP))
        else:
            out.append(f)
    return out
