/**
 * Area wajah (FR-PII-01, T-15), fungsi murni. Deteksi MediaPipe (piksel bitmap kerja) → `RedactArea`
 * dengan bbox `[x, y, w, h]` relatif 0..1, sama dengan area server, supaya toggle/encoder dipakai ulang.
 * Wajah hanya bantu redaksi: tidak menjadi Finding, tidak masuk risiko akhir.
 */

import type { RedactArea } from "@/features/redact/areas";

export const FACE_MIN_SCORE = 0.5;
export const FACE_MAX = 20;

/** Bentuk minimal `Detection` MediaPipe yang dipakai. */
export type FaceDetection = {
  boundingBox?: { originX: number; originY: number; width: number; height: number };
  categories?: readonly { score: number }[];
};

export function faceAreas(detections: readonly FaceDetection[], width: number, height: number): RedactArea[] {
  if (!(width > 0 && height > 0)) return [];
  const out: RedactArea[] = [];
  for (const d of detections) {
    if (out.length >= FACE_MAX) break;
    const score = d.categories?.[0]?.score;
    const b = d.boundingBox;
    if (!b || typeof score !== "number" || !(score >= FACE_MIN_SCORE)) continue;
    const { originX, originY, width: bw, height: bh } = b;
    if (![originX, originY, bw, bh].every(Number.isFinite) || !(bw > 0 && bh > 0)) continue;
    const x0 = Math.max(0, originX);
    const y0 = Math.max(0, originY);
    const x1 = Math.min(width, originX + bw);
    const y1 = Math.min(height, originY + bh);
    if (!(x1 > x0 && y1 > y0)) continue;
    const i = out.length;
    out.push({
      id: `b-face-${i}#0`,
      findingId: `b-face-${i}`,
      label: `Wajah ${i + 1}`,
      bbox: [x0 / width, y0 / height, (x1 - x0) / width, (y1 - y0) / height],
      kind: "face",
    });
  }
  return out;
}
