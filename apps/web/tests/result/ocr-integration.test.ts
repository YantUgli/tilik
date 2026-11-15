import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { initialSession, sessionReducer } from "@/features/result/session";
import { analyzeCaption, type OcrWord } from "@/lib/api";
import { computeRisk } from "@/lib/risk";
import type { LayerResult } from "@/lib/validate";
import { REPO_EXAMPLES } from "../paths";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const valid = () => json(JSON.parse(readFileSync(join(REPO_EXAMPLES, "caption-response.valid.json"), "utf8")));
const sentBody = (fetchImpl: ReturnType<typeof vi.fn>) => JSON.parse(fetchImpl.mock.calls[0][1].body);

describe("analyzeCaption + OCR", () => {
  it("mengirim ocr_text dan ocr_words", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(valid());
    const ocr: { ocr_text: string; ocr_words: OcrWord[] } = { ocr_text: "SURAT TELEGRAM\nST/123/2026", ocr_words: [
      { text: "SURAT", conf: 91, bbox: [0.1, 0.1, 0.2, 0.15] },
      { text: "TELEGRAM", conf: 88, bbox: [0.22, 0.1, 0.4, 0.15] },
      { text: "ST/123/2026", conf: 75, bbox: [0.1, 0.2, 0.35, 0.25] },
    ] };
    await analyzeCaption("https://api.contoh.test", "halo", ocr, { fetchImpl });
    expect(sentBody(fetchImpl)).toEqual({ caption: "halo", ...ocr, lang: "id" });
  });

  it("ocr_words tidak valid kontrak → dikirim tanpa ocr_words (fallback), tidak crash", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(valid());
    const ocr: { ocr_text: string; ocr_words: OcrWord[] } = { ocr_text: "A", ocr_words: [{ text: "A", conf: 150, bbox: [0, 0, 2, 1] }] };
    const out = await analyzeCaption("https://api.contoh.test", "halo", ocr, { fetchImpl });
    const body = sentBody(fetchImpl);
    expect(body.ocr_text).toBe("A");
    expect(body.ocr_words ?? null).toBeNull();
    expect(out.problem).toBeNull();
  });

  it("OCR null → ocr_text null, ocr_words null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(valid());
    await analyzeCaption("https://api.contoh.test", "halo", null, { fetchImpl });
    expect(sentBody(fetchImpl)).toMatchObject({ ocr_text: null, lang: "id" });
    expect(sentBody(fetchImpl).ocr_words ?? null).toBeNull();
  });
});

describe("computeRisk + extraIncomplete", () => {
  const ok: LayerResult = { layer: "L3", status: "ok", provider: "rule", latency_ms: 1, findings: [], note: null };
  it("extraIncomplete → incomplete true walau semua lapis ok", () => {
    expect(computeRisk([ok], { extraIncomplete: true })).toEqual({ level: "aman", incomplete: true });
  });
  it("extraIncomplete false/tidak ada → perilaku lama", () => {
    expect(computeRisk([ok], { extraIncomplete: false })).toEqual({ level: "aman", incomplete: false });
    expect(computeRisk([ok])).toEqual({ level: "aman", incomplete: false });
  });
});

describe("session + OCR", () => {
  it("submit → ocr pending; hasil OCR untuk id aktif disimpan", () => {
    let s = sessionReducer(initialSession, { type: "submit", id: 1 });
    expect(s.ocr).toBe("pending");
    s = sessionReducer(s, { type: "ocr", id: 1, status: "error" });
    expect(s.ocr).toBe("error");
  });

  it("hasil OCR untuk id lama diabaikan (submit baru / reset)", () => {
    const s2 = sessionReducer(sessionReducer(initialSession, { type: "submit", id: 1 }), { type: "submit", id: 2 });
    expect(sessionReducer(s2, { type: "ocr", id: 1, status: "ok" })).toBe(s2);
    const r = sessionReducer(s2, { type: "reset" });
    expect(sessionReducer(r, { type: "ocr", id: 2, status: "ok" })).toBe(r);
  });
});
