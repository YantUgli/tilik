import { ConnectionCheck } from "./connection-check";

export default function Home() {
  return (
    <main className="container">
      <h1>TILIK</h1>
      <p className="muted">Halaman uji koneksi frontend ke API (scaffold). Belum ada fitur analisis.</p>
      <ConnectionCheck />
    </main>
  );
}
