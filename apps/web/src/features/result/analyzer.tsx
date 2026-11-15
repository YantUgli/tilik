"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { GalleryPicker, GalleryView } from "@/features/gallery/gallery";
import type { GalleryItem } from "@/features/gallery/items";
import { L1Card } from "@/features/l1/l1-card";
import { PhotoInput, type PreparedInput } from "@/features/input/photo-input";
import { createOcrRunner, type OcrOutcome, type OcrRunner } from "@/features/ocr/run";
import { createTesseractWorker } from "@/features/ocr/tesseract";
import { collectAreas } from "@/features/redact/areas";
import { analyzeCaption, resolveApiUrl } from "@/lib/api";
import { encodeSafeJpeg, type PreparedImages } from "@/lib/image/downscale";
import { computeRisk } from "@/lib/risk";
import type { LayerResult } from "@/lib/validate";
import { LayerCard } from "./layer-card";
import { RiskCard } from "./risk-card";
import { OCR_FAILED_NOTE, OCR_PENDING_NOTE, SERVER_TITLES, initialSession, sessionReducer } from "./session";

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

/**
 * OCR dari bitmap kerja (≤ 2048 px, orientasi sudah diterapkan; FR-IN-03), bukan File asli.
 * Di-encode lewat helper canvas yang sama dengan versi aman L1 (tanpa resize, jadi ukurannya = bitmap kerja).
 * Bitmap yang sudah ditutup (foto diganti) → encode gagal → error, yang lalu dibuang sebagai hasil basi.
 */
async function readText(runner: OcrRunner, images: PreparedImages): Promise<OcrOutcome> {
  const { width, height } = images.work;
  let image: Blob;
  try {
    image = await encodeSafeJpeg(images.work);
  } catch {
    return { status: "error", reason: "failed" };
  }
  return runner.run(image, width, height);
}

/**
 * Satu tombol "Periksa": L1 (di perangkat) dan OCR (di perangkat) jalan; setelah OCR selesai atau gagal,
 * caption + teks OCR dikirim ke /analyze/caption (SPEC §2 langkah 3). Hasil tampil progresif per lapis;
 * risiko akhir muncul setelah semua lapis selesai.
 */
export function Analyzer() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  const [input, setInput] = useState<PreparedInput | null>(null);
  const nextId = useRef(0);
  /** id analisis yang masih berlaku; 0 = tidak ada (foto diganti/dihapus). */
  const active = useRef(0);
  const ocr = useRef<OcrRunner | null>(null);
  /** Contoh galeri yang terbuka (FR-UI-02). Galeri dan analisis sendiri tidak pernah tampil bersamaan. */
  const [example, setExample] = useState<GalleryItem | null>(null);
  /** Dinaikkan saat contoh dibuka supaya form unggah kosong lagi. */
  const [formKey, setFormKey] = useState(0);

  useEffect(() => () => ocr.current?.cancel(), []);

  const onSubmit = useCallback((inp: PreparedInput) => {
    const id = ++nextId.current;
    active.current = id;
    const runner = (ocr.current ??= createOcrRunner(createTesseractWorker));
    runner.cancel(); // OCR analisis sebelumnya (bila masih jalan) tidak lagi berguna
    setInput(inp);
    dispatch({ type: "submit", id });
    readText(runner, inp.images).then((outcome) => {
      // Hasil basi atau dibatalkan: jangan tampilkan, jangan kirim request.
      if (active.current !== id || outcome.status === "cancelled") return;
      dispatch({ type: "ocr", id, status: outcome.status });
      const payload = outcome.status === "ok" ? outcome.payload : null;
      // Respons untuk id lama diabaikan reducer.
      return analyzeCaption(API_URL, inp.caption, payload).then((result) => dispatch({ type: "server", id, result }));
    });
  }, []);

  const onChange = useCallback(() => {
    setExample(null); // memilih foto sendiri menutup galeri
    active.current = 0;
    ocr.current?.cancel();
    setInput(null);
    dispatch({ type: "reset" });
  }, []);

  const openExample = useCallback(
    (item: GalleryItem) => {
      onChange(); // hentikan analisis yang berjalan, buang hasilnya
      setFormKey((k) => k + 1);
      setExample(item);
    },
    [onChange],
  );

  const id = session.id;
  const onL1 = useCallback((result: LayerResult) => dispatch({ type: "l1", id, result }), [id]);

  const server = session.server;
  const serverLayers: (LayerResult | null)[] = server ? server.layers : [null, null, null];
  // Area redaksi hanya dari temuan server (redactable + evidence.bboxes); kosong sebelum server menjawab.
  const areas = useMemo(() => collectAreas(server ? server.layers : []), [server]);
  const all = session.l1 && server ? [session.l1, ...server.layers] : null;
  const risk = all ? computeRisk(all, { extraIncomplete: session.ocr === "error" }) : null;

  return (
    <>
      {example ? (
        <GalleryView item={example} onClose={() => setExample(null)} />
      ) : (
        <GalleryPicker onOpen={openExample} />
      )}

      <PhotoInput key={formKey} onSubmit={onSubmit} onChange={onChange} />

      {!example && input && id !== 0 && (
        <div className="results">
          <RiskCard risk={risk}>
            {server?.problem === "busy" && <p className="status warn">{server.message}</p>}
          </RiskCard>

          <L1Card key={id} file={input.file} images={input.images} areas={areas} onResult={onL1} />

          {serverLayers.map((layer, i) => (
            <LayerCard key={`${id}-${i}`} title={SERVER_TITLES[i]} layer={layer} busy={server?.problem === "busy"}>
              {i === 0 && session.ocr === "pending" && <p className="muted small">{OCR_PENDING_NOTE}</p>}
              {i === 0 && session.ocr === "error" && <p className="status warn">{OCR_FAILED_NOTE}</p>}
            </LayerCard>
          ))}
        </div>
      )}
    </>
  );
}
