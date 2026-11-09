"""Probe provider teks Fireworks & Groq (T-07) → bahan `docs/quota.md`.

Mengukur token dan latensi (P1), kepatuhan JSON terhadap
`contracts/llm-text-output.schema.json` (P3), burst rate limit Groq (P4), dan bentuk
error HTTP (P5). Hanya endpoint chat completions (NFR-PRIV-03). Skrip ini berdiri
sendiri: tidak mengimpor kode aplikasi dan tidak diimpor olehnya.

Jalankan dari `services/api`:

    uv run python -m scripts.probe --dry-run          # tanpa key, respons tiruan
    uv run --env-file <file-env> python -m scripts.probe -v   # nyata, key evaluasi

Env wajib (mode nyata, per provider terpilih): FIREWORKS_EVAL_API_KEY,
FIREWORKS_TEXT_MODEL, GROQ_EVAL_API_KEY, GROQ_TEXT_MODEL.
"""
