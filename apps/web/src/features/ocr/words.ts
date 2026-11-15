/**
 * Hasil Tesseract.js (blocks → paragraphs → lines → words, bbox piksel) → `ocr_text` + `ocr_words`
 * sesuai contracts/caption-request.schema.json (FR-OCR-01). Fungsi murni.
 *
 * `ocr_text` dan `ocr_words` dibangun dari daftar kata yang SAMA, sehingga `_align` di server
 * selalu berhasil: kata dalam satu baris dipisah satu spasi, baris dipisah "\n".
 */

import type { OcrWord } from "@/lib/api";

/** Bentuk minimal hasil tesseract.js yang dipakai (subset `Page`). */
export type OcrPage = {
  blocks:
    | {
        paragraphs: {
          lines: { words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[];
        }[];
      }[]
    | null;
};

export type OcrPayload = { ocr_text: string | null; ocr_words: OcrWord[] | null };

/** Batas kontrak: maks. 2.000 kata, teks kata maks. 64 karakter. */
export const MAX_OCR_WORDS = 2000;
export const MAX_WORD_CHARS = 64;

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
const round = (v: number) => Math.round(v * 1e4) / 1e4;

export function toOcrPayload(page: OcrPage, width: number, height: number): OcrPayload {
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  const words: OcrWord[] = [];
  const lines: string[] = [];

  outer: for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const kept: string[] = [];
        for (const word of line.words ?? []) {
          if (words.length >= MAX_OCR_WORDS) {
            if (kept.length) lines.push(kept.join(" "));
            break outer;
          }
          const text = (word.text ?? "").trim();
          // > 64 karakter dibuang dari keduanya (UTF-16 length ≥ jumlah code point, jadi aman terhadap maxLength skema).
          if (!text || text.length > MAX_WORD_CHARS) continue;
          const { x0, y0, x1, y1 } = word.bbox;
          const nx0 = round(clamp(Math.min(x0, x1) / w, 0, 1));
          const ny0 = round(clamp(Math.min(y0, y1) / h, 0, 1));
          const nx1 = round(clamp(Math.max(x0, x1) / w, 0, 1));
          const ny1 = round(clamp(Math.max(y0, y1) / h, 0, 1));
          words.push({ text, conf: clamp(word.confidence, 0, 100), bbox: [nx0, ny0, nx1, ny1] });
          kept.push(text);
        }
        if (kept.length) lines.push(kept.join(" "));
      }
    }
  }

  if (!words.length) return { ocr_text: null, ocr_words: null };
  return { ocr_text: lines.join("\n"), ocr_words: words };
}
