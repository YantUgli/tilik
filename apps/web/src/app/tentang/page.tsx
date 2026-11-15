import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tentang",
  description: "Apa itu TILIK, cara memeriksa, privasi, dan keterbatasannya.",
};

const REPO = "https://github.com/YantUgli/tilik";

export default function Tentang() {
  return (
    <main className="container prose">
      <h1>Tentang TILIK</h1>
      <p className="hero-lead">
        TILIK membantu memeriksa foto dan caption sebelum diunggah ke media sosial, supaya tidak ikut membocorkan lokasi,
        dokumen dinas, atau rencana pergerakan.
      </p>

      <section aria-labelledby="masalah">
        <h2 id="masalah">Masalahnya</h2>
        <p>
          Unggahan anggota dan keluarga di media sosial bisa membuka informasi operasional tanpa disadari (OPSEC): titik GPS di
          metadata foto, surat dinas yang ikut terfoto, atau caption yang menyebut jadwal keberangkatan. TILIK masuk kategori
          Siber Sosial dengan pendekatan pencegahan: diperiksa sebelum unggah, bukan dibersihkan setelah tersebar.
        </p>
      </section>

      <section aria-labelledby="pemeriksaan">
        <h2 id="pemeriksaan">Yang diperiksa</h2>
        <ol>
          <li>
            <strong>Metadata foto</strong>: lokasi GPS, waktu, dan perangkat di dalam file foto. Dibaca di perangkat; versi aman
            yang diunduh sudah tanpa metadata.
          </li>
          <li>
            <strong>Teks di foto</strong>: teks dibaca di perangkat (OCR), lalu dicek apakah mirip dokumen dinas. Bagian yang
            ditemukan bisa disamarkan dengan mosaik.
          </li>
          <li>
            <strong>Caption</strong>: dicek dengan aturan, lalu dengan AI, untuk lokasi, waktu, satuan, dan rencana pergerakan.
          </li>
        </ol>
        <p>
          Ditambah <strong>penyamaran wajah</strong>: tombol &ldquo;Cari wajah&rdquo; mencari wajah di perangkat dan
          menyamarkannya di versi aman.
        </p>
      </section>

      <section aria-labelledby="risiko">
        <h2 id="risiko">Risiko akhir</h2>
        <p>
          Risiko akhir adalah tingkat tertinggi dari semua temuan: Aman, Perlu perhatian, atau Tinggi. Pemeriksaan aturan
          berjalan lebih dulu sebelum AI, jadi temuan aturan tetap ada walau AI tidak tersedia. Bila ada pemeriksaan yang gagal,
          hasil diberi catatan &ldquo;pemeriksaan belum lengkap&rdquo;.
        </p>
      </section>

      <section aria-labelledby="privasi-tentang">
        <h2 id="privasi-tentang">Privasi</h2>
        <ul>
          <li>Foto diperiksa di perangkatmu dan tidak dikirim.</li>
          <li>Yang dikirim hanya caption dan teks yang terbaca dari foto, ke server TILIK dan layanan AI pihak ketiga.</li>
          <li>
            Server tidak menyimpan gambar atau teks ke disk, database, atau log. Hasil AI untuk teks yang sama bisa disimpan
            sementara di memori server paling lama 24 jam.
          </li>
        </ul>
      </section>

      <section aria-labelledby="keterbatasan">
        <h2 id="keterbatasan">Keterbatasan</h2>
        <ul>
          <li>Belum bisa dipakai offline: pemeriksaan caption butuh koneksi.</li>
          <li>OCR bisa salah baca, terutama tulisan kecil, miring, atau buram.</li>
          <li>Wajah kecil atau jauh bisa terlewat; selalu periksa pratinjau.</li>
          <li>Cap tanggal atau lokasi yang tercetak di gambar belum dideteksi.</li>
          <li>Belum ada analisis visual (misalnya mengenali seragam, kendaraan, atau tempat).</li>
          <li>Hanya memakai satu penyedia AI.</li>
        </ul>
      </section>

      <section aria-labelledby="atribusi">
        <h2 id="atribusi">Atribusi</h2>
        <p>
          Kode sumber, lisensi, dan atribusi pustaka ada di <a href={REPO}>repositori GitHub TILIK</a>.
        </p>
      </section>

      <p className="card small muted">
        Purwarupa untuk lomba. Semua contoh fiktif. TILIK tidak berafiliasi resmi dengan instansi mana pun.
      </p>

      <p>
        <Link className="button primary" href="/#periksa">
          Mulai periksa
        </Link>
      </p>
    </main>
  );
}
