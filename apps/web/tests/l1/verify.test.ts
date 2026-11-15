import { describe, expect, it } from "vitest";
import { SAFE_FAILED_MESSAGE, SafeVersionError, makeSafeDownload } from "@/features/l1/safe-download";
import { stripJpegMetadata, verifyClean } from "@/lib/image/metadata";
import {
  exifJpeg,
  jfifJpeg,
  plainJpeg,
  plainPng,
  plainWebp,
  pngWithExif,
  pngWithText,
  pngWithTextAndExif,
  webpWithExif,
} from "./fixtures";

describe("verifyClean", () => {
  it("JPEG ber-GPS → kotor", async () => {
    const r = await verifyClean(exifJpeg());
    expect(r.clean).toBe(false);
    expect(r.found.length).toBeGreaterThan(0);
  });

  it("JPEG hanya waktu/perangkat (tanpa GPS) → tetap kotor", async () => {
    expect((await verifyClean(exifJpeg({ gps: false }))).clean).toBe(false);
  });

  it("JPEG minimal tanpa APP1 → bersih", async () => {
    expect(await verifyClean(plainJpeg())).toEqual({ clean: true, found: [] });
  });

  it("JPEG dengan JFIF APP0 saja (keluaran canvas) → bersih", async () => {
    expect((await verifyClean(jfifJpeg())).clean).toBe(true);
  });

  it("png_text_chunks: PNG dengan tEXt dan/atau eXIf → kotor; PNG polos → bersih", async () => {
    expect((await verifyClean(pngWithText())).clean).toBe(false);
    expect((await verifyClean(pngWithExif())).clean).toBe(false);
    expect((await verifyClean(pngWithTextAndExif())).clean).toBe(false);
    expect((await verifyClean(plainPng())).clean).toBe(true);
  });

  it("WebP dengan chunk EXIF → kotor; WebP polos → bersih", async () => {
    expect((await verifyClean(webpWithExif())).clean).toBe(false);
    expect((await verifyClean(plainWebp())).clean).toBe(true);
  });

  it("format tak dikenal → gagal tertutup (kotor)", async () => {
    expect((await verifyClean(new Uint8Array([1, 2, 3, 4]))).clean).toBe(false);
  });
});

const blobOf = (b: Uint8Array) => new Blob([b as BlobPart], { type: "image/jpeg" });

describe("makeSafeDownload (FR-L1-04)", () => {
  it("JPEG dengan EXIF dari encoder (mis. Safari) → segmen dibuang, hasil bersih dan terverifikasi", async () => {
    const blob = await makeSafeDownload(async () => blobOf(exifJpeg()));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe("image/jpeg");
    expect(await verifyClean(bytes)).toEqual({ clean: true, found: [] });
    expect(bytes.length).toBeLessThan(exifJpeg().length);
  });

  it("stripJpegMetadata: APP1 dibuang, JFIF APP0 tetap; bukan JPEG/rusak → null", () => {
    const s = stripJpegMetadata(exifJpeg());
    expect(s).not.toBeNull();
    expect(s![0]).toBe(0xff);
    expect(s![1]).toBe(0xd8);
    expect(stripJpegMetadata(jfifJpeg())).toEqual(jfifJpeg());
    expect(stripJpegMetadata(plainPng())).toBeNull();
    expect(stripJpegMetadata(exifJpeg().subarray(0, 10))).toBeNull();
  });

  it("verifier tetap menolak sisa metadata → melempar dengan pesan UI", async () => {
    const p = makeSafeDownload(async () => new Blob([pngWithText() as BlobPart], { type: "image/png" }));
    await expect(p).rejects.toBeInstanceOf(SafeVersionError);
    await expect(p).rejects.toThrow("Versi aman gagal dibuat, coba lagi");
    expect(SAFE_FAILED_MESSAGE).toBe("Versi aman gagal dibuat, coba lagi");
  });

  it("encoder gagal → pesan yang sama", async () => {
    await expect(
      makeSafeDownload(async () => {
        throw new Error("canvas");
      }),
    ).rejects.toThrow(SAFE_FAILED_MESSAGE);
  });

  it("verifier melempar → gagal tertutup", async () => {
    await expect(
      makeSafeDownload(
        async () => blobOf(plainJpeg()),
        async () => {
          throw new Error("x");
        },
      ),
    ).rejects.toThrow(SAFE_FAILED_MESSAGE);
  });

  it("bytes bersih → Blob JPEG dikembalikan", async () => {
    const blob = await makeSafeDownload(async () => blobOf(jfifJpeg()));
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/jpeg");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(jfifJpeg());
  });
});
