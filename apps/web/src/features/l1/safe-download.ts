/** Versi aman (FR-L1-03/04): encode, verifikasi ulang, tahan unduhan bila masih ada metadata. */

import { verifyClean, type CleanCheck } from "@/lib/image/metadata";

export const SAFE_FAILED_MESSAGE = "Versi aman gagal dibuat, coba lagi";

export class SafeVersionError extends Error {
  constructor() {
    super(SAFE_FAILED_MESSAGE);
    this.name = "SafeVersionError";
  }
}

/**
 * `encode` dan `verify` di-inject supaya bisa diuji tanpa canvas. Gagal tertutup: encoder gagal,
 * verifier melempar, atau metadata tersisa → `SafeVersionError` (pesannya siap tampil di UI).
 */
export async function makeSafeDownload(
  encode: () => Promise<Blob>,
  verify: (bytes: Uint8Array) => Promise<CleanCheck> = verifyClean,
): Promise<Blob> {
  let blob: Blob;
  let check: CleanCheck;
  try {
    blob = await encode();
    check = await verify(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    throw new SafeVersionError();
  }
  if (!check.clean) throw new SafeVersionError();
  return blob;
}
