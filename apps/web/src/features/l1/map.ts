/** L1 Metadata: EXIF → Finding → LayerResult. Fungsi murni kecuali `analyzeL1` (async, tanpa I/O jaringan). */

import { readExif, type ExifSummary } from "@/lib/image/metadata";
import type { Finding, LayerResult } from "@/lib/validate";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const coord = (n: number) => {
  const s = n.toFixed(2);
  return (s === "-0.00" ? "0.00" : s).replace(".", ",");
};

/** Koordinat dibulatkan 2 desimal, format Indonesia. Angka asli tidak pernah keluar dari fungsi ini. */
export const formatGps = (lat: number, lon: number) => `sekitar ${coord(lat)}, ${coord(lon)}`;

/** "2026:11:13 08:30:00" → "13 November 2026, 08.30"; format lain dikembalikan apa adanya. */
export function formatExifDate(raw: string): string {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(raw);
  if (!m || +m[2] < 1 || +m[2] > 12) return raw;
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}, ${m[4]}.${m[5]}`;
}

const clip = (s: string) => (s.length > 200 ? `${s.slice(0, 199)}…` : s);

export function mapExifToFindings(exif: ExifSummary | null, startId = 1): Finding[] {
  if (!exif) return [];
  const out: Omit<Finding, "id">[] = [];

  if (exif.latitude !== undefined && exif.longitude !== undefined) {
    out.push({
      layer: "L1",
      category: "gps",
      severity: "tinggi",
      source: "exif",
      message: "Foto menyimpan titik lokasi tempat foto diambil.",
      explanation:
        "Siapa pun yang mendapat file aslinya bisa membuka titik ini di peta, misalnya rumah, asrama, atau tempat tugas. " +
        "Angka yang ditampilkan sudah dibulatkan; angka aslinya di foto jauh lebih presisi. Unggah versi tanpa metadata.",
      evidence: { text: formatGps(exif.latitude, exif.longitude), where: "image" },
    });
  }

  if (exif.dateTimeOriginal) {
    out.push({
      layer: "L1",
      category: "waktu",
      severity: "info",
      source: "exif",
      message: "Foto menyimpan waktu pengambilan.",
      explanation: "Waktu pengambilan bisa dipakai menebak pola kegiatan, misalnya jam berangkat atau jadwal rutin.",
      evidence: { text: clip(formatExifDate(exif.dateTimeOriginal)), where: "image" },
    });
  }

  const device = [exif.make, exif.model].filter(Boolean).join(" ");
  if (device || exif.software) {
    out.push({
      layer: "L1",
      category: "perangkat",
      severity: "info",
      source: "exif",
      message: device ? "Foto menyimpan merek dan tipe HP." : "Foto menyimpan nama aplikasi yang dipakai.",
      explanation: "Merek, tipe, dan aplikasi membantu orang lain mengenali perangkat dan mencocokkan foto-fotomu.",
      evidence: { text: clip([device, exif.software].filter(Boolean).join(" · ")), where: "image" },
    });
  }

  return out.map((f, i) => ({ id: `b-${startId + i}`, ...f }));
}

/**
 * Rakit LayerResult L1 dari bytes file asli. Tidak pernah melempar: parse gagal → `status: "error"`
 * supaya lapis lain tetap jalan (NFR-AVAIL-01). Pesan error asli tidak dimasukkan ke `note`.
 */
export async function analyzeL1(bytes: Uint8Array, read: typeof readExif = readExif): Promise<LayerResult> {
  const started = performance.now();
  const base = { layer: "L1" as const, provider: "browser" as const };
  const elapsed = () => Math.max(0, Math.round(performance.now() - started));
  try {
    const findings = mapExifToFindings(await read(bytes));
    return { ...base, status: "ok", latency_ms: elapsed(), findings, note: null };
  } catch {
    return { ...base, status: "error", latency_ms: elapsed(), findings: [], note: "Metadata foto tidak bisa dibaca." };
  }
}
