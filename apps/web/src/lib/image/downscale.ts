/**
 * Pembungkus tipis canvas/ImageBitmap (butuh browser). Logika ukuran ada di `resize.ts`.
 * Tidak ada yang disimpan ke storage; pemanggil wajib `close()` bitmap kerja bila selesai.
 */

import { SEND_MAX_SIDE, WORK_MAX_SIDE, targetSize } from "./resize";

export type PreparedImages = {
  /** Versi kerja ≤ 2048 px untuk EXIF/OCR/wajah di perangkat. Tidak pernah dikirim. */
  work: ImageBitmap;
  /** Versi kirim: JPEG ≤ 1024 px, kualitas 0,85. Satu-satunya yang boleh keluar ke server. */
  send: { blob: Blob; width: number; height: number };
};

export const SEND_JPEG_QUALITY = 0.85;

export async function prepareImages(file: Blob): Promise<PreparedImages> {
  // Decode dengan orientasi EXIF diterapkan, sehingga lebar/tinggi di bawah sudah sesuai tampilan.
  const oriented = await createImageBitmap(file, { imageOrientation: "from-image" });
  let work: ImageBitmap;
  try {
    work = await resizeBitmap(oriented, WORK_MAX_SIDE);
  } catch (err) {
    oriented.close();
    throw err;
  }
  if (work !== oriented) oriented.close(); // bitmap penuh (bisa ~48 MB untuk 12 MP) segera dilepas
  try {
    const send = await encodeJpeg(work, SEND_MAX_SIDE);
    return { work, send };
  } catch (err) {
    work.close();
    throw err;
  }
}

async function resizeBitmap(src: ImageBitmap, max: number): Promise<ImageBitmap> {
  const t = targetSize(src.width, src.height, max);
  if (t.width === src.width && t.height === src.height) return src;
  // Sumber berupa ImageBitmap (tanpa metadata orientasi), jadi resize tidak ambigu.
  return createImageBitmap(src, { resizeWidth: t.width, resizeHeight: t.height, resizeQuality: "high" });
}

async function encodeJpeg(src: ImageBitmap, max: number): Promise<PreparedImages["send"]> {
  const { width, height } = targetSize(src.width, src.height, max);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.fillStyle = "#fff"; // PNG/WebP transparan → latar putih, bukan hitam
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, width, height);
  const blob =
    canvas instanceof HTMLCanvasElement
      ? await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", SEND_JPEG_QUALITY))
      : await canvas.convertToBlob({ type: "image/jpeg", quality: SEND_JPEG_QUALITY });
  if (!blob) throw new Error("Gagal meng-encode JPEG");
  return { blob, width, height };
}

function makeCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}
