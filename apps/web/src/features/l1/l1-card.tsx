"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayerCard } from "@/features/result/layer-card";
import { L1_TITLE } from "@/features/result/session";
import { encodeSafeJpeg, type PreparedImages } from "@/lib/image/downscale";
import type { LayerResult } from "@/lib/validate";
import { analyzeL1 } from "./map";
import { SAFE_FAILED_MESSAGE, makeSafeDownload } from "./safe-download";

type Props = { file: File; images: PreparedImages; onResult?: (result: LayerResult) => void };

type Safe = { phase: "preparing" } | { phase: "ready"; url: string } | { phase: "failed" };

const READ_FAILED: LayerResult = {
  layer: "L1",
  status: "error",
  provider: "browser",
  latency_ms: 0,
  findings: [],
  note: "Metadata foto tidak bisa dibaca.",
};

/**
 * Kartu "Metadata foto" (L1). Analisis dan versi aman dibuat di perangkat; nilai EXIF tidak dikirim
 * dan tidak di-log. Versi aman disiapkan di awal selagi bitmap kerja masih hidup. Pemanggil
 * me-remount kartu ini (key) untuk setiap analisis dan membuangnya saat foto diganti/dihapus.
 */
export function L1Card({ file, images, onResult }: Props) {
  const [result, setResult] = useState<LayerResult | null>(null);
  const [safe, setSafe] = useState<Safe>({ phase: "preparing" });
  const report = useRef(onResult);
  report.current = onResult;

  const prepareSafe = useCallback(
    (isLive: () => boolean = () => true) => {
      setSafe({ phase: "preparing" });
      makeSafeDownload(() => encodeSafeJpeg(images.work)).then(
        (blob) => (isLive() ? setSafe({ phase: "ready", url: URL.createObjectURL(blob) }) : undefined),
        () => isLive() && setSafe({ phase: "failed" }),
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
    prepareSafe(() => live);
    return () => {
      live = false;
    };
  }, [file, prepareSafe]);

  useEffect(
    () => () => {
      if (safe.phase === "ready") URL.revokeObjectURL(safe.url);
    },
    [safe],
  );

  return (
    <LayerCard title={L1_TITLE} layer={result}>
      <div className="actions">
        {safe.phase === "preparing" && (
          <button type="button" disabled>
            Menyiapkan versi tanpa metadata…
          </button>
        )}
        {safe.phase === "ready" && (
          <a className="button" href={safe.url} download="foto-tanpa-metadata.jpg">
            Unduh versi tanpa metadata
          </a>
        )}
        {safe.phase === "failed" && (
          <>
            <p className="status error" role="alert">
              {SAFE_FAILED_MESSAGE}
            </p>
            <button type="button" onClick={() => prepareSafe()}>
              Coba lagi
            </button>
          </>
        )}
      </div>
    </LayerCard>
  );
}
