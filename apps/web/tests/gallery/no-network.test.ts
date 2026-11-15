import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../../src/features/gallery/", import.meta.url));
const sources = readdirSync(DIR, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ f, text: readFileSync(join(DIR, f), "utf8") }));

describe("modul galeri tanpa jaringan/OCR (FR-UI-02)", () => {
  it("ada file modul yang diperiksa", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  for (const { f, text } of sources) {
    it(`${f}: tidak mengimpor @/lib/api, features/ocr, atau memakai fetch`, () => {
      expect(text).not.toMatch(/["']@\/lib\/api["']/);
      expect(text).not.toMatch(/features\/ocr/);
      expect(text).not.toMatch(/\bfetch\s*\(/);
      expect(text).not.toMatch(/tesseract/i);
    });
  }
});
