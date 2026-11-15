/** Landing singkat di atas alat: apa itu TILIK, cara kerja, privasi. Fakta privasi mengikuti README. */
export function Landing() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Periksa dulu, baru unggah.</h1>
        <p className="hero-lead">
          TILIK memeriksa foto dan caption anggota atau keluarga sebelum diunggah ke media sosial, supaya tidak membocorkan
          lokasi, dokumen dinas, atau rencana pergerakan.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#periksa">
            Mulai periksa
          </a>
          <a className="button secondary" href="#contoh">
            Lihat contoh
          </a>
        </div>
      </section>

      <div className="landing-grid">
        <section className="landing-block" aria-labelledby="cara-kerja">
          <h2 id="cara-kerja">Cara kerja</h2>
          <ol className="steps">
            <li>Pilih foto dan tulis caption.</li>
            <li>TILIK memeriksa metadata, teks di foto, dan caption.</li>
            <li>Unduh versi aman dan perbaiki caption.</li>
          </ol>
        </section>

        <section className="landing-block" aria-labelledby="privasi">
          <h2 id="privasi">Privasi</h2>
          <ul className="bullets">
            <li>Foto diperiksa di perangkatmu dan tidak dikirim.</li>
            <li>Yang dikirim hanya caption dan teks yang terbaca dari foto, ke server TILIK dan layanan AI pihak ketiga.</li>
            <li>Tidak disimpan permanen; hasil AI bisa disimpan sementara di memori server paling lama 24 jam.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
