---
title: TILIK API
emoji: 🔎
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# TILIK API

Backend FastAPI untuk TILIK: rule engine dan analisis caption/teks OCR sebelum foto diunggah.
Stateless: gambar dan teks pengguna tidak disimpan dan tidak dicatat di log.

Kontrak: `contracts/openapi.yaml` di repo utama.

```
uv sync
uv run uvicorn app.main:app --reload --no-access-log   # http://localhost:8000
uv run pytest
docker build -t tilik-api . && docker run -p 7860:7860 -e ALLOWED_ORIGINS=http://localhost:3000 tilik-api
```

| Env | Keterangan |
|---|---|
| `ALLOWED_ORIGINS` | Origin CORS dipisah koma, tanpa wildcard. Kosong = tidak ada origin browser yang diizinkan. |
| `FIREWORKS_API_KEY`, `GROQ_API_KEY` | Secret server; belum dipakai di stub. |
