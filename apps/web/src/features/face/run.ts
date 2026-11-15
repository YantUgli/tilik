/**
 * Pembungkus deteksi wajah (T-15), pola sama dengan `ocr/run.ts`. Detector dibuat lazy saat pengguna
 * menekan tombol, dipakai ulang, dan di-close lewat `close()` (unmount). Timeout/error → `failed`, tidak
 * pernah throw; detector dibuang supaya "coba lagi" membuat ulang. Tidak ada log tentang wajah.
 * Catatan: `detect` MediaPipe sinkron; timeout deteksi hanya efektif bila detector mengembalikan Promise.
 */

import type { RedactArea } from "@/features/redact/areas";
import { faceAreas, type FaceDetection } from "./areas";

export const FACE_INIT_TIMEOUT_MS = 30_000;
export const FACE_DETECT_TIMEOUT_MS = 10_000;

type DetectResult = { detections: readonly FaceDetection[] };

export type FaceDetectorLike<I = unknown> = {
  detect(image: I): DetectResult | Promise<DetectResult>;
  close(): void;
};

export type FaceOutcome = { status: "ok"; areas: RedactArea[] } | { status: "failed" };

const TIMEOUT = Symbol("timeout");

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(TIMEOUT), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export function createFaceRunner<I>(
  createDetector: () => Promise<FaceDetectorLike<I>>,
  initTimeoutMs = FACE_INIT_TIMEOUT_MS,
  detectTimeoutMs = FACE_DETECT_TIMEOUT_MS,
) {
  let detector: Promise<FaceDetectorLike<I>> | null = null;
  let closed = false;

  const drop = () => {
    const d = detector;
    detector = null;
    d?.then((x) => x.close()).catch(() => undefined);
  };

  async function attempt(image: I, width: number, height: number): Promise<FaceOutcome> {
    detector ??= createDetector();
    const d = await withTimeout(detector, initTimeoutMs);
    if (d === TIMEOUT) {
      drop();
      return { status: "failed" };
    }
    const res = await withTimeout(
      Promise.resolve().then(() => d.detect(image)),
      detectTimeoutMs,
    );
    if (res === TIMEOUT) {
      drop();
      return { status: "failed" };
    }
    return { status: "ok", areas: faceAreas(res.detections ?? [], width, height) };
  }

  return {
    /** Tidak pernah reject. Setelah `close()` → `failed`. */
    async run(image: I, width: number, height: number): Promise<FaceOutcome> {
      if (closed) return { status: "failed" };
      try {
        const out = await attempt(image, width, height);
        return closed ? { status: "failed" } : out;
      } catch {
        drop();
        return { status: "failed" };
      }
    },
    close() {
      closed = true;
      drop();
    },
  };
}

export type FaceRunner<I = unknown> = ReturnType<typeof createFaceRunner<I>>;
