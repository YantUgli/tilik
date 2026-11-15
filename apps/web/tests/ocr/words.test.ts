import { describe, expect, it } from "vitest";
import { MAX_OCR_WORDS, toOcrPayload, type OcrPage } from "@/features/ocr/words";
import { validateCaptionRequest } from "@/lib/validate";

type W = { text: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } };
const word = ({ text, confidence = 90, bbox = { x0: 10, y0: 20, x1: 60, y1: 40 } }: W) => ({ text, confidence, bbox });
/** lines: array baris; tiap baris array kata. Semua di satu block/paragraf kecuali dipecah manual. */
const page = (...lines: (W | string)[][]): OcrPage => ({
  blocks: [{ paragraphs: [{ lines: lines.map((ws) => ({ words: ws.map((w) => word(typeof w === "string" ? { text: w } : w)) })) }] }],
});

describe("toOcrPayload", () => {
  it("baris dipisah \\n, kata dipisah spasi", () => {
    const p = toOcrPayload(page(["KOMANDO", "DAERAH"], ["RAHASIA"]), 200, 100);
    expect(p.ocr_text).toBe("KOMANDO DAERAH\nRAHASIA");
    expect(p.ocr_words?.map((w) => w.text)).toEqual(["KOMANDO", "DAERAH", "RAHASIA"]);
  });

  it("menggabungkan baris dari beberapa block/paragraf berurutan", () => {
    const pg: OcrPage = {
      blocks: [
        { paragraphs: [{ lines: [{ words: [word({ text: "A" })] }] }, { lines: [{ words: [word({ text: "B" })] }] }] },
        { paragraphs: [{ lines: [{ words: [word({ text: "C" })] }] }] },
      ],
    };
    expect(toOcrPayload(pg, 100, 100).ocr_text).toBe("A\nB\nC");
  });

  it("bbox dinormalisasi [x0,y0,x1,y1] dan di-clamp 0..1", () => {
    const p = toOcrPayload(
      page([{ text: "ST/1", bbox: { x0: 50, y0: 25, x1: 150, y1: 75 } }, { text: "luar", bbox: { x0: -5, y0: -1, x1: 250, y1: 120 } }]),
      200,
      100,
    );
    expect(p.ocr_words?.[0].bbox).toEqual([0.25, 0.25, 0.75, 0.75]);
    expect(p.ocr_words?.[1].bbox).toEqual([0, 0, 1, 1]);
  });

  it("conf di-clamp 0..100, bentuk kata hanya {text, conf, bbox}", () => {
    const p = toOcrPayload(page([{ text: "a", confidence: 140 }, { text: "b", confidence: -3 }, { text: "c", confidence: NaN }]), 10, 10);
    expect(p.ocr_words?.map((w) => w.conf)).toEqual([100, 0, 0]);
    for (const w of p.ocr_words ?? []) expect(Object.keys(w).sort()).toEqual(["bbox", "conf", "text"]);
  });

  it("kata kosong/spasi dan kata > 64 karakter dibuang dari keduanya", () => {
    const long = "x".repeat(80);
    const p = toOcrPayload(page(["  ", "SURAT", long, "", "TELEGRAM"], [" "], ["NOMOR"]), 100, 100);
    expect(p.ocr_text).toBe("SURAT TELEGRAM\nNOMOR");
    expect(p.ocr_words?.map((w) => w.text)).toEqual(["SURAT", "TELEGRAM", "NOMOR"]);
    expect(p.ocr_text).not.toContain(long);
  });

  it("kata dipangkas spasinya", () => {
    expect(toOcrPayload(page([" KOP "]), 10, 10).ocr_words?.[0].text).toBe("KOP");
  });

  it("batas 2.000 kata: dipotong di kata ke-2.000", () => {
    const lines = Array.from({ length: 250 }, (_, i) => Array.from({ length: 10 }, (_, j) => `k${i * 10 + j}`));
    const p = toOcrPayload(page(...lines), 100, 100);
    expect(p.ocr_words).toHaveLength(MAX_OCR_WORDS);
    expect(p.ocr_words?.at(-1)?.text).toBe("k1999");
    expect(p.ocr_text?.endsWith("k1999")).toBe(true);
    expect(p.ocr_text).not.toContain("k2000");
  });

  it("tanpa kata → null/null", () => {
    expect(toOcrPayload({ blocks: null }, 10, 10)).toEqual({ ocr_text: null, ocr_words: null });
    expect(toOcrPayload({ blocks: [] }, 10, 10)).toEqual({ ocr_text: null, ocr_words: null });
    expect(toOcrPayload(page(["", "  "]), 10, 10)).toEqual({ ocr_text: null, ocr_words: null });
  });

  it("ukuran gambar tidak valid → tidak crash, bbox tetap 0..1", () => {
    const p = toOcrPayload(page(["a"]), 0, 0);
    for (const v of p.ocr_words?.[0].bbox ?? []) expect(v >= 0 && v <= 1).toBe(true);
  });

  it("aligned: setiap kata ditemukan berurutan di ocr_text (indexOf maju)", () => {
    const p = toOcrPayload(page(["ab", "a", "ab"], ["b", "x".repeat(70), "ab"], ["aba"]), 100, 100);
    let cursor = 0;
    for (const w of p.ocr_words ?? []) {
      const i = p.ocr_text!.indexOf(w.text, cursor);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(p.ocr_text!.slice(cursor, i).trim()).toBe("");
      cursor = i + w.text.length;
    }
    expect(p.ocr_text!.slice(cursor).trim()).toBe("");
  });
});

describe("contract", () => {
  const req = (p: ReturnType<typeof toOcrPayload>) => ({ caption: "halo", ...p, lang: "id" as const });

  it("payload biasa lolos validateCaptionRequest", () => {
    expect(validateCaptionRequest(req(toOcrPayload(page(["KOP", "SATUAN"], ["ST/123/2026"]), 300, 200)))).toEqual({ valid: true });
  });

  it("2.500 kata (dipotong) dan kata 80 karakter tetap valid", () => {
    const lines = Array.from({ length: 250 }, (_, i) => Array.from({ length: 10 }, (_, j) => `w${i}-${j}`));
    lines[0].push("y".repeat(80));
    expect(validateCaptionRequest(req(toOcrPayload(page(...lines), 1000, 1000)))).toEqual({ valid: true });
  });

  it("null/null valid", () => {
    expect(validateCaptionRequest(req(toOcrPayload({ blocks: null }, 1, 1)))).toEqual({ valid: true });
  });
});
