/** Validasi file foto di klien (FR-IN-01, NFR-SEC-04): tipe, ukuran, dimensi, sebelum decode. */

import { MAX_PIXELS, exceedsPixelLimit, readDimensions } from "@/lib/image/dimensions";
import { MIME, SNIFF_BYTES, sniffImageType, type ImageType } from "@/lib/image/sniff";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const MESSAGES = {
  unsupported: "Format foto belum didukung. Gunakan JPG, PNG, atau WebP.",
  heic: "Foto HEIC belum didukung. Pilih foto dari galeri biasanya sudah otomatis JPG.",
  tooLarge: "Foto terlalu besar (maks. 10 MB).",
  tooManyPixels: "Resolusi foto terlalu besar.",
  unreadable: "Foto tidak dapat dibaca. Coba pilih foto lain.",
} as const;

export type FileCheck =
  | { ok: true; type: ImageType; mime: string; width: number; height: number }
  | { ok: false; message: string };

// Segmen APPn JPEG (EXIF, XMP, ICC, MPF) bisa puluhan KB sebelum SOF; 512 KB cukup untuk hampir semua foto.
const HEADER_BYTES = 512 * 1024;

const read = async (file: Blob, end: number) => new Uint8Array(await file.slice(0, end).arrayBuffer());

export async function validateImageFile(file: Blob): Promise<FileCheck> {
  const type = sniffImageType(await read(file, SNIFF_BYTES));
  if (type === "heic") return { ok: false, message: MESSAGES.heic };
  if (type === null) return { ok: false, message: MESSAGES.unsupported };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: MESSAGES.tooLarge };

  let dims = readDimensions(await read(file, HEADER_BYTES));
  if (!dims && file.size > HEADER_BYTES) dims = readDimensions(await read(file, file.size));
  if (!dims) return { ok: false, message: MESSAGES.unreadable };
  if (exceedsPixelLimit(dims)) return { ok: false, message: MESSAGES.tooManyPixels };

  return { ok: true, type, mime: MIME[type], ...dims };
}

export { MAX_PIXELS };
