import { afterEach, describe, expect, it, vi } from "vitest";
import { OCR_TIMEOUT_MS, createOcrRunner, type OcrWorkerLike } from "@/features/ocr/run";
import type { OcrPage } from "@/features/ocr/words";

const image = new Blob([new Uint8Array([1])]);
const pageWith = (text: string): OcrPage => ({
  blocks: [{ paragraphs: [{ lines: [{ words: [{ text, confidence: 95, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }] }] }] }],
});

function fakeWorker(recognize: OcrWorkerLike["recognize"]) {
  return { recognize: vi.fn(recognize), terminate: vi.fn(async () => undefined) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createOcrRunner", () => {
  it("OCR_TIMEOUT_MS = 20 detik (FR-OCR-03)", () => {
    expect(OCR_TIMEOUT_MS).toBe(20_000);
  });

  it("sukses → ok dengan payload; worker dibuat sekali lalu dipakai ulang", async () => {
    const w = fakeWorker(async () => ({ data: pageWith("RAHASIA") }));
    const create = vi.fn(async () => w);
    const runner = createOcrRunner(create);
    const a = await runner.run(image, 100, 100);
    const b = await runner.run(image, 100, 100);
    expect(a).toEqual({ status: "ok", payload: { ocr_text: "RAHASIA", ocr_words: [{ text: "RAHASIA", conf: 95, bbox: [0, 0, 0.1, 0.1] }] } });
    expect(b.status).toBe("ok");
    expect(create).toHaveBeenCalledTimes(1);
    expect(w.terminate).not.toHaveBeenCalled();
  });

  it("sukses tanpa teks → ok dengan null", async () => {
    const runner = createOcrRunner(async () => fakeWorker(async () => ({ data: { blocks: [] } })));
    expect(await runner.run(image, 10, 10)).toEqual({ status: "ok", payload: { ocr_text: null, ocr_words: null } });
  });

  it("timeout 20 dtk → error, worker di-terminate dan dibuat ulang berikutnya", async () => {
    vi.useFakeTimers();
    const hang = fakeWorker(() => new Promise(() => {}));
    const ok = fakeWorker(async () => ({ data: pageWith("A") }));
    const create = vi.fn().mockResolvedValueOnce(hang).mockResolvedValueOnce(ok);
    const runner = createOcrRunner(create);
    const p = runner.run(image, 10, 10);
    await vi.advanceTimersByTimeAsync(OCR_TIMEOUT_MS - 1);
    expect(hang.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ status: "error", reason: "timeout" });
    expect(hang.terminate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    expect((await runner.run(image, 10, 10)).status).toBe("ok");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("recognizer melempar → error, worker di-terminate", async () => {
    const w = fakeWorker(async () => {
      throw new Error("rusak");
    });
    const runner = createOcrRunner(async () => w);
    expect(await runner.run(image, 10, 10)).toEqual({ status: "error", reason: "failed" });
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it("pembuatan worker gagal → error", async () => {
    const runner = createOcrRunner(async () => {
      throw new Error("cdn");
    });
    expect(await runner.run(image, 10, 10)).toEqual({ status: "error", reason: "failed" });
  });

  it("cancel() saat berjalan → hasil 'cancelled', worker di-terminate", async () => {
    const w = fakeWorker(() => new Promise(() => {}));
    const runner = createOcrRunner(async () => w);
    const p = runner.run(image, 10, 10);
    await Promise.resolve();
    runner.cancel();
    expect(await p).toEqual({ status: "cancelled" });
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it("cancel() saat diam → tidak terminate", async () => {
    const w = fakeWorker(async () => ({ data: pageWith("A") }));
    const runner = createOcrRunner(async () => w);
    await runner.run(image, 10, 10);
    runner.cancel();
    expect(w.terminate).not.toHaveBeenCalled();
  });
});
