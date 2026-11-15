import type { ReactNode } from "react";
import type { Finding, LayerResult } from "@/lib/validate";
import { Icon, type IconName } from "./icon";
import { layerStatusLabel } from "./session";

const SEVERITY_LABEL: Record<Finding["severity"], string> = { info: "info", perhatian: "perhatian", tinggi: "tinggi" };
const SEVERITY_RANK: Record<Finding["severity"], number> = { tinggi: 0, perhatian: 1, info: 2 };

/** Urutan tampil kartu: temuan tinggi dulu, lalu perhatian, info, gagal, kosong, masih berjalan. */
export function layerOrder(layer: LayerResult | null): number {
  if (!layer) return 6;
  if (layer.findings.length > 0) return Math.min(...layer.findings.map((f) => SEVERITY_RANK[f.severity]));
  return layer.status === "ok" || layer.status === "skipped" ? 4 : 3;
}

export function FindingList({ findings }: { findings: Finding[] }) {
  const sorted = [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return (
    <ul className="findings">
      {sorted.map((f) => (
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

/** Empat keadaan dibedakan dengan ikon + teks, bukan warna saja: berjalan, kosong, temuan, gagal. */
function stateOf(layer: LayerResult | null, busy: boolean): { icon: IconName; text: string; tone: string } {
  const label = layerStatusLabel(layer, busy);
  if (!layer) return { icon: "pending", text: "Sedang diperiksa…", tone: "pending" };
  if (label !== "selesai") return { icon: "fail", text: label === "tidak tersedia" ? "Tidak bisa diperiksa" : "Sibuk, coba lagi", tone: "fail" };
  const n = layer.findings.length;
  if (n === 0) return { icon: "ok", text: "Tidak ada temuan", tone: "empty" };
  const top = layerOrder(layer);
  return { icon: top === 0 ? "alert" : "warn", text: `${n} temuan`, tone: top === 0 ? "high" : "found" };
}

/** Kartu satu LayerResult: judul, status (FR-UI-01), temuan. `layer` null = masih dianalisis. */
export function LayerCard({ title, layer, busy = false, children }: Props) {
  const s = stateOf(layer, busy);
  return (
    <section className={`card layer-card state-${s.tone}`} aria-busy={!layer}>
      <div className="layer-head">
        <h3>{title}</h3>
        <span className={`layer-state state-${s.tone}`} role="status">
          <Icon name={s.icon} />
          {s.text}
        </span>
      </div>
      {layer && layer.status !== "ok" && layer.note && <p className="muted small">{layer.note}</p>}
      {layer && layer.findings.length > 0 && <FindingList findings={layer.findings} />}
      {children}
    </section>
  );
}
