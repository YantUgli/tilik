import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaceDetection } from "@/features/face/areas";
import { createFaceRunner, type FaceDetectorLike } from "@/features/face/run";

const face: FaceDetection = {
  boundingBox: { originX: 10, originY: 10, width: 20, height: 20 },
  categories: [{ score: 0.9 }],
};

function fake(detect: FaceDetectorLike["detect"]) {
  const close = vi.fn();
  const detector: FaceDetectorLike = { detect, close };
  return { detector, close };
}

describe("createFaceRunner (detector palsu)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sukses → areas", async () => {
    const { detector } = fake(() => ({ detections: [face] }));
    const runner = createFaceRunner(async () => detector);
    const out = await runner.run(null, 100, 100);
    expect(out).toEqual({
      status: "ok",
      areas: [expect.objectContaining({ id: "b-face-0#0", bbox: [0.1, 0.1, 0.2, 0.2] })],
    });
  });

  it("0 wajah → ok dengan areas kosong", async () => {
    const runner = createFaceRunner(async () => fake(() => ({ detections: [] })).detector);
    expect(await runner.run(null, 100, 100)).toEqual({ status: "ok", areas: [] });
  });

  it("error init → failed tanpa throw; coba lagi membuat detector baru", async () => {
    const ok = fake(() => ({ detections: [face] })).detector;
    const create = vi.fn<() => Promise<FaceDetectorLike>>();
    create.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(ok);
    const runner = createFaceRunner(create);
    expect(await runner.run(null, 100, 100)).toEqual({ status: "failed" });
    expect((await runner.run(null, 100, 100)).status).toBe("ok");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("timeout init → failed", async () => {
    const runner = createFaceRunner<null>(() => new Promise<never>(() => undefined), 30_000, 10_000);
    const p = runner.run(null, 100, 100);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toEqual({ status: "failed" });
  });

  it("timeout deteksi → failed, detector di-close", async () => {
    const { detector, close } = fake(() => new Promise<never>(() => undefined));
    const runner = createFaceRunner(async () => detector, 30_000, 10_000);
    const p = runner.run(null, 100, 100);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await p).toEqual({ status: "failed" });
    expect(close).toHaveBeenCalled();
  });

  it("detect throw → failed", async () => {
    const { detector } = fake(() => {
      throw new Error("boom");
    });
    const runner = createFaceRunner(async () => detector);
    expect(await runner.run(null, 100, 100)).toEqual({ status: "failed" });
  });

  it("close() menutup detector; run setelahnya → failed", async () => {
    const { detector, close } = fake(() => ({ detections: [face] }));
    const runner = createFaceRunner(async () => detector);
    await runner.run(null, 100, 100);
    runner.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(close).toHaveBeenCalledTimes(1);
    expect(await runner.run(null, 100, 100)).toEqual({ status: "failed" });
  });
});
