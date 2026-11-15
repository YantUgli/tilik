"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeBoxes, type Bbox, type RedactArea } from "@/features/redact/areas";
import { SAFE_NAME_REDACTED, makeRedactedDownload } from "@/features/redact/download";
import { encodeRedactedJpeg } from "@/features/redact/pixelate";
import { RedactPanel } from "@/features/redact/redact-panel";
import { LayerCard } from "@/features/result/layer-card";
import { L1_TITLE } from "@/features/result/session";
import type { PreparedImages } from "@/lib/image/downscale";
import type { LayerResult } from "@/lib/validate";
import { analyzeL1 } from "./map";
import { SAFE_FAILED_MESSAGE } from "./safe-download";

type Props = {
  file: File;
  images: PreparedImages;
  /** Area redaksi dari temuan server (kosong sebelum server menjawab). */
  areas?: readonly RedactArea[];
  onResult?: (result: LayerResult) => void;
};

type Safe = { phase: "preparing" } | { phase: "ready"; url: string; name: string } | { phase: "failed" };

const NO_AREAS: readonly RedactArea[] = [];
/** Jeda sebelum versi aman disiapkan ulang setelah area/toggle berubah. */
const REPREPARE_DEBOUNCE_MS = 300;

const READ_FAILED: LayerResult = {
  layer: "L1",
  status: "error",
  provider: "browser",
  latency_ms: 0,
  findings: [],
  note: "Metadata foto tidak bisa dibaca.",
};

/**
 * Kartu "Metadata foto" (L1) + satu tombol unduh versi aman (FR-L1-03/04, FR-RED-01..03).
 * Versi aman = bitmap kerja tanpa metadata, dengan area aktif dimosaik; diverifikasi ulang sebelum boleh
 * diunduh. Sebelum server menjawab tidak ada area → versi tanpa metadata saja. Analisis, mosaik, dan
 * pratinjau dibuat di perangkat; nilai EXIF tidak dikirim dan tidak di-log. Pemanggil me-remount kartu
 * ini (key) untuk setiap analisis dan membuangnya saat foto diganti/dihapus; semua object URL di-revoke.
 */
export function L1Card({ file, images, areas = NO_AREAS, onResult }: Props) {
  const [result, setResult] = useState<LayerResult | null>(null);
  const [safe, setSafe] = useState<Safe>({ phase: "preparing" });
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(() => new Set());
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const report = useRef(onResult);
  report.current = onResult;

  const boxes = useMemo(() => activeBoxes(areas, disabled), [areas, disabled]);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  /** Kunci isi (bukan identitas array) supaya versi aman hanya disiapkan ulang bila area aktif berubah. */
  const boxesKey = JSON.stringify(boxes);

  /** Generasi persiapan terbaru; hasil generasi lama atau setelah unmount dibuang. */
  const gen = useRef(0);
  useEffect(
    () => () => {
      gen.current = -1;
    },
    [],
  );

  const prepareSafe = useCallback(
    (active: Bbox[]) => {
      const g = ++gen.current;
      setSafe({ phase: "preparing" });
      makeRedactedDownload((b) => encodeRedactedJpeg(images.work, b), active).then(
        ({ blob, name }) => {
          if (gen.current === g) setSafe({ phase: "ready", url: URL.createObjectURL(blob), name });
        },
        () => {
          if (gen.current === g) setSafe({ phase: "failed" });
        },
      );
    },
    [images],
  );

  useEffect(() => {
    let live = true;
    setResult(null);
    file
      .arrayBuffer()
      .then((buf) => analyzeL1(new Uint8Array(buf)))
      .catch(() => READ_FAILED)
      .then((r) => {
        if (!live) return;
        setResult(r);
        report.current?.(r);
      });
    return () => {
      live = false;
    };
  }, [file]);

  // Persiapan pertama langsung (bitmap kerja masih hidup); berikutnya (server menjawab, toggle) di-debounce.
  const prepared = useRef(false);
  useEffect(() => {
    const delay = prepared.current ? REPREPARE_DEBOUNCE_MS : 0;
    if (prepared.current) {
      // Versi lama tidak lagi sesuai toggle: tahan unduhan selama jeda, buang persiapan yang masih jalan.
      gen.current++;
      setSafe({ phase: "preparing" });
    }
    prepared.current = true;
    const t = setTimeout(() => prepareSafe(boxesRef.current), delay);
    return () => clearTimeout(t);
  }, [boxesKey, prepareSafe]);

  useEffect(
    () => () => {
      if (safe.phase === "ready") URL.revokeObjectURL(safe.url);
    },
    [safe],
  );

  const hasAreas = areas.length > 0;
  useEffect(() => {
    if (!hasAreas) return;
    const url = URL.createObjectURL(images.send.blob);
    setBeforeUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setBeforeUrl(null);
    };
  }, [hasAreas, images]);

  const onToggle = useCallback((id: string, on: boolean) => {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const redacted = boxes.length > 0;

  return (
    <LayerCard title={L1_TITLE} layer={result}>
      <RedactPanel
        areas={areas}
        disabled={disabled}
        onToggle={onToggle}
        afterUrl={safe.phase === "ready" ? safe.url : null}
        beforeUrl={beforeUrl}
      />
      <div className="actions">
        {safe.phase === "preparing" && (
          <button type="button" disabled>
            {redacted ? "Menyiapkan versi aman…" : "Menyiapkan versi tanpa metadata…"}
          </button>
        )}
        {safe.phase === "ready" && (
          <a className="button" href={safe.url} download={safe.name}>
            {safe.name === SAFE_NAME_REDACTED
              ? "Unduh versi aman (tanpa metadata, teks disamarkan)"
              : "Unduh versi tanpa metadata"}
          </a>
        )}
        {safe.phase === "failed" && (
          <>
            <p className="status error" role="alert">
              {SAFE_FAILED_MESSAGE}
            </p>
            <button type="button" onClick={() => prepareSafe(boxesRef.current)}>
              Coba lagi
            </button>
          </>
        )}
      </div>
    </LayerCard>
  );
}
