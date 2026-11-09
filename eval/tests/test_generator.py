"""Tes kriteria terima T-29 (generator dokumen sintetis).

Render memakai Playwright Chromium (`uv run playwright install chromium`).
Fixture sesi membangkitkan 2 item per template ke direktori sementara; tes
lain membaca hasil itu.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import jsonschema
import pytest

from generator import blacklist
from generator.content import ALL_TEMPLATES, HARD_NEGATIVE_TEMPLATES, POSITIVE_TEMPLATES, build_content
from generator.core import Renderer, generate

EVAL_DIR = Path(__file__).resolve().parents[1]
SCHEMA_PATH = EVAL_DIR / "schemas" / "image-label.schema.json"
GENERATOR_DIR = EVAL_DIR / "generator"

SEED = 2026
COUNT = 2  # per template, cukup untuk mencakup varian tanpa membuat tes lambat


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture(scope="session")
def out_a(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("run_a") / "synthetic"
    generate(out, count_positive=COUNT, count_negative=COUNT, seed=SEED)
    return out


@pytest.fixture(scope="session")
def items(out_a) -> list[dict]:
    labels = sorted(out_a.glob("*.json"))
    assert labels, "generator tidak menghasilkan label"
    return [json.loads(p.read_text(encoding="utf-8")) for p in labels]


def test_counts_and_manifest(out_a, items):
    assert len(items) == COUNT * len(ALL_TEMPLATES)
    manifest = json.loads((out_a.parent / "manifest-synthetic.json").read_text(encoding="utf-8"))
    assert manifest["seed"] == SEED
    assert [i["item_id"] for i in manifest["items"]] == sorted(i["item_id"] for i in items)
    for entry in manifest["items"]:
        for f in entry["files"].values():
            assert _sha256(out_a.parent / f["path"]) == f["sha256"]


def test_deterministic(out_a, tmp_path):
    """Seed sama → PNG dan .gt.txt identik (hash sama)."""
    out_b = tmp_path / "synthetic"
    generate(out_b, count_positive=COUNT, count_negative=COUNT, seed=SEED)
    names_a = sorted(p.name for p in out_a.iterdir())
    names_b = sorted(p.name for p in out_b.iterdir())
    assert names_a == names_b
    pngs = [n for n in names_a if n.endswith(".png") or n.endswith(".gt.txt")]
    assert len(pngs) == 2 * COUNT * len(ALL_TEMPLATES)
    for name in pngs:
        assert _sha256(out_a / name) == _sha256(out_b / name), name
    # Seed berbeda → isi berbeda (generator memang memakai seed).
    with Renderer() as r:
        a = r.render_item("st-a", 1, SEED)
        b = r.render_item("st-a", 1, SEED + 1)
    assert a.gt_text != b.gt_text


def test_label_schema(out_a, items):
    """Setiap <item_id>.json valid terhadap eval/schemas/image-label.schema.json."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    validator = jsonschema.Draft202012Validator(schema)
    root = out_a.parent
    for label in items:
        errors = sorted(validator.iter_errors(label), key=lambda e: list(e.path))
        assert not errors, f"{label['item_id']}: {[e.message for e in errors]}"
        assert label["source"] == "synthetic"
        assert label["group_id"] == label["item_id"]
        assert label["item_id"].startswith(label["template_id"] + "-")
        assert label["augment"] is None
        assert label["legibility"] == "high"
        assert _sha256(root / label["file"]) == label["sha256"]
        gt_lines = (root / label["gt_text_file"]).read_text(encoding="utf-8").splitlines()
        assert [b["text"] for b in label["boxes"]] == gt_lines
        for b in label["boxes"]:
            x, y, w, h = b["box"]
            assert w > 0 and h > 0 and x + w <= 1 and y + h <= 1, (label["item_id"], b)


def test_expected_risk_per_template():
    """Label mengikuti tabel template di kartu T-29 dan pedoman eval-plan §3.3."""
    seen_sb = set()
    for template_id in ALL_TEMPLATES:
        for index in range(1, 41):
            meta = build_content(template_id, index, SEED).meta
            risk, els = meta["expected_risk"], set(meta["doc_elements"])
            if template_id.startswith("st-"):
                assert risk == "tinggi" and {"kop_satuan", "surat_telegram", "blok_alamat"} <= els
            elif template_id.startswith("sb-"):
                assert "kop_satuan" in els
                seen_sb.add(risk)
                assert risk == ("tinggi" if "klasifikasi" in els else "perhatian")
            elif template_id == "kop-only":
                assert risk == "perhatian" and els == {"kop_satuan"}
            elif template_id.startswith("hn-civil-"):
                assert risk == "perhatian" and meta["neg_type"] == "civil_naskah"
                assert "kop_satuan" not in els and "surat_telegram" not in els
            else:
                assert risk == "aman" and els == set()
                assert meta["neg_type"] == ("trap" if template_id == "hn-jebakan" else "everyday")
            assert meta["has_dinas_doc"] == (template_id in POSITIVE_TEMPLATES)
    assert seen_sb == {"tinggi", "perhatian"}


def test_telegram_style_only_st_b_c(items, out_a):
    for label in items:
        if not label["template_id"].startswith("st-"):
            continue
        text = (out_a.parent / label["gt_text_file"]).read_text(encoding="utf-8")
        n = len(re.findall(r"\b(?:TTK|KMA)\b", text))
        if label["template_id"] == "st-a":
            assert n == 0
        else:
            assert n >= 3


def test_redact_boxes(items):
    for label in items:
        sensitive = [b["box"] for b in label["boxes"] if b["sensitive"]]
        if label["has_dinas_doc"]:
            assert label["redact_boxes"] == sensitive and sensitive
            tagged = {b["element"] for b in label["boxes"] if b["element"]}
            assert tagged == set(label["doc_elements"]), label["item_id"]
        else:
            assert label["redact_boxes"] == []


def test_gt_matches_render(items, out_a):
    """Teks .gt.txt sama dengan innerText DOM yang dirender (Playwright)."""
    from playwright.sync_api import sync_playwright

    # HTML final (setelah penyesuaian skala) dibangun ulang dari seed, lalu dirender di
    # browser terpisah yang tidak memakai kode pengumpul baris milik generator.
    with Renderer() as r:
        htmls = {
            lb["item_id"]: r.render_item(lb["template_id"], int(lb["item_id"].rsplit("-", 1)[1]), SEED).html
            for lb in items
        }
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1240, "height": 1754})
        for label in items:
            page.set_content(htmls[label["item_id"]], wait_until="load")
            assert page.evaluate("document.body.dataset.wrapped") == "1"
            inner = page.inner_text("#doc")
            # Spasi dinormalkan (spasi tunggal), sama seperti normalisasi CER (eval-plan §5.3).
            rendered = [" ".join(ln.split()) for ln in inner.split("\n") if ln.strip()]
            gt = (out_a.parent / label["gt_text_file"]).read_text(encoding="utf-8").splitlines()
            assert rendered == gt, label["item_id"]
        browser.close()


def test_no_real_units(items, out_a):
    """Tidak ada nama di daftar_hitam.txt yang muncul di output atau sumber generator."""
    entries = blacklist.load()
    assert len(entries) >= 40
    # Matcher memang bekerja (normalisasi huruf dan tanda baca).
    assert blacklist.find("KOMANDO DAERAH MILITER III/SILIWANGI", entries)
    assert blacklist.find("ST/1221/2021", entries)
    assert not blacklist.find("KOMANDO DISTRIK MILITER 9999/FIKTIF", entries)

    sources = [GENERATOR_DIR / "fiktif.yaml", *sorted((GENERATOR_DIR / "templates").rglob("*.*"))]
    for path in [*sources, *sorted(out_a.glob("*.gt.txt")), *sorted(out_a.glob("*.json"))]:
        hits = blacklist.find(path.read_text(encoding="utf-8"), entries)
        assert not hits, f"{path.name}: {hits}"

    # Nomor satuan selalu dari blok fiktif 99xx/99x (nomor nyata tidak pernah setinggi ini).
    for gt in out_a.glob("*.gt.txt"):
        text = gt.read_text(encoding="utf-8")
        for m in re.finditer(r"\b(?:KODIM|DISTRIK MILITER|DANDIM|KASDIM)\s+(\d{4})", text, re.I):
            assert m.group(1).startswith("99"), (gt.name, m.group(0))
        for m in re.finditer(r"\b(?:KOREM|RESOR MILITER|DANREM|KASREM|INFANTERI|YONIF)\s+(\d{3})\b", text, re.I):
            assert m.group(1).startswith("99"), (gt.name, m.group(0))


def test_watermark_present():
    """Setiap HTML memuat elemen watermark "SINTETIS" (opasitas 10–20 %) dan footer."""
    opacities = set()
    with Renderer() as r:
        for template_id in ALL_TEMPLATES:
            for index in (1, 2, 3):
                html = r.build_html(template_id, index, SEED)
                m = re.search(
                    r'<div class="watermark"[^>]*style="[^"]*opacity:\s*([0-9.]+)[^"]*"[^>]*>SINTETIS</div>', html
                )
                assert m, (template_id, index)
                op = float(m.group(1))
                assert 0.10 <= op <= 0.20
                opacities.add(op)
                assert "DOKUMEN SINTETIS – TILIK" in html
                assert "<img" not in html  # tanpa lambang/gambar; tempat lambang = kotak "LOGO"
    assert len(opacities) > 1  # divariasikan


def test_hard_negative_share_structure(items, out_a):
    """Template hn-civil-* memuat setidaknya dua dari: Sifat, Klasifikasi, Kepada, Tembusan."""
    keys = ("sifat", "klasifikasi", "kepada", "tembusan")

    def count(text: str) -> int:
        return sum(1 for k in keys if re.search(rf"\b{k}\b", text, re.I))

    rendered = [lb for lb in items if lb["template_id"].startswith("hn-civil-")]
    assert rendered
    for label in rendered:
        text = (out_a.parent / label["gt_text_file"]).read_text(encoding="utf-8")
        assert count(text) >= 2, label["item_id"]
    with Renderer() as r:
        for template_id in [t for t in HARD_NEGATIVE_TEMPLATES if t.startswith("hn-civil-")]:
            for index in range(1, 31):
                text = re.sub(r"<[^>]+>", " ", r.build_html(template_id, index, SEED).split("<body", 1)[1])
                assert count(text) >= 2, (template_id, index)
