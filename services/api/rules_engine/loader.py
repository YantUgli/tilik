"""Memuat dan memvalidasi rule YAML (contracts/rule.schema.json, SPEC §5.5).

Validasi dilakukan di sini tanpa jsonschema supaya runtime tidak bergantung pada
folder contracts/ di image deploy. Aturannya mengikuti rule.schema.json, ditambah
pemeriksaan yang lebih ketat (prefiks id sesuai layer, kategori sesuai layer).
Kesesuaian dengan kontrak dijaga oleh tes (test_default_rules_valid_against_contract,
test_engine_enums_match_contract).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from .models import Rule, RuleTests

DEFAULT_RULES_DIR = Path(__file__).resolve().parent.parent / "rules"

LAYERS = ("L3", "L4", "PII")
SEVERITIES = ("info", "perhatian", "tinggi")
SIGNALS = ("specific", "generic")
SOURCES = ("caption", "ocr")
REDACT_MODES = ("matched_words",)

# Kategori yang boleh dipakai aturan per layer (data-model §3.6, K-2, K-3).
# `kemungkinan_dokumen` hanya dibuat browser; `wajah` hanya dari detektor wajah.
CATEGORIES_BY_LAYER: dict[str, frozenset[str]] = {
    "L3": frozenset({"kop_satuan", "klasifikasi", "derajat", "surat_telegram", "blok_alamat"}),
    "L4": frozenset({"jadwal_pergerakan", "lokasi_penugasan", "politik_praktis", "provokasi", "info_pribadi"}),
    "PII": frozenset({"plat", "nomor_rumah"}),
}

RULE_KEYS = frozenset({
    "id", "layer", "category", "severity", "signal", "applies_to", "match",
    "redact", "message", "explanation", "basis", "tests",
})
REQUIRED_KEYS = ("id", "layer", "category", "severity", "applies_to", "match", "message", "tests")
MATCH_KEYS = frozenset({"any_regex", "require_context", "negative_context"})
ID_PATTERN = re.compile(r"^R-(L3|L4|PII)-\d{3}$")


class RuleLoadError(ValueError):
    """Aturan tidak valid. Pesan selalu memuat nama file dan id aturan (bila ada)."""


def load_rules(rules_dir: Path | str | None = None) -> list[Rule]:
    """Memuat semua `*.yaml` di `rules_dir` (default: services/api/rules/), urut nama file."""
    directory = Path(rules_dir) if rules_dir is not None else DEFAULT_RULES_DIR
    if not directory.is_dir():
        raise RuleLoadError(f"folder aturan tidak ditemukan: {directory}")

    rules: list[Rule] = []
    seen: dict[str, str] = {}
    for path in sorted(directory.glob("*.yaml")):
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            raise RuleLoadError(f"{path.name}: YAML tidak valid: {exc}") from exc
        if data is None:
            continue
        if not isinstance(data, list):
            raise RuleLoadError(f"{path.name}: isi file harus berupa daftar aturan")
        for index, raw in enumerate(data):
            rule = _parse_rule(raw, path.name, index)
            if rule.id in seen:
                raise RuleLoadError(f"{path.name} [{rule.id}]: id duplikat (sudah ada di {seen[rule.id]})")
            seen[rule.id] = path.name
            rules.append(rule)
    return rules


def _parse_rule(raw: Any, file_name: str, index: int) -> Rule:
    rule_id = raw.get("id") if isinstance(raw, dict) else None
    label = f"{file_name} [{rule_id if isinstance(rule_id, str) else f'#{index}'}]"

    def fail(message: str) -> RuleLoadError:
        return RuleLoadError(f"{label}: {message}")

    if not isinstance(raw, dict):
        raise fail("aturan harus berupa mapping")

    unknown = set(raw) - RULE_KEYS
    if unknown:
        raise fail(f"kunci tidak dikenal: {sorted(unknown)}")
    missing = [k for k in REQUIRED_KEYS if k not in raw]
    if missing:
        raise fail(f"kunci wajib tidak ada: {missing}")

    if not isinstance(rule_id, str) or not ID_PATTERN.match(rule_id):
        raise fail("id harus berpola R-(L3|L4|PII)-NNN")

    layer = raw["layer"]
    if layer not in LAYERS:
        raise fail(f"layer tidak dikenal: {layer!r}")
    if rule_id.split("-")[1] != layer:
        raise fail(f"prefiks id tidak sesuai layer {layer}")

    category = raw["category"]
    if category not in CATEGORIES_BY_LAYER[layer]:
        raise fail(f"kategori {category!r} tidak boleh dipakai aturan {layer}")

    severity = raw["severity"]
    if severity not in SEVERITIES:
        raise fail(f"severity tidak dikenal: {severity!r}")

    signal = raw.get("signal", "generic")
    if signal not in SIGNALS:
        raise fail(f"signal tidak dikenal: {signal!r}")

    applies_to = raw["applies_to"]
    if (
        not isinstance(applies_to, list)
        or not applies_to
        or len(set(applies_to)) != len(applies_to)
        or any(s not in SOURCES for s in applies_to)
    ):
        raise fail("applies_to harus daftar unik berisi 'caption' dan/atau 'ocr'")

    redact = raw.get("redact")
    if redact is not None and redact not in REDACT_MODES:
        raise fail(f"redact tidak dikenal: {redact!r}")

    match = raw["match"]
    if not isinstance(match, dict):
        raise fail("match harus berupa mapping")
    unknown = set(match) - MATCH_KEYS
    if unknown:
        raise fail(f"kunci match tidak dikenal: {sorted(unknown)}")
    if "any_regex" not in match:
        raise fail("match.any_regex wajib ada")
    any_regex = _compile_list(match["any_regex"], "match.any_regex", fail, min_items=1)
    require_context = _compile_list(match.get("require_context", []), "match.require_context", fail)
    negative_context = _compile_list(match.get("negative_context", []), "match.negative_context", fail)

    message = raw["message"]
    if not isinstance(message, str) or not message.strip():
        raise fail("message harus string tidak kosong")
    explanation = _optional_str(raw, "explanation", fail)
    basis = _optional_str(raw, "basis", fail)

    tests = raw["tests"]
    if not isinstance(tests, dict):
        raise fail("tests harus berupa mapping dengan positive dan negative")
    positive = _str_list(tests.get("positive"), "tests.positive", fail)
    negative = _str_list(tests.get("negative"), "tests.negative", fail)

    return Rule(
        id=rule_id,
        layer=layer,
        category=category,
        severity=severity,
        signal=signal,
        applies_to=tuple(applies_to),
        any_regex=any_regex,
        require_context=require_context,
        negative_context=negative_context,
        redact=redact,
        message=message,
        explanation=explanation,
        basis=basis,
        tests=RuleTests(positive=positive, negative=negative),
        source_file=file_name,
    )


def _compile_list(value: Any, field: str, fail, min_items: int = 0) -> tuple[re.Pattern[str], ...]:
    if not isinstance(value, list) or len(value) < min_items:
        raise fail(f"{field} harus daftar regex (minimal {min_items})")
    compiled = []
    for pattern in value:
        if not isinstance(pattern, str) or not pattern:
            raise fail(f"{field} berisi nilai yang bukan regex string")
        try:
            compiled.append(re.compile(pattern, re.MULTILINE))
        except re.error as exc:
            raise fail(f"{field}: regex tidak valid {pattern!r}: {exc}") from exc
    return tuple(compiled)


def _str_list(value: Any, field: str, fail) -> tuple[str, ...]:
    if not isinstance(value, list) or not value or any(not isinstance(v, str) or not v for v in value):
        raise fail(f"{field} wajib berisi minimal satu contoh teks")
    return tuple(value)


def _optional_str(raw: dict, key: str, fail) -> str | None:
    value = raw.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise fail(f"{key} harus string")
    return value
