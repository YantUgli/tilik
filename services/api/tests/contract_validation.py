"""Validator JSON Schema untuk kontrak di contracts/ (dipakai tes endpoint)."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

CONTRACTS = Path(__file__).resolve().parents[3] / "contracts"
EXAMPLES = CONTRACTS / "examples"


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


@cache
def _registry() -> Registry:
    return Registry().with_resources(
        (p.name, Resource.from_contents(load_json(p), default_specification=DRAFT202012))
        for p in sorted(CONTRACTS.glob("*.schema.json"))
    )


@cache
def validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_json(CONTRACTS / f"{name}.schema.json"), registry=_registry())


def errors(name: str, instance: object) -> list[str]:
    """Daftar pesan pelanggaran skema; kosong berarti valid."""
    return [f"{list(e.absolute_path)}: {e.message}" for e in validator(name).iter_errors(instance)]
