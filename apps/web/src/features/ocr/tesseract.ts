/**
 * Worker Tesseract.js bahasa `ind` (FR-OCR-01). tesseract.js menjalankan OCR di Web Worker-nya sendiri.
 * Worker, core WASM, dan ind.traineddata diunduh dari CDN bawaan tesseract.js (jsdelivr); jalur itu
 * hanya unduhan, gambar dan teks tidak pernah dikirim ke sana. Deviasi ADR-003: belum offline/self-hosted.
 */

import type { OcrWorkerLike } from "./run";
import type { OcrPage } from "./words";

export async function createTesseractWorker(): Promise<OcrWorkerLike> {
  // Dimuat saat dipakai: tidak ikut bundle awal dan tidak dievaluasi saat prerender server.
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker("ind", OEM.LSTM_ONLY);
  return {
    async recognize(image: Blob) {
      const { data } = await worker.recognize(image, {}, { blocks: true });
      return { data: data as unknown as OcrPage };
    },
    terminate: () => worker.terminate(),
  };
}
