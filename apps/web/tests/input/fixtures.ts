/** Header gambar sintetis minimal untuk tes (bukan gambar utuh; cukup untuk sniff/header). */

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

/** JPEG: SOI, APP1 (EXIF palsu), DQT, byte pengisi 0xFF, lalu SOFn dengan dimensi. */
export function jpeg(width: number, height: number, sof = 0xc0): Uint8Array {
  const app1Payload = [...ascii("Exif\0\0"), ...new Array(200).fill(0x11)];
  const dqtPayload = new Array(65).fill(0x01);
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, ...be16(app1Payload.length + 2), ...app1Payload,
    0xff, 0xdb, ...be16(dqtPayload.length + 2), ...dqtPayload,
    0xff, 0xff, // byte pengisi sebelum marker
    0xff, sof, ...be16(17), 8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
    0xff, 0xda, 0, 2,
  ]);
}

export function png(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be32(13), ...ascii("IHDR"), ...be32(width), ...be32(height), 8, 6, 0, 0, 0,
    0, 0, 0, 0, // CRC (tidak diperiksa)
  ]);
}

const riff = (chunk: number[]) => new Uint8Array([...ascii("RIFF"), ...le32(chunk.length + 4), ...ascii("WEBP"), ...chunk]);

/** WebP lossy (VP8). */
export function webpVp8(width: number, height: number): Uint8Array {
  const data = [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height), 0, 0];
  return riff([...ascii("VP8 "), ...le32(data.length), ...data]);
}

/** WebP lossless (VP8L): 14 bit (lebar-1), 14 bit (tinggi-1). */
export function webpVp8l(width: number, height: number): Uint8Array {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const data = [0x2f, ...le32(bits), 0, 0, 0];
  return riff([...ascii("VP8L"), ...le32(data.length), ...data]);
}

/** WebP extended (VP8X): kanvas 24 bit (lebar-1), 24 bit (tinggi-1). */
export function webpVp8x(width: number, height: number): Uint8Array {
  const data = [0x10, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)];
  return riff([...ascii("VP8X"), ...le32(data.length), ...data]);
}

export function heic(brand = "heic"): Uint8Array {
  return new Uint8Array([...be32(24), ...ascii("ftyp"), ...ascii(brand), 0, 0, 0, 0, ...ascii("mif1"), ...ascii(brand)]);
}

export const gif = () => new Uint8Array([...ascii("GIF89a"), 1, 0, 1, 0, 0, 0, 0]);
export const pdf = () => new Uint8Array(ascii("%PDF-1.7\n%âãÏÓ\n"));
