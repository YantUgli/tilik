import { describe, expect, it } from "vitest";
import { SEND_MAX_SIDE, WORK_MAX_SIDE, targetSize } from "@/lib/image/resize";

describe("targetSize", () => {
  it("batas sisi sesuai kartu", () => {
    expect(WORK_MAX_SIDE).toBe(2048);
    expect(SEND_MAX_SIDE).toBe(1024);
  });

  it("mempertahankan rasio untuk landscape dan portrait", () => {
    expect(targetSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(targetSize(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 });
    expect(targetSize(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it("tidak pernah memperbesar gambar kecil", () => {
    expect(targetSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
    expect(targetSize(1024, 1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });

  it("sisi terpanjang tidak melewati batas dan sisi pendek minimal 1 px", () => {
    const r = targetSize(10000, 3, 1024);
    expect(r.width).toBe(1024);
    expect(r.height).toBe(1);
    const odd = targetSize(4033, 3025, 1024);
    expect(Math.max(odd.width, odd.height)).toBeLessThanOrEqual(1024);
    expect(odd.width / odd.height).toBeCloseTo(4033 / 3025, 2);
  });
});
