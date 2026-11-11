import { describe, expect, it } from "vitest";
import { CAPTION_MAX, checkCaption, countCaptionChars } from "@/features/input/caption";

describe("caption", () => {
  it("batas 2.200 karakter", () => {
    expect(CAPTION_MAX).toBe(2200);
    expect(checkCaption("a".repeat(2200))).toEqual({ count: 2200, ok: true });
    expect(checkCaption("a".repeat(2201))).toEqual({ count: 2201, ok: false });
  });

  it("caption kosong boleh (opsional)", () => {
    expect(checkCaption("")).toEqual({ count: 0, ok: true });
  });

  it("emoji dihitung sebagai satu karakter tampilan", () => {
    expect(countCaptionChars("👍")).toBe(1);
    expect(countCaptionChars("👨‍👩‍👧‍👦")).toBe(1); // ZWJ
    expect(countCaptionChars("🇮🇩")).toBe(1); // bendera
    expect(countCaptionChars("👍🏽")).toBe(1); // warna kulit
    expect(countCaptionChars("Halo 👋")).toBe(6);
  });

  it("2.200 emoji diterima, 2.201 ditolak", () => {
    expect(checkCaption("😀".repeat(2200)).ok).toBe(true);
    expect(checkCaption("😀".repeat(2201)).ok).toBe(false);
  });
});
