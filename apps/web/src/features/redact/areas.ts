/**
 * Area redaksi (FR-RED-01, FR-L3-08), fungsi murni. Sumber area HANYA temuan server yang
 * `redactable: true` dan membawa `evidence.bboxes` (`[x, y, w, h]` relatif 0..1 terhadap gambar asli).
 * bbox tidak ditebak dari teks.
 */

import type { Finding, LayerResult } from "@/lib/validate";

export type Bbox = number[];

export type RedactArea = {
  /** Stabil: `<finding id>#<indeks bbox>`. */
  id: string;
  findingId: string;
  label: string;
  bbox: Bbox;
};

/** Persegi dalam piksel bitmap kerja + ukuran blok mosaik. */
export type PixelRect = { x: number; y: number; w: number; h: number; block: number };

export const PAD_RATIO = 0.15;
export const MIN_BLOCK = 8;
const LABEL_TEXT_MAX = 40;

export function areaLabel(f: Finding): string {
  const text = f.evidence?.text?.trim();
  if (!text) return f.message;
  const cut = [...text].length > LABEL_TEXT_MAX ? `${[...text].slice(0, LABEL_TEXT_MAX).join("")}…` : text;
  return `${f.message}: ${cut}`;
}

/** Semua area dari LayerResult server mana pun (urutan lapis, lalu urutan temuan dan bbox). */
export function collectAreas(layers: readonly (LayerResult | null | undefined)[]): RedactArea[] {
  const out: RedactArea[] = [];
  for (const layer of layers) {
    if (!layer || layer.status !== "ok") continue;
    for (const f of layer.findings) {
      const boxes = f.evidence?.bboxes;
      if (f.redactable !== true || !boxes?.length) continue;
      const label = areaLabel(f);
      boxes.forEach((bbox, i) => out.push({ id: `${f.id}#${i}`, findingId: f.id, label, bbox }));
    }
  }
  return out;
}

/** bbox area yang masih aktif (toggle tidak dimatikan) — inilah yang diberikan ke encoder. */
export function activeBoxes(areas: readonly RedactArea[], disabled: ReadonlySet<string>): Bbox[] {
  return areas.filter((a) => !disabled.has(a.id)).map((a) => a.bbox);
}

/**
 * bbox relatif → piksel bitmap kerja. Padding 15% dari tinggi bbox di semua sisi, di-clamp ke tepi.
 * bbox tidak valid (bukan 4 angka, di luar 0..1, lebar/tinggi ≤ 0) atau gambar kosong → null.
 * Blok mosaik = max(8 px, ½ tinggi area) supaya teks tidak terbaca lagi.
 */
export function toPixelRect(bbox: Bbox, width: number, height: number): PixelRect | null {
  if (!(width > 0 && height > 0) || bbox.length !== 4) return null;
  if (!bbox.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return null;
  const [bx, by, bw, bh] = bbox;
  if (!(bw > 0 && bh > 0)) return null;
  const pw = bw * width;
  const ph = bh * height;
  const pad = ph * PAD_RATIO;
  const x0 = Math.floor(Math.max(0, bx * width - pad));
  const y0 = Math.floor(Math.max(0, by * height - pad));
  const x1 = Math.ceil(Math.min(width, bx * width + pw + pad));
  const y1 = Math.ceil(Math.min(height, by * height + ph + pad));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 1 || h < 1) return null;
  return { x: x0, y: y0, w, h, block: Math.max(MIN_BLOCK, Math.ceil(h / 2)) };
}
