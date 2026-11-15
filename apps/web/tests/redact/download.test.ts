import { describe, expect, it, vi } from "vitest";
import { SAFE_FAILED_MESSAGE } from "@/features/l1/safe-download";
import { SAFE_NAME_PLAIN, SAFE_NAME_REDACTED, makeRedactedDownload, safeFileName } from "@/features/redact/download";
import { jfifJpeg, pngWithText } from "../l1/fixtures";

const jpeg = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: "image/jpeg" });
const BOX = [0.1, 0.1, 0.2, 0.05];

describe("makeRedactedDownload (encoder di-inject)", () => {
  it("encoder menghasilkan bytes ber-metadata yang tidak bisa dibuang → tetap ditolak", async () => {
    const encode = vi.fn(async () => new Blob([pngWithText() as BlobPart], { type: "image/png" }));
    await expect(makeRedactedDownload(encode, [BOX])).rejects.toThrow(SAFE_FAILED_MESSAGE);
  });

  it("encoder melempar → ditolak dengan pesan yang sama", async () => {
    await expect(
      makeRedactedDownload(async () => {
        throw new Error("canvas");
      }, []),
    ).rejects.toThrow(SAFE_FAILED_MESSAGE);
  });

  it("bytes bersih → Blob, area aktif diteruskan ke encoder", async () => {
    const encode = vi.fn(async () => jpeg(jfifJpeg()));
    const out = await makeRedactedDownload(encode, [BOX]);
    expect(out.blob).toBeInstanceOf(Blob);
    expect(encode).toHaveBeenCalledWith([BOX]);
  });

  it("nama file sesuai ada/tidaknya area aktif", async () => {
    const encode = async () => jpeg(jfifJpeg());
    expect((await makeRedactedDownload(encode, [BOX])).name).toBe("foto-aman.jpg");
    expect((await makeRedactedDownload(encode, [])).name).toBe("foto-tanpa-metadata.jpg");
    expect(safeFileName(2)).toBe(SAFE_NAME_REDACTED);
    expect(safeFileName(0)).toBe(SAFE_NAME_PLAIN);
  });
});
