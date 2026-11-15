/**
 * Pembungkus OCR (FR-OCR-01, FR-OCR-03). Satu worker dibuat lazy dan dipakai ulang; timeout/error →
 * worker di-terminate dan dibuat ulang di analisis berikutnya. `cancel()` membatalkan OCR yang sedang
 * berjalan (foto diganti/dihapus). Teks OCR tidak pernah di-log atau disimpan.
 */

import { toOcrPayload, type OcrPage, type OcrPayload } from "./words";

export const OCR_TIMEOUT_MS = 20_000;
/** Pembuatan worker pertama mengunduh worker + core + traineddata; diberi batas sendiri yang lebih longgar. */
export const OCR_INIT_TIMEOUT_MS = 60_000;

export type OcrWorkerLike = {
  recognize(image: Blob): Promise<{ data: OcrPage }>;
  terminate(): Promise<unknown>;
};

export type OcrOutcome =
  | { status: "ok"; payload: OcrPayload }
  | { status: "error"; reason: "timeout" | "failed" }
  | { status: "cancelled" };

type Settle = (o: OcrOutcome) => void;

export function createOcrRunner(createWorker: () => Promise<OcrWorkerLike>, timeoutMs = OCR_TIMEOUT_MS, initTimeoutMs = OCR_INIT_TIMEOUT_MS) {
  let worker: Promise<OcrWorkerLike> | null = null;
  let current: Settle | null = null;

  const drop = () => {
    const w = worker;
    worker = null;
    w?.then((x) => x.terminate()).catch(() => undefined);
  };

  const withTimeout = <T>(p: Promise<T>, ms: number) =>
    new Promise<T | "timeout">((resolve, reject) => {
      const t = setTimeout(() => resolve("timeout"), ms);
      p.then(
        (v) => (clearTimeout(t), resolve(v)),
        (e) => (clearTimeout(t), reject(e)),
      );
    });

  async function attempt(image: Blob, width: number, height: number): Promise<OcrOutcome> {
    worker ??= createWorker();
    const w = await withTimeout(worker, initTimeoutMs);
    if (w === "timeout") {
      drop();
      return { status: "error", reason: "timeout" };
    }
    const res = await withTimeout(w.recognize(image), timeoutMs);
    if (res === "timeout") {
      drop();
      return { status: "error", reason: "timeout" };
    }
    return { status: "ok", payload: toOcrPayload(res.data, width, height) };
  }

  return {
    run(image: Blob, width: number, height: number): Promise<OcrOutcome> {
      return new Promise<OcrOutcome>((resolve) => {
        let done = false;
        const settle: Settle = (o) => {
          if (done) return;
          done = true;
          if (current === settle) current = null;
          resolve(o);
        };
        current = settle;
        attempt(image, width, height).then(settle, () => {
          drop();
          settle({ status: "error", reason: "failed" });
        });
      });
    },
    /** Batalkan OCR yang sedang berjalan (bila ada): worker di-terminate, hasilnya `cancelled`. */
    cancel() {
      const s = current;
      if (!s) return;
      current = null;
      drop();
      s({ status: "cancelled" });
    },
  };
}

export type OcrRunner = ReturnType<typeof createOcrRunner>;
