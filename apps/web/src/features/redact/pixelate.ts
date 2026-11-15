/**
 * Encoder versi aman dengan mosaik (butuh browser). Sengaja PIXELATE, bukan `ctx.filter = "blur()"`:
 * `ctx.filter` tidak didukung Safari iOS sehingga area bisa lolos tanpa buram.
 * Sumber = bitmap kerja (≤ 2048 px, orientasi sudah diterapkan); bbox relatif × ukuran bitmap itu.
 */

import { SAFE_JPEG_QUALITY, canvasToJpeg, context2d, makeCanvas } from "@/lib/image/downscale";
import { toPixelRect, type Bbox } from "./areas";

export async function encodeRedactedJpeg(work: ImageBitmap, boxes: readonly Bbox[]): Promise<Blob> {
  const { width, height } = work;
  const canvas = makeCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.fillStyle = "#fff"; // PNG/WebP transparan → latar putih, sama dengan encodeSafeJpeg
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(work, 0, 0, width, height);

  for (const bbox of boxes) {
    const r = toPixelRect(bbox, width, height);
    if (!r) continue;
    const sw = Math.max(1, Math.ceil(r.w / r.block));
    const sh = Math.max(1, Math.ceil(r.h / r.block));
    const small = makeCanvas(sw, sh);
    const sctx = context2d(small);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, sw, sh, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = true;
  }
  return canvasToJpeg(canvas, SAFE_JPEG_QUALITY);
}
