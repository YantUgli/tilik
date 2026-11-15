import type { ReactNode } from "react";
import type { Finding, LayerResult } from "@/lib/validate";
import { layerStatusLabel } from "./session";

const SEVERITY_LABEL: Record<Finding["severity"], string> = { info: "info", perhatian: "perhatian", tinggi: "tinggi" };

export function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ul className="findings">
      {findings.map((f) => (
        <li key={f.id} className={`finding sev-${f.severity}`}>
          <span className={`badge sev-${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
          {f.source === "llm" && <span className="badge ai">dari AI</span>}
          <strong>{f.message}</strong>
          {f.evidence?.text && <span className="muted"> ({f.evidence.text})</span>}
          {(f.explanation || f.basis) && (
            <details>
              <summary>Kenapa?</summary>
              {f.explanation && <p>{f.explanation}</p>}
              {f.basis && <p className="muted">Dasar: {f.basis}</p>}
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

type Props = { title: string; layer: LayerResult | null; busy?: boolean; children?: ReactNode };

/** Kartu satu LayerResult: judul, status (FR-UI-01), temuan. `layer` null = masih dianalisis. */
export function LayerCard({ title, layer, busy = false, children }: Props) {
  const label = layerStatusLabel(layer, busy);
  const tone = label === "selesai" ? "ok" : label === "sedang dianalisis" ? "" : "warn";
  return (
    <section className="card layer-card" aria-live="polite" aria-busy={!layer}>
      <div className="layer-head">
        <h2>{title}</h2>
        <span className={`status ${tone}`}>{label}</span>
      </div>
      {layer && layer.status !== "ok" && layer.note && <p className="muted">{layer.note}</p>}
      {layer?.status === "ok" && layer.findings.length === 0 && <p className="muted">Tidak ada temuan.</p>}
      {layer && layer.findings.length > 0 && <FindingList findings={layer.findings} />}
      {children}
    </section>
  );
}
