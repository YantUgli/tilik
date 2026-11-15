import type { ReactNode } from "react";
import { INCOMPLETE_NOTE, RISK_LABEL, type Risk } from "@/lib/risk";

/** Kartu risiko akhir; `risk` null = masih dianalisis. Dipakai hasil asli dan galeri contoh. */
export function RiskCard({ risk, children }: { risk: Risk | null; children?: ReactNode }) {
  return (
    <section className={`card risk-card ${risk ? `risk-${risk.level}` : ""}`} aria-live="polite">
      <h2>Risiko akhir</h2>
      {risk ? (
        <p className="risk-level">
          <strong>{RISK_LABEL[risk.level]}</strong>
          {risk.incomplete && <span className="status warn"> · {INCOMPLETE_NOTE}</span>}
        </p>
      ) : (
        <p className="muted">Sedang dianalisis…</p>
      )}
      {children}
    </section>
  );
}
