"use client";

import { useCallback, useEffect, useState } from "react";
import { encodeSafeJpeg, type PreparedImages } from "@/lib/image/downscale";
import type { LayerResult } from "@/lib/validate";
import { analyzeL1 } from "./map";
import { SAFE_FAILED_MESSAGE, makeSafeDownload } from "./safe-download";

type Props = { file: File; images: PreparedImages };

type Safe = { phase: "preparing" } | { phase: "ready"; url: string } | { phase: "failed" };

/**
 * Kartu "Metadata foto" (L1). Analisis dan versi aman dibuat di perangkat; nilai EXIF tidak dikirim
 * dan tidak di-log. Versi aman disiapkan di awal selagi bitmap kerja masih hidup (PhotoInput
 * menutupnya saat foto diganti). Tampilan akhir dirangkai di T-23/T-25.
 */
export function L1Card({ file, images }: Props) {
  const [result, setResult] = useState<LayerResult | null>(null);
  const [safe, setSafe] = useState<Safe>({ phase: "preparing" });

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
      .catch((): LayerResult => ({ layer: "L1", status: "error", provider: "browser", latency_ms: 0, findings: [], note: "Metadata foto tidak bisa dibaca." }))
      .then((r) => live && setResult(r));
    prepareSafe(() => live);
    return () => {
      live = false;
    };
  }, [file, prepareSafe]);

  useEffect(() => () => {
    if (safe.phase === "ready") URL.revokeObjectURL(safe.url);
  }, [safe]);

  return (
    <section className="card l1-card" aria-live="polite">
      <h2>Metadata foto</h2>
      {!result && <p className="muted">Membaca metadata…</p>}
      {result?.status === "error" && <p className="status warn">{result.note} Pemeriksaan lain tetap berjalan.</p>}
      {result?.status === "ok" && result.findings.length === 0 && (
        <p className="status ok">Tidak ada lokasi, waktu, atau info perangkat yang tersimpan di foto ini.</p>
      )}
      {result && result.findings.length > 0 && (
        <ul className="findings">
          {result.findings.map((f) => (
            <li key={f.id} className={`finding sev-${f.severity}`}>
              <strong>{f.message}</strong>
              {f.evidence?.text && <span className="evidence"> ({f.evidence.text})</span>}
              {f.explanation && <p className="muted">{f.explanation}</p>}
            </li>
          ))}
        </ul>
      )}

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
    </section>
  );
}
