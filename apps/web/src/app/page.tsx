import { Analyzer } from "@/features/result/analyzer";

export default function Home() {
  return (
    <main className="container">
      <h1>Periksa dulu, baru unggah.</h1>
      <p className="muted">Periksa foto dan caption sebelum diunggah ke media sosial.</p>
      <Analyzer />
    </main>
  );
}
