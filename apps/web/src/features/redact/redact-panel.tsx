"use client";

import { useState } from "react";
import type { RedactArea } from "./areas";

type Props = {
  areas: readonly RedactArea[];
  disabled: ReadonlySet<string>;
  onToggle: (id: string, on: boolean) => void;
  /** Object URL blob versi aman (sama dengan yang diunduh); null = sedang disiapkan/gagal. */
  afterUrl: string | null;
  /** Object URL lokal gambar asli (versi kirim); tidak ada yang dikirim ke jaringan. */
  beforeUrl: string | null;
};

/** Pratinjau sebelum/sesudah (FR-RED-03) dan toggle per area (FR-RED-01). Hanya tampil bila ada area. */
export function RedactPanel({ areas, disabled, onToggle, afterUrl, beforeUrl }: Props) {
  const [before, setBefore] = useState(false);
  if (areas.length === 0) return null;

  const counts = new Map<string, number>();
  for (const a of areas) counts.set(a.findingId, (counts.get(a.findingId) ?? 0) + 1);
  const seen = new Map<string, number>();
  const src = before ? beforeUrl : afterUrl;

  return (
    <div className="redact">
      <h3>{areas.some((a) => a.kind !== "face") ? "Sembunyikan bagian sensitif" : "Samarkan wajah"}</h3>
      <figure className="redact-preview">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL lokal
          <img src={src} alt={before ? "Foto sebelum disamarkan" : "Pratinjau foto setelah disamarkan"} />
        ) : (
          <p className="muted small">Menyiapkan pratinjau…</p>
        )}
        <figcaption className="muted small">{before ? "Sebelum" : "Sesudah"}</figcaption>
      </figure>
      <button type="button" className="secondary" onClick={() => setBefore((b) => !b)} aria-pressed={before}>
        {before ? "Lihat sesudah" : "Lihat sebelum"}
      </button>
      <ul className="redact-areas">
        {areas.map((a) => {
          const n = (seen.get(a.findingId) ?? 0) + 1;
          seen.set(a.findingId, n);
          const multi = (counts.get(a.findingId) ?? 0) > 1;
          return (
            <li key={a.id}>
              <label>
                <input type="checkbox" checked={!disabled.has(a.id)} onChange={(e) => onToggle(a.id, e.target.checked)} />{" "}
                {a.label}
                {multi && <span className="muted"> (bagian {n})</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
