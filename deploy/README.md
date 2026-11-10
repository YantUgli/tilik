# Deploy TILIK (hello-world end-to-end)

Jalur: **Vercel** (`apps/web`) → **Hugging Face Spaces** (`services/api`, Docker) → provider LLM (belum dipakai di stub).

## 1. Backend di Hugging Face Spaces

1. Di huggingface.co: **New Space** → SDK **Docker** → template **Blank** → visibilitas **Public**
   (browser harus bisa memanggilnya tanpa token). Catat nama `<owner>/<space>`.
   URL API nanti: `https://<owner>-<space>.hf.space`.
2. **Settings → Variables and secrets**:
   | Nama | Jenis | Nilai |
   |---|---|---|
   | `ALLOWED_ORIGINS` | Variable | `https://<project>.vercel.app,http://localhost:3000` (tanpa `/` di akhir, tanpa `*`) |
   | `FIREWORKS_API_KEY` | **Secret** | key demo (bukan key `_EVAL_`) |
   | `GROQ_API_KEY` | **Secret** | key demo |

   Domain preview Vercel (`<project>-git-…vercel.app`) **tidak** otomatis diizinkan; tambahkan
   bila perlu menguji preview.
3. Space hanya butuh isi `services/api/` (ada `Dockerfile` dan `README.md` berfrontmatter
   `sdk: docker`, `app_port: 7860`). Dorong subfolder itu ke repo Space dari akar repo:
   ```bash
   git remote add hf https://huggingface.co/spaces/<owner>/<space>   # sekali saja
   git subtree split --prefix services/api -b hf-space
   git push hf hf-space:main --force
   git branch -D hf-space
   ```
   Saat diminta password, pakai **access token HF** (role *write*), bukan password akun.
   Ulangi tiga perintah terakhir setiap kali `services/api/` berubah.
4. Tunggu status Space **Running** (tab *Logs* menampilkan `Uvicorn running on http://0.0.0.0:7860`).

> Space gratis **tidur** setelah lama tidak dipakai; request pertama setelahnya bisa butuh
> puluhan detik (frontend memakai timeout 30 detik). Keep-alive dijadwalkan di T-22.

## 2. Frontend di Vercel

1. **Add New → Project** → impor repo GitHub publik TILIK.
2. **Root Directory**: `apps/web`. Framework terdeteksi Next.js; package manager pnpm.
3. **Environment Variables** (Production dan Preview):
   `NEXT_PUBLIC_API_URL = https://<owner>-<space>.hf.space` (tanpa `/` di akhir).
   Jangan pernah menaruh key apa pun di variabel `NEXT_PUBLIC_*`.
4. Deploy. Bila URL produksi berbeda dari yang diisi di `ALLOWED_ORIGINS`, perbarui variabel
   di Space (Space restart otomatis).

## 3. Smoke test

```bash
API=https://<owner>-<space>.hf.space
WEB=https://<project>.vercel.app

# Health: 200 dan {"status":"ok",...}
curl -s -w ' [%{http_code}]\n' "$API/health"

# Stub caption: 200, tiga layer status "skipped"
curl -s -w ' [%{http_code}]\n' -X POST "$API/analyze/caption" \
  -H 'content-type: application/json' \
  -d '{"caption":"uji koneksi","ocr_text":null,"lang":"id"}'

# CORS origin yang diizinkan: harus ada access-control-allow-origin
curl -s -o /dev/null -D - -X OPTIONS "$API/analyze/caption" \
  -H "Origin: $WEB" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' | grep -i '^access-control-allow-origin'

# CORS origin asing: TIDAK boleh ada access-control-allow-origin (perintah mencetak "OK")
curl -s -o /dev/null -D - -X OPTIONS "$API/analyze/caption" \
  -H 'Origin: https://contoh-jahat.test' -H 'Access-Control-Request-Method: POST' \
  | grep -qi '^access-control-allow-origin' && echo "GAGAL: origin asing diizinkan" || echo "OK"
```

Lalu buka `$WEB`: status `/health` harus `ok`, dan tombol **Uji caption** menampilkan JSON stub
yang lolos validasi kontrak.

## 4. Cek log

Tab *Logs* Space hanya boleh berisi baris seperti:
```
INFO tilik.access request_id=… method=POST path=/analyze/caption status=200 latency_ms=0
```
Tidak boleh ada isi caption, teks OCR, query string, atau pesan exception (NFR-PRIV-01).
