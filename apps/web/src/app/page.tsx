import { L1Section } from "@/features/l1/l1-section";
import { ConnectionCheck } from "./connection-check";

export default function Home() {
  return (
    <main className="container">
      <h1>TILIK</h1>
      <p className="muted">Periksa foto dan caption sebelum diunggah ke media sosial.</p>
      <L1Section />

      <section className="diagnostics">
        <h2 className="muted">Diagnosis koneksi API</h2>
        <ConnectionCheck />
      </section>
    </main>
  );
}
