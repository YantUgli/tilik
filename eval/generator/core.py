"""Render dokumen sintetis: Jinja2 HTML → Chromium (Playwright) → PNG + GT + label.

Satu item = satu dokumen A4 pada 150 dpi (1240 x 1754 px). Teks ground truth dan
`boxes` diambil dari DOM yang dirender (setiap baris = satu elemen `.ln`), sehingga
cocok persis dengan yang tampak di gambar.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from dataclasses import dataclass
from importlib.metadata import version as pkg_version
from pathlib import Path
from typing import Any, Callable

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from .content import ALL_TEMPLATES, FONTS, POSITIVE_TEMPLATES, Content, build_content

PAGE_W, PAGE_H, DPI = 1240, 1754, 150
GENERATOR_VERSION = "1.0"
TEMPLATE_DIR = Path(__file__).with_name("templates")
MANIFEST_NAME = "manifest-synthetic.json"
# Font yang dipakai template di luar FONTS (logo, stempel, footer, watermark).
EXTRA_FONTS = ("Liberation Sans",)

_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=True,
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

# Ambil setiap baris .ln: teks, bbox teks (Range), bbox wadah, tinggi baris, dan
# apakah baris itu berposisi tetap di bawah halaman (footer, stempel bawah).
_COLLECT_JS = """
() => {
  const out = [];
  for (const el of document.querySelectorAll('#doc .ln')) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.35;
    out.push({
      text: el.textContent,
      x: b.left, y: b.top, w: b.width, h: b.height,
      cl: c.left, cr: c.right,
      lh: lh,
      role: el.dataset.role || 'body',
      el: el.dataset.el || null,
      s: el.dataset.s === '1',
      fixed: !!el.closest('.footer, .stamp-wrap.bottom'),
      nested: !!el.parentElement.closest('.ln'),
    });
  }
  return out;
}
"""


def font_paths() -> dict[str, str]:
    """Path file font per keluarga (via fontconfig). Gagal keras bila font tidak terpasang."""
    families = sorted({f for fams in FONTS.values() for f in fams} | set(EXTRA_FONTS))
    if not shutil.which("fc-match"):
        raise RuntimeError("fc-match (fontconfig) tidak ditemukan; pasang fonts-liberation dan fonts-dejavu-core")
    out = {}
    for fam in families:
        res = subprocess.run(["fc-match", "-f", "%{family}\t%{file}", fam], capture_output=True, text=True, check=True)
        got, path = res.stdout.split("\t", 1)
        if fam not in [g.strip() for g in got.split(",")]:
            raise RuntimeError(f"font '{fam}' tidak terpasang (fontconfig memberi '{got}'); pasang fonts-liberation / fonts-dejavu-core")
        out[fam] = path
    return out


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def norm_line(s: str) -> str:
    return " ".join(s.split())


def item_id_for(template_id: str, index: int) -> str:
    return f"{template_id}-{index:04d}"


def html_for(content: Content, item_id: str, scale: float = 1.0) -> str:
    tpl = _env.get_template(f"{content.layout}.html.j2")
    return tpl.render(**content.ctx, layout=content.layout, item_id=item_id, scale=scale)


def _layout_problems(lines: list[dict]) -> list[str]:
    probs = []
    fixed_top = min((ln["y"] for ln in lines if ln["fixed"]), default=PAGE_H)
    for ln in lines:
        t = norm_line(ln["text"])
        if not t:
            probs.append(f"baris kosong (role={ln['role']})")
            continue
        if ln["nested"]:
            probs.append(f"baris bersarang: {t[:30]}")
        if ln["w"] <= 0 or ln["h"] <= 0:
            probs.append(f"bbox kosong: {t[:30]}")
        if ln["x"] < 20 or ln["x"] + ln["w"] > PAGE_W - 20:
            probs.append(f"keluar halaman (horizontal): {t[:30]}")
        if ln["x"] + ln["w"] > ln["cr"] + 1.5 or ln["x"] < ln["cl"] - 1.5:
            probs.append(f"meluap dari kolom: {t[:30]}")
        if ln["h"] > ln["lh"] * 1.8:
            probs.append(f"baris terlipat: {t[:30]}")
        if not ln["fixed"] and ln["y"] + ln["h"] > min(fixed_top - 6, PAGE_H - 90):
            probs.append(f"keluar halaman (vertikal): {t[:30]}")
    return probs


@dataclass
class RenderedItem:
    item_id: str
    template_id: str
    content: Content
    html: str
    png: bytes
    lines: list[dict]
    scale: float

    @property
    def gt_lines(self) -> list[str]:
        return [norm_line(ln["text"]) for ln in self.lines]

    @property
    def gt_text(self) -> str:
        return "\n".join(self.gt_lines) + "\n"


class Renderer:
    """Satu proses Chromium untuk banyak item. Pakai sebagai context manager."""

    def __init__(self) -> None:
        self._pw = None
        self._browser = None
        self._context = None

    def __enter__(self) -> "Renderer":
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            args=["--disable-lcd-text", "--force-color-profile=srgb", "--font-render-hinting=none"]
        )
        self._context = self._browser.new_context(
            viewport={"width": PAGE_W, "height": PAGE_H}, device_scale_factor=1, locale="id-ID"
        )
        return self

    def __exit__(self, *exc: Any) -> None:
        if self._context:
            self._context.close()
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()

    @property
    def browser_version(self) -> str:
        return self._browser.version if self._browser else ""

    @staticmethod
    def build_html(template_id: str, index: int, seed: int, scale: float = 1.0) -> str:
        return html_for(build_content(template_id, index, seed), item_id_for(template_id, index), scale)

    def render_item(self, template_id: str, index: int, seed: int) -> RenderedItem:
        content = build_content(template_id, index, seed)
        item_id = item_id_for(template_id, index)
        scale = 1.0
        last: list[str] = []
        for _ in range(12):
            html = html_for(content, item_id, scale)
            page = self._context.new_page()
            try:
                page.set_content(html, wait_until="load")
                if page.evaluate("document.body.dataset.wrapped") != "1":
                    raise RuntimeError(f"{item_id}: skrip pemecah baris tidak jalan")
                lines = page.evaluate(_COLLECT_JS)
                last = _layout_problems(lines)
                if not last:
                    png = page.screenshot(type="png", animations="disabled", caret="hide")
                    return RenderedItem(item_id, template_id, content, html, png, lines, scale)
            finally:
                page.close()
            scale = round(scale * 0.94, 4)
        raise RuntimeError(f"{item_id}: tata letak tidak muat setelah dikecilkan: {last[:5]}")


def _relbox(ln: dict) -> list[float]:
    x0 = min(max(ln["x"] / PAGE_W, 0.0), 1.0)
    y0 = min(max(ln["y"] / PAGE_H, 0.0), 1.0)
    x1 = min(max((ln["x"] + ln["w"]) / PAGE_W, 0.0), 1.0)
    y1 = min(max((ln["y"] + ln["h"]) / PAGE_H, 0.0), 1.0)
    return [round(x0, 5), round(y0, 5), round(x1 - x0, 5), round(y1 - y0, 5)]


def make_label(item: RenderedItem, rel_dir: str) -> dict:
    meta = item.content.meta
    boxes = [
        {
            "text": norm_line(ln["text"]),
            "box": _relbox(ln),
            "role": ln["role"],
            "element": ln["el"],
            "sensitive": bool(ln["s"]),
        }
        for ln in item.lines
    ]
    tagged = {b["element"] for b in boxes if b["element"]}
    if tagged != set(meta["doc_elements"]):
        raise RuntimeError(f"{item.item_id}: doc_elements {meta['doc_elements']} ≠ elemen di DOM {sorted(tagged)}")
    redact = [b["box"] for b in boxes if b["sensitive"]] if meta["has_dinas_doc"] else []
    return {
        "item_id": item.item_id,
        "file": f"{rel_dir}/{item.item_id}.png",
        "sha256": sha256_bytes(item.png),
        "group_id": item.item_id,
        "source": "synthetic",
        "template_id": item.template_id,
        "has_dinas_doc": meta["has_dinas_doc"],
        "doc_elements": meta["doc_elements"],
        "neg_type": meta["neg_type"],
        "expected_risk": meta["expected_risk"],
        "legibility": "high",
        "gt_text_file": f"{rel_dir}/{item.item_id}.gt.txt",
        "redact_boxes": redact,
        "augment": None,
        "notes": meta["notes"] + (f"; skala font {item.scale}" if item.scale != 1.0 else ""),
        "boxes": boxes,
    }


def _clean(out_dir: Path) -> None:
    for p in out_dir.iterdir():
        if p.is_file() and any(p.name.startswith(t + "-") for t in ALL_TEMPLATES) and p.suffix in (".png", ".txt", ".json"):
            p.unlink()


def generate(
    out_dir: Path,
    count_positive: int,
    count_negative: int,
    seed: int,
    templates: list[str] | None = None,
    progress: Callable[[str], None] | None = None,
) -> dict:
    """Bangkitkan semua item ke `out_dir`; manifest ditulis ke `out_dir.parent`."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    _clean(out_dir)
    fonts = font_paths()
    selected = list(templates) if templates else list(ALL_TEMPLATES)
    unknown = set(selected) - set(ALL_TEMPLATES)
    if unknown:
        raise KeyError(f"template tidak dikenal: {sorted(unknown)}")
    rel_dir = out_dir.name
    items = []
    with Renderer() as r:
        for template_id in selected:
            n = count_positive if template_id in POSITIVE_TEMPLATES else count_negative
            for index in range(1, n + 1):
                item = r.render_item(template_id, index, seed)
                label = make_label(item, rel_dir)
                png_p = out_dir / f"{item.item_id}.png"
                gt_p = out_dir / f"{item.item_id}.gt.txt"
                lb_p = out_dir / f"{item.item_id}.json"
                png_p.write_bytes(item.png)
                gt_p.write_text(item.gt_text, encoding="utf-8")
                label_bytes = (json.dumps(label, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
                lb_p.write_bytes(label_bytes)
                items.append(
                    {
                        "item_id": item.item_id,
                        "template_id": template_id,
                        "group_id": label["group_id"],
                        "has_dinas_doc": label["has_dinas_doc"],
                        "neg_type": label["neg_type"],
                        "expected_risk": label["expected_risk"],
                        "files": {
                            "png": {"path": label["file"], "sha256": label["sha256"]},
                            "gt": {"path": label["gt_text_file"], "sha256": sha256_bytes(item.gt_text.encode("utf-8"))},
                            "label": {"path": f"{rel_dir}/{lb_p.name}", "sha256": sha256_bytes(label_bytes)},
                        },
                    }
                )
                if progress:
                    progress(f"{item.item_id}  {label['expected_risk']:<9} {label['notes']}")
        browser_version = r.browser_version
    items.sort(key=lambda i: i["item_id"])
    manifest = {
        "kind": "synthetic",
        "generator_version": GENERATOR_VERSION,
        "command": "python -m generator",
        "seed": seed,
        "count_per_template": {"positive": count_positive, "hard_negative": count_negative},
        "templates": selected,
        "page": {"width_px": PAGE_W, "height_px": PAGE_H, "dpi": DPI},
        "renderer": {"playwright": pkg_version("playwright"), "chromium": browser_version},
        "fonts": fonts,
        "totals": {
            "items": len(items),
            "positive": sum(1 for i in items if i["has_dinas_doc"]),
            "hard_negative": sum(1 for i in items if not i["has_dinas_doc"]),
        },
        "items": items,
    }
    (out_dir.parent / MANIFEST_NAME).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest
