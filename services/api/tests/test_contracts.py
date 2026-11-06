"""Tes kontrak: memastikan isi contracts/ konsisten dan bisa divalidasi.

Konvensi contoh di contracts/examples/:
    <nama>.valid[.<keterangan>].json    -> harus lolos <nama>.schema.json
    <nama>.invalid.<alasan>.json        -> harus ditolak <nama>.schema.json
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from urllib.parse import urldefrag

import pytest
import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

CONTRACTS = Path(__file__).resolve().parents[3] / "contracts"
EXAMPLES = CONTRACTS / "examples"
SCHEMA_FILES = sorted(CONTRACTS.glob("*.schema.json"))

EXPECTED_SCHEMAS = {
    "finding",
    "layer-result",
    "analysis-result",
    "caption-response",
    "visual-response",
    "error",
    "health",
    "llm-text-output",
    "llm-visual-output",
    "rule",
}


def _load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def _registry() -> Registry:
    resources = [
        (path.name, Resource.from_contents(_load_json(path), default_specification=DRAFT202012))
        for path in SCHEMA_FILES
    ]
    return Registry().with_resources(resources)


REGISTRY = _registry()


def validator(name: str) -> Draft202012Validator:
    schema = _load_json(CONTRACTS / f"{name}.schema.json")
    return Draft202012Validator(schema, registry=REGISTRY)


def is_valid(name: str, instance: object) -> bool:
    return validator(name).is_valid(instance)


def _schema_name(example: Path) -> str:
    for marker in (".valid", ".invalid"):
        if marker in example.name:
            return example.name.split(marker, 1)[0]
    raise AssertionError(f"nama contoh tidak mengikuti konvensi: {example.name}")


VALID_EXAMPLES = sorted(EXAMPLES.glob("*.valid*.json"))
INVALID_EXAMPLES = sorted(EXAMPLES.glob("*.invalid*.json"))


def _ids(paths: list[Path]) -> list[str]:
    return [p.name for p in paths]


# --- Struktur dasar ---------------------------------------------------------


def test_all_expected_schemas_exist() -> None:
    present = {p.name.removesuffix(".schema.json") for p in SCHEMA_FILES}
    assert present == EXPECTED_SCHEMAS


@pytest.mark.parametrize("path", SCHEMA_FILES, ids=_ids(SCHEMA_FILES))
def test_schema_is_valid_draft_2020_12(path: Path) -> None:
    schema = _load_json(path)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["$id"] == path.name
    Draft202012Validator.check_schema(schema)


def test_every_schema_has_valid_and_invalid_example() -> None:
    with_valid = {_schema_name(p) for p in VALID_EXAMPLES}
    with_invalid = {_schema_name(p) for p in INVALID_EXAMPLES}
    assert EXPECTED_SCHEMAS <= with_valid, EXPECTED_SCHEMAS - with_valid
    assert EXPECTED_SCHEMAS <= with_invalid, EXPECTED_SCHEMAS - with_invalid


# --- Kriteria terima T-02 ---------------------------------------------------


@pytest.mark.parametrize("path", VALID_EXAMPLES, ids=_ids(VALID_EXAMPLES))
def test_examples_valid(path: Path) -> None:
    v = validator(_schema_name(path))
    errors = [e.message for e in v.iter_errors(_load_json(path))]
    assert errors == []


@pytest.mark.parametrize("path", INVALID_EXAMPLES, ids=_ids(INVALID_EXAMPLES))
def test_examples_invalid(path: Path) -> None:
    assert not is_valid(_schema_name(path), _load_json(path))


def _collect_refs(node: object) -> list[str]:
    refs: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "$ref" and isinstance(value, str):
                refs.append(value)
            else:
                refs.extend(_collect_refs(value))
    elif isinstance(node, list):
        for item in node:
            refs.extend(_collect_refs(item))
    return refs


def _resolve_pointer(doc: object, pointer: str) -> object:
    node = doc
    for raw in pointer.lstrip("/").split("/") if pointer else []:
        part = raw.replace("~1", "/").replace("~0", "~")
        node = node[int(part)] if isinstance(node, list) else node[part]
    return node


def test_openapi_refs_resolve() -> None:
    openapi_path = CONTRACTS / "openapi.yaml"
    doc = yaml.safe_load(openapi_path.read_text(encoding="utf-8"))
    assert str(doc["openapi"]).startswith("3.1")
    assert {"/analyze/caption", "/analyze/visual", "/health"} <= set(doc["paths"])

    refs = _collect_refs(doc)
    assert refs, "openapi.yaml tidak punya $ref"
    for ref in refs:
        target, fragment = urldefrag(ref)
        if target:
            path = (openapi_path.parent / target).resolve()
            assert path.is_file(), f"$ref menunjuk file yang tidak ada: {ref}"
            target_doc = _load_json(path) if path.suffix == ".json" else yaml.safe_load(path.read_text())
        else:
            target_doc = doc
        try:
            _resolve_pointer(target_doc, fragment)
        except (KeyError, IndexError, ValueError) as exc:
            raise AssertionError(f"$ref tidak bisa di-resolve: {ref}") from exc


def test_openapi_error_statuses() -> None:
    doc = yaml.safe_load((CONTRACTS / "openapi.yaml").read_text(encoding="utf-8"))
    for path in ("/analyze/caption", "/analyze/visual"):
        statuses = set(doc["paths"][path]["post"]["responses"])
        assert {"200", "400", "429", "500", "503"} <= statuses, path


def test_schemas_refs_resolve() -> None:
    for path in SCHEMA_FILES:
        resolver = REGISTRY.resolver(base_uri=path.name)
        for ref in _collect_refs(_load_json(path)):
            resolver.lookup(ref)  # melempar exception bila tidak ada


def _valid_rule() -> dict:
    return copy.deepcopy(_load_json(EXAMPLES / "rule.valid.json"))


def test_rule_requires_tests() -> None:
    rule = _valid_rule()
    assert is_valid("rule", rule)

    no_negative = _valid_rule()
    del no_negative["tests"]["negative"]
    assert not is_valid("rule", no_negative)

    empty_negative = _valid_rule()
    empty_negative["tests"]["negative"] = []
    assert not is_valid("rule", empty_negative)

    empty_positive = _valid_rule()
    empty_positive["tests"]["positive"] = []
    assert not is_valid("rule", empty_positive)

    no_tests = _valid_rule()
    del no_tests["tests"]
    assert not is_valid("rule", no_tests)


def test_rule_yaml_form_valid() -> None:
    """Aturan yang ditulis sebagai YAML (bentuk di rules/*.yaml) lolos skema yang sama."""
    text = r"""
- id: R-L3-002
  layer: L3
  category: klasifikasi
  severity: perhatian
  applies_to: [ocr]
  match:
    any_regex:
      - '\b(SANGAT\s+RAHASIA|RAHASIA|TERBATAS|KONFIDENSIAL)\b'
    require_context:
      - '\b(KLASIFIKASI|NOMOR|NO\.|KEPADA|DARI|TEMBUSAN|PERIHAL|DERAJAT)\b'
    negative_context:
      - '(?i)resep|rahasia (umum|dapur|sukses)|edisi terbatas'
  redact: matched_words
  message: "Tampak ada tanda klasifikasi dokumen."
  tests:
    positive: ["KLASIFIKASI : RAHASIA\nNOMOR : ST/123/2026"]
    negative: ["resep rahasia ayam goreng", "EDISI TERBATAS"]
"""
    (rule,) = yaml.safe_load(text)
    assert is_valid("rule", rule)  # signal boleh tidak ada (default generic)


@pytest.mark.parametrize(
    ("rule_id", "ok"),
    [("R-L3-001", True), ("R-L4-010", True), ("R-PII-001", True),
     ("R-X-1", False), ("R-L2-001", False), ("R-L3-01", False), ("r-l3-001", False)],
)
def test_rule_id_pattern(rule_id: str, ok: bool) -> None:
    rule = _valid_rule()
    rule["id"] = rule_id
    assert is_valid("rule", rule) is ok


@pytest.mark.parametrize(("signal", "ok"), [("specific", True), ("generic", True), ("kuat", False)])
def test_rule_signal_enum(signal: str, ok: bool) -> None:
    rule = _valid_rule()
    rule["signal"] = signal
    assert is_valid("rule", rule) is ok


def _valid_finding() -> dict:
    return copy.deepcopy(_load_json(EXAMPLES / "finding.valid.json"))


def test_finding_rule_ref_pattern() -> None:
    finding = _valid_finding()
    finding["rule_ref"] = "R-L3-001"
    assert is_valid("finding", finding)

    finding["rule_ref"] = "R-X-1"
    assert not is_valid("finding", finding)


@pytest.mark.parametrize(
    ("finding_id", "ok"),
    [("b-1", True), ("c-3", True), ("v-12", True),
     ("f-1", False), ("c-", False), ("c3", False), ("C-1", False), ("c-1a", False)],
)
def test_finding_id_prefix(finding_id: str, ok: bool) -> None:
    finding = _valid_finding()
    finding["id"] = finding_id
    assert is_valid("finding", finding) is ok
    assert not is_valid("finding", _load_json(EXAMPLES / "finding.invalid.bad-id-prefix.json"))


def test_finding_accepts_derajat_category() -> None:
    finding = _valid_finding()
    finding["category"] = "derajat"
    assert is_valid("finding", finding)


def test_caption_response_two_l4_layers() -> None:
    response = _load_json(EXAMPLES / "caption-response.valid.l4-llm-error.json")
    assert is_valid("caption-response", response)

    l3, l4_rule, l4_llm = response["layers"]
    assert (l3["layer"], l3["provider"]) == ("L3", "rule")
    assert (l4_rule["layer"], l4_rule["provider"], l4_rule["status"]) == ("L4", "rule", "ok")
    assert l4_rule["findings"], "contoh harus menunjukkan temuan aturan tetap ada"
    assert (l4_llm["layer"], l4_llm["status"]) == ("L4", "error")


def test_caption_response_layer_order_enforced() -> None:
    response = _load_json(EXAMPLES / "caption-response.valid.l4-llm-error.json")

    swapped = copy.deepcopy(response)
    swapped["layers"][0], swapped["layers"][1] = swapped["layers"][1], swapped["layers"][0]
    assert not is_valid("caption-response", swapped)

    llm_as_rule = copy.deepcopy(response)
    llm_as_rule["layers"][2]["provider"] = "rule"
    assert not is_valid("caption-response", llm_as_rule)

    too_many = copy.deepcopy(response)
    too_many["layers"].append(copy.deepcopy(response["layers"][2]))
    assert not is_valid("caption-response", too_many)


def test_analysis_result_top_reasons_use_finding_id_pattern() -> None:
    result = _load_json(EXAMPLES / "analysis-result.valid.json")
    result["risk"]["top_reasons"] = ["f-1"]
    assert not is_valid("analysis-result", result)
