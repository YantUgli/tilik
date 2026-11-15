/**
 * Fixture bytes untuk tes L1. Semua nilai fiktif (koordinat, merek, model).
 * JPEG ber-EXIF dibuat dengan piexifjs; PNG dibangun manual per chunk (dengan CRC benar).
 */
import piexif from "piexifjs";

/** JPEG minimal tanpa APP1: SOI, DQT, SOS, EOI. Bukan gambar yang bisa di-decode; cukup untuk parser metadata. */
export const plainJpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xda, 0, 2, 0, 0xff, 0xd9]);

/** JPEG dengan JFIF APP0 saja (seperti keluaran canvas). */
export const jfifJpeg = () =>
  new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xda, 0, 2, 0, 0xff, 0xd9,
  ]);

export const FAKE = { lat: -6.9, lon: 107.61, make: "ContohHP", model: "X1", software: "Kamera 1.0", date: "2026:11:13 08:30:00" };

type ExifParts = { gps?: boolean; date?: boolean; device?: boolean; software?: boolean };

function exifDict({ gps = true, date = true, device = true, software = true }: ExifParts = {}) {
  const zeroth: Record<number, string> = {};
  if (device) {
    zeroth[piexif.ImageIFD.Make] = FAKE.make;
    zeroth[piexif.ImageIFD.Model] = FAKE.model;
  }
  if (software) zeroth[piexif.ImageIFD.Software] = FAKE.software;
  const exif: Record<number, string> = date ? { [piexif.ExifIFD.DateTimeOriginal]: FAKE.date } : {};
  const g: Record<number, unknown> = {};
  if (gps) {
    g[piexif.GPSIFD.GPSLatitudeRef] = FAKE.lat < 0 ? "S" : "N";
    g[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(FAKE.lat));
    g[piexif.GPSIFD.GPSLongitudeRef] = "E";
    g[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(FAKE.lon);
  }
  return { "0th": zeroth, Exif: exif, GPS: g };
}

const toBinary = (b: Uint8Array) => Buffer.from(b).toString("binary");
const fromBinary = (s: string) => new Uint8Array(Buffer.from(s, "binary"));

/** JPEG dengan APP1 EXIF (GPS, waktu, perangkat, software sesuai opsi). */
export function exifJpeg(parts?: ExifParts): Uint8Array {
  return fromBinary(piexif.insert(piexif.dump(exifDict(parts)), toBinary(plainJpeg())));
}

/** Data TIFF mentah (isi segmen EXIF tanpa header "Exif\0\0"), untuk chunk eXIf PNG / EXIF WebP. */
export const rawTiff = (parts?: ExifParts) => fromBinary(piexif.dump(exifDict(parts))).subarray(6);

// --- PNG ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: number[]) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const chunk = (type: string, data: ArrayLike<number>) => {
  const td = [...ascii(type), ...Array.from(data)];
  return [...be32(data.length), ...td, ...be32(crc32(td))];
};

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = chunk("IHDR", [...be32(1), ...be32(1), 8, 2, 0, 0, 0]);
const IDAT = chunk("IDAT", [0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0, 0, 0, 4, 0, 1]);
const IEND = chunk("IEND", []);

export const plainPng = () => new Uint8Array([...PNG_SIG, ...IHDR, ...IDAT, ...IEND]);

/** PNG dengan chunk tEXt (komentar) dan eXIf (TIFF ber-GPS). */
export const pngWithText = () =>
  new Uint8Array([...PNG_SIG, ...IHDR, ...chunk("tEXt", ascii("Comment\0lokasi fiktif")), ...IDAT, ...IEND]);
export const pngWithExif = () => new Uint8Array([...PNG_SIG, ...IHDR, ...chunk("eXIf", rawTiff()), ...IDAT, ...IEND]);
export const pngWithTextAndExif = () =>
  new Uint8Array([
    ...PNG_SIG, ...IHDR,
    ...chunk("tEXt", ascii("Comment\0lokasi fiktif")),
    ...chunk("eXIf", rawTiff()),
    ...IDAT, ...IEND,
  ]);

// --- WebP ---
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const riffChunk = (type: string, data: ArrayLike<number>) => {
  const d = Array.from(data);
  return [...ascii(type), ...le32(d.length), ...d, ...(d.length % 2 ? [0] : [])];
};
const VP8X = riffChunk("VP8X", [0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const riff = (chunks: number[]) => new Uint8Array([...ascii("RIFF"), ...le32(chunks.length + 4), ...ascii("WEBP"), ...chunks]);

export const plainWebp = () => riff([...VP8X]);
export const webpWithExif = () => riff([...VP8X, ...riffChunk("EXIF", rawTiff())]);
