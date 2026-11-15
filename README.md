# TILIK

TILIK adalah aplikasi web yang membantu prajurit TNI AD dan keluarganya memeriksa foto serta caption **sebelum** dibagikan ke media sosial. Aplikasi ini menandai metadata lokasi yang tersimpan di foto, dokumen dinas yang tidak sengaja ikut terfoto atau ter-screenshot, dan caption yang berpotensi membocorkan informasi sensitif, lalu menjelaskan alasannya dengan bahasa yang mudah dipahami dan menyediakan versi foto tanpa metadata. Pemrosesan yang paling sensitif (metadata dan pembacaan teks di foto) dilakukan langsung di perangkat pengguna.

> Purwarupa untuk Kartika Cyber Hackathon 2026. Bukan produk resmi TNI AD.

## Coba

- Web: https://tilik-psi.vercel.app
- API (cek status): https://tilik-api.fastapicloud.dev/health

Tanpa login. Server API tidur saat tidak dipakai, jadi pemeriksaan pertama bisa butuh ±6 detik lebih lama. Pemeriksaan pertama juga mengunduh ±5 MB data OCR sekali; setelah itu disimpan cache browser.

## Cara kerja

Pengguna memilih satu foto, menulis caption (opsional), lalu menekan **Periksa**. TILIK menjalankan tiga pemeriksaan:

| Pemeriksaan | Di mana | Yang diperiksa |
|---|---|---|
| Metadata foto | Perangkat | GPS, waktu pengambilan, merek/tipe HP, dan software di EXIF. Tersedia unduhan versi tanpa metadata yang dibuat ulang lewat canvas dan **diverifikasi ulang**; unduhan ditahan bila masih ada metadata. |
| Dokumen dinas dalam foto | Perangkat (OCR) + server (aturan) | Teks di foto dibaca dengan Tesseract.js bahasa Indonesia di browser, lalu teksnya dicocokkan dengan aturan (kop satuan, klasifikasi, derajat, Surat Telegram, blok alamat). |
| Isi caption | Server | Aturan (jadwal pergerakan, lokasi penugasan, politik praktis, info pribadi) lalu LLM untuk konteks yang tidak tertangkap aturan. |

**Yang keluar dari perangkat** hanya caption dan teks hasil OCR (beserta posisi dan tingkat keyakinan per kata). **Gambar tidak dikirim ke server** di versi ini.

Setiap pemeriksaan tampil sebagai kartu dengan status sendiri ("sedang dianalisis", "selesai", "sibuk, coba lagi", "tidak tersedia"). **Risiko akhir** (aman / perlu perhatian / tinggi) adalah tingkat tertinggi dari semua temuan. Karena diambil yang tertinggi, temuan LLM tidak bisa menurunkan atau menghapus temuan aturan. Bila ada pemeriksaan yang gagal, risiko akhir diberi catatan "pemeriksaan belum lengkap" dan tidak pernah tampil sebagai "aman" saja.

Rincian alur dan kontrak data: [docs/architecture.md](docs/architecture.md).

## Privasi dan keamanan

- **Stateless.** Server tidak menyimpan gambar atau teks pengguna dan tidak mencatatnya di log. Log hanya berisi id request, method, path, status, latensi, serta nama provider dan jumlah token untuk panggilan LLM.
- **API key hanya di server**, dibaca dari variabel lingkungan (`FIREWORKS_API_KEY`); tidak ada di frontend atau repo.
- **Teks pengguna diperlakukan sebagai data tak tepercaya.** Caption dan teks OCR dibungkus penanda acak per request di prompt, model diinstruksikan untuk tidak mengikuti isinya, dan output model divalidasi terhadap skema JSON (satu kali coba ulang bila tidak valid). Output model tidak pernah dieksekusi.
- **Aturan berjalan terpisah dari LLM.** Rule engine tidak mengimpor modul LLM (dicek oleh tes) dan dijalankan lebih dulu.
- **CORS** hanya untuk origin yang didaftarkan; wildcard ditolak.

## Status fitur

| Sudah ada | Belum ada (rencana berikutnya) |
|---|---|
| Input dan validasi foto + caption; downscale (≤ 2048 px di perangkat, ≤ 1024 px untuk versi kirim) | Blur/redaksi area sensitif di foto |
| Metadata: baca EXIF dan unduh versi tanpa metadata yang diverifikasi ulang | Deteksi wajah |
| OCR Tesseract.js `ind` di browser (kata, posisi, keyakinan) | Analisis visual dengan model visi (endpoint `/analyze/visual` masih kerangka) |
| Rule engine YAML, rule set v1: 8 aturan dokumen dinas, 7 aturan caption | Cadangan provider LLM kedua (Groq) |
| `/analyze/caption` dengan LLM Fireworks (chat completions, validasi skema + 1 coba ulang) | Rate limit, cache, dan batas belanja |
| Tampilan hasil per pemeriksaan dan risiko akhir dengan catatan "pemeriksaan belum lengkap" | Galeri contoh |
| Generator dokumen sintetis untuk evaluasi | Instalasi sebagai PWA (manifest, service worker, offline) |
| Deploy: Vercel (web) + FastAPI Cloud (API) | Angka evaluasi pada test set |

## Struktur repo

| Folder | Isi |
|---|---|
| [`apps/web`](apps/web) | Frontend Next.js: input, EXIF, OCR, tampilan hasil |
| [`services/api`](services/api) | Backend FastAPI: rule engine, aturan YAML, provider LLM |
| [`contracts`](contracts) | Kontrak data (JSON Schema + OpenAPI) dan contoh valid/tidak valid |
| [`eval`](eval) | Generator dokumen sintetis dan tesnya |
| [`deploy`](deploy) | Panduan deploy Vercel + FastAPI Cloud |
| [`docs`](docs) | Arsitektur dan rencana evaluasi |

## Menjalankan secara lokal

Prasyarat: Node.js ≥ 20.9 + pnpm, Python + [uv](https://docs.astral.sh/uv/).

```bash
# API (http://localhost:8000)
cd services/api
uv sync
uv run fastapi dev
uv run pytest                 # 518 lewat, 5 di-deselect (15 Nov 2026)

# Web (http://localhost:3000)
cd apps/web
pnpm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
pnpm dev
pnpm test                     # 172 lewat (15 Nov 2026)
pnpm build
```

Variabel API: `ALLOWED_ORIGINS` (mis. `http://localhost:3000`), `FIREWORKS_API_KEY`, `FIREWORKS_TEXT_MODEL`, `TEXT_REASONING_EFFORT`, `TEXT_MAX_TOKENS`. Tanpa key Fireworks, API tetap jalan; pemeriksaan caption oleh LLM berstatus "tidak tersedia" dan aturan tetap berjalan. Deploy: [deploy/README.md](deploy/README.md).

Generator evaluasi (`cd eval && uv run python -m generator --help`) butuh fontconfig (`fc-match`) dan Chromium Playwright (`uv run playwright install chromium`), sehingga tidak jalan di Windows tanpa fontconfig. Rencana evaluasi: [docs/eval-plan.md](docs/eval-plan.md).

## Batasan

- **Data evaluasi sintetis/aproksimasi.** Tidak ada akses ke data atau dokumen internal TNI AD; dokumen uji dibuat generator dengan nama satuan dan nomor fiktif, sehingga hanya mendekati dokumen asli.
- **Belum ada angka evaluasi test set.** Metodenya sudah ditulis di [docs/eval-plan.md](docs/eval-plan.md).
- **OCR lemah** pada foto miring, buram, kecil, atau foto layar (moiré). Dokumen dalam foto seperti itu bisa lolos.
- **OCR memuat file dari CDN** (jsdelivr) saat pertama dipakai, jadi belum bisa dipakai offline. Yang diunduh hanya program dan data bahasa; gambar dan teks tidak dikirim lewat jalur itu.
- Aturan dan LLM bisa memberi peringatan keliru atau melewatkan hal yang berisiko. TILIK alat bantu, bukan pengganti penilaian pengguna.

## Atribusi

Versi dan lisensi diambil dari metadata paket yang terpasang (`node_modules/*/package.json`, `METADATA` di `.venv`) per 15 November 2026.

**Web (`apps/web`)**

| Library | Versi | Lisensi | Dipakai untuk |
|---|---|---|---|
| next | 16.4.5 | MIT | Framework web |
| react, react-dom | 19.3.0 | MIT | UI |
| ajv | 8.20.0 | MIT | Validasi respons API terhadap kontrak |
| exifr | 7.1.3 | MIT | Membaca EXIF dan memverifikasi versi tanpa metadata |
| tesseract.js | 6.0.1 | Apache-2.0 | OCR di browser |
| tesseract.js-core | 6.1.2 (paket npm); core 6.0.0 dimuat dari CDN | Apache-2.0 | Mesin OCR (WebAssembly) |
| vitest (dev) | 5.1.0 | MIT | Tes |
| typescript (dev) | 5.9.3 | Apache-2.0 | Pemeriksaan tipe |
| piexifjs (dev) | 1.0.6 | MIT | Membuat foto ber-EXIF fiktif untuk tes |

**API (`services/api`)**

| Library | Versi | Lisensi | Dipakai untuk |
|---|---|---|---|
| fastapi | 0.162.2 | MIT | Framework API |
| uvicorn | 0.54.0 | BSD-3-Clause | Server ASGI |
| pydantic | 2.14.3 | MIT | Validasi request dan output LLM |
| httpx | 0.28.1 | BSD-3-Clause | Klien HTTP ke provider LLM |
| pyyaml | 6.0.3 | MIT | Memuat aturan YAML |
| slowapi | 0.1.10 | MIT | Terpasang untuk rate limit; **belum dipakai** |

**Evaluasi (`eval`)**

| Library | Versi | Lisensi | Dipakai untuk |
|---|---|---|---|
| jinja2 | 3.1.6 | BSD-3-Clause | Template dokumen sintetis |
| playwright | 1.64.1 | Apache-2.0 | Merender template menjadi gambar |
| pyyaml | 6.0.3 | MIT | Konfigurasi generator |

**Data dan model**

| Item | Sumber | Lisensi |
|---|---|---|
| Data bahasa Tesseract `ind` (`4.0.0_best_int`) | Paket npm `@tesseract.js-data/ind` 1.0.0 (proyek naptha/tessdata), versi integer dari tesseract-ocr/tessdata_best | Paket npm: MIT; data asal tessdata_best: Apache-2.0 |
| Model LLM `accounts/fireworks/models/deepseek-v4p1-flash` | Fireworks AI | Lihat halaman model di Fireworks AI |

**Layanan**

| Layanan | Dipakai untuk |
|---|---|
| Fireworks AI | Inferensi LLM untuk pemeriksaan caption (chat completions) |
| Vercel | Hosting frontend |
| FastAPI Cloud | Hosting API |
| jsDelivr | CDN untuk program dan data bahasa OCR |

## Deklarasi penggunaan AI

**AI sebagai alat bantu pengembangan.** Implementasi kode, tes, dan dokumen teknis proyek ini dibantu **Claude Code** (Anthropic, model Claude Opus). Commit yang dibantu ditandai trailer `Co-Authored-By: Claude`; per commit dokumen ini, **24 dari 25 commit** di `main` memakai trailer tersebut (satu-satunya yang tidak adalah commit awal struktur repo). Riwayatnya bisa dicek dengan `git log --format='%h %s%n%b' | grep -B2 Co-Authored-By`.

Pembagian peran:

| Pekerjaan | Manusia | AI (Claude Code) |
|---|---|---|
| Ide, masalah, dan sasaran pengguna | [KONFIRMASI AYEN: siapa yang menyusun] | [KONFIRMASI AYEN] |
| Kebutuhan, kontrak data, dan keputusan arsitektur | [KONFIRMASI AYEN: menyusun/memutuskan/mereview] | [KONFIRMASI AYEN: membantu menyusun draf?] |
| Kode aplikasi dan tes | [KONFIRMASI AYEN: review dan persetujuan setiap commit?] | Menulis sebagian besar kode dan tes (lihat trailer commit) |
| Isi aturan (pola kata dan dasar aturan) | [KONFIRMASI AYEN: siapa yang menentukan dan mereview] | [KONFIRMASI AYEN] |
| Uji manual di perangkat dan di URL deploy | [KONFIRMASI AYEN] | — |
| Dokumen ini dan dokumentasi teknis | [KONFIRMASI AYEN: review] | Menyusun draf |

**AI di dalam produk.** Terpisah dari alat bantu pengembangan, TILIK memakai LLM (`deepseek-v4p1-flash` lewat Fireworks AI) **saat aplikasi berjalan** untuk menilai isi caption dan teks OCR. Hasil LLM hanya menambah temuan; tidak bisa menurunkan temuan aturan, dan selalu diberi label "dari AI" di tampilan.

**Karya sebelum periode program:** [KONFIRMASI AYEN: ada/tidak ada karya sebelum periode program].

## Disclaimer

- Purwarupa hackathon, **bukan produk resmi TNI AD** dan tidak mewakili kebijakan TNI AD.
- Nama satuan, tokoh, nomor surat, dan koordinat di contoh, tes, dan data evaluasi adalah **fiktif** (mis. "Yonif 999/Contoh").
- Repo dan aplikasi ini tidak memakai lambang atau logo TNI AD maupun Pussiberad.

## Lisensi

[KONFIRMASI AYEN: lisensi proyek]
