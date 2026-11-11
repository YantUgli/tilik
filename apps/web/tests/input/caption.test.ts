import { describe, expect, it } from "vitest";
import { CAPTION_MAX, CAPTION_MESSAGES, captionProblem, checkCaption, countCaptionChars } from "@/features/input/caption";

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

  describe("sejajar dengan batas code point server (opsi a)", () => {
    const family = "👨‍👩‍👧‍👦"; // 1 grapheme, 7 code point

    it("2.000 emoji keluarga: penghitung 2.000, tetapi ditolak", () => {
      const r = checkCaption(family.repeat(2000));
      expect(r).toEqual({ count: 2000, ok: false });
      expect(captionProblem(r)).toBe(CAPTION_MESSAGES.codePoints);
    });

    it("tepat 2.200 code point lolos, 2.201 ditolak", () => {
      const exact = "a".repeat(2200 - 7) + family; // 2.194 grapheme, 2.200 code point
      expect(Array.from(exact).length).toBe(2200);
      expect(checkCaption(exact)).toEqual({ count: 2194, ok: true });
      expect(checkCaption("a" + exact)).toEqual({ count: 2195, ok: false });
    });

    it("pesan code point hanya bila penghitung masih dalam batas", () => {
      // lewat batas grapheme sudah ditandai penghitung ("terlalu panjang"), tanpa pesan tambahan
      expect(captionProblem(checkCaption("a".repeat(2201)))).toBeNull();
      expect(captionProblem(checkCaption(family.repeat(2201)))).toBeNull();
      expect(captionProblem(checkCaption("a".repeat(2200)))).toBeNull();
      expect(CAPTION_MESSAGES.codePoints).toBe("Caption terlalu panjang. Emoji tertentu dihitung lebih dari satu karakter.");
    });
  });
});
