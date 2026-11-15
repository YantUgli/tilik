import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GALLERY } from "@/features/gallery/items";
import { readDimensions } from "@/lib/image/dimensions";
import { readExif } from "@/lib/image/metadata";

const PUBLIC = fileURLToPath(new URL("../../public/", import.meta.url));
const pathOf = (image: string) => PUBLIC + image.replace(/^\//, "");
const bytesOf = (id: string) => new Uint8Array(readFileSync(pathOf(GALLERY.find((g) => g.id === id)!.image)));

describe("gambar galeri", () => {
  for (const g of GALLERY) {
    it(`${g.id}: ada di public/gallery/, ≤ 300 KB, sisi ≤ 1600 px`, () => {
      expect(g.image.startsWith("/gallery/")).toBe(true);
      const p = pathOf(g.image);
      expect(existsSync(p)).toBe(true);
      expect(statSync(p).size).toBeLessThanOrEqual(300 * 1024);
      const dims = readDimensions(new Uint8Array(readFileSync(p)));
      expect(dims).not.toBeNull();
      expect(Math.max(dims!.width, dims!.height)).toBeLessThanOrEqual(1600);
    });
  }

  it("galeri-02.jpg memuat GPS fiktif", async () => {
    const exif = await readExif(bytesOf("galeri-02"));
    expect(exif?.latitude).toBeCloseTo(-6.9, 3);
    expect(exif?.longitude).toBeCloseTo(107.61, 3);
  });

  it("galeri-01 dan galeri-03 tanpa GPS", async () => {
    for (const id of ["galeri-01", "galeri-03"]) {
      const exif = await readExif(bytesOf(id));
      expect(exif?.latitude).toBeUndefined();
    }
  });
});
