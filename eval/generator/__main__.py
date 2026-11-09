"""CLI: uv run python -m generator --count-per-template 12 --count-negative 8 --seed 2026 --out data/synthetic"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .core import generate


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m generator", description=__doc__)
    ap.add_argument("--count-per-template", type=int, default=12, help="jumlah item per template positif")
    ap.add_argument("--count-negative", type=int, default=8, help="jumlah item per template hard negative")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--out", type=Path, required=True, help="direktori output; manifest ditulis ke induknya")
    ap.add_argument("--templates", nargs="*", default=None, help="batasi ke template tertentu")
    args = ap.parse_args(argv)
    manifest = generate(
        args.out,
        count_positive=args.count_per_template,
        count_negative=args.count_negative,
        seed=args.seed,
        templates=args.templates,
        progress=lambda msg: print(msg, file=sys.stderr),
    )
    n = len(manifest["items"])
    pos = sum(1 for i in manifest["items"] if i["has_dinas_doc"])
    print(f"{n} item ({pos} positif, {n - pos} hard negative) → {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
