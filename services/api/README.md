# TILIK API

Backend FastAPI untuk TILIK: rule engine dan analisis caption/teks OCR sebelum foto diunggah.
Stateless: gambar dan teks pengguna tidak disimpan dan tidak dicatat di log.

Kontrak: `contracts/openapi.yaml` di repo utama. Deploy demo: FastAPI Cloud (`deploy/README.md`).

```
uv sync
uv run fastapi dev                                     # http://localhost:8000, reload
uv run pytest
docker build -t tilik-api . && docker run -p 7860:7860 -e ALLOWED_ORIGINS=http://localhost:3000 tilik-api
```

| Env | Keterangan |
|---|---|
| `ALLOWED_ORIGINS` | Origin CORS dipisah koma, tanpa wildcard. Kosong = tidak ada origin browser yang diizinkan. |
| `FIREWORKS_API_KEY`, `GROQ_API_KEY` | Secret server; belum dipakai di stub. |

Log hanya berisi `request_id`, method, path, status, dan latensi (logger `tilik.access`).
Access log bawaan uvicorn dimatikan dari dalam aplikasi karena memuat IP klien dan query string.
