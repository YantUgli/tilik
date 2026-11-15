import type { ReactNode } from "react";
import { INCOMPLETE_NOTE, RISK_LABEL, type Risk, type RiskLevel } from "@/lib/risk";
import type { LayerResult } from "@/lib/validate";
import { Icon } from "./icon";

/** Satu kalimat arti tingkat risiko, bahasa awam. */
const RISK_MEANING: Record<RiskLevel, string> = {
  aman: "Tidak ada temuan berisiko. Tetap baca ulang sebelum mengunggah.",
  perhatian: "Ada hal yang sebaiknya diperbaiki dulu sebelum diunggah.",
  tinggi: "Jangan unggah dulu: ada yang bisa membocorkan lokasi, dokumen, atau rencana.",
};

const RISK_ICON: Record<RiskLevel, "ok" | "warn" | "alert"> = { aman: "ok", perhatian: "warn", tinggi: "alert" };

function countText(layers: readonly LayerResult[]): string {
  const n = { tinggi: 0, perhatian: 0, info: 0 };
  for (const l of layers) for (const f of l.findings) n[f.severity]++;
  return `Temuan: ${n.tinggi} tinggi · ${n.perhatian} perhatian · ${n.info} info`;
}

type Props = {
  risk: Risk | null;
  /** Semua lapis untuk menghitung temuan per tingkat (opsional). */
  layers?: readonly LayerResult[] | null;
  /** id elemen supaya fokus bisa dipindah ke ringkasan setelah "Periksa". */
  id?: string;
  children?: ReactNode;
};

/** Ringkasan risiko akhir; `risk` null = masih dianalisis. Dipakai hasil asli dan galeri contoh. */
export function RiskCard({ risk, layers, id, children }: Props) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} className={`card risk-card ${risk ? `risk-${risk.level}` : "risk-pending"}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <h2 id={id ? `${id}-title` : undefined} className="risk-title">
        Risiko akhir
      </h2>
      <div role="status" aria-live="polite">
        {risk ? (
          <>
            <p className="risk-level">
              <Icon name={RISK_ICON[risk.level]} />
              <strong>{RISK_LABEL[risk.level]}</strong>
            </p>
            <p className="risk-meaning">{RISK_MEANING[risk.level]}</p>
            {layers && <p className="muted small">{countText(layers)}</p>}
            {risk.incomplete && (
              <p className="status warn small">
                <Icon name="warn" /> Catatan: {INCOMPLETE_NOTE}.
              </p>
            )}
          </>
        ) : (
          <p className="risk-level muted">
            <Icon name="pending" />
            Sedang diperiksa…
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
