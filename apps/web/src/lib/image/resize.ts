/** Ukuran target downscale. Fungsi murni. */

/** Versi kerja di perangkat (EXIF/OCR/wajah). FR-IN-03. */
export const WORK_MAX_SIDE = 2048;
/** Versi kirim, satu-satunya yang boleh keluar ke server. NFR-PRIV-02. */
export const SEND_MAX_SIDE = 1024;

/** Skala agar sisi terpanjang ≤ `max`, rasio tetap, tidak pernah memperbesar. */
export function targetSize(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  if (scale === 1) return { width, height };
  return {
    width: Math.min(max, Math.max(1, Math.round(width * scale))),
    height: Math.min(max, Math.max(1, Math.round(height * scale))),
  };
}
