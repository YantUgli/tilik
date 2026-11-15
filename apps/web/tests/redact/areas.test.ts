import { describe, expect, it } from "vitest";
import { activeBoxes, areaLabel, collectAreas, toPixelRect } from "@/features/redact/areas";
import type { Finding, LayerResult } from "@/lib/validate";

const finding = (id: string, extra: Partial<Finding> = {}): Finding => ({
  id,
  layer: "L3",
  category: "kop_satuan",
  severity: "perhatian",
  source: "rule",
  message: "Kop satuan terbaca",
  ...extra,
});

const layer = (findings: Finding[], status: LayerResult["status"] = "ok"): LayerResult => ({
  layer: "L3",
  status,
  provider: "rule",
  latency_ms: 1,
  findings,
  note: null,
});

describe("collectAreas", () => {
  it("hanya temuan redactable dengan bboxes", () => {
    const areas = collectAreas([
      layer([
        finding("c-1", { redactable: true, evidence: { text: "KOMANDO", bboxes: [[0.1, 0.1, 0.2, 0.05]] } }),
        finding("c-2", { redactable: false, evidence: { bboxes: [[0.1, 0.2, 0.2, 0.05]] } }),
        finding("c-3", { redactable: true, evidence: { text: "x" } }),
        finding("c-4", { redactable: true, evidence: { bboxes: [] } }),
        finding("c-5", { evidence: { bboxes: [[0.1, 0.3, 0.2, 0.05]] } }),
      ]),
    ]);
    expect(areas.map((a) => a.findingId)).toEqual(["c-1"]);
    expect(areas[0].bbox).toEqual([0.1, 0.1, 0.2, 0.05]);
  });

  it("satu temuan dengan beberapa bbox → beberapa area", () => {
    const f = finding("c-7", {
      redactable: true,
      evidence: { bboxes: [[0, 0, 0.1, 0.1], [0.5, 0.5, 0.1, 0.1], [0.2, 0.7, 0.3, 0.02]] },
    });
    const areas = collectAreas([layer([f])]);
    expect(areas).toHaveLength(3);
    expect(new Set(areas.map((a) => a.id)).size).toBe(3);
  });

  it("id area stabil (sama untuk input yang sama, tidak bergantung urutan pemanggilan)", () => {
    const layers = [
      layer([finding("c-1", { redactable: true, evidence: { bboxes: [[0, 0, 0.1, 0.1], [0.2, 0.2, 0.1, 0.1]] } })]),
      layer([finding("c-9", { layer: "L4", redactable: true, evidence: { bboxes: [[0.3, 0.3, 0.1, 0.1]] } })]),
    ];
    const a = collectAreas(layers).map((x) => x.id);
    const b = collectAreas(structuredClone(layers)).map((x) => x.id);
    expect(a).toEqual(b);
    expect(a).toEqual(["c-1#0", "c-1#1", "c-9#0"]);
  });

  it("layer error / tanpa temuan / null → []", () => {
    const bad = layer([finding("c-1", { redactable: true, evidence: { bboxes: [[0, 0, 0.1, 0.1]] } })], "error");
    expect(collectAreas([bad])).toEqual([]);
    expect(collectAreas([layer([])])).toEqual([]);
    expect(collectAreas([null, null])).toEqual([]);
    expect(collectAreas([])).toEqual([]);
  });

  it("label: message + evidence.text dipotong 40 karakter", () => {
    const long = "A".repeat(60);
    expect(areaLabel(finding("c-1", { evidence: { text: long } }))).toBe(`Kop satuan terbaca: ${"A".repeat(40)}…`);
    expect(areaLabel(finding("c-1", { evidence: { text: "NOMOR 12" } }))).toBe("Kop satuan terbaca: NOMOR 12");
    expect(areaLabel(finding("c-1"))).toBe("Kop satuan terbaca");
  });
});

describe("to_pixels: toPixelRect", () => {
  it("padding 15% dari tinggi bbox, dalam piksel bitmap kerja", () => {
    // bbox 200×40 px di (100, 200) pada 1000×1000; pad = 6 px
    const r = toPixelRect([0.1, 0.2, 0.2, 0.04], 1000, 1000)!;
    expect(r).toMatchObject({ x: 94, y: 194, w: 212, h: 52 });
  });

  it("clamp ke tepi gambar", () => {
    const r = toPixelRect([0, 0, 1, 0.1], 800, 600)!;
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.x + r.w).toBeLessThanOrEqual(800);
    expect(r.y + r.h).toBeLessThanOrEqual(600);
    const s = toPixelRect([0.9, 0.95, 0.1, 0.05], 800, 600)!;
    expect(s.x + s.w).toBe(800);
    expect(s.y + s.h).toBe(600);
  });

  it("bbox di luar 0..1, w/h ≤ 0, atau ukuran gambar ≤ 0 dibuang", () => {
    expect(toPixelRect([-0.1, 0, 0.2, 0.2], 100, 100)).toBeNull();
    expect(toPixelRect([0.5, 0.5, 1.2, 0.2], 100, 100)).toBeNull();
    expect(toPixelRect([0.1, 0.1, 0, 0.2], 100, 100)).toBeNull();
    expect(toPixelRect([0.1, 0.1, 0.2, -0.1], 100, 100)).toBeNull();
    expect(toPixelRect([0.1, 0.1, 0.2, Number.NaN], 100, 100)).toBeNull();
    expect(toPixelRect([0.1, 0.1, 0.2], 100, 100)).toBeNull();
    expect(toPixelRect([0.1, 0.1, 0.2, 0.2], 0, 100)).toBeNull();
  });

  it("ukuran blok ≥ 8 dan ≥ ½ tinggi area", () => {
    const small = toPixelRect([0.1, 0.1, 0.1, 0.005], 1000, 1000)!;
    expect(small.block).toBeGreaterThanOrEqual(8);
    const big = toPixelRect([0.1, 0.1, 0.5, 0.1], 2000, 2000)!;
    expect(big.block).toBeGreaterThanOrEqual(8);
    expect(big.block).toBeGreaterThanOrEqual(big.h / 2);
  });
});

describe("toggles: activeBoxes", () => {
  const areas = collectAreas([
    layer([
      finding("c-1", { redactable: true, evidence: { bboxes: [[0, 0, 0.1, 0.1], [0.2, 0.2, 0.1, 0.1]] } }),
      finding("c-2", { redactable: true, evidence: { bboxes: [[0.5, 0.5, 0.1, 0.1]] } }),
    ]),
  ]);

  it("default semua aktif", () => {
    expect(activeBoxes(areas, new Set())).toEqual([[0, 0, 0.1, 0.1], [0.2, 0.2, 0.1, 0.1], [0.5, 0.5, 0.1, 0.1]]);
  });

  it("area nonaktif tidak ikut ke daftar untuk encoder", () => {
    expect(activeBoxes(areas, new Set(["c-1#1"]))).toEqual([[0, 0, 0.1, 0.1], [0.5, 0.5, 0.1, 0.1]]);
    expect(activeBoxes(areas, new Set(areas.map((a) => a.id)))).toEqual([]);
  });
});
