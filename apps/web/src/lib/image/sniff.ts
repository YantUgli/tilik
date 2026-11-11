/** Deteksi tipe gambar dari magic bytes (bukan ekstensi atau `File.type`). Fungsi murni. */

export type ImageType = "jpeg" | "png" | "webp";
export type SniffResult = ImageType | "heic" | null;

export const MIME: Record<ImageType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Byte yang cukup untuk `sniffImageType`. */
export const SNIFF_BYTES = 16;

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

const startsWith = (b: Uint8Array, sig: readonly number[], offset = 0) =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);

const ascii = (b: Uint8Array, start: number, len: number) =>
  b.length < start + len ? "" : String.fromCharCode(...b.subarray(start, start + len));

export function sniffImageType(bytes: Uint8Array): SniffResult {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  // ISO BMFF: [ukuran box][ftyp][major brand]
  if (ascii(bytes, 4, 4) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 4))) return "heic";
  return null;
}
