# Deploy TILIK (hello-world end-to-end)

Jalur: **Vercel** (`apps/web`) → **FastAPI Cloud** (`services/api`) → provider LLM teks (Fireworks, chat completions).

FastAPI Cloud membangun app dari `services/api/pyproject.toml` + `uv.lock` dan menjalankan
`app.main:app` (`[tool.fastapi] entrypoint`). `Dockerfile` **diabaikan** di sana; Dockerfile
hanya untuk uji lokal dan profil self-hosted.

## 1. Backend di FastAPI Cloud

Paket Hobby gratis dibatasi **3 app** per akun. Cek dulu di dashboard
FastAPI Cloud bahwa masih ada slot.

```bash
cd services/api
unset VIRTUAL_ENV
uv sync
uv run fastapi login      # sekali; browser terbuka untuk autentikasi
uv run fastapi deploy     # pilih team, lalu "create a new app", nama: tilik-api
```

- Upload menghormati `services/api/.gitignore` (`.env*`, `.venv/`, `scripts/probe/out/` tidak ikut).
- Deploy pertama membuat folder `.fastapicloud/` (tautan ke app; di-.gitignore) dan mencetak URL
  `https://<app>.fastapicloud.dev`.

### Variabel dan secret

```bash
uv run fastapi cloud env set ALLOWED_ORIGINS "http://localhost:3000"
uv run fastapi cloud env set FIREWORKS_API_KEY "<key-demo-fireworks>" --secret
uv run fastapi cloud env set FIREWORKS_TEXT_MODEL "accounts/fireworks/models/deepseek-v4p1-flash"
uv run fastapi cloud env set TEXT_REASONING_EFFORT "none"
uv run fastapi cloud env set TEXT_MAX_TOKENS "1000"
uv run fastapi cloud env set RATE_LIMIT "20/minute;300/day"
uv run fastapi cloud env set DAILY_TOKEN_BUDGET "2000000"
uv run fastapi deploy     # redeploy supaya env terbaca
```

- `ALLOWED_ORIGINS`: dipisah koma, tanpa `/` di akhir, **tanpa `*`** (app menolak start bila ada
  wildcard). Setelah URL Vercel ada, set ulang menjadi
  `https://<project>.vercel.app,http://localhost:3000` lalu redeploy.
- Pakai key **demo**, bukan key `_EVAL_` (NFR-COST-04).
- `FIREWORKS_API_KEY` atau `FIREWORKS_TEXT_MODEL` kosong → app tetap jalan, tetapi L4 LLM selalu
  `unavailable` dengan note "LLM belum dikonfigurasi".
- `TEXT_REASONING_EFFORT` dikirim sebagai `reasoning_effort`. Model teks demo adalah model reasoning:
  tanpa `none`, penalarannya menghabiskan `max_tokens` dan JSON terpotong (timeout/`error`).
  Untuk model non-reasoning, kosongkan variabel ini (kunci tidak dikirim). Nilai yang ditolak
  provider terlihat di log sebagai `http_status=400`.
- `TEXT_MAX_TOKENS`: default 1000 bila kosong (NFR-COST-03).
- `RATE_LIMIT` (NFR-SEC-06): batas per IP klien untuk `POST /analyze/caption` dan
  `/analyze/visual` (kuota terpisah per endpoint); `/health` tidak dibatasi. Default
  `10/minute;60/day`. Lewat batas → 429 `RATE_LIMITED` + `Retry-After`. IP diambil dari entri
  **paling kanan** `X-Forwarded-For` (diasumsikan ditambahkan proxy FastAPI Cloud; belum
  terverifikasi, uji dengan langkah di §3). Juri di satu jaringan kantor berbagi satu IP, jadi
  untuk demo pakai angka lebih longgar, mis. `20/minute;300/day`. IP tidak pernah ditulis ke log.
- `DAILY_TOKEN_BUDGET` (NFR-COST-01, dihitung dalam token, bukan USD): jumlah `tokens_in + tokens_out`
  LLM teks per hari, reset 00.00 WIB. Default 2000000. Lewat batas → L4 LLM `unavailable` dengan
  note "Pemeriksaan AI dijeda sementara karena batas harian; aturan tetap berjalan."; L3/L4 aturan
  tetap jalan.
- Cache hasil L4 LLM (NFR-COST-02): input identik (spasi caption dinormalisasi) dalam 24 jam
  tidak memanggil provider dan tidak menghitung token. Maks. 512 entri.
- Penghitung rate limit, anggaran token, dan cache semuanya **in-memory**: kembali ke nol saat
  instance restart, redeploy, atau scale-to-zero, dan tidak dibagi bila ada lebih dari satu replika.
- Perintah di atas masuk ke riwayat shell. Bila tidak mau, isi secret lewat dashboard
  (app → *Environment Variables*, tandai sebagai secret).

> App gratis **scale-to-zero** saat idle; request pertama setelahnya lebih lambat (cold start).
> Frontend memakai timeout 30 detik. Ping berkala dijadwalkan di T-22.

Redeploy setiap kali `services/api/` berubah: `cd services/api && uv run fastapi deploy`.

## 2. Frontend di Vercel

1. **Add New → Project** → impor repo GitHub publik TILIK (push `main` dulu).
2. **Root Directory**: `apps/web`. Framework terdeteksi Next.js; package manager pnpm.
3. **Environment Variables** (Production dan Preview):
   `NEXT_PUBLIC_API_URL = https://<app>.fastapicloud.dev` (tanpa `/` di akhir).
   Jangan pernah menaruh key apa pun di variabel `NEXT_PUBLIC_*`.
4. Deploy, lalu tambahkan URL produksi Vercel ke `ALLOWED_ORIGINS` (langkah 1) dan redeploy API.
   Domain preview Vercel (`<project>-git-…vercel.app`) **tidak** otomatis diizinkan.

## 3. Smoke test

```bash
API=https://<app>.fastapicloud.dev
WEB=https://<project>.vercel.app

# Health: 200 dan {"status":"ok",...}
curl -s -w ' [%{http_code}]\n' "$API/health"

# Caption: 200, tiga layer berurutan. L3 dan L4 aturan "ok" (provider "rule");
# L4 LLM "ok" dengan provider "fireworks". Bila key/model belum diisi: L4 LLM
# "unavailable", provider null, note "LLM belum dikonfigurasi".
curl -s -w ' [%{http_code}]\n' -X POST "$API/analyze/caption" \
  -H 'content-type: application/json' \
  -d '{"caption":"Jangan lupa coblos nomor urut 9 ya!","ocr_text":"SURAT TELEGRAM\nNOMOR : ST/12/2026","lang":"id"}'

# CORS origin yang diizinkan: harus ada access-control-allow-origin
curl -s -o /dev/null -D - -X OPTIONS "$API/analyze/caption" \
  -H "Origin: $WEB" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' | grep -i '^access-control-allow-origin'

# CORS origin asing: TIDAK boleh ada access-control-allow-origin (perintah mencetak "OK")
curl -s -o /dev/null -D - -X OPTIONS "$API/analyze/caption" \
  -H 'Origin: https://contoh-jahat.test' -H 'Access-Control-Request-Method: POST' \
  | grep -qi '^access-control-allow-origin' && echo "GAGAL: origin asing diizinkan" || echo "OK"
```

Pengaman biaya (T-20), setelah `RATE_LIMIT` terpasang:

```bash
# Rate limit: N kali 200 (N = batas per menit) lalu 429
for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}
" -X POST "$API/analyze/caption"   -H 'content-type: application/json' -d '{"caption":"tes","ocr_text":null,"lang":"id"}'; done
```
- Segera setelahnya buka `$WEB` dari HP dengan data seluler: analisis harus tetap jalan. Bila ikut
  429, proxy tidak menambahkan IP klien di kanan `X-Forwarded-For` seperti dugaan: semua pengguna
  berbagi satu kuota. Jangan demo dengan limit ketat; longgarkan `RATE_LIMIT` dan laporkan.
- Kirim caption yang sama dua kali: `latency_ms` L4 LLM kedua jauh lebih kecil (cache) dan log
  memuat `cache=hit`.

Lalu buka `$WEB`: status `/health` harus `ok`, dan tombol **Uji caption** menampilkan JSON
yang lolos validasi kontrak.

## 4. Cek log

```bash
cd services/api && uv run fastapi cloud logs
```
Log app hanya boleh berisi baris seperti:
```
INFO tilik.llm request_id=… provider=fireworks status=ok latency_ms=3400 tokens_in=… tokens_out=… http_status=200
INFO tilik.access request_id=… method=POST path=/analyze/caption status=200 latency_ms=3410
```
Tidak boleh ada isi caption, teks OCR, query string, IP klien, atau pesan exception
(NFR-PRIV-01). Log di level platform (proxy FastAPI Cloud) di luar kendali app; catat apa yang
terlihat di dashboard untuk bagian privasi di report.
