import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FACE_MAX, faceAreas, type FaceDetection } from "@/features/face/areas";
import { TASKS_VISION_VERSION, WASM_BASE } from "@/features/face/mediapipe";
import { activeBoxes, activeTargets, mergeAreas, toPixelRect, type RedactArea } from "@/features/redact/areas";

const det = (originX: number, originY: number, width: number, height: number, score = 0.9): FaceDetection => ({
  boundingBox: { originX, originY, width, height },
  categories: [{ score }],
});

describe("faceAreas", () => {
  it("piksel → relatif 0..1", () => {
    const [a] = faceAreas([det(100, 50, 200, 100)], 1000, 500);
    expect(a.bbox).toEqual([0.1, 0.1, 0.2, 0.2]);
    expect(a.kind).toBe("face");
  });

  it("clamp ke tepi gambar", () => {
    const [a, b] = faceAreas([det(-50, -20, 150, 120), det(900, 450, 200, 100)], 1000, 500);
    expect(a.bbox).toEqual([0, 0, 0.1, 0.2]);
    expect(b.bbox).toEqual([0.9, 0.9, 0.1, 0.1]);
  });

  it("skor rendah dan kotak tidak valid dibuang", () => {
    const bad: FaceDetection[] = [
      det(10, 10, 50, 50, 0.49),
      det(10, 10, 0, 50),
      det(10, 10, 50, -1),
      det(Number.NaN, 10, 50, 50),
      det(2000, 10, 50, 50), // seluruhnya di luar gambar
      { categories: [{ score: 0.9 }] },
      { boundingBox: { originX: 1, originY: 1, width: 5, height: 5 } },
      { boundingBox: { originX: 1, originY: 1, width: 5, height: 5 }, categories: [] },
    ];
    expect(faceAreas(bad, 1000, 500)).toEqual([]);
    expect(faceAreas([det(10, 10, 50, 50, 0.5)], 1000, 500)).toHaveLength(1);
    expect(faceAreas([det(10, 10, 50, 50)], 0, 500)).toEqual([]);
  });

  it(`maksimal ${FACE_MAX} wajah`, () => {
    const many = Array.from({ length: 30 }, (_, i) => det(i * 10, 0, 8, 8));
    expect(faceAreas(many, 1000, 500)).toHaveLength(FACE_MAX);
  });

  it("id/label stabil dan berurutan setelah penyaringan", () => {
    const out = faceAreas([det(0, 0, 10, 10), det(0, 0, 10, 10, 0.1), det(20, 20, 10, 10)], 100, 100);
    expect(out.map((a) => [a.id, a.findingId, a.label])).toEqual([
      ["b-face-0#0", "b-face-0", "Wajah 1"],
      ["b-face-1#0", "b-face-1", "Wajah 2"],
    ]);
    expect(faceAreas([det(0, 0, 10, 10), det(20, 20, 10, 10)], 100, 100)).toEqual(out);
  });
});

describe("penggabungan area server + wajah", () => {
  const server: RedactArea[] = [
    { id: "c-1#0", findingId: "c-1", label: "Kop", bbox: [0, 0, 0.1, 0.1] },
    { id: "c-1#1", findingId: "c-1", label: "Kop", bbox: [0.2, 0.2, 0.1, 0.1] },
  ];
  const faces = faceAreas([det(50, 50, 10, 10), det(70, 70, 10, 10)], 100, 100);

  it("gabungan = server lalu wajah; tanpa wajah = server saja", () => {
    expect(mergeAreas(server, faces).map((a) => a.id)).toEqual(["c-1#0", "c-1#1", "b-face-0#0", "b-face-1#0"]);
    expect(mergeAreas(server, [])).toEqual(server);
    expect(mergeAreas([], faces)).toEqual(faces);
  });

  it("toggle independen: area aktif = gabungan minus yang dimatikan", () => {
    const disabled = new Set(["c-1#1", "b-face-0#0"]);
    expect(activeTargets(mergeAreas(server, faces), disabled)).toEqual([
      { bbox: [0, 0, 0.1, 0.1], face: false },
      { bbox: [0.7, 0.7, 0.1, 0.1], face: true },
    ]);
    expect(activeBoxes(mergeAreas(server, faces), disabled)).toEqual([
      [0, 0, 0.1, 0.1],
      [0.7, 0.7, 0.1, 0.1],
    ]);
  });

  it("area server yang datang belakangan tidak mengubah toggle wajah (dan sebaliknya)", () => {
    const disabled = new Set(["b-face-1#0"]);
    const before = activeTargets(mergeAreas([], faces), disabled);
    const after = activeTargets(mergeAreas(server, faces), disabled);
    expect(before).toEqual([{ bbox: [0.5, 0.5, 0.1, 0.1], face: true }]);
    expect(after.filter((t) => t.face)).toEqual(before);
    const off = new Set(["c-1#0"]);
    expect(activeTargets(mergeAreas(server, faces), off).filter((t) => !t.face)).toEqual(
      activeTargets(mergeAreas(server, []), off),
    );
  });
});

describe("blok mosaik wajah", () => {
  it("wajah: max(8, ⌈sisi terpendek/6⌉); persegi sama; teks tetap max(8, ½ tinggi)", () => {
    const bbox = [0.1, 0.1, 0.5, 0.3];
    const text = toPixelRect(bbox, 1000, 1000)!;
    const face = toPixelRect(bbox, 1000, 1000, true)!;
    expect({ ...face, block: 0 }).toEqual({ ...text, block: 0 });
    expect(text.block).toBe(Math.max(8, Math.ceil(text.h / 2)));
    expect(face.block).toBe(Math.max(8, Math.ceil(Math.min(face.w, face.h) / 6)));
    expect(toPixelRect([0, 0, 0.01, 0.01], 1000, 1000, true)!.block).toBe(8);
  });
});

describe("versi MediaPipe", () => {
  it("WASM CDN memakai versi yang sama persis dengan package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies["@mediapipe/tasks-vision"]).toBe(TASKS_VISION_VERSION);
    expect(WASM_BASE).toContain(`@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`);
  });
});
