import type { Metadata } from "next";
import { Analyzer } from "@/features/result/analyzer";

export const metadata: Metadata = { title: "Periksa" };

/** Alat periksa (tujuan PWA `start_url`): isi halaman utama lama, dipindah apa adanya. */
export default function Periksa() {
  return (
    <main className="container">
      <h1>Periksa dulu, baru unggah.</h1>
      <p className="muted">Periksa foto dan caption sebelum diunggah ke media sosial.</p>
      <Analyzer />
    </main>
  );
}
