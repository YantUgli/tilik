import type { Metadata } from "next";
import { ConnectionCheck } from "../connection-check";

export const metadata: Metadata = {
  title: "Diagnostik — TILIK",
  robots: { index: false, follow: false },
};

/** Halaman teknis untuk memeriksa koneksi ke API. Tidak ditautkan dari halaman depan. */
export default function Diagnostik() {
  return (
    <main className="container">
      <h1>Diagnosis koneksi API</h1>
      <section className="diagnostics">
        <ConnectionCheck />
      </section>
    </main>
  );
}
