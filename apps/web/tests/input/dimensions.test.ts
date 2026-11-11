import { describe, expect, it } from "vitest";
import { MAX_PIXELS, exceedsPixelLimit, readDimensions } from "@/lib/image/dimensions";
import { jpeg, png, webpVp8, webpVp8l, webpVp8x } from "./fixtures";

describe("readDimensions", () => {
  it("JPEG: membaca SOF baseline dan progressive, melewati APPn/DQT/pengisi", () => {
    expect(readDimensions(jpeg(4032, 3024))).toEqual({ width: 4032, height: 3024 });
    expect(readDimensions(jpeg(640, 480, 0xc2))).toEqual({ width: 640, height: 480 });
  });

  it("PNG: membaca IHDR", () => {
    expect(readDimensions(png(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it("WebP: VP8, VP8L, VP8X", () => {
    expect(readDimensions(webpVp8(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(readDimensions(webpVp8l(16383, 2))).toEqual({ width: 16383, height: 2 });
    expect(readDimensions(webpVp8x(20000, 3000))).toEqual({ width: 20000, height: 3000 });
  });

  it("mengembalikan null untuk header terpotong atau format lain", () => {
    expect(readDimensions(jpeg(10, 10).slice(0, 30))).toBeNull();
    expect(readDimensions(png(10, 10).slice(0, 20))).toBeNull();
    expect(readDimensions(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("dimensi nol dianggap tidak terbaca", () => {
    expect(readDimensions(png(0, 10))).toBeNull();
  });
});

describe("batas piksel", () => {
  it("8000×6000 (48 MP) ditolak, 40 MP pas diterima", () => {
    const big = readDimensions(jpeg(8000, 6000));
    expect(big).not.toBeNull();
    expect(exceedsPixelLimit(big!)).toBe(true);
    expect(MAX_PIXELS).toBe(40_000_000);
    expect(exceedsPixelLimit({ width: 8000, height: 5000 })).toBe(false);
    expect(exceedsPixelLimit({ width: 4000, height: 3000 })).toBe(false);
  });
});
