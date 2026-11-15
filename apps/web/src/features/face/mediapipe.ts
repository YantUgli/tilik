/**
 * Pabrik detector MediaPipe (butuh browser). Di-import dinamis HANYA saat pengguna menekan "Cari wajah",
 * jadi WASM tidak membebani pemeriksaan biasa. CDN (WASM) dan model hanya diunduh; gambar tidak dikirim.
 * Lisensi @mediapipe/tasks-vision: Apache-2.0.
 */

import type { FaceDetectorLike } from "./run";

/** Harus sama persis dengan versi di package.json (dicek tes). */
export const TASKS_VISION_VERSION = "1.2.0";
export const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
/** blaze_face_short_range float16, dari storage.googleapis.com/mediapipe-models (disimpan di public/). */
export const FACE_MODEL_PATH = "/models/blaze_face_short_range.tflite";

export async function createMediapipeFaceDetector(): Promise<FaceDetectorLike<ImageBitmap>> {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL_PATH, delegate: "CPU" },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });
  return {
    detect: (image) => detector.detect(image),
    close: () => detector.close(),
  };
}
