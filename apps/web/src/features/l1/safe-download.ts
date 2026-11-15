/** Versi aman (FR-L1-03/04): encode, verifikasi ulang, tahan unduhan bila masih ada metadata. */

import { stripJpegMetadata, verifyClean, type CleanCheck } from "@/lib/image/metadata";

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
 * Segmen APP1..APP15/COM yang ditambahkan encoder canvas (mis. EXIF teknis + ICC di Safari) dibuang dulu,
 * lalu hasilnya tetap diverifikasi ulang.
 */
export async function makeSafeDownload(
  encode: () => Promise<Blob>,
  verify: (bytes: Uint8Array) => Promise<CleanCheck> = verifyClean,
): Promise<Blob> {
  let blob: Blob;
  let check: CleanCheck;
  try {
    blob = await encode();
    let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
    const stripped = stripJpegMetadata(bytes);
    if (stripped) {
      bytes = stripped;
      blob = new Blob([stripped as BlobPart], { type: "image/jpeg" });
    }
    check = await verify(bytes);
  } catch {
    throw new SafeVersionError();
  }
  if (!check.clean) throw new SafeVersionError();
  return blob;
}
