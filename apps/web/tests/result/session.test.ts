import { describe, expect, it } from "vitest";
import { initialSession, layerStatusLabel, sessionReducer, type Session } from "@/features/result/session";
import type { CaptionResult } from "@/lib/api";
import type { LayerResult } from "@/lib/validate";

const l1: LayerResult = { layer: "L1", status: "ok", provider: "browser", latency_ms: 1, findings: [], note: null };
const server: CaptionResult = {
  problem: null,
  message: null,
  layers: [
    { layer: "L3", status: "ok", provider: "rule", latency_ms: 1, findings: [], note: null },
    { layer: "L4", status: "ok", provider: "rule", latency_ms: 1, findings: [], note: null },
    { layer: "L4", status: "ok", provider: "fireworks", latency_ms: 1, findings: [], note: null },
  ],
};

const submitted = (id: number): Session => sessionReducer(initialSession, { type: "submit", id });

describe("sessionReducer (hasil basi)", () => {
  it("submit → l1 dan server pending", () => {
    expect(submitted(1)).toEqual({ id: 1, l1: null, server: null, ocr: "pending" });
  });

  it("hasil untuk id aktif disimpan", () => {
    let s = submitted(1);
    s = sessionReducer(s, { type: "l1", id: 1, result: l1 });
    s = sessionReducer(s, { type: "server", id: 1, result: server });
    expect(s).toEqual({ id: 1, l1, server, ocr: "pending" });
  });

  it("foto diganti/dihapus → semua hasil hilang", () => {
    let s = sessionReducer(submitted(1), { type: "l1", id: 1, result: l1 });
    s = sessionReducer(s, { type: "server", id: 1, result: server });
    expect(sessionReducer(s, { type: "reset" })).toEqual(initialSession);
  });

  it("respons server untuk input lama diabaikan setelah reset", () => {
    const s = sessionReducer(submitted(1), { type: "reset" });
    expect(sessionReducer(s, { type: "server", id: 1, result: server })).toBe(s);
    expect(sessionReducer(s, { type: "l1", id: 1, result: l1 })).toBe(s);
  });

  it("respons server untuk input lama diabaikan setelah submit baru", () => {
    const s = submitted(2);
    expect(sessionReducer(s, { type: "server", id: 1, result: server })).toBe(s);
  });
});

describe("layerStatusLabel", () => {
  const lr = (status: LayerResult["status"]): LayerResult => ({ ...l1, status });
  it("label kartu persis", () => {
    expect(layerStatusLabel(null)).toBe("sedang dianalisis");
    expect(layerStatusLabel(lr("ok"))).toBe("selesai");
    expect(layerStatusLabel(lr("skipped"))).toBe("selesai");
    expect(layerStatusLabel(lr("unavailable"))).toBe("tidak tersedia");
    expect(layerStatusLabel(lr("error"))).toBe("tidak tersedia");
    expect(layerStatusLabel(lr("unavailable"), true)).toBe("sibuk, coba lagi");
  });
});
