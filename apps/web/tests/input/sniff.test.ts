import { describe, expect, it } from "vitest";
import { sniffImageType } from "@/lib/image/sniff";
import { MESSAGES, validateImageFile } from "@/features/input/validate-file";
import { gif, heic, jpeg, pdf, png, webpVp8, webpVp8l, webpVp8x } from "./fixtures";

describe("sniffImageType", () => {
  it("mengenali JPEG, PNG, WebP dari magic bytes", () => {
    expect(sniffImageType(jpeg(10, 10))).toBe("jpeg");
    expect(sniffImageType(png(10, 10))).toBe("png");
    expect(sniffImageType(webpVp8(10, 10))).toBe("webp");
    expect(sniffImageType(webpVp8l(10, 10))).toBe("webp");
    expect(sniffImageType(webpVp8x(10, 10))).toBe("webp");
  });

  it("menandai HEIC/HEIF secara khusus", () => {
    for (const brand of ["heic", "heix", "hevc", "mif1"]) expect(sniffImageType(heic(brand))).toBe("heic");
  });

  it("menolak GIF, PDF, file kosong, dan RIFF non-WebP", () => {
    expect(sniffImageType(gif())).toBeNull();
    expect(sniffImageType(pdf())).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    const wav = webpVp8(1, 1).slice();
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    expect(sniffImageType(wav)).toBeNull();
  });
});

describe("validateImageFile", () => {
  const file = (bytes: Uint8Array, name: string, type = "") => new File([bytes as BlobPart], name, { type });

  it("JPEG yang diganti ekstensi .png dikenali sebagai JPEG", async () => {
    const r = await validateImageFile(file(jpeg(4000, 3000), "foto.png", "image/png"));
    expect(r).toEqual({ ok: true, type: "jpeg", mime: "image/jpeg", width: 4000, height: 3000 });
  });

  it("ekstensi .jpg tidak menyelamatkan PDF", async () => {
    expect(await validateImageFile(file(pdf(), "foto.jpg", "image/jpeg"))).toEqual({ ok: false, message: MESSAGES.unsupported });
  });

  it("HEIC ditolak dengan pesan khusus", async () => {
    expect(await validateImageFile(file(heic(), "IMG_0001.HEIC"))).toEqual({ ok: false, message: MESSAGES.heic });
  });

  it("file > 10 MB ditolak", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(jpeg(100, 100));
    expect(await validateImageFile(file(big, "besar.jpg"))).toEqual({ ok: false, message: MESSAGES.tooLarge });
  });

  it("tepat 10 MB diterima", async () => {
    const edge = new Uint8Array(10 * 1024 * 1024);
    edge.set(jpeg(100, 100));
    expect((await validateImageFile(file(edge, "pas.jpg"))).ok).toBe(true);
  });

  it("resolusi > 40 MP ditolak, header rusak ditolak", async () => {
    expect(await validateImageFile(file(png(8000, 6000), "a.png"))).toEqual({ ok: false, message: MESSAGES.tooManyPixels });
    expect(await validateImageFile(file(jpeg(100, 100).slice(0, 40), "rusak.jpg"))).toEqual({ ok: false, message: MESSAGES.unreadable });
  });
});
