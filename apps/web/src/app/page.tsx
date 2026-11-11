import { PhotoInput } from "@/features/input/photo-input";
import { ConnectionCheck } from "./connection-check";

export default function Home() {
  return (
    <main className="container">
      <h1>TILIK</h1>
      <p className="muted">Periksa foto dan caption sebelum diunggah ke media sosial.</p>
      <PhotoInput />

      <section className="diagnostics">
        <h2 className="muted">Diagnosis koneksi API</h2>
        <ConnectionCheck />
      </section>
    </main>
  );
}
