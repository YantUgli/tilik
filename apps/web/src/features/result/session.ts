/**
 * State satu analisis (fungsi murni). Setiap "Periksa" membuat id baru; hasil yang datang untuk id
 * lain (foto sudah diganti/dihapus atau sudah diperiksa ulang) diabaikan supaya tidak tampil hasil basi.
 */

import type { CaptionResult } from "@/lib/api";
import type { LayerResult } from "@/lib/validate";

/** Status OCR di browser (tidak punya LayerResult sendiri). `null` = belum ada analisis. */
export type OcrState = "pending" | "ok" | "error" | null;

/** id 0 = belum ada analisis. `null` pada l1/server = masih dianalisis. */
export type Session = { id: number; l1: LayerResult | null; server: CaptionResult | null; ocr: OcrState };

export type SessionAction =
  | { type: "submit"; id: number }
  | { type: "reset" }
  | { type: "l1"; id: number; result: LayerResult }
  | { type: "server"; id: number; result: CaptionResult }
  | { type: "ocr"; id: number; status: "ok" | "error" };

export const initialSession: Session = { id: 0, l1: null, server: null, ocr: null };

export function sessionReducer(s: Session, a: SessionAction): Session {
  switch (a.type) {
    case "submit":
      return { id: a.id, l1: null, server: null, ocr: "pending" };
    case "reset":
      return initialSession;
    case "l1":
      return a.id === s.id && s.id !== 0 ? { ...s, l1: a.result } : s;
    case "server":
      return a.id === s.id && s.id !== 0 ? { ...s, server: a.result } : s;
    case "ocr":
      return a.id === s.id && s.id !== 0 ? { ...s, ocr: a.status } : s;
  }
}

export type StatusLabel = "sedang dianalisis" | "selesai" | "sibuk, coba lagi" | "tidak tersedia";

/** Label status kartu (FR-UI-01). `busy` = server menjawab 429. */
export function layerStatusLabel(layer: LayerResult | null, busy = false): StatusLabel {
  if (!layer) return "sedang dianalisis";
  if (layer.status === "ok" || layer.status === "skipped") return "selesai";
  return busy ? "sibuk, coba lagi" : "tidak tersedia";
}

/** Judul lapis dalam bahasa awam. Urutan lapis server tetap menurut kontrak: [L3 aturan, L4 aturan, L4 LLM]. */
export const SERVER_TITLES = ["Dokumen dinas", "Isi caption (aturan)", "Isi caption (AI)"] as const;
export const L1_TITLE = "Metadata foto";

export const OCR_PENDING_NOTE = "Membaca teks di foto…";
export const OCR_FAILED_NOTE = "Teks di foto tidak bisa dibaca, jadi dokumen dalam foto belum diperiksa.";
