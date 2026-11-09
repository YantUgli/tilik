"""CLI probe: `uv run python -m scripts.probe [--dry-run] [opsi]` dari services/api.

Keluaran:
- laporan JSON  → `--out` (default scripts/probe/out/probe-report.json, di-.gitignore)
- ringkasan MD  → path yang sama dengan akhiran .md, juga dicetak ke stdout
- log progres   → stderr (tanpa key, tanpa prompt/output model)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from .config import ALL_TESTS, PROVIDERS, ConfigError, load_config
from .mock import make_mock_transport
from .prompt import JSON_MODES
from .redact import Redactor, RedactingFilter
from .runner import render_summary_md, run_probe

DEFAULT_OUT = Path(__file__).resolve().parent / "out" / "probe-report.json"


def _csv(choices: tuple[str, ...]):
    def parse(value: str) -> list[str]:
        items = [v.strip() for v in value.split(",") if v.strip()]
        bad = [v for v in items if v not in choices]
        if bad or not items:
            raise argparse.ArgumentTypeError(f"pilihan: {','.join(choices)}")
        return items
    return parse


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m scripts.probe",
                                description="Probe Fireworks & Groq (teks) untuk docs/quota.md (T-07).")
    p.add_argument("--dry-run", action="store_true",
                   help="pakai respons tiruan; tanpa jaringan dan tanpa key")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"path laporan JSON (default {DEFAULT_OUT})")
    p.add_argument("--providers", type=_csv(tuple(PROVIDERS)), default=list(PROVIDERS),
                   help="mis. groq atau fireworks,groq (default semua)")
    p.add_argument("--tests", type=_csv(ALL_TESTS), default=list(ALL_TESTS),
                   help="mis. P1,P3 (default P1,P3,P4,P5)")
    p.add_argument("--max-tokens", type=int, default=400, help="max_tokens P1/P3 (default 400, NFR-COST-03)")
    p.add_argument("--json-mode-fireworks", choices=JSON_MODES, default=None,
                   help="default json_schema")
    p.add_argument("--json-mode-groq", choices=JSON_MODES, default=None,
                   help="default json_schema_strict untuk model yang didukung, selain itu json_object")
    p.add_argument("--timeout-probe", type=float, default=1.0, help="timeout klien P5 (detik, default 1)")
    p.add_argument("--burst-n", type=int, default=35, help="jumlah request P4 (default 35)")
    p.add_argument("-v", "--verbose", action="store_true", help="log tiap panggilan ke stderr (status, latensi, token)")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        cfg = load_config(
            os.environ,
            providers=args.providers,
            dry_run=args.dry_run,
            max_tokens=args.max_tokens,
            json_modes={"fireworks": args.json_mode_fireworks, "groq": args.json_mode_groq},
            timeout_probe_s=args.timeout_probe,
            burst_n=args.burst_n,
        )
    except ConfigError as exc:
        print(f"probe: {exc}", file=sys.stderr)
        return 2

    redactor = Redactor(cfg.secrets)
    handler = logging.StreamHandler(sys.stderr)
    handler.addFilter(RedactingFilter(redactor))
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%H:%M:%S"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(logging.WARNING)
    log = logging.getLogger("probe")
    log.setLevel(logging.DEBUG if args.verbose else logging.INFO)
    # httpx/httpcore tidak mencatat header, tapi tetap dibisukan supaya log hanya milik probe.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    mode = "DRY-RUN (respons tiruan)" if cfg.dry_run else "NYATA (memakai key evaluasi)"
    log.info("mulai probe %s: providers=%s tests=%s", mode, ",".join(cfg.providers), ",".join(args.tests))

    factory = make_mock_transport if cfg.dry_run else None
    report = run_probe(cfg, tests=args.tests, transport_factory=factory)

    out: Path = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(redactor.scrub(json.dumps(report, indent=2, ensure_ascii=False)) + "\n",
                   encoding="utf-8")
    summary = redactor.scrub(render_summary_md(report))
    summary_path = out.with_suffix(".md")
    summary_path.write_text(summary, encoding="utf-8")

    sys.stdout.write(summary)
    log.info("laporan JSON: %s", out)
    log.info("ringkasan MD: %s", summary_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
