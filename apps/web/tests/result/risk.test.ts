import { describe, expect, it } from "vitest";
import { computeRisk } from "@/lib/risk";
import type { Finding, LayerResult, Severity } from "@/lib/validate";

let n = 0;
const finding = (severity: Severity, source: Finding["source"] = "rule", layer: Finding["layer"] = "L4"): Finding => ({
  id: `c-${++n}`,
  layer,
  category: "jadwal_pergerakan",
  severity,
  source,
  message: "contoh",
});

const layer = (
  l: LayerResult["layer"],
  status: LayerResult["status"],
  findings: Finding[] = [],
  provider: LayerResult["provider"] = "rule",
): LayerResult => ({ layer: l, status, provider, latency_ms: 1, findings, note: null });

describe("computeRisk", () => {
  it("perhatian + tinggi → tinggi", () => {
    expect(computeRisk([layer("L3", "ok", [finding("perhatian")]), layer("L4", "ok", [finding("tinggi")])])).toEqual({
      level: "tinggi",
      incomplete: false,
    });
  });

  it("hanya info → aman", () => {
    expect(computeRisk([layer("L1", "ok", [finding("info", "exif", "L1"), finding("info", "exif", "L1")], "browser")])).toEqual({
      level: "aman",
      incomplete: false,
    });
  });

  it("tanpa temuan → aman", () => {
    expect(computeRisk([layer("L3", "ok"), layer("L4", "ok")])).toEqual({ level: "aman", incomplete: false });
  });

  it("aman + satu lapis error → {aman, incomplete}", () => {
    expect(computeRisk([layer("L3", "ok"), layer("L4", "error", [], null)])).toEqual({ level: "aman", incomplete: true });
  });

  it("unavailable → incomplete", () => {
    expect(computeRisk([layer("L4", "ok", [finding("perhatian")]), layer("L4", "unavailable", [], null)])).toEqual({
      level: "perhatian",
      incomplete: true,
    });
  });

  it("rule_beats_llm: L4 aturan perhatian + L4 LLM tanpa temuan → perhatian", () => {
    expect(
      computeRisk([layer("L3", "ok"), layer("L4", "ok", [finding("perhatian", "rule")]), layer("L4", "ok", [], "fireworks")]),
    ).toEqual({ level: "perhatian", incomplete: false });
  });

  it("rule_beats_llm: temuan LLM lebih rendah tidak menurunkan temuan aturan", () => {
    expect(
      computeRisk([layer("L4", "ok", [finding("tinggi", "rule")]), layer("L4", "ok", [finding("perhatian", "llm")], "fireworks")]).level,
    ).toBe("tinggi");
  });

  it("skipped_not_incomplete: L4 LLM skipped + lainnya ok → incomplete false", () => {
    expect(computeRisk([layer("L1", "ok", [], "browser"), layer("L3", "ok"), layer("L4", "ok"), layer("L4", "skipped", [], null)])).toEqual({
      level: "aman",
      incomplete: false,
    });
  });

  it("l1_error_incomplete: L1 error + server ok tanpa temuan → {aman, incomplete}", () => {
    expect(
      computeRisk([layer("L1", "error", [], "browser"), layer("L3", "ok"), layer("L4", "ok"), layer("L4", "ok", [], "fireworks")]),
    ).toEqual({ level: "aman", incomplete: true });
  });

  it("temuan L1 ikut dihitung (GPS tinggi)", () => {
    expect(computeRisk([layer("L1", "ok", [finding("tinggi", "exif", "L1")], "browser"), layer("L4", "ok")]).level).toBe("tinggi");
  });
});
