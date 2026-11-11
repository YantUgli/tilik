/**
 * Membaca lebar/tinggi dari header JPEG (SOFn), PNG (IHDR), dan WebP (VP8/VP8L/VP8X)
 * tanpa decode piksel, untuk menolak decompression bomb sebelum `createImageBitmap`.
 * Fungsi murni. Dimensi JPEG adalah dimensi tersimpan (sebelum orientasi EXIF);
 * untuk batas piksel itu tidak berpengaruh.
 */

import { sniffImageType } from "./sniff";

export type Dimensions = { width: number; height: number };

export const MAX_PIXELS = 40_000_000;

export const exceedsPixelLimit = ({ width, height }: Dimensions) => width * height > MAX_PIXELS;

export function readDimensions(bytes: Uint8Array): Dimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let dims: Dimensions | null = null;
  switch (sniffImageType(bytes)) {
    case "jpeg":
      dims = readJpeg(bytes, view);
      break;
    case "png":
      dims = readPng(bytes, view);
      break;
    case "webp":
      dims = readWebp(bytes, view);
      break;
  }
  return dims && dims.width > 0 && dims.height > 0 ? dims : null;
}

function readPng(b: Uint8Array, v: DataView): Dimensions | null {
  if (b.length < 24 || String.fromCharCode(...b.subarray(12, 16)) !== "IHDR") return null;
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

// SOF0..SOF15 kecuali DHT (C4), JPG (C8), DAC (CC).
const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

function readJpeg(b: Uint8Array, v: DataView): Dimensions | null {
  let i = 2; // lewati SOI
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++; // byte pengisi
    if (i >= b.length) return null;
    const marker = b[i++];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // tanpa panjang
    if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS sebelum SOF
    if (i + 2 > b.length) return null;
    const len = v.getUint16(i);
    if (len < 2) return null;
    if (isSof(marker)) {
      if (i + 7 > b.length) return null;
      return { height: v.getUint16(i + 3), width: v.getUint16(i + 5) };
    }
    i += len;
  }
  return null;
}

function readWebp(b: Uint8Array, v: DataView): Dimensions | null {
  if (b.length < 16) return null;
  const chunk = String.fromCharCode(...b.subarray(12, 16));
  if (chunk === "VP8 ") {
    if (b.length < 30) return null;
    // frame tag (3) + start code 9D 01 2A + lebar/tinggi 14 bit LE
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = v.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    if (b.length < 30) return null;
    const u24 = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
    return { width: u24(24) + 1, height: u24(27) + 1 };
  }
  return null;
}
