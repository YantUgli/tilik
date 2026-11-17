# Naskah Video Explainer TILIK

Dokumen ini adalah naskah produksi untuk video explainer motion graphic TILIK. Bacalah seluruhnya sebelum membangun scene apa pun.

- **Durasi target:** ±4 menit 20 detik
- **Rasio:** 16:9 (YouTube), kanvas 1920×1080
- **Penonton:** juri Kartika Cyber Hackathon 2026, prajurit TNI AD dan keluarganya, serta masyarakat umum
- **Suara:** voice-over AI (TTS) bahasa Indonesia, nada hangat dan tenang, tidak menggurui
- **Bentuk:** motion graphic penuh, bukan rekaman layar aplikasi. Tampilan aplikasi boleh muncul sebagai **ilustrasi yang terinspirasi** UI TILIK, bukan tangkapan layar.

---

## Bagian A — Cara kerja untuk Claude (pembuat motion graphic)

1. **Satu scene = satu artifact.** Jangan menggabungkan seluruh video ke dalam satu artifact. Setiap scene direkam terpisah lalu disambung di editor video.
2. **Panggung tetap 1920×1080.** Buat elemen `#stage` berukuran 1920×1080 yang diskalakan agar pas di jendela (letterbox dengan warna `--bg-malam`). Semua ukuran ditulis dalam px untuk kanvas 1080p.
3. **Durasi harus tepat** sesuai kolom durasi di tabel scene, karena gambar akan disinkronkan dengan voice-over.
4. **Pemutaran untuk direkam:**
   - Animasi mulai otomatis 1 detik setelah halaman dimuat.
   - Tekan `R` untuk memutar ulang dari awal, `Spasi` untuk jeda/lanjut.
   - Tidak ada tombol, kursor, atau UI kontrol yang terlihat di dalam panggung.
   - Setelah selesai, frame terakhir ditahan (tidak hilang, tidak berulang sendiri).
5. **Library yang disarankan:** GSAP untuk timeline; CSS 3D transform (`perspective`, `translateZ`, `rotateX/Y`) untuk efek semi-3D. Pakai Three.js hanya bila benar-benar perlu (scene 6 dan 10). Ilustrasi dibuat dengan SVG inline, tanpa gambar dari luar.
6. **Keterbacaan:** teks di layar minimal 36px, judul 72–120px. Setiap teks tampil minimal 2 detik. Hindari blok teks panjang, karena narasi sudah dibawakan voice-over.
7. **Tanpa audio di artifact.** Musik dan voice-over ditambahkan di tahap editing.
8. Kalau ada skill desain atau motion yang tersedia, gunakan untuk meningkatkan kualitas. Namun **brand, isi, dan klaim dalam naskah ini tidak boleh diubah**.

---

## Bagian B — Design brief

### Rasa visual
Hangat, tenang, dan bisa dipercaya. Arahnya **ilustrasi kertas berlapis (paper cut-out) dengan kedalaman 2.5D**: setiap elemen seperti lembaran kertas yang mengambang pada jarak berbeda dan bergerak dengan parallax. Paletnya diambil dari warna soga batik. Jangan memakai gaya "hacker hijau di layar hitam", karena TILIK ditujukan untuk keluarga, bukan untuk menakut-nakuti.

### Palet warna (brand TILIK)

| Token | Hex | Pemakaian |
|---|---|---|
| `--bg` gading | `#F4EBDD` | latar utama |
| `--card` | `#FBF6EE` | kartu, kertas |
| `--wall` | `#E8DBC6` | latar sekunder, dinding ruangan |
| `--border` | `#E3D5C0` | garis halus |
| `--fg` soga tua | `#3A2618` | teks utama, garis ilustrasi |
| `--muted` | `#5E4A3C` | teks sekunder |
| `--accent` soga | `#8A4B26` | tombol, sorotan utama |
| `--highlight` emas pucat | `#F0C987` | penanda, cahaya pemindai |
| `--logo-accent` bata | `#A0522D` | **khusus logo** |
| `--bg-malam` | `#2B1C12` | scene gelap, letterbox |
| `--ok` | `#255A30` (di latar gelap `#6FBF80`) | status aman |
| `--warn` | `#8A5A00` (di latar gelap `#F0C987`) | perlu perhatian |
| `--error` | `#7A1A14` (di latar gelap `#EC7460`) | risiko tinggi |

### Tipografi
**Plus Jakarta Sans** (Google Fonts), dengan ketebalan 500/700/800. Judul memakai 800 dengan tracking sedikit rapat. Gunakan font monospace hanya untuk data metadata (misalnya `GPS -6.17, 106.82`).

### Logo TILIK (salin persis, jangan digambar ulang)

Simbol "Ikat bidik", viewBox `0 0 48 48`:

```svg
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12L24 4 4 24l20 20 8-8" fill="none" stroke="#3A2618" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M35.5 15h3v3h3v3h3v6h-3v3h-3v3h-3" fill="none" stroke="#A0522D" stroke-width="3.5"/>
  <rect x="20" y="20" width="8" height="8" transform="rotate(45 24 24)" fill="#A0522D"/>
</svg>
```

Wordmark "tilik", viewBox `22 -757 1664 763`, isi `#3A2618` (di latar gelap `#F4EBDD`; aksen logo di latar gelap `#E3A56F`):

```svg
<svg viewBox="22 -757 1664 763" xmlns="http://www.w3.org/2000/svg">
  <path fill="#3A2618" d="M309 6Q217 6 166.5 -44.5Q116 -95 116 -187V-427H22V-544H32Q72 -544 94 -565Q116 -586 116 -626V-668H247V-544H372V-427H247V-194Q247 -167 256.5 -148Q266 -129 286.5 -119Q307 -109 339 -109Q346 -109 355.5 -110Q365 -111 374 -112V0Q360 2 342 4Q324 6 309 6Z M462 0V-544H593V0ZM462 -605V-745H593V-605Z M702 0V-757H833V0Z M942 0V-544H1073V0ZM942 -605V-745H1073V-605Z M1182 0V-757H1313V-261L1263 -276L1519 -544H1682L1481 -325L1686 0H1536L1358 -282L1436 -298L1272 -122L1313 -202V0Z"/>
</svg>
```

**Animasi logo (motif berulang):** garis "ikat" soga tua tergambar lebih dulu (stroke-dashoffset), lalu garis bertangga bata menyusul seperti dijahit, kemudian belah ketupat muncul dengan sedikit pantulan (scale 0 → 1.15 → 1). Bentuk belah ketupat ini juga dipakai sebagai **penanda temuan** di seluruh video.

### Bahasa gerak
- Easing utama `power3.out` untuk elemen masuk dan `power2.inOut` untuk gerak kamera. Hindari `bounce` dan `elastic` kecuali pada belah ketupat.
- **Pemindai:** bidang cahaya `--highlight` tipis yang menyapu foto dalam ruang 3D. Ini visual khas pemeriksaan TILIK.
- **Penyamaran:** kotak mosaik piksel yang "mengendap" di atas kata atau wajah. Piksel jatuh dan mengunci, bukan sekadar blur.
- **Transisi antar-scene:** kamera bergerak menembus lapisan kertas (push-in), atau belah ketupat membesar menutup layar lalu membuka scene berikutnya.

### Aturan konten visual
- Semua tokoh **tanpa wajah detail** (siluet atau gaya flat tanpa fitur wajah), seragam generik tanpa lambang satuan yang nyata.
- Semua dokumen dinas **fiktif**. Gunakan teks contoh seperti "KESATUAN CONTOH", "SURAT TELEGRAM", "Nomor: ST/000/XI/2026". Jangan meniru lambang atau kop resmi yang nyata.
- Peta bersifat stilistik (garis kontur dan pin), bukan peta wilayah nyata yang bisa dikenali.
- Koordinat contoh: `-6.1754, 106.8272` (koordinat umum yang aman).

---

## Bagian C — Tabel scene

Waktu ditulis kumulatif. Kolom **VO** adalah teks yang dibacakan TTS.

### Babak 1 — Masalah

**Scene 1 · Satu unggahan** · 0:00–0:15 (15 dtk)
- **VO:** "Satu foto. Satu caption. Dibagikan dalam hitungan detik."
- **Visual:** Latar gelap `--bg-malam`. Sebuah HP semi-3D mengambang dan berputar pelan ke arah kamera. Di layarnya terlihat foto keluarga: ruang tamu, tiga siluet berpelukan, dan sebuah map/kertas di meja. Caption diketik huruf demi huruf: *"Besok Ayah berangkat tugas, doakan ya 🙏"*. Ibu jari bergerak menuju tombol "Bagikan" lalu **frame membeku** tepat sebelum tombol tersentuh.
- **Teks layar:** tidak ada (biarkan caption yang berbicara)
- **Transisi:** kamera mendorong masuk ke dalam foto

**Scene 2 · Yang ikut terbawa** · 0:15–0:45 (30 dtk)
- **VO:** "Tapi foto itu membawa lebih banyak dari yang terlihat. Di dalam filenya tersimpan titik lokasi, jam pengambilan, sampai tipe HP. Di sudut meja, sebuah surat dinas ikut terfoto. Dan caption-nya memberi tahu kapan seseorang akan bergerak."
- **Visual:** Foto **terurai menjadi tiga lapisan** dalam ruang 3D (exploded view) dan kamera mengorbit perlahan:
  1. Lapisan belakang: label metadata melayang, yaitu `GPS -6.1754, 106.8272`, `14 Nov 2026 · 19:42`, `Perangkat: HP Contoh X1`. Garis putus-putus menarik pin ke peta stilistik.
  2. Lapisan tengah: kertas di meja membesar dan teks kop fiktif terlihat ("KESATUAN CONTOH · SURAT TELEGRAM").
  3. Lapisan depan: caption, dengan kata "Besok" dan "berangkat tugas" ditandai belah ketupat `--highlight`.
- Setiap temuan muncul **tepat saat disebut VO**.
- **Transisi:** ketiga lapisan terlepas menjadi kepingan

**Scene 3 · Kepingan yang tersusun** · 0:45–1:10 (25 dtk)
- **VO:** "Satu per satu, semuanya terlihat sepele. Tapi bagi pihak yang sengaja mengumpulkan, kepingan kecil seperti ini bisa disusun menjadi gambaran utuh: di mana, kapan, dan siapa. Ini bukan soal melarang berbagi kebahagiaan. Ini soal tahu apa yang ikut terbagi."
- **Visual:** Kepingan dari scene 2 (pin, jam, kop, caption) melayang lalu terkunci membentuk puzzle. Tiga kata muncul berurutan dengan ukuran besar: **di mana · kapan · siapa**. Suasana sempat tegang (cahaya meredup). Pada kalimat "bukan soal melarang", puzzle melunak dan kembali menjadi foto keluarga hangat dengan latar `--bg` gading.
- **Teks layar:** "di mana · kapan · siapa"
- **Transisi:** belah ketupat kecil muncul di tengah foto, membesar, lalu menutup layar

### Babak 2 — Solusi

**Scene 4 · Kenalkan TILIK** · 1:10–1:25 (15 dtk)
- **VO:** "Karena itu kami membuat TILIK. Dalam bahasa Jawa, tilik berarti menengok. Sebelum membagikan, tilik dulu."
- **Visual:** Latar gading. Logo terbentuk sesuai "Animasi logo" di Bagian B, lalu wordmark muncul dari bawah (mask reveal). Tagline menyusul.
- **Teks layar:** "Tilik dulu, baru bagikan."
- **Transisi:** logo mengecil ke pojok kiri atas sebagai watermark untuk scene 5–12

**Scene 5 · Tiga pemeriksaan** · 1:25–1:40 (15 dtk)
- **VO:** "Caranya sederhana. Pilih foto, tulis caption, lalu tekan Periksa. TILIK langsung menjalankan tiga pemeriksaan."
- **Visual:** HP bergaya ilustrasi yang terinspirasi UI TILIK: kartu krem, tombol soga "Periksa". Tiga langkah menyala bergantian (ikon foto → ikon pena → tombol). Saat "tiga pemeriksaan", tiga kartu melompat keluar dari HP dan berjajar di udara: **Metadata · Dokumen dinas · Caption**, masing-masing dengan label kecil "sedang dianalisis…".
- **Teks layar:** tiga label kartu
- **Transisi:** kamera mendekat ke kartu pertama

**Scene 6 · Pemeriksaan 1: Metadata** · 1:40–2:00 (20 dtk)
- **VO:** "Pertama, metadata. TILIK membaca data tersembunyi di dalam foto, seperti lokasi, waktu, dan tipe perangkat, lalu menyiapkan versi foto yang bersih. Versi itu diperiksa ulang. Kalau masih ada metadata, unduhan ditahan."
- **Visual:** Foto berdiri miring dalam 3D. **Bidang pemindai emas** menyapu dari kiri ke kanan. Label metadata terkelupas dari belakang foto lalu luruh menjadi debu. Foto kemudian disapu sekali lagi (verifikasi ulang). Muncul cap ✓ "diverifikasi ulang" berwarna `--ok`. Sisipkan sekilas (2 dtk) versi gagal: satu label tersisa memicu ikon gembok "unduhan ditahan".
- **Teks layar:** "Metadata dihapus · diverifikasi ulang"

**Scene 7 · Pemeriksaan 2: Dokumen dinas** · 2:00–2:28 (28 dtk)
- **VO:** "Kedua, dokumen dinas. Teks di dalam foto dibaca langsung di HP, lalu dicocokkan dengan aturan: kop satuan, klasifikasi, derajat surat, hingga blok alamat. Kata yang cocok disamarkan, dan Anda bisa memilih area mana yang tetap disamarkan. Wajah pun bisa dicari dan disamarkan bila diminta."
- **Visual:** Kertas dari scene 2 tampil besar dan datar. Kotak-kotak tipis muncul di sekitar setiap kata (proses membaca teks). Kata yang cocok dengan aturan berubah warna menjadi `--warn`, lalu **mosaik piksel mengendap** menutupinya. Di samping kertas, muncul daftar toggle kecil per area; satu toggle dimatikan dan mosaiknya terangkat, lalu dinyalakan lagi. Penutup: foto keluarga, tombol "Cari wajah untuk disamarkan" ditekan, dan mosaik turun di atas wajah siluet.
- **Teks layar:** "Dibaca di perangkat" (lencana kecil berikon HP)

**Scene 8 · Pemeriksaan 3: Caption** · 2:28–2:48 (20 dtk)
- **VO:** "Ketiga, caption. Aturan menangkap pola seperti jadwal pergerakan, lokasi penugasan, politik praktis, dan info pribadi. Lalu AI membaca konteks yang lolos dari aturan, dan menjelaskan alasannya dengan bahasa sehari-hari."
- **Visual:** Caption berukuran besar. Empat label kategori muncul seperti stempel di sekelilingnya. Kata "Besok … berangkat tugas" ditandai oleh lapisan "Aturan". Lapisan kedua, "AI", masuk dari kedalaman dengan efek kertas tembus pandang dan memunculkan gelembung penjelasan singkat: *"Caption ini menyebut waktu keberangkatan. Sebaiknya bagikan setelah tiba atau tanpa menyebut jadwal."*
- **Teks layar:** "Aturan" · "AI"

**Scene 9 · Satu tingkat risiko** · 2:48–3:05 (17 dtk)
- **VO:** "Hasilnya adalah satu tingkat risiko: aman, perlu perhatian, atau tinggi, yang diambil dari temuan paling serius. AI bisa menambah temuan, tapi tidak bisa menghapus temuan dari aturan. Dan kalau ada pemeriksaan yang gagal, TILIK tidak akan menyatakan aman."
- **Visual:** Tiga kartu dari scene 5 kembali, masing-masing berlabel status. Ketiganya mengalir ke satu indikator bertingkat (aman `--ok` / perlu perhatian `--warn` / tinggi `--error`), lalu jarum berhenti di tingkat tertinggi. Saat "tidak bisa menghapus", kartu AI mencoba menurunkan jarum tetapi terpental. Saat "pemeriksaan gagal", satu kartu menjadi abu-abu bertulisan "tidak tersedia", dan indikator diberi catatan "pemeriksaan belum lengkap".
- **Teks layar:** "Aman · Perlu perhatian · Tinggi"

### Babak 3 — Kepercayaan dan ajakan

**Scene 10 · Foto tidak keluar dari HP** · 3:05–3:30 (25 dtk)
- **VO:** "Bagian paling sensitif dikerjakan di HP Anda sendiri. Foto tidak dikirim ke server. Yang keluar hanya caption dan teks yang terbaca dari foto. Server tidak menyimpannya secara permanen, dan tidak perlu login."
- **Visual:** HP tampil sebagai **kotak kaca tertutup** semi-3D. Foto berada di dalamnya dan tidak bisa keluar (saat mencoba, ia memantul dari dinding kaca). Dari sebuah celah kecil, hanya potongan teks (kepingan huruf) yang mengalir lewat garis menuju ikon server di kejauhan. Ikon server menerima, memproses, dan mengirim hasil kembali, lalu teks di server memudar.
- **Teks layar:** "Foto tetap di perangkat" · "Tanpa penyimpanan permanen" · "Tanpa login"

**Scene 11 · Tetap bisa berbagi** · 3:30–3:50 (20 dtk)
- **VO:** "Foto yang sama. Momen yang sama. Tetap bisa dibagikan, hanya saja kini tanpa jejak yang tidak perlu."
- **Visual:** Kembali ke HP dari scene 1. Slider sebelum/sesudah menyapu foto: sisi "sebelum" memperlihatkan metadata, kop, dan wajah; sisi "sesudah" bersih dan tersamarkan. Ibu jari kini menekan "Bagikan". Foto terbang keluar, lalu ikon hati dan komentar ("Hati-hati di jalan, Yah ❤️") bermunculan dengan hangat.
- **Teks layar:** "Sebelum" · "Sesudah"

**Scene 12 · Jujur soal batas** · 3:50–4:05 (15 dtk)
- **VO:** "TILIK masih purwarupa. Wajah yang kecil atau jauh bisa terlewat, dan analisis visual masih dikembangkan. Tapi kebiasaan untuk menengok sebelum membagikan bisa dimulai hari ini."
- **Visual:** Tampilan tenang. Dua catatan kecil bergaya kertas tempel muncul dengan jujur dan tidak dramatis. Lalu satu belah ketupat bersinar pelan di tengah, sebagai simbol "kebiasaan kecil".
- **Teks layar:** "Purwarupa · terus dikembangkan"

**Scene 13 · Penutup** · 4:05–4:20 (15 dtk)
- **VO:** "Bisa dipakai dari browser dan dipasang di layar utama HP. Sebelum membagikan, tilik dulu."
- **Visual:** Logo lengkap muncul kembali di tengah dengan animasi penuh. Di bawahnya tampil URL dan disclaimer. Frame terakhir ditahan.
- **Teks layar:**
  - "Tilik dulu, baru bagikan."
  - `tilik-psi.vercel.app`
  - kecil: "Purwarupa untuk Kartika Cyber Hackathon 2026. Bukan produk resmi TNI AD."

---

## Bagian D — Naskah voice-over lengkap (untuk TTS)

Salin bagian ini ke alat TTS. Tanda `[jeda]` berarti hening ±0,8 detik; tanda `[jeda panjang]` berarti hening ±1,5 detik.

> Satu foto. [jeda] Satu caption. [jeda] Dibagikan dalam hitungan detik. [jeda panjang]
>
> Tapi foto itu membawa lebih banyak dari yang terlihat. Di dalam filenya tersimpan titik lokasi, jam pengambilan, sampai tipe HP. [jeda] Di sudut meja, sebuah surat dinas ikut terfoto. [jeda] Dan caption-nya memberi tahu kapan seseorang akan bergerak. [jeda panjang]
>
> Satu per satu, semuanya terlihat sepele. Tapi bagi pihak yang sengaja mengumpulkan, kepingan kecil seperti ini bisa disusun menjadi gambaran utuh: [jeda] di mana, [jeda] kapan, [jeda] dan siapa. [jeda panjang] Ini bukan soal melarang berbagi kebahagiaan. Ini soal tahu apa yang ikut terbagi. [jeda panjang]
>
> Karena itu kami membuat TILIK. [jeda] Dalam bahasa Jawa, tilik berarti menengok. [jeda] Sebelum membagikan, tilik dulu. [jeda panjang]
>
> Caranya sederhana. Pilih foto, tulis caption, lalu tekan Periksa. TILIK langsung menjalankan tiga pemeriksaan. [jeda]
>
> Pertama, metadata. TILIK membaca data tersembunyi di dalam foto, seperti lokasi, waktu, dan tipe perangkat, lalu menyiapkan versi foto yang bersih. Versi itu diperiksa ulang. Kalau masih ada metadata, unduhan ditahan. [jeda]
>
> Kedua, dokumen dinas. Teks di dalam foto dibaca langsung di HP, lalu dicocokkan dengan aturan: kop satuan, klasifikasi, derajat surat, hingga blok alamat. Kata yang cocok disamarkan, dan Anda bisa memilih area mana yang tetap disamarkan. [jeda] Wajah pun bisa dicari dan disamarkan bila diminta. [jeda]
>
> Ketiga, caption. Aturan menangkap pola seperti jadwal pergerakan, lokasi penugasan, politik praktis, dan info pribadi. Lalu AI membaca konteks yang lolos dari aturan, dan menjelaskan alasannya dengan bahasa sehari-hari. [jeda]
>
> Hasilnya adalah satu tingkat risiko: aman, perlu perhatian, atau tinggi, yang diambil dari temuan paling serius. AI bisa menambah temuan, tapi tidak bisa menghapus temuan dari aturan. [jeda] Dan kalau ada pemeriksaan yang gagal, TILIK tidak akan menyatakan aman. [jeda panjang]
>
> Bagian paling sensitif dikerjakan di HP Anda sendiri. Foto tidak dikirim ke server. Yang keluar hanya caption dan teks yang terbaca dari foto. Server tidak menyimpannya secara permanen, [jeda] dan tidak perlu login. [jeda panjang]
>
> Foto yang sama. [jeda] Momen yang sama. [jeda] Tetap bisa dibagikan, hanya saja kini tanpa jejak yang tidak perlu. [jeda panjang]
>
> TILIK masih purwarupa. Wajah yang kecil atau jauh bisa terlewat, dan analisis visual masih dikembangkan. Tapi kebiasaan untuk menengok sebelum membagikan bisa dimulai hari ini. [jeda panjang]
>
> Bisa dipakai dari browser dan dipasang di layar utama HP. [jeda] Sebelum membagikan, [jeda] tilik dulu.

**Catatan TTS:** ucapkan "TILIK" sebagai kata biasa ("ti-lik"), bukan dieja huruf per huruf. Kalau TTS salah mengucapkan "caption", ganti dengan "keterangan foto".

---

## Bagian E — Musik dan efek suara (untuk tahap editing)

| Bagian | Musik | Efek suara |
|---|---|---|
| Scene 1–3 | Ambient piano/pad yang tenang, perlahan menegang di scene 3 | ketikan, "whoosh" lapisan terurai, klik kepingan terkunci |
| Scene 4 | Hening sejenak, lalu satu nada hangat saat logo terbentuk | goresan pena, "ting" lembut saat belah ketupat muncul |
| Scene 5–9 | Beat ringan dan optimis (bisa bernuansa gamelan modern) | sapuan pemindai, piksel jatuh, stempel |
| Scene 10–13 | Membangun hangat, lalu resolusi di logo akhir | kaca beresonansi, notifikasi "suka" |

Gunakan musik bebas royalti (misalnya YouTube Audio Library) dan catat sumbernya di deskripsi video.

---

## Bagian F — Alur produksi singkat

1. Buat voice-over dari Bagian D, lalu cocokkan durasi tiap paragraf dengan tabel scene. Kalau berbeda, **durasi VO yang dipakai**, dan sesuaikan durasi scene-nya.
2. Bangun scene 4 (logo) lebih dulu sebagai acuan gaya, lalu kerjakan scene lain secara berurutan.
3. Rekam setiap scene di 1920×1080, 60 fps (OBS: Window Capture atau Browser Source), dengan browser layar penuh (`F11`).
4. Susun di editor video (CapCut, DaVinci Resolve, atau sejenisnya): scene → VO → musik → efek suara.
5. Ekspor 1080p untuk YouTube.
