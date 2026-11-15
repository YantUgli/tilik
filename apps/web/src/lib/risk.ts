/**
 * Risiko akhir (FR-RISK-01..03). Fungsi murni; dipakai ulang di T-24 untuk AnalysisResult penuh.
 * Level = tingkat tertinggi dari semua temuan di semua lapis (termasuk L1), apa pun sumbernya,
 * jadi temuan LLM tidak pernah bisa menurunkan temuan aturan. `info` tidak menaikkan di atas `aman`.
 */

import type { LayerResult, Severity } from "@/lib/validate";

export type RiskLevel = "aman" | "perhatian" | "tinggi";
export type Risk = { level: RiskLevel; incomplete: boolean };

const RANK: Record<RiskLevel, number> = { aman: 0, perhatian: 1, tinggi: 2 };
const fromSeverity = (s: Severity): RiskLevel => (s === "info" ? "aman" : s);

export function computeRisk(layers: readonly LayerResult[]): Risk {
  let level: RiskLevel = "aman";
  let incomplete = false;
  for (const layer of layers) {
    // `skipped` (input kosong) bukan kegagalan, jadi tidak membuat hasil belum lengkap.
    if (layer.status === "error" || layer.status === "unavailable") incomplete = true;
    for (const f of layer.findings) {
      const l = fromSeverity(f.severity);
      if (RANK[l] > RANK[level]) level = l;
    }
  }
  return { level, incomplete };
}

export const RISK_LABEL: Record<RiskLevel, string> = { aman: "Aman", perhatian: "Perlu perhatian", tinggi: "Tinggi" };
export const INCOMPLETE_NOTE = "pemeriksaan belum lengkap";
