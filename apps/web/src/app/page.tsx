import Link from "next/link";

/** Landing untuk pengunjung dari tautan (juri, orang baru). Rincian ada di /tentang; alat di /periksa. */
export default function Home() {
  return (
    <main className="container landing">
      <section className="landing-hero" aria-labelledby="landing-title">
        <h1 id="landing-title">Periksa dulu, baru unggah.</h1>
        <p className="landing-lead">
          TILIK membantu anggota dan keluarga memeriksa foto dan caption sebelum diunggah ke media sosial, supaya tidak
          membocorkan lokasi, dokumen dinas, atau rencana pergerakan.
        </p>
        <div className="landing-actions">
          <Link className="button landing-cta" href="/periksa">
            Mulai periksa
          </Link>
          <Link className="landing-secondary" href="/periksa#contoh">
            Lihat contoh
          </Link>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-kenapa">
        <h2 id="landing-kenapa">Kenapa penting</h2>
        <p>
          Satu unggahan bisa meninggalkan jejak digital yang tidak terlihat: titik lokasi di metadata foto, dokumen dinas yang
          ikut terfoto, atau caption yang menyebut jadwal keberangkatan. Jejak itu sulit ditarik kembali setelah tersebar,
          jadi lebih aman diperiksa sebelum diunggah.
        </p>
      </section>

      <section className="landing-section" aria-labelledby="landing-cara">
        <h2 id="landing-cara">Cara kerja</h2>
        <ol className="landing-steps">
          <li>Pilih foto dan tulis caption.</li>
          <li>TILIK memeriksa metadata, teks di foto, wajah, dan caption.</li>
          <li>Unduh versi aman dan perbaiki caption.</li>
        </ol>
      </section>

      <section className="landing-section" aria-labelledby="landing-privasi">
        <h2 id="landing-privasi">Privasi</h2>
        <ul className="landing-list">
          <li>Foto diperiksa di perangkatmu dan tidak dikirim.</li>
          <li>Yang dikirim hanya caption dan teks yang terbaca dari foto, ke server TILIK dan layanan AI pihak ketiga.</li>
          <li>Tidak disimpan permanen; hasil AI bisa disimpan sementara di memori server paling lama 24 jam.</li>
        </ul>
      </section>

      <div className="landing-actions landing-end">
        <Link className="button landing-cta" href="/periksa">
          Mulai periksa
        </Link>
        <Link className="landing-secondary" href="/tentang">
          Pelajari lebih lanjut
        </Link>
      </div>
    </main>
  );
}
