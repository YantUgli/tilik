/**
 * L1: baca metadata dari bytes FILE ASLI (bukan bitmap) dan verifikasi bahwa versi aman bersih.
 * Nilai EXIF hanya hidup di memori browser: tidak dikirim ke server, tidak di-log. (FR-L1-01, FR-L1-04)
 */

import type exifrType from "exifr";
import { sniffImageType } from "./sniff";

/** Hanya field yang dibutuhkan L1. Tanggal dibiarkan mentah ("YYYY:MM:DD HH:MM:SS") agar tidak bergeser zona waktu. */
export type ExifSummary = {
  latitude?: number;
  longitude?: number;
  dateTimeOriginal?: string;
  make?: string;
  model?: string;
  software?: string;
};

const PARSE_OPTIONS = {
  tiff: true,
  ifd0: { pick: ["Make", "Model", "Software"] },
  exif: { pick: ["DateTimeOriginal"] },
  gps: { pick: ["GPSLatitude", "GPSLatitudeRef", "GPSLongitude", "GPSLongitudeRef"] },
  ifd1: false,
  interop: false,
  xmp: false,
  icc: false,
  iptc: false,
  jfif: false,
  ihdr: false,
  reviveValues: false,
} satisfies Parameters<typeof exifrType.parse>[1];

/**
 * Membaca GPS, waktu pengambilan, merek/model, dan software. `null` bila tidak ada satu pun.
 * Melempar bila file tidak bisa di-parse (pemanggil menandai lapis L1 `error`).
 */
export async function readExif(bytes: Uint8Array): Promise<ExifSummary | null> {
  let input: Uint8Array = bytes;
  if (sniffImageType(bytes) === "webp") {
    // exifr tidak mengenali WebP; chunk EXIF berisi TIFF yang bisa dibaca langsung.
    const tiff = riffChunks(bytes).find((c) => c.type === "EXIF")?.data;
    if (!tiff) return null;
    input = startsWithExifHeader(tiff) ? tiff.subarray(6) : tiff;
  }
  // Dimuat saat dipakai: tidak ikut bundle awal dan tidak dievaluasi saat prerender server.
  const { default: exifr } = await import("exifr");
  const raw: Record<string, unknown> | undefined = await exifr.parse(input, PARSE_OPTIONS);
  if (!raw) return null;

  const out: ExifSummary = {};
  if (isFiniteNum(raw.latitude) && isFiniteNum(raw.longitude)) {
    out.latitude = raw.latitude;
    out.longitude = raw.longitude;
  }
  const str = (v: unknown) => (typeof v === "string" ? v.replace(/\0+$/, "").trim() || undefined : undefined);
  const fields = { dateTimeOriginal: str(raw.DateTimeOriginal), make: str(raw.Make), model: str(raw.Model), software: str(raw.Software) };
  for (const [k, v] of Object.entries(fields)) if (v) out[k as keyof typeof fields] = v;
  return Object.keys(out).length ? out : null;
}

export type CleanCheck = { clean: boolean; found: string[] };

const PNG_META_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
const WEBP_META_CHUNKS = new Set(["EXIF", "XMP "]);

/**
 * Verifikasi ulang versi aman: pemeriksaan struktur (segmen/chunk metadata) lalu `exifr`.
 * Gagal tertutup: format tak dikenal, struktur rusak, atau exifr melempar → dianggap kotor.
 * `found` hanya berisi nama segmen/chunk, tidak pernah nilai metadata.
 */
export async function verifyClean(bytes: Uint8Array): Promise<CleanCheck> {
  const found: string[] = [];
  switch (sniffImageType(bytes)) {
    case "jpeg": {
      const markers = jpegMarkers(bytes);
      if (!markers) found.push("struktur JPEG tidak terbaca");
      else for (const m of markers) if ((m >= 0xe1 && m <= 0xef) || m === 0xfe) found.push(m === 0xfe ? "COM" : `APP${m - 0xe0}`);
      break;
    }
    case "png":
      for (const t of pngChunkTypes(bytes)) if (PNG_META_CHUNKS.has(t)) found.push(t);
      break;
    case "webp":
      for (const c of riffChunks(bytes)) if (WEBP_META_CHUNKS.has(c.type)) found.push(c.type.trim());
      break;
    default:
      found.push("format tidak dikenal");
  }
  try {
    if (await readExif(bytes)) found.push("EXIF");
  } catch {
    found.push("metadata tidak bisa diperiksa");
  }
  return { clean: found.length === 0, found };
}

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const startsWithExifHeader = (b: Uint8Array) =>
  b.length >= 6 && b[0] === 0x45 && b[1] === 0x78 && b[2] === 0x69 && b[3] === 0x66 && b[4] === 0 && b[5] === 0;

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));

/** Marker segmen JPEG sebelum SOS. `null` bila struktur rusak. */
function jpegMarkers(b: Uint8Array): number[] | null {
  const out: number[] = [];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++;
    if (i >= b.length) return null;
    const m = b[i++];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue;
    if (m === 0xda || m === 0xd9) return out; // data gambar mulai / selesai
    if (i + 2 > b.length) return null;
    const len = (b[i] << 8) | b[i + 1];
    if (len < 2) return null;
    out.push(m);
    i += len;
  }
  return null;
}

/**
 * Buang segmen APP1..APP15 dan COM dari JPEG (lossless; data gambar tidak disentuh). Dipakai pada keluaran
 * canvas: encoder sebagian browser (mis. Safari) menambahkan EXIF teknis/ICC sendiri. Hasilnya TETAP
 * diverifikasi ulang oleh `verifyClean`. Bukan JPEG atau struktur rusak → `null` (pemanggil tidak mengubah apa pun).
 */
export function stripJpegMetadata(b: Uint8Array): Uint8Array | null {
  if (!(b.length >= 4 && b[0] === 0xff && b[1] === 0xd8)) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let j = i;
    while (j < b.length && b[j] === 0xff) j++;
    if (j >= b.length) return null;
    const m = b[j];
    if (m === 0xda || m === 0xd9) {
      parts.push(b.subarray(i)); // data gambar sampai akhir file
      return concatBytes(parts);
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      parts.push(b.subarray(i, j + 1));
      i = j + 1;
      continue;
    }
    if (j + 3 > b.length) return null;
    const len = (b[j + 1] << 8) | b[j + 2];
    const end = j + 1 + len;
    if (len < 2 || end > b.length) return null;
    const isMeta = (m >= 0xe1 && m <= 0xef) || m === 0xfe;
    if (!isMeta) parts.push(b.subarray(i, end));
    i = end;
  }
  return null;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function pngChunkTypes(b: Uint8Array): string[] {
  const types: string[] = [];
  let i = 8;
  while (i + 8 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    types.push(type);
    if (type === "IEND") break;
    i += 12 + len;
  }
  return types;
}

function riffChunks(b: Uint8Array): { type: string; data: Uint8Array }[] {
  const chunks: { type: string; data: Uint8Array }[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    chunks.push({ type: ascii(b, i, 4), data: b.subarray(i + 8, Math.min(b.length, i + 8 + len)) });
    i += 8 + len + (len % 2);
  }
  return chunks;
}
