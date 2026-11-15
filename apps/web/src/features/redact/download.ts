/**
 * Unduhan versi aman (FR-RED-02): tanpa metadata DAN dengan area aktif termosaik.
 * Memakai ulang `makeSafeDownload`, jadi verifikasi ulang FR-L1-04 tetap berlaku (gagal tertutup).
 */

import { makeSafeDownload } from "@/features/l1/safe-download";
import type { CleanCheck } from "@/lib/image/metadata";
import type { Bbox } from "./areas";

export const SAFE_NAME_REDACTED = "foto-aman.jpg";
export const SAFE_NAME_PLAIN = "foto-tanpa-metadata.jpg";

export function safeFileName(activeCount: number): string {
  return activeCount > 0 ? SAFE_NAME_REDACTED : SAFE_NAME_PLAIN;
}

export type SafeDownload = { blob: Blob; name: string };

/** `encode` menerima bbox aktif; di browser = `encodeRedactedJpeg(work, boxes)`. */
export async function makeRedactedDownload(
  encode: (boxes: Bbox[]) => Promise<Blob>,
  boxes: Bbox[],
  verify?: (bytes: Uint8Array) => Promise<CleanCheck>,
): Promise<SafeDownload> {
  const blob = await makeSafeDownload(() => encode(boxes), verify);
  return { blob, name: safeFileName(boxes.length) };
}
