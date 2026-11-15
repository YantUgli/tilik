import { describe, expect, it } from "vitest";
import { GALLERY } from "@/features/gallery/items";
import { computeRisk } from "@/lib/risk";
import { validateAnalysisResult } from "@/lib/validate";

const byId = (id: string) => GALLERY.find((g) => g.id === id)!.result;
const findings = (id: string) => byId(id).layers.flatMap((l) => l.findings);

describe("data galeri precomputed", () => {
  it("berisi galeri-01..03", () => {
    expect(GALLERY.map((g) => g.id)).toEqual(["galeri-01", "galeri-02", "galeri-03"]);
  });

  for (const g of GALLERY) {
    describe(g.id, () => {
      it("valid analysis-result.schema.json", () => {
        expect(validateAnalysisResult(g.result)).toEqual({ valid: true });
      });

      it("mode precomputed dan request_id = id galeri", () => {
        expect(g.result.mode).toBe("precomputed");
        expect(g.result.request_id).toBe(g.id);
      });

      it("lapis [L1, L3 aturan, L4 aturan, L4 LLM]", () => {
        expect(g.result.layers.map((l) => `${l.layer}/${l.provider === "rule" ? "rule" : l.layer === "L1" ? "browser" : "llm"}`)).toEqual([
          "L1/browser",
          "L3/rule",
          "L4/rule",
          "L4/llm",
        ]);
      });

      it("risk.level dan risk.incomplete = computeRisk(layers)", () => {
        const { level, incomplete } = computeRisk(g.result.layers);
        expect(g.result.risk.level).toBe(level);
        expect(g.result.risk.incomplete).toBe(incomplete);
      });

      it("semua top_reasons ada di temuan", () => {
        const ids = new Set(g.result.layers.flatMap((l) => l.findings.map((f) => f.id)));
        for (const id of g.result.risk.top_reasons) expect(ids.has(id)).toBe(true);
      });

      it("setiap nomor satuan yang muncul = 999 (fiktif)", () => {
        const texts = [g.caption, ...g.result.layers.flatMap((l) => l.findings.flatMap((f) => [f.message, f.explanation ?? "", f.evidence?.text ?? ""]))];
        const re = /\b(?:yonif|batalyon(?:\s+infanteri)?|brigif|kodim|korem|kodam|denma|kompi|kostrad)\s*(\d+)/gi;
        for (const t of texts) for (const m of t.matchAll(re)) expect(m[1]).toBe("999");
      });
    });
  }

  it("galeri-01: L3 tinggi redactable dengan bboxes, risiko tinggi", () => {
    const l3 = findings("galeri-01").filter((f) => f.layer === "L3" && f.severity === "tinggi" && f.redactable === true);
    expect(l3.some((f) => (f.evidence?.bboxes?.length ?? 0) > 0)).toBe(true);
    expect(byId("galeri-01").risk.level).toBe("tinggi");
  });

  it("galeri-02: L1 gps dan L4 jadwal_pergerakan, risiko tinggi", () => {
    const fs = findings("galeri-02");
    expect(fs.some((f) => f.layer === "L1" && f.category === "gps")).toBe(true);
    expect(fs.some((f) => f.layer === "L4" && f.category === "jadwal_pergerakan")).toBe(true);
    expect(byId("galeri-02").risk.level).toBe("tinggi");
  });

  it("galeri-03: aman, tanpa temuan perhatian/tinggi", () => {
    expect(byId("galeri-03").risk.level).toBe("aman");
    expect(findings("galeri-03").filter((f) => f.severity !== "info")).toEqual([]);
  });
});
